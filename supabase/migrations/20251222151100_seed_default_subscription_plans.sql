-- Seed default subscription plans as intended by original developer
-- This creates the Free, Pro, and Enterprise plans for the billing system

-- Insert Free Plan
INSERT INTO plans (
  name,
  description,
  price,
  billing_interval,
  is_active,
  features,
  credits_per_period
) VALUES (
  'Free',
  'Basic features for small teams',
  0.00,
  'monthly',
  true,
  '{
    "max_members": 3,
    "projects": 2,
    "storage": 1,
    "chat": true,
    "history": true,
    "advanced_analytics": false
  }'::jsonb,
  100
) ON CONFLICT (name) DO NOTHING;

-- Insert Pro Plan
INSERT INTO plans (
  name,
  description,
  price,
  billing_interval,
  is_active,
  features,
  credits_per_period
) VALUES (
  'Pro',
  'Advanced features for growing teams',
  9.99,
  'monthly',
  true,
  '{
    "max_members": 10,
    "projects": 10,
    "storage": 10,
    "chat": true,
    "history": true,
    "advanced_analytics": true,
    "priority_support": true
  }'::jsonb,
  1000
) ON CONFLICT (name) DO NOTHING;

-- Insert Enterprise Plan  
INSERT INTO plans (
  name,
  description,
  price,
  billing_interval,
  is_active,
  features,
  credits_per_period
) VALUES (
  'Enterprise',
  'Full featured for large organizations',
  49.99,
  'monthly',
  true,
  '{
    "max_members": 100,
    "projects": 50,
    "storage": 100,
    "chat": true,
    "history": true,
    "advanced_analytics": true,
    "priority_support": true,
    "custom_integrations": true,
    "dedicated_support": true
  }'::jsonb,
  5000
) ON CONFLICT (name) DO NOTHING; 