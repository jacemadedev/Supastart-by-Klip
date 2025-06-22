"use client"

import { Button } from "@/components/ui/button"
import { Activity, Bot, Globe, Mic, MoreHorizontal, Plus, SendIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  isLoading?: boolean
  webSearchEnabled?: boolean
  onToggleWebSearch?: (enabled: boolean) => void
  agentEnabled?: boolean
  onToggleAgent?: (enabled: boolean) => void
}

export function ChatInput({ 
  onSendMessage, 
  isLoading = false, 
  webSearchEnabled = false, 
  onToggleWebSearch,
  agentEnabled = false,
  onToggleAgent
}: ChatInputProps) {
  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const adjustHeight = () => {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto'
      
      // Calculate the new height based on content
      const scrollHeight = textarea.scrollHeight
      
      // Set different max heights for different screen sizes
      const maxHeight = window.innerWidth >= 768 ? 300 : 240 // 300px on desktop, 240px on mobile
      const minHeight = window.innerWidth >= 768 ? 56 : 48   // Responsive min height
      
      // Apply the new height (bounded by min/max)
      const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight))
      textarea.style.height = `${newHeight}px`
      
      // Handle overflow scrolling when content exceeds max height
      if (scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto'
      } else {
        textarea.style.overflowY = 'hidden'
      }
    }

    // Adjust height on input change
    adjustHeight()
    
    // Also adjust on window resize to handle responsive breakpoints
    const handleResize = () => adjustHeight()
    window.addEventListener('resize', handleResize)
    
    return () => window.removeEventListener('resize', handleResize)
  }, [input])

  // Handle focus to ensure proper height calculation
  const handleFocus = () => {
    // Small delay to ensure the textarea is properly rendered
    setTimeout(() => {
      const textarea = textareaRef.current
      if (textarea) {
        const scrollHeight = textarea.scrollHeight
        const maxHeight = window.innerWidth >= 768 ? 300 : 240
        const minHeight = window.innerWidth >= 768 ? 56 : 48
        const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight))
        textarea.style.height = `${newHeight}px`
      }
    }, 0)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() === "" || isLoading) return
    
    onSendMessage(input.trim())
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const toggleWebSearch = () => {
    if (onToggleWebSearch) {
      onToggleWebSearch(!webSearchEnabled)
    }
  }

  const toggleAgent = () => {
    if (onToggleAgent) {
      onToggleAgent(!agentEnabled)
    }
  }

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl hover:bg-card/90 shadow-sm transition-all dark:bg-card/50 dark:hover:bg-card/60">
          
          {/* Top row with buttons - all screen sizes */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            {/* Left side buttons */}
            <div className="flex items-center gap-2">
              <Button 
                type="button" 
                size="icon" 
                variant="ghost" 
                className="rounded-full h-9 w-9 sm:h-8 sm:w-8 flex-shrink-0"
              >
                <Plus className="size-5 sm:size-4" />
                <span className="sr-only">Add attachment</span>
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-8 sm:w-8 rounded-full flex-shrink-0"
              >
                <Mic className="size-5 sm:size-4" />
                <span className="sr-only">Voice input</span>
              </Button>
              
              {/* More options button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-8 sm:w-8 rounded-full"
              >
                <MoreHorizontal className="size-5 sm:size-4" />
                <span className="sr-only">More options</span>
              </Button>
            </div>
            
            {/* Right side toggle buttons */}
            <div className="flex items-center gap-2">
              {/* Agent Mode button */}
              {onToggleAgent && (
                <Button
                  type="button"
                  variant={agentEnabled ? "default" : "ghost"}
                  size="sm"
                  className={`h-9 sm:h-8 rounded-full px-4 sm:px-3 text-sm sm:text-xs font-medium flex items-center gap-2 sm:gap-1.5 ${
                    agentEnabled 
                      ? "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:hover:bg-blue-500/30" 
                      : ""
                  }`}
                  onClick={toggleAgent}
                >
                  <Bot className="size-4 sm:size-3" />
                  <span className="hidden xs:inline">Agent Mode</span>
                  <span className="xs:hidden">Agent</span>
                </Button>
              )}
              
              {/* Search button */}
              <Button
                type="button"
                variant={webSearchEnabled ? "default" : "ghost"}
                size="sm"
                className={`h-9 sm:h-8 rounded-full px-4 sm:px-3 text-sm sm:text-xs font-medium flex items-center gap-2 sm:gap-1.5 ${
                  webSearchEnabled 
                    ? "bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30" 
                    : ""
                }`}
                onClick={toggleWebSearch}
              >
                <Globe className="size-4 sm:size-3" />
                <span className="hidden xs:inline">Web Search</span>
                <span className="xs:hidden">Web</span>
              </Button>
            </div>
          </div>
          
          {/* Bottom row with input and send - all screen sizes */}
          <div className="flex items-end gap-3 px-4 py-4">
            {/* Input field - gets full width */}
            <div className="relative flex-grow">
              <textarea 
                ref={textareaRef}
                rows={2}
                placeholder="Ask anything" 
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground text-base outline-none resize-none py-2 leading-6 transition-all duration-200 ease-in-out"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                disabled={isLoading}
                style={{
                  minHeight: '56px', // This will be overridden by JS for responsiveness
                  maxHeight: 'none'  // Let JS handle the max height
                }}
              />
            </div>
            
            {/* Send button */}
            <Button 
              type="submit" 
              size="icon"
              className="h-12 w-12 sm:h-10 sm:w-10 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-all flex items-center justify-center flex-shrink-0"
              disabled={input.trim() === "" || isLoading}
            >
              {isLoading ? (
                <div className="h-6 w-6 sm:h-5 sm:w-5 animate-spin rounded-full border-2 border-t-transparent" />
              ) : input.trim() === "" ? (
                <Activity className="size-6 sm:size-5" />
              ) : (
                <SendIcon className="size-6 sm:size-5" />
              )}
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
} 