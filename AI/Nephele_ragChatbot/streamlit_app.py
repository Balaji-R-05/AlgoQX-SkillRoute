"""
streamlit_app.py — Nephele 3.0 Streamlit Frontend
Connects to the FastAPI backend (Teachng_RAG.py) for RAG teaching + voice output.
"""

import streamlit as st
import requests
import tempfile

API_URL = "http://127.0.0.1:8000"

# ── PAGE CONFIG ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Nephele 3.0 — RAG Teacher",
    page_icon="🎓",
    layout="centered",
    initial_sidebar_state="collapsed",
)

# ── CUSTOM CSS ───────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

html, body, [class*="css"] { font-family: 'Inter', sans-serif; }

.hero { text-align: center; padding: 1.5rem 0 0.5rem; }
.hero h1 {
    font-size: 2.4rem; font-weight: 700;
    background: linear-gradient(135deg, #6C63FF 0%, #E040FB 50%, #FF6E40 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 0.2rem;
}
.hero p { color: #9e9e9e; font-size: 1.05rem; font-weight: 300; }

.step-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px; padding: 1.4rem 1.6rem; margin-bottom: 1rem;
    transition: border-color 0.3s;
}
.step-card:hover { border-color: #6C63FF; }
.step-num {
    display: inline-block; background: linear-gradient(135deg, #6C63FF, #E040FB);
    color: white; font-weight: 700; font-size: 0.75rem;
    padding: 4px 12px; border-radius: 20px; margin-bottom: 0.5rem;
}
.step-title { font-size: 1.2rem; font-weight: 600; margin-bottom: 0.2rem; }
.step-desc { color: #9e9e9e; font-size: 0.88rem; margin-bottom: 0.8rem; }

.teacher-bubble {
    background: linear-gradient(135deg, rgba(108,99,255,0.12), rgba(224,64,251,0.08));
    border-left: 4px solid #6C63FF; border-radius: 0 12px 12px 0;
    padding: 1.2rem 1.4rem; margin: 1rem 0; font-size: 0.95rem; line-height: 1.7;
}
.chat-q {
    background: rgba(108,99,255,0.10); border-radius: 12px;
    padding: 0.8rem 1.2rem; margin: 0.5rem 0; font-weight: 500;
}
.chat-a {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 0.8rem 1.2rem; margin: 0.5rem 0 1rem; line-height: 1.65;
}
.stButton > button {
    border-radius: 10px !important; font-weight: 600 !important;
    padding: 0.55rem 1.8rem !important; transition: all 0.25s !important;
}
.stButton > button:hover {
    transform: translateY(-1px); box-shadow: 0 4px 20px rgba(108,99,255,0.3);
}
audio { border-radius: 10px; width: 100%; margin-top: 0.5rem; }
.status-badge {
    display: inline-block; padding: 3px 10px; border-radius: 20px;
    font-size: 0.75rem; font-weight: 600;
}
.status-ready { background: rgba(76,175,80,0.15); color: #66BB6A; }
.status-pending { background: rgba(255,152,0,0.15); color: #FFA726; }
</style>
""", unsafe_allow_html=True)

# ── SESSION STATE ────────────────────────────────────────────────────────────
if "doc_loaded" not in st.session_state:
    st.session_state.doc_loaded = False
if "lesson_text" not in st.session_state:
    st.session_state.lesson_text = ""
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

# ── HERO ─────────────────────────────────────────────────────────────────────
st.markdown("""
<div class="hero">
    <h1>🎓 Nephele 3.0</h1>
    <p>Your AI teaching assistant — upload notes, learn by voice</p>
</div>
""", unsafe_allow_html=True)

# Status bar
col1, col2, col3 = st.columns(3)
with col1:
    badge = "status-ready" if st.session_state.doc_loaded else "status-pending"
    label = "📚 Document Loaded" if st.session_state.doc_loaded else "📚 No Document"
    st.markdown(f'<span class="status-badge {badge}">{label}</span>', unsafe_allow_html=True)
with col2:
    badge = "status-ready" if st.session_state.lesson_text else "status-pending"
    label = "📖 Lesson Ready" if st.session_state.lesson_text else "📖 No Lesson"
    st.markdown(f'<span class="status-badge {badge}">{label}</span>', unsafe_allow_html=True)
with col3:
    st.markdown('<span class="status-badge status-ready">🤖 gemma4:31b</span>', unsafe_allow_html=True)

st.markdown("---")

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 1 — LOAD DOCUMENT
# ══════════════════════════════════════════════════════════════════════════════
st.markdown("""
<div class="step-card">
    <span class="step-num">STEP 1</span>
    <div class="step-title">📄 Upload Your Study Material</div>
    <div class="step-desc">Upload a PDF or paste a URL. Nephele will read, chunk, and embed the content for you.</div>
</div>
""", unsafe_allow_html=True)

tab_pdf, tab_url = st.tabs(["📎 Upload PDF", "🌐 Paste URL"])
with tab_pdf:
    uploaded_file = st.file_uploader("Choose a PDF file", type=["pdf"], label_visibility="collapsed")
with tab_url:
    doc_url = st.text_input("Document URL", placeholder="https://example.com/notes.html", label_visibility="collapsed")

if st.button("🚀 Load & Embed Document", use_container_width=True):
    source_path = None
    if uploaded_file is not None:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(uploaded_file.getvalue())
            source_path = tmp.name
    elif doc_url:
        source_path = doc_url

    if source_path:
        with st.spinner("Reading document and creating vector embeddings..."):
            try:
                res = requests.post(f"{API_URL}/load_document/", data={"source": source_path}, timeout=120)
                data = res.json()
                if data.get("success"):
                    st.session_state.doc_loaded = True
                    st.session_state.lesson_text = ""
                    st.session_state.chat_history = []
                    st.success(f"✅ **{data.get('source', 'Document')}** loaded — {data.get('chunks', '?')} chunks embedded!")
                else:
                    st.error(f"❌ {data.get('error', 'Unknown error')}")
            except Exception as e:
                st.error(f"❌ Cannot reach API: {e}")
    else:
        st.warning("Upload a PDF or paste a URL first.")

st.markdown("---")

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 2 — TEACH LESSON
# ══════════════════════════════════════════════════════════════════════════════
st.markdown("""
<div class="step-card">
    <span class="step-num">STEP 2</span>
    <div class="step-title">🎙️ Learn a Topic</div>
    <div class="step-desc">Tell Nephele what you'd like to learn. She'll craft a spoken lesson from your uploaded notes.</div>
</div>
""", unsafe_allow_html=True)

topic = st.text_input(
    "What would you like to learn?",
    placeholder="e.g. Explain Python data types in simple terms",
    disabled=not st.session_state.doc_loaded,
)

if st.button("🎓 Teach Me!", use_container_width=True, disabled=not st.session_state.doc_loaded):
    if not topic:
        st.warning("Enter a topic first.")
    else:
        with st.spinner("🔍 Retrieving content & generating lesson... (this may take a minute)"):
            try:
                res = requests.post(f"{API_URL}/teach_lesson/", data={"topic": topic}, timeout=300)
                data = res.json()
                if data.get("success"):
                    lesson = data.get("lesson", "")
                    st.session_state.lesson_text = lesson
                    st.session_state.chat_history = []

                    # Display the lesson in a teacher bubble
                    st.markdown(f'<div class="teacher-bubble">{lesson}</div>', unsafe_allow_html=True)

                    # Play the audio
                    audio_file = data.get("audio_file")
                    if audio_file:
                        st.audio(f"{API_URL}/audio/{audio_file}", format="audio/mp3")
                    else:
                        st.info("⚠️ Voice generation skipped — read the lesson above.")
                else:
                    st.error(f"❌ {data.get('error', 'Failed to generate lesson')}")
            except Exception as e:
                st.error(f"❌ Cannot reach API: {e}")

st.markdown("---")

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 3 — ASK DOUBTS
# ══════════════════════════════════════════════════════════════════════════════
st.markdown("""
<div class="step-card">
    <span class="step-num">STEP 3</span>
    <div class="step-title">❓ Ask a Doubt</div>
    <div class="step-desc">Ask questions about the lesson. Nephele will answer using your notes and speak the answer.</div>
</div>
""", unsafe_allow_html=True)

question = st.text_input(
    "Your question",
    placeholder="e.g. What is the difference between a list and a tuple?",
    disabled=not st.session_state.lesson_text,
)

if st.button("💬 Ask Nephele", use_container_width=True, disabled=not st.session_state.lesson_text):
    if not question:
        st.warning("Type your question first.")
    else:
        with st.spinner("🤔 Thinking..."):
            try:
                res = requests.post(f"{API_URL}/doubt/", data={"question": question}, timeout=300)
                data = res.json()
                if data.get("success"):
                    answer = data.get("answer", "")
                    st.session_state.chat_history.append({"q": question, "a": answer})

                    st.markdown(f'<div class="chat-q">🙋 {question}</div>', unsafe_allow_html=True)
                    st.markdown(f'<div class="chat-a">🎓 {answer}</div>', unsafe_allow_html=True)

                    audio_file = data.get("audio_file")
                    if audio_file:
                        st.audio(f"{API_URL}/audio/{audio_file}", format="audio/mp3")
                else:
                    st.error(f"❌ {data.get('error', 'Failed to generate answer')}")
            except Exception as e:
                st.error(f"❌ Cannot reach API: {e}")

# Chat history
if st.session_state.chat_history:
    with st.expander("📜 Previous Q&A", expanded=False):
        for entry in st.session_state.chat_history[:-1]:
            st.markdown(f'<div class="chat-q">🙋 {entry["q"]}</div>', unsafe_allow_html=True)
            st.markdown(f'<div class="chat-a">🎓 {entry["a"]}</div>', unsafe_allow_html=True)
            st.markdown("---")

# Footer
st.markdown("---")
st.markdown(
    "<div style='text-align:center; color:#666; font-size:0.8rem;'>"
    "Nephele 3.0 · Powered by Gemma 4 · BAAI/bge-m3 Embeddings · Edge TTS"
    "</div>",
    unsafe_allow_html=True,
)
