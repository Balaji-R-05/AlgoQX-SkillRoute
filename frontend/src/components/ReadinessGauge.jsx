import React from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Zap,
  Heart,
  Target
} from 'lucide-react';

const STRESS_COLORS = {
  low: { ring: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', label: 'Low Stress' },
  moderate: { ring: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', label: 'Moderate' },
  high: { ring: '#ef4444', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', label: 'High Stress' },
  critical: { ring: '#dc2626', bg: 'bg-red-100 dark:bg-red-950/50', text: 'text-red-800 dark:text-red-200', label: 'Critical' },
};

const GAP_CONFIG = {
  accurate: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', label: 'Self-assessment is accurate' },
  overconfident: { icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', label: 'Slightly overconfident' },
  underconfident: { icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', label: 'You\'re better than you think!' },
};

function CircularGauge({ score, size = 160, strokeWidth = 12 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const center = size / 2;

  // Color based on score
  let color = '#ef4444'; // red
  if (score >= 70) color = '#10b981'; // green
  else if (score >= 40) color = '#f59e0b'; // amber

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-zinc-700"
        />
        {/* Progress arc */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="text-4xl font-black"
          style={{ color }}
        >
          {Math.round(score)}
        </motion.span>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Readiness</span>
      </div>
    </div>
  );
}

function FactorBar({ label, value, max, icon: Icon, color }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-600 dark:text-gray-400">
          <Icon className="w-3.5 h-3.5" /> {label}
        </span>
        <span className="font-bold text-gray-800 dark:text-gray-200">{typeof value === 'number' ? value.toFixed(0) : value}{max === 5 ? '/5' : '%'}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

export default function ReadinessGauge({ readinessData, compact = false }) {
  if (!readinessData) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-300 dark:border-zinc-700 p-8 text-center">
        <Heart className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        <p className="font-semibold text-gray-500">No readiness data yet</p>
        <p className="text-sm text-gray-400 mt-1">Complete your daily wellness check-in to see your readiness score</p>
      </div>
    );
  }

  const { composite_score, perceived_readiness, predicted_readiness, gap_label, stress_level, factors, recommendations } = readinessData;
  const stressConfig = STRESS_COLORS[stress_level] || STRESS_COLORS.moderate;
  const gapConfig = GAP_CONFIG[gap_label] || GAP_CONFIG.accurate;
  const GapIcon = gapConfig.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm">
        <CircularGauge score={composite_score} size={80} strokeWidth={8} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${stressConfig.bg} ${stressConfig.text}`}>
              {stressConfig.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${gapConfig.bg} ${gapConfig.color}`}>
              {gap_label}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            Self: {perceived_readiness?.toFixed(1)} → Predicted: {predicted_readiness?.toFixed(1)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main gauge */}
      <div className="flex flex-col items-center space-y-4">
        <CircularGauge score={composite_score} />

        {/* Stress indicator */}
        <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${stressConfig.bg}`}>
          {stress_level === 'critical' || stress_level === 'high' ? (
            <AlertTriangle className={`w-4 h-4 ${stressConfig.text}`} />
          ) : (
            <Shield className={`w-4 h-4 ${stressConfig.text}`} />
          )}
          <span className={`text-sm font-bold ${stressConfig.text}`}>{stressConfig.label}</span>
        </div>
      </div>

      {/* Perceived vs Predicted gap */}
      <div className={`p-4 rounded-2xl flex items-center gap-3 ${gapConfig.bg}`}>
        <GapIcon className={`w-5 h-5 ${gapConfig.color} flex-shrink-0`} />
        <div className="flex-1">
          <p className={`text-sm font-bold ${gapConfig.color}`}>{gapConfig.label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            You rated yourself {perceived_readiness?.toFixed(1)}/5 — data suggests {predicted_readiness?.toFixed(1)}/5
          </p>
        </div>
      </div>

      {/* Factor breakdown */}
      {factors && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Contributing Factors</h4>
          <FactorBar label="Quiz Performance" value={factors.quiz_avg || 0} max={100} icon={Target} color="bg-blue-500" />
          <FactorBar label="Task Completion" value={factors.adherence_rate || 0} max={100} icon={CheckCircle2} color="bg-emerald-500" />
          <FactorBar label="Confidence" value={factors.wellness_confidence || 3} max={5} icon={Shield} color="bg-indigo-500" />
          <FactorBar label="Energy" value={factors.wellness_energy || 3} max={5} icon={Zap} color="bg-amber-500" />
        </div>
      )}

      {/* Top recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Suggestions</h4>
          {recommendations.slice(0, 3).map((rec, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`p-3 rounded-xl text-sm ${
                rec.priority === 'critical' ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800' :
                rec.priority === 'high' ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' :
                'bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700'
              }`}
            >
              <p className="font-medium text-gray-800 dark:text-gray-200">{rec.message}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
