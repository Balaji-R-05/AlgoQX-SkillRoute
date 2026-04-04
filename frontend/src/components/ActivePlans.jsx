import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Calendar, Target, ChevronRight, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ActivePlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const { idToken } = useAuth();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/schedules/active/all`, {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        setPlans(res.data);
      } catch (err) {
        console.error("Failed to fetch active plans:", err);
      } finally {
        setLoading(false);
      }
    };
    if (idToken) fetchPlans();
  }, [idToken]);

  if (loading || plans.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
          <Target className="size-5 text-indigo-500" /> Mastery Roadmaps
        </h2>
        <span className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 uppercase">
          {plans.length} Active
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ y: -2 }}
            className="p-5 bg-white dark:bg-zinc-900 border-2 border-black rounded-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
               <TrendingUp className="size-16" />
            </div>
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-1 block">
                   {(plan.event_type || 'General').toUpperCase()}
                </span>
                <h3 className="font-black text-lg text-zinc-900 dark:text-white leading-tight truncate max-w-[200px]">
                  {plan.title}
                </h3>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{plan.overall_progress}%</div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase">Complete</div>
              </div>
            </div>

            <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full mb-4 overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${plan.overall_progress}%` }}
                 className="h-full bg-indigo-500 rounded-full"
               />
            </div>

            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                 <Calendar className="size-3.5" />
                 <span className="text-xs font-bold">{plan.days_remaining} days left</span>
              </div>
              <button 
                onClick={() => window.location.href = '/teacher'} 
                className="size-8 rounded-full bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors border-2 border-black"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ActivePlans;
