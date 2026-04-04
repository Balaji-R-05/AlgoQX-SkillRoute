import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'

import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import ProfileSetup from './components/ProfileSetup'
import ResourceHub from './pages/ResourceHub'
import ScheduleGenerator from './pages/ScheduleGenerator'
import SignIn from './components/ui/SignIn'
import SignUp from './components/ui/SignUp'

// const SignIn = lazy(() => import('./components/ui/SignIn'))
// const SignUp = lazy(() => import('./components/ui/SignUp'))
// const Dashboard = lazy(() => import('./pages/Dashboard'))
// const Profile = lazy(() => import('./pages/Profile'))
// const ProfileSetup = lazy(() => import('./components/ProfileSetup'))
// const ResourceHub = lazy(() => import('./pages/ResourceHub'))
// const ScheduleGenerator = lazy(() => import('./pages/ScheduleGenerator'))

import { useAuth } from './contexts/AuthContext'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white"></div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Initializing...</p>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white"></div>
        </div>
      </div>
    }>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" /> : <SignIn />}
        />
        <Route
          path="/signup"
          element={user ? <Navigate to="/dashboard" /> : <SignUp />}
        />
        <Route
          path="/profile-setup"
          element={user ? <ProfileSetup /> : <Navigate to="/login" />}
        />
        <Route
          path="/profile"
          element={user ? <Profile /> : <Navigate to="/login" />}
        />
        <Route
          path="/dashboard"
          element={user ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/resources"
          element={user ? <ResourceHub /> : <Navigate to="/login" />}
        />
        <Route
          path="/schedules"
          element={user ? <ScheduleGenerator /> : <Navigate to="/login" />}
        />
        <Route
          path="/"
          element={<Navigate to={user ? "/dashboard" : "/login"} />}
        />
      </Routes>
    </Suspense>
  )
}

export default App
