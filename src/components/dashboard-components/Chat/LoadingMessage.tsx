"use client"

import { useEffect, useState } from "react"

export function LoadingMessage() {
  const [dots, setDots] = useState("")
  
  // Animate the dots to show typing
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return ""
        return prev + "."
      })
    }, 400)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="flex gap-2 mb-4">
      <div className="size-8 rounded-full flex-shrink-0 bg-primary" />
      <div className="rounded-lg p-4 max-w-3xl bg-muted">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse delay-150" />
          <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse delay-300" />
          <span className="text-sm text-gray-500 ml-2">
            Thinking{dots}
          </span>
        </div>
      </div>
    </div>
  )
} 