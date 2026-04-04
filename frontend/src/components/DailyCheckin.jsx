import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  HelpCircle, 
  ArrowRight, 
  Trophy, 
  AlertCircle,
  Loader2,
  Clock,
  Zap,
  TrendingUp
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import WellnessCheckin from './WellnessCheckin';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function DailyCheckin() {
  const { user, idToken } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // MCQ Data
  const [checkin, setCheckin] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mcqResult, setMcqResult] = useState(null);
  const [error, setError] = useState(null);

  // Wellness Data
  const [wellnessDone, setWellnessDone] = useState(false);
  const [readinessData, setReadinessData] = useState(null);

  useEffect(() => {
    if (user && idToken) {
      fetchTodayData();
    } else {
      setLoading(false);
    }
  }, [user, idToken]);

  const fetchTodayData = async () => {
    setLoading(true);
    try {
      // Fetch both wellness and schedule states concurrently
      const [schedRes, wellRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/schedules/checkin/today`, {
          headers: { Authorization: `Bearer ${idToken}` }
        }),
        axios.get(`${API_BASE_URL}/api/wellness/today`, {
          headers: { Authorization: `Bearer ${idToken}` }
        })
      ]);
      
      // Handle MCQ state
      if (schedRes.data.status === 'no_plan_for_today') {
        setCheckin({ no_plan: true });
      } else {
        setCheckin(schedRes.data);
        if (schedRes.data.is_completed) {
          setMcqResult(schedRes.data.results_json);
        }
      }

      // Handle Wellness state
      if (wellRes.data.has_checked_in) {
        setWellnessDone(true);
        setReadinessData(wellRes.data.readiness);
      }
      
    } catch (err) {
      console.error("Checkin fetch failed:", err);
      // Wait, 404 from checkin/today means no active schedule usually.
      if (err.response && err.response.status === 404) {
         setCheckin({ no_plan: true });
      } else {
         setError("Unable to load daily check-in data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWellnessComplete = (data) => {
    setWellnessDone(true);
    setReadinessData(data.readiness);
  };

  const handleAnswer = (option) => {
    const q_id = checkin.mcq_json[currentQuestion].id;
    setAnswers(prev => ({ ...prev, [q_id]: option }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // 1. Submit MCQs
      const mcqResponse = await axios.post(`${API_BASE_URL}/api/schedules/checkin/complete`, {
        checkin_id: checkin.id,
        answers: answers
      }, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      
      setMcqResult(mcqResponse.data);

      // 2. Refresh readiness snapshot to include the newly solved MCQs
      const readinessResp = await axios.post(`${API_BASE_URL}/api/wellness/readiness`, {}, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      
      setReadinessData(readinessResp.data);

    } catch (err) {
      console.error("Submission failed:", err);
      alert("Failed to submit check-in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="p-8 border-4 border-black bg-white flex justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <Loader2 className="animate-spin w-8 h-8 text-indigo-600" />
    </div>
  );

  if (error || (checkin && checkin.no_plan)) return (
    <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none">
      <CardHeader className="bg-gray-100 border-b-4 border-black">
        <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
          <Clock className="w-5 h-5" /> Today's Check-in
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="font-bold text-gray-600 italic">No study sessions scheduled for today. Take a breather!</p>
      </CardContent>
    </Card>
  );

  // STEP 1: Wellness Checkin
  if (!wellnessDone) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-indigo-600 font-bold px-2 uppercase text-sm tracking-widest">
          <Zap className="w-4 h-4" /> Phase 1: Mind & Body
        </div>
        <WellnessCheckin onComplete={handleWellnessComplete} hideResultScreen={true} />
      </div>
    );
  }

  // STEP 3: Combined Result Screen (After MCQs)
  if (mcqResult) return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-emerald-600 font-bold px-2 uppercase text-sm tracking-widest">
        <CheckCircle2 className="w-4 h-4" /> Daily Mastery Complete
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Readiness Card */}
        <Card className="overflow-hidden rounded-3xl border-0 shadow-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 transform transition-all hover:scale-[1.01]">
          <CardContent className="p-8 space-y-5">
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
              <TrendingUp className="w-5 h-5 text-indigo-500" /> Current Readiness
            </h3>
            <div className="flex items-end gap-2 text-indigo-600 dark:text-indigo-400">
              <span className="font-black text-6xl leading-none">{readinessData?.composite_score || 0}</span>
              <span className="font-bold text-xl pb-1">/ 100</span>
            </div>
            
            {readinessData?.gap_label && readinessData.gap_label !== 'accurate' && (
              <div className={`px-4 py-3 rounded-2xl text-sm font-semibold border ${
                readinessData.gap_label === 'overconfident' 
                  ? 'bg-amber-100/50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-300' 
                  : 'bg-emerald-100/50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-300'
              }`}>
                {readinessData.gap_label === 'overconfident'
                  ? '📉 Score suggests you might have gaps vs how you feel — review the weak areas.'
                  : '📈 You performed stronger than you felt — trust your preparation!'}
              </div>
            )}
            
            {readinessData?.recommendations && readinessData.recommendations.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-400 dark:text-indigo-500">Suggested Focus</p>
                <div className="bg-white/60 dark:bg-zinc-900/50 p-4 rounded-2xl text-sm font-semibold text-indigo-900 dark:text-indigo-100 backdrop-blur-sm border border-indigo-100 dark:border-indigo-900/30">
                  {readinessData.recommendations[0]?.message || "Keep up your consistent work!"}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Academic MCQ Mastery Card */}
        <Card className="glass-card rounded-3xl overflow-hidden border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <CardHeader className="bg-[#bbf7d0] border-b-4 border-black">
            <CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-black">
              <Trophy className="w-5 h-5 text-green-700" /> Academic Mastery
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center flex-1 flex flex-col justify-center gap-4 bg-white">
            <div className="inline-block p-4 border-4 border-black bg-[#fcd34d] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mx-auto transform -rotate-2">
              <p className="text-5xl font-black text-black">{mcqResult.score}/{mcqResult.total}</p>
              <p className="text-xs font-black uppercase tracking-widest text-black/70 mt-1">Today's Score</p>
            </div>
            <p className="text-lg font-bold italic mt-4 text-gray-800">
              {mcqResult.score === 5 ? "Flawless! You're crushing it!" : 
               mcqResult.score >= 3 ? "Solid work! You've got the core concepts." : 
               "Keep grinding! Reviewing today's topics will help."}
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-center pt-4">
        <Button 
          onClick={() => window.location.reload()}
          className="bg-black hover:bg-gray-800 text-white font-bold rounded-full px-8 py-6 shadow-xl transition-all hover:scale-105"
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );

  // STEP 2: Academic MCQs
  const currentQ = checkin.mcq_json[currentQuestion];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-blue-600 font-bold px-2 uppercase text-sm tracking-widest">
        <HelpCircle className="w-4 h-4" /> Phase 2: Academic Check
      </div>
      
      <Card className="glass-card rounded-3xl overflow-hidden shadow-xl border-0 animate-scale-in">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              Knowledge Verification
            </CardTitle>
            <div className="text-sm font-bold bg-white/20 px-3 py-1 rounded-full">
              {currentQuestion + 1} / 5
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 md:p-8 space-y-8">
          <div className="text-lg md:text-xl font-semibold text-gray-800 dark:text-gray-100">
            {currentQ.question}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {Object.entries(currentQ.options).map(([key, value]) => (
              <button
                key={key}
                onClick={() => handleAnswer(key)}
                className={`p-4 md:p-5 rounded-2xl border-2 font-semibold text-left transition-all duration-200 ${
                  answers[currentQ.id] === key 
                    ? 'bg-blue-50 border-blue-500 shadow-md shadow-blue-100 dark:bg-blue-900/30 dark:border-blue-500 dark:shadow-none' 
                    : 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 hover:border-blue-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex gap-4">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-bold shrink-0 ${
                    answers[currentQ.id] === key 
                      ? 'border-blue-500 bg-blue-500 text-white' 
                      : 'border-gray-200 text-gray-500'
                  }`}>
                    {key}
                  </span>
                  <span className="pt-1 text-gray-700 dark:text-gray-300">{value}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-zinc-800">
            <Button 
              variant="ghost" 
              disabled={currentQuestion === 0}
              onClick={() => setCurrentQuestion(prev => prev - 1)}
              className="font-bold text-gray-500"
            >
              Back
            </Button>
            
            {currentQuestion < 4 ? (
              <Button 
                onClick={() => setCurrentQuestion(prev => prev + 1)}
                disabled={!answers[currentQ.id]}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold px-8 shadow-lg shadow-blue-200/50 transition-all active:scale-95 disabled:opacity-50"
              >
                Next <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={!answers[currentQ.id] || isSubmitting}
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-8 py-6 font-bold shadow-lg shadow-emerald-200/50 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <><Loader2 className="animate-spin w-5 h-5 mr-2" /> Processing...</>
                ) : (
                  'Complete Check-in ✨'
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
