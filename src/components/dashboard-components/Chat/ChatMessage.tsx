"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { SourcesSection } from "./SourcesSection"
import { Source } from "./SourceCard"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"
import type { Components } from "react-markdown"
import { Check, ClipboardCopy } from "lucide-react"

export type ChatMessageType = {
  content: string
  role: "user" | "assistant"
}

interface ChatMessageProps {
  message: ChatMessageType
}

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  
  const language = className?.replace('language-', '') || 'text'
  const code = children?.toString() || ''
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="relative group my-4">
      <div className="absolute right-2 top-2">
        <button
          onClick={copyToClipboard}
          className="p-1.5 rounded bg-gray-700/30 hover:bg-gray-700/50 text-gray-300 hover:text-white transition-colors"
          aria-label="Copy code"
        >
          {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
        </button>
      </div>
      <pre className={`bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto relative ${language}`}>
        <code className="text-sm">{code}</code>
      </pre>
      {language !== 'text' && (
        <div className="absolute top-0 right-0 px-2 py-1 text-xs text-gray-400 bg-gray-900 rounded-bl-md rounded-tr-md">
          {language}
        </div>
      )}
    </div>
  )
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"
  
  // Extract sources from the message content if it's from the assistant
  const { cleanContent, sources } = useMemo(() => {
    if (isUser) return { cleanContent: message.content, sources: [] }
    
    let content = message.content
    const sources: Source[] = []
    
    // Check if there's a sources section in the content
    const sourcesMatch = content.match(/\n\n---\nSources:\n([\s\S]+)$/i)
    
    if (sourcesMatch) {
      // Remove the sources section from the content
      content = content.replace(sourcesMatch[0], '')
      
      // Parse the sources
      const sourcesText = sourcesMatch[1]
      const sourceLines = sourcesText.split('\n').filter(line => line.trim().length > 0)
      
      // Extract the sources
      for (const line of sourceLines) {
        const matches = line.match(/\[(\d+)\]\s+(.+?):\s+(https?:\/\/\S+)/)
        if (matches) {
          sources.push({
            title: matches[2].trim(),
            url: matches[3].trim()
          })
        }
      }
    }
    
    return { cleanContent: content, sources }
  }, [message.content, isUser])

  // Custom component overrides for markdown rendering
  const components: Components = {
    // Override the default link component for security
    a: (props) => (
      <a 
        {...props} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-blue-500 hover:underline"
      />
    ),
    // Add proper styling for code blocks
    code: (props) => {
      // Check if this is a code block (has className with language-*)
      if (props.className?.includes('language-')) {
        return <CodeBlock className={props.className}>{props.children}</CodeBlock>
      }
      return <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm" {...props} />
    },
    // Better styling for blockquotes
    blockquote: (props) => (
      <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-1 my-4 italic text-gray-600 dark:text-gray-300">
        {props.children}
      </blockquote>
    ),
    // Match headings to our design
    h1: (props) => <h1 className="text-xl font-bold my-4" {...props} />,
    h2: (props) => <h2 className="text-lg font-bold my-3" {...props} />,
    h3: (props) => <h3 className="text-base font-bold my-2" {...props} />,
    // Better list styles
    ul: (props) => <ul className="list-disc pl-6 my-4 space-y-2" {...props} />,
    ol: (props) => <ol className="list-decimal pl-6 my-4 space-y-2" {...props} />,
    li: (props) => <li className="mb-1" {...props} />,
    // Better table styling
    table: (props) => (
      <div className="my-4 w-full overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-md" {...props} />
      </div>
    ),
    thead: (props) => <thead className="bg-gray-50 dark:bg-gray-800" {...props} />,
    tbody: (props) => <tbody className="divide-y divide-gray-200 dark:divide-gray-700" {...props} />,
    tr: (props) => <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/70" {...props} />,
    th: (props) => <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" {...props} />,
    td: (props) => <td className="px-4 py-3 text-sm" {...props} />,
  }
  
  return (
    <div className={cn("flex gap-2 mb-4", isUser && "flex-row-reverse")}>
      <div className={cn(
        "size-8 rounded-full flex-shrink-0",
        isUser ? "bg-secondary" : "bg-primary"
      )} />
      <div className={cn(
        "rounded-lg p-4 max-w-3xl",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted"
      )}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{cleanContent}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={components}
            >
              {cleanContent}
            </ReactMarkdown>
          </div>
        )}
        
        {/* Display sources if available */}
        {!isUser && sources.length > 0 && (
          <SourcesSection sources={sources} />
        )}
      </div>
    </div>
  )
} 