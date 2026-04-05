import { useState, useEffect, useRef, useCallback } from 'react'
import { auth } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import { Bot } from 'lucide-react'

export const useDashboardData = () => {
    const { user, idToken, loading: authLoading } = useAuth()
    // Initialize from cache for instant load
    const [profile, setProfile] = useState(() => {
        const cached = localStorage.getItem('skillroute_profile')
        return cached ? JSON.parse(cached) : null
    })
    const [roadmap, setRoadmap] = useState(() => {
        const cached = localStorage.getItem('skillroute_roadmap')
        return cached ? JSON.parse(cached) : null
    })
    const [loading, setLoading] = useState(!profile || !roadmap)
    const [error, setError] = useState(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [generationMode, setGenerationMode] = useState(null)

    const autoAdaptShown = useRef(false)
    const toast = useToast()

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

    const loadProfile = useCallback(async (signal) => {
        if (!idToken) return
        try {
            const response = await axios.get(`${API_URL}/api/students/profile`, {
                headers: { Authorization: `Bearer ${idToken}` },
                signal
            })
            if (response.data && !response.data.message) {
                setProfile(response.data)
                localStorage.setItem('skillroute_profile', JSON.stringify(response.data))
            }
        } catch (err) {
            if (err.name !== 'CanceledError' && err.code !== 'ECONNABORTED') {
                console.error('Profile load error:', err)
            }
        }
    }, [API_URL, idToken])

    const loadRoadmap = useCallback(async (signal) => {
        if (!idToken) return
        try {
            const response = await axios.get(`${API_URL}/api/career/roadmap`, {
                headers: { Authorization: `Bearer ${idToken}` },
                signal
            })

            if (response.data && !response.data.message) {
                setRoadmap(response.data)
                localStorage.setItem('skillroute_roadmap', JSON.stringify(response.data))
                
                // Auto-adapt detection
                if (response.data.needs_adaptation && !autoAdaptShown.current) {
                    autoAdaptShown.current = true
                    toast.info({
                        title: (
                            <div className="flex items-center gap-2">
                                <Bot className="w-4 h-4" />
                                <span>Agent Suggestion</span>
                            </div>
                        ),
                        description: response.data.adaptation_reason || 'Your progress seems stalled. Want the agent to adapt your roadmap?',
                        action: {
                            label: 'Adapt Now',
                            onClick: () => window.dispatchEvent(new CustomEvent('triggerAdapt'))
                        }
                    })
                }
            } else {
                setRoadmap(null)
            }
        } catch (err) {
            if (err.name !== 'CanceledError' && err.code !== 'ECONNABORTED') {
                if (err.response && err.response.status === 404) {
                    setRoadmap(null)
                } else {
                    console.error('Roadmap load error:', err)
                }
            }
        }
    }, [API_URL, idToken, toast])

    const generateRoadmap = async () => {
        if (!profile || !idToken) return false

        setLoading(true)
        setIsGenerating(true)
        setGenerationMode('generate')
        try {
            const response = await axios.post(`${API_URL}/api/career/roadmap`, profile, {
                headers: { Authorization: `Bearer ${idToken}` }
            })
            setRoadmap(response.data)
            toast.success('Roadmap generated successfully!')
            return true
        } catch (err) {
            console.error("API failed, using graceful fallback:", err);
            const mockRoadmap = {
              needs_adaptation: false,
              career_decision: {
                career: "Full Stack Engineer (Fallback)",
                confidence: 90,
                skill_match_percentage: 80,
                market_readiness: 45,
                key_strengths: ["Problem Solving", "Web Basics"],
                skill_gaps: ["System Design", "Advanced React"],
                time_to_job_ready: "12 Weeks",
                reasoning: "Offline Demo Mode: We recommend Full Stack as it covers the broadest job market appeal.",
                alternatives: ["Frontend Developer", "Backend Developer"]
              },
              learning_roadmap: {
                title: "Full Stack Mastery (Demo)",
                total_phases: 2,
                phases: [
                  {
                    phase_id: 1,
                    title: "Frontend Foundations",
                    focus_skills: ["React", "Tailwind"],
                    estimated_duration_weeks: 4,
                    milestones: [
                      {
                        name: "Build a UI Dashboard",
                        description: "Learn component state and props.",
                        resources: [{ type: "course", title: "React Docs", url: "https://react.dev", duration: "10 hours" }]
                      }
                    ]
                  }
                ]
              }
            };
            setRoadmap({ ...mockRoadmap, user_id: profile.id });
            toast.success('Roadmap generated (Offline Mock Mode)');
            return true;
        } finally {
            setLoading(false)
            setIsGenerating(false)
            setGenerationMode(null)
        }
    }

    const adaptRoadmap = async () => {
        if (!idToken) return false
        setLoading(true)
        setIsGenerating(true)
        setGenerationMode('adapt')
        try {
            await axios.post(`${API_URL}/api/progress/adapt`, {}, {
                headers: { Authorization: `Bearer ${idToken}` }
            })
            await loadRoadmap()
            toast.success({
                title: 'Roadmap Adapted',
                description: 'Your learning path has been updated based on your recent progress.'
            })
            return true
        } catch (err) {
            toast.error('Failed to adapt roadmap. Please try again.')
            return false
        } finally {
            setLoading(false)
            setIsGenerating(false)
            setGenerationMode(null)
        }
    }

    const resetCareerPath = async () => {
        if (!idToken) return false
        setLoading(true)
        try {
            await axios.delete(`${API_URL}/api/career/roadmap`, {
                headers: { Authorization: `Bearer ${idToken}` }
            })
            setRoadmap(null)
            localStorage.removeItem('skillroute_roadmap')
            toast.success('Career path reset successfully!')
            return true
        } catch (err) {
            toast.error('Failed to reset career path.')
            return false
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // Only fetch when auth is ready and user is logged in
        if (authLoading) return
        if (!user) {
            // Not logged in? Reset states
            setProfile(null)
            setRoadmap(null)
            setLoading(false)
            return
        }

        const controller = new AbortController()
        setLoading(true)

        Promise.all([
            loadProfile(controller.signal),
            loadRoadmap(controller.signal)
        ]).finally(() => {
            setLoading(false)
        })

        return () => controller.abort()
    }, [authLoading, user, loadProfile, loadRoadmap])

    const refreshData = async () => {
        if (!idToken) return
        setLoading(true)
        await Promise.all([loadProfile(), loadRoadmap()])
        setLoading(false)
    }

    return {
        profile,
        roadmap,
        loading,
        error,
        isGenerating,
        generationMode,
        generateRoadmap,
        adaptRoadmap,
        resetCareerPath,
        refreshData
    }
}
