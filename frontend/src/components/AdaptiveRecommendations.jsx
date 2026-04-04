import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Zap, BookOpen, Target, HeartPulse, Sparkles, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Link } from 'react-router-dom';

const TYPE_CONFIG = {
  wellness: {
    icon: HeartPulse,
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-600',
    iconBg: 'bg-rose-100 dark:bg-rose-500/20',
    color: 'text-rose-600 dark:text-rose-400',
  },
  academic: {
    icon: BookOpen,
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-600',
    iconBg: 'bg-blue-100 dark:bg-blue-500/20',
    color: 'text-blue-600 dark:text-blue-400',
  },
  placement: {
    icon: Target,
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    border: 'border-purple-200 dark:border-purple-600',
    iconBg: 'bg-purple-100 dark:bg-purple-500/20',
    color: 'text-purple-600 dark:text-purple-400',
  },
  general: {
    icon: Zap,
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-600',
    iconBg: 'bg-amber-100 dark:bg-amber-500/20',
    color: 'text-amber-600 dark:text-amber-400',
  }
};

const AdaptiveRecommendations = ({ recommendations = [], loading = false }) => {
  if (loading) {
    return (
      <Card className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-pulse">
        <CardHeader className="pb-4">
          <div className="h-6 w-48 bg-gray-200 dark:bg-zinc-800 rounded"></div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-zinc-800 rounded-xl"></div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm mb-8 overflow-hidden rounded-3xl">
      <CardHeader className="border-b border-gray-100 dark:border-zinc-800/50 pb-5 bg-gradient-to-r from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-zinc-900">
        <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-white">
          <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          AI Action Plan
        </CardTitle>
        <CardDescription className="ml-12">
          Personalized advice based on your latest readiness snapshot and academic data.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-6 space-y-4">
        <AnimatePresence>
          {recommendations && recommendations.length > 0 ? (
            recommendations.map((rec, idx) => {
              // Extract config or fallback to general
              const config = TYPE_CONFIG[rec.type] || TYPE_CONFIG.general;
              const Icon = config.icon;
              
              // Only critical/high priority gets the colored border in light mode initially,
              // but we apply hover effects to all
              const isHighPriority = rec.priority === 'critical' || rec.priority === 'high';

              return (
                <motion.div
                  key={rec.id || idx}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                  className={`group relative p-5 rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md ${
                    isHighPriority ? config.bg : 'bg-gray-50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800'
                  } ${isHighPriority ? config.border : 'border-gray-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-600'}`}
                >
                  {isHighPriority && (
                    <div className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4">
                      <span className="flex h-3 w-3 relative">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.color.split(' ')[0].replace('text', 'bg')}`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${config.color.split(' ')[0].replace('text', 'bg')}`}></span>
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl shrink-0 ${config.iconBg} ${config.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center gap-2 mb-1 cursor-default">
                        <span className={`text-xs font-bold uppercase tracking-wider ${config.color}`}>
                          {rec.type.replace('_', ' ')}
                        </span>
                        {rec.priority === 'critical' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                            CRITICAL
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed text-sm sm:text-base">
                        {rec.message}
                      </p>
                      
                      {rec.action_link && (
                        <div className="mt-3">
                          <Link 
                            to={rec.action_link} 
                            className={`inline-flex items-center gap-1 text-sm font-bold ${config.color} hover:underline`}
                          >
                            Take Action <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-10"
            >
              <Lightbulb className="w-12 h-12 mx-auto text-gray-300 dark:text-zinc-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Complete today's wellness check-in to get personalized recommendations.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default AdaptiveRecommendations;
