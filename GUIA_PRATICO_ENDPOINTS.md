# 📖 Guia Prático - Como Usar os Novos Endpoints

## 🎯 Exemplos de Código

### 1. Cliente Final Acessando um Catálogo

```typescript
// Exemplo: Cliente acessa catálogo da empresa com slug "empresa-abc"
async function loadCatalog(companySlug: string) {
  try {
    // Buscar informações da empresa
    const infoRes = await fetch(`/api/catalogs/${companySlug}/info`);
    const companyInfo = await infoRes.json();
    console.log(`Catálogo de: ${companyInfo.name}`);
    console.log(`Contato: ${companyInfo.phone}`);

    // Buscar categorias
    const categoriesRes = await fetch(
      `/api/catalogs/${companySlug}/categories`,
    );
    const categories = await categoriesRes.json();
    console.log(`Categorias: ${categories.length}`);

    // Buscar produtos (com paginação)
    const productsRes = await fetch(
      `/api/catalogs/${companySlug}/products?page=1&limit=24`,
    );
    const { products, total } = await productsRes.json();
    console.log(`Produtos encontrados: ${total}`);

    return { companyInfo, categories, products };
  } catch (error) {
    console.error("Erro ao carregar catálogo:", error);
  }
}

// Uso:
const catalog = await loadCatalog("empresa-abc");
```

---

### 2. Filtrar Produtos do Catálogo

```typescript
// Buscar apenas produtos de uma categoria específica
async function getProductsByCategory(companySlug: string, categoryId: number) {
  const response = await fetch(
    `/api/catalogs/${companySlug}/products?categoryId=${categoryId}&limit=50`,
  );
  return response.json();
}

// Buscar com termo de busca
async function searchProducts(companySlug: string, searchTerm: string) {
  const response = await fetch(
    `/api/catalogs/${companySlug}/products?search=${encodeURIComponent(searchTerm)}`,
  );
  return response.json();
}

// Combinado: buscar "pneu" na categoria 5
async function searchInCategory(
  companySlug: string,
  categoryId: number,
  searchTerm: string,
) {
  const response = await fetch(
    `/api/catalogs/${companySlug}/products?categoryId=${categoryId}&search=${encodeURIComponent(searchTerm)}`,
  );
  return response.json();
}
```

---

### 3. Cliente Criando um Orçamento (Guest Order)

```typescript
interface GuestOrderData {
  companySlug: string;
  items: {
    productId: number;
    quantity: number;
  }[];
  guestName: string;
  guestEmail?: string;
  guestPhone: string;
  guestCpf?: string;
  paymentMethod?: string;
  shippingMethod?: string;
}

async function createGuestOrder(data: GuestOrderData) {
  try {
    const response = await fetch("/api/orders/guest/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const result = await response.json();
    console.log(`✅ Orçamento criado: ${result.orderNumber}`);
    console.log(`Entre em contato para confirmar o pedido`);
    return result;
  } catch (error) {
    console.error("❌ Erro ao criar orçamento:", error);
    throw error;
  }
}

// Exemplo de uso:
const orderData: GuestOrderData = {
  companySlug: "minha-loja",
  items: [
    { productId: 1, quantity: 5 },
    { productId: 2, quantity: 3 },
  ],
  guestName: "João Silva",
  guestEmail: "joao@email.com",
  guestPhone: "(11) 98765-4321",
  guestCpf: "123.456.789-00",
  paymentMethod: "PIX",
  shippingMethod: "SEDEX",
};

const order = await createGuestOrder(orderData);
// Response: { success: true, orderNumber: "GUEST-1707129340000" }
```

---

### 4. Vendedor Visualizando Guest Orders

```typescript
// Listar todos os guest orders da sua empresa (autenticado)
async function getGuestOrders() {
  const response = await fetch("/api/orders/guest", {
    credentials: "include", // Envia cookies de autenticação
  });

  if (!response.ok) {
    throw new Error("Não autenticado");
  }

  const orders = await response.json();
  return orders;
}

// Contar quantos guest orders não foram consultados
async function getGuestOrderCount() {
  const response = await fetch("/api/orders/guest/count", {
    credentials: "include",
  });

  const { guestOrderCount } = await response.json();
  return guestOrderCount;
}

// Uso:
const count = await getGuestOrderCount();
if (count > 0) {
  console.log(`🔔 Você tem ${count} novos orçamentos`);
}

const orders = await getGuestOrders();
orders.forEach((order) => {
  console.log(`
    Orçamento: ${order.orderNumber}
    Cliente: ${order.guestName}
    Contato: ${order.guestPhone}
    Total: R$ ${order.total}
    Data: ${new Date(order.createdAt).toLocaleDateString("pt-BR")}
  `);
});
```

---

### 5. Compartilhando o Link do Catálogo

```typescript
// Gerar link compartilhável do catálogo
function generateCatalogLink(companySlug: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/catalogs/${companySlug}`;
}

// Copiar para clipboard
async function copyCatalogLinkToClipboard(companySlug: string) {
  const link = generateCatalogLink(companySlug);
  try {
    await navigator.clipboard.writeText(link);
    console.log("✅ Link copiado: " + link);
  } catch (err) {
    console.error("Erro ao copiar:", err);
  }
}

// Compartilhar via WhatsApp
function shareViaWhatsApp(companySlug: string, companyName: string) {
  const link = generateCatalogLink(companySlug);
  const message = encodeURIComponent(
    `Olá! Veja nosso catálogo de produtos:\n${link}\n\nAtenciosamente,\n${companyName}`,
  );
  const whatsappUrl = `https://wa.me/?text=${message}`;
  window.open(whatsappUrl, "_blank");
}

// Usar:
// copyCatalogLinkToClipboard('empresa-abc');
// shareViaWhatsApp('empresa-abc', 'Empresa ABC Ltda');
```

---

### 6. Componente React para Catálogo Público

```typescript
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface CatalogViewProps {
  companySlug: string;
}

export function PublicCatalogView({ companySlug }: CatalogViewProps) {
  const [cartItems, setCartItems] = useState<{ productId: number; qty: number }[]>([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
  });

  // Buscar info da empresa
  const { data: companyInfo } = useQuery({
    queryKey: [`/api/catalogs/${companySlug}/info`],
    queryFn: () => fetch(`/api/catalogs/${companySlug}/info`).then(r => r.json()),
  });

  // Buscar categorias
  const { data: categories = [] } = useQuery({
    queryKey: [`/api/catalogs/${companySlug}/categories`],
    queryFn: () => fetch(`/api/catalogs/${companySlug}/categories`).then(r => r.json()),
  });

  // Buscar produtos
  const { data: productsData } = useQuery({
    queryKey: [`/api/catalogs/${companySlug}/products`],
    queryFn: () =>
      fetch(`/api/catalogs/${companySlug}/products?limit=100`)
        .then(r => r.json()),
  });

  // Criar orçamento
  const handleCheckout = async () => {
    if (!customerInfo.name || !customerInfo.phone) {
      alert('Preencha seu nome e telefone');
      return;
    }

    try {
      const response = await fetch('/api/orders/guest/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companySlug,
          items: cartItems,
          guestName: customerInfo.name,
          guestEmail: customerInfo.email,
          guestPhone: customerInfo.phone,
          guestCpf: customerInfo.cpf,
        }),
      });

      const result = await response.json();
      alert(`✅ Orçamento criado: ${result.orderNumber}\nEntraremos em contato!`);
      setCartItems([]);
    } catch (error) {
      alert('❌ Erro ao criar orçamento');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {companyInfo && (
        <div className="mb-6 p-4 border rounded">
          <h1 className="text-2xl font-bold">{companyInfo.name}</h1>
          <p className="text-gray-600">{companyInfo.fantasyName}</p>
          <p className="text-sm">Telefone: {companyInfo.phone}</p>
          <p className="text-sm">Email: {companyInfo.email}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        {productsData?.products?.map((product: any) => (
          <div key={product.id} className="p-4 border rounded">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-40 object-cover mb-2 rounded"
            />
            <h3 className="font-bold">{product.name}</h3>
            <p className="text-sm text-gray-600">SKU: {product.sku}</p>
            <p className="text-lg font-bold">R$ {parseFloat(product.price).toFixed(2)}</p>
            <button
              onClick={() => {
                const existing = cartItems.find(i => i.productId === product.id);
                if (existing) {
                  setCartItems(cartItems.map(i =>
                    i.productId === product.id
                      ? { ...i, qty: i.qty + 1 }
                      : i
                  ));
                } else {
                  setCartItems([...cartItems, { productId: product.id, qty: 1 }]);
                }
              }}
              className="mt-2 bg-blue-500 text-white px-4 py-2 rounded w-full"
            >
              Adicionar ao Carrinho
            </button>
          </div>
        ))}
      </div>

      {cartItems.length > 0 && (
        <div className="border rounded p-4 mb-6">
          <h2 className="font-bold mb-4">Seu Orçamento ({cartItems.length} itens)</h2>

          <div className="mb-4">
            <input
              type="text"
              placeholder="Seu nome"
              value={customerInfo.name}
              onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
              className="w-full mb-2 p-2 border rounded"
            />
            <input
              type="email"
              placeholder="Seu email (opcional)"
              value={customerInfo.email}
              onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
              className="w-full mb-2 p-2 border rounded"
            />
            <input
              type="tel"
              placeholder="Seu telefone"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
              className="w-full mb-2 p-2 border rounded"
            />
            <input
              type="text"
              placeholder="CPF/CNPJ (opcional)"
              value={customerInfo.cpf}
              onChange={(e) => setCustomerInfo({ ...customerInfo, cpf: e.target.value })}
              className="w-full p-2 border rounded"
            />
          </div>

          <button
            onClick={handleCheckout}
            className="w-full bg-green-500 text-white px-4 py-2 rounded font-bold"
          >
            Enviar Orçamento
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 🔄 Fluxo Completo de Exemplo

### Cenário: Loja ABC quer compartilhar seu catálogo

**Passo 1: Vendedor configura a empresa**

```typescript
// PATCH /api/company/me
{
  "razaoSocial": "Loja ABC Ltda"
}
// Response: { slug: "loja-abc-ltda", ... }
```

**Passo 2: Vendedor compartilha o link**

```
Link: https://zeno.com/catalogs/loja-abc-ltda
WhatsApp: "Confira nosso catálogo: https://zeno.com/catalogs/loja-abc-ltda"
```

**Passo 3: Cliente acessa o catálogo**

```typescript
// Frontend faz:
const products = await fetch("/api/catalogs/loja-abc-ltda/products").then((r) =>
  r.json(),
);
// Exibe produtos em grid
```

**Passo 4: Cliente faz orçamento**

```typescript
await fetch("/api/orders/guest/create", {
  method: "POST",
  body: JSON.stringify({
    companySlug: "loja-abc-ltda",
    items: [{ productId: 1, quantity: 5 }],
    guestName: "João",
    guestPhone: "11998765432",
  }),
});
```

**Passo 5: Vendedor vê o orçamento**

```typescript
const guestOrders = await fetch("/api/orders/guest").then((r) => r.json());
// Vê: "Novo orçamento de João - R$ 250,00"
// Clica em "Chamar no WhatsApp"
```

**Passo 6: Vendedor confirma e registra cliente**

```typescript
// Opção 1: Registrar como novo cliente
// Opção 2: Vincular a cliente existente
// Sistema converte guest order em pedido normal
```

---

## ✅ Teste Rápido

Copie e cole no console do navegador:

```javascript
// 1. Testar se empresa existe
fetch("/api/catalogs/loja-abc-ltda/info")
  .then((r) => r.json())
  .then((data) => console.log("✅ Empresa encontrada:", data));

// 2. Testar produtosget
fetch("/api/catalogs/loja-abc-ltda/products?limit=5")
  .then((r) => r.json())
  .then((data) => console.log("✅ Produtos:", data));

// 3. Testar criação de guest order
fetch("/api/orders/guest/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    companySlug: "loja-abc-ltda",
    items: [{ productId: 1, quantity: 1 }],
    guestName: "Teste",
    guestPhone: "11999999999",
  }),
})
  .then((r) => r.json())
  .then((data) => console.log("✅ Order criado:", data));
```

---

## 🎓 Resumo Rápido

| O que?              | Endpoint                             | Autenticação  |
| ------------------- | ------------------------------------ | ------------- |
| Ver info da empresa | `GET /api/catalogs/:slug/info`       | ❌ Pública    |
| Ver categorias      | `GET /api/catalogs/:slug/categories` | ❌ Pública    |
| Ver produtos        | `GET /api/catalogs/:slug/products`   | ❌ Pública    |
| Criar orçamento     | `POST /api/orders/guest/create`      | ❌ Pública    |
| Ver meus orçamentos | `GET /api/orders/guest`              | ✅ Necessária |
| Contar orçamentos   | `GET /api/orders/guest/count`        | ✅ Necessária |

---

**Pronto para implementar! 🚀**
