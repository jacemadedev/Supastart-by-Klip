import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cancelSubscription } from '@/lib/subscription';

/**
 * Cancel a subscription
 * 
 * Request body:
 * {
 *   organizationId: string,
 *   atPeriodEnd?: boolean (default: true)
 * }
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const { organizationId, atPeriodEnd = true } = await request.json();
    
    // Validate required parameters
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organization ID' },
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
    
    // Verify user is an owner of the organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', session.user.id)
      .single();
    
    if (membershipError || !membership || membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only organization owners can cancel subscriptions' },
        { status: 403 }
      );
    }
    
    // Cancel the subscription
    const success = await cancelSubscription(
      organizationId,
      atPeriodEnd
    );
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to cancel subscription' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      message: atPeriodEnd 
        ? 'Subscription will be canceled at the end of the current billing period' 
        : 'Subscription has been canceled immediately'
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 