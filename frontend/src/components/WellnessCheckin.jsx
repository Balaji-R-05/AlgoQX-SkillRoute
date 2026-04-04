import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Brain,
  Zap,
  Shield,
  Loader2,
  CheckCircle2,
  Sparkles,
  MessageCircle
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DIMENSIONS = [
  {
    key: 'confidence',
    label: 'Confidence',
    icon: Shield,
    question: 'How confident do you feel about your preparation today?',
    low: 'Not confident',
    high: 'Very confident',
    color: 'from-blue-500 to-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    accent: 'text-blue-600 dark:text-blue-400'
  },
  {
    key: 'stress',
    label: 'Stress Level',
    icon: Brain,
    question: 'How stressed are you feeling right now?',
    low: 'Very calm',
    high: 'Very stressed',
    color: 'from-amber-500 to-red-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    accent: 'text-amber-600 dark:text-amber-400'
  },
  {
    key: 'readiness',
    label: 'Exam Readiness',
    icon: Sparkles,
    question: 'How ready do you feel for your upcoming exam or interview?',
    low: 'Unprepared',
    high: 'Fully ready',
    color: 'from-emerald-500 to-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    accent: 'text-emerald-600 dark:text-emerald-400'
  },
  {
    key: 'energy',
    label: 'Energy',
    icon: Zap,
    question: 'What\'s your energy level like today?',
    low: 'Exhausted',
    high: 'Energized',
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    accent: 'text-violet-600 dark:text-violet-400'
  }
];

const EMOJIS = ['😫', '😟', '😐', '🙂', '😊'];

export default function WellnessCheckin({ onComplete, hideResultScreen = false }) {
  const { idToken } = useAuth();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({ confidence: 3, stress: 3, readiness: 3, energy: 3 });
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const currentDim = DIMENSIONS[step];
  const isLastStep = step === DIMENSIONS.length - 1;
  const isNotesStep = step === DIMENSIONS.length;

  const handleSliderChange = (value) => {
    setValues(prev => ({ ...prev, [currentDim.key]: value }));
  };

  const handleNext = () => {
    if (isLastStep) {
      setStep(DIMENSIONS.length); // notes step
    } else {
      setStep(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/wellness/checkin`, {
        ...values,
        notes: notes.trim()
      }, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      setResult(response.data);
      if (onComplete) onComplete(response.data);
    } catch (err) {
      console.error('Wellness check-in failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Completed state
  if (result) {
    if (hideResultScreen) return null;
    
    const readiness = result.readiness;
    return (
      <Card className="overflow-hidden rounded-3xl border-0 shadow-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40">
        <CardContent className="p-8 text-center space-y-5">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 10 }}
          >
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
          </motion.div>
          <h3 className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
            Check-in complete!
          </h3>
          <p className="text-emerald-600 dark:text-emerald-400">
            Your readiness score: <span className="font-black text-3xl">{readiness?.composite_score}</span>/100
          </p>
          {readiness?.gap_label && readiness.gap_label !== 'accurate' && (
            <div className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
              readiness.gap_label === 'overconfident' 
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' 
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
            }`}>
              {readiness.gap_label === 'overconfident'
                ? '📊 Your quiz scores suggest room to grow — focus on weak areas'
                : '💪 You\'re doing better than you think — trust your prep!'}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Notes step
  if (isNotesStep) {
    return (
      <Card className="overflow-hidden rounded-3xl border-0 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 text-white pb-6">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5" /> Anything else on your mind?
          </CardTitle>
          <CardDescription className="text-white/70">
            Optional — share what's helping or worrying you today
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g., Feeling good about math prep, but worried about physics deadline..."
            className="w-full h-28 p-4 rounded-2xl border-2 border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => setStep(DIMENSIONS.length - 1)}
              className="font-semibold"
            >
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-full py-6 font-bold shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30 transition-all hover:scale-[1.02]"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Computing readiness...</>
              ) : (
                'Complete Check-in ✨'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Rating steps
  const Icon = currentDim.icon;
  const currentValue = values[currentDim.key];

  return (
    <Card className="overflow-hidden rounded-3xl border-0 shadow-xl">
      <CardHeader className={`bg-gradient-to-r ${currentDim.color} text-white pb-8`}>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Icon className="w-5 h-5" /> {currentDim.label}
            </CardTitle>
            <CardDescription className="text-white/80 mt-1">
              Step {step + 1} of {DIMENSIONS.length}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {DIMENSIONS.map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i <= step ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              {currentDim.question}
            </p>

            {/* Emoji display */}
            <div className="text-center">
              <motion.span
                key={currentValue}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="text-5xl inline-block"
              >
                {EMOJIS[currentValue - 1]}
              </motion.span>
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={currentValue}
                onChange={e => handleSliderChange(parseInt(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer accent-current"
                style={{
                  background: `linear-gradient(to right, ${
                    currentDim.key === 'stress' ? '#f59e0b' : '#10b981'
                  } 0%, ${
                    currentDim.key === 'stress' ? '#ef4444' : '#059669'
                  } 100%)`
                }}
              />
              <div className="flex justify-between text-xs font-medium text-gray-500">
                <span>{currentDim.low}</span>
                <span className="font-bold text-lg text-gray-800 dark:text-gray-200">{currentValue}/5</span>
                <span>{currentDim.high}</span>
              </div>
            </div>

            {/* Quick select buttons */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(v => (
                <button
                  key={v}
                  onClick={() => handleSliderChange(v)}
                  className={`w-12 h-12 rounded-2xl font-bold text-lg transition-all ${
                    currentValue === v
                      ? `${currentDim.bg} ${currentDim.accent} ring-2 ring-current scale-110`
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-3 pt-2">
          <Button
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep(prev => prev - 1)}
            className="font-semibold"
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            className={`flex-1 bg-gradient-to-r ${currentDim.color} text-white rounded-full py-6 font-bold shadow-lg transition-all hover:scale-[1.02]`}
          >
            {isLastStep ? 'Almost done →' : 'Next →'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
