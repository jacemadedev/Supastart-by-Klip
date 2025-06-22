"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  MessageSquare, 
  Image, 
  Bot, 
  Star, 
  Search, 
  Calendar,
  Trash2,
  Eye,
  Sparkles,
  History
} from "lucide-react"
import { useHistory } from "@/hooks/useHistory"
import { formatDistanceToNow } from "date-fns"
import type { SessionType, HistoryFilters } from "@/types/history"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"

const sessionTypeIcons = {
  chat: MessageSquare,
  sandbox: Image,
  agent: Bot,
  magic_ads: Sparkles
}

const sessionTypeColors = {
  chat: "bg-blue-100 text-blue-800",
  sandbox: "bg-purple-100 text-purple-800", 
  agent: "bg-green-100 text-green-800",
  magic_ads: "bg-amber-100 text-amber-800"
}



export default function HistoryPage() {
  const router = useRouter()
  const { 
    sessions, 
    loading, 
    error, 
    totalCount, 
    hasMore, 
    fetchSessions,
    deleteSession,
    toggleSessionStar 
  } = useHistory()

  const [activeTab, setActiveTab] = useState<'all' | SessionType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at' | 'title'>('updated_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showStarredOnly, setShowStarredOnly] = useState(false)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Memoize filters to prevent unnecessary re-renders
  const filters = useMemo((): HistoryFilters => ({
    search: debouncedSearchQuery || undefined,
    starred: showStarredOnly || undefined,
    type: activeTab !== 'all' ? [activeTab] : undefined,
  }), [debouncedSearchQuery, showStarredOnly, activeTab])

  // Memoize pagination to prevent unnecessary re-renders
  const pagination = useMemo(() => ({
    limit: 5,
    offset: 0,
    order_by: sortBy,
    order_direction: sortDirection
  }), [sortBy, sortDirection])

  // Apply filters and fetch data - now with proper dependencies
  useEffect(() => {
    fetchSessions(filters, pagination)
  }, [filters, pagination, fetchSessions])

  const handleSessionClick = (session: typeof sessions[0]) => {
    if (session.type === 'chat') {
      router.push(`/dashboard/chat?session=${session.id}`)
    } else if (session.type === 'sandbox') {
      router.push(`/dashboard/sandbox?session=${session.id}`)
    } else if (session.type === 'magic_ads') {
      router.push(`/dashboard/magic-ads?session=${session.id}`)
    }
    // TODO: Add agent routing when implemented
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  const handleToggleStar = async (sessionId: string, starred: boolean) => {
    try {
      await toggleSessionStar(sessionId, !starred)
    } catch (error) {
      console.error('Failed to toggle star:', error)
    }
  }

  // Memoized helper function to extract the latest image URL from a session's artifacts
  const getLatestSessionImage = useMemo(() => {
    const imageCache = new Map<string, string | null>()
    
    return (session: typeof sessions[0]) => {
      if ((session.type !== 'sandbox' && session.type !== 'magic_ads') || !session.latest_artifacts) return null
      
      // Use cache key based on session ID and updated_at to handle updates
      const cacheKey = `${session.id}-${session.updated_at}`
      if (imageCache.has(cacheKey)) {
        return imageCache.get(cacheKey)!
      }
      
      // Handle case where latest_artifacts might be a JSON string or not an array
      let artifacts: { type: string; url?: string; created_at?: string }[] = []
      try {
        if (typeof session.latest_artifacts === 'string') {
          artifacts = JSON.parse(session.latest_artifacts)
        } else if (Array.isArray(session.latest_artifacts)) {
          artifacts = session.latest_artifacts
        } else {
          imageCache.set(cacheKey, null)
          return null
        }
      } catch (error) {
        console.error('Error parsing latest_artifacts:', error)
        imageCache.set(cacheKey, null)
        return null
      }
      
      // Find the most recent image artifact
      const imageArtifacts = artifacts
        .filter((artifact) => artifact.type === 'image' && artifact.url)
        .sort((a, b) => {
          // Sort by created_at if available, otherwise maintain original order
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          }
          return 0
        })
      
      const result = imageArtifacts.length > 0 ? imageArtifacts[0].url! : null
      imageCache.set(cacheKey, result)
      return result
    }
  }, []) // Empty dependency array since we want this to persist

  if (error) {
    return (
      <div className="grid gap-4">
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Error loading history: {error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:gap-6 pb-4 md:pb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">History</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={showStarredOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowStarredOnly(!showStarredOnly)}
            className="text-xs md:text-sm"
          >
            <Star className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
            Starred
          </Button>
        </div>
      </div>

      {/* Search and filters */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Mobile-optimized sort controls */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-1 overflow-x-auto pb-1">
                <Button
                  variant={sortBy === 'updated_at' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('updated_at')}
                  className="flex-shrink-0 text-xs md:text-sm px-2 md:px-3"
                >
                  Updated
                </Button>
                <Button
                  variant={sortBy === 'created_at' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('created_at')}
                  className="flex-shrink-0 text-xs md:text-sm px-2 md:px-3"
                >
                  Created
                </Button>
                <Button
                  variant={sortBy === 'title' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('title')}
                  className="flex-shrink-0 text-xs md:text-sm px-2 md:px-3"
                >
                  Title
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="self-start md:self-auto min-w-[44px]"
              >
                <span className="md:hidden">{sortDirection === 'desc' ? '↓ Newest' : '↑ Oldest'}</span>
                <span className="hidden md:inline">{sortDirection === 'desc' ? '↓' : '↑'}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-max md:w-auto">
            <TabsTrigger value="all" className="text-xs md:text-sm px-2 md:px-3">
              <span className="md:hidden">All</span>
              <span className="hidden md:inline">All ({totalCount})</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs md:text-sm px-2 md:px-3">
              <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="sandbox" className="text-xs md:text-sm px-2 md:px-3">
              <Image className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" aria-label="Sandbox icon" />
              <span className="hidden sm:inline">Sandbox</span>
              <span className="sm:hidden">Box</span>
            </TabsTrigger>
            <TabsTrigger value="magic_ads" className="text-xs md:text-sm px-2 md:px-3">
              <Sparkles className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Magic Ads</span>
              <span className="sm:hidden">Ads</span>
            </TabsTrigger>
            <TabsTrigger value="agent" className="text-xs md:text-sm px-2 md:px-3">
              <Bot className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Agents</span>
              <span className="sm:hidden">Bot</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="space-y-3 md:space-y-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-start gap-3 md:gap-4">
                      <div className="flex-shrink-0">
                        <Skeleton className="h-8 w-8 md:h-10 md:w-10 rounded-full" />
                      </div>
                      <div className="flex-1 space-y-2 md:space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-4 w-32 md:h-5 md:w-48" />
                              <Skeleton className="h-4 w-12 md:h-5 md:w-16 rounded-full" />
                            </div>
                            <Skeleton className="h-3 w-48 md:h-4 md:w-72" />
                            <div className="flex gap-1 md:gap-2 mt-2">
                              <Skeleton className="h-12 w-12 md:h-16 md:w-16 rounded-md" />
                              <Skeleton className="h-12 w-12 md:h-16 md:w-16 rounded-md" />
                              <Skeleton className="h-12 w-12 md:h-16 md:w-16 rounded-md" />
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Skeleton className="h-8 w-8 rounded" />
                            <Skeleton className="h-8 w-8 rounded md:inline hidden" />
                            <Skeleton className="h-8 w-8 rounded md:inline hidden" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2 md:gap-4">
                            <Skeleton className="h-3 w-16 md:w-24" />
                            <Skeleton className="h-3 w-12 md:w-20" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-4 md:p-6 text-center">
                <div className="text-destructive space-y-3 md:space-y-4">
                  <h3 className="font-medium text-sm md:text-base">Failed to load sessions</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="min-h-[44px] px-6"
                    onClick={() => {
                      const filters: HistoryFilters = {
                        search: searchQuery || undefined,
                        starred: showStarredOnly || undefined,
                        type: activeTab !== 'all' ? [activeTab] : undefined,
                      }
                      const pagination = {
                        limit: 5,
                        offset: 0,
                        order_by: sortBy,
                        order_direction: sortDirection
                      }
                      fetchSessions(filters, pagination)
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="p-4 md:p-6 text-center">
                <div className="text-muted-foreground space-y-3 md:space-y-4">
                  <div className="mx-auto w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted flex items-center justify-center mb-3 md:mb-4">
                    {activeTab === 'all' && <History className="h-5 w-5 md:h-6 md:w-6" />}
                    {activeTab === 'chat' && <MessageSquare className="h-5 w-5 md:h-6 md:w-6" />}
                    {activeTab === 'sandbox' && <Image className="h-5 w-5 md:h-6 md:w-6" aria-label="Sandbox icon" />}
                    {activeTab === 'magic_ads' && <Sparkles className="h-5 w-5 md:h-6 md:w-6" />}
                    {activeTab === 'agent' && <Bot className="h-5 w-5 md:h-6 md:w-6" />}
                  </div>
                  <h3 className="font-medium text-sm md:text-base">
                    {searchQuery || showStarredOnly 
                      ? 'No sessions match your filters' 
                      : `No ${activeTab === 'all' ? '' : activeTab} sessions yet`
                    }
                  </h3>
                  <p className="text-xs md:text-sm">
                    {!searchQuery && !showStarredOnly && activeTab === 'all' && 
                      'Start a conversation or create something in the sandbox!'
                    }
                    {!searchQuery && !showStarredOnly && activeTab === 'chat' && 
                      'Start your first conversation in the chat!'
                    }
                    {!searchQuery && !showStarredOnly && activeTab === 'sandbox' && 
                      'Create your first image in the sandbox!'
                    }
                    {!searchQuery && !showStarredOnly && activeTab === 'magic_ads' && 
                      'Generate your first ad in Magic Ads!'
                    }
                    {!searchQuery && !showStarredOnly && activeTab === 'agent' && 
                      'Set up your first agent monitor!'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {sessions.map((session) => {
                const Icon = sessionTypeIcons[session.type]
                const latestImage = getLatestSessionImage(session)
                
                return (
                  <Card 
                    key={session.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99] md:active:scale-100"
                    onClick={() => handleSessionClick(session)}
                  >
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-muted flex items-center justify-center">
                            <Icon className="h-4 w-4 md:h-5 md:w-5" />
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium truncate text-sm md:text-base">
                                  {session.title || `${session.type.charAt(0).toUpperCase() + session.type.slice(1)} Session`}
                                </h3>
                                <Badge className={`${sessionTypeColors[session.type]} text-xs px-1.5 py-0.5 md:px-2 md:py-1`}>
                                  <span className="md:hidden">{session.type.charAt(0).toUpperCase()}</span>
                                  <span className="hidden md:inline">{session.type}</span>
                                </Badge>
                                {session.starred && (
                                  <Star className="h-3 w-3 md:h-4 md:w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                                )}
                              </div>
                              
                              {session.description && (
                                <p className="text-xs md:text-sm text-muted-foreground mb-2 line-clamp-2">
                                  {session.description}
                                </p>
                              )}
                              
                              {/* Mobile: Move image to same row as content */}
                              <div className="flex items-center justify-between">
                                {/* Latest image preview for sandbox and magic_ads sessions */}
                                {latestImage && (
                                  <div className="md:mb-3">
                                    <img 
                                      src={latestImage} 
                                      alt={`Latest generated image from ${session.type} session`}
                                      className="h-12 w-12 md:h-16 md:w-16 object-cover rounded-md border hover:ring-2 hover:ring-primary/50 transition-all"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleSessionClick(session)
                                      }}
                                    />
                                  </div>
                                )}
                                
                                {/* Mobile: Show actions on the right */}
                                <div className="flex items-center gap-1 md:hidden">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleToggleStar(session.id, session.starred)
                                    }}
                                  >
                                    <Star className={`h-3 w-3 ${session.starred ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteSession(session.id)
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Desktop: Keep actions on the right */}
                            <div className="hidden md:flex items-center gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleStar(session.id, session.starred)
                                }}
                              >
                                <Star className={`h-4 w-4 ${session.starred ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSessionClick(session)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteSession(session.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-2 md:mt-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2 md:gap-4">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span className="md:hidden">{formatDistanceToNow(new Date(session.updated_at), { addSuffix: true }).replace(' ago', '')}</span>
                                <span className="hidden md:inline">{formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}</span>
                              </span>
                              {session.interaction_count > 0 && (
                                <span className="hidden sm:inline">{session.interaction_count} interaction{session.interaction_count !== 1 ? 's' : ''}</span>
                              )}
                              {session.interaction_count > 0 && (
                                <span className="sm:hidden">{session.interaction_count}x</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              
              {hasMore && (
                <Card>
                  <CardContent className="p-3 md:p-4 text-center">
                    <Button 
                      variant="outline" 
                      disabled={loading}
                      size="sm"
                      className="min-h-[44px] px-6"
                      onClick={() => {
                        const loadMorePagination = {
                          ...pagination,
                          offset: sessions.length, // Use current sessions count as offset
                        }

                        fetchSessions(filters, loadMorePagination, true) // true = append mode
                      }}
                    >
                      {loading ? 'Loading...' : 'Load More'}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
} 