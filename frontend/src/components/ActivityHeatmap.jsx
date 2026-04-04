import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Calendar as CalendarIcon, Flame } from 'lucide-react';
import { format, parseISO, subDays, eachDayOfInterval, isSameDay } from 'date-fns';

export default function ActivityHeatmap({ historyData = [], loading = false, days = 60 }) {
  if (loading) {
    return (
      <Card className="rounded-3xl border-0 shadow-sm animate-pulse">
        <div className="h-48 bg-gray-100 dark:bg-zinc-800 rounded-3xl" />
      </Card>
    );
  }

  // Generate grid for the last X days
  const end = new Date();
  const start = subDays(end, days - 1);
  const dateRange = eachDayOfInterval({ start, end });

  // Map history data for O(1) lookup
  const historyMap = new Map();
  historyData.forEach(item => {
    historyMap.set(format(parseISO(item.date), 'yyyy-MM-dd'), item);
  });

  // Calculate current streak
  let currentStreak = 0;
  if (historyData.length > 0) {
    // We already have current streak in the factors JSON but let's extract it if present
    const lastItem = historyData[historyData.length - 1];
    if (lastItem.factors && lastItem.factors.current_streak) {
      currentStreak = lastItem.factors.current_streak;
    }
  }

  // Determine color based on completion or composite score
  const getColor = (score) => {
    if (!score && score !== 0) return 'bg-gray-100 dark:bg-zinc-800/50';
    if (score < 40) return 'bg-emerald-200 dark:bg-emerald-900/40';
    if (score < 70) return 'bg-emerald-400 dark:bg-emerald-600/70';
    return 'bg-emerald-500 dark:bg-emerald-500 shadow-sm shadow-emerald-400/30';
  };

  // Group dates by weeks to create the GitHub-style horizontal grid
  // In a standard layout, each column is a week.
  // We'll use a CSS grid with autoflow column.
  
  return (
    <Card className="rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-gray-500" />
              Consistency Heatmap
            </CardTitle>
            <CardDescription>
              Your activity over the last {days} days
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 dark:bg-amber-950/30 rounded-full border border-orange-100 dark:border-amber-900/50">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">{currentStreak} Day Streak</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-2 -mx-2 px-2 custom-scrollbar">
          <div 
            className="grid grid-rows-7 gap-1.5 auto-cols-max grid-flow-col"
            style={{ 
              minWidth: 'min-content'
            }}
          >
            {dateRange.map((date, idx) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const data = historyMap.get(dateStr);
              const score = data ? data.composite_score : null;
              
              return (
                <div 
                  key={idx}
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-sm sm:rounded-md transition-all hover:scale-125 hover:z-10 cursor-pointer ${getColor(score)} ${
                    isSameDay(date, new Date()) ? 'ring-2 ring-offset-1 ring-emerald-500 dark:ring-offset-zinc-900 border-none' : 'border border-black/5 dark:border-white/5'
                  }`}
                  title={`${format(date, 'MMM d, yyyy')}${data ? `: Score ${data.composite_score}` : ': No activity'}`}
                />
              );
            })}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-4 text-xs font-medium text-gray-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className={`w-3 h-3 rounded-sm ${getColor(null)}`} />
            <div className={`w-3 h-3 rounded-sm ${getColor(30)}`} />
            <div className={`w-3 h-3 rounded-sm ${getColor(60)}`} />
            <div className={`w-3 h-3 rounded-sm ${getColor(80)}`} />
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
