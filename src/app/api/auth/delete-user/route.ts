import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Create a Supabase client with service role key for admin operations
const createAdminClient = async () => {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Create a regular Supabase client for user authentication
const createAuthClient = async () => {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export async function POST(req: Request) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      )
    }

    // Get the authenticated user from the request
    const authClient = await createAuthClient()
    const { data: { user } } = await authClient.auth.getUser()

    // If no user is authenticated, return unauthorized
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body to check for any optional parameters
    const body = await req.json().catch(() => ({}))
    const shouldSoftDelete = Boolean(body.shouldSoftDelete)

    // Create an admin client with service role key
    const adminClient = await createAdminClient()
    
    // Step 1: First try to clean up associated data in the database
    try {
      // Try the safely_delete_user function first (if migration has been applied)
      try {
        const { data: safeDeleteResult, error: safeDeleteError } = await adminClient.rpc(
          'safely_delete_user', 
          { user_id_param: user.id }
        );
        
        if (!safeDeleteError) {
          console.log('User data safely deleted:', safeDeleteResult);
        }
      } catch {
        // Function likely doesn't exist yet - continue with manual deletion
        console.log('safely_delete_user function not available, using manual deletion');
      }
      
      // Fall back to manual profile deletion
      const { error: profileDeleteError } = await adminClient
        .from('profiles')
        .delete()
        .eq('id', user.id);
      
      if (profileDeleteError && 
          profileDeleteError.code !== 'PGRST116') { // Ignore "no rows" errors
        console.log('Warning: Could not delete user profile:', profileDeleteError);
      }
      
      // Also manually clean up organization memberships
      try {
        await adminClient
          .from('organization_members')
          .delete()
          .eq('user_id', user.id);
      } catch {
        console.log('Warning: Error cleaning up organization memberships');
      }
    } catch (cleanupError) {
      console.log('Warning: Error during pre-deletion cleanup:', cleanupError);
      // Continue anyway - don't return an error
    }

    // Step 2: Now delete the user with the admin API
    const { error } = await adminClient.auth.admin.deleteUser(
      user.id,
      shouldSoftDelete
    )

    if (error) {
      console.error('Error deleting user:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Success - the user has been deleted
    return NextResponse.json(
      { success: true, message: 'User deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in delete-user API route:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 