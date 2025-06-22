"use client"

import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Source {
  title: string;
  url: string;
}

interface SourceCardProps {
  source: Source;
  index: number;
}

export function SourceCard({ source, index }: SourceCardProps) {
  // Extract domain from URL for display
  let domain = ""
  try {
    domain = new URL(source.url).hostname.replace("www.", "")
  } catch {
    domain = source.url
  }
  
  return (
    <a 
      href={source.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={cn(
        "flex flex-col p-3 rounded-lg transition-colors border group",
        "bg-gray-50 hover:bg-gray-100 border-gray-200",
        "dark:bg-gray-800/60 dark:hover:bg-gray-800 dark:border-gray-700"
      )}
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          #{index + 1}
        </span>
        <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300 flex-shrink-0" />
      </div>
      
      <h3 className="font-medium text-sm text-gray-800 dark:text-gray-200 line-clamp-2 mb-1">
        {source.title || "Untitled Source"}
      </h3>
      
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {domain}
      </span>
    </a>
  )
} 