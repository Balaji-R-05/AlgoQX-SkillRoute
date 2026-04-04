# streamlit_api.py
# =============================================================================
# AI Interview Frontend — Streamlit App
# =============================================================================
# Requirements:
# pip install streamlit requests
#
# Run:
# 1. Start the backend first:  uvicorn interview:app --reload
# 2. Then run this frontend:   streamlit run streamlit_api.py
#
# Backend must be running on http://localhost:8000
# =============================================================================

import time
from datetime import datetime

import requests
import streamlit as st

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────
API_BASE = "http://localhost:8000"

# ─────────────────────────────────────────────────────────────────────────────
# PAGE CONFIG
# ─────────────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="AI Interview Agent",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────────────────────────────────────
# CUSTOM CSS — Premium dark modern theme
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    /* ── Import Google Font ─────────────────────────────────────────────── */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    /* ── Global ─────────────────────────────────────────────────────────── */
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }

    /* ── Main Container ─────────────────────────────────────────────────── */
    .main .block-container {
        padding-top: 2rem;
        max-width: 900px;
    }

    /* ── Sidebar ────────────────────────────────────────────────────────── */
    section[data-testid="stSidebar"] {
        background: linear-gradient(180deg, #0f0f23 0%, #1a1a3e 100%);
        border-right: 1px solid rgba(139, 92, 246, 0.15);
    }
    section[data-testid="stSidebar"] .stMarkdown p,
    section[data-testid="stSidebar"] .stMarkdown li,
    section[data-testid="stSidebar"] .stMarkdown h1,
    section[data-testid="stSidebar"] .stMarkdown h2,
    section[data-testid="stSidebar"] .stMarkdown h3 {
        color: #e2e8f0;
    }

    /* ── Hero Card ──────────────────────────────────────────────────────── */
    .hero-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 16px;
        padding: 2.5rem 2rem;
        text-align: center;
        margin-bottom: 2rem;
        box-shadow: 0 20px 60px rgba(102, 126, 234, 0.25);
    }
    .hero-card h1 {
        color: #ffffff;
        font-size: 2.2rem;
        font-weight: 800;
        margin-bottom: 0.5rem;
        letter-spacing: -0.5px;
    }
    .hero-card p {
        color: rgba(255,255,255,0.85);
        font-size: 1.05rem;
        font-weight: 400;
    }

    /* ── Stat Cards ─────────────────────────────────────────────────────── */
    .stat-row {
        display: flex;
        gap: 12px;
        margin-bottom: 1.5rem;
    }
    .stat-card {
        flex: 1;
        background: rgba(30, 30, 60, 0.7);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(139, 92, 246, 0.2);
        border-radius: 12px;
        padding: 1rem 1.2rem;
        text-align: center;
    }
    .stat-card .stat-value {
        font-size: 1.8rem;
        font-weight: 700;
        color: #a78bfa;
    }
    .stat-card .stat-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #94a3b8;
        margin-top: 2px;
    }

    /* ── Question Card ──────────────────────────────────────────────────── */
    .question-card {
        background: linear-gradient(135deg, rgba(30, 30, 60, 0.9), rgba(40, 20, 70, 0.9));
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 14px;
        padding: 1.8rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    }
    .question-card .q-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }
    .question-card .q-number {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: #fff;
        font-weight: 700;
        font-size: 0.8rem;
        padding: 4px 14px;
        border-radius: 20px;
    }
    .question-card .q-topic {
        color: #a78bfa;
        font-size: 0.8rem;
        font-weight: 500;
    }
    .question-card .q-text {
        color: #f1f5f9;
        font-size: 1.1rem;
        font-weight: 500;
        line-height: 1.6;
    }

    /* ── Difficulty Badge ───────────────────────────────────────────────── */
    .difficulty-badge {
        display: inline-block;
        padding: 3px 12px;
        border-radius: 20px;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
    }
    .diff-easy   { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
    .diff-medium { background: rgba(234, 179, 8, 0.2);  color: #facc15; border: 1px solid rgba(234, 179, 8, 0.3); }
    .diff-hard   { background: rgba(239, 68, 68, 0.2);  color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }

    /* ── Feedback Card ──────────────────────────────────────────────────── */
    .feedback-card {
        background: rgba(30, 30, 50, 0.7);
        border-left: 4px solid #667eea;
        border-radius: 0 12px 12px 0;
        padding: 1.2rem 1.5rem;
        margin-bottom: 1rem;
    }
    .feedback-card .fb-score {
        font-size: 1.3rem;
        font-weight: 700;
        color: #a78bfa;
    }
    .feedback-card .fb-text {
        color: #cbd5e1;
        font-size: 0.95rem;
        margin-top: 6px;
    }

    /* ── Plagiarism Warning ─────────────────────────────────────────────── */
    .plagiarism-warn {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.35);
        border-radius: 10px;
        padding: 0.8rem 1.2rem;
        margin-bottom: 1rem;
        color: #fca5a5;
        font-size: 0.9rem;
    }

    /* ── Strike Warning ─────────────────────────────────────────────────── */
    .strike-warn {
        background: rgba(251, 146, 60, 0.12);
        border: 1px solid rgba(251, 146, 60, 0.35);
        border-radius: 10px;
        padding: 0.8rem 1.2rem;
        margin-bottom: 1rem;
        color: #fdba74;
        font-size: 0.9rem;
    }

    /* ── Report Section ─────────────────────────────────────────────────── */
    .report-header {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        border-radius: 14px;
        padding: 2rem;
        text-align: center;
        margin-bottom: 1.5rem;
        box-shadow: 0 12px 40px rgba(16, 185, 129, 0.2);
    }
    .report-header h2 {
        color: #fff;
        font-size: 1.8rem;
        font-weight: 700;
        margin: 0;
    }
    .report-header .score-big {
        font-size: 4rem;
        font-weight: 800;
        color: #fff;
        margin: 0.5rem 0;
    }
    .report-header .score-sub {
        color: rgba(255,255,255,0.8);
        font-size: 1rem;
    }

    .report-card {
        background: rgba(30, 30, 55, 0.8);
        border: 1px solid rgba(139, 92, 246, 0.2);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1rem;
    }
    .report-card h3 {
        color: #a78bfa;
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .report-card p, .report-card li {
        color: #cbd5e1;
        font-size: 0.95rem;
        line-height: 1.7;
    }

    /* ── Transcript history ─────────────────────────────────────────────── */
    .transcript-entry {
        background: rgba(30, 30, 55, 0.5);
        border: 1px solid rgba(100, 100, 150, 0.15);
        border-radius: 10px;
        padding: 1rem 1.2rem;
        margin-bottom: 0.6rem;
        font-size: 0.88rem;
    }
    .transcript-entry .te-q {
        color: #a78bfa;
        font-weight: 600;
    }
    .transcript-entry .te-a {
        color: #94a3b8;
        margin-top: 4px;
    }

    /* ── Buttons ─────────────────────────────────────────────────────────── */
    .stButton > button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 0.6rem 2rem;
        font-weight: 600;
        font-size: 0.95rem;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.45);
    }

    /* ── File uploader ──────────────────────────────────────────────────── */
    .stFileUploader > div {
        border: 2px dashed rgba(139, 92, 246, 0.3);
        border-radius: 12px;
    }

    /* ── Hide default Streamlit branding ─────────────────────────────────── */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
</style>
""", unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def check_backend() -> bool:
    """Return True if the backend is reachable."""
    try:
        r = requests.get(f"{API_BASE}/health", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def difficulty_badge(level: str) -> str:
    """Return HTML for a coloured difficulty badge."""
    cls = {"EASY": "diff-easy", "MEDIUM": "diff-medium", "HARD": "diff-hard"}.get(level, "diff-medium")
    return f'<span class="difficulty-badge {cls}">{level}</span>'


def init_session_state():
    """Initialise all required Streamlit session-state keys."""
    defaults = {
        "session_id": None,
        "candidate_name": "",
        "status": "idle",           # idle | active | completed
        "current_question": "",
        "current_topic": "",
        "current_difficulty": "MEDIUM",
        "question_count": 0,
        "strikes": 0,
        "transcript_history": [],    # list of dicts for display
        "last_feedback": None,       # latest AnswerResponse dict
        "final_report": None,        # report dict
        "transcript_file": "",
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v


init_session_state()


# ─────────────────────────────────────────────────────────────────────────────
# SIDEBAR
# ─────────────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🎯 AI Interview Agent")
    st.markdown("---")

    # Backend status indicator
    backend_ok = check_backend()
    if backend_ok:
        st.success("🟢  Backend connected")
    else:
        st.error("🔴  Backend offline — start `interview.py` first")

    st.markdown("---")

    # Session info when active
    if st.session_state.status in ("active", "completed"):
        st.markdown(f"**Candidate:** {st.session_state.candidate_name}")
        st.markdown(f"**Status:** `{st.session_state.status}`")
        st.markdown(f"**Questions:** {st.session_state.question_count}")
        st.markdown(f"**Strikes:** {'⚠️ ' * st.session_state.strikes}{st.session_state.strikes}/5")
        st.markdown(f"**Difficulty:** {st.session_state.current_difficulty}")
        st.markdown("---")

        if st.session_state.status == "active":
            if st.button("🛑 End Interview Early", use_container_width=True, key="end_early_btn"):
                # Submit 5 strikes worth of "idk" to force end
                for _ in range(5 - st.session_state.strikes):
                    try:
                        requests.post(
                            f"{API_BASE}/interview/answer",
                            json={"session_id": st.session_state.session_id, "answer": "idk"},
                            timeout=30,
                        )
                    except Exception:
                        break
                # Refresh report
                try:
                    r = requests.get(f"{API_BASE}/interview/{st.session_state.session_id}/report", timeout=10)
                    if r.status_code == 200:
                        st.session_state.final_report = r.json()
                        st.session_state.status = "completed"
                except Exception:
                    st.session_state.status = "completed"
                st.rerun()

        if st.session_state.status == "completed":
            if st.button("🔄 New Interview", use_container_width=True, key="new_interview_btn"):
                for k in list(st.session_state.keys()):
                    del st.session_state[k]
                init_session_state()
                st.rerun()

    st.markdown("---")
    st.caption("Powered by Groq · LLaMA 3.1 8B")
    st.caption(f"© {datetime.now().year} AI Interview Agent")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN CONTENT
# ─────────────────────────────────────────────────────────────────────────────

# ── IDLE STATE: Upload files and start interview ────────────────────────────
if st.session_state.status == "idle":
    st.markdown("""
    <div class="hero-card">
        <h1>🎯 AI Interview Agent</h1>
        <p>Upload your resume and skill file to begin an adaptive AI-powered technical interview</p>
    </div>
    """, unsafe_allow_html=True)

    if not backend_ok:
        st.error(
            "⚠️ **Backend is not running.** Start it first:\n\n"
            "```bash\n"
            "uvicorn interview:app --reload\n"
            "```"
        )
        st.stop()

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("##### 📄 Resume")
        resume_file = st.file_uploader(
            "Upload resume (PDF or TXT)",
            type=["pdf", "txt"],
            key="resume_upload",
            label_visibility="collapsed",
        )
    with col2:
        st.markdown("##### 🛠️ Skill Section")
        skill_file = st.file_uploader(
            "Upload SkillSection.txt",
            type=["txt"],
            key="skill_upload",
            label_visibility="collapsed",
        )

    st.markdown("")

    if st.button("🚀 Start Interview", use_container_width=True, key="start_btn", disabled=not (resume_file and skill_file)):
        with st.spinner("🔍 Analysing your profile and preparing interview…"):
            try:
                files = {
                    "resume_file": (resume_file.name, resume_file.getvalue(), resume_file.type or "application/octet-stream"),
                    "skill_file": (skill_file.name, skill_file.getvalue(), skill_file.type or "text/plain"),
                }
                resp = requests.post(f"{API_BASE}/interview/start", files=files, timeout=60)

                if resp.status_code != 200:
                    st.error(f"Backend error: {resp.json().get('detail', resp.text)}")
                    st.stop()

                data = resp.json()
                st.session_state.session_id = data["session_id"]
                st.session_state.candidate_name = data["candidate_name"]
                st.session_state.current_question = data["question"]
                st.session_state.current_topic = data["topic"]
                st.session_state.current_difficulty = data["initial_difficulty"]
                st.session_state.question_count = data["question_count"]
                st.session_state.strikes = data["strikes"]
                st.session_state.status = "active"
                st.session_state.transcript_history = []
                st.session_state.last_feedback = None

                st.rerun()

            except requests.ConnectionError:
                st.error("Cannot connect to backend. Ensure `interview.py` is running on port 8000.")
            except Exception as e:
                st.error(f"Unexpected error: {e}")


# ── ACTIVE STATE: Interview in progress ─────────────────────────────────────
elif st.session_state.status == "active":

    # ── Status bar ──────────────────────────────────────────────────────
    st.markdown(f"""
    <div class="stat-row">
        <div class="stat-card">
            <div class="stat-value">{st.session_state.question_count}</div>
            <div class="stat-label">Question</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{st.session_state.strikes}/5</div>
            <div class="stat-label">Strikes</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{difficulty_badge(st.session_state.current_difficulty)}</div>
            <div class="stat-label">Difficulty</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">15</div>
            <div class="stat-label">Max Qs</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # ── Previous feedback ───────────────────────────────────────────────
    fb = st.session_state.last_feedback
    if fb:
        if fb.get("question_score") is not None and fb.get("question_score", -1) >= 0:
            if fb.get("plagiarism_flag"):
                st.markdown(f"""
                <div class="plagiarism-warn">
                    ⚠️ <strong>Plagiarism detected:</strong> {fb.get('plagiarism_reason', 'Suspicious response pattern')}
                </div>
                """, unsafe_allow_html=True)

            if fb.get("feedback") == "Answer counted as a strike.":
                st.markdown(f"""
                <div class="strike-warn">
                    ⚡ <strong>Strike!</strong> Your answer was counted as a skip. Strikes: {st.session_state.strikes}/5
                </div>
                """, unsafe_allow_html=True)
            else:
                diff_change = ""
                if fb.get("difficulty_before") and fb.get("difficulty_after") and fb["difficulty_before"] != fb["difficulty_after"]:
                    diff_change = f' &nbsp;|&nbsp; Difficulty: {fb["difficulty_before"]} → {fb["difficulty_after"]}'

                st.markdown(f"""
                <div class="feedback-card">
                    <div class="fb-score">Score: {fb['question_score']}/10{diff_change}</div>
                    <div class="fb-text">{fb.get('feedback', '')}</div>
                </div>
                """, unsafe_allow_html=True)

    # ── Current question ────────────────────────────────────────────────
    st.markdown(f"""
    <div class="question-card">
        <div class="q-header">
            <span class="q-number">Q{st.session_state.question_count}</span>
            <span class="q-topic">📌 {st.session_state.current_topic} &nbsp; {difficulty_badge(st.session_state.current_difficulty)}</span>
        </div>
        <div class="q-text">{st.session_state.current_question}</div>
    </div>
    """, unsafe_allow_html=True)

    # ── Answer input ────────────────────────────────────────────────────
    answer = st.text_area(
        "Your answer",
        height=150,
        placeholder="Type your answer here… (Type 'idk' or leave empty to skip)",
        key="answer_input",
        label_visibility="collapsed",
    )

    col_submit, col_skip = st.columns([3, 1])
    with col_submit:
        submit_clicked = st.button("📤 Submit Answer", use_container_width=True, key="submit_btn")
    with col_skip:
        skip_clicked = st.button("⏭️ Skip", use_container_width=True, key="skip_btn")

    if submit_clicked or skip_clicked:
        submitted_answer = answer.strip() if submit_clicked else "idk"

        with st.spinner("🤔 AI is evaluating your answer…"):
            try:
                resp = requests.post(
                    f"{API_BASE}/interview/answer",
                    json={
                        "session_id": st.session_state.session_id,
                        "answer": submitted_answer,
                    },
                    timeout=60,
                )

                if resp.status_code != 200:
                    st.error(f"Error: {resp.json().get('detail', resp.text)}")
                    st.stop()

                data = resp.json()

                # Save to transcript history
                st.session_state.transcript_history.append({
                    "q_num": st.session_state.question_count,
                    "question": st.session_state.current_question,
                    "topic": st.session_state.current_topic,
                    "difficulty": st.session_state.current_difficulty,
                    "answer": submitted_answer,
                    "score": data.get("question_score"),
                    "feedback": data.get("feedback", ""),
                    "plagiarism": data.get("plagiarism_flag", False),
                    "strike": (data.get("feedback") == "Answer counted as a strike."),
                })

                st.session_state.strikes = data.get("strikes", st.session_state.strikes)
                st.session_state.last_feedback = data

                if data["status"] == "completed":
                    st.session_state.status = "completed"
                    st.session_state.final_report = data
                    st.session_state.transcript_file = data.get("transcript_file", "")
                else:
                    st.session_state.current_question = data.get("next_question", "")
                    st.session_state.current_topic = data.get("next_topic", "")
                    st.session_state.current_difficulty = data.get("difficulty_after", st.session_state.current_difficulty)
                    st.session_state.question_count = data.get("question_count", st.session_state.question_count)

                st.rerun()

            except requests.ConnectionError:
                st.error("Lost connection to backend.")
            except Exception as e:
                st.error(f"Error: {e}")

    # ── Transcript history (expandable) ─────────────────────────────────
    if st.session_state.transcript_history:
        with st.expander("📜 Interview History", expanded=False):
            for entry in reversed(st.session_state.transcript_history):
                badge = "⚡ STRIKE" if entry.get("strike") else f"Score: {entry.get('score', '?')}/10"
                plag = " | 🚨 Plagiarism" if entry.get("plagiarism") else ""
                st.markdown(f"""
                <div class="transcript-entry">
                    <div class="te-q">Q{entry['q_num']} [{entry['difficulty']}] — {entry['topic']} &nbsp; | &nbsp; {badge}{plag}</div>
                    <div class="te-a"><strong>Q:</strong> {entry['question']}</div>
                    <div class="te-a"><strong>A:</strong> {entry['answer'][:300]}{'…' if len(entry['answer']) > 300 else ''}</div>
                </div>
                """, unsafe_allow_html=True)


# ── COMPLETED STATE: Show final report ──────────────────────────────────────
elif st.session_state.status == "completed":

    report = st.session_state.final_report
    if not report:
        # Try fetching from backend
        try:
            r = requests.get(f"{API_BASE}/interview/{st.session_state.session_id}/report", timeout=10)
            if r.status_code == 200:
                report = r.json()
                st.session_state.final_report = report
        except Exception:
            pass

    if not report:
        st.warning("Interview completed but report is unavailable.")
        if st.button("🔄 Start New Interview", key="retry_new"):
            for k in list(st.session_state.keys()):
                del st.session_state[k]
            init_session_state()
            st.rerun()
        st.stop()

    final_score = report.get("final_score", 0)

    # Score colour
    if final_score >= 75:
        score_gradient = "linear-gradient(135deg, #10b981 0%, #059669 100%)"
        score_emoji = "🏆"
        verdict = "Excellent Performance"
    elif final_score >= 50:
        score_gradient = "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
        score_emoji = "👍"
        verdict = "Good Performance"
    elif final_score >= 30:
        score_gradient = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
        score_emoji = "📈"
        verdict = "Needs Improvement"
    else:
        score_gradient = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
        score_emoji = "💪"
        verdict = "Keep Practising"

    reason_label = report.get("reason", st.session_state.final_report.get("reason", ""))
    if reason_label == "max_strikes_reached":
        reason_display = "Ended — 5 Strikes reached"
    elif reason_label == "max_questions_reached":
        reason_display = "Completed — All 15 questions answered"
    else:
        reason_display = "Interview Completed"

    st.markdown(f"""
    <div class="report-header" style="background: {score_gradient};">
        <h2>{score_emoji} {verdict}</h2>
        <div class="score-big">{final_score}</div>
        <div class="score-sub">out of 100 &nbsp;·&nbsp; {reason_display}</div>
    </div>
    """, unsafe_allow_html=True)

    # Stats row
    st.markdown(f"""
    <div class="stat-row">
        <div class="stat-card">
            <div class="stat-value">{st.session_state.question_count}</div>
            <div class="stat-label">Questions</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{st.session_state.strikes}</div>
            <div class="stat-label">Strikes</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{final_score}%</div>
            <div class="stat-label">Score</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Summary
    summary_text = report.get("summary", "")
    if summary_text:
        st.markdown(f"""
        <div class="report-card">
            <h3>📋 Summary</h3>
            <p>{summary_text}</p>
        </div>
        """, unsafe_allow_html=True)

    # Strengths & Improvements side by side
    strengths = report.get("strengths", [])
    improvements = report.get("improvements", [])

    col_s, col_i = st.columns(2)
    with col_s:
        if strengths:
            items = "".join(f"<li>✅ {s}</li>" for s in strengths)
            st.markdown(f"""
            <div class="report-card">
                <h3>💪 Strengths</h3>
                <ul>{items}</ul>
            </div>
            """, unsafe_allow_html=True)
    with col_i:
        if improvements:
            items = "".join(f"<li>📌 {imp}</li>" for imp in improvements)
            st.markdown(f"""
            <div class="report-card">
                <h3>🎯 Areas to Improve</h3>
                <ul>{items}</ul>
            </div>
            """, unsafe_allow_html=True)

    # Topic breakdown
    topic_breakdown = report.get("topic_breakdown", [])
    if topic_breakdown:
        st.markdown("""
        <div class="report-card">
            <h3>📊 Topic Breakdown</h3>
        </div>
        """, unsafe_allow_html=True)
        for tb in topic_breakdown:
            if isinstance(tb, dict):
                topic_name = tb.get("topic", "Unknown")
                topic_score = tb.get("score", "N/A")
                topic_notes = tb.get("notes", "")
                st.markdown(f"- **{topic_name}** — Score: `{topic_score}` — {topic_notes}")
            else:
                st.markdown(f"- {tb}")

    # Transcript file
    transcript_file = st.session_state.transcript_file or report.get("transcript_file", "")
    if transcript_file:
        st.markdown("---")
        st.info(f"📝 Transcript saved to: `{transcript_file}`")

    # Full transcript history
    if st.session_state.transcript_history:
        with st.expander("📜 Full Interview Transcript", expanded=False):
            for entry in st.session_state.transcript_history:
                badge = "⚡ STRIKE" if entry.get("strike") else f"Score: {entry.get('score', '?')}/10"
                plag = " | 🚨 Plagiarism" if entry.get("plagiarism") else ""
                st.markdown(f"""
                <div class="transcript-entry">
                    <div class="te-q">Q{entry['q_num']} [{entry['difficulty']}] — {entry['topic']} &nbsp;|&nbsp; {badge}{plag}</div>
                    <div class="te-a"><strong>Q:</strong> {entry['question']}</div>
                    <div class="te-a"><strong>A:</strong> {entry['answer'][:300]}{'…' if len(entry['answer']) > 300 else ''}</div>
                    <div class="te-a"><em>{entry.get('feedback', '')}</em></div>
                </div>
                """, unsafe_allow_html=True)

    st.markdown("---")
    if st.button("🔄 Start New Interview", use_container_width=True, key="new_final"):
        # Clean up backend session
        try:
            requests.delete(f"{API_BASE}/interview/{st.session_state.session_id}", timeout=5)
        except Exception:
            pass
        for k in list(st.session_state.keys()):
            del st.session_state[k]
        init_session_state()
        st.rerun()
