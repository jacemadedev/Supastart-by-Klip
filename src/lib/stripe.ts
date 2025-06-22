import { Stripe } from 'stripe';

// Initialize Stripe with API key
export const getStripeInstance = () => {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  
  if (!apiKey) {
    throw new Error('Missing Stripe API key. Please set STRIPE_SECRET_KEY in environment variables.');
  }
  
  return new Stripe(apiKey, {
    apiVersion: '2025-03-31.basil', // Latest API version
    appInfo: {
      name: 'SupaStart',
      version: '1.0.0',
    },
  });
};

// Helper function to format Stripe amount (convert dollars to cents)
export const formatStripeAmount = (amount: number): number => {
  return Math.round(amount * 100);
};

// Helper function to format cents to dollars
export const formatDisplayAmount = (amount: number): number => {
  return amount / 100;
};

// Helper function to create a line item description
export const createLineItemDescription = (planName: string): string => {
  return `Subscription to ${planName} plan`;
};

// Helper function to create price data for checkout
export const createPriceData = (
  unitAmount: number, 
  currency: string = 'usd',
  interval: 'month' | 'year' = 'month',
  productName: string,
  productDescription?: string
) => {
  return {
    unit_amount: formatStripeAmount(unitAmount),
    currency,
    recurring: {
      interval,
    },
    product_data: {
      name: productName,
      description: productDescription,
    },
  };
};

// Helper function to convert Stripe error to readable message
export const handleStripeError = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return error.message as string;
  }
  return 'An unknown error occurred with Stripe';
}; 