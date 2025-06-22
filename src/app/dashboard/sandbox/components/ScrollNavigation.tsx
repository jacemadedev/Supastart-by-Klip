import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface ScrollNavigationProps {
  scrollRef: React.RefObject<HTMLDivElement | null>
}

// Helper function for scrolling
export const scroll = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
  if (!ref.current) return
  
  const scrollAmount = 220 // Approximately 2 cards width
  const currentScroll = ref.current.scrollLeft
  
  ref.current.scrollTo({
    left: direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount,
    behavior: 'smooth'
  })
}

export function ScrollNavigation({ scrollRef }: ScrollNavigationProps) {
  return (
    <div className="flex justify-between pointer-events-none absolute inset-x-0 top-0 bottom-0">
      <button 
        onClick={() => scroll(scrollRef, 'left')}
        className="flex items-center justify-center pointer-events-auto h-full px-1 transition-opacity duration-200 hover:bg-background/30 group"
      >
        <ChevronLeft className="w-5 h-5 text-muted-foreground/40 group-hover:text-muted-foreground" />
      </button>
      <button 
        onClick={() => scroll(scrollRef, 'right')}
        className="flex items-center justify-center pointer-events-auto h-full px-1 transition-opacity duration-200 hover:bg-background/30 group"
      >
        <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-muted-foreground" />
      </button>
    </div>
  )
} 