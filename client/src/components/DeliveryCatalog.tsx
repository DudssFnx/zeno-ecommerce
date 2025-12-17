import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, Search, Plus, Minus, ShoppingCart, Star, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import type { Product as SchemaProduct, Category } from "@shared/schema";

interface ProductsResponse {
  products: SchemaProduct[];
  total: number;
  page: number;
  totalPages: number;
}

interface DeliveryCatalogProps {
  isPublic?: boolean;
}

export function DeliveryCatalog({ isPublic = false }: DeliveryCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const { addItem } = useCart();
  const { toast } = useToast();
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const apiPrefix = isPublic ? '/api/public' : '/api';

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: [`${apiPrefix}/categories`],
  });

  const parentCategories = useMemo(() => 
    categories.filter(c => !c.parentId), 
    [categories]
  );

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (selectedCategory) params.set('categoryId', String(selectedCategory));
    if (searchQuery) params.set('search', searchQuery);
    return params.toString();
  }, [selectedCategory, searchQuery]);

  const { data: productsResponse, isLoading } = useQuery<ProductsResponse>({
    queryKey: [`${apiPrefix}/products`, queryParams],
    queryFn: async () => {
      const res = await fetch(`${apiPrefix}/products?${queryParams}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
  });

  const products = productsResponse?.products || [];
  const featuredProducts = products.filter(p => p.featured);
  const regularProducts = products.filter(p => !p.featured);

  const updateQuantity = (productId: number, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] || 0) + delta),
    }));
  };

  const handleAddToCart = (product: SchemaProduct) => {
    const qty = quantities[product.id] || 1;
    if (qty <= 0) {
      toast({
        title: "Selecione a quantidade",
        description: "Use os botões + e - para escolher",
        variant: "destructive",
      });
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      price: Number(product.price),
      quantity: qty,
      image: product.image || undefined,
    });

    toast({
      title: "Adicionado",
      description: `${qty}x ${product.name}`,
    });

    setQuantities(prev => ({ ...prev, [product.id]: 0 }));
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = 200;
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(price));
  };

  const ProductCard = ({ product }: { product: SchemaProduct }) => {
    const qty = quantities[product.id] || 0;
    const hasStock = (product.stock ?? 0) > 0;

    return (
      <div 
        className="bg-card rounded-xl overflow-hidden shadow-sm border border-border/50 flex flex-col"
        data-testid={`delivery-card-${product.id}`}
      >
        <div className="relative aspect-square bg-muted">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-16 h-16 text-muted-foreground/30" />
            </div>
          )}
          {product.featured && (
            <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">
              <Star className="w-3 h-3 mr-1" />
              Destaque
            </Badge>
          )}
          {!hasStock && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <span className="text-muted-foreground font-medium">Indisponível</span>
            </div>
          )}
        </div>

        <div className="p-3 flex flex-col flex-1">
          <h3 className="font-medium text-sm line-clamp-2 mb-1" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
          {product.brand && (
            <span className="text-xs text-muted-foreground mb-2">{product.brand}</span>
          )}
          
          <div className="mt-auto space-y-2">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-primary" data-testid={`text-price-${product.id}`}>
                {formatPrice(product.price)}
              </span>
            </div>

            {hasStock && (
              <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-none"
                    onClick={() => updateQuantity(product.id, -1)}
                    disabled={qty === 0}
                    data-testid={`button-minus-${product.id}`}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium" data-testid={`text-qty-${product.id}`}>
                    {qty}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-none"
                    onClick={() => updateQuantity(product.id, 1)}
                    data-testid={`button-plus-${product.id}`}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleAddToCart(product)}
                  disabled={qty === 0}
                  data-testid={`button-add-cart-${product.id}`}
                >
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base rounded-full bg-muted/50"
              data-testid="input-search-delivery"
            />
          </div>

          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 shadow-sm"
              onClick={() => scrollCategories('left')}
              data-testid="button-scroll-categories-left"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div 
              ref={categoryScrollRef}
              className="flex gap-2 overflow-x-auto scrollbar-hide px-8 py-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                className="rounded-full whitespace-nowrap shrink-0"
                onClick={() => setSelectedCategory(null)}
                data-testid="button-category-all"
              >
                Todos
              </Button>
              {parentCategories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  className="rounded-full whitespace-nowrap shrink-0"
                  onClick={() => setSelectedCategory(cat.id)}
                  data-testid={`button-category-${cat.id}`}
                >
                  {cat.name}
                </Button>
              ))}
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 shadow-sm"
              onClick={() => scrollCategories('right')}
              data-testid="button-scroll-categories-right"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {featuredProducts.length > 0 && !searchQuery && !selectedCategory && (
          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              Destaques
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {featuredProducts.slice(0, 5).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        <section>
          {selectedCategory ? (
            <h2 className="text-lg font-bold mb-3">
              {categories.find(c => c.id === selectedCategory)?.name || 'Produtos'}
            </h2>
          ) : searchQuery ? (
            <h2 className="text-lg font-bold mb-3">
              Resultados para "{searchQuery}"
            </h2>
          ) : (
            <h2 className="text-lg font-bold mb-3">Todos os Produtos</h2>
          )}

          {regularProducts.length === 0 && featuredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {(searchQuery || selectedCategory ? products : regularProducts).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
