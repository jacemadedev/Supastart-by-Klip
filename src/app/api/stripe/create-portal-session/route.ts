import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createBillingPortalSession } from '@/lib/subscription';

/**
 * Create a Stripe customer portal session
 * 
 * Request body:
 * {
 *   organizationId: string,
 *   returnUrl: string
 * }
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const { organizationId, returnUrl } = await request.json();
    
    // Validate required parameters
    if (!organizationId || !returnUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Create Supabase client
    const supabase = await createClient();
    
    // Verify user has permission to perform this action
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Verify user is a member of the organization with owner or admin role
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', session.user.id)
      .single();
    
    if (membershipError || !membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only organization owners or admins can access billing portal' },
        { status: 403 }
      );
    }
    
    // Create the portal session
    const portalUrl = await createBillingPortalSession(
      organizationId,
      returnUrl
    );
    
    if (!portalUrl) {
      return NextResponse.json(
        { error: 'Failed to create portal session' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 