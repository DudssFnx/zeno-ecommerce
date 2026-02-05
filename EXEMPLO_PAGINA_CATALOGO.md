# 🎨 Exemplo Completo - Página de Catálogo Público

Este arquivo contém um exemplo **pronto para usar** de página de catálogo público que integra com os novos endpoints.

---

## Página Completa - `/pages/public-catalog-by-slug.tsx`

```typescript
import { useState, useMemo, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  Package,
  ShoppingCart,
  Phone,
  Mail,
  Send,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import type { Product as SchemaProduct, Category } from "@shared/schema";

interface ProductsResponse {
  products: SchemaProduct[];
  total: number;
  page: number;
  totalPages: number;
}

interface CompanyInfo {
  id: string;
  name: string;
  fantasyName: string;
  slug: string;
  phone: string;
  email: string;
}

export default function PublicCatalogBySlugPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { addItem, itemCount, openCart, items, clearCart } = useCart();
  const { toast } = useToast();

  // Estados
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validar slug
  if (!slug) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Catálogo não encontrado. Verifique o link.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Carregar informações da empresa
  const { data: companyInfo, isLoading: companyLoading, isError: companyError } = useQuery<CompanyInfo>({
    queryKey: [`/api/catalogs/${slug}/info`],
    queryFn: async () => {
      const res = await fetch(`/api/catalogs/${slug}/info`);
      if (!res.ok) throw new Error("Catálogo não encontrado");
      return res.json();
    },
  });

  // Carregar categorias
  const { data: categoriesData = [] } = useQuery<Category[]>({
    queryKey: [`/api/catalogs/${slug}/categories`],
    queryFn: async () => {
      const res = await fetch(`/api/catalogs/${slug}/categories`);
      if (!res.ok) throw new Error("Erro ao carregar categorias");
      return res.json();
    },
    enabled: !!companyInfo,
  });

  // Montar query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "24");
    if (selectedCategoryId) params.set("categoryId", String(selectedCategoryId));
    if (searchQuery) params.set("search", searchQuery);
    return params.toString();
  }, [page, selectedCategoryId, searchQuery]);

  // Carregar produtos
  const { data: productsResponse, isLoading: productsLoading } = useQuery<ProductsResponse>({
    queryKey: [`/api/catalogs/${slug}/products`, queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/catalogs/${slug}/products?${queryParams}`);
      if (!res.ok) throw new Error("Erro ao carregar produtos");
      return res.json();
    },
    enabled: !!companyInfo,
  });

  const products = productsResponse?.products || [];
  const totalPages = productsResponse?.totalPages || 1;

  // Mutation para criar guest order
  const createGuestOrderMutation = useMutation({
    mutationFn: async () => {
      if (!customerName.trim() || !customerPhone.trim()) {
        throw new Error("Nome e telefone são obrigatórios");
      }

      if (items.length === 0) {
        throw new Error("Adicione produtos ao carrinho");
      }

      const response = await fetch("/api/orders/guest/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: slug,
          items: items.map((item) => ({
            productId: parseInt(item.productId),
            quantity: item.quantity,
          })),
          guestName: customerName,
          guestEmail: customerEmail || null,
          guestPhone: customerPhone,
          guestCpf: customerCpf || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar orçamento");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Sucesso!",
        description: `Orçamento ${data.orderNumber} criado com sucesso!`,
      });

      // Limpar e mostrar mensagem
      clearCart();
      setShowCheckout(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setCustomerCpf("");

      // Mostrar opção de contato via WhatsApp
      const message = encodeURIComponent(
        `Olá ${companyInfo?.name}!\n\nInteressado em seus produtos. Orçamento: ${data.orderNumber}\n\nPode entrar em contato?`
      );
      const whatsappUrl = `https://wa.me/${customerPhone.replace(/\D/g, "")}?text=${message}`;
      window.open(whatsappUrl, "_blank");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "❌ Erro",
        description: error.message,
      });
    },
  });

  // Renderizar loading
  if (companyLoading || (!companyInfo && !companyError)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  // Renderizar erro
  if (companyError || !companyInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Catálogo não encontrado</h1>
            <p className="text-muted-foreground mb-4">
              O catálogo que você procura não existe ou foi removido.
            </p>
            <Button onClick={() => setLocation("/")} variant="outline">
              Voltar para Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Renderizar página
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{companyInfo.name}</h1>
              <p className="text-sm text-muted-foreground">{companyInfo.fantasyName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={openCart}
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0">
                    {itemCount > 99 ? "99+" : itemCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>

          {/* Informações de Contato */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {companyInfo.phone && (
              <a
                href={`tel:${companyInfo.phone}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Phone className="h-4 w-4" />
                {companyInfo.phone}
              </a>
            )}
            {companyInfo.email && (
              <a
                href={`mailto:${companyInfo.email}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Mail className="h-4 w-4" />
                {companyInfo.email}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="container max-w-6xl mx-auto px-4 py-8">
        {/* Barra de Busca */}
        <div className="mb-8">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            {searchQuery && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategoryId(undefined);
                  setPage(1);
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Categorias */}
          {categoriesData.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={!selectedCategoryId ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedCategoryId(undefined);
                  setPage(1);
                }}
              >
                Todas as Categorias
              </Button>
              {categoriesData.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategoryId === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setPage(1);
                  }}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Grid de Produtos */}
        {productsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Carregando produtos...</p>
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum produto encontrado</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {products.map((product) => (
                <Card key={product.id} className="overflow-hidden hover:shadow-lg transition">
                  <div className="aspect-square overflow-hidden bg-muted">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover hover:scale-105 transition"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    {product.featured && (
                      <Badge className="mb-2">Destaque</Badge>
                    )}
                    <h3 className="font-semibold truncate">{product.name}</h3>
                    <p className="text-xs text-muted-foreground mb-2">SKU: {product.sku}</p>
                    <p className="text-lg font-bold mb-4">
                      R$ {parseFloat(String(product.price)).toFixed(2)}
                    </p>
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => {
                        addItem({
                          productId: String(product.id),
                          name: product.name,
                          sku: product.sku,
                          price: parseFloat(String(product.price)),
                          quantity: 1,
                          image: product.image,
                        });
                        toast({
                          description: `${product.name} adicionado ao carrinho`,
                        });
                      }}
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mb-8">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            )}
          </>
        )}

        {/* Carrinho e Checkout */}
        {items.length > 0 && !showCheckout && (
          <Card className="mt-8 sticky bottom-4">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  {items.length} produto{items.length > 1 ? "s" : ""} no carrinho
                </p>
                <p className="text-sm text-muted-foreground">
                  Total: R${" "}
                  {items
                    .reduce((sum, item) => sum + item.price * item.quantity, 0)
                    .toFixed(2)}
                </p>
              </div>
              <Button onClick={() => setShowCheckout(true)}>
                <Send className="h-4 w-4 mr-2" />
                Enviar Orçamento
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Formulário de Checkout */}
        {showCheckout && (
          <Card className="mt-8 border-primary">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4">Seus Dados</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nome *</label>
                  <Input
                    placeholder="Seu nome completo"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Telefone/WhatsApp *</label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    type="tel"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Email (opcional)</label>
                  <Input
                    placeholder="seu@email.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    type="email"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">CPF/CNPJ (opcional)</label>
                  <Input
                    placeholder="123.456.789-00"
                    value={customerCpf}
                    onChange={(e) => setCustomerCpf(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      createGuestOrderMutation.mutate();
                      setIsSubmitting(true);
                    }}
                    disabled={
                      createGuestOrderMutation.isPending ||
                      !customerName.trim() ||
                      !customerPhone.trim()
                    }
                    className="flex-1"
                  >
                    {createGuestOrderMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar Orçamento
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCheckout(false);
                      setIsSubmitting(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
```

---

## Como Integrar no Router

```typescript
// app.tsx ou seu arquivo de rotas

import PublicCatalogBySlugPage from "@/pages/public-catalog-by-slug";

export default function App() {
  return (
    <Router>
      <Switch>
        {/* ... outras rotas ... */}

        {/* Nova rota pública de catálogo */}
        <Route path="/catalogs/:slug" component={PublicCatalogBySlugPage} />

        {/* ... outras rotas ... */}
      </Switch>
    </Router>
  );
}
```

---

## Links de Teste

```
Testar localmente:
- http://localhost:5173/catalogs/loja-abc-ltda
- http://localhost:5173/catalogs/empresa-xyz

Em produção:
- https://zeno.com/catalogs/minha-loja
- https://zeno.com/catalogs/empresa-cliente-final
```

---

## Pronto para Usar! 🚀

Este componente:
✅ Carrega dados do catálogo por slug  
✅ Permite busca e filtragem  
✅ Adiciona produtos ao carrinho  
✅ Cria guest order com dados do cliente  
✅ Integra com WhatsApp para contato  
✅ Totalmente responsivo  
✅ Design moderno com Tailwind + shadcn

Copie e Cole no seu projeto!
