"use client"

import { Check, CircleCheck } from "lucide-react"
import { useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface OnboardingTask {
  id: string
  title: string
  description: string
}

interface OnboardingChecklistProps {
  tasks: OnboardingTask[]
  onTaskToggle: (taskId: string) => void
  completedTasks: string[]
  onResetProgress?: () => void
}

export function OnboardingChecklist({
  tasks,
  onTaskToggle,
  completedTasks,
  onResetProgress
}: OnboardingChecklistProps) {
  // Save tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('onboardingTasks', JSON.stringify(completedTasks))
  }, [completedTasks])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="text-primary bg-background rounded-lg p-2 shadow-sm">
            <CircleCheck className="h-6 w-6" />
          </div>
          <CardTitle>Onboarding Checklist</CardTitle>
        </div>
        <CardDescription>
          Complete these steps to get the most out of our platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden mb-6">
            <div 
              className="bg-primary h-full transition-all duration-300 ease-in-out"
              style={{ 
                width: `${(completedTasks.length / tasks.length) * 100}%` 
              }}
            />
          </div>
          
          {tasks.map((task) => (
            <div 
              key={task.id} 
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                completedTasks.includes(task.id) 
                  ? "bg-primary/10 dark:bg-primary/20" 
                  : "hover:bg-gray-50 dark:hover:bg-gray-900/30"
              }`}
            >
              <Button 
                variant="outline" 
                size="icon" 
                className={`h-6 w-6 rounded-full ${
                  completedTasks.includes(task.id) 
                    ? "bg-primary text-white border-primary hover:bg-primary/90 hover:text-white hover:border-primary/90" 
                    : ""
                }`}
                onClick={() => onTaskToggle(task.id)}
              >
                <Check className="h-3 w-3" />
                <span className="sr-only">Toggle task</span>
              </Button>
              <div>
                <h4 className={`text-base font-medium ${
                  completedTasks.includes(task.id) ? "line-through text-gray-500" : ""
                }`}>
                  {task.title}
                </h4>
                <p className="text-sm text-gray-500 mt-1">{task.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 flex justify-between">
          <span className="text-sm text-gray-500">
            {completedTasks.length} of {tasks.length} tasks completed
          </span>
          {onResetProgress && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onResetProgress}
              className="text-xs"
              disabled={completedTasks.length === 0}
            >
              Reset Progress
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 