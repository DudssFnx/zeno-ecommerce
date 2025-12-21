# B2B Wholesale Catalog & Order Management System

## Overview

A private, closed B2B wholesale catalog and order management platform for registered business clients. It facilitates product catalog browsing and order generation, specifically designed for internal business use with required authentication and role-based access control. The system aims to modernize a legacy system by incrementally migrating to a new B2B model while supporting existing functionalities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React 18 with TypeScript
- **UI Components**: shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React Context for client state (Auth, Cart, Theme)
- **Delivery Mode Catalog**: An alternative, mobile-first catalog view inspired by delivery apps (iFood), featuring horizontal category scroll, large product cards, direct quantity controls, and a prominent "Highlights" section.

### Technical Implementations
- **Backend**: Node.js with Express.js, TypeScript (ESM modules), RESTful API.
- **Authentication**: Replit OpenID Connect (OIDC) with Passport.js; sessions stored in PostgreSQL.
- **Database**: PostgreSQL with Drizzle ORM and `drizzle-zod` for schema validation.
- **Dual-Schema Architecture**: Supports incremental migration from a legacy database model to a new B2B model, allowing new features to use `b2b_*` tables while legacy code continues with original tables.
- **Role-Based Access Control (RBAC)**: Four hierarchical roles (Admin, Sales, Customer, Supplier) with granular, module-based permissions. Admins can customize user permissions, and user menus are filtered based on assigned access.
- **Financial Modules**:
    - **Accounts Receivable**: Manages customer credits, including debit/credit entries, payment tracking, and status management.
    - **Accounts Payable**: Manages company expenses, including categorization, due dates, and payment tracking.
- **Payment Module**: Manages custom payment types (e.g., "Cash on Delivery") and integrations with various payment gateways (Mercado Pago, PagSeguro, Stripe, PayPal, Asaas, Pix Manual).

### Key Design Patterns
- **Shared Schema**: Database schemas and TypeScript types defined once in `shared/schema.ts` for both frontend and backend.
- **Storage Interface**: `server/storage.ts` provides a consistent interface for all database operations.
- **Query Client Configuration**: Centralized API request handling in `client/src/lib/queryClient.ts`.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store for application data and sessions.

### Authentication
- **Replit OIDC**: OpenID Connect authentication provider.

### UI Libraries
- **Radix UI**: Accessible component primitives.
- **Lucide React**: Icon library.
- **Embla Carousel**: Carousel functionality.
- **React Hook Form**: Form state management with Zod validation.

### Build & Development
- **Vite**: Frontend development server and bundler.
- **esbuild**: Server-side bundling for production.
- **TSX**: TypeScript execution for development.

### Integrations
- **Bling API v3**: Integrated for product and category synchronization, webhooks for real-time updates, and automatic order submission.