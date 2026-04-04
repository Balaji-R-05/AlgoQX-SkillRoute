import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { LineChart, LayoutDashboard, BrainCog } from 'lucide-react';
import ReadinessGauge from '../components/ReadinessGauge';
import TrendChart from '../components/TrendChart';
import ActivityHeatmap from '../components/ActivityHeatmap';
import AdaptiveRecommendations from '../components/AdaptiveRecommendations';
import WellnessCheckin from '../components/WellnessCheckin';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Analytics() {
  const { idToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [todayData, setTodayData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  
  const [showCheckin, setShowCheckin] = useState(false);

  const fetchAnalytics = async () => {
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
      
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('Could not load analytics data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (idToken) {
      fetchAnalytics();
    }
  }, [idToken]);

  const handleCheckinComplete = () => {
    setShowCheckin(false);
    fetchAnalytics(); // Refresh data after check-in
  };

  const hasCheckedInToday = todayData?.has_checked_in;
  const readiness = todayData?.readiness;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-indigo-500" />
            Performance Analytics
          </h1>
          <p className="text-gray-500 font-medium mt-2">
            Track your exam readiness, consistency, and wellness longitudinally.
          </p>
        </div>
        
        {!hasCheckedInToday && !loading && !showCheckin && (
          <button
            onClick={() => setShowCheckin(true)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-1"
          >
            Daily Check-in
          </button>
        )}
      </motion.div>

      {/* Wellness Checkin Modal / Inline */}
      {showCheckin && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="max-w-2xl mx-auto mb-10"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <BrainCog className="w-5 h-5 text-indigo-500" /> Let's check in on you
            </h2>
            <button 
              onClick={() => setShowCheckin(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
          <WellnessCheckin onComplete={handleCheckinComplete} />
        </motion.div>
      )}

      {error ? (
        <div className="p-6 bg-red-50 text-red-600 rounded-2xl border border-red-200">
          {error}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          
          {/* Left Column: Readiness and Recommendations */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-gray-100 dark:border-zinc-800 shadow-sm">
              <h3 className="text-lg font-bold mb-6 text-gray-800 dark:text-gray-200 text-center">Current Readiness</h3>
              {loading ? (
                <div className="animate-pulse flex flex-col items-center gap-4">
                  <div className="w-40 h-40 rounded-full border-8 border-gray-100 dark:border-zinc-800"></div>
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                  <div className="h-10 w-full bg-gray-100 rounded-xl mt-4"></div>
                </div>
              ) : (
                <ReadinessGauge readinessData={readiness} />
              )}
            </div>

            <AdaptiveRecommendations 
              loading={loading} 
              recommendations={readiness?.recommendations || []} 
            />
          </div>

          {/* Right Column: Longitudinal Tracking */}
          <div className="lg:col-span-2 space-y-8">
            <TrendChart loading={loading} historyData={historyData} />
            <ActivityHeatmap loading={loading} historyData={historyData} />
          </div>

        </motion.div>
      )}
    </div>
  );
}
