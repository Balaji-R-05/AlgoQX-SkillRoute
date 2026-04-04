import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { FloatingHeader } from '../components/ui/floating-header';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Briefcase, Code, Brain, Target, Users, FileText,
  ChevronRight, TrendingUp, Zap, Calendar, Award, BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function PlacementPrep() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [masteryData, setMasteryData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [intRes, readRes, masteryRes] = await Promise.allSettled([
        axios.get(`${API}/api/interviews`, { headers }),
        axios.get(`${API}/api/wellness/today`, { headers }),
        axios.get(`${API}/api/quiz/mastery`, { headers }),
      ]);

      if (intRes.status === 'fulfilled') {
        setInterviews(intRes.value.data || []);
      }
      if (readRes.status === 'fulfilled') {
        setReadiness(readRes.value.data?.readiness || readRes.value.data);
      }
      if (masteryRes.status === 'fulfilled') {
        setMasteryData(masteryRes.value.data || {});
      }
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryReadiness = (topics) => {
    const scores = [];
    topics.forEach(topic => {
      if (masteryData[topic] && masteryData[topic].total > 0) {
        scores.push((masteryData[topic].correct / masteryData[topic].total) * 100);
      }
    });
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  };

  const getFocusPriority = () => {
    const priorities = [];
    Object.entries(masteryData).forEach(([topic, data]) => {
      if (data.total > 0) {
        const score = (data.correct / data.total) * 100;
        if (score < 70) {
          priorities.push({ topic, score: Math.round(score), total: data.total });
        }
      }
    });
    // Add default priorities if none found
    if (priorities.length === 0) {
      return [
        { topic: 'DSA Fundamentals', score: 0, total: 0 },
        { topic: 'System Design', score: 0, total: 0 }
      ];
    }
    return priorities.sort((a, b) => a.score - b.score).slice(0, 3);
  };

  const priorities = getFocusPriority();

  const prepAreas = [
    { 
      name: 'DSA & Coding', 
      icon: Code, 
      color: 'text-blue-500', 
      bgColor: 'bg-blue-50 dark:bg-blue-950/30', 
      readiness: getCategoryReadiness(['Data Structures', 'Algorithms', 'Competitive Programming']) || 65 
    },
    { 
      name: 'Technical Concepts', 
      icon: Brain, 
      color: 'text-purple-500', 
      bgColor: 'bg-purple-50 dark:bg-purple-950/30', 
      readiness: getCategoryReadiness(['Operating Systems', 'DBMS', 'Computer Networks', 'Java', 'Python', 'Web Development']) || 55 
    },
    { 
      name: 'Aptitude', 
      icon: Zap, 
      color: 'text-amber-500', 
      bgColor: 'bg-amber-50 dark:bg-amber-950/30', 
      readiness: getCategoryReadiness(['Aptitude', 'Mathematics', 'Logical Reasoning']) || 70 
    },
    { 
      name: 'Communication', 
      icon: Users, 
      color: 'text-teal-500', 
      bgColor: 'bg-teal-50 dark:bg-teal-950/30', 
      readiness: 80 
    },
  ];

  const avgInterviewScore = interviews.length > 0
    ? Math.round(interviews.filter(i => i.status === 'completed').reduce((sum, i) => sum + (i.final_score || 0), 0) / Math.max(interviews.filter(i => i.status === 'completed').length, 1))
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-violet-50/20 to-gray-50 dark:from-black dark:via-zinc-950 dark:to-black">
      <FloatingHeader onLogout={logout} />
      <main className="max-w-5xl mx-auto px-4 py-8 pt-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Briefcase className="h-8 w-8 text-violet-500" />
              Placement Preparation
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Sharpen your coding skills, ace interviews, and land your dream role.
            </p>
          </div>

          {/* Strategic Roadmap - NEW */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card className="lg:col-span-2 border-4 border-black dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-none overflow-hidden hover:translate-x-1 hover:translate-y-1 transition-transform">
              <CardHeader className="bg-violet-500 text-white border-b-4 border-black">
                <CardTitle className="text-xl flex items-center gap-2 font-black uppercase italic tracking-tighter">
                  <TrendingUp className="h-6 w-6" />
                  AI Placement Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-black uppercase text-zinc-500 mb-3 flex items-center gap-2">
                       <Zap className="h-4 w-4 text-amber-500" /> High-Impact Focus Areas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {priorities.map((p, idx) => (
                        <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border-2 border-black flex flex-col justify-between">
                          <span className="font-black text-xs uppercase tracking-tight truncate">{p.topic}</span>
                          <div className="mt-4">
                            <span className="text-2xl font-black text-violet-600 dark:text-violet-400">{p.score}%</span>
                            <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-violet-500" style={{ width: `${p.score}%` }} />
                            </div>
                            <p className="text-[10px] font-bold text-zinc-500 mt-2">Critical gap detected</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-black rounded-2xl">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-200 leading-relaxed italic">
                      "Strategic Insight: Your {priorities[0]?.topic} mastery is currently below the 70% threshold. Focus on breadth of patterns rather than depth until you hit 85% to maximize interview coverage."
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-4 border-black dark:border-zinc-800 bg-[#bae6fd] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-none hover:-translate-x-1 hover:translate-y-1 transition-transform">
               <CardHeader className="border-b-4 border-black">
                 <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    <Target className="h-5 w-5" /> Recommended Today
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-4">
                 <div className="p-3 bg-white border-2 border-black rounded-xl">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Goal 1</p>
                    <p className="font-black text-sm text-zinc-900">3 Hard DSA Problems</p>
                 </div>
                 <div className="p-3 bg-white border-2 border-black rounded-xl">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Goal 2</p>
                    <p className="font-black text-sm text-zinc-900">1 System Design Module</p>
                 </div>
                 <div className="p-3 bg-white border-2 border-black rounded-xl opacity-60">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Goal 3</p>
                    <p className="font-black text-sm text-zinc-900">30 Min Logical Reasoning</p>
                 </div>
                 <Button className="w-full bg-black text-white rounded-xl font-bold uppercase tracking-widest h-12 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.5)]">
                   Execute Strategy
                 </Button>
               </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Button
              onClick={() => navigate('/mock-interview')}
              className="h-auto py-5 flex flex-col items-center gap-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg"
            >
              <Brain className="h-7 w-7" />
              <span className="text-sm font-semibold">Start Mock Interview</span>
              <span className="text-xs opacity-80">AI-powered adaptive practice</span>
            </Button>
            <Button
              onClick={() => navigate('/schedules')}
              variant="outline"
              className="h-auto py-5 flex flex-col items-center gap-2 rounded-xl border-dashed"
            >
              <Calendar className="h-6 w-6 text-violet-500" />
              <span className="text-sm font-medium">Create Prep Schedule</span>
            </Button>
            <Button
              onClick={() => navigate('/resources')}
              variant="outline"
              className="h-auto py-5 flex flex-col items-center gap-2 rounded-xl border-dashed"
            >
              <FileText className="h-6 w-6 text-teal-500" />
              <span className="text-sm font-medium">Practice Resources</span>
            </Button>
          </div>

          {/* Preparation Areas */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Preparation Areas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {prepAreas.map((area, i) => (
                <motion.div
                  key={area.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="border-0 shadow-md dark:bg-zinc-900/80 hover:shadow-lg transition-all cursor-pointer">
                    <CardContent className="py-4 text-center">
                      <div className={`h-12 w-12 rounded-xl ${area.bgColor} flex items-center justify-center mx-auto mb-2`}>
                        <area.icon className={`h-6 w-6 ${area.color}`} />
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{area.name}</p>
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${area.readiness}%` }}
                          transition={{ delay: i * 0.1 + 0.3, duration: 0.6 }}
                          className={`h-full rounded-full ${
                            area.readiness >= 70 ? 'bg-emerald-500' :
                            area.readiness >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{area.readiness}%</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Interview Performance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card className="border-0 shadow-md dark:bg-zinc-900/80">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-violet-500" />
                  Interview Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {interviews.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-center pb-3 border-b border-gray-100 dark:border-zinc-800">
                      <p className="text-4xl font-bold text-violet-600">{avgInterviewScore || '—'}</p>
                      <p className="text-xs text-gray-500">Avg Interview Score</p>
                      <p className="text-xs text-gray-400 mt-1">{interviews.filter(i => i.status === 'completed').length} completed</p>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {interviews.slice(0, 5).map((int, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400 capitalize">{int.interview_type}</span>
                          <span className={`font-medium ${
                            int.final_score >= 70 ? 'text-emerald-500' :
                            int.final_score >= 40 ? 'text-amber-500' : 'text-red-500'
                          }`}>
                            {int.status === 'completed' ? `${int.final_score}/100` : 'In progress'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Brain className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">No interviews yet</p>
                    <Button
                      onClick={() => navigate('/mock-interview')}
                      size="sm"
                      className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
                    >
                      Start Your First Interview
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Company Targets */}
            <Card className="border-0 shadow-md dark:bg-zinc-900/80">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-violet-500" />
                  Company Targets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    Add your target companies in your profile to get personalized preparation guidance.
                  </p>
                  <Button
                    onClick={() => navigate('/profile')}
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl"
                  >
                    <span className="flex items-center gap-2">
                      Update Profile <ChevronRight className="h-4 w-4" />
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Readiness Summary */}
          {readiness && (
            <Card className="border-0 shadow-md dark:bg-zinc-900/80">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-violet-500" />
                  Placement Readiness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-violet-600">{readiness.composite_score || '—'}</p>
                    <p className="text-xs text-gray-500">Overall Readiness</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{readiness.stress_level || '—'}</p>
                    <p className="text-xs text-gray-500">Stress Level</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-teal-600">{avgInterviewScore || '—'}</p>
                    <p className="text-xs text-gray-500">Interview Avg</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>
    </div>
  );
}
