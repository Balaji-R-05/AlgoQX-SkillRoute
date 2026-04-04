import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  BookOpen, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Save,
  Target
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { FloatingHeader } from '../components/ui/floating-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ScheduleGenerator() {
  const { user, idToken, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState([]);
  const [selectedResources, setSelectedResources] = useState([]);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('exam');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [manualSyllabus, setManualSyllabus] = useState('');
  const [days, setDays] = useState(30);
  const [dailyHours, setDailyHours] = useState(2);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const navigate = useNavigate();

  const fetchResources = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/api/resources/`, {
        headers: { 
          'x-user-id': user.uid,
          ...(idToken && { Authorization: `Bearer ${idToken}` })
        }
      });
      setResources(response.data);
    } catch (err) {
      console.error("Error fetching resources:", err);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        fetchResources();
      } else {
        setLoading(false);
      }
    }
  }, [user, idToken, authLoading]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      if (!user || !idToken) {
        alert("Please wait for authentication to complete.");
        return;
      }
      
      let syllabusText = manualSyllabus;
      if (selectedResources.length > 0) {
        const selectedTitles = resources
          .filter(r => selectedResources.includes(r.id))
          .map(r => r.title)
          .join(", ");
        syllabusText = `Focus on materials: ${selectedTitles}. ${manualSyllabus}`;
      }

      const response = await axios.post(`${API_BASE_URL}/api/schedules/generate`, {
        event_name: eventName,
        event_date: eventDate,
        event_type: eventType,
        additional_notes: additionalNotes,
        syllabus: syllabusText,
        days: parseInt(days),
        daily_hours: parseInt(dailyHours)
      }, {
        headers: { 
          Authorization: `Bearer ${idToken}`,
          'x-user-id': user.uid 
        }
      });
      
      setGeneratedPlan(response.data);
      setStep(3);
    } catch (err) {
      console.error("Failed to generate schedule:", err);
      alert("Failed to generate schedule. Check backend or logs.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (!user || !idToken) return;
      
      const end_date = new Date(startDate);
      end_date.setDate(end_date.getDate() + parseInt(days));

      await axios.post(`${API_BASE_URL}/api/schedules/save`, {
        title: eventName || `Plan for ${manualSyllabus.substring(0, 20)}...`,
        event_name: eventName,
        event_date: eventDate,
        syllabus_content: manualSyllabus,
        start_date: startDate,
        end_date: end_date.toISOString().split('T')[0],
        daily_hours: parseInt(dailyHours),
        schedule_json: generatedPlan.daily_plans
      }, {
        headers: { 
          Authorization: `Bearer ${idToken}`,
          'x-user-id': user.uid
        }
      });
      
      navigate('/dashboard');
    } catch (err) {
      console.error("Failed to save schedule:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleResource = (id) => {
    setSelectedResources(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-[#FDFCF6] text-black font-sans pb-20">
      <FloatingHeader />
      
      <div className="max-w-4xl mx-auto px-4 pt-24 sm:pt-32">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Schedule <span className="text-blue-600">Architect</span>
            </h1>
            <p className="text-lg font-bold text-gray-600 uppercase">Phase 2: Short-term Study Planning</p>
          </div>
          <div className="hidden sm:flex gap-2">
            {[1, 2, 3].map(i => (
              <div 
                key={i}
                className={`w-10 h-10 flex items-center justify-center border-2 rounded-full font-bold text-lg transition-all ${step >= i ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-gray-200 text-gray-400'}`}
              >
                {i}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="glass-card rounded-3xl overflow-hidden shadow-2xl">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white">
                  <CardTitle className="text-2xl font-black uppercase flex items-center gap-2">
                    <BookOpen className="w-6 h-6" /> 1. Prime the Syllabus
                  </CardTitle>
                  <CardDescription className="text-white font-bold opacity-90 italic">
                    Select study materials or describe what you need to learn.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-black uppercase mb-1">Event Name</label>
                        <Input 
                          placeholder="e.g. SDE-1 Interview at Google" 
                          value={eventName}
                          onChange={(e) => setEventName(e.target.value)}
                          className="rounded-xl border border-gray-200 h-12 font-medium"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-black uppercase mb-1">Type</label>
                          <select 
                            value={eventType}
                            onChange={(e) => setEventType(e.target.value)}
                            className="w-full h-12 rounded-xl border border-gray-200 px-3 font-bold bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="exam">Exam</option>
                            <option value="interview">Interview</option>
                            <option value="general">General</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-black uppercase mb-1">Deadline</label>
                          <Input 
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="rounded-xl border border-gray-200 h-12 font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-black uppercase mb-1">My Resources</label>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto p-1 border rounded-xl bg-gray-50/50">
                          {resources.length === 0 && (
                            <p className="text-xs font-bold text-gray-400 p-2 italic text-center">No resources in Hub yet.</p>
                          )}
                          {resources.map(res => (
                            <div 
                              key={res.id}
                              onClick={() => toggleResource(res.id)}
                              className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${selectedResources.includes(res.id) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}
                            >
                              <div className={`w-3 h-3 rounded-full border ${selectedResources.includes(res.id) ? 'bg-blue-600' : 'border-gray-400'}`} />
                              <span className="truncate text-xs font-bold">{res.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-black uppercase mb-1">Syllabus / Topics</label>
                        <Textarea 
                          placeholder="Paste syllabus text here..." 
                          className="rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 font-medium h-[110px]"
                          value={manualSyllabus}
                          onChange={(e) => setManualSyllabus(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-black uppercase mb-1">Additional Notes (Optional)</label>
                        <Textarea 
                          placeholder="Specific requirements, interview tips, etc." 
                          className="rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 font-medium h-[80px]"
                          value={additionalNotes}
                          onChange={(e) => setAdditionalNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={() => setStep(2)}
                    disabled={!manualSyllabus && selectedResources.length === 0}
                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-xl uppercase shadow-lg shadow-blue-200/50"
                  >
                    Set Targets <ChevronRight className="ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="glass-card rounded-3xl overflow-hidden shadow-2xl animate-scale-in">
                <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 border-none text-white">
                  <CardTitle className="text-2xl font-black uppercase flex items-center gap-2">
                    <Target className="w-6 h-6" /> 2. Set Your Goals
                  </CardTitle>
                  <CardDescription className="text-white font-bold opacity-90 italic">
                    Tell us your timeline and daily availability.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-black uppercase">Start Date</label>
                      <Input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-xl border border-gray-200 h-12 font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-black uppercase">Study Duration (Days)</label>
                      <Input 
                        type="number"
                        min="1"
                        max="365"
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                        className="rounded-xl border border-gray-200 h-12 font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-black uppercase">Daily Commitment (Hours)</label>
                      <span className="text-xl font-black">{dailyHours} HRS</span>
                    </div>
                    <input 
                      type="range"
                      min="1"
                      max="12"
                      value={dailyHours}
                      onChange={(e) => setDailyHours(e.target.value)}
                      className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs font-black text-gray-500">
                      <span>Casual (1h)</span>
                      <span>Balanced (4h)</span>
                      <span>Intense (8h)</span>
                      <span>Executioner (12h)</span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button 
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1 h-14 rounded-full border border-gray-200 font-bold text-xl uppercase hover:bg-gray-50 shadow-md"
                    >
                      <ChevronLeft className="mr-2" /> Back
                    </Button>
                    <Button 
                      onClick={handleGenerate}
                      disabled={loading}
                      className="flex-[2] h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-xl uppercase shadow-lg shadow-blue-200/50"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <><Sparkles className="mr-2" /> Generate Schedule</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 3 && generatedPlan && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <Card className="glass-card rounded-3xl overflow-hidden shadow-2xl animate-scale-in">
                <CardHeader className="bg-zinc-900 border-none text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-black uppercase flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" /> {generatedPlan.title}
                      </CardTitle>
                      <CardDescription className="text-white font-bold opacity-90 italic">
                        Confirm your {days}-day plan. Check-ins start tomorrow.
                      </CardDescription>
                    </div>
                    <div className="bg-indigo-500 p-2 border-2 border-white font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
                      {dailyHours}h Daily
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {generatedPlan.daily_plans && generatedPlan.daily_plans.map((dayPlan, index) => (
                      <div key={index} className="border border-gray-100 p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all">
                        <div className="flex justify-between items-start mb-4">
                           <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">Day {dayPlan.day}</span>
                           <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${dayPlan.priority === 'high' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                             {dayPlan.priority} priority
                           </span>
                        </div>
                        <h4 className="text-lg font-black uppercase leading-tight mb-2">{dayPlan.topic}</h4>
                        <ul className="space-y-2">
                          {dayPlan.tasks.map((task, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm font-bold text-gray-600">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                              {task}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    
                    {generatedPlan.exam_readiness_tips && (
                      <div className="mt-6 p-6 rounded-2xl bg-indigo-50 border-2 border-indigo-200">
                        <h4 className="text-lg font-black uppercase mb-3 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-indigo-600" /> AI Strategic Tips
                        </h4>
                        <ul className="space-y-2">
                          {generatedPlan.exam_readiness_tips.map((tip, i) => (
                            <li key={i} className="text-sm font-bold text-indigo-900 flex items-start gap-2">
                              <span>✨</span> {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex gap-4">
                    <Button 
                      variant="outline"
                      onClick={() => setStep(2)}
                      className="flex-1 h-14 border-4 border-black rounded-none font-black text-xl uppercase hover:bg-gray-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    >
                      <ChevronLeft className="mr-2" /> Adjust
                    </Button>
                    <Button 
                      onClick={handleSave}
                      disabled={loading}
                      className="flex-[2] h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold text-xl uppercase shadow-lg shadow-indigo-200/50"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <><Save className="mr-2" /> Activate Plan</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
