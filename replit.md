# B2B Wholesale Catalog & Order Management System

## Overview

A private, closed B2B wholesale catalog and order management platform inspired by Mercos. This system provides a complete wholesale ordering experience for registered business clients, featuring product catalog browsing, order generation (no online payment), and role-based access control. The platform is designed for internal business use only, requiring authentication to access any functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React Context for client state (Auth, Cart, Theme)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful endpoints under `/api/*` prefix
- **Authentication**: Replit OpenID Connect (OIDC) with Passport.js
- **Session Management**: Express sessions stored in PostgreSQL via connect-pg-simple

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions and Zod schemas
- **Migrations**: Managed via `drizzle-kit push`

### Role-Based Access Control
Three user roles with hierarchical permissions:
- **Admin**: Full system access including user management, product management, all orders
- **Sales**: Can view all orders and catalog, cannot manage users or products
- **Customer**: Can browse catalog, create orders, view own orders only

Users require admin approval before accessing the system (except admins who are auto-approved).

### Key Design Patterns
- **Shared Schema**: Database schemas and TypeScript types are defined once in `shared/schema.ts` and used by both frontend and backend
- **Storage Interface**: `server/storage.ts` implements the `IStorage` interface for all database operations
- **Query Client Configuration**: Centralized API request handling in `client/src/lib/queryClient.ts`

## External Dependencies

### Database
- **PostgreSQL**: Primary data store for users, products, categories, orders, and sessions
- **Connection**: Via `DATABASE_URL` environment variable

### Authentication
- **Replit OIDC**: OpenID Connect authentication provider
- **Configuration**: `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET` environment variables

### UI Libraries
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, forms, etc.)
- **Lucide React**: Icon library
- **Embla Carousel**: Carousel functionality
- **React Hook Form**: Form state management with Zod validation

### Build & Development
- **Vite**: Frontend development server and bundler
- **esbuild**: Server-side bundling for production
- **TSX**: TypeScript execution for development