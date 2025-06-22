import { updateSession } from '@/lib/supabase/middleware'
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // First, update the session (standard Supabase auth middleware)
  const response = await updateSession(request)
  
  // If redirected by authentication middleware (e.g., to login), return early
  if (response.headers.has('location')) {
    return response
  }
  
  try {
    // Check for special routes
    const url = request.nextUrl.clone()
    
    // If not a dashboard route or settings route, just proceed
    // Also allow access to auth routes and the root page
    if (!url.pathname.startsWith('/dashboard') || 
        url.pathname === '/dashboard/settings' ||
        url.pathname.startsWith('/auth/') ||
        url.pathname === '/') {
      return response
    }
    
    // Check if user has any organizations using the secure getUser()
    const supabase = await createClient()
    // Use getUser() to securely fetch the user session
    const { data: { user } } = await supabase.auth.getUser()
    
    // Check if user is authenticated before proceeding
    if (user) {
      // Perform count query without selecting data
      const { error: orgError, count } = await supabase
        .from('organization_members')
        .select('', { count: 'exact', head: true }) // Correct usage of head: true with count
        .eq('user_id', user.id)
      
      if (orgError) {
        console.error("Error checking organizations:", orgError)
        // Decide how to handle DB errors, maybe allow access?
        return response // Or redirect to an error page
      }
      
      // If user doesn't have an organization (count is 0), redirect to settings
      if (count === 0) { // Check the count directly
        return NextResponse.redirect(new URL('/dashboard/settings', request.url))
      }
    } else {
      // This case should technically be handled by updateSession redirecting to login,
      // but as a safeguard, if no user is found here (after updateSession didn't redirect),
      // we redirect to login.
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('next', request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
    
    // If user is authenticated and has an organization, allow the request
    return response
  } catch (error) {
    console.error('Error in middleware:', error)
    // Fallback: return the original response or redirect to an error page
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/webhooks (webhook endpoints)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
