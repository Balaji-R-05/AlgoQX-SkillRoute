import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  BrainCog, 
  TrendingUp, 
  Target, 
  Award, 
  Clock, 
  ArrowUpRight, 
  Brain, 
  BookOpen, 
  Activity,
  Sparkles,
  History,
  ChevronRight
} from 'lucide-react';
import ReadinessGauge from '../components/ReadinessGauge';
import TrendChart from '../components/TrendChart';
import ActivityHeatmap from '../components/ActivityHeatmap';
import AdaptiveRecommendations from '../components/AdaptiveRecommendations';
import WellnessCheckin from '../components/WellnessCheckin';
import { FloatingHeader } from '../components/ui/floating-header';
import StressBuster from '../components/StressBuster';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Analytics() {
  const { idToken, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [todayData, setTodayData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [masteryData, setMasteryData] = useState([]);
  
  const [showCheckin, setShowCheckin] = useState(false);
  const [showStressBuster, setShowStressBuster] = useState(false);

  const fetchAnalytics = async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      // Fetch today's readiness
      const todayRes = await axios.get(`${API_BASE_URL}/api/wellness/today`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      setTodayData(todayRes.data);

      // Fetch history (last 30 days)
      const historyRes = await axios.get(`${API_BASE_URL}/api/wellness/history?days=30`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      setHistoryData(historyRes.data.snapshots || []);

      // Fetch topic mastery
      const masteryRes = await axios.get(`${API_BASE_URL}/api/quiz/mastery`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      setMasteryData(masteryRes.data || []);
      
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      if (err.response?.status === 401) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError('Could not load analytics data. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && idToken) {
      fetchAnalytics();
    } else if (!authLoading && !idToken) {
      setLoading(false);
      setError('You must be logged in to view analytics.');
    }
  }, [idToken, authLoading]);

  const handleCheckinComplete = (checkinData) => {
    setShowCheckin(false);
    fetchAnalytics(); // Refresh to get new readiness score
    
    // Automatically trigger StressBuster if stress is high (>= 7)
    if (checkinData?.wellness_stress >= 7) {
      setTimeout(() => setShowStressBuster(true), 1000);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const hasCheckedInToday = todayData?.has_checked_in;
  const readiness = todayData?.readiness;

  const bentoCardStyle = "bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border-2 border-transparent hover:border-black dark:hover:border-white rounded-[2.5rem] p-8 shadow-sm hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,0.05)] transition-all duration-500 relative overflow-hidden group";

  if (loading && !todayData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-zinc-400 font-medium animate-pulse">Syncing your performance pulse...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-12">
      <FloatingHeader onLogout={handleLogout} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-12 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
              Learning <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500">Pulse</span>
            </h1>
            <p className="mt-2 text-gray-500 dark:text-zinc-400 font-medium">Real-time analysis of your academic and placement readiness.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-[10px] font-black bg-white dark:bg-zinc-900 px-4 py-2 rounded-2xl border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-gray-500">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${readiness?.readiness < 40 ? 'bg-rose-400' : 'bg-green-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${readiness?.readiness < 40 ? 'bg-rose-500' : 'bg-green-500'}`}></span>
              </span>
              {readiness?.readiness < 40 ? 'MENTAL HEALTH CHECK RECOMMENDED' : 'ALL SYSTEMS OPTIMIZED'}
            </div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">
              Last Synced: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Wellness Checkin Modal / Inline */}
        <AnimatePresence>
          {showCheckin && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="max-w-2xl mx-auto mb-10 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-indigo-100 dark:border-indigo-900/30 shadow-xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <BrainCog className="w-5 h-5 text-indigo-500 shadow-sm" /> 
                  Daily Wellness Check-in
                </h2>
                <button 
                  onClick={() => setShowCheckin(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-400 rotate-90" />
                </button>
              </div>
              <WellnessCheckin onComplete={handleCheckinComplete} />
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="p-6 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-3xl border border-red-100 dark:border-red-900/20 font-medium">
            {error}
          </div>
        )}

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
          
          {/* Stress Alert Banner (Conditional) */}
          {readiness?.factors?.wellness_stress >= 7 && !showStressBuster && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="md:col-span-4 bg-rose-500 rounded-3xl p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row items-center justify-between gap-4 text-white overflow-hidden"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl animate-pulse">
                  <Activity className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Critical Stress Detected</h3>
                  <p className="font-bold text-white/80">Your cognitive load is currently exceeding healthy limits. Let's adjust.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowStressBuster(true)}
                className="w-full md:w-auto px-8 py-4 bg-white text-rose-600 font-black rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all uppercase tracking-wide"
              >
                Launch Stress Buster
              </button>
            </motion.div>
          )}
          
          {/* Readiness Score Card - Col 1, RowSpan 2 */}
          <div className={`${bentoCardStyle} md:col-span-1 md:row-span-2 flex flex-col items-center justify-center text-center group`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Award className="size-24 text-indigo-500" />
            </div>
            <h3 className="text-lg font-bold mb-6 text-gray-800 dark:text-gray-200 z-10">Current Readiness</h3>
            <div className="z-10 w-full transform group-hover:scale-105 transition-transform duration-500">
              <ReadinessGauge readinessData={readiness} />
            </div>
            {!hasCheckedInToday && (
              <button
                onClick={() => setShowCheckin(true)}
                className="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-indigo-500/20 transition-all hover:shadow-lg active:scale-95 z-10 text-sm"
              >
                Start Daily Check-in
              </button>
            )}
          </div>

          {/* Trend Chart (Longitudinal) - Col 2-4, RowSpan 2 */}
          <div className={`${bentoCardStyle} md:col-span-3 md:row-span-2 overflow-hidden`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                Readiness Trend
              </h3>
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <History className="w-3 h-3" />
                Last 30 Days
              </div>
            </div>
            <div className="h-[300px]">
              <TrendChart loading={loading} historyData={historyData} />
            </div>
          </div>

          {/* Topic Mastery Section - Col 1-2 */}
          <div className={`${bentoCardStyle} md:col-span-2 min-h-[300px]`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
            <h3 className="text-xl font-black mb-6 text-gray-900 dark:text-white flex items-center gap-2 relative z-10">
              <BrainCog className="w-5 h-5 text-indigo-500" />
              Topic-wise Mastery
            </h3>
            {masteryData.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                {masteryData.slice(0, 4).map((item, idx) => (
                  <div key={idx} className="space-y-2 group/item">
                    <div className="flex justify-between items-end">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate group-hover/item:text-indigo-500 transition-colors">{item.topic}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.attempts} Assessments</p>
                      </div>
                      <span className={`text-lg font-black ${
                        item.mastery >= 80 ? 'text-emerald-500' :
                        item.mastery >= 50 ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {item.mastery}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          item.mastery >= 80 ? 'bg-emerald-500' :
                          item.mastery >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${item.mastery}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                <div className="bg-gray-100 dark:bg-zinc-800/50 p-4 rounded-full mb-4">
                  <Brain className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-400 font-medium italic text-sm">Take quizzes to generate insights</p>
              </div>
            )}
          </div>

          {/* Readiness Diagnostic Breakdown - Col 3-4 */}
          <div className={`${bentoCardStyle} md:col-span-2 flex flex-col`}>
             <h3 className="text-xl font-black mb-6 text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" />
              Diagnostic Breakdown
            </h3>
            <div className="flex-1 space-y-5">
              {[
                { label: 'Academic Mastery', value: readiness?.factors?.quiz_avg || 0, color: 'bg-indigo-500' },
                { label: 'Consistency Alignment', value: readiness?.factors?.adherence_rate || 0, color: 'bg-emerald-500' },
                { label: 'Mental Readiness', value: Math.max(0, (100 - (readiness?.factors?.wellness_stress * 10 || 0))), color: 'bg-rose-500' },
                { label: 'Growth Momentum', value: Math.min((readiness?.factors?.current_streak || 0) * 10, 100), color: 'bg-amber-500' }
              ].map((factor, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-tighter text-gray-500">
                    <span>{factor.label}</span>
                    <span className="text-gray-900 dark:text-white font-black">{Math.round(factor.value)}%</span>
                  </div>
                  <div className="h-4 w-full bg-gray-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-black/5 shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${factor.value}%` }}
                      className={`h-full rounded-md ${factor.color} border-r-2 border-black/20`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
               <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">System Insight</p>
               <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                {readiness?.readiness >= 80 ? "Peak performance window. Ideal for high-difficulty modules." :
                 readiness?.readiness >= 50 ? "Stable momentum. Continue with planned schedule." :
                 "Recovery mode prioritized. Focus on light-cognitive revision."}
               </p>
            </div>
          </div>

          {/* Adaptive Recommendations - Col 3-4 */}
          <div className={`${bentoCardStyle} md:col-span-2 group min-h-[300px]`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                Smart Guidance
              </h3>
              <ArrowUpRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
            </div>
            <AdaptiveRecommendations 
              loading={loading} 
              recommendations={readiness?.recommendations || []} 
              onReliefClick={() => setShowStressBuster(true)}
            />
          </div>

          {/* Activity Heatmap Card - Full Width */}
          <div className={`${bentoCardStyle} md:col-span-4 overflow-hidden`}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" />
                Consistency Spectrum
              </h3>
              <div className="hidden sm:flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                  <div className="w-2 h-2 rounded bg-gray-100 dark:bg-zinc-800" />
                  LESS
                </div>
                <div className="flex items-center gap-1">
                   {[1,2,3,4,5].map(i => (
                     <div key={i} className="w-2 h-2 rounded bg-indigo-500" style={{ opacity: i * 0.2 }} />
                   ))}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                  MORE
                  <div className="w-2 h-2 rounded bg-indigo-500" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto pb-4 no-scrollbar">
               <ActivityHeatmap loading={loading} historyData={historyData} />
            </div>
          </div>

        </div>
      </main>

      <AnimatePresence>
        {showStressBuster && (
          <StressBuster 
            onClose={() => setShowStressBuster(false)} 
            onReliefApplied={() => {
              fetchAnalytics();
              // Success feedback handled in StressBuster
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
