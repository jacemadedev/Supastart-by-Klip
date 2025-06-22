"use client"

import { useEffect, useRef } from "react"
import { ChatMessage, ChatMessageType } from "./ChatMessage"

interface ChatHistoryProps {
  messages: ChatMessageType[]
}

export function ChatHistory({ messages }: ChatHistoryProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No messages yet. Start a conversation!</p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto">
      {messages.map((message, index) => (
        <ChatMessage key={index} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
} 