"use client"

import { useState, useEffect, Suspense } from "react"
import { ChatContainer, ChatContainerRef } from "@/components/dashboard-components/Chat"
import { ChatMessageType } from "@/components/dashboard-components/Chat/ChatMessage"
import { useOrganizationContext } from "@/contexts/organization-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { canMemberUseFeature } from "@/lib/organization/permissions"

import { useRouter, useSearchParams } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { useHistory } from "@/hooks/useHistory"
import type { SessionWithInteractions } from "@/types/history"
import { ChatInput } from "@/components/dashboard-components/Chat/ChatInput"
import { useRef } from "react"

function ChatPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { getSession } = useHistory()
  const chatContainerRef = useRef<ChatContainerRef>(null)
  
  // Session management
  const sessionId = searchParams.get('session')
  const [currentSession, setCurrentSession] = useState<SessionWithInteractions | null>(null)
  const [initialMessages, setInitialMessages] = useState<ChatMessageType[]>([])
  
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [agentEnabled, setAgentEnabled] = useState(false)
  const { organization, userRole, updateOrganizationState } = useOrganizationContext()
  const [mismatch, setMismatch] = useState(false)
  const [actualOrgName, setActualOrgName] = useState<string | null>(null)
  

  const [sessionLoading, setSessionLoading] = useState(false)
  const [justCreatedSession, setJustCreatedSession] = useState<string | null>(null)
  
  // Calculate permission status
  const canUseAgents = canMemberUseFeature(organization, userRole, "agents")
  
  // Load session if sessionId is provided (but not if we already have it)
  useEffect(() => {
    const loadSession = async () => {
      // Don't load if:
      // 1. No sessionId provided
      // 2. No organization context
      // 3. We already have this session loaded
      // 4. This is a session we just created
      if (!sessionId || !organization) {
        return
      }
      
      if (currentSession?.id === sessionId) {
        // We already have this session loaded, no need to fetch again
        return
      }
      
      if (sessionId === justCreatedSession) {
        // Clear the flag if this is the session we just created
        setJustCreatedSession(null)
        return
      }
      
      // Only load from database if we don't already have this session
      setSessionLoading(true)
      try {
        const session = await getSession(sessionId)
        setCurrentSession(session)
        
        // Convert interactions to ChatMessageType format
        const messages: ChatMessageType[] = session.interactions
          .filter(i => i.type === 'user_message' || i.type === 'assistant_message')
          .map(i => ({
            role: i.type === 'user_message' ? 'user' : 'assistant',
            content: i.content || ''
          }))
        
        setInitialMessages(messages)
        // Set web search based on session metadata
        if (session.metadata?.webSearch) {
          setWebSearchEnabled(true)
        }
      } catch (error) {
        console.error('Failed to load session:', error)
        // Could show a toast error here
      } finally {
        setSessionLoading(false)
      }
    }
    
    loadSession()
  }, [sessionId, organization, getSession, justCreatedSession, currentSession?.id])



  // Check if the current organization in UI matches the one in the database
  useEffect(() => {
    const verifyCurrentOrganization = async () => {
      if (!organization) return;
      
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_organization_id')
        .eq('id', user.id)
        .single();
      
      if (profile?.current_organization_id && profile.current_organization_id !== organization.id) {
        setMismatch(true);
        
        // Get the actual organization name
        const { data: actualOrg } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', profile.current_organization_id)
          .single();
          
        setActualOrgName(actualOrg?.name || "Unknown organization");
        
        // Auto-sync on mismatch
        await updateOrganizationState();
      } else {
        setMismatch(false);
        setActualOrgName(null);
      }
    };
    
    verifyCurrentOrganization();
  }, [organization, updateOrganizationState]);

  const handleSendMessage = async (message: string, previousMessages: ChatMessageType[] = [], sessionId?: string, approvals?: Record<string, boolean>) => {
    // Check chat permission before proceeding
    if (!canMemberUseFeature(organization, userRole, "chat")) {
      // Return error message instead of throwing to maintain consistent error handling
      return "You don't have permission to use the chat feature in this organization. Please contact your organization owner for access.";
    }

    try {
      // Choose API endpoint based on agent mode and permissions
      const apiEndpoint = (agentEnabled && canUseAgents) ? "/api/chat-agent" : "/api/chat";
      
              // Prepare request body based on mode and permissions
        const requestBody = (agentEnabled && canUseAgents) ? {
        message,
        sessionId: sessionId || currentSession?.id,
        conversationHistory: previousMessages,
        agentMode: true,
        approvals
      } : {
        message,
        useWebSearch: webSearchEnabled,
        history: previousMessages,
        sessionId: sessionId || currentSession?.id
      };
      
      // Use streaming response
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // For error handling, we need to get the JSON response
        try {
          const contentType = response.headers.get('content-type');
          
          // Only try to parse as JSON if the content type is application/json
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            console.error("Error from chat API:", errorData, "Status:", response.status);
            
            // Return a more specific error message based on the status code
            if (response.status === 402) {
              return "Insufficient credits. Please add more credits to continue using this feature.";
            } else if (response.status === 401) {
              return "You need to be logged in to use this feature.";
            } else if (response.status === 400) {
              return "Please select an organization before using this feature.";
            } else {
              return errorData.error || "Sorry, I encountered an error. Please try again.";
            }
          } else {
            // If not JSON, log the text content
            const textError = await response.text();
            console.error("Non-JSON error from chat API:", textError, "Status:", response.status);
            return `Error (${response.status}): Please try again.`;
          }
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
          return `Error (${response.status}): Unable to process response.`;
        }
      }

      // Return the response object for streaming
      return response;
    } catch (error) {
      console.error("Failed to send message:", error);
      return "Sorry, I encountered an error. Please try again.";
    }
  }
  
  // Skeleton loading component for chat UI
  const ChatSkeleton = () => (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-end">
        <Skeleton className="h-6 w-40" />
      </div>
      
      {/* Chat messages skeleton */}
      <div className="space-y-6">
        {/* User message skeleton */}
        <div className="flex gap-2 justify-end">
          <div className="flex flex-col space-y-2 max-w-[80%]">
            <Skeleton className="h-8 w-48 ml-auto rounded-lg" />
          </div>
          <Skeleton className="size-8 rounded-full flex-shrink-0" />
        </div>
        
        {/* AI response skeleton */}
        <div className="flex gap-2">
          <Skeleton className="size-8 rounded-full flex-shrink-0" />
          <div className="flex flex-col space-y-2 max-w-[80%]">
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      </div>
      
      {/* Input skeleton */}
      <div className="mt-auto">
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    </div>
  )
  
  // Handle session change (when a new session is created)
  const handleSessionChange = (newSessionId: string) => {
    // Mark this as a newly created session to avoid unnecessary loading
    setJustCreatedSession(newSessionId)
    
    // Create a lightweight session object to avoid refetching
    setCurrentSession({
      id: newSessionId,
      organization_id: organization?.id || '',
      user_id: '',
      type: 'chat',
      title: 'New Chat',
      metadata: { webSearch: webSearchEnabled },
      starred: false,
      archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      interactions: []
    })
    
    // Update URL with session parameter
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('session', newSessionId)
    router.replace(newUrl.pathname + newUrl.search, { scroll: false })
  }
  
    // Show skeleton loading while loading session
  if (sessionLoading) {
    return (
      <div className="grid gap-4 w-full">
        <ChatSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full relative">
      {mismatch && (
        <Alert variant="warning" className="max-w-4xl mx-auto mb-4 flex-shrink-0">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <span>
              Chat is currently using credits from <strong>{actualOrgName}</strong> instead of <strong>{organization?.name}</strong>.
              Use the Force Sync option in the organization menu to fix this.
            </span>
          </AlertDescription>
        </Alert>
      )}
      
      {organization && (
        <div className="max-w-4xl mx-auto mb-4 px-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                agentEnabled && canUseAgents
                  ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' 
                  : 'bg-gray-500/10 text-gray-600 border border-gray-500/20'
              }`}>
                {agentEnabled && canUseAgents ? '🤖 Agent Mode' : '💬 Traditional Mode'}
              </span>
              {webSearchEnabled && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 border border-green-500/20">
                  🌐 Web Search
                </span>
              )}
            </div>
            <span className="text-xs sm:text-sm">Using credits from: <strong>{mismatch ? actualOrgName : organization.name}</strong></span>
          </div>
        </div>
      )}
      
      {/* Chat messages area with bottom padding for sticky input */}
      <div className="flex-1 overflow-hidden pb-40">
        <ChatContainer 
          initialMessages={initialMessages}
          onSendMessage={handleSendMessage}
          streamingEnabled={true}
          webSearchEnabled={webSearchEnabled}
          onToggleWebSearch={setWebSearchEnabled}
          agentEnabled={agentEnabled && canUseAgents}
          onToggleAgent={canUseAgents ? setAgentEnabled : undefined}
          sessionId={currentSession?.id}
          onSessionChange={handleSessionChange}
          showInput={false}
          ref={chatContainerRef}
        />
      </div>
      
      {/* Sticky chat input at bottom of screen */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        {/* Account for sidebar on desktop */}
        <div className="ml-0 md:ml-64 p-4">
          <div className="max-w-4xl mx-auto">
            <ChatInput 
              onSendMessage={(content: string) => {
                chatContainerRef.current?.sendMessage(content)
              }}
              isLoading={chatContainerRef.current?.isLoading || false}
              webSearchEnabled={webSearchEnabled}
              onToggleWebSearch={setWebSearchEnabled}
              agentEnabled={agentEnabled && canUseAgents}
              onToggleAgent={canUseAgents ? setAgentEnabled : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="grid gap-4 w-full">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          {/* Header skeleton */}
          <div className="flex justify-end">
            <div className="h-6 w-40 bg-muted animate-pulse rounded" />
          </div>
          
          {/* Chat messages skeleton */}
          <div className="space-y-6">
            {/* User message skeleton */}
            <div className="flex gap-2 justify-end">
              <div className="flex flex-col space-y-2 max-w-[80%]">
                <div className="h-8 w-48 ml-auto bg-muted animate-pulse rounded-lg" />
              </div>
              <div className="size-8 bg-muted animate-pulse rounded-full flex-shrink-0" />
            </div>
            
            {/* AI response skeleton */}
            <div className="flex gap-2">
              <div className="size-8 bg-muted animate-pulse rounded-full flex-shrink-0" />
              <div className="flex flex-col space-y-2 max-w-[80%]">
                <div className="h-20 w-full bg-muted animate-pulse rounded-lg" />
              </div>
            </div>
          </div>
          
          {/* Input skeleton */}
          <div className="mt-auto">
            <div className="h-14 w-full bg-muted animate-pulse rounded-lg" />
          </div>
        </div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  )
} 