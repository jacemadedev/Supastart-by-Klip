# Architecture Overview

This document provides a high-level overview of the SupaStart architecture, key components, and their interactions.

## System Architecture

SupaStart follows a modern web application architecture built with Next.js and Supabase:

```
┌───────────────┐      ┌───────────────┐      ┌────────────────┐
│  Next.js App  │◄────►│   Supabase    │◄────►│ Stripe Payment │
│  (Frontend)   │      │   (Backend)   │      │   Processing   │
└───────┬───────┘      └───────┬───────┘      └────────────────┘
        │                      │
        │                      │
┌───────▼───────┐      ┌───────▼───────┐
│   Vercel      │      │   PostgreSQL  │
│  Deployment   │      │    Database   │
└───────────────┘      └───────────────┘
```

## Key Components

### 1. Frontend (Next.js)

The frontend is built with Next.js 14+ using the App Router for server-rendered React components:

- **App Directory**: Main application code (`/src/app`)
- **Components**: Reusable UI components (`/src/components`)
- **Contexts**: React context providers for state management (`/src/contexts`)
- **Lib**: Utility functions and service integrations (`/src/lib`)
- **UI Components**: Shadcn UI components library (`/src/components/ui`)

### 2. Backend (Supabase)

Supabase provides the backend infrastructure with:

- **Authentication**: Email/password and social logins
- **Database**: PostgreSQL database with Row Level Security
- **Storage**: File storage for user uploads
- **Edge Functions**: Serverless function execution
- **Realtime**: Real-time subscriptions

### 3. Database Schema

The core data model consists of the following tables:

#### Organizations and Users

- `organizations`: Tenant entities containing apps settings
- `organization_members`: Many-to-many relationship between users and organizations
- `profiles`: Extended user metadata

#### Subscriptions and Billing

- `plans`: Available subscription tiers
- `subscriptions`: Organization subscriptions to plans
- `payment_history`: Records of payment transactions
- `organization_credits`: Tracks credit usage and balance

#### System Management

- `system_logs`: Audit trail of system events
- `webhook_logs`: Records of webhook events for debugging

## Authentication Flow

1. User signs in/up via Supabase Auth
2. JWT token is generated and stored in cookies
3. User is associated with an organization:
   - New users create an organization during onboarding
   - Existing users can join organizations via invitations
4. Organization-specific permissions are applied based on role

## Data Flow

### Request Flow

```
Client Request → Next.js API Route → Supabase Service → Database → Response
```

### Subscription Update Flow

```
Stripe Webhook → Webhook Handler → Supabase RPC Function → Database Update
```

## Key Features Implementation

### Multi-Tenancy

- Each user can belong to multiple organizations
- Organizations have members with different roles (owner, admin, member)
- Data is partitioned by organization using Row Level Security

### Permissions System

- Role-based access control at the organization level
- Feature-based permissions for member accounts
- Permissions are enforced both on client and server

### Subscription Management

- Plan-based feature limitations
- Automatic billing through Stripe
- Subscription status tracking and synchronization
- Credit allocation based on subscription plans

## Security Model

- **Row Level Security (RLS)**: Database-level security policies
- **JWT Validation**: Server-side validation of authentication tokens
- **API Protection**: Secure API routes with authentication checks
- **Role Checks**: Permission validation on all sensitive operations
- **CORS Protection**: Restricted cross-origin requests

## Deployment Architecture

- **Frontend**: Deployed to Vercel (or any Next.js-compatible platform)
- **Backend**: Supabase Project (cloud or self-hosted)
- **Database**: PostgreSQL (managed by Supabase)
- **Edge Functions**: Supabase Edge Functions
- **File Storage**: Supabase Storage (backed by S3-compatible storage)

## Customization Points

The architecture is designed to be extended in the following ways:

- **New Database Tables**: Add domain-specific tables with RLS policies
- **Edge Functions**: Add serverless functions for custom backend logic
- **API Routes**: Extend Next.js API routes for additional functionality
- **UI Components**: Add or modify components for custom UI requirements

## Performance Considerations

- Database queries are optimized with indexes
- Server-side rendering for fast initial page loads
- Client-side data fetching for interactive updates
- Connection pooling for database efficiency

## Error Handling

- Structured error logging in database
- Error boundaries for UI resilience
- Webhook error recovery mechanisms
- Transactional operations for data integrity 