import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { FloatingHeader } from '../components/ui/floating-header';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Mic, Upload, Send, SkipForward, StopCircle, Award,
  Brain, Shield, AlertTriangle, ChevronRight, FileText,
  Target, TrendingUp, Zap, Clock, BarChart3
} from 'lucide-react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function MockInterview() {
  const { user, logout } = useAuth();
  const [phase, setPhase] = useState('setup'); // setup | active | completed
  const [sessionId, setSessionId] = useState(null);
  const [candidateName, setCandidateName] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentTopic, setCurrentTopic] = useState('');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [strikes, setStrikes] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [lastFeedback, setLastFeedback] = useState(null);
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [interviewType, setInterviewType] = useState('technical');
  const [error, setError] = useState('');
  const resumeRef = useRef(null);
  const skillRef = useRef(null);
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const getToken = async () => {
    return await user.getIdToken();
  };

  const loadHistory = async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${API}/api/interviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory(res.data);
    } catch (e) {
      console.error('Failed to load history', e);
    }
  };

  const startInterview = async () => {
    const resumeFile = resumeRef.current?.files[0];
    if (!resumeFile) {
      setError('Please upload your resume to begin.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('resume_file', resumeFile);
      const skillFile = skillRef.current?.files[0];
      if (skillFile) formData.append('skill_file', skillFile);
      formData.append('interview_type', interviewType);

      const res = await axios.post(`${API}/api/interviews/start`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setSessionId(res.data.session_id);
      setCandidateName(res.data.candidate_name);
      setCurrentQuestion(res.data.question);
      setCurrentTopic(res.data.topic);
      setDifficulty(res.data.initial_difficulty);
      setStrikes(0);
      setQuestionCount(1);
      setTranscript([]);
      setPhase('active');
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to start interview.');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim() && answer.trim() !== '') return;
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API}/api/interviews/${sessionId}/answer`,
        { answer: answer || 'skip' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = res.data;

      setTranscript(prev => [...prev, {
        question: currentQuestion,
        topic: currentTopic,
        difficulty,
        answer: answer || '(skipped)',
        score: data.question_score,
        feedback: data.feedback,
        plagiarism: data.plagiarism_flag,
      }]);

      if (data.status === 'completed') {
        setReport(data);
        setPhase('completed');
        loadHistory();
      } else {
        setCurrentQuestion(data.next_question);
        setCurrentTopic(data.next_topic);
        setDifficulty(data.difficulty_after);
        setStrikes(data.strikes);
        setQuestionCount(data.question_count);
        setLastFeedback({
          score: data.question_score,
          feedback: data.feedback,
          plagiarism: data.plagiarism_flag,
          diffChange: data.difficulty_before !== data.difficulty_after,
        });
      }
      setAnswer('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to submit answer.');
    } finally {
      setLoading(false);
    }
  };

  const endInterview = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API}/api/interviews/${sessionId}/end`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReport(res.data);
      setPhase('completed');
      loadHistory();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to end interview.');
    } finally {
      setLoading(false);
    }
  };

  const resetInterview = () => {
    setPhase('setup');
    setSessionId(null);
    setReport(null);
    setTranscript([]);
    setLastFeedback(null);
    setAnswer('');
    setError('');
  };

  const difficultyColor = {
    EASY: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
    MEDIUM: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30',
    HARD: 'text-red-500 bg-red-50 dark:bg-red-950/30',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-black dark:via-zinc-950 dark:to-black">
      <FloatingHeader onLogout={logout} />
      <main className="max-w-4xl mx-auto px-4 py-8 pt-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Brain className="h-8 w-8 text-blue-500" />
              Mock Interview
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Practice with AI-powered adaptive interviews. Build confidence at your own pace.
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-red-600 dark:text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          {/* SETUP PHASE */}
          {phase === 'setup' && (
            <div className="space-y-6">
              <Card className="border-0 shadow-lg dark:bg-zinc-900/80">
                <CardHeader>
                  <CardTitle className="text-lg">Start a New Interview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Interview Type
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {['technical', 'dsa', 'aptitude', 'mixed'].map(type => (
                        <button
                          key={type}
                          onClick={() => setInterviewType(type)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                            interviewType === type
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
                              : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Upload className="inline h-4 w-4 mr-1" />
                      Resume (PDF or TXT) *
                    </label>
                    <input
                      ref={resumeRef}
                      type="file"
                      accept=".pdf,.txt"
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FileText className="inline h-4 w-4 mr-1" />
                      Skills File (optional, TXT)
                    </label>
                    <input
                      ref={skillRef}
                      type="file"
                      accept=".txt"
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100 dark:file:bg-zinc-800 dark:file:text-gray-400"
                    />
                  </div>

                  <Button
                    onClick={startInterview}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Analyzing your profile...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Mic className="h-4 w-4" />
                        Begin Interview
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Past Interviews */}
              {history.length > 0 && (
                <Card className="border-0 shadow-lg dark:bg-zinc-900/80">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-gray-400" />
                      Past Interviews
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {history.map((h, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                              {h.interview_type} Interview
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(h.created_at).toLocaleDateString()} · {h.question_count} questions
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {h.status === 'completed' && (
                              <span className={`text-lg font-bold ${
                                h.final_score >= 70 ? 'text-emerald-500' :
                                h.final_score >= 40 ? 'text-amber-500' : 'text-red-500'
                              }`}>
                                {h.final_score}/100
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              h.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                            }`}>
                              {h.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ACTIVE PHASE */}
          {phase === 'active' && (
            <div className="space-y-4">
              {/* Stats Bar */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Question</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{questionCount}/15</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Strikes</p>
                  <p className="text-lg font-bold text-red-500">{strikes}/5</p>
                </div>
                <div className={`rounded-xl p-3 text-center shadow-sm ${difficultyColor[difficulty]}`}>
                  <p className="text-xs opacity-70">Difficulty</p>
                  <p className="text-lg font-bold">{difficulty}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Topic</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{currentTopic}</p>
                </div>
              </div>

              {/* Last Feedback */}
              <AnimatePresence>
                {lastFeedback && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-bold ${
                        lastFeedback.score >= 7 ? 'text-emerald-600' :
                        lastFeedback.score >= 4 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {lastFeedback.score}/10
                      </span>
                      {lastFeedback.plagiarism && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-950/30 text-red-600 rounded-full">
                          ⚠ Originality concern
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-300">{lastFeedback.feedback}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Question Card */}
              <Card className="border-0 shadow-lg dark:bg-zinc-900/80">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 mb-6">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Question {questionCount} · {currentTopic} · {difficulty}
                      </p>
                      <p className="text-base text-gray-900 dark:text-white leading-relaxed">
                        {currentQuestion}
                      </p>
                    </div>
                  </div>

                  <textarea
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    placeholder="Type your answer here... Take your time, think clearly."
                    rows={5}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    disabled={loading}
                  />

                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={submitAnswer}
                      disabled={loading || !answer.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                    >
                      {loading ? (
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          Submit Answer
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setAnswer('skip'); submitAnswer(); }}
                      disabled={loading}
                      className="rounded-xl"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={endInterview}
                      disabled={loading}
                      className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <StopCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Transcript History */}
              {transcript.length > 0 && (
                <Card className="border-0 shadow-lg dark:bg-zinc-900/80">
                  <CardHeader>
                    <CardTitle className="text-sm text-gray-500">Transcript</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {transcript.map((t, i) => (
                        <div key={i} className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg text-sm">
                          <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">
                            Q{i + 1} · {t.topic} · {t.difficulty}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 mb-1">{t.question}</p>
                          <p className="text-gray-900 dark:text-white italic">→ {t.answer}</p>
                          {t.score !== undefined && (
                            <p className={`text-xs mt-1 font-medium ${
                              t.score >= 7 ? 'text-emerald-500' :
                              t.score >= 4 ? 'text-amber-500' : 'text-red-500'
                            }`}>
                              Score: {t.score}/10
                            </p>
                          )}
                        </div>
                      ))}
                      <div ref={transcriptEndRef} />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* COMPLETED PHASE */}
          {phase === 'completed' && report && (
            <div className="space-y-6">
              <Card className="border-0 shadow-lg dark:bg-zinc-900/80 overflow-hidden">
                <div className={`p-6 text-center ${
                  report.final_score >= 70 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' :
                  report.final_score >= 40 ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                  'bg-gradient-to-br from-red-500 to-pink-600'
                } text-white`}>
                  <Award className="h-12 w-12 mx-auto mb-3 opacity-90" />
                  <p className="text-5xl font-bold mb-2">{report.final_score}</p>
                  <p className="text-lg opacity-90">out of 100</p>
                  <p className="text-sm opacity-75 mt-1">{report.reason?.replace(/_/g, ' ')}</p>
                </div>
                <CardContent className="pt-6">
                  <p className="text-gray-700 dark:text-gray-300 mb-4">{report.summary}</p>

                  {report.strengths?.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" /> Strengths
                      </h3>
                      <ul className="space-y-1">
                        {report.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                            <span className="text-emerald-500 mt-0.5">✓</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {report.improvements?.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                        <Target className="h-4 w-4" /> Areas to Improve
                      </h3>
                      <ul className="space-y-1">
                        {report.improvements.map((imp, i) => (
                          <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">→</span> {imp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button onClick={resetInterview} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                    Start Another Interview
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
