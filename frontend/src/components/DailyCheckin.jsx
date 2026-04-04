import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  HelpCircle, 
  ArrowRight, 
  Trophy, 
  AlertCircle,
  Loader2,
  Clock
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function DailyCheckin() {
  const { user, idToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [checkin, setCheckin] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user && idToken) {
      fetchTodayCheckin();
    } else {
      setLoading(false);
    }
  }, [user, idToken]);

  const fetchTodayCheckin = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/schedules/checkin/today`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      
      if (response.data.status === 'no_plan_for_today') {
        setCheckin({ no_plan: true });
      } else {
        setCheckin(response.data);
        if (response.data.is_completed) {
          setResult(response.data.results_json);
        }
      }
    } catch (err) {
      console.error("Checkin fetch failed:", err);
      setError("Unable to find an active study plan for today.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (option) => {
    const q_id = checkin.mcq_json[currentQuestion].id;
    setAnswers(prev => ({ ...prev, [q_id]: option }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/schedules/checkin/complete`, {
        checkin_id: checkin.id,
        answers: answers
      }, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      
      setResult(response.data);
    } catch (err) {
      console.error("Submission failed:", err);
      alert("Failed to submit check-in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="p-8 border-4 border-black bg-white flex justify-center">
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

  if (result) return (
    <Card className="glass-card rounded-3xl overflow-hidden animate-scale-in">
      <CardHeader className="bg-emerald-500 border-b-4 border-black text-white">
        <CardTitle className="text-2xl font-black uppercase flex items-center gap-2">
          <Trophy className="w-6 h-6" /> Daily Mastery
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 text-center space-y-4">
        <div className="inline-block p-4 border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-5xl font-black">{result.score}/{result.total}</p>
          <p className="text-sm font-black uppercase text-gray-500">Correct Today</p>
        </div>
        <p className="text-lg font-bold italic">
          {result.score === 5 ? "Flawless! You're crushing it!" : 
           result.score >= 3 ? "Solid work! You've got the core concepts." : 
           "Keep grinding! Reviewing today's topics will help."}
        </p>
        <Button 
          onClick={() => window.location.reload()}
          className="bg-black text-white hover:bg-emerald-600 border-4 border-black font-black uppercase rounded-none"
        >
          Back to Dashboard
        </Button>
      </CardContent>
    </Card>
  );

  const currentQ = checkin.mcq_json[currentQuestion];

  return (
    <Card className="glass-card rounded-3xl overflow-hidden animate-scale-in">
      <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-600 border-none text-white">
        <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
          <HelpCircle className="w-5 h-5" /> Today's Check-in
        </CardTitle>
        <CardDescription className="text-white font-bold opacity-80">
          Question {currentQuestion + 1} of 5
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="p-6 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700 font-semibold text-lg animate-slide-right">
          {currentQ.question}
        </div>

        <div className="grid grid-cols-1 gap-3">
          {Object.entries(currentQ.options).map(([key, value]) => (
            <button
              key={key}
              onClick={() => handleAnswer(key)}
              className={`p-5 rounded-2xl border-2 font-bold text-left transition-all duration-300 ${answers[currentQ.id] === key ? 'bg-indigo-50 border-indigo-600 shadow-lg shadow-indigo-200/50' : 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 hover:border-indigo-200 hover:shadow-md'}`}
            >
              <span className="inline-block w-8 text-indigo-600">{key}:</span> {value}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4">
          <Button 
            variant="ghost" 
            disabled={currentQuestion === 0}
            onClick={() => setCurrentQuestion(prev => prev - 1)}
            className="font-black uppercase"
          >
            Prev
          </Button>
          
          {currentQuestion < 4 ? (
            <Button 
              onClick={() => setCurrentQuestion(prev => prev + 1)}
              disabled={!answers[currentQ.id]}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold px-8 shadow-lg shadow-blue-200/50"
            >
              Next <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit}
              disabled={!answers[currentQ.id] || isSubmitting}
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-8 py-6 font-bold shadow-lg shadow-emerald-200/50 transition-all hover:scale-105"
            >
              {isSubmitting ? "Submitting..." : "Finish Check-in"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
