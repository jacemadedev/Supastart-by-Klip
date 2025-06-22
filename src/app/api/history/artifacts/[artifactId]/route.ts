import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserAndOrganization } from "@/lib/supabase/credits"

// DELETE /api/history/artifacts/[artifactId] - Delete a specific artifact
export async function DELETE(
  request: NextRequest, 
  { params }: { params: Promise<{ artifactId: string }> }
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

    const { artifactId } = await params

    // First, get the artifact with its session info
    const { data: artifactData, error: artifactError } = await supabase
      .from('artifacts')
      .select(`
        id,
        interaction_id,
        interactions!inner(
          session_id,
          sessions!inner(
            user_id,
            organization_id
          )
        )
      `)
      .eq('id', artifactId)
      .single()

    if (artifactError || !artifactData) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      )
    }

    // @ts-expect-error - Supabase nested relations typing issue
    const sessionUserId = artifactData.interactions.sessions.user_id
    // @ts-expect-error - Supabase nested relations typing issue  
    const organizationId = artifactData.interactions.sessions.organization_id

    // Check if current user is a member of the organization
    const { data: memberCheck } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('user_id', userOrg.user.id)
      .single()

    if (!memberCheck) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      )
    }

    // Check if user owns the session (required for deletion)
    if (sessionUserId !== userOrg.user.id) {
      return NextResponse.json(
        { error: 'You can only delete artifacts from your own sessions' },
        { status: 403 }
      )
    }

    // Delete the artifact
    const { error: deleteError } = await supabase
      .from('artifacts')
      .delete()
      .eq('id', artifactId)

    if (deleteError) {
      console.error('Error deleting artifact:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete artifact' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Artifact deleted successfully'
    })
  } catch (error) {
    console.error('Error in delete artifact API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 