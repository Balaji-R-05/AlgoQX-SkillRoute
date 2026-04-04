import { useState, useEffect } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, Clock, AlertCircle, ChevronRight, Layout } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TodayTasks = () => {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const { idToken } = useAuth()

  const fetchTasks = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const response = await axios.get(`${API_BASE_URL}/api/schedules/today`, {
        headers: { Authorization: `Bearer ${idToken}` }
      })
      setTasks(response.data.today_tasks || [])
    } catch (error) {
      console.error("Error fetching today's tasks:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const toggleTask = async (scheduleId, dayNumber, taskIndex, currentStatus) => {
    const isCompleted = currentStatus !== 'completed'
    
    // Optimistic Update
    const updatedTasks = tasks.map(s => {
      if (s.schedule_id === scheduleId && s.day_number === dayNumber) {
        const newStatuses = [...(s.task_statuses || [])]
        // Ensure newStatuses length matches tasks length
        while (newStatuses.length < s.tasks.length) newStatuses.push('pending')
        newStatuses[taskIndex] = isCompleted ? 'completed' : 'pending'
        return { ...s, task_statuses: newStatuses }
      }
      return s
    })
    setTasks(updatedTasks)

    try {
      await axios.patch(`${API_BASE_URL}/api/schedules/tasks/toggle`, {
        schedule_id: scheduleId,
        day_number: dayNumber,
        task_index: taskIndex,
        is_completed: isCompleted
      }, {
        headers: { Authorization: `Bearer ${idToken}` }
      })
      // Optional: sound effect or subtle toast
    } catch (error) {
      console.error("Error toggling task:", error)
      toast?.error("Failed to update task. Reverting...")
      fetchTasks(false) // Revert on failure
    }
  }

  if (loading && tasks.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 animate-pulse">
        <div className="h-6 w-1/4 bg-zinc-100 dark:bg-zinc-800 rounded-lg mb-6" />
        <div className="space-y-4">
          <div className="h-12 w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
          <div className="h-12 w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
        </div>
      </div>
    )
  }

  if (tasks.length === 0) return null

  const totalHours = tasks.reduce((acc, s) => acc + (s.daily_hours || 0), 0);
  const isHighIntensity = totalHours > 6;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm overflow-hidden relative"
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layout className="w-5 h-5 text-indigo-500" />
            <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Today's Focus</h2>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
            You have <span className="text-indigo-600 dark:text-indigo-400 font-bold">{tasks.reduce((acc, s) => acc + s.tasks.length, 0)}</span> tasks to focus on today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl flex items-center gap-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isHighIntensity ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
             <div className="text-[10px] font-black uppercase tracking-widest">Load: {totalHours}h</div>
             <div className={`w-2 h-2 rounded-full ${isHighIntensity ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
          </div>
          <button 
            onClick={() => { setRefreshing(true); fetchTasks(false); }}
            className={`px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all border border-zinc-100 dark:border-zinc-700 ${refreshing ? 'animate-pulse' : ''}`}
          >
            {refreshing ? 'Syncing...' : 'Sync Progress'}
          </button>
        </div>
      </div>

      {isHighIntensity && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <h4 className="text-sm font-black text-red-900 uppercase tracking-tight">High-Intensity Conflict</h4>
            <p className="text-xs font-medium text-red-700 leading-tight">
              Multiple exam plans overlap today. Consider utilizing "Stress Buster" or prioritizing high-priority tasks first.
            </p>
          </div>
        </motion.div>
      )}

      <div className="space-y-8 relative z-10">
        {tasks.map((schedule, sIdx) => {
          const completedCount = (schedule.task_statuses || []).filter(s => s === 'completed').length
          const totalCount = schedule.tasks.length
          const progress = (completedCount / totalCount) * 100

          return (
            <div key={schedule.schedule_id} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter border border-indigo-100/50 dark:border-indigo-500/20">
                    {schedule.event_type}
                  </div>
                  <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
                    {schedule.schedule_title}
                  </h3>
                </div>
                <div className="text-xs font-black text-zinc-400">
                  {completedCount}/{totalCount}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                />
              </div>

              <div className="grid gap-3">
                {schedule.tasks.map((task, tIdx) => {
                  const status = schedule.task_statuses?.[tIdx] || 'pending'
                  const isCompleted = status === 'completed'

                  return (
                    <motion.div
                      key={tIdx}
                      whileHover={{ x: 4 }}
                      onClick={() => toggleTask(schedule.schedule_id, schedule.day_number, tIdx, status)}
                      className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                        isCompleted 
                          ? 'bg-zinc-50/50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800 opacity-75' 
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 hover:shadow-md'
                      }`}
                    >
                      <div className={`shrink-0 transition-transform ${!isCompleted && 'group-hover:scale-110'}`}>
                        {isCompleted ? (
                          <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <Circle className="w-6 h-6 text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-400" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold transition-all ${
                          isCompleted 
                            ? 'text-zinc-400 dark:text-zinc-600 line-through' 
                            : 'text-zinc-800 dark:text-zinc-200'
                        }`}>
                          {task}
                        </p>
                        {!isCompleted && (
                          <div className="flex items-center gap-2 mt-1">
                            {schedule.priority === 'high' ? (
                               <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold uppercase tracking-wider">
                                 <AlertCircle className="w-3 h-3" /> Priority
                               </span>
                            ) : (
                               <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                 <Clock className="w-3 h-3" /> Today
                               </span>
                            )}
                          </div>
                        )}
                      </div>

                      <ChevronRight className={`w-4 h-4 text-zinc-300 dark:text-zinc-700 transition-opacity ${isCompleted ? 'opacity-0' : 'opacity-100'}`} />
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

export default TodayTasks
