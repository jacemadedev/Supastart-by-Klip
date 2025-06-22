import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripeInstance } from '@/lib/stripe';
import { headers } from 'next/headers';
import Stripe from 'stripe';

// Prevent static optimization and ensure this route is always handled dynamically
export const dynamic = 'force-dynamic';

// Extended interfaces for Stripe types
interface ExtendedInvoice extends Stripe.Invoice {
  subscription?: string;
  payment_intent?: string;
  last_payment_error?: {
    message?: string;
  };
}

interface ExtendedSubscription extends Stripe.Subscription {
  current_period_end: number;
}

/**
 * Stripe webhook handler for subscription events
 */
export async function POST(request: Request) {
  console.log('Webhook received:', request.url);
  
  try {
    const body = await request.text();
    console.log('Webhook body length:', body.length);
    
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');
    console.log('Webhook signature present:', !!signature);
    
    const stripe = getStripeInstance();
    
    // Verify webhook signature
    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      );
    }
    
    let event: Stripe.Event;
    
    try {
      // Verify the event came from Stripe
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error('Missing Stripe webhook secret');
      }
      
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (error) {
      console.error('Error verifying webhook:', error);
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }
    
    // Create Supabase client
    const supabase = await createClient();
    
    // Log the webhook event regardless of processing outcome
    const objectId = 'id' in event.data.object ? String(event.data.object.id) : null;
    
    // Log webhook event start
    const { data: webhookLogId } = await supabase.rpc('log_webhook_event', {
      webhook_type: 'stripe',
      event_type: event.type,
      object_id: objectId,
      payload: JSON.parse(JSON.stringify(event.data.object)),
      was_processed: false
    });
    
    // Process event based on type
    try {
      switch (event.type) {
        // Add handler for customer.created events
        case 'customer.created': {
          const customer = event.data.object as Stripe.Customer;
          console.log('Received customer.created event', { customer_id: customer.id });
          
          // Check if customer has organization_id in metadata
          const organizationId = customer.metadata?.organization_id;
          
          if (organizationId) {
            console.log('Customer has organization_id in metadata', { organizationId });
            
            // Update organization with Stripe customer ID if not already set
            const { data: org, error: orgError } = await supabase
              .from('organizations')
              .select('stripe_customer_id')
              .eq('id', organizationId)
              .single();
              
            if (orgError) {
              console.error('Organization not found', { organizationId, error: orgError });
              throw new Error(`Organization not found for ID: ${organizationId}`);
            }
            
            // Only update if not already set or different
            if (!org.stripe_customer_id || org.stripe_customer_id !== customer.id) {
              const { error: updateError } = await supabase
                .from('organizations')
                .update({ stripe_customer_id: customer.id })
                .eq('id', organizationId);
                
              if (updateError) {
                console.error('Failed to update organization with customer ID', { error: updateError });
                throw new Error(`Failed to update organization: ${updateError.message}`);
              }
              
              console.log('Successfully updated organization with customer ID', { 
                organizationId, 
                customerId: customer.id 
              });
            } else {
              console.log('Organization already has this customer ID', { 
                organizationId, 
                customerId: customer.id 
              });
            }
          } else {
            console.log('Customer has no organization_id in metadata, skipping');
          }
          
          break;
        }
        
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          
          // Add detailed logging
          console.log('Received checkout.session.completed event', {
            session_id: session.id,
            metadata: session.metadata,
            customer: session.customer,
            subscription: session.subscription
          });
          
          // Extract organization and plan IDs from metadata
          const organizationId = session.metadata?.organization_id;
          const planId = session.metadata?.plan_id;
          
          if (!organizationId || !planId) {
            console.error('Missing required metadata', { organizationId, planId, metadata: session.metadata });
            throw new Error('Missing required metadata');
          }
          
          // Get subscription details from Stripe
          const subscriptionId = session.subscription as string;
          if (!subscriptionId) {
            console.error('Missing subscription ID', { session_id: session.id });
            throw new Error('Missing subscription ID');
          }
          
          // Also ensure the customer is linked to the organization
          if (session.customer) {
            const customerId = session.customer as string;
            
            // Update organization with customer ID if necessary
            const { data: org, error: orgError } = await supabase
              .from('organizations')
              .select('stripe_customer_id')
              .eq('id', organizationId)
              .single();
              
            if (!orgError && (!org.stripe_customer_id || org.stripe_customer_id !== customerId)) {
              const { error: updateError } = await supabase
                .from('organizations')
                .update({ stripe_customer_id: customerId })
                .eq('id', organizationId);
                
              if (updateError) {
                console.error('Failed to update organization with customer ID', { error: updateError });
                // Don't throw here - we can still proceed with subscription update
              } else {
                console.log('Updated organization with checkout customer ID', { 
                  organizationId, 
                  customerId 
                });
              }
            }
          }
          
          // Log subscription retrieval
          console.log('Retrieving subscription from Stripe', { subscriptionId });
          
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as ExtendedSubscription;
          const priceId = subscription.items.data[0]?.price.id;
          
          if (!priceId) {
            console.error('Missing price ID', { subscription_id: subscriptionId });
            throw new Error('Missing price ID');
          }
          
          // Extract period end date
          const periodEnd = subscription.current_period_end 
            ? new Date(subscription.current_period_end * 1000).toISOString() 
            : null;
          
          // Log the change_subscription params
          console.log('Calling change_subscription with params', {
            org_id: organizationId,
            new_plan_id: planId,
            stripe_sub_id: subscriptionId,
            stripe_price: priceId,
            period_end: periodEnd
          });
          
          // Verify plan ID to prevent failures on non-existent plans
          const { data: validPlanId } = await supabase.rpc('verify_plan_id', {
            plan_id: planId
          });
          
          // Update subscription in database using only change_subscription function
          const { data, error } = await supabase.rpc('change_subscription', {
            org_id: organizationId,
            new_plan_id: validPlanId || planId, // Use verified plan or original (should be same if valid)
            stripe_sub_id: subscriptionId.trim(), // Ensure clean ID without any whitespace
            stripe_price: priceId,
            period_end: periodEnd
          });
          
          if (error) {
            console.error('Failed to update subscription', { error });
            throw new Error(`Failed to update subscription: ${error.message}`);
          }
          
          // Double-check that the subscription was updated
          const { data: updatedSub, error: checkError } = await supabase
            .from('subscriptions')
            .select('plan_id, stripe_subscription_id')
            .eq('organization_id', organizationId)
            .single();
            
          if (checkError) {
            console.error('Error checking updated subscription', { error: checkError });
          } else {
            console.log('Subscription updated status check', { 
              updated: updatedSub,
              expected_plan: planId,
              expected_sub_id: subscriptionId.trim()
            });
            
            // If the subscription wasn't properly updated, try a direct update
            if (updatedSub.plan_id !== planId || updatedSub.stripe_subscription_id !== subscriptionId.trim()) {
              console.warn('Subscription not properly updated via RPC, trying direct update');
              
              const { error: updateError } = await supabase
                .from('subscriptions')
                .update({
                  plan_id: validPlanId || planId,
                  stripe_subscription_id: subscriptionId.trim(),
                  stripe_price_id: priceId,
                  current_period_end: periodEnd,
                  status: 'active',
                  payment_status: 'succeeded',
                  cancel_at_period_end: false
                })
                .eq('organization_id', organizationId);
                
              if (updateError) {
                console.error('Direct update failed', { error: updateError });
              } else {
                console.log('Direct update succeeded');
              }
            }
          }
          
          // Create a payment history record for this checkout
          // We need to get invoice data from the checkout session
          try {
            console.log('Creating payment history record for checkout');
            
            // Get invoice details if available
            let invoiceId = null;
            let invoiceUrl = null;
            let paymentIntentId = null;
            let amount = null;
            
            // Try to get the invoice from the subscription
            if (session.invoice) {
              const invoiceDetails = await stripe.invoices.retrieve(session.invoice as string);
              invoiceId = invoiceDetails.id;
              invoiceUrl = invoiceDetails.hosted_invoice_url || null;
              paymentIntentId = (invoiceDetails as unknown as ExtendedInvoice).payment_intent || null;
              amount = invoiceDetails.amount_paid / 100; // Convert from cents
            }
            
            // If we couldn't get an amount from the invoice, get it from the plan
            if (amount === null) {
              const { data: plan } = await supabase
                .from('plans')
                .select('price')
                .eq('id', validPlanId || planId)
                .single();
              
              amount = plan?.price || 0;
            }
            
            // Create payment record using our helper function
            const { data: paymentData, error: paymentError } = await supabase.rpc('create_payment_from_checkout', {
              p_organization_id: organizationId,
              p_amount: amount,
              p_currency: 'usd',
              p_stripe_invoice_id: invoiceId,
              p_stripe_payment_intent_id: paymentIntentId,
              p_invoice_url: invoiceUrl
            });
            
            if (paymentError) {
              console.error('Failed to create payment record', { error: paymentError });
            } else {
              console.log('Successfully created payment record', { payment_id: paymentData });
            }
          } catch (paymentError) {
            // Don't fail the whole webhook if payment record creation fails
            console.error('Error creating payment record:', paymentError);
          }
          
          console.log('Successfully updated subscription', { 
            organization_id: organizationId,
            plan_id: planId,
            success: data
          });
          
          break;
        }
        
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as ExtendedInvoice;
          const customerId = invoice.customer as string;
          const subscriptionId = invoice.subscription || null;
          
          if (!customerId || !subscriptionId) {
            throw new Error('Missing customer or subscription ID');
          }
          
          // Try to find or create organization using the failsafe function
          const { data: organizationId } = await supabase.rpc('find_or_create_organization_by_customer', {
            customer_id: customerId,
            customer_email: invoice.customer_email,
            customer_name: invoice.customer_name
          });
          
          if (!organizationId) {
            throw new Error(`Organization not found for customer: ${customerId}`);
          }
          
          // Get the end period from the invoice
          const invoiceLine = invoice.lines.data[0];
          const periodEnd = invoiceLine?.period?.end ? new Date(invoiceLine.period.end * 1000).toISOString() : null;
          
          if (!periodEnd) {
            throw new Error('Could not determine subscription period end');
          }
          
          // Update subscription in database
          const { error } = await supabase
            .from('subscriptions')
            .update({
              current_period_end: periodEnd,
              payment_status: 'succeeded',
              stripe_invoice_id: invoice.id,
              latest_invoice_url: invoice.hosted_invoice_url
            })
            .eq('organization_id', organizationId)
            .eq('stripe_subscription_id', subscriptionId);
          
          if (error) {
            throw new Error(`Failed to update subscription: ${error.message}`);
          }
          
          // Add payment record using RPC function instead of direct insert to bypass RLS
          const { data: paymentId, error: paymentError } = await supabase.rpc('create_payment_from_checkout', {
            p_organization_id: organizationId,
            p_amount: invoice.amount_paid / 100, // Convert from cents
            p_currency: invoice.currency,
            p_stripe_invoice_id: invoice.id,
            p_stripe_payment_intent_id: invoice.payment_intent || null,
            p_invoice_url: invoice.hosted_invoice_url
          });
          
          if (paymentError) {
            throw new Error(`Failed to create payment record: ${paymentError.message}`);
          } else {
            console.log('Successfully created payment record for invoice', { payment_id: paymentId });
          }
          
          break;
        }
        
        case 'invoice.payment_failed': {
          const invoice = event.data.object as ExtendedInvoice;
          const customerId = invoice.customer as string;
          const subscriptionId = invoice.subscription || null;
          
          if (!customerId || !subscriptionId) {
            throw new Error('Missing customer or subscription ID');
          }
          
          // Try to find or create organization using the failsafe function
          const { data: organizationId } = await supabase.rpc('find_or_create_organization_by_customer', {
            customer_id: customerId,
            customer_email: invoice.customer_email,
            customer_name: invoice.customer_name
          });
          
          if (!organizationId) {
            throw new Error(`Organization not found for customer: ${customerId}`);
          }
          
          // Get error message if available
          const errorMessage = invoice.last_payment_error?.message || 'Payment failed';
          
          // Update subscription in database
          const { error } = await supabase
            .from('subscriptions')
            .update({
              payment_status: 'failed',
              payment_error: errorMessage
            })
            .eq('organization_id', organizationId)
            .eq('stripe_subscription_id', subscriptionId);
          
          if (error) {
            throw new Error(`Failed to update subscription: ${error.message}`);
          }
          
          break;
        }
        
        case 'customer.subscription.updated': {
          const subscription = event.data.object as ExtendedSubscription;
          const customerId = subscription.customer as string;
          
          if (!customerId) {
            throw new Error('Missing customer ID');
          }
          
          // Try to find or create organization
          const { data: organizationId } = await supabase.rpc('find_or_create_organization_by_customer', {
            customer_id: customerId
          });
          
          if (!organizationId) {
            throw new Error(`Organization not found for customer: ${customerId}`);
          }
          
          // Get current plan ID from subscription table
          const { data: currentSubscription, error: subError } = await supabase
            .from('subscriptions')
            .select('plan_id')
            .eq('organization_id', organizationId)
            .eq('stripe_subscription_id', subscription.id)
            .single();
          
          let planId = null;
          if (subError || !currentSubscription) {
            console.log('Subscription not found in database, will try to create one');
            
            // Get a free plan ID to start with
            const { data: freePlan } = await supabase
              .from('plans')
              .select('id')
              .eq('price', 0)
              .single();
              
            planId = freePlan?.id;
          } else {
            planId = currentSubscription.plan_id;
          }
          
          if (!planId) {
            throw new Error('Could not determine plan ID');
          }
          
          // Extract period end date from subscription
          const periodEnd = subscription.current_period_end 
            ? new Date(subscription.current_period_end * 1000).toISOString() 
            : null;
          
          // Use change_subscription to update the subscription details
          // This consolidates all subscription updates in one function
          const { error } = await supabase.rpc('change_subscription', {
            org_id: organizationId,
            new_plan_id: planId,
            stripe_sub_id: subscription.id,
            stripe_price: subscription.items.data[0]?.price.id || null,
            period_end: periodEnd
          });
          
          if (error) {
            throw new Error(`Failed to update subscription: ${error.message}`);
          }
          
          // No additional update needed here - change_subscription handles everything
          
          break;
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as ExtendedSubscription;
          const customerId = subscription.customer as string;
          
          if (!customerId) {
            throw new Error('Missing customer ID');
          }
          
          // Try to find or create organization
          const { data: organizationId } = await supabase.rpc('find_or_create_organization_by_customer', {
            customer_id: customerId
          });
          
          if (!organizationId) {
            throw new Error(`Organization not found for customer: ${customerId}`);
          }
          
          // Get the free plan
          const { data: freePlan, error: planError } = await supabase
            .from('plans')
            .select('id')
            .eq('name', 'Free')
            .single();
          
          if (planError || !freePlan) {
            throw new Error('Free plan not found');
          }
          
          // Set a far future date for the free plan
          const farFutureDate = new Date();
          farFutureDate.setFullYear(farFutureDate.getFullYear() + 100);
          
          // Downgrade to free plan using change_subscription function
          // This will handle updating the subscription record with all necessary fields
          const { error } = await supabase.rpc('change_subscription', {
            org_id: organizationId,
            new_plan_id: freePlan.id,
            stripe_sub_id: null,
            stripe_price: null,
            period_end: farFutureDate.toISOString()
          });
          
          if (error) {
            throw new Error(`Failed to downgrade to free plan: ${error.message}`);
          }
          
          break;
        }
        
        default:
          // Unhandled event type
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Log successful processing
      await supabase.rpc('mark_webhook_processed', {
        webhook_id: webhookLogId,
        was_processed: true
      });
      
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error(`Error handling webhook (${event.type}):`, error);
      
      // Log the error
      await supabase.rpc('mark_webhook_processed', {
        webhook_id: webhookLogId,
        was_processed: false,
        error_msg: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // We still return 200 to acknowledge receipt of the webhook
      // This prevents Stripe from retrying the webhook repeatedly
      return NextResponse.json(
        { 
          received: true,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );
    }
  } catch (outerError) {
    console.error('Critical error in webhook handler:', outerError);
    return NextResponse.json(
      { error: 'Critical webhook processing error' },
      { status: 500 }
    );
  }
} 