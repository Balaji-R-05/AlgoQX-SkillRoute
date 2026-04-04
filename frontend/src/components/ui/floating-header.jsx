import React from 'react';
import { Compass, User, LogOut, Moon, Sun, BookOpen, Calendar, LayoutGrid } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from './button';
import { cn } from '../../lib/utils';

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
				'mx-auto w-[92%] sm:w-[95%] max-w-4xl rounded-2xl border',
				'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50 dark:supports-[backdrop-filter]:bg-zinc-900/50',
				'border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-2xl dark:shadow-zinc-950/20',
				'transition-all duration-300 ease-in-out'
			)}
		>
			<nav className="mx-auto flex items-center justify-between p-1.5 sm:p-2 px-3 sm:px-4">
				<div
					className="hover:bg-gray-100 dark:hover:bg-zinc-800 flex cursor-pointer items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-1.5 duration-200"
					onClick={() => navigate('/dashboard')}
				>
					<div className="bg-gray-900 dark:bg-white rounded-md p-1">
						<Compass className="size-3.5 sm:size-4 text-white dark:text-gray-900" />
					</div>
					<p className="font-sans text-xs sm:text-sm font-bold tracking-tight text-gray-900 dark:text-white">SkillRoute</p>
				</div>

				<div className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-4 overflow-x-auto no-scrollbar">
					<Button
						variant="ghost"
						size="sm"
						className={cn(
							"flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-semibold transition-all",
							location.pathname === '/dashboard' 
								? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white" 
								: "text-gray-500 hover:text-gray-900 dark:hover:text-white"
						)}
						onClick={() => navigate('/dashboard')}
					>
						<LayoutGrid className="size-3.5" />
						<span className="hidden md:inline">Dashboard</span>
					</Button>
					
					<Button
						variant="ghost"
						size="sm"
						className={cn(
							"flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-semibold transition-all",
							location.pathname === '/resources' 
								? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white" 
								: "text-gray-500 hover:text-gray-900 dark:hover:text-white"
						)}
						onClick={() => navigate('/resources')}
					>
						<BookOpen className="size-3.5" />
						<span className="hidden md:inline">Resources</span>
					</Button>

					<Button
						variant="ghost"
						size="sm"
						className={cn(
							"flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-semibold transition-all",
							location.pathname === '/schedules' 
								? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white" 
								: "text-gray-500 hover:text-gray-900 dark:hover:text-white"
						)}
						onClick={() => navigate('/schedules')}
					>
						<Calendar className="size-3.5" />
						<span className="hidden md:inline">Schedules</span>
					</Button>
				</div>

				<div className="flex items-center gap-1 sm:gap-2 justify-end">
					{userName && <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 hidden lg:inline-block mr-2">{userName}</span>}

					{/* Profile Circle Avatar */}
					<div
						className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-[10px] sm:text-xs cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-indigo-500 dark:hover:ring-offset-zinc-900 transition-all duration-200 shadow-sm"
						onClick={() => navigate('/profile')}
					>
						{userInitial}
					</div>

					<div className="w-px h-3 sm:h-4 bg-gray-200 dark:bg-zinc-800 mx-1"></div>

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
