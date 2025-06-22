# SupaStart - SaaS Starter Kit

SupaStart is a production-ready SaaS starter kit built with Next.js 15, Supabase, and Stripe. It provides all the essential features you need to launch your SaaS product quickly.

## Key Features

- **Multi-tenant Organizations**: Create and manage multiple organizations with different user roles (owner, admin, member)
- **Subscription Management**: Built-in Stripe integration for handling paid plans and subscriptions
- **Authentication**: Complete auth system with email/password login and session management
- **Permissions System**: Role-based access control and feature-based permissions
- **Credits System**: Track and manage usage credits for each organization
- **History System**: Comprehensive session and interaction tracking for chat, sandbox, and agent features
- **Agent Monitoring**: Built-in agent system for monitoring websites and content changes
- **Modern UI**: Beautiful interface built with Tailwind CSS and shadcn/ui components
- **Storage Integration**: File upload and management with Supabase Storage

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (for local webhook testing)
- A Supabase project and a Stripe account

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/supastart.git
cd supastart
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file based on the example:
```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=SupaStart
NEXT_PUBLIC_SITE_DESCRIPTION="SaaS Starter Kit with Supabase and Next.js"

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
```

4. Set up the database:
```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Apply migrations to set up the database schema
supabase db push

# Verify your connection and schema
supabase db pull
```

5. Start the development server:
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your application running.

## Database Schema

The project includes a comprehensive database schema with:

- **Core Tables**: 16 tables including organizations, users, subscriptions, and credits
- **History System**: Sessions, interactions, and artifacts for tracking user activities
- **Agent System**: Monitors and findings for automated content monitoring
- **Security**: Row Level Security (RLS) policies on all tables
- **Extensions**: pgcrypto, pgjwt, uuid-ossp, and other Postgres extensions
- **Storage**: Configured buckets for avatars and generated images

### Key Database Objects

- **Tables**: 16 tables with full RLS policies
- **Functions**: 50+ database functions for business logic
- **Triggers**: 16 triggers for data consistency and automation
- **Indexes**: 42+ optimized indexes for performance
- **Storage Buckets**: `avatars` and `generated-images` with proper policies

## Useful Commands

### Database Management
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

### Local Development
```bash
# Start local Supabase services
supabase start

# Stop local Supabase services
supabase stop

# View logs
supabase logs
```

## Project Structure

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
│   │       ├── chat/      # Chat interface
│   │       ├── sandbox/   # Image generation sandbox
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

## Development Guidelines

Please refer to our cursor rules for development guidelines:

- **Supabase Integration**: `.cursor/rules/supabase/` - Database functions, migrations, RLS policies
- **Next.js Components**: Development patterns for React components
- **API and Data Fetching**: Server-side data handling best practices
- **Stripe Integration**: Payment processing and subscription management
- **Organization and User Management**: Multi-tenant architecture patterns

## Features

### Authentication & User Management
- Email/password authentication with Supabase Auth
- User profiles with avatar support
- Multi-factor authentication (MFA) support
- Secure password reset and email confirmation

### Organizations & Permissions
- Multi-tenant organization structure
- Role-based access control (owner, admin, member)
- Organization invitations with email tokens
- Permission-based feature access

### Subscription & Billing
- Stripe integration for payment processing
- Multiple subscription plans with different features
- Usage-based credits system
- Automatic billing and invoice generation
- Subscription management portal

### Chat & AI Features
- Interactive chat interface with AI responses
- Session-based conversation history
- Image generation and editing capabilities
- Sandbox environment for experimentation

### Agent Monitoring
- Website and content monitoring system
- Keyword-based change detection
- Automated findings and alerts
- Configurable monitoring frequencies

## Testing Stripe

To test Stripe integration locally:

1. Start the Stripe webhook listener:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

2. Use Stripe test cards for checkout flows:
   - Success: `4242 4242 4242 4242`
   - Failed: `4000 0000 0000 0002`
   - Declined: `4000 0000 0000 9995`

## Deployment

The application is ready to deploy on Vercel:

1. Push your code to a Git repository
2. Import the project in [Vercel](https://vercel.com/)
3. Configure environment variables in the Vercel dashboard
4. Set up Stripe webhooks pointing to your production domain
5. Deploy!

### Production Checklist

- [ ] Configure production Supabase project
- [ ] Set up production Stripe account and webhooks
- [ ] Configure environment variables
- [ ] Set up domain and SSL certificates
- [ ] Test payment flows end-to-end
- [ ] Configure monitoring and error tracking

## Learn More

For detailed documentation on specific features, please refer to the files in the `docs/` directory:

- [Architecture Overview](docs/architecture-overview.md)
- [Getting Started](docs/getting-started.md)
- [User Management](docs/user-management.md)
- [Organizations and Profiles](docs/organizations-and-profiles.md)
- [Subscription System](docs/subscription-system.md)
- [Credits System](docs/credits-system.md)
- [Permission System](docs/permission-system.md)
- [Creating Protected Features](docs/creating-protected-features.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the development guidelines
4. Test your changes thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ using Next.js, Supabase, and Stripe.
