"use client"

import { useState } from "react"
import { Source, SourceCard } from "./SourceCard"
import { Button } from "@/components/ui/button"
import { Link2Icon } from "lucide-react"

interface SourcesSectionProps {
  sources: Source[];
  initialVisibleCount?: number;
}

export function SourcesSection({ sources, initialVisibleCount = 3 }: SourcesSectionProps) {
  const [showAll, setShowAll] = useState(false)
  
  // Only show the initial number of sources unless showAll is true
  const visibleSources = showAll ? sources : sources.slice(0, initialVisibleCount)
  const hasMoreSources = sources.length > initialVisibleCount
  
  if (sources.length === 0) return null
  
  return (
    <div className="mt-4 mb-2">
      <div className="flex items-center gap-2 mb-3">
        <Link2Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Sources</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {visibleSources.map((source, index) => (
          <SourceCard key={index} source={source} index={index} />
        ))}
      </div>
      
      {hasMoreSources && !showAll && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="mt-2 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-300"
          onClick={() => setShowAll(true)}
        >
          View {sources.length - initialVisibleCount} more
        </Button>
      )}
    </div>
  )
} 