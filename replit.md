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

## Sistema Financeiro

O sistema financeiro é composto por dois módulos acessíveis através do menu "Financeiro" na sidebar:

### 1. Contas a Receber (Créditos de Clientes)
Gerencia créditos concedidos a clientes (vendas fiadas):

**Funcionalidades:**
- Dashboard com métricas: total pendente, vencido, recebido, clientes em débito
- Lançamentos de DÉBITO (vendas fiadas) e CRÉDITO (ajustes)
- Status automático: PENDENTE → PARCIAL → PAGO
- Registro de pagamentos parciais ou totais
- Histórico de pagamentos por crédito
- Calendário de vencimentos e atrasados
- Calculadora de juros simples

**Tabelas:**
- `customer_credits`: Lançamentos de crédito/débito
- `credit_payments`: Pagamentos recebidos

**API Endpoints:**
- `GET /api/credits` - Lista créditos (admin/sales)
- `GET /api/credits/dashboard` - Dashboard com métricas (admin/sales)
- `GET /api/credits/user/:userId` - Créditos de um cliente (admin/sales)
- `POST /api/credits` - Criar lançamento (admin/sales)
- `PATCH /api/credits/:id` - Atualizar lançamento (admin/sales)
- `DELETE /api/credits/:id` - Excluir lançamento (admin only)
- `POST /api/credits/:id/payments` - Registrar pagamento (admin/sales)
- `GET /api/credits/:id/payments` - Histórico de pagamentos (admin/sales)

### 2. Contas a Pagar (Despesas da Empresa)
Gerencia despesas e dívidas com fornecedores:

**Funcionalidades:**
- Dashboard com métricas: total de despesas, pendente, pago, vencido
- Categorização de despesas: fornecedor, aluguel, salário, impostos, etc.
- Registro de despesas com data de vencimento
- Status automático: PENDENTE → PAGO
- Registro de pagamentos parciais ou totais
- Histórico de pagamentos por despesa
- Calendário de vencimentos

**Tabelas:**
- `accounts_payable`: Lançamentos de despesas
- `payable_payments`: Pagamentos realizados

**API Endpoints (Admin only):**
- `GET /api/payables` - Lista despesas
- `GET /api/payables/dashboard` - Dashboard com métricas
- `GET /api/payables/:id` - Detalhe de despesa
- `POST /api/payables` - Criar despesa
- `PATCH /api/payables/:id` - Atualizar despesa
- `DELETE /api/payables/:id` - Excluir despesa
- `POST /api/payables/:id/payments` - Registrar pagamento
- `GET /api/payables/:id/payments` - Histórico de pagamentos

### Controle de Acesso
- **Contas a Receber**: Admin e Sales podem acessar
- **Contas a Pagar**: Somente Admin pode acessar

## Sistema de Permissões ERP

Sistema granular de permissões por módulo, permitindo controle fino de acesso para cada usuário.

### Arquitetura

**Tabelas:**
- `modules`: Módulos disponíveis no sistema (catalog, orders, products, etc.)
- `user_module_permissions`: Permissões de cada usuário para cada módulo

**Módulos Disponíveis:**
1. `catalog` - Catálogo de produtos
2. `orders` - Gerenciamento de pedidos
3. `products` - Gerenciamento de produtos
4. `customers` - Gerenciamento de clientes
5. `financial_receivables` - Contas a Receber
6. `financial_payables` - Contas a Pagar
7. `reports` - Relatórios e dashboards
8. `settings` - Configurações do sistema
9. `appearance` - Personalização visual
10. `pdv` - Ponto de Venda
11. `agenda` - Agenda/Calendário

### Funcionamento
- **Seed automático**: Módulos são criados automaticamente no startup do servidor
- **Admin bypass**: Usuários admin têm acesso a todos os módulos automaticamente
- **Permissões padrão por role**: Cada módulo tem roles padrão (admin, sales, customer)
- **Personalização por usuário**: Admin pode selecionar módulos específicos ao criar/editar usuários

### API Endpoints
- `GET /api/modules` - Lista todos módulos (admin only)
- `GET /api/users/:id/permissions` - Permissões de um usuário (admin only)
- `POST /api/users/:id/permissions` - Define permissões de um usuário (admin only)
- `GET /api/auth/permissions` - Permissões do usuário logado (para filtrar menu)

### Frontend
- `AppSidebar.tsx`: Filtra menu baseado em `/api/auth/permissions`
- `users.tsx`: Checkboxes para selecionar módulos ao criar/editar usuários

## Modo Delivery (Catálogo Estilo iFood)

O sistema oferece um modo de catálogo alternativo inspirado em apps de delivery como iFood, Zé Delivery e Rappi.

### Ativação
- Acesse Configurações (Settings) → Catálogo
- Ative "Modo Delivery" para transformar o catálogo

### Características do Modo Delivery
- **Design Mobile-First**: Interface otimizada para dispositivos móveis
- **Scroll Horizontal de Categorias**: Navegação rápida entre categorias
- **Cards de Produto Grandes**: Visualização destacada com imagem, preço e controles de quantidade
- **Controles de Quantidade Diretos**: Botões + e - para ajustar quantidade sem abrir modal
- **Seção de Destaques**: Produtos em destaque aparecem no topo quando não há busca/filtro ativo
- **Paginação**: 24 produtos por página com navegação anterior/próxima
- **Busca Integrada**: Campo de busca na barra fixa superior

### Componente
- `client/src/components/DeliveryCatalog.tsx` - Componente do catálogo delivery
- Usa setting key: `delivery_catalog_mode` (true/false)

### Funcionamento
- Quando ativado, substitui o catálogo padrão tanto na área autenticada quanto no catálogo público
- Mantém todas as funcionalidades de carrinho e checkout