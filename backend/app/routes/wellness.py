"""
Wellness & Readiness API routes.
Handles daily wellness check-ins and triggers readiness computation.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from datetime import date, timedelta
from pydantic import BaseModel, Field
from typing import Optional, List
from app.database import get_db
from app.utils.auth import verify_firebase_token
from app.models.schedule import WellnessCheckin, ReadinessSnapshot
from app.services.readiness_engine import compute_composite_readiness

router = APIRouter(
    prefix="/api/wellness",
    tags=["Wellness & Readiness"]
)


class WellnessCheckinInput(BaseModel):
    confidence: int = Field(..., ge=1, le=5, description="Self-rated confidence (1=low, 5=high)")
    stress: int = Field(..., ge=1, le=5, description="Stress level (1=calm, 5=very stressed)")
    readiness: int = Field(..., ge=1, le=5, description="Perceived exam readiness (1=unprepared, 5=ready)")
    energy: int = Field(..., ge=1, le=5, description="Energy level (1=exhausted, 5=energized)")
    notes: Optional[str] = ""


@router.post("/checkin")
async def submit_wellness_checkin(
    input_data: WellnessCheckinInput,
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    """Submit a daily wellness self-rating and trigger readiness computation."""
    try:
        today = date.today()

        # Check if already submitted today — update if so
        query = select(WellnessCheckin).where(
            and_(WellnessCheckin.user_id == user_id, WellnessCheckin.date == today)
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            existing.confidence = input_data.confidence
            existing.stress = input_data.stress
            existing.readiness = input_data.readiness
            existing.energy = input_data.energy
            existing.notes = input_data.notes or ""
            wellness = existing
        else:
            wellness = WellnessCheckin(
                user_id=user_id,
                date=today,
                confidence=input_data.confidence,
                stress=input_data.stress,
                readiness=input_data.readiness,
                energy=input_data.energy,
                notes=input_data.notes or ""
            )
            db.add(wellness)

        await db.commit()
        await db.refresh(wellness)

        # Automatically compute readiness snapshot
        readiness = await compute_composite_readiness(db, user_id, wellness)

        # Save snapshot
        snap_query = select(ReadinessSnapshot).where(
            and_(ReadinessSnapshot.user_id == user_id, ReadinessSnapshot.date == today)
        )
        snap_result = await db.execute(snap_query)
        existing_snap = snap_result.scalar_one_or_none()

        if existing_snap:
            existing_snap.perceived_readiness = readiness["perceived_readiness"]
            existing_snap.predicted_readiness = readiness["predicted_readiness"]
            existing_snap.gap_score = readiness["gap_score"]
            existing_snap.gap_label = readiness["gap_label"]
            existing_snap.composite_score = readiness["composite_score"]
            existing_snap.stress_level = readiness["stress_level"]
            existing_snap.factors_json = readiness["factors"]
            existing_snap.recommendations_json = readiness["recommendations"]
            snapshot = existing_snap
        else:
            snapshot = ReadinessSnapshot(
                user_id=user_id,
                date=today,
                perceived_readiness=readiness["perceived_readiness"],
                predicted_readiness=readiness["predicted_readiness"],
                gap_score=readiness["gap_score"],
                gap_label=readiness["gap_label"],
                composite_score=readiness["composite_score"],
                stress_level=readiness["stress_level"],
                factors_json=readiness["factors"],
                recommendations_json=readiness["recommendations"]
            )
            db.add(snapshot)

        await db.commit()

        return {
            "wellness": {
                "id": wellness.id,
                "confidence": wellness.confidence,
                "stress": wellness.stress,
                "readiness": wellness.readiness,
                "energy": wellness.energy,
                "notes": wellness.notes,
                "date": str(wellness.date)
            },
            "readiness": readiness
        }
    except Exception as e:
        await db.rollback()
        print(f"Error in submit_wellness_checkin: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/today")
async def get_today_wellness(
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    """Get today's wellness check-in and readiness snapshot."""
    try:
        today = date.today()

        # Get wellness
        w_query = select(WellnessCheckin).where(
            and_(WellnessCheckin.user_id == user_id, WellnessCheckin.date == today)
        )
        w_result = await db.execute(w_query)
        wellness = w_result.scalar_one_or_none()

        # Get snapshot
        s_query = select(ReadinessSnapshot).where(
            and_(ReadinessSnapshot.user_id == user_id, ReadinessSnapshot.date == today)
        )
        s_result = await db.execute(s_query)
        snapshot = s_result.scalar_one_or_none()

        return {
            "has_checked_in": wellness is not None,
            "wellness": {
                "id": wellness.id,
                "confidence": wellness.confidence,
                "stress": wellness.stress,
                "readiness": wellness.readiness,
                "energy": wellness.energy,
                "notes": wellness.notes,
                "date": str(wellness.date)
            } if wellness else None,
            "readiness": {
                "composite_score": snapshot.composite_score,
                "perceived_readiness": snapshot.perceived_readiness,
                "predicted_readiness": snapshot.predicted_readiness,
                "gap_score": snapshot.gap_score,
                "gap_label": snapshot.gap_label,
                "stress_level": snapshot.stress_level,
                "factors": snapshot.factors_json,
                "recommendations": snapshot.recommendations_json
            } if snapshot else None
        }
    except Exception as e:
        print(f"ERROR in get_today_wellness for user {user_id}: {str(e)}")
        # Instead of crashing, return a partial success state so UI can handle it gracefully
        return {
            "has_checked_in": False,
            "wellness": None,
            "readiness": None,
            "error": str(e)
        }


@router.get("/history")
async def get_wellness_history(
    days: int = Query(default=30, ge=1, le=90),
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    """Get historical readiness snapshots for trend charts."""
    cutoff = date.today() - timedelta(days=days)

    query = select(ReadinessSnapshot).where(
        and_(
            ReadinessSnapshot.user_id == user_id,
            ReadinessSnapshot.date >= cutoff
        )
    ).order_by(ReadinessSnapshot.date)
    result = await db.execute(query)
    snapshots = result.scalars().all()

    return {
        "days_requested": days,
        "data_points": len(snapshots),
        "snapshots": [
            {
                "date": str(s.date),
                "composite_score": s.composite_score,
                "perceived_readiness": s.perceived_readiness,
                "predicted_readiness": s.predicted_readiness,
                "gap_score": s.gap_score,
                "gap_label": s.gap_label,
                "stress_level": s.stress_level,
                "factors": s.factors_json,
                "recommendations": s.recommendations_json
            }
            for s in snapshots
        ]
    }


@router.post("/readiness")
async def trigger_readiness_computation(
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    """Manually trigger a readiness computation (useful for refreshing after quiz/schedule changes)."""
    try:
        readiness = await compute_composite_readiness(db, user_id)

        # Save/update snapshot
        today = date.today()
        snap_query = select(ReadinessSnapshot).where(
            and_(ReadinessSnapshot.user_id == user_id, ReadinessSnapshot.date == today)
        )
        snap_result = await db.execute(snap_query)
        existing = snap_result.scalar_one_or_none()

        if existing:
            existing.perceived_readiness = readiness["perceived_readiness"]
            existing.predicted_readiness = readiness["predicted_readiness"]
            existing.gap_score = readiness["gap_score"]
            existing.gap_label = readiness["gap_label"]
            existing.composite_score = readiness["composite_score"]
            existing.stress_level = readiness["stress_level"]
            existing.factors_json = readiness["factors"]
            existing.recommendations_json = readiness["recommendations"]
        else:
            snapshot = ReadinessSnapshot(
                user_id=user_id,
                date=today,
                perceived_readiness=readiness["perceived_readiness"],
                predicted_readiness=readiness["predicted_readiness"],
                gap_score=readiness["gap_score"],
                gap_label=readiness["gap_label"],
                composite_score=readiness["composite_score"],
                stress_level=readiness["stress_level"],
                factors_json=readiness["factors"],
                recommendations_json=readiness["recommendations"]
            )
            db.add(snapshot)

        await db.commit()
        return readiness
    except Exception as e:
        await db.rollback()
        print(f"Error in trigger_readiness_computation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
