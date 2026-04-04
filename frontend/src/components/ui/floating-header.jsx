import React from 'react';
import { Compass, User, LogOut, Moon, Sun, BookOpen, Calendar, LayoutGrid, Activity, Brain, GraduationCap, Briefcase } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from './button';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Home', Icon: LayoutGrid },
  { path: '/exam-prep', label: 'Exams', Icon: GraduationCap },
  { path: '/placement-prep', label: 'Placements', Icon: Briefcase },
  { path: '/resources', label: 'Hub', Icon: BookOpen },
  { path: '/teacher', label: 'Tutor', Icon: Brain },
  { path: '/analytics', label: 'Pulse', Icon: Activity },
  { path: '/mock-interview', label: 'Interview', Icon: Brain },
];

export function FloatingHeader({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  const userName = user?.displayName || user?.email?.split('@')[0];
  const userInitial = user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';

  return (
    <header
      className={cn(
        'sticky top-4 sm:top-6 z-50',
        'mx-auto w-[96%] sm:w-[98%] max-w-7xl rounded-2xl border',
        'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50 dark:supports-[backdrop-filter]:bg-zinc-900/50',
        'border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-2xl dark:shadow-zinc-950/20',
        'transition-all duration-300 ease-in-out'
      )}
    >
      <nav className="mx-auto flex items-center justify-between p-1.5 sm:p-2 px-3 sm:px-4">
        {/* Logo */}
        <div
          className="hover:bg-gray-100 dark:hover:bg-zinc-800 flex cursor-pointer items-center gap-2 sm:gap-2.5 rounded-xl px-2 sm:px-3 py-1.5 duration-200 group shrink-0"
          onClick={() => navigate('/dashboard')}
        >
          <div className="bg-zinc-900 dark:bg-white rounded-lg p-1.5 shadow-lg group-hover:scale-110 transition-transform">
            <Compass className="size-4 sm:size-4.5 text-white dark:text-zinc-900" />
          </div>
          <div className="flex flex-col">
            <p className="font-sans text-xs sm:text-sm font-black tracking-tight text-gray-900 dark:text-white leading-none">SkillRoute</p>
            <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Academic OS</p>
          </div>
        </div>

        {/* Nav Links */}
        <div className="flex-1 flex items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-4 overflow-x-auto no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                className={cn(
                  "relative flex items-center gap-1.5 px-2.5 sm:px-3 h-9 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap",
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
                )}
                onClick={() => navigate(item.path)}
              >
                <item.Icon className={cn("size-3.5", isActive && "animate-pulse")} />
                <span>{item.label}</span>
                {isActive && (
                  <div className="absolute inset-0 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-xl -z-10 border border-indigo-100/50 dark:border-indigo-500/20" />
                )}
              </Button>
            );
          })}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1 sm:gap-2 justify-end shrink-0">
          {userName && <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 hidden lg:inline-block mr-2">{userName}</span>}

          <div
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-[10px] sm:text-xs cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-indigo-500 dark:hover:ring-offset-zinc-900 transition-all duration-200 shadow-sm"
            onClick={() => navigate('/profile')}
          >
            {userInitial}
          </div>

          <div className="w-px h-3 sm:h-4 bg-gray-200 dark:bg-zinc-800 mx-1" />

          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg h-7 w-7 sm:h-8 sm:w-8 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg h-7 w-7 sm:h-8 sm:w-8 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={onLogout}
          >
            <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </nav>
    </header>
  );
}
