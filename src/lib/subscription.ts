import { createClient } from './supabase/server';
import { getStripeInstance } from './stripe';

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  billing_interval: 'monthly' | 'annual';
};

// Get plan details from database
export async function getPlan(planId: string): Promise<Plan | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();
  
  if (error) {
    console.error('Error fetching plan:', error);
    return null;
  }
  
  return data as Plan;
}

// Create or retrieve a Stripe customer for an organization
export async function getOrCreateStripeCustomer(organizationId: string): Promise<string | null> {
  const supabase = await createClient();
  
  // Get the organization details
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, stripe_customer_id')
    .eq('id', organizationId)
    .single();
  
  if (orgError) {
    console.error('Error fetching organization:', orgError);
    return null;
  }
  
  // If the organization already has a Stripe customer ID, return it
  if (org.stripe_customer_id) {
    return org.stripe_customer_id;
  }
  
  // Otherwise, create a new Stripe customer
  try {
    const stripe = getStripeInstance();
    
    // Get user email from current session
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email || 'unknown@example.com';
    
    // Create a new customer in Stripe
    const customer = await stripe.customers.create({
      name: org.name,
      email: userEmail,
      metadata: {
        organization_id: organizationId,
      },
    });
    
    // Update the organization with the Stripe customer ID
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ stripe_customer_id: customer.id })
      .eq('id', organizationId);
    
    if (updateError) {
      console.error('Error updating organization with Stripe customer ID:', updateError);
      return null;
    }
    
    return customer.id;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    return null;
  }
}

// Create a checkout session for a subscription
export async function createCheckoutSession(
  organizationId: string,
  planId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string | null> {
  try {
    // Get the plan details
    const plan = await getPlan(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }
    
    // Free plan doesn't need Stripe checkout
    if (plan.price === 0) {
      const supabase = await createClient();
      
      // Update subscription directly without Stripe
      const { error } = await supabase.rpc('change_subscription', {
        org_id: organizationId,
        new_plan_id: planId,
        stripe_sub_id: null,
        stripe_price: null
      });
      
      if (error) {
        throw error;
      }
      
      return successUrl;
    }
    
    // Get or create a Stripe customer
    const customerId = await getOrCreateStripeCustomer(organizationId);
    if (!customerId) {
      throw new Error('Could not create Stripe customer');
    }
    
    // Create a Stripe checkout session
    const stripe = getStripeInstance();
    
    // Ensure we have product and price IDs
    if (!plan.stripe_product_id || !plan.stripe_price_id) {
      throw new Error('Plan is missing Stripe product or price ID');
    }
    
    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organization_id: organizationId,
        plan_id: planId,
      },
    });
    
    return session.url;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return null;
  }
}

// Create a billing portal session
export async function createBillingPortalSession(
  organizationId: string,
  returnUrl: string
): Promise<string | null> {
  try {
    // Get the organization
    const supabase = await createClient();
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();
    
    if (orgError || !org.stripe_customer_id) {
      throw new Error('Organization not found or missing Stripe customer ID');
    }
    
    // Create a Stripe billing portal session
    const stripe = getStripeInstance();
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: returnUrl,
    });
    
    return session.url;
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    return null;
  }
}

// Cancel a subscription
export async function cancelSubscription(
  organizationId: string,
  atPeriodEnd: boolean = true
): Promise<boolean> {
  const supabase = await createClient();
  
  try {
    // Get the subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, stripe_subscription_id, plan_id')
      .eq('organization_id', organizationId)
      .single();
    
    if (subError) {
      throw new Error('Subscription not found');
    }
    
    // If this is a free plan or no Stripe subscription ID, just update the database
    if (!subscription.stripe_subscription_id) {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: true,
        })
        .eq('id', subscription.id);
      
      if (error) throw error;
      return true;
    }
    
    // Otherwise, cancel the subscription in Stripe
    const stripe = getStripeInstance();
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: atPeriodEnd,
    });
    
    // Update the subscription in the database
    const { error } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: atPeriodEnd,
      })
      .eq('id', subscription.id);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return false;
  }
}

// Update payment method
export async function updatePaymentMethod(
  organizationId: string,
  paymentMethodId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  try {
    // Get the organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();
    
    if (orgError || !org.stripe_customer_id) {
      throw new Error('Organization not found or missing Stripe customer ID');
    }
    
    // Update the payment method in Stripe
    const stripe = getStripeInstance();
    await stripe.customers.update(org.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    // Update the organization in the database
    const { error } = await supabase
      .from('organizations')
      .update({
        stripe_payment_method_id: paymentMethodId,
      })
      .eq('id', organizationId);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error updating payment method:', error);
    return false;
  }
} 