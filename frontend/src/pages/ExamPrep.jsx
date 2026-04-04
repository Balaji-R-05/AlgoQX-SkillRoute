import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { FloatingHeader } from '../components/ui/floating-header';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  GraduationCap, BookOpen, Clock, Target, AlertTriangle,
  CheckCircle2, Calendar, TrendingUp, ChevronRight, Brain
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ExamPrep() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [schedRes, readRes] = await Promise.allSettled([
        axios.get(`${API}/api/schedules/active/all`, { headers }),
        axios.get(`${API}/api/wellness/today`, { headers }),
      ]);

      if (schedRes.status === 'fulfilled') {
        // Filter exam-related schedules
        const allSchedules = schedRes.value.data?.schedules || schedRes.value.data || [];
        setSchedules(Array.isArray(allSchedules) ? allSchedules : []);
      }
      if (readRes.status === 'fulfilled') {
        setReadiness(readRes.value.data?.readiness || readRes.value.data);
      }
    } catch (e) {
      console.error('Failed to load exam prep data', e);
    } finally {
      setLoading(false);
    }
  };

  const examSubjects = [
    { name: 'Data Structures', readiness: 72, status: 'on-track', weakTopics: ['AVL Trees', 'Graph Algorithms'] },
    { name: 'Operating Systems', readiness: 45, status: 'needs-attention', weakTopics: ['Deadlocks', 'Virtual Memory'] },
    { name: 'Database Systems', readiness: 85, status: 'strong', weakTopics: [] },
    { name: 'Computer Networks', readiness: 58, status: 'moderate', weakTopics: ['TCP/IP', 'Subnetting'] },
  ];

  const getStatusColor = (status) => ({
    'strong': 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
    'on-track': 'text-blue-500 bg-blue-50 dark:bg-blue-950/30',
    'moderate': 'text-amber-500 bg-amber-50 dark:bg-amber-950/30',
    'needs-attention': 'text-red-500 bg-red-50 dark:bg-red-950/30',
  }[status] || 'text-gray-500 bg-gray-50 dark:bg-gray-800');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/20 to-gray-50 dark:from-black dark:via-zinc-950 dark:to-black">
      <FloatingHeader onLogout={logout} />
      <main className="max-w-5xl mx-auto px-4 py-8 pt-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-indigo-500" />
              Exam Preparation
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Track your subjects, identify weak areas, and build a focused revision plan.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Button
              onClick={() => navigate('/schedules')}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 rounded-xl border-dashed"
            >
              <Calendar className="h-6 w-6 text-indigo-500" />
              <span className="text-sm font-medium">Create Exam Schedule</span>
            </Button>
            <Button
              onClick={() => navigate('/resources')}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 rounded-xl border-dashed"
            >
              <BookOpen className="h-6 w-6 text-teal-500" />
              <span className="text-sm font-medium">Study Resources</span>
            </Button>
            <Button
              onClick={() => navigate('/analytics')}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 rounded-xl border-dashed"
            >
              <TrendingUp className="h-6 w-6 text-blue-500" />
              <span className="text-sm font-medium">View Progress</span>
            </Button>
          </div>

          {/* Subject Readiness Cards */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Subject Readiness</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {examSubjects.map((subj, i) => (
                <motion.div
                  key={subj.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="border-0 shadow-md dark:bg-zinc-900/80 hover:shadow-lg transition-shadow">
                    <CardContent className="pt-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{subj.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(subj.status)}`}>
                          {subj.status.replace('-', ' ')}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 bg-gray-100 dark:bg-zinc-800 rounded-full mb-3">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${subj.readiness}%` }}
                          transition={{ delay: i * 0.1 + 0.3, duration: 0.8 }}
                          className={`h-full rounded-full ${
                            subj.readiness >= 80 ? 'bg-emerald-500' :
                            subj.readiness >= 60 ? 'bg-blue-500' :
                            subj.readiness >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{subj.readiness}% ready</span>
                        {subj.weakTopics.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            {subj.weakTopics.length} weak topic{subj.weakTopics.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>

                      {subj.weakTopics.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {subj.weakTopics.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs rounded-full">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Active Exam Schedules */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Exam Schedules</h2>
            {schedules.length > 0 ? (
              <div className="space-y-3">
                {schedules.map((s, i) => (
                  <Card key={s.id || i} className="border-0 shadow-md dark:bg-zinc-900/80">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{s.title || s.event_name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {s.event_date && `Exam: ${new Date(s.event_date).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/schedules')}
                          className="text-indigo-500 hover:text-indigo-600"
                        >
                          View <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-0 shadow-md dark:bg-zinc-900/80">
                <CardContent className="py-8 text-center">
                  <Calendar className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No active exam schedules yet</p>
                  <Button
                    onClick={() => navigate('/schedules')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                  >
                    Create Exam Schedule
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Readiness Summary */}
          {readiness && (
            <Card className="border-0 shadow-md dark:bg-zinc-900/80">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-indigo-500" />
                  Today's Readiness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-indigo-600">{readiness.composite_score || '—'}</p>
                    <p className="text-xs text-gray-500">Readiness Score</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{readiness.stress_level || '—'}</p>
                    <p className="text-xs text-gray-500">Stress Level</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-teal-600">{readiness.gap_label || '—'}</p>
                    <p className="text-xs text-gray-500">Gap Status</p>
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
