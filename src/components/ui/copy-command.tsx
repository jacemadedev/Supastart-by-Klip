'use client'

import { useState } from 'react'
import { Copy, CheckIcon } from 'lucide-react'

interface CopyCommandProps {
  command: string
  label?: string
  className?: string
}

export function CopyCommand({ command, label, className = '' }: CopyCommandProps) {
  const [copied, setCopied] = useState(false)

  const copyCommand = () => {
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {label && <span className="text-sm text-slate-500 dark:text-slate-400">{label}:</span>}
      <div className="relative flex-1 max-w-xs overflow-hidden rounded-lg bg-slate-100 p-2 text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100">
        <code className="truncate block pr-7">{command}</code>
        <button
          onClick={copyCommand}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          aria-label="Copy command"
        >
          {copied ? (
            <CheckIcon size={15} />
          ) : (
            <Copy size={15} />
          )}
        </button>
      </div>
    </div>
  )
} 