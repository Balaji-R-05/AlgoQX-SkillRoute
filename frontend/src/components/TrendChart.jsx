import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Activity, TrendingUp } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 rounded-xl shadow-xl">
        <p className="text-sm font-bold text-gray-500 mb-2">
          {format(parseISO(label), 'MMM d, yyyy')}
        </p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: entry.color }}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                {entry.name}
              </span>
              <span className="font-black text-gray-800 dark:text-gray-200">
                {entry.value.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function TrendChart({ historyData = [], loading = false }) {
  if (loading) {
    return (
      <Card className="rounded-3xl border-0 shadow-sm animate-pulse">
        <div className="h-64 bg-gray-100 dark:bg-zinc-800 rounded-3xl" />
      </Card>
    );
  }

  if (!historyData || historyData.length === 0) {
    return (
      <Card className="rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800 p-8 text-center bg-transparent shadow-none">
        <Activity className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        <p className="font-medium text-gray-500">Not enough data to show trends</p>
        <p className="text-sm text-gray-400 mt-1">Check in daily to build your history</p>
      </Card>
    );
  }

  // Calculate generic trend
  const hasTrend = historyData.length >= 2;
  let isPositive = true;
  let trendMsg = "Steady consistency";

  if (hasTrend) {
    const first = historyData[0].composite_score;
    const last = historyData[historyData.length - 1].composite_score;
    isPositive = last >= first;
    const diff = Math.abs(last - first).toFixed(1);
    trendMsg = isPositive ? `Up +${diff} points overall` : `Down -${diff} points overall`;
  }

  return (
    <Card className="rounded-3xl border-0 shadow-xl overflow-hidden bg-white dark:bg-zinc-950">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            Readiness Trend
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${isPositive ? 'text-emerald-500' : 'text-amber-500'}`}>
              {trendMsg}
            </span>
            <span className="text-xs font-medium text-gray-400">
              • Last {historyData.length} check-ins
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="h-72 w-full mt-4 pr-6">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <AreaChart
              data={historyData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.4} />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 600 }}
                tickFormatter={(val) => format(parseISO(val), 'MMM d')}
                minTickGap={30}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 600 }}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="predicted_readiness" 
                name="AI Prediction (x20)"
                stroke="#6366f1" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorPredicted)" 
                // Multiply predicted (0-5) by 20 to scale it 0-100 on the same chart
                data={historyData.map(d => ({...d, predicted_readiness: d.predicted_readiness * 20}))}
              />
              <Area 
                type="monotone" 
                dataKey="composite_score" 
                name="Readiness Score"
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorScore)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
