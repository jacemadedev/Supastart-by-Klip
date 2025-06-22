import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserAndOrganization } from "@/lib/supabase/credits"
import type { CreateInteractionRequest } from "@/types/history"

// POST /api/history/interactions - Create a new interaction
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

    const body: CreateInteractionRequest = await request.json()

    // Validate required fields
    if (!body.session_id || !body.type) {
      return NextResponse.json(
        { error: 'Session ID and interaction type are required' },
        { status: 400 }
      )
    }

    // Check if user has access to this session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('organization_id, user_id')
      .eq('id', body.session_id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (session.organization_id !== userOrg.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get the next sequence number for this session
    const { data: lastInteraction } = await supabase
      .from('interactions')
      .select('sequence')
      .eq('session_id', body.session_id)
      .order('sequence', { ascending: false })
      .limit(1)
      .single()

    const nextSequence = lastInteraction ? lastInteraction.sequence + 1 : 1

    const { data: interaction, error } = await supabase
      .from('interactions')
      .insert({
        session_id: body.session_id,
        type: body.type,
        content: body.content,
        metadata: body.metadata || {},
        cost_credits: body.cost_credits || 0,
        sequence: nextSequence
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating interaction:', error)
      return NextResponse.json(
        { error: 'Failed to create interaction' },
        { status: 500 }
      )
    }

    return NextResponse.json({ interaction })
  } catch (error) {
    console.error('Error in create interaction API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 