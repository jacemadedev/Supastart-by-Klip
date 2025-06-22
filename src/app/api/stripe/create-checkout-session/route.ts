import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/subscription';

/**
 * Create a Stripe checkout session for a subscription
 * 
 * Request body:
 * {
 *   planId: string,
 *   organizationId: string,
 *   successUrl: string,
 *   cancelUrl: string
 * }
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const { planId, organizationId, successUrl, cancelUrl } = await request.json();
    
    // Validate required parameters
    if (!planId || !organizationId || !successUrl || !cancelUrl) {
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
    
    // Verify user is an owner of the organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', session.user.id)
      .single();
    
    if (membershipError || !membership || membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only organization owners can manage subscriptions' },
        { status: 403 }
      );
    }
    
    // Create the checkout session
    const checkoutUrl = await createCheckoutSession(
      organizationId,
      planId,
      successUrl,
      cancelUrl
    );
    
    if (!checkoutUrl) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 