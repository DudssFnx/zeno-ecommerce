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

## Integração Bling (Implementado)

### Documentação
- Ver `docs/bling-api-integration.md` para detalhes completos

### Resumo
- **API**: Bling API v3 (OAuth 2.0)
- **Base URL**: `https://api.bling.com.br/Api/v3`
- **Autenticação**: Bearer token via OAuth 2.0

### Funcionalidades Implementadas
1. **Sincronização de Produtos**: Importa produtos do Bling para o catálogo (`GET /produtos`)
2. **Sincronização de Categorias**: Importa categorias do Bling
3. **Webhooks**: Recebe atualizações em tempo real de produtos e estoque
4. **Envio de Pedidos**: Quando um pedido é criado no site, é enviado automaticamente ao Bling (`POST /pedidos/vendas`)

### Credenciais Necessárias
- `BLING_CLIENT_ID` - ID do aplicativo OAuth
- `BLING_CLIENT_SECRET` - Secret do aplicativo
- `BLING_ACCESS_TOKEN` - Token de acesso
- `BLING_REFRESH_TOKEN` - Token para renovar acesso

## Sistema de Fiado (Crédito ao Cliente)

### Funcionalidades
O sistema de Fiado permite gerenciar crédito concedido a clientes (compras fiadas):

1. **Dashboard Fiado** (`/fiado`)
   - Total "na rua" (crédito pendente)
   - Total vencido
   - Total recebido
   - Clientes com dívida

2. **Gestão de Créditos**
   - Criar lançamentos de débito (DEBITO) quando cliente compra fiado
   - Criar lançamentos de crédito (CREDITO) para ajustes
   - Status automático: PENDENTE → PARCIAL → PAGO

3. **Registro de Pagamentos**
   - Pagamentos parciais ou totais
   - Histórico de pagamentos por crédito
   - Métodos: PIX, Dinheiro, Cartão, Boleto, Transferência

4. **Calendário de Vencimentos**
   - Próximos vencimentos
   - Pagamentos atrasados

5. **Calculadora de Juros**
   - Cálculo de juros simples sobre valores em atraso

### Tabelas do Banco
- `customer_credits`: Lançamentos de crédito/débito
- `credit_payments`: Pagamentos realizados

### API Endpoints
- `GET /api/credits` - Lista todos os créditos
- `GET /api/credits/dashboard` - Dashboard com métricas
- `GET /api/credits/user/:userId` - Créditos de um cliente
- `POST /api/credits` - Criar novo lançamento
- `POST /api/credits/:id/payments` - Registrar pagamento
- `GET /api/credits/:id/payments` - Histórico de pagamentos

### Acesso
- Apenas usuários com role Admin ou Sales podem acessar