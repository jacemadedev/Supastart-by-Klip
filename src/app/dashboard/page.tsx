"use client"

import { History, MessageSquare, Settings, Video, LifeBuoy } from "lucide-react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState, Suspense, useEffect } from "react"
import { Separator } from "@/components/ui/separator"
import { VideoPlayer } from "@/components/modals/video-player"
import { OnboardingChecklist } from "@/components/dashboard-components/onboarding-checklist"
// Import YouTube types
import "@/types/youtube"

const quickActions = [
  {
    title: "New Chat",
    description: "Start an AI conversation",
    icon: MessageSquare,
    href: "/dashboard/chat",
    color: "text-primary",
  },
  {
    title: "History",
    description: "View past conversations",
    icon: History,
    href: "/dashboard/history",
    color: "text-primary",
  },
  {
    title: "Settings",
    description: "Customize your experience",
    icon: Settings,
    href: "/dashboard/settings",
    color: "text-primary",
  },
  {
    title: "Support",
    description: "Get help with any issues",
    icon: LifeBuoy,
    href: "/support",
    color: "text-primary",
  },
]

const onboardingTasks = [
  {
    id: "watch-video",
    title: "Watch the onboarding video",
    description: "Learn how to get the most out of our platform",
  },
  {
    id: "first-chat",
    title: "Start your first chat",
    description: "Try out the AI assistant with a simple question",
  },
  {
    id: "explore-settings",
    title: "Explore your settings",
    description: "Customize the platform to match your preferences",
  },
  {
    id: "update-profile",
    title: "Update your profile",
    description: "Add your information to personalize your experience",
  },
]

function DashboardPageContent() {
  const router = useRouter()
  const [completedTasks, setCompletedTasks] = useState<string[]>([])
  const [videoModalOpen, setVideoModalOpen] = useState(false)

  // Load saved tasks from localStorage on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem('onboardingTasks')
    if (savedTasks) {
      try {
        const parsedTasks = JSON.parse(savedTasks)
        if (Array.isArray(parsedTasks)) {
          setCompletedTasks(parsedTasks)
        }
      } catch (error) {
        console.error('Error loading saved tasks:', error)
      }
    }
  }, [])

  // Handle video modal events
  useEffect(() => {
    const handleVideoClose = () => {
      setVideoModalOpen(false)
    }

    const handleVideoComplete = () => {
      if (!completedTasks.includes("watch-video")) {
        setCompletedTasks(prev => [...prev, "watch-video"])
      }
      setVideoModalOpen(false)
    }

    window.addEventListener('videoModalClose', handleVideoClose)
    window.addEventListener('videoComplete', handleVideoComplete)

    return () => {
      window.removeEventListener('videoModalClose', handleVideoClose)
      window.removeEventListener('videoComplete', handleVideoComplete)
    }
  }, [completedTasks])

  const toggleTask = (taskId: string) => {
    setCompletedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId) 
        : [...prev, taskId]
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Welcome Video and Quick Actions */}
      <div className="lg:col-span-2 space-y-6">
        {/* Welcome Section with Video */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Welcome to SupaStart!</CardTitle>
            <CardDescription className="text-base">
              We&apos;ve prepared some resources to help you get started quickly. Watch the video below and complete the onboarding tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted rounded-lg overflow-hidden relative flex items-center justify-center mb-4">
              {/* Using YouTube thumbnail as background */}
              <div className="absolute inset-0 bg-cover bg-center" 
                   style={{ 
                     backgroundImage: "url('https://img.youtube.com/vi/iVY0-iGSpSM/maxresdefault.jpg')",
                     opacity: 0.7
                   }} 
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="bg-background/70 dark:bg-card/50 backdrop-blur-sm rounded-full p-4 shadow-lg">
                  <Video className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 font-medium text-foreground bg-background/30 dark:bg-card/30 px-3 py-1 rounded backdrop-blur-sm">
                  SupaStart Onboarding Guide
                </p>
                <Button 
                  className="mt-4" 
                  size="sm" 
                  onClick={() => setVideoModalOpen(true)}
                >
                  Play Video
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-2" />

        {/* Quick Actions - Minimal Design */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <button
                key={action.title}
                onClick={() => router.push(action.href)}
                className="group flex items-center gap-4 p-4 rounded-lg transition-all duration-200 bg-card hover:ring-2 hover:ring-primary/20 hover:scale-[1.02] border border-border/40"
              >
                <div className={`${action.color} rounded-lg p-2.5`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-base group-hover:text-primary">
                    {action.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column - Onboarding Checklist */}
      <div className="lg:col-span-1 space-y-6">
        <OnboardingChecklist
          tasks={onboardingTasks}
          completedTasks={completedTasks}
          onTaskToggle={toggleTask}
          onResetProgress={() => setCompletedTasks([])}
        />
      </div>

      {/* Video Modal */}
      <VideoPlayer
        videoId="iVY0-iGSpSM"
        title="Onboarding Tutorial"
        isOpen={videoModalOpen}
        autoplay={true}
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Video className="h-8 w-8 animate-spin" />
      </div>
    }>
      <DashboardPageContent />
    </Suspense>
  )
}
