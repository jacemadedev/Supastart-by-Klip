import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserAndOrganization } from "@/lib/supabase/credits"
import type { CreateArtifactRequest } from "@/types/history"

// POST /api/history/artifacts - Create a new artifact
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

    const body: CreateArtifactRequest = await request.json()

    // Validate required fields
    if (!body.interaction_id || !body.type) {
      return NextResponse.json(
        { error: 'Interaction ID and artifact type are required' },
        { status: 400 }
      )
    }

    // Verify the interaction belongs to a session the user can access
    const { data: sessionCheck } = await supabase
      .from('interactions')
      .select(`
        sessions!inner(
          organization_id,
          organization_members!inner(
            user_id
          )
        )
      `)
      .eq('id', body.interaction_id)
      .eq('sessions.organization_members.user_id', userOrg.user.id)
      .single()

    if (!sessionCheck) {
      return NextResponse.json(
        { error: 'Interaction not found or access denied' },
        { status: 404 }
      )
    }

    const { data: artifact, error } = await supabase
      .from('artifacts')
      .insert({
        interaction_id: body.interaction_id,
        type: body.type,
        url: body.url,
        filename: body.filename,
        size_bytes: body.size_bytes,
        mime_type: body.mime_type,
        metadata: body.metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating artifact:', error)
      return NextResponse.json(
        { error: 'Failed to create artifact' },
        { status: 500 }
      )
    }

    return NextResponse.json({ artifact })
  } catch (error) {
    console.error('Error in create artifact API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 