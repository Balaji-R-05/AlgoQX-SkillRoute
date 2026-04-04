import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wind, 
  Battery, 
  Coffee, 
  CheckCircle2, 
  X, 
  ArrowRight,
  Loader2,
  Heart
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function StressBuster({ onClose, onReliefApplied }) {
  const { idToken } = useAuth();
  const [mode, setMode] = useState('intro'); // intro, breathing, relief, success
  const [breathingStep, setBreathingStep] = useState('Inhale');
  const [timer, setTimer] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  // Breathing Animation Logic
  useEffect(() => {
    if (mode === 'breathing') {
      const interval = setInterval(() => {
        setBreathingStep(prev => prev === 'Inhale' ? 'Exhale' : 'Inhale');
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  const applyRelief = async () => {
    setIsApplying(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/schedules/relief`, {}, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (onReliefApplied) onReliefApplied(res.data);
      setMode('success');
    } catch (err) {
      console.error("Relief failed:", err);
      alert("Something went wrong while adjusting your schedule.");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2rem] border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="p-8 md:p-12">
          <AnimatePresence mode="wait">
            {mode === 'intro' && (
              <motion.div 
                key="intro"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center space-y-6"
              >
                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto transform rotate-6 border-2 border-black">
                  <Wind className="w-10 h-10 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight">Stress Detected</h2>
                  <p className="text-gray-600 dark:text-gray-400 font-medium mt-2">
                    Your readiness signals suggest you're under pressure. Let's reset your momentum.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Button 
                    onClick={() => setMode('breathing')}
                    className="h-20 flex flex-col gap-1 rounded-2xl border-2 border-black bg-[#bae6fd] hover:bg-[#7dd3fc] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <Wind className="w-5 h-5" />
                    <span className="font-bold text-[10px] uppercase">Breathe</span>
                  </Button>
                  <Button 
                    onClick={() => setMode('relief')}
                    className="h-20 flex flex-col gap-1 rounded-2xl border-2 border-black bg-[#fef08a] hover:bg-[#fde047] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <Battery className="w-5 h-5" />
                    <span className="font-bold text-[10px] uppercase">Reset</span>
                  </Button>
                  <Button 
                    onClick={() => {
                      onClose();
                      window.location.href = '/teacher';
                    }}
                    className="h-20 flex flex-col gap-1 rounded-2xl border-2 border-black bg-[#ddd6fe] hover:bg-[#c4b5fd] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <Brain className="w-5 h-5" />
                    <span className="font-bold text-[10px] uppercase">Focus</span>
                  </Button>
                </div>
              </motion.div>
            )}

            {mode === 'breathing' && (
              <motion.div 
                key="breathing"
                className="text-center space-y-12 py-8"
              >
                <div className="relative flex justify-center items-center">
                  <motion.div 
                    animate={{ 
                      scale: breathingStep === 'Inhale' ? [1, 1.5] : [1.5, 1],
                      opacity: breathingStep === 'Inhale' ? [0.4, 0.8] : [0.8, 0.4]
                    }}
                    transition={{ duration: 4, ease: "easeInOut" }}
                    className="w-32 h-32 bg-indigo-500 rounded-full blur-2xl"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-black uppercase tracking-widest text-indigo-900 dark:text-white">
                      {breathingStep}
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="font-bold text-gray-500 uppercase tracking-tighter">Follow the Pulse</p>
                  <Button 
                    variant="outline" 
                    onClick={() => setMode('intro')}
                    className="rounded-full px-8 hover:bg-gray-100"
                  >
                    Stop Exercise
                  </Button>
                </div>
              </motion.div>
            )}

            {mode === 'relief' && (
              <motion.div 
                key="relief"
                className="text-center space-y-8"
              >
                <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-3xl flex items-center justify-center mx-auto transform -rotate-3 border-2 border-black">
                  <Coffee className="w-10 h-10 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight">Adaptive Relief</h2>
                  <p className="text-gray-600 dark:text-gray-400 font-medium mt-2">
                    I'll defer non-essential tasks from your active schedules so you can focus on resting or light revision.
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800 p-6 rounded-2xl border-2 border-dashed border-gray-300 dark:border-zinc-700 text-left">
                  <p className="text-sm font-bold text-gray-500 flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Impact Actions:
                  </p>
                  <ul className="text-sm font-semibold space-y-2">
                    <li>• Defer deep-learning modules for 24h</li>
                    <li>• Reduce planned study hours by 50%</li>
                    <li>• Prioritize low-cognitive load revision</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={applyRelief}
                    disabled={isApplying}
                    className="h-14 bg-black text-white rounded-2xl font-black uppercase tracking-wide hover:bg-gray-800"
                  >
                    {isApplying ? <Loader2 className="animate-spin w-5 h-5" /> : "Apply Stress Relief"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setMode('intro')}
                    className="font-bold underline"
                  >
                    Nevermind, I'll push through
                  </Button>
                </div>
              </motion.div>
            )}

            {mode === 'success' && (
              <motion.div 
                key="success"
                className="text-center space-y-8"
              >
                <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight">Relief Applied</h2>
                  <p className="text-gray-600 dark:text-gray-400 font-medium mt-2">
                    Your active plans have been adjusted. Take this time to recharge—your future self will thank you.
                  </p>
                </div>
                <Button 
                  onClick={onClose}
                  className="w-full h-14 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-wide hover:bg-emerald-700"
                >
                  Got it, Thanks!
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
