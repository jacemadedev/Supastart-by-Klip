import { useState, useEffect, useCallback, useRef } from 'react'
import { useOrganizationContext } from '@/contexts/organization-context'
import type { 
  SessionWithInteractions,
  SessionWithSummary,
  CreateSessionRequest,
  CreateInteractionRequest,
  CreateArtifactRequest,
  UpdateSessionRequest,
  HistoryFilters,
  HistoryPagination,
  HistoryResponse 
} from '@/types/history'

export function useHistory() {
  const { organization } = useOrganizationContext()
  const [sessions, setSessions] = useState<SessionWithSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  
  // Request deduplication
  const currentRequestRef = useRef<AbortController | null>(null)

  // Fetch sessions with filters and pagination
  const fetchSessions = useCallback(async (
    filters?: HistoryFilters,
    pagination?: HistoryPagination,
    append = false
  ) => {
    if (!organization) return

    // Cancel any existing request to prevent race conditions
    if (currentRequestRef.current) {
      currentRequestRef.current.abort()
    }

    setLoading(true)
    setError(null)

    try {
      const searchParams = new URLSearchParams()
      
      // Add filters
      if (filters?.type && filters.type.length > 0) {
        searchParams.append('type', filters.type.join(','))
      }
      if (filters?.starred !== undefined) {
        searchParams.append('starred', filters.starred.toString())
      }
      if (filters?.archived !== undefined) {
        searchParams.append('archived', filters.archived.toString())
      }
      if (filters?.search) {
        searchParams.append('search', filters.search)
      }
      if (filters?.date_from) {
        searchParams.append('date_from', filters.date_from)
      }
      if (filters?.date_to) {
        searchParams.append('date_to', filters.date_to)
      }

      // Add pagination
      if (pagination?.limit) {
        searchParams.append('limit', pagination.limit.toString())
      }
      if (pagination?.offset) {
        searchParams.append('offset', pagination.offset.toString())
      }
      if (pagination?.order_by) {
        searchParams.append('order_by', pagination.order_by)
      }
      if (pagination?.order_direction) {
        searchParams.append('order_direction', pagination.order_direction)
      }

      // Add timeout and retry logic
      const controller = new AbortController()
      currentRequestRef.current = controller
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        const response = await fetch(`/api/history/sessions?${searchParams.toString()}`, {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
          },
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication required. Please log in again.')
          }
          if (response.status === 403) {
            throw new Error('You do not have permission to access this organization.')
          }
          if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.')
          }
          if (response.status >= 500) {
            throw new Error('Server error. Please try again in a few moments.')
          }
          
          // Try to get error details from response
          try {
            const errorData = await response.json()
            throw new Error(errorData.error || `Request failed with status ${response.status}`)
          } catch {
            throw new Error(`Request failed with status ${response.status}`)
          }
        }

        const data: HistoryResponse = await response.json()
        
        if (append) {
          setSessions(prev => [...prev, ...data.sessions])
        } else {
          setSessions(data.sessions)
        }
        
        setTotalCount(data.total_count)
        setHasMore(data.has_more)
      } catch (fetchError) {
        clearTimeout(timeoutId)
        
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          // Don't set error for user-cancelled requests
          return
        }
        throw fetchError
      } finally {
        // Clear the current request reference
        if (currentRequestRef.current === controller) {
          currentRequestRef.current = null
        }
      }
    } catch (err) {
      console.error('Error fetching sessions:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions')
    } finally {
      setLoading(false)
    }
  }, [organization])

  // Create a new session
  const createSession = useCallback(async (request: CreateSessionRequest) => {
    if (!organization) {
      throw new Error('No organization selected')
    }

    const response = await fetch('/api/history/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        organization_id: organization.id
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create session')
    }

    const { session } = await response.json()
    return session
  }, [organization])

  // Get a specific session
  const getSession = useCallback(async (sessionId: string) => {
    const response = await fetch(`/api/history/sessions/${sessionId}`)
    
    if (!response.ok) {
      throw new Error('Failed to fetch session')
    }

    const { session } = await response.json()
    return session as SessionWithInteractions
  }, [])

  // Update a session
  const updateSession = useCallback(async (sessionId: string, updates: UpdateSessionRequest) => {
    const response = await fetch(`/api/history/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update session')
    }

    const { session } = await response.json()
    
    // Update local state - preserve summary data
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { 
            ...s, 
            ...session,
            // Preserve the summary data since update doesn't return it
            interaction_count: s.interaction_count,
            latest_artifacts: s.latest_artifacts
          } 
        : s
    ))
    
    return session
  }, [])

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    const response = await fetch(`/api/history/sessions/${sessionId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete session')
    }

    // Update local state
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }, [])

  // Create an interaction
  const createInteraction = useCallback(async (request: CreateInteractionRequest) => {
    const response = await fetch('/api/history/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create interaction')
    }

    const { interaction } = await response.json()
    return interaction
  }, [])

  // Create an artifact
  const createArtifact = useCallback(async (request: CreateArtifactRequest) => {
    const response = await fetch('/api/history/artifacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create artifact')
    }

    const { artifact } = await response.json()
    return artifact
  }, [])

  // Delete an artifact
  const deleteArtifact = useCallback(async (artifactId: string) => {
    const response = await fetch(`/api/history/artifacts/${artifactId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete artifact')
    }

    return response.json()
  }, [])

  // Star/unstar a session
  const toggleSessionStar = useCallback(async (sessionId: string, starred: boolean) => {
    return updateSession(sessionId, { starred })
  }, [updateSession])

  // Archive/unarchive a session
  const toggleSessionArchive = useCallback(async (sessionId: string, archived: boolean) => {
    return updateSession(sessionId, { archived })
  }, [updateSession])

  // Load initial sessions when organization changes
  useEffect(() => {
    if (organization) {
      fetchSessions()
    }
  }, [organization, fetchSessions])

  return {
    // State
    sessions,
    loading,
    error,
    totalCount,
    hasMore,
    
    // Actions
    fetchSessions,
    createSession,
    getSession,
    updateSession,
    deleteSession,
    createInteraction,
    createArtifact,
    deleteArtifact,
    toggleSessionStar,
    toggleSessionArchive,
  }
} 