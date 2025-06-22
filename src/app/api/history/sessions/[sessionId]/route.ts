import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserAndOrganization } from "@/lib/supabase/credits"
import type { UpdateSessionRequest } from "@/types/history"

// GET /api/history/sessions/[sessionId] - Get a specific session with interactions
export async function GET(
  request: NextRequest, 
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const userOrg = await getUserAndOrganization(supabase)
    
    if (!userOrg.success || !userOrg.user) {
      return NextResponse.json(
        { error: userOrg.error || "Authentication error" },
        { status: userOrg.status || 401 }
      )
    }

    const { sessionId } = await params

    const { data: session, error } = await supabase
      .from('sessions')
      .select(`
        *,
        interactions:interactions(
          *,
          artifacts:artifacts(*)
        )
      `)
      .eq('id', sessionId)
      .eq('organization_id', userOrg.organizationId)
      .single()

    if (error) {
      console.error('Error fetching session:', error)
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Sort interactions by sequence
    if (session.interactions) {
      session.interactions.sort((a: { sequence: number }, b: { sequence: number }) => a.sequence - b.sequence)
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error in get session API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/history/sessions/[sessionId] - Update a session
export async function PATCH(
  request: NextRequest, 
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const userOrg = await getUserAndOrganization(supabase)
    
    if (!userOrg.success || !userOrg.user) {
      return NextResponse.json(
        { error: userOrg.error || "Authentication error" },
        { status: userOrg.status || 401 }
      )
    }

    const { sessionId } = await params
    const body: UpdateSessionRequest = await request.json()

    // Check if user owns this session
    const { data: existingSession, error: checkError } = await supabase
      .from('sessions')
      .select('user_id, organization_id')
      .eq('id', sessionId)
      .single()

    if (checkError || !existingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (existingSession.user_id !== userOrg.user.id || 
        existingSession.organization_id !== userOrg.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .update({
        title: body.title,
        description: body.description,
        metadata: body.metadata,
        starred: body.starred,
        archived: body.archived,
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (error) {
      console.error('Error updating session:', error)
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error in update session API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/history/sessions/[sessionId] - Delete a session
export async function DELETE(
  request: NextRequest, 
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const userOrg = await getUserAndOrganization(supabase)
    
    if (!userOrg.success || !userOrg.user) {
      return NextResponse.json(
        { error: userOrg.error || "Authentication error" },
        { status: userOrg.status || 401 }
      )
    }

    const { sessionId } = await params

    // Check if user owns this session
    const { data: existingSession, error: checkError } = await supabase
      .from('sessions')
      .select('user_id, organization_id')
      .eq('id', sessionId)
      .single()

    if (checkError || !existingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (existingSession.user_id !== userOrg.user.id || 
        existingSession.organization_id !== userOrg.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)

    if (error) {
      console.error('Error deleting session:', error)
      return NextResponse.json(
        { error: 'Failed to delete session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in delete session API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 