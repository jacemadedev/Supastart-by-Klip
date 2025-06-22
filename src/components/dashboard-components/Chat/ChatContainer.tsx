"use client"

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { ChatInput } from "./ChatInput"
import { ChatHistory } from "./ChatHistory"
import { ChatMessageType } from "./ChatMessage"
import { LoadingMessage } from "./LoadingMessage"
import ApprovalMessage from "./ApprovalMessage"

interface ApprovalRequest {
  id: string
  toolName: string
  arguments: Record<string, unknown>
  agent: string
  timestamp: number
}

interface ChatContainerProps {
  initialMessages?: ChatMessageType[]
  onSendMessage?: (message: string, previousMessages: ChatMessageType[], sessionId?: string, approvals?: Record<string, boolean>) => Promise<Response | string | null>
  streamingEnabled?: boolean
  webSearchEnabled?: boolean
  onToggleWebSearch?: (enabled: boolean) => void
  agentEnabled?: boolean
  onToggleAgent?: (enabled: boolean) => void
  sessionId?: string
  onSessionChange?: (sessionId: string) => void
  showInput?: boolean
}

export interface ChatContainerRef {
  sendMessage: (content: string) => void
  isLoading: boolean
}

export const ChatContainer = forwardRef<ChatContainerRef, ChatContainerProps>(({ 
  initialMessages = [],
  onSendMessage,
  streamingEnabled = true,
  webSearchEnabled = false,
  onToggleWebSearch,
  agentEnabled = false,
  onToggleAgent,
  sessionId,
  onSessionChange,
  showInput = true
}: ChatContainerProps, ref) => {
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(sessionId)
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([])
  const [pendingContext, setPendingContext] = useState<{
    message: string
    conversationHistory: ChatMessageType[]
    sessionId?: string
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const isEmpty = messages.length === 0

  // Sync messages when initialMessages changes (for loading history)
  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  // Update session ID when it changes
  useEffect(() => {
    setCurrentSessionId(sessionId)
  }, [sessionId])

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, pendingApprovals])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleApprove = (requestId: string) => {
    const approvedRequest = pendingApprovals.find(req => req.id === requestId)
    if (approvedRequest && pendingContext) {
      // Remove this specific approval request
      setPendingApprovals(prev => prev.filter(req => req.id !== requestId))
      
      // If this was the last approval, continue with the request
      if (pendingApprovals.length === 1) {
        continueWithApprovals({ [requestId]: true })
      }
    }
  }

  const handleReject = (requestId: string) => {
    const rejectedRequest = pendingApprovals.find(req => req.id === requestId)
    if (rejectedRequest) {
      // Remove this specific approval request
      setPendingApprovals(prev => prev.filter(req => req.id !== requestId))
      
      // If this was the last approval, continue with rejection
      if (pendingApprovals.length === 1) {
        continueWithApprovals({ [requestId]: false })
      }
    }
  }

  const handleApproveAll = () => {
    const approvals: Record<string, boolean> = {}
    pendingApprovals.forEach(req => {
      approvals[req.id] = true
    })
    setPendingApprovals([])
    continueWithApprovals(approvals)
  }

  const handleRejectAll = () => {
    const approvals: Record<string, boolean> = {}
    pendingApprovals.forEach(req => {
      approvals[req.id] = false
    })
    setPendingApprovals([])
    continueWithApprovals(approvals)
  }

  const continueWithApprovals = async (approvals: Record<string, boolean>) => {
    if (!pendingContext || !onSendMessage) return

    const { message, conversationHistory, sessionId: pendingSessionId } = pendingContext
    setPendingContext(null)
    setIsLoading(true)

    try {
      const response = await onSendMessage(message, conversationHistory, pendingSessionId, approvals)
      
      if (response instanceof Response) {
        const contentType = response.headers.get('content-type')
        
        if (contentType?.includes('application/json')) {
          const data = await response.json()
          
          // Handle approval requests
          if (data.status === 'pending_approval' && data.approvalRequests) {
            setPendingApprovals(data.approvalRequests)
            setPendingContext({
              message: message,
              conversationHistory: conversationHistory,
              sessionId: pendingSessionId
            })
            setIsLoading(false)
            return
          }
          
          // Handle regular JSON response
          if (data.message) {
            const assistantMessage: ChatMessageType = { role: "assistant", content: data.message }
            setMessages(prev => [...prev, assistantMessage])
            
            // Check if we got a new session ID from the JSON response (agent mode)
            if (data.sessionId && data.sessionId !== currentSessionId) {
              setCurrentSessionId(data.sessionId)
              onSessionChange?.(data.sessionId)
            }
            
            setIsLoading(false)
            return
          }
        } else {
          // Handle streaming response only if it's not JSON
          if (streamingEnabled) {
            await handleStreamingResponse(response)
          }
        }
      } else if (typeof response === "string") {
        const assistantMessage: ChatMessageType = { role: "assistant", content: response }
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error("Error continuing with approvals:", error)
      const errorMessage: ChatMessageType = { 
        role: "assistant", 
        content: "I apologize, but an error occurred while processing your request." 
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleStreamingResponse = async (response: Response) => {
    // Check if we got a new session ID from the response
    const newSessionId = response.headers.get('X-Session-Id')
    let shouldUpdateURL = false
    
    if (newSessionId && newSessionId !== currentSessionId) {
      setCurrentSessionId(newSessionId)
      shouldUpdateURL = true
    }
    
    // Create an empty assistant message
    const assistantMessage: ChatMessageType = { role: "assistant", content: "" }
    setMessages(prev => [...prev, assistantMessage])
    
    // Set up streaming reader
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    
    if (!reader) {
      throw new Error("Stream reader not available")
    }
    
    // Read and process the stream
    let fullText = ""
    let done = false
    
    while (!done) {
      const { value, done: doneReading } = await reader.read()
      done = doneReading
      
      if (value) {
        const text = decoder.decode(value, { stream: !done })
        fullText += text
        
        // Update the assistant's message with the complete text
        setMessages(prev => {
          const updated = [...prev]
          const lastMessage = updated[updated.length - 1]
          if (lastMessage.role === "assistant") {
            lastMessage.content = fullText
          }
          return updated
        })
      }
    }
    
    // Only update URL after streaming is complete
    if (shouldUpdateURL && newSessionId) {
      onSessionChange?.(newSessionId)
    }
  }

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: ChatMessageType = { role: "user", content }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    
    if (onSendMessage) {
      setIsLoading(true)
      try {
        // Pass all previous messages for context and current session ID
        const response = await onSendMessage(content, updatedMessages, currentSessionId)
        
        // Check if response is a JSON response with approval requests
        if (response instanceof Response) {
          const contentType = response.headers.get('content-type')
          
          if (contentType?.includes('application/json')) {
            const data = await response.json()
            
            // Handle approval requests
            if (data.status === 'pending_approval' && data.approvalRequests) {
              setPendingApprovals(data.approvalRequests)
              setPendingContext({
                message: content,
                conversationHistory: updatedMessages,
                sessionId: currentSessionId
              })
              setIsLoading(false)
              return
            }
            
            // Handle regular JSON response
            if (data.message) {
              const assistantMessage: ChatMessageType = { role: "assistant", content: data.message }
              setMessages(prev => [...prev, assistantMessage])
              
              // Check if we got a new session ID from the JSON response (agent mode)
              if (data.sessionId && data.sessionId !== currentSessionId) {
                setCurrentSessionId(data.sessionId)
                onSessionChange?.(data.sessionId)
              }
              
              setIsLoading(false)
              return
            }
          } else {
            // Handle streaming response only if it's not JSON
            if (streamingEnabled) {
              await handleStreamingResponse(response)
            }
          }
        } else if (typeof response === "string") {
          // Handle non-streaming response
          const assistantMessage: ChatMessageType = { role: "assistant", content: response }
          setMessages(prev => [...prev, assistantMessage])
        }
      } catch (error) {
        console.error("Error sending message:", error)
        const errorMessage: ChatMessageType = { 
          role: "assistant", 
          content: "I apologize, but an error occurred while processing your request." 
        }
        setMessages(prev => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
      }
    }
  }

  useImperativeHandle(ref, () => ({
    sendMessage: handleSendMessage,
    isLoading: isLoading
  }))

  if (isEmpty) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex flex-col items-center justify-center flex-1 -mt-16">
          <div className="w-full max-w-3xl px-4 text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-2">How can I help you today?</h1>
            <p className="text-lg text-muted-foreground mb-5">Ask me anything or start a conversation</p>
          </div>
          {pendingApprovals.length > 0 && (
            <div className="w-full max-w-3xl px-4 mb-8">
              <ApprovalMessage
                approvalRequests={pendingApprovals}
                onApprove={handleApprove}
                onReject={handleReject}
                onApproveAll={handleApproveAll}
                onRejectAll={handleRejectAll}
              />
            </div>
          )}
        </div>
        <div className="flex-shrink-0 w-full max-w-3xl mx-auto px-4 pb-5">
          {showInput && (
            <ChatInput 
              onSendMessage={handleSendMessage} 
              isLoading={isLoading} 
              webSearchEnabled={webSearchEnabled}
              onToggleWebSearch={onToggleWebSearch}
              agentEnabled={agentEnabled}
              onToggleAgent={onToggleAgent}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full mx-auto max-w-4xl w-full">
      <div className="flex-1 px-4 overflow-y-auto min-h-0">
        <ChatHistory messages={messages} />
        {pendingApprovals.length > 0 && (
          <div className="mb-6">
            <ApprovalMessage
              approvalRequests={pendingApprovals}
              onApprove={handleApprove}
              onReject={handleReject}
              onApproveAll={handleApproveAll}
              onRejectAll={handleRejectAll}
            />
          </div>
        )}
        {isLoading && <LoadingMessage />}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex-shrink-0 w-full px-4 pb-5">
        {showInput && (
          <ChatInput 
            onSendMessage={handleSendMessage} 
            isLoading={isLoading}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={onToggleWebSearch}
            agentEnabled={agentEnabled}
            onToggleAgent={onToggleAgent}
          />
        )}
      </div>
    </div>
  )
})

ChatContainer.displayName = 'ChatContainer' 