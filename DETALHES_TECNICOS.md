# 🔧 Detalhes Técnicos - Multi-Tenancy Zeno

## Estrutura de Dados

### Tabelas Envolvidas

```sql
-- Empresas (Tenants)
companies
├── id: UUID (PK)
├── razaoSocial: text
├── fantasyName: text
├── slug: text (NOVO - gerado automaticamente)
├── email: text
├── phone: text
└── ...

-- Usuários
users
├── id: UUID (PK)
├── companyId: UUID (FK) ← Multi-tenancy
├── email: text
├── ...

-- Produtos
products
├── id: serial (PK)
├── companyId: UUID (FK) ← Multi-tenancy
├── name: text
├── price: decimal
├── stock: integer
└── ...

-- Pedidos
orders
├── id: serial (PK)
├── companyId: UUID (FK) ← Multi-tenancy
├── userId: UUID (FK, nullable) ← Para guest orders
├── isGuestOrder: boolean (NOVO - já existia)
├── guestName: text (NOVO - já existia)
├── guestEmail: text (NOVO - já existia)
├── guestPhone: text (NOVO - já existia)
├── guestCpf: text (NOVO - já existia)
├── orderNumber: text
├── status: text
├── total: decimal
└── ...

-- Itens do Pedido
orderItems
├── id: serial (PK)
├── orderId: serial (FK)
├── productId: serial (FK)
├── quantity: integer
├── price: decimal
└── ...
```

### Relacionamentos

```
companies (1) ──── (n) users
         │
         ├── (n) products
         ├── (n) orders
         ├── (n) categories
         └── (n) suppliers

orders (1) ──── (n) orderItems
       │
       ├── (1) users (nullable)
       └── (n) orderItems
```

---

## Endpoints Detalhados

### 1. Catálogo Público

#### GET `/api/catalogs/:slug/info`

**Descrição**: Retorna informações da empresa

**Parâmetros**:

- `:slug` - Slug único da empresa (e.g., "loja-abc-ltda")

**Response** (200):

```json
{
  "id": "uuid-empresa",
  "name": "Loja ABC Ltda",
  "fantasyName": "Loja ABC",
  "slug": "loja-abc-ltda",
  "phone": "(11) 3333-3333",
  "email": "contato@lojabc.com"
}
```

**Errors**:

- `404 Not Found` - Empresa/slug não encontrado

---

#### GET `/api/catalogs/:slug/categories`

**Descrição**: Lista categorias da empresa

**Response** (200):

```json
[
  {
    "id": 1,
    "companyId": "uuid",
    "name": "Eletrônicos",
    "slug": "eletronicos",
    "parentId": null
  },
  {
    "id": 2,
    "companyId": "uuid",
    "name": "Acessórios",
    "slug": "acessorios",
    "parentId": 1
  }
]
```

---

#### GET `/api/catalogs/:slug/products`

**Descrição**: Lista produtos da empresa com paginação

**Parâmetros Query**:

- `page` (number, default: 1) - Número da página
- `limit` (number, default: 24, max: 100) - Produtos por página
- `categoryId` (number, optional) - Filtrar por categoria
- `search` (string, optional) - Buscar por nome/SKU

**Response** (200):

```json
{
  "products": [
    {
      "id": 1,
      "companyId": "uuid",
      "name": "Produto A",
      "sku": "SKU001",
      "price": "99.99",
      "stock": 100,
      "featured": true,
      "image": "https://...",
      ...
    }
  ],
  "total": 250,
  "page": 1,
  "totalPages": 11
}
```

**Query Examples**:

```
/api/catalogs/loja-abc-ltda/products
/api/catalogs/loja-abc-ltda/products?page=2&limit=50
/api/catalogs/loja-abc-ltda/products?categoryId=5
/api/catalogs/loja-abc-ltda/products?search=pneu&categoryId=3
```

---

### 2. Guest Orders

#### POST `/api/orders/guest/create`

**Descrição**: Criar novo orçamento (guest order) sem autenticação

**Body**:

```json
{
  "companySlug": "loja-abc-ltda",
  "items": [
    {
      "productId": 1,
      "quantity": 5
    },
    {
      "productId": 2,
      "quantity": 3
    }
  ],
  "guestName": "João Silva",
  "guestEmail": "joao@email.com",
  "guestPhone": "(11) 98765-4321",
  "guestCpf": "123.456.789-00",
  "paymentMethod": "PIX",
  "shippingMethod": "SEDEX",
  "notes": "Entrega em Guarulhos"
}
```

**Required Fields**:

- `companySlug` - Slug da empresa
- `items[]` - Array de produtos
- `guestName` - Nome do cliente
- `guestPhone` - Telefone do cliente

**Optional Fields**:

- `guestEmail`
- `guestCpf`
- `paymentMethod`
- `shippingMethod`
- `notes`

**Response** (201):

```json
{
  "success": true,
  "orderNumber": "GUEST-1707129340000",
  "message": "Orçamento criado com sucesso!"
}
```

**Errors**:

- `400 Bad Request` - Dados inválidos ou empresa não encontrada
- `500 Internal Server Error` - Erro ao processar

**Validações**:

- Slug deve corresponder a empresa válida
- Produtos devem pertencer à empresa
- Items não pode estar vazio
- guestName e guestPhone obrigatórios

---

#### GET `/api/orders/guest` ⭐ Autenticado

**Descrição**: Lista todos os guest orders da empresa autenticada

**Headers Required**:

```
Authorization: Bearer token
```

**Response** (200):

```json
[
  {
    "id": 1,
    "companyId": "uuid-empresa",
    "orderNumber": "GUEST-1707129340000",
    "isGuestOrder": true,
    "guestName": "João Silva",
    "guestEmail": "joao@email.com",
    "guestPhone": "(11) 98765-4321",
    "guestCpf": "123.456.789-00",
    "status": "ORCAMENTO",
    "subtotal": "499.99",
    "total": "499.99",
    "paymentMethod": "PIX",
    "shippingMethod": "SEDEX",
    "notes": "Entrega em Guarulhos",
    "createdAt": "2024-02-04T10:30:00Z",
    "updatedAt": "2024-02-04T10:30:00Z"
  }
]
```

**Errors**:

- `401 Unauthorized` - Não autenticado
- `500 Internal Server Error`

---

#### GET `/api/orders/guest/count` ⭐ Autenticado

**Descrição**: Conta quantos guest orders existem

**Response** (200):

```json
{
  "guestOrderCount": 5
}
```

**Uso**: Ideal para mostrar badge/notificação no dashboard

---

### 3. Validação de Isolamento

#### Endpoints Protegidos

Todos esses endpoints agora validam `companyId`:

```typescript
// ANTES (inseguro):
.where(eq(orders.id, orderId))

// DEPOIS (seguro):
.where(and(
  eq(orders.id, orderId),
  eq(orders.companyId, req.user.companyId)
))
```

**Endpoints com validação adicional**:

- `GET /api/orders/:id`
- `POST /api/orders/:id/stock`
- `POST /api/orders/:id/reserve`
- `DELETE /api/orders/:id`
- `PATCH /api/orders/:id`

---

## Geração de Slug

### Algoritmo

```typescript
function generateSlug(text: string): string {
  return text
    .toLowerCase() // minúsculas
    .normalize("NFD") // decompõe acentos
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-") // substitui espaços/símbolos por hífen
    .replace(/^-+|-+$/g, ""); // remove hífens nas extremidades
}
```

### Exemplos

```javascript
generateSlug("Loja ABC Ltda"); // "loja-abc-ltda"
generateSlug("EMPRESA JOSÉ & CIA"); // "empresa-jose-cia"
generateSlug("São Paulo - Comércio"); // "sao-paulo-comercio"
generateSlug("A/B Test @2024"); // "ab-test-2024"
generateSlug("   ESPAÇOS   EXTRAS   "); // "espacos-extras"
```

---

## Fluxo de Transação - Guest Order

```
User POST /api/orders/guest/create
       │
       ├─→ [1] Validar companySlug
       │   └─→ SELECT companies WHERE slug = ?
       │       └─→ 404 se não encontrar
       │
       ├─→ [2] Validar items
       │   └─→ Para cada item:
       │       ├─→ SELECT products WHERE id = ?
       │       ├─→ Verificar companyId
       │       └─→ Validar quantidade/disponibilidade
       │
       └─→ [3] Criar ordem em transação
           ├─→ INSERT INTO orders
           │   (companyId, orderNumber, guestName, ...)
           │
           ├─→ Para cada item:
           │   └─→ INSERT INTO orderItems
           │       (orderId, productId, quantity, price, ...)
           │
           └─→ COMMIT
               └─→ Response: { orderNumber: "GUEST-..." }
```

---

## Performance

### Índices Recomendados

```sql
-- Para buscas de catálogo por slug
CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_products_company_id ON products(companyId);
CREATE INDEX idx_products_featured ON products(featured) WHERE featured = true;

-- Para guest orders
CREATE INDEX idx_orders_company_guest ON orders(companyId, isGuestOrder)
    WHERE isGuestOrder = true;
CREATE INDEX idx_orders_created_at ON orders(createdAt DESC);

-- Para buscas
CREATE INDEX idx_products_name_search ON products USING GIN
    (to_tsvector('portuguese', name));
CREATE INDEX idx_products_sku ON products(sku);
```

### Otimizações Implementadas

1. **Paginação**: Limita a 100 produtos por página
2. **Índices**: Use os índices acima para performance
3. **N+1 Query Prevention**: Não há lazy loading em GET /api/catalogs/:slug
4. **Transaction Safety**: Guest orders usam transactions

---

## Segurança

### Validações em Lugar

✅ **Autenticação**: Endpoints protegidos requerem login  
✅ **Autorização**: Usuário só acessa dados da própria empresa  
✅ **Validação de Entrada**: Slugs, IDs, quantidades validadas  
✅ **SQL Injection**: Drizzle ORM previne via parameterized queries  
✅ **Data Integrity**: Transactions garantem consistência

### Casos de Risco Mitigados

| Risco                                  | Como Mitigado                              |
| -------------------------------------- | ------------------------------------------ |
| Usuário A vê produtos de Empresa B     | Validação de companyId                     |
| Usuário cria pedido em outra empresa   | POST /api/orders/guest/create valida slug  |
| Guest order fica órfão                 | Vinculada a empresa via companySlug        |
| SQL injection no search                | Drizzle ORM + prepared statements          |
| Acesso a guest orders de outra empresa | GET /api/orders/guest filtra por companyId |

---

## Roadmap Futuro

### Phase 3 - Analytics (1 mês)

```typescript
GET /api/catalogs/:slug/analytics
{
  "totalViews": 150,
  "uniqueVisitors": 45,
  "productsViewed": [1, 2, 3],
  "conversionRate": 0.12,
  "guestOrdersCreated": 18,
  "averageOrderValue": 250.00
}
```

### Phase 4 - Customização (6 semanas)

```typescript
// Cada empresa pode customizar:
- Cores do catálogo
- Logo e banner
- Textos personalizados
- Políticas de entrega/pagamento
```

### Phase 5 - Integrações (ongoing)

```
- Stripe/PagSeguro integration
- SMS/WhatsApp notifications
- Google Analytics
- Zapier webhooks
```

---

## Troubleshooting

### "Catálogo não encontrado"

```
Problema: GET /api/catalogs/minha-empresa/products → 404
Solução:
1. Verificar slug: /api/catalogs/:slug/info
2. Slugs são case-sensitive (minúsculas)
3. Acentos são removidos: "São Paulo" → "sao-paulo"
```

### "Produto não encontrado"

```
Problema: POST /api/orders/guest/create → 400
Solução:
1. Verificar productId existe
2. Verificar product.companyId == company.id
3. Verificar se produto está ativo (status = 'ATIVO')
```

### "Sem permissão"

```
Problema: GET /api/orders/guest → 401
Solução:
1. Login necessário
2. Verificar Authorization header
3. Verificar cookie de sessão
```

---

**Documentação Completa ✅**

Para dúvidas técnicas adicionais, consulte o código em:

- [server/routes.ts](./server/routes.ts) - Endpoints implementation
- [shared/schema.ts](./shared/schema.ts) - Data models
