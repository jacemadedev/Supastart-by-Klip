# 🚀 Supastart by Klip - Complete SaaS Starter Kit

> **Launch your SaaS in days, not months** - A production-ready Next.js 15 starter kit with everything you need to build and scale your SaaS business.

[![Next.js](https://img.shields.io/badge/Next.js-15.3.1-black?logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-purple?logo=stripe)](https://stripe.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

## ✨ What Makes This Special

**Supastart by Klip** is a production-ready SaaS starter kit built with Next.js 15, Supabase, and Stripe. It provides all the essential features you need to launch your SaaS product quickly, including advanced AI features, multi-tenant organizations, and comprehensive billing management.

### 🎯 **Core Features**

- **🏢 Multi-tenant Organizations** - Complete organization management with roles (owner, admin, member)
- **💳 Stripe Integration** - Full subscription management with multiple pricing tiers
- **🔐 Advanced Authentication** - Secure auth with MFA support and session management
- **🎨 Magic Ads Generator** - AI-powered ad creation and image generation
- **🧪 Creative Sandbox** - Interactive playground for image editing and variations
- **🤖 AI Chat Interface** - Intelligent chat with web search and agent capabilities
- **👁️ Agent Monitoring** - Automated website and content change detection
- **💰 Credits System** - Usage-based billing with automatic credit allocation
- **📊 History Tracking** - Comprehensive session and interaction logging
- **🎨 Modern UI** - Beautiful interface with Tailwind CSS and shadcn/ui

### 💎 **Pricing Plans**
- **Free**: $0/month - Basic features for small teams (100 credits)
- **Pro**: $9.99/month - Advanced features for growing teams (1,000 credits)  
- **Enterprise**: $49.99/month - Full featured for large organizations (5,000 credits)

## 🚀 Quick Start

### **Prerequisites**

- Node.js 18.x or later
- npm 9.x or later
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (for local webhook testing)
- A Supabase project and a Stripe account

### **1. Clone & Install**

```bash
git clone https://github.com/yourusername/supastart-by-klip.git
cd supastart-by-klip
npm install
```

### **2. Environment Configuration**

Create a `.env.local` file with these variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=Supastart by Klip
NEXT_PUBLIC_SITE_DESCRIPTION="Complete SaaS Starter Kit with AI Features"

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# OpenAI Configuration (for AI features)
OPENAI_API_KEY=your-openai-api-key
```

### **3. Database Setup**

```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Apply all migrations to set up the database schema
supabase db push

# Verify your connection and schema
supabase db pull
```

### **4. Stripe Configuration**

After setting up your database, you'll need to configure Stripe products in your Supabase database:

1. **Create Products in Stripe Dashboard:**
   - Go to your [Stripe Dashboard](https://dashboard.stripe.com/products)
   - Create products for each plan (Free, Pro, Enterprise)
   - For each product, create a price (e.g., $9.99/month for Pro)
   - **Copy the IDs**: 
     - Product ID starts with `prod_` (found in product details)
     - Price ID starts with `price_` (found when you click on the price)
   - Keep these IDs handy for the next step

2. **Update Supabase Plans Table:**
   
   **Option A: Using Supabase Dashboard (Recommended for beginners):**
   - Go to your Supabase project dashboard
   - Navigate to **Table Editor** → **plans** table
   - Click on the **Pro** row and edit:
     - `stripe_product_id`: `prod_your_stripe_product_id`
     - `stripe_price_id`: `price_your_stripe_price_id`
   - Click on the **Enterprise** row and edit:
     - `stripe_product_id`: `prod_your_enterprise_product_id`
     - `stripe_price_id`: `price_your_enterprise_price_id`
   - Save your changes
   
   **Option B: Using SQL Editor:**
   ```sql
   -- Update the plans table with your Stripe product/price IDs
   UPDATE plans SET 
     stripe_product_id = 'prod_your_stripe_product_id',
     stripe_price_id = 'price_your_stripe_price_id'
   WHERE name = 'Pro';
   
   UPDATE plans SET 
     stripe_product_id = 'prod_your_enterprise_product_id',
     stripe_price_id = 'price_your_enterprise_price_id'
   WHERE name = 'Enterprise';
   ```

3. **Configure Webhook Endpoints:**
   - In Stripe Dashboard, go to Developers → Webhooks
   - Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
   - Select events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`

### **5. Start Development**

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your application running.

## 🏗️ Architecture Overview

### **Database Schema**
The project includes a comprehensive database schema with:

- **Core Tables**: 16 tables including organizations, users, subscriptions, and credits
- **History System**: Sessions, interactions, and artifacts for tracking user activities  
- **Agent System**: Monitors and findings for automated content monitoring
- **Security**: Row Level Security (RLS) policies on all tables
- **Extensions**: pgcrypto, pgjwt, uuid-ossp, and other Postgres extensions
- **Storage**: Configured buckets for avatars and generated images

### **Key Database Objects**
- **Tables**: 16 tables with full RLS policies
- **Functions**: 50+ database functions for business logic
- **Triggers**: 16 triggers for data consistency and automation
- **Indexes**: 42+ optimized indexes for performance
- **Storage Buckets**: `avatars` and `generated-images` with proper policies

## 📁 Project Structure

```
├── src/
│   ├── app/               # Next.js App Router pages and layouts
│   │   ├── api/           # API routes for server-side operations
│   │   │   ├── chat/      # Chat and agent API endpoints
│   │   │   ├── sandbox/   # Image generation and editing
│   │   │   ├── stripe/    # Stripe integration endpoints
│   │   │   └── webhooks/  # Webhook handlers
│   │   ├── auth/          # Authentication pages
│   │   └── dashboard/     # Dashboard and application pages
│   │       ├── chat/      # AI Chat interface
│   │       ├── magic-ads/ # Magic Ads Generator
│   │       ├── sandbox/   # Creative Sandbox
│   │       ├── billing/   # Subscription management
│   │       └── settings/  # User and organization settings
│   ├── components/        # Reusable React components
│   │   ├── ui/            # UI components (shadcn/ui)
│   │   ├── auth-components/    # Authentication components
│   │   ├── billing/       # Billing and subscription components
│   │   ├── dashboard-components/ # Dashboard-specific components
│   │   └── organization/  # Organization management components
│   ├── contexts/          # React context providers
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions and service integrations
│   │   ├── organization/  # Organization-related utilities
│   │   ├── stripe/        # Stripe integration utilities
│   │   ├── supabase/      # Supabase client configuration
│   │   └── storage/       # File upload utilities
│   └── types/             # TypeScript type definitions
├── supabase/              # Supabase configuration and migrations
│   ├── migrations/        # Database migration files
│   └── config.toml        # Supabase project configuration
├── docs/                  # Documentation for various features
└── .cursor/               # Cursor IDE rules for development
    └── rules/             # Development guidelines and best practices
```

## 🛠️ Useful Commands

### **Database Management**
```bash
# Check database status
supabase db status

# Pull latest schema changes
supabase db pull

# Push local migrations
supabase db push

# Reset database (careful!)
supabase db reset

# Generate TypeScript types
supabase gen types typescript --project-id your-project-ref > src/types/database.ts
```

### **Local Development**
```bash
# Start local Supabase services
supabase start

# Stop local Supabase services
supabase stop

# View logs
supabase logs
```

## 💳 Testing Stripe Integration

To test Stripe integration locally:

1. **Start the Stripe webhook listener:**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

2. **Use Stripe test cards for checkout flows:**
   - Success: `4242 4242 4242 4242`
   - Failed: `4000 0000 0000 0002`
   - Declined: `4000 0000 0000 9995`

3. **Test the complete billing flow:**
   - Sign up for an account
   - Go to `/dashboard/billing`
   - Select a subscription plan
   - Complete checkout with test card
   - Verify subscription status and credits are updated

## 🎯 Feature Deep Dive

### **Authentication & User Management**
- Email/password authentication with Supabase Auth
- User profiles with avatar support
- Multi-factor authentication (MFA) support
- Secure password reset and email confirmation

### **Organizations & Permissions**
- Multi-tenant organization structure
- Role-based access control (owner, admin, member)
- Organization invitations with email tokens
- Permission-based feature access

### **Subscription & Billing**
- Stripe integration for payment processing
- Multiple subscription plans with different features
- Usage-based credits system
- Automatic billing and invoice generation
- Subscription management portal

### **AI Chat & Features**
- Interactive chat interface with AI responses
- Session-based conversation history
- Agent mode with advanced capabilities
- Web search integration

### **Magic Ads Generator**
- AI-powered advertisement creation
- Dynamic content generation
- Template-based ad designs
- Export and sharing capabilities

### **Creative Sandbox**
- Image generation and editing capabilities
- Variation creation tools
- Interactive editing interface
- History tracking for all creations

### **Agent Monitoring**
- Website and content monitoring system
- Keyword-based change detection
- Automated findings and alerts
- Configurable monitoring frequencies

## 🚀 Deployment

The application is ready to deploy on Vercel:

1. Push your code to a Git repository
2. Import the project in [Vercel](https://vercel.com/)
3. Configure environment variables in the Vercel dashboard
4. Set up Stripe webhooks pointing to your production domain
5. Deploy!

### **Production Checklist**

- [ ] Configure production Supabase project
- [ ] Set up production Stripe account and webhooks
- [ ] Configure environment variables
- [ ] Set up domain and SSL certificates
- [ ] Test payment flows end-to-end
- [ ] Configure monitoring and error tracking

## 📚 Development Guidelines

Please refer to our cursor rules for development guidelines:

- **Supabase Integration**: `.cursor/rules/supabase/` - Database functions, migrations, RLS policies
- **Next.js Components**: Development patterns for React components
- **API and Data Fetching**: Server-side data handling best practices
- **Stripe Integration**: Payment processing and subscription management
- **Organization and User Management**: Multi-tenant architecture patterns

## 📖 Documentation

For detailed documentation on specific features, please refer to the files in the `docs/` directory:

- [Architecture Overview](docs/architecture-overview.md)
- [Getting Started](docs/getting-started.md)
- [User Management](docs/user-management.md)
- [Organizations and Profiles](docs/organizations-and-profiles.md)
- [Subscription System](docs/subscription-system.md)
- [Credits System](docs/credits-system.md)
- [Permission System](docs/permission-system.md)
- [Creating Protected Features](docs/creating-protected-features.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the development guidelines
4. Test your changes thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using Next.js, Supabase, and Stripe.**

> Ready to launch your SaaS? This starter kit provides everything you need to go from idea to production in record time.
