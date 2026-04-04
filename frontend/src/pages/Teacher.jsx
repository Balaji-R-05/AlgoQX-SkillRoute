import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Send, Loader2, Volume2, Sparkles, User, BrainCircuit } from 'lucide-react';
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
      id: 'greeting',
      role: 'ai',
      text: "Hello! I'm Nephele, your AI Teaching Assistant. I can help you understand difficult concepts, provide study strategies, or answer general academic questions. What would you like to learn today?",
      audio: null
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-28 pb-8 flex flex-col">
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
        <div className="flex-1 bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden flex flex-col">
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
      </main>
    </div>
  );
}
