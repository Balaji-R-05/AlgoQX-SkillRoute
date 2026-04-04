import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Send, Loader2, Volume2, Sparkles, User, BrainCircuit, Target, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { FloatingHeader } from '../components/ui/floating-header';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Teacher() {
  const { user, idToken } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'ai',
      text: "Hello! I'm Nephele, your AI academic tutor. How can I help you today? We can dive into a specific topic, or you can use the focus tools on the right to start a study session.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pomodoro, setPomodoro] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (timerActive && pomodoro > 0) {
      timerRef.current = setInterval(() => setPomodoro(p => p - 1), 1000);
    } else {
      clearInterval(timerRef.current);
      if (pomodoro === 0) setTimerActive(false);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive, pomodoro]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!input.trim() || !user) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/teaching/general`,
        { question: userMessage.text },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: response.data.answer || "I'm sorry, I couldn't process that.",
        audio: response.data.audio_file
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Failed to query teacher:", error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: "I seem to be having trouble connecting to my knowledge base right now. Please try again later.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <FloatingHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 pt-28 pb-8 flex flex-col lg:flex-row gap-6">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
                <BrainCircuit className="w-8 h-8 text-indigo-600" />
                Nephele AI Tutor
              </h1>
              <p className="text-gray-500 mt-1">Your personal academic guide and mentor</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-800">Available 24/7</span>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="flex-1 bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[500px]">
            {/* Chat History */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-gray-50 space-y-6">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] sm:max-w-[70%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-600' 
                        : 'bg-indigo-600'
                    }`}>
                      {msg.role === 'user' 
                        ? <User className="w-5 h-5 text-white" /> 
                        : <BookOpen className="w-5 h-5 text-white" />
                      }
                    </div>
                    
                    {/* Bubble */}
                    <div className={`space-y-2`}>
                      <div className={`px-5 py-3.5 shadow-sm whitespace-pre-wrap leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                      {/* Audio Player if exists */}
                      {msg.audio && (
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-2 shadow-sm">
                          <Volume2 className="w-4 h-4 text-indigo-600" />
                          <audio 
                            controls
                            className="h-8 max-w-[200px] sm:max-w-[250px]"
                            src={`${API_BASE_URL}/api/teaching/audio/${msg.audio}`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[85%] sm:max-w-[70%]">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm flex items-center gap-2">
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                      <span className="text-gray-500 font-medium text-sm">Nephele is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
              <form onSubmit={handleSubmit} className="relative flex items-center">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask your tutor anything..."
                  className="w-full bg-gray-50 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-full pr-14 py-6 text-gray-800"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 rounded-full w-10 h-10 p-0 bg-indigo-600 hover:bg-indigo-700 text-white transition-transform active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Sidebar Tools - NEW */}
        <aside className="w-full lg:w-80 space-y-6">
          {/* Pomodoro Timer */}
          <div className="bg-white border-4 border-black p-6 rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
             <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Target className="w-4 h-4 text-red-600" />
                </div>
                <h3 className="font-black uppercase tracking-tight text-sm">Focus Timer</h3>
             </div>
             <div className="text-center py-4">
                <div className="text-5xl font-black tabular-nums tracking-tighter mb-4">{formatTime(pomodoro)}</div>
                <div className="flex gap-2 justify-center">
                  <Button 
                    onClick={() => setTimerActive(!timerActive)}
                    className={`rounded-xl font-bold uppercase tracking-widest ${timerActive ? 'bg-zinc-100 text-black border-2 border-black' : 'bg-red-500 text-white border-2 border-black'}`}
                  >
                    {timerActive ? 'Pause' : 'Start Focus'}
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => { setTimerActive(false); setPomodoro(25 * 60); }}
                    className="font-bold underline text-xs"
                  >
                    Reset
                  </Button>
                </div>
             </div>
          </div>

          {/* Study Guidance */}
          <div className="bg-indigo-600 text-white border-4 border-black p-6 rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
             <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-indigo-200" />
                <h3 className="font-black uppercase tracking-tight text-sm">Study Guidance</h3>
             </div>
             <div className="space-y-3">
                <div className="p-3 bg-white/10 rounded-xl border border-white/20">
                   <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Active Recall</p>
                   <p className="text-xs font-medium">Try to summarize the last concept you learned without looking at your notes.</p>
                </div>
                <div className="p-3 bg-white/10 rounded-xl border border-white/20">
                   <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Spaced Repetition</p>
                   <p className="text-xs font-medium">I'll remind you to review this topic again in 2 days for maximum retention.</p>
                </div>
                <div className="p-3 bg-white/10 rounded-xl border border-white/20">
                   <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Relaxation Tip</p>
                   <p className="text-xs font-medium">Feeling stuck? Try a 4-7-8 breathing reset to clear cortisol.</p>
                </div>
             </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
