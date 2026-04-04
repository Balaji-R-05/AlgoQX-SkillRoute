import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Play, MessageCircle, Volume2, X, Loader2, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * TeachingPanel — slide-in panel that teaches from a loaded resource.
 * Flow: load resource → enter topic → get AI lesson + audio → ask doubts
 */
export default function TeachingPanel({ resource, onClose }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState('idle'); // idle | loading | ready | teaching | doubt
  const [topic, setTopic] = useState('');
  const [lesson, setLesson] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [doubts, setDoubts] = useState([]);
  const [doubtInput, setDoubtInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  const getToken = async () => await user.getIdToken();

  const loadResource = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = await getToken();
      await axios.post(
        `${API}/api/teaching/load`,
        { resource_id: resource.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPhase('ready');
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load resource.');
    } finally {
      setIsLoading(false);
    }
  };

  const teachLesson = async () => {
    if (!topic.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API}/api/teaching/lesson`,
        { resource_id: resource.id, topic },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLesson(res.data.lesson);
      setAudioFile(res.data.audio_file);
      setPhase('teaching');
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to generate lesson.');
    } finally {
      setIsLoading(false);
    }
  };

  const askDoubt = async () => {
    if (!doubtInput.trim()) return;
    setIsLoading(true);
    setError('');
    const question = doubtInput;
    setDoubtInput('');
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API}/api/teaching/doubt`,
        { resource_id: resource.id, question },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDoubts(prev => [...prev, {
        question,
        answer: res.data.answer,
        audio: res.data.audio_file,
      }]);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to answer doubt.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderDocument = () => {
    if (!resource?.url) return <div className="text-white">No URL available</div>;
    
    // Guess type if resource_type isn't specific enough
    const rType = (resource.resource_type || resource.type || '').toUpperCase();
    const urlLower = resource.url.toLowerCase();
    
    const isPDF = rType === 'PDF' || urlLower.includes('.pdf');
    const isImage = urlLower.match(/\.(jpeg|jpg|gif|png|webp)/i);
    const isVideo = rType === 'VIDEO' || urlLower.match(/\.(mp4|webm|ogg)/i);

    if (isPDF) {
      return <iframe src={`${resource.url}#toolbar=0`} className="w-full h-full rounded-xl border-0 bg-white shadow-inner" title={resource.title || 'Document'} />;
    } else if (isImage) {
      return <img src={resource.url} alt={resource.title} className="max-w-full max-h-full object-contain shadow-2xl rounded-xl" />;
    } else if (isVideo) {
      return <video controls src={resource.url} className="w-full max-h-full rounded-xl shadow-2xl" />;
    } else {
      // Fallback for general web links or unknown
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-zinc-900/50 rounded-xl">
           <BookOpen className="w-16 h-16 text-zinc-500 mb-4" />
           <p className="text-white text-lg font-medium mb-2">Unsupported Document Preview</p>
           <a href={resource.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">
             Open {resource.title || "Link"} in new tab
           </a>
        </div>
      );
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-row"
        onClick={onClose}
      >
        {/* Document Viewer (Left Side) */}
        <div className="flex-1 h-full p-4 md:p-6 lg:p-8 flex flex-col justify-center relative items-center" onClick={e => e.stopPropagation()}>
           <div className="w-full h-full relative flex flex-col">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-white font-bold text-xl truncate">{resource?.title || 'Document Preview'}</h2>
                 <Button variant="ghost" className="text-white hover:bg-white/20 rounded-full" onClick={onClose}>
                    <X className="h-5 w-5 mr-2" /> Close Tutor
                 </Button>
              </div>
              <div className="flex-1 w-full bg-black/40 rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center p-2">
                 {renderDocument()}
              </div>
           </div>
        </div>

        {/* AI Tutor Panel (Right Side) */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full md:w-[450px] lg:w-[500px] flex-shrink-0 h-full bg-white dark:bg-zinc-900 shadow-2xl overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 p-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-teal-500" />
              <h2 className="font-semibold text-gray-900 dark:text-white">AI Tutor</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Resource Info */}
            <div className="p-3 bg-teal-50 dark:bg-teal-950/20 rounded-xl">
              <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
                {resource?.title || 'Resource'}
              </p>
              <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">
                {resource?.type || 'Document'}
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded-lg">{error}</p>
            )}

            {/* Phase: Idle — Load resource */}
            {phase === 'idle' && (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Load this resource to start learning with AI
                </p>
                <Button
                  onClick={loadResource}
                  disabled={isLoading}
                  className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      <Play className="h-4 w-4" /> Load & Prepare
                    </span>
                  )}
                </Button>
              </div>
            )}

            {/* Phase: Ready — Enter topic */}
            {phase === 'ready' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  ✅ Resource loaded! What topic would you like to learn?
                </p>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g., Binary Search Trees, Pointers, Sorting..."
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500"
                  onKeyDown={e => e.key === 'Enter' && teachLesson()}
                />
                <Button
                  onClick={teachLesson}
                  disabled={isLoading || !topic.trim()}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Generating lesson...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" /> Teach Me
                    </span>
                  )}
                </Button>
              </div>
            )}

            {/* Phase: Teaching — Lesson displayed */}
            {phase === 'teaching' && (
              <div className="space-y-4">
                {/* Lesson bubble */}
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-teal-800 dark:text-teal-300">Nephele</p>
                      <p className="text-xs text-teal-600 dark:text-teal-400">AI Tutor</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line leading-relaxed">
                    {lesson}
                  </p>
                </div>

                {/* Audio player */}
                {audioFile && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                    <Volume2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                    <audio
                      ref={audioRef}
                      controls
                      className="w-full h-8"
                      src={`${API}/api/teaching/audio/${audioFile}`}
                    />
                  </div>
                )}

                {/* New topic */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Ask about another topic..."
                    className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                    onKeyDown={e => e.key === 'Enter' && teachLesson()}
                  />
                  <Button
                    onClick={teachLesson}
                    disabled={isLoading}
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  </Button>
                </div>

                {/* Doubts section */}
                <div className="border-t border-gray-200 dark:border-zinc-800 pt-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" /> Ask a Doubt
                  </h3>

                  {doubts.map((d, i) => (
                    <div key={i} className="mb-3 space-y-2">
                      <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2 ml-8">
                        <p className="text-sm text-blue-800 dark:text-blue-300">{d.question}</p>
                      </div>
                      <div className="bg-teal-50 dark:bg-teal-950/20 rounded-lg p-2 mr-8">
                        <p className="text-sm text-teal-800 dark:text-teal-300">{d.answer}</p>
                        {d.audio && (
                          <audio controls className="w-full h-6 mt-1" src={`${API}/api/teaching/audio/${d.audio}`} />
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={doubtInput}
                      onChange={e => setDoubtInput(e.target.value)}
                      placeholder="Type your doubt..."
                      className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      onKeyDown={e => e.key === 'Enter' && askDoubt()}
                    />
                    <Button
                      onClick={askDoubt}
                      disabled={isLoading || !doubtInput.trim()}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
