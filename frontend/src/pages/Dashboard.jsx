import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'
import RoadmapView from '../components/RoadmapView'
import CareerMatchCard from '../components/CareerMatchCard'
import AdaptiveRecommendations from '../components/AdaptiveRecommendations';
import TimelineView from '../components/TimelineView'
import ProgressTracker from '../components/ProgressTracker'
import { FloatingHeader } from '../components/ui/floating-header'
import ConfirmModal from '../components/ConfirmModal'
import { RefreshCw, RotateCcw, Brain } from 'lucide-react'
import AILoadingOverlay from '../components/AILoadingOverlay'
import SkillQuiz from '../components/SkillQuiz'
import LearningOutcomes from '../components/LearningOutcomes'
import JobListings from '../components/JobListings'
import DailyCheckin from '../components/DailyCheckin'
import TodayTasks from '../components/TodayTasks'
import { useDashboardData } from '../hooks/useDashboardData.jsx'
import { Skeleton } from '../components/ui/skeleton'
import { motion, AnimatePresence } from 'framer-motion'
import StressBuster from '../components/StressBuster'
import { CheckCircle2, Zap, Target, ShieldCheck, Activity } from 'lucide-react'
import ActivePlans from '../components/ActivePlans'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

const Dashboard = () => {
  const {
    profile,
    roadmap,
    loading,
    isGenerating,
    generationMode,
    generateRoadmap,
    adaptRoadmap,
    resetCareerPath,
    refreshData
  } = useDashboardData()

  const [showTimeline, setShowTimeline] = useState(true)
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [showConfirmAdapt, setShowConfirmAdapt] = useState(false)
  const [showInsights, setShowInsights] = useState(false);

  const scrollToRoadmap = () => {
      const element = document.getElementById('roadmap-section');
      if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
      }
  };
  const [showQuiz, setShowQuiz] = useState(false)
  const [showStressBuster, setShowStressBuster] = useState(false)
  const [readinessScore, setReadinessScore] = useState(null)
  const navigate = useNavigate()
  const { idToken } = useAuth()

  // Fetch Readiness Score
  useEffect(() => {
    const fetchReadiness = async () => {
      if (!idToken) return;
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/wellness/today`, {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        // Readiness = 10 - Stress
        if (res.data?.stress_level !== undefined) {
          setReadinessScore(10 - res.data.stress_level);
        }
      } catch (err) {
        console.error("Failed to fetch readiness:", err);
      }
    };
    fetchReadiness();
  }, [idToken]);

  // Listen for the custom event from the hook to trigger adapt modal
  useEffect(() => {
    const handleTriggerAdapt = () => setShowConfirmAdapt(true)
    window.addEventListener('triggerAdapt', handleTriggerAdapt)
    return () => window.removeEventListener('triggerAdapt', handleTriggerAdapt)
  }, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      navigate('/login')
    } catch (error) {
      console.error("Logout failed", error)
    }
  }

  const handleAdaptConfirm = async () => {
    setShowConfirmAdapt(false)
    await adaptRoadmap()
  }

  const handleResetConfirm = async () => {
    setShowConfirmReset(false)
    await resetCareerPath()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 transition-colors duration-300">
      <AILoadingOverlay isVisible={isGenerating} mode={generationMode} />
      <FloatingHeader onLogout={handleLogout} userName={profile?.name} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {loading && !roadmap ? (
          <div className="space-y-8 mt-8">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        ) : (
          <>
            {/* Premium Hero Section */}
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 mb-8 shadow-sm group"
            >
              <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700" />
              <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100/50 dark:border-indigo-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Personalized for you</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-white">
                    Welcome back, <span className="text-indigo-600 dark:text-indigo-400">{profile?.name?.split(' ')[0] || 'Explorer'}</span>!
                  </h1>
                  <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl font-medium leading-relaxed">
                    You're currently {roadmap?.progress?.overall_completion || 0}% through your <span className="text-zinc-900 dark:text-zinc-100 font-bold">{roadmap?.career_decision?.career || 'career'}</span> journey.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 min-w-[200px]">
                  {/* Readiness Snapshot */}
                  <div className="p-4 bg-indigo-600 dark:bg-indigo-500 rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-white">
                      <div className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Readiness Pulse</div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-3xl font-black">{readinessScore ?? '--'}<span className="text-sm opacity-60">/10</span></span>
                          <span className="text-[10px] font-bold uppercase">{readinessScore > 7 ? 'Optimum' : readinessScore > 4 ? 'Steady' : readinessScore ? 'Recharge' : 'Pending'}</span>
                        </div>
                        <div className="size-10 rounded-full border-2 border-black bg-white/20 flex items-center justify-center">
                          <Activity className="size-5" />
                        </div>
                      </div>
                  </div>

                   <div className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-none">
                      <div className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Current Streak</div>
                      <div className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        {roadmap?.progress?.streak || 0} <span className="text-orange-500 text-2xl">🔥</span>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>

            {/* Quick Actions Integration */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <button 
                onClick={() => navigate('/mock-interview')}
                className="p-4 bg-[#fef08a] hover:bg-[#fde047] border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1 active:translate-y-0 group text-left"
              >
                <div className="size-10 bg-white border-2 border-black rounded-xl mb-3 flex items-center justify-center group-hover:rotate-6 transition-transform">
                  <Target className="size-5 text-zinc-900" />
                </div>
                <h3 className="font-black text-sm uppercase tracking-tight text-zinc-900">Mock Interview</h3>
                <p className="text-[10px] font-bold text-zinc-700 mt-1">AI-Powered Sessions</p>
              </button>

              <button 
                onClick={() => navigate('/placement-prep')}
                className="p-4 bg-[#bae6fd] hover:bg-[#7dd3fc] border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1 active:translate-y-0 group text-left"
              >
                <div className="size-10 bg-white border-2 border-black rounded-xl mb-3 flex items-center justify-center group-hover:-rotate-3 transition-transform">
                  <ShieldCheck className="size-5 text-zinc-900" />
                </div>
                <h3 className="font-black text-sm uppercase tracking-tight text-zinc-900">Prep Strategy</h3>
                <p className="text-[10px] font-bold text-zinc-700 mt-1">Personalized Roadmaps</p>
              </button>

              <button 
                onClick={() => setShowStressBuster(true)}
                className="p-4 bg-[#fed7aa] hover:bg-[#fdba74] border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1 active:translate-y-0 group text-left"
              >
                <div className="size-10 bg-white border-2 border-black rounded-xl mb-3 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="size-5 text-zinc-900" />
                </div>
                <h3 className="font-black text-sm uppercase tracking-tight text-zinc-900">Stress Relief</h3>
                <p className="text-[10px] font-bold text-zinc-700 mt-1">Guided Reset</p>
              </button>

              <button 
                onClick={() => navigate('/teacher')}
                className="p-4 bg-[#ddd6fe] hover:bg-[#c4b5fd] border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1 active:translate-y-0 group text-left"
              >
                <div className="size-10 bg-white border-2 border-black rounded-xl mb-3 flex items-center justify-center group-hover:rotate-12 transition-transform">
                  <Brain className="size-5 text-zinc-900" />
                </div>
                <h3 className="font-black text-sm uppercase tracking-tight text-zinc-900">Focus Mode</h3>
                <p className="text-[10px] font-bold text-zinc-700 mt-1">Study Guard AI</p>
              </button>
            </div>

            {roadmap?.career_decision && (
              <CareerMatchCard 
                decision={roadmap.career_decision} 
                onViewRoadmap={scrollToRoadmap}
              />
            )}

            {/* Active Study Plans - Master Planner */}
            <ActivePlans />

            {/* Daily Tasks & Check-in Section */}
            {roadmap && (
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <TodayTasks />
                <DailyCheckin />
              </div>
            )}

            {roadmap?.progress && roadmap?.learning_roadmap && (
              <div className="mt-8">
                <AdaptiveRecommendations
                  progress={roadmap.progress}
                  roadmap={roadmap.learning_roadmap}
                />
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setShowQuiz(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
                  >
                    <Brain className="w-4 h-4" />
                    Take Skill Assessment
                  </button>
                </div>
              </div>
            )}

            {!roadmap && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-12 max-w-2xl mx-auto"
              >
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Start Your Career Journey
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400">
                    Generate a personalized roadmap to reach your goals.
                  </p>
                </div>
                <RoadmapView
                  roadmap={null}
                  onGenerate={generateRoadmap}
                  loading={loading}
                  onRefresh={refreshData}
                />
              </motion.div>
            )}

            {roadmap && (
              <div id="roadmap-section" className="space-y-8 mt-12 scroll-mt-24">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-200 dark:border-zinc-800 pb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                      Your Roadmap
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Track your progress and achieve your career goals
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="flex bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-1 shadow-sm relative">
                      <motion.div
                        className="absolute top-1 bottom-1 bg-gray-100 dark:bg-zinc-800 rounded-md z-0"
                        layoutId="toggleHighlight"
                        style={{
                          left: showTimeline ? 'calc(50% + 2px)' : '4px',
                          right: showTimeline ? '4px' : 'calc(50% + 2px)',
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                      <button
                        onClick={() => setShowTimeline(false)}
                        className={`relative z-10 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${!showTimeline
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                      >
                        Classic
                      </button>
                      <button
                        onClick={() => setShowTimeline(true)}
                        className={`relative z-10 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${showTimeline
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                      >
                        Timeline
                      </button>
                    </div>

                    <div className="w-px h-8 bg-gray-200 dark:bg-zinc-800 mx-1 hidden md:block"></div>

                    <div className="flex items-center gap-2 ml-0 sm:ml-auto">
                      <button
                        onClick={() => setShowConfirmAdapt(true)}
                        disabled={loading}
                        className="inline-flex items-center justify-center px-3 sm:px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-90 transition-all disabled:opacity-50 text-xs sm:text-sm font-medium shadow-sm"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Adapt
                      </button>

                      <button
                        onClick={() => setShowConfirmReset(true)}
                        disabled={loading}
                        className="inline-flex items-center justify-center px-3 sm:px-4 py-2 bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 border border-gray-200 dark:border-zinc-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-all disabled:opacity-50 text-xs sm:text-sm font-medium shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                {roadmap.progress && (
                  <ProgressTracker
                    progress={roadmap.progress}
                    phases={roadmap.learning_roadmap?.roadmap}
                  />
                )}

                {roadmap.career_decision && roadmap.progress && (
                  <LearningOutcomes
                    careerDecision={roadmap.career_decision}
                    progress={roadmap.progress}
                    roadmap={roadmap.learning_roadmap}
                  />
                )}

                {roadmap.career_decision?.career && (
                  <JobListings career={roadmap.career_decision.career} />
                )}

                <div>
                  <AnimatePresence mode='wait'>
                    {showTimeline && roadmap?.learning_roadmap ? (
                      <motion.div
                        key="timeline"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <TimelineView
                          roadmap={roadmap.learning_roadmap}
                          progress={roadmap.progress}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="classic"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <RoadmapView
                          roadmap={roadmap}
                          onGenerate={generateRoadmap}
                          onRefresh={refreshData}
                          loading={loading}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <ConfirmModal
        isOpen={showConfirmReset}
        onConfirm={handleResetConfirm}
        onCancel={() => setShowConfirmReset(false)}
        title="Reset Career Path?"
        message="This will delete your current roadmap, reset your progress to 0%, and clear your streak. Your profile will be saved and you can generate a new roadmap immediately."
        confirmText="Yes, Reset"
        cancelText="Cancel"
        type="danger"
      />

      <ConfirmModal
        isOpen={showConfirmAdapt}
        onConfirm={handleAdaptConfirm}
        onCancel={() => setShowConfirmAdapt(false)}
        title="Adapt Roadmap?"
        message="This will analyze your current progress and performance to generate a more personalized learning path for you. Do you want to proceed?"
        confirmText="Yes, Adapt Path"
        cancelText="Cancel"
      />

      <SkillQuiz
        isOpen={showQuiz}
        onClose={() => setShowQuiz(false)}
        skills={profile?.skills || []}
      />

      <AnimatePresence>
        {showStressBuster && (
          <StressBuster 
            onClose={() => setShowStressBuster(false)} 
            onReliefApplied={() => {
              setShowStressBuster(false);
              refreshData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default Dashboard

