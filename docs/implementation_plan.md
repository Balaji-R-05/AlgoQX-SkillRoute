# SkillRoute → Academic Command Center Transformation

## Current State Audit

### Architecture Overview
| Layer | Tech | Status |
|-------|------|--------|
| Frontend | React 18 + Vite + Tailwind 3 + Framer Motion | ✅ Solid |
| Auth | Firebase Auth (client) + Firebase Admin (server JWT verify) | ✅ Working |
| Backend | FastAPI (async) | ✅ Working |
| AI (Roadmap) | Groq API (llama-3.3-70b) | ✅ Working |
| AI (Schedule) | Ollama (self-hosted llama3) | ✅ Working |
| AI (Interview) | Groq API (llama-3.1-8b) — standalone FastAPI | ✅ Standalone, needs integration |
| AI (Teaching) | Ollama (gemma4:31b) + HuggingFace BGE-M3 + ChromaDB + edge-tts — standalone FastAPI | ✅ Standalone, needs integration |
| DB (Relational) | Neon Postgres via SQLAlchemy async + asyncpg | ✅ Working |
| DB (Document) | Firestore (profiles, roadmaps, progress) | ✅ Working |
| Storage | AWS S3 (PDF uploads) | ✅ Working |
| Vectors | pgvector on Neon (resource chunks) | ✅ Working |
| Telegram | python-telegram-bot (PDF upload → S3 → chunk → embed) | ⚠️ Scaffolded |

### AI Asset Inventory (NEW)

> [!IMPORTANT]
> Three standalone AI modules exist outside the main backend. All must be integrated as services.

#### Interview Agent (`AI/Interview_agent/interview.py`)
- **951-line FastAPI app** — production-ready adaptive mock interview
- **LLM**: Groq API → LLaMA 3.1 8B Instant (`llama-3.1-8b-instant`)
- **Features**: Resume/skill parsing → contextual question generation → adaptive difficulty (EASY/MEDIUM/HARD) → plagiarism detection → strike system (3 strikes = end) → transcript generation → final report with strengths/weaknesses/topic breakdown
- **Endpoints**: `POST /interview/start` (file upload), `POST /interview/answer`, `GET /interview/{id}`, `GET /interview/{id}/report`, `DELETE /interview/{id}`
- **Frontend**: Streamlit app (`streamlit_api.py`, 789 lines) — premium dark theme, full interview UI
- **Integration**: Migrate core logic as service module → expose via main backend routes → feed scores into ReadinessEngine

#### Teaching Assistant / RAG Chatbot (`AI/Nephele_ragChatbot/`)
- **Two implementations**:
  - `Main_rag_teaching_assistant.py` — CLI with voice I/O (pygame, microphone, SpeechRecognition) — NOT for web
  - `Teachng_RAG.py` — **FastAPI backend (311 lines)** — this is the web-ready API
- **RAG Pipeline**: PDF/URL → chunk (RecursiveCharacterTextSplitter) → embed (HuggingFace BGE-M3) → ChromaDB → retrieve → LLM lesson
- **LLM**: Ollama (gemma4:31b) at `http://100.87.204.58:11434/v1`
- **TTS**: edge-tts (AriaNeural voice) → mp3 generation
- **Endpoints**: `POST /load_document/`, `POST /teach_lesson/`, `POST /doubt/`, `GET /audio/{filename}`, `POST /cleanup/`
- **Frontend**: Streamlit app (`streamlit_app.py`, 258 lines) — 3-step workflow (load → teach → ask)
- **Integration**: Embed into Resource Hub → "Teach me this" per resource → doubt-clearing → voice narration

#### Telegram Bot (`telegram-aws/bot.py`)
- Document + photo upload → S3 → embedding → Postgres
- Config via `config.yaml`
- Helper modules: `s3_utils.py`, `embed_utils.py`, `db_utils.py`
- Already scaffolded in main backend (`backend/app/telegram_bot.py`)

### Reusable Modules (KEEP & EXTEND)
1. **Auth flow** — Firebase sign-in/sign-up + JWT verification → solid, reuse as-is
2. **Schedule Generator** — Ollama-based day-by-day plan generator → excellent base, extend for stress-awareness
3. **Daily Check-in** — MCQ quiz tied to today's schedule → good, extend with confidence/stress self-rating
4. **Resource Hub** — S3 sync + semantic search + manual add → strong, extend categories + teaching module
5. **Telegram Bot** — PDF → S3 → chunk → embed pipeline → keep, polish fallback
6. **UI component library** — Card, Button, Input, Select, Sheet, Skeleton → reuse all
7. **FloatingHeader** — nav header → extend with new nav items
8. **Toast system** — context-based toasts → reuse
9. **Theme context** — dark/light mode → reuse
10. **ProfileSetup** — multi-step onboarding wizard → refactor fields, keep structure

### Product Mismatches (MUST FIX)
| Current State | Required State |
|---------------|----------------|
| Career-guidance-first ("career decision", "career path", "career match") | Academic command center (exams + placements) |
| Single "clarity score" for career direction | Stress + readiness + confidence composite |
| Roadmap = career learning path | Roadmap = strategic multi-week exam/placement prep |
| No stress/wellbeing awareness | Stress-aware planning is the core differentiator |
| No perceived vs predicted readiness gap | Signature feature, must be first-class |
| Schedule archives old on new save (single active) | Multiple active schedules allowed |
| No separate exam vs placement flows | Must have distinct flows converging on one dashboard |
| No mock interview | Core feature — **existing Interview Agent solves this** |
| AdaptiveRecommendations are basic streak-based | Must use stress + quiz + gap + deadline data |
| No daily check-in for confidence/stress (only MCQ quiz) | Daily self-rating + quiz + gap analysis |
| No improvement tracking over time | Must track trends, heatmap, gap history |
| No AI teaching from resources | **Nephele RAG solves this** — teach + doubt-clear from PDFs |

### Missing Features vs Contrast Requirements
| Contrast Requirement | Current Coverage | Gap | AI Asset That Helps |
|----------------------|------------------|-----|---------------------|
| **Stress/Readiness Assessment** | ❌ None | Full build needed: composite model, daily self-rating, stress indicator UI | Interview scores feed into readiness |
| **Personalized Recommendations** | ⚠️ Basic (streak-only) | Needs stress, quiz, gap, deadline, resource-aware recommendations | Nephele teaches weak topics; Interview identifies gaps |
| **Track Improvement Over Time** | ❌ None | Full build needed: daily snapshots, trend charts, gap history, heatmap | Interview history + quiz trends + readiness snapshots |

### Missing Features vs Baseline Requirements
- ❌ Separate exam/placement flows
- ✅ Mock interview — **Interview Agent exists, needs integration**
- ❌ Perceived vs predicted readiness gap
- ❌ Stress indicator + wellbeing rules
- ❌ Auto-adjustment based on stress/completion
- ❌ Intervention alerts (user-triggered)
- ❌ Improvement analytics (trends, heatmap)
- ❌ Roadmap as strategic (not career-path)
- ✅ AI teaching from resources — **Nephele exists, needs integration**
- ⚠️ Onboarding missing exam/placement fields
- ⚠️ Resource hub missing category tags for exam/placement/aptitude

### Highest-Risk Technical Issues
1. **Resource route auth**: Uses `x-user-id` header fallback to `mock-user-123` — security hole
2. **Dual storage**: Firestore for profiles/roadmaps + Postgres for schedules/resources — acceptable hybrid but must be consistent
3. **Schedule archives all**: `save` endpoint archives ALL active → must allow multiple active
4. **Missing DB tables**: No tables for daily_wellness, readiness_snapshots, mock_interviews, interventions
5. **requirements.txt incomplete**: Missing sqlalchemy, asyncpg, httpx, boto3, pgvector, python-telegram-bot
6. **AI LLM routing**: Interview Agent uses Groq (cloud), Teaching Assistant uses Ollama (self-hosted) — must standardize or proxy correctly
7. **Interview Agent in-memory sessions**: Sessions stored in dict, lost on restart — need Postgres persistence for tracking

---

## AI Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   SkillRoute Main Backend                    │
│                     (FastAPI, port 8000)                     │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Readiness    │  │ Recommend.   │  │ Schedule     │      │
│  │ Engine       │  │ Engine       │  │ Service      │      │
│  │ (new)        │  │ (new)        │  │ (existing)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│  ┌──────┴─────────────────┴─────────────────┴────────┐     │
│  │              Readiness Snapshot Store              │     │
│  │     (WellnessCheckin + Quiz + Interview + Tasks)   │     │
│  └───────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Interview    │  │ Teaching     │  │ Roadmap      │      │
│  │ Service      │  │ Service      │  │ Agent        │      │
│  │ (migrated    │  │ (migrated    │  │ (existing)   │      │
│  │  from AI/)   │  │  from AI/)   │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Groq API    │  │ Ollama      │  │ Groq API    │        │
│  │ llama-3.1-8b│  │ gemma4:31b  │  │ llama-3.3   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────┐       │
│  │           Data Layer                             │       │
│  │  Neon Postgres │ Firestore │ S3 │ ChromaDB      │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## Proposed Changes

### Phase 1: Contrast Requirements Foundation (HIGHEST PRIORITY)

> [!IMPORTANT]
> These three features are the primary judging criteria. They must be built first.

---

#### 1.1 Stress / Readiness Assessment Engine

##### [MODIFY] [schedule.py](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/backend/app/models/schedule.py)
- Add `WellnessCheckin` model: `user_id, date, confidence(1-5), stress(1-5), readiness(1-5), energy(1-5), notes, created_at`
- Add `ReadinessSnapshot` model: `user_id, date, perceived_readiness, predicted_readiness, gap_label, composite_score, stress_level, factors_json, recommendations_json, created_at`

##### [NEW] backend/app/services/readiness_engine.py
- `compute_composite_readiness(user_id)` → analyzes:
  - Self-rated confidence, stress, readiness from today's wellness check-in
  - Quiz scores from DailyCheckin (last 7 days)
  - Schedule adherence (completed vs planned tasks)
  - Streak consistency
  - Deadline pressure (days until nearest deadline)
  - Weak-topic density
  - **Mock interview scores** (if any, from Interview Service)
- Returns: `{ readiness_score, stress_level, predicted_readiness, perceived_readiness, gap_label, factors, recommendations }`
- Gap labels: `accurate`, `overconfident`, `underconfident`
- Stress response rules: if stress ≥ 4/5 → reduce intensity, suggest breaks, trim task load

##### [NEW] backend/app/routes/wellness.py
- `POST /api/wellness/checkin` — save daily self-rating
- `GET /api/wellness/today` — get today's wellness + readiness snapshot
- `GET /api/wellness/history?days=30` — historical snapshots for trend charts
- `POST /api/wellness/readiness` — trigger full readiness computation + snapshot save

##### [NEW] frontend/src/components/WellnessCheckin.jsx
- Calm, slider-based daily check-in: confidence, stress, readiness, energy
- Supportive microcopy ("How are you feeling about your prep today?")
- Submits to wellness API, then triggers readiness computation

##### [NEW] frontend/src/components/ReadinessGauge.jsx
- Circular gauge showing composite readiness score
- Stress indicator bar (color-coded: green → amber → red)
- Perceived vs Predicted comparison with gap label badge
- Intervention suggestions with "Apply adjustment" button (user-triggered)

---

#### 1.2 Personalized Recommendations Engine

##### [MODIFY] [AdaptiveRecommendations.jsx](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/frontend/src/components/AdaptiveRecommendations.jsx)
- Complete rewrite: consume readiness snapshot data instead of basic streak
- Categories: study focus, resource suggestion, stress management, weak-topic recovery, schedule adjustment, interview practice, **AI lesson suggestion**
- Each recommendation links to an actionable next step
- Uploaded resources preferred over generic links
- **NEW**: "Learn this topic with AI" → triggers Teaching Service for weak areas

##### [NEW] backend/app/services/recommendation_engine.py
- `generate_recommendations(user_id)` → considers:
  - Readiness snapshot (stress, gap, score)
  - Upcoming deadlines
  - Quiz performance by topic
  - Incomplete tasks
  - Available uploaded resources
  - Whether student is balancing both exams and placements
  - **Mock interview weaknesses** (from Interview Service history)
  - **Available teaching resources** (from Teaching Service)
- Returns prioritized list of actionable recommendations

---

#### 1.3 Improvement Tracking Over Time

##### [NEW] frontend/src/pages/Analytics.jsx
- Readiness trend line chart (last 30 days)
- Stress trend chart
- Perceived vs Predicted gap history
- Completion rate trend
- Activity heatmap (calendar grid)
- Streak counter with best streak
- **Mock interview score progression** (from Interview Service)
- Weekly narrative summary (data-grounded)

##### [NEW] frontend/src/components/TrendChart.jsx
- Reusable SVG-based trend chart component (no heavy charting library)
- Supports multiple datasets with different colors

##### [NEW] frontend/src/components/ActivityHeatmap.jsx
- GitHub-style contribution heatmap showing daily activity intensity

---

### Phase 2: Core Workflow

#### 2.1 Dashboard Transformation

##### [MODIFY] [Dashboard.jsx](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/frontend/src/pages/Dashboard.jsx)
- Remove career-match-first layout
- New command center layout:
  1. **Today's Focus** — today's tasks across all active schedules
  2. **Readiness Gauge** — composite score + stress indicator
  3. **Daily Check-in CTA** — wellness + quiz
  4. **Recommendations** — personalized actions (including AI teaching suggestions)
  5. **Active Deadlines** — countdown cards
  6. **Quick Navigation** — Exam Prep / Placement Prep / Resources / Mock Interview / Analytics
  7. **Streak + Progress snapshot**
- First 30 seconds must convey the entire workflow to judges

##### [MODIFY] [useDashboardData.jsx](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/frontend/src/hooks/useDashboardData.jsx)
- Load: profile, all active schedules, today's wellness, readiness snapshot, recommendations
- Remove career-roadmap-only focus

#### 2.2 Schedule System Upgrade

##### [MODIFY] [schedules.py (routes)](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/backend/app/routes/schedules.py)
- Remove auto-archive on save → allow multiple active schedules
- Add `GET /api/schedules/active/all` → list all active schedules
- Add `GET /api/schedules/today` → aggregate today's tasks from all active schedules
- Add `POST /api/schedules/{id}/complete-task` → mark individual tasks done
- Add `PUT /api/schedules/{id}/auto-adjust` → stress-aware redistribution

##### [MODIFY] [schedule_service.py](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/backend/app/services/schedule_service.py)
- Enhance system prompt for stress-aware scheduling
- Add overload detection (max 6hrs/day recommended, hard warn at 8+)
- Add weak-topic recovery logic
- Add auto-adjustment function

#### 2.3 Daily Check-in Upgrade

##### [MODIFY] [DailyCheckin.jsx](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/frontend/src/components/DailyCheckin.jsx)
- Integrate wellness self-rating into the check-in flow
- Flow: Wellness sliders → MCQ quiz → Readiness gap display → Recommendation
- Calm, supportive copy throughout

---

### Phase 3: Resource Hub + Telegram

##### [MODIFY] [ResourceHub.jsx](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/frontend/src/pages/ResourceHub.jsx)
- Add category tags: Exam, Placement, Aptitude, DSA, Technical, Notes
- Filter/tab UI for categories
- Surface uploaded resources first
- Show relevance to weak areas and schedules
- **NEW**: "Learn from this" button per resource → triggers Teaching Service

##### [MODIFY] [resources.py (routes)](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/backend/app/routes/resources.py)
- Fix auth: use `verify_firebase_token` instead of `x-user-id` header fallback
- Add category filtering endpoint
- Add tags to resource model

##### Telegram
- Keep existing Telegram bot scaffolding (`telegram-aws/bot.py`)
- Ensure `s3_utils.py`, `embed_utils.py`, `db_utils.py` align with main backend models
- Add `TELEGRAM_BOT_TOKEN` to .env.example
- Add web-based file upload as robust fallback for demo

---

### Phase 4: Separate Exam & Placement Flows

##### [NEW] frontend/src/pages/ExamPrep.jsx
- Syllabus coverage tracker
- Subject readiness cards
- Deadline countdowns for exams
- Quick link to generate exam schedule
- Weak-topic recovery suggestions
- **"AI Tutor" button** — teach weak topics from uploaded resources (Teaching Service)

##### [NEW] frontend/src/pages/PlacementPrep.jsx
- Aptitude / DSA / Technical sections
- Company-specific prep cards
- **Mock interview launch** (Interview Service)
- Coding practice links
- Interview readiness indicator (from interview score history)

Both pages share the same schedule and resource systems but present different contexts.

---

### Phase 5: Mock Interview (MIGRATE EXISTING AGENT)

> [!IMPORTANT]
> **Strategy change**: The `AI/Interview_agent/interview.py` is a **production-ready 951-line FastAPI app** with adaptive questioning, plagiarism detection, strike system, and comprehensive reporting. We migrate its core logic as a service rather than building from scratch. This saves ~2 days of development.

##### [NEW] backend/app/services/interview_service.py — MIGRATED from `AI/Interview_agent/interview.py`
- Extract core classes: `InterviewSession`, `TranscriptEntry`, `FinalReport`
- Extract functions: `agent_generate_question()`, `agent_evaluate_answer()`, `agent_finalize_report()`, `detect_plagiarism()`
- **Adapt**: Replace in-memory `sessions` dict with Postgres persistence
- **Adapt**: Add `user_id` (Firebase UID) to sessions for auth
- **Adapt**: Feed final report (strengths, weaknesses, topic_breakdown) into ReadinessEngine
- **Keep**: Groq API integration (`llama-3.1-8b-instant`), adaptive difficulty, strike system

##### [NEW] backend/app/routes/interviews.py — Thin wrapper around interview_service
- `POST /api/interviews/start` — upload resume + skill file → create session, first question
  - Maps to original `POST /interview/start`
  - Adds Firebase auth (`verify_firebase_token`)
  - Persists session to Postgres
- `POST /api/interviews/{id}/answer` — submit answer → scoring + next question
  - Maps to original `POST /interview/answer`
- `GET /api/interviews/{id}` — session state
- `GET /api/interviews/{id}/report` — final report (completed sessions only)
- `GET /api/interviews/history` — past sessions for tracking (NEW)
- `DELETE /api/interviews/{id}` — cleanup

##### [NEW] backend/app/models/interview.py
- `MockInterview` model: `id, user_id, session_id, status, candidate_name, interview_type, current_difficulty, strikes, question_count, total_score, final_score, strengths_json, weaknesses_json, topic_breakdown_json, transcript_json, completion_reason, created_at, completed_at`
- Index on `(user_id, created_at)` for history queries

##### [NEW] frontend/src/pages/MockInterview.jsx
- Design informed by existing `streamlit_api.py` patterns:
  - Hero card with file upload (resume + skills)
  - Live stats bar (question count, strikes, difficulty badge)
  - Question card with topic + difficulty indicator
  - Answer textarea with submit/skip
  - Real-time feedback card (score, plagiarism warning, difficulty shift)
  - Scrollable transcript history
  - Final report: score gauge, summary, strengths/weaknesses, topic breakdown
- React implementation replacing Streamlit dark-purple theme with calm-coach palette

---

### Phase 5b: AI Teaching Assistant (MIGRATE EXISTING AGENT)

> [!IMPORTANT]
> **New phase**: The `AI/Nephele_ragChatbot/Teachng_RAG.py` provides a complete RAG-based teaching pipeline. We integrate it into the Resource Hub so students can learn from their own uploaded materials. This directly strengthens the **Personalized Recommendations** contrast requirement.

##### [NEW] backend/app/services/teaching_service.py — MIGRATED from `AI/Nephele_ragChatbot/Teachng_RAG.py`
- Extract and adapt: `DocumentProcessor`, `RAGPipeline`, `LLMProvider`, `TTSManager`
- **Adapt**: Use existing resource files from S3 (download → process → embed in ChromaDB)
- **Adapt**: Support per-user, per-resource RAG sessions (not global state)
- **Adapt**: LLM routing — use Groq as primary (reliability), Ollama as fallback
- **Keep**: HuggingFace BGE-M3 embeddings, edge-tts voice generation
- Key functions:
  - `load_resource(resource_id, user_id)` — fetch from S3, chunk, embed
  - `teach_topic(resource_id, topic, user_id)` — RAG retrieve → LLM lesson → TTS audio
  - `answer_doubt(resource_id, question, user_id)` — RAG retrieve → LLM answer → TTS audio

##### [NEW] backend/app/routes/teaching.py
- `POST /api/teaching/load/{resource_id}` — load a resource for teaching (requires auth)
- `POST /api/teaching/lesson` — generate lesson from loaded resource on a topic
- `POST /api/teaching/doubt` — ask a doubt about the current lesson
- `GET /api/teaching/audio/{filename}` — serve generated audio files

##### [NEW] frontend/src/components/TeachingPanel.jsx
- Slide-in panel or modal triggered from Resource Hub
- Design informed by `streamlit_app.py`:
  - Status badges (Document loaded / Lesson ready)
  - Topic input + "Teach Me" button
  - Teacher bubble (lesson text with AI persona styling)
  - Audio player for narrated lesson
  - Doubt input + chat-style Q&A history
- Integrates into ResourceHub.jsx as a per-resource action

##### How Teaching Feeds Into Contrast Requirements:
- **Personalized Recommendations**: "You're weak in Binary Trees → we have uploaded notes on Trees → Learn with AI Tutor"
- **Stress Assessment**: Teaching reduces cramming anxiety → positive factor for readiness
- **Improvement Tracking**: Teaching sessions logged → track topics covered over time

---

### Phase 6: Onboarding + Profile Refactor

##### [MODIFY] [ProfileSetup.jsx](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/frontend/src/components/ProfileSetup.jsx)
- Refactor steps:
  1. Welcome + Name + Year + Department
  2. Focus Check: "Are you preparing for exams, placements, or both?"
  3. Exam Details: target exams, subjects, deadlines
  4. Placement Details: target companies/roles, skills
  5. Availability + Baseline wellness (confidence, stress, hours/day)
- Calm, supportive copy
- Remove "career clarity" framing → replace with "preparation focus"

##### [MODIFY] [student.py (model)](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/backend/app/models/student.py)
- Add fields: year_of_study, department, preparation_focus, target_exams, target_companies, baseline_stress, baseline_confidence, balancing_both

---

### Phase 7: Roadmap Refactor + Deep Analytics

##### [MODIFY] [roadmap_agent.py](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/backend/app/services/roadmap_agent.py)
- Refactor system prompt: strategic multi-week preparation roadmap (not career path)
- Separate roadmap types: exam prep roadmap vs placement prep roadmap
- Roadmaps inform but don't auto-generate daily schedules

##### Analytics Enhancements
- Weekly progress narrative (AI-generated summary from real data)
- Motivation + performance proof dual framing
- **Interview performance trends** (scores over multiple sessions)

---

### Phase 8: Navigation & Demo Polish

##### [MODIFY] [App.jsx](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/frontend/src/App.jsx)
- Add routes: `/analytics`, `/exam-prep`, `/placement-prep`, `/mock-interview`
- Ensure all routes are protected

##### [MODIFY] [floating-header.jsx](file:///home/shreesh/Documents/Blueprints-SVCE/SkillRoute/frontend/src/components/ui/floating-header.jsx)
- Add nav items: Dashboard, Schedules, Resources, Exam Prep, Placement Prep, Mock Interview, Analytics

##### UI Polish
- Calm color palette (sage greens, soft blues, warm neutrals)
- Consistent calm-coach microcopy throughout
- Mobile-responsive adjustments
- Loading states and error boundaries

---

## LLM Strategy & Routing

| Service | LLM | Reason |
|---------|-----|--------|
| Roadmap Agent | Groq `llama-3.3-70b` | Existing, works well |
| Schedule Service | Groq `llama-3.3-70b` | **CHANGE**: Migrate from Ollama for demo reliability |
| Readiness Engine | Groq `llama-3.3-70b` | New, needs reliability |
| Recommendation Engine | Groq `llama-3.3-70b` | New, needs reliability |
| Interview Service | Groq `llama-3.1-8b-instant` | Keep as-is from interview.py, fast response for Q&A |
| Teaching Service | Groq `llama-3.1-8b-instant` | **CHANGE**: Migrate from Ollama gemma4 for demo reliability |
| Quiz Agent | Groq `llama-3.3-70b` | **CHANGE**: Migrate from Ollama for demo reliability |

> [!WARNING]
> **Decision**: Standardize on Groq (cloud) for ALL AI features during hackathon demo. Ollama (self-hosted) is unreliable for live demos — network latency, potential timeouts, and the host machine may not be available. Keep Ollama as a configurable fallback via env flag.

---

## Open Questions

> [!IMPORTANT]
> **Groq vs Ollama**: Resolved — Use Groq for all AI features (see LLM Strategy table above).

> [!WARNING]
> **DB migrations**: Adding new tables (WellnessCheckin, ReadinessSnapshot, MockInterview) requires running migrations on the Neon database. Create an `init_db.py` update that handles this. Existing data won't be affected.

> [!NOTE]
> **Teaching Service ChromaDB**: The Teaching Service uses ChromaDB for per-resource RAG. This is separate from the pgvector-based resource search in the main backend. Consider:
> - Option A: Use ChromaDB in-memory per session (simpler, ephemeral)
> - Option B: Migrate to pgvector for consistency (more work, persistent)
> - **Recommendation**: Option A for hackathon, migrate to B post-hackathon.

---

## Verification Plan

### Automated Tests
- Backend: Test readiness computation with synthetic data
- Backend: Test recommendation generation with various scenarios
- Backend: Test interview service migration (start → answer → report flow)
- Backend: Test teaching service (load → teach → doubt flow)
- Frontend: Verify all routes load without crash
- Full flow: Profile → Dashboard → Check-in → Quiz → Gap → Recommendation → Analytics
- Interview flow: Upload resume → questions → answers → report → history
- Teaching flow: Select resource → teach topic → ask doubt → audio plays

### Manual Verification
- Demo walkthrough: 30-second judge comprehension test
- Stress scenario: High stress rating → verify reduced intensity recommendations
- Overconfidence scenario: High self-rating + low quiz → verify "overconfident" label
- Multiple schedules: Create exam + placement schedules, verify dashboard aggregates
- Mock interview: Complete a session, verify score appears in analytics
- AI teaching: Select uploaded PDF → request lesson → verify audio + text
- Mobile: Test responsive layout on narrow viewport

### Contrast Requirements Verification Matrix
| Requirement | Implementation | Verification |
|-------------|---------------|--------------|
| Stress/Readiness Assessment | WellnessCheckin + ReadinessEngine + ReadinessGauge + Interview scores | Daily check-in → composite score computes → gauge renders → interview feeds back |
| Personalized Recommendations | RecommendationEngine + Enhanced AdaptiveRecommendations + Teaching suggestions | Based on real readiness data + interview gaps + available teaching resources |
| Track Improvement Over Time | ReadinessSnapshot history + Analytics page + TrendChart + Heatmap + Interview progression | 30-day trend renders with real snapshot data + interview score history |

---

## Implementation Priority Order

```
Week 1 (Critical Path — Contrast Requirements):
  ├── Phase 1.1: Readiness Engine + Models + Wellness routes ← DAY 1-2
  ├── Phase 1.2: Recommendation Engine ← DAY 2-3
  ├── Phase 1.3: Analytics page + TrendChart + Heatmap ← DAY 3-4
  └── Phase 2.1: Dashboard transformation ← DAY 4-5

Week 2 (Core Features):
  ├── Phase 2.2: Schedule upgrades ← DAY 1
  ├── Phase 2.3: Daily Check-in upgrade ← DAY 1
  ├── Phase 5:  Mock Interview migration ← DAY 2-3  ★ FAST (service exists)
  ├── Phase 5b: Teaching Assistant migration ← DAY 3-4  ★ FAST (service exists)
  └── Phase 3:  Resource Hub + Telegram ← DAY 4-5

Week 3 (Polish):
  ├── Phase 4:  Exam/Placement flows ← DAY 1-2
  ├── Phase 6:  Onboarding refactor ← DAY 2
  ├── Phase 7:  Roadmap refactor ← DAY 3
  ├── Phase 8:  Navigation + Demo polish ← DAY 4-5
  └── Final testing + demo rehearsal ← DAY 5
```
