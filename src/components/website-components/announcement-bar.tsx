import React from 'react'
import Link from 'next/link'

export default function AnnouncementBar() {
  return (
    <div className="w-full bg-primary/10 dark:bg-primary/20 py-2.5 px-4 text-center text-sm">
      <p className="font-medium">
        <span className="mr-1">✨</span> 
        This is a starter kit for vibe coders called 
        <Link 
          href="https://supastart.dev" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="font-bold text-primary mx-1.5 hover:underline"
        >
          Supastart
        </Link>
        <span className="ml-1">✨</span>
      </p>
    </div>
  )
} 