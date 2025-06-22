# Getting Started with SupaStart

This guide will walk you through setting up and configuring your SupaStart application from scratch.

## Prerequisites

Before you begin, make sure you have the following:

- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) (v9 or later)
- [Git](https://git-scm.com/)
- A [Supabase](https://supabase.com/) account
- A [Stripe](https://stripe.com/) account (for payment processing)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/supastart.git
cd supastart
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

Create a `.env.local` file in the root directory with the following variables:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=SupaStart
NEXT_PUBLIC_SITE_DESCRIPTION="SaaS Starter Kit with Supabase and Next.js"

# Stripe Configuration (for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Optional Email Configuration
EMAIL_SERVER=smtp://username:password@smtp.example.com:587
EMAIL_FROM=noreply@example.com
```

## Setting Up Supabase

1. Create a new Supabase project from your [Supabase Dashboard](https://app.supabase.com/).

2. Get your Supabase URL and Anon Key from the project settings (API section).

3. Apply the database migrations:

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

Alternatively, you can execute the SQL migrations manually from the `supabase/migrations` directory using the Supabase SQL Editor.

## Setting Up Stripe

1. Create a [Stripe](https://stripe.com/) account if you don't have one.

2. Get your API keys from the Stripe Dashboard (Developers > API keys).

3. Set up Stripe webhook:
   - Go to Developers > Webhooks in the Stripe Dashboard
   - Add an endpoint: `https://your-domain.com/api/webhooks/stripe`
   - Select events to listen for:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy the webhook signing secret to your `.env.local` file

## Development

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:3000` to see your application.

## Database Migrations

When making changes to the database schema:

1. Create a new migration file in `supabase/migrations` with a timestamp prefix:

```
20240815000000_your_migration_name.sql
```

2. Apply the migration:

```bash
npx supabase db push
```

## Setting Up Plans

By default, SupaStart includes three plans: Free, Pro, and Enterprise. You can modify these plans in the `plans` table:

1. Navigate to your Supabase dashboard
2. Go to the SQL Editor
3. Run a query to update plans:

```sql
UPDATE plans
SET 
  price = 29.99,
  features = jsonb_set(features, '{max_members}', '20')
WHERE name = 'Pro';
```

## Testing Stripe Integration

To test payments locally:

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Run:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

3. Use Stripe test cards for checkout:
   - Success: `4242 4242 4242 4242`
   - Failure: `4000 0000 0000 0002`

## Deployment

Deploy to Vercel:

1. Push your code to a Git repository
2. Import the project in [Vercel](https://vercel.com/)
3. Configure environment variables in the Vercel dashboard
4. Deploy!

Remember to add the production URL to your Stripe webhook endpoints after deployment.

## Next Steps

After setting up your SupaStart application, you may want to:

- Customize the UI to match your brand
- Configure email templates
- Set up custom domains
- Add additional features

Check our other documentation files for more detailed guides on specific features. 