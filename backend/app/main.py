from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import PROJECT_NAME, ENV
from app.routes.career import router as career_router
from app.routes.students import router as students_router
from app.routes.progress import router as progress_router
from app.routes.quiz import router as quiz_router
from app.routes.jobs import router as jobs_router
from app.routes.resources import router as resources_router
from app.routes.schedules import router as schedules_router
from app.routes.wellness import router as wellness_router
from app.routes.interviews import router as interviews_router
from app.routes.teaching import router as teaching_router

app = FastAPI(
    title=PROJECT_NAME,
    description="SkillRoute – Stress-aware academic command center for exams & placements",
    version="2.0.0"
)

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://skillroute.vercel.app",
    "https://*.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

app.include_router(career_router)
app.include_router(students_router)
app.include_router(progress_router)
app.include_router(quiz_router)
app.include_router(jobs_router)
app.include_router(resources_router, prefix="/api")
app.include_router(schedules_router)
app.include_router(wellness_router)
app.include_router(interviews_router)
app.include_router(teaching_router)

@app.get("/")
def root():
    return {
        "app": PROJECT_NAME,
        "env": ENV,
        "status": "running"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}


