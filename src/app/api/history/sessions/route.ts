import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserAndOrganization } from "@/lib/supabase/credits"
import type { 
  CreateSessionRequest, 
  HistoryFilters, 
  HistoryPagination,
  HistoryResponse
} from "@/types/history"

// GET /api/history/sessions - List sessions with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const userOrg = await getUserAndOrganization(supabase)
    
    if (!userOrg.success) {
      return NextResponse.json(
        { error: userOrg.error || "Authentication error" },
        { status: userOrg.status || 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // Parse filters
    const filters: HistoryFilters = {
      type: searchParams.get('type')?.split(',') as HistoryFilters['type'],
      starred: searchParams.get('starred') === 'true',
      archived: searchParams.get('archived') === 'true',
      search: searchParams.get('search') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
    }

    // Parse pagination
    const pagination: HistoryPagination = {
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
      order_by: (searchParams.get('order_by') as HistoryPagination['order_by']) || 'updated_at',
      order_direction: (searchParams.get('order_direction') as HistoryPagination['order_direction']) || 'desc',
    }

    // Build optimized single query using RPC function for better performance
    // First, get the total count with filters applied
    let countQuery = supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', userOrg.organizationId)

    // Apply same filters to count query
    if (filters.type && filters.type.length > 0) {
      countQuery = countQuery.in('type', filters.type)
    }
    if (filters.starred !== undefined) {
      countQuery = countQuery.eq('starred', filters.starred)
    }
    if (filters.archived !== undefined) {
      countQuery = countQuery.eq('archived', filters.archived)
    }
    if (filters.search) {
      countQuery = countQuery.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }
    if (filters.date_from) {
      countQuery = countQuery.gte('created_at', filters.date_from)
    }
    if (filters.date_to) {
      countQuery = countQuery.lte('created_at', filters.date_to)
    }

    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      console.error('Error getting session count:', countError)
      return NextResponse.json(
        { error: 'Failed to fetch session count' },
        { status: 500 }
      )
    }

    // Single optimized query to get sessions with interaction counts and latest artifacts
    const { data: sessionsWithData, error } = await supabase.rpc(
      'get_sessions_with_summary', 
      {
        org_id: userOrg.organizationId,
        session_type: filters.type && filters.type.length > 0 ? filters.type[0] : null,
        starred_only: filters.starred || false,
        search_query: filters.search || null,
        limit_count: pagination.limit || 20,
        offset_count: pagination.offset || 0
      }
    )

    if (error) {
      console.error('Error fetching sessions with summary:', error)
      
      // Fallback to individual queries if RPC fails
      console.log('Falling back to individual queries...')
      
      let query = supabase
        .from('sessions')
        .select(`
          *,
          interactions!inner(count),
          artifacts!inner(id, type, url, created_at)
        `)
        .eq('organization_id', userOrg.organizationId)

      // Apply filters to fallback query
      if (filters.type && filters.type.length > 0) {
        query = query.in('type', filters.type)
      }
      if (filters.starred !== undefined) {
        query = query.eq('starred', filters.starred)
      }
      if (filters.archived !== undefined) {
        query = query.eq('archived', filters.archived)
      }
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from)
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to)
      }

      query = query
        .order(pagination.order_by || 'updated_at', { ascending: pagination.order_direction === 'asc' })
        .range(pagination.offset || 0, (pagination.offset || 0) + (pagination.limit || 20) - 1)

      const { data: fallbackSessions, error: fallbackError } = await query

      if (fallbackError) {
        console.error('Fallback query also failed:', fallbackError)
        return NextResponse.json(
          { error: 'Failed to fetch sessions' },
          { status: 500 }
        )
      }

             // Process fallback data to match expected format
       const processedSessions = (fallbackSessions || []).map(session => ({
         ...session,
         interaction_count: session.interactions?.length || 0,
         latest_artifacts: (session.artifacts || [])
           .filter((artifact: { type: string }) => artifact.type === 'image')
           .sort((a: { created_at: string }, b: { created_at: string }) => 
             new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
           )
       }))

      const response: HistoryResponse = {
        sessions: processedSessions,
        total_count: totalCount || 0,
        has_more: (pagination.offset || 0) + (pagination.limit || 20) < (totalCount || 0)
      }

      return NextResponse.json(response)
    }

    const response: HistoryResponse = {
      sessions: sessionsWithData || [],
      total_count: totalCount || 0,
      has_more: (pagination.offset || 0) + (pagination.limit || 20) < (totalCount || 0)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in sessions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/history/sessions - Create a new session
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const userOrg = await getUserAndOrganization(supabase)
    
    if (!userOrg.success || !userOrg.user) {
      return NextResponse.json(
        { error: userOrg.error || "Authentication error" },
        { status: userOrg.status || 401 }
      )
    }

    const body: CreateSessionRequest = await request.json()

    // Validate required fields
    if (!body.type || !['chat', 'sandbox', 'agent', 'magic_ads'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Valid session type is required' },
        { status: 400 }
      )
    }

    // Check if user is member of the organization
    if (body.organization_id !== userOrg.organizationId) {
      return NextResponse.json(
        { error: 'Invalid organization' },
        { status: 403 }
      )
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        organization_id: body.organization_id,
        user_id: userOrg.user.id,
        type: body.type,
        title: body.title,
        description: body.description,
        metadata: body.metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error in create session API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 