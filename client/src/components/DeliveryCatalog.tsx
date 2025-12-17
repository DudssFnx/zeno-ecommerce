import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus, Minus, ShoppingCart, Star, ChevronLeft, ChevronRight, Package, Clock, MapPin } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
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
  const [page, setPage] = useState(1);
  const { items, addItem, totalItems, totalPrice } = useCart();
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
    params.set('page', String(page));
    params.set('limit', '20');
    if (selectedCategory) params.set('categoryId', String(selectedCategory));
    if (searchQuery) params.set('search', searchQuery);
    return params.toString();
  }, [selectedCategory, searchQuery, page]);

  const { data: productsResponse, isLoading } = useQuery<ProductsResponse>({
    queryKey: [`${apiPrefix}/products`, queryParams],
    queryFn: async () => {
      const res = await fetch(`${apiPrefix}/products?${queryParams}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
  });

  const products = productsResponse?.products || [];
  const totalPages = productsResponse?.totalPages || 1;
  const totalProducts = productsResponse?.total || 0;
  const featuredProducts = products.filter(p => p.featured);
  const regularProducts = products.filter(p => !p.featured);

  const handleCategoryChange = (catId: number | null) => {
    setSelectedCategory(catId);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const getQuantity = (productId: number) => {
    return quantities[productId] || 0;
  };

  const setQuantity = (productId: number, qty: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(0, qty),
    }));
  };

  const handleAddToCart = (product: SchemaProduct, qty: number = 1) => {
    if (qty <= 0) return;

    addItem({
      productId: String(product.id),
      name: product.name,
      sku: product.sku,
      price: Number(product.price),
      quantity: qty,
      image: product.image || undefined,
    });

    toast({
      title: "Adicionado ao carrinho",
      description: `${qty}x ${product.name}`,
    });

    setQuantity(product.id, 0);
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
    const qty = getQuantity(product.id);
    const stock = product.stock ?? 0;
    const isOutOfStock = stock <= 0;
    const maxQty = stock > 0 ? stock : 999;

    return (
      <div 
        className={`bg-card rounded-lg border border-border/50 flex gap-3 p-3 ${isOutOfStock ? 'opacity-60' : ''}`}
        data-testid={`delivery-card-${product.id}`}
      >
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-muted shrink-0">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-foreground/30" />
            </div>
          )}
          {product.featured && (
            <div className="absolute top-1 left-1">
              <Badge variant="default" className="text-xs px-1.5 py-0.5">
                <Star className="w-2.5 h-2.5 mr-0.5" />
                Top
              </Badge>
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">Esgotado</span>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <h3 className="font-medium text-sm line-clamp-2 mb-0.5" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
          
          {product.brand && (
            <span className="text-xs text-muted-foreground">{product.brand}</span>
          )}
          
          {product.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {product.description.replace(/<[^>]*>/g, '').substring(0, 80)}
            </p>
          )}
          
          <div className="mt-auto pt-2 flex items-end justify-between gap-2">
            <span className="text-base font-bold text-primary" data-testid={`text-price-${product.id}`}>
              {formatPrice(product.price)}
            </span>
            
            {qty === 0 ? (
              <Button
                size="sm"
                onClick={() => setQuantity(product.id, 1)}
                disabled={isOutOfStock}
                className="rounded-full px-4"
                data-testid={`button-add-${product.id}`}
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            ) : (
              <div className="flex items-center bg-primary rounded-full">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setQuantity(product.id, qty - 1)}
                  data-testid={`button-minus-${product.id}`}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-6 text-center text-sm font-bold text-primary-foreground" data-testid={`text-qty-${product.id}`}>
                  {qty}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => {
                    if (qty < maxQty) {
                      setQuantity(product.id, qty + 1);
                    }
                  }}
                  disabled={qty >= maxQty}
                  data-testid={`button-plus-${product.id}`}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-primary-foreground hover:bg-primary-foreground/20 px-3 ml-1"
                  onClick={() => handleAddToCart(product, qty)}
                  data-testid={`button-confirm-${product.id}`}
                >
                  OK
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
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-30 bg-background border-b shadow-sm">
        <div className="px-4 py-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar no cardápio..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-11 h-11 text-base rounded-full bg-muted border-0"
              data-testid="input-search-delivery"
            />
          </div>

          <div className="relative -mx-4 px-4">
            <Button
              size="icon"
              variant="ghost"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-gradient-to-r from-background via-background to-transparent"
              onClick={() => scrollCategories('left')}
              data-testid="button-scroll-categories-left"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div 
              ref={categoryScrollRef}
              className="flex gap-2 overflow-x-auto scrollbar-hide px-6"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <Button
                variant={selectedCategory === null ? "default" : "ghost"}
                size="sm"
                className={`rounded-full whitespace-nowrap shrink-0 ${selectedCategory === null ? '' : 'bg-muted'}`}
                onClick={() => handleCategoryChange(null)}
                data-testid="button-category-all"
              >
                Todos
              </Button>
              {parentCategories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "ghost"}
                  size="sm"
                  className={`rounded-full whitespace-nowrap shrink-0 ${selectedCategory === cat.id ? '' : 'bg-muted'}`}
                  onClick={() => handleCategoryChange(cat.id)}
                  data-testid={`button-category-${cat.id}`}
                >
                  {cat.name}
                </Button>
              ))}
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-gradient-to-l from-background via-background to-transparent"
              onClick={() => scrollCategories('right')}
              data-testid="button-scroll-categories-right"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {featuredProducts.length > 0 && !searchQuery && !selectedCategory && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <h2 className="text-lg font-bold">Mais Pedidos</h2>
            </div>
            <div className="space-y-3">
              {featuredProducts.slice(0, 5).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-bold mb-3">
            {selectedCategory 
              ? categories.find(c => c.id === selectedCategory)?.name || 'Produtos'
              : searchQuery 
                ? `Resultados para "${searchQuery}"`
                : 'Cardápio'
            }
          </h2>

          {regularProducts.length === 0 && featuredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(searchQuery || selectedCategory ? products : regularProducts).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-full"
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-full"
                data-testid="button-next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </section>
      </div>

      {totalItems > 0 && (
        <Link href={isPublic ? "/guest-checkout" : "/cart"}>
          <div 
            className="fixed bottom-4 right-4 z-40 bg-primary text-primary-foreground rounded-full shadow-xl cursor-pointer transition-all hover:scale-105 active:scale-95"
            data-testid="button-view-cart"
          >
            <div className="flex items-center gap-2 pl-4 pr-5 py-3">
              <div className="relative">
                <ShoppingCart className="w-6 h-6" />
                <span className="absolute -top-2 -right-2 bg-primary-foreground text-primary text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs opacity-80">Ver sacola</span>
                <span className="text-sm font-bold">{formatPrice(totalPrice)}</span>
              </div>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}
