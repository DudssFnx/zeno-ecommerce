import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Loader2, 
  Package, 
  ChevronLeft, 
  ChevronRight,
  Store,
  Phone,
  X,
  Grid3X3,
  List,
  Home,
  Filter,
  ShoppingCart,
  User,
  UserPlus
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Product as SchemaProduct, Category } from "@shared/schema";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { DeliveryCatalog } from "@/components/DeliveryCatalog";
import logoImage from "@assets/image_1765659931449.png";

interface ProductsResponse {
  products: SchemaProduct[];
  total: number;
  page: number;
  totalPages: number;
}

export default function PublicCatalogPage() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  
  const { addItem, itemCount, openCart } = useCart();
  const { toast } = useToast();

  const { data: categoriesData = [] } = useQuery<Category[]>({
    queryKey: ['/api/public/categories'],
    queryFn: async () => {
      const res = await fetch('/api/public/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });

  const { data: deliveryModeSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/delivery_catalog_mode'],
  });

  const { data: maintenanceModeSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/public/settings/catalog_maintenance_mode'],
    queryFn: async () => {
      const res = await fetch('/api/public/settings/catalog_maintenance_mode');
      if (!res.ok) throw new Error('Failed to fetch maintenance setting');
      return res.json();
    },
  });

  const isDeliveryMode = deliveryModeSetting?.value === 'true';
  const isMaintenanceMode = maintenanceModeSetting?.value === 'true';

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const categoryParam = params.get("category");
    const searchParam = params.get("search");
    if (categoryParam) {
      const decodedCategory = decodeURIComponent(categoryParam);
      setCategory(decodedCategory);
      const cat = categoriesData.find(c => c.name === decodedCategory);
      if (cat) {
        setSelectedCategoryId(cat.id);
      }
    }
    if (searchParam) {
      setSearchQuery(decodeURIComponent(searchParam));
    }
  }, [searchString, categoriesData]);

  useEffect(() => {
    if (category === "all") {
      setSelectedCategoryId(undefined);
    } else {
      const cat = categoriesData.find(c => c.name === category);
      setSelectedCategoryId(cat?.id);
    }
    setPage(1);
  }, [category, categoriesData]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, brand]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '24');
    if (selectedCategoryId) params.set('categoryId', String(selectedCategoryId));
    if (searchQuery) params.set('search', searchQuery);
    return params.toString();
  }, [page, selectedCategoryId, searchQuery]);

  const { data: productsResponse, isLoading: productsLoading } = useQuery<ProductsResponse>({
    queryKey: ['/api/public/products', queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/public/products?${queryParams}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
  });

  const productsData = productsResponse?.products || [];
  const totalPages = productsResponse?.totalPages || 1;
  const totalProducts = productsResponse?.total || 0;

  const categoryMap = useMemo(() => {
    const map: Record<number, string> = {};
    categoriesData.forEach(cat => {
      map[cat.id] = cat.name;
    });
    return map;
  }, [categoriesData]);

  const brands = useMemo(() => {
    const brandSet = new Set<string>();
    productsData.forEach(p => {
      if (p.brand) brandSet.add(p.brand);
    });
    return Array.from(brandSet).sort();
  }, [productsData]);

  const filteredProducts = useMemo(() => {
    return productsData.filter((product) => {
      const matchesBrand = brand === "all" || product.brand === brand;
      return matchesBrand;
    });
  }, [productsData, brand]);

  const clearFilters = () => {
    setSearchQuery("");
    setCategory("all");
    setBrand("all");
    setLocation("/catalogo");
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numPrice);
  };

  const hasFilters = searchQuery || category !== "all" || brand !== "all";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const selectCategory = (catName: string) => {
    setCategory(catName);
    setShowMobileFilters(false);
  };

  const getQuantity = (productId: number) => quantities[productId] ?? 0;

  const setQuantity = (productId: number, qty: number) => {
    if (qty < 0) qty = 0;
    if (qty > 999) qty = 999;
    setQuantities(prev => ({ ...prev, [productId]: qty }));
  };

  const handleAddToCart = (product: SchemaProduct) => {
    const qty = getQuantity(product.id);
    if (qty <= 0) {
      toast({
        title: "Informe a quantidade",
        description: "Digite a quantidade desejada",
        variant: "destructive",
      });
      return;
    }
    
    const price = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
    
    addItem({
      productId: String(product.id),
      name: product.name,
      sku: product.sku,
      price: price,
      quantity: qty,
      image: product.image || undefined,
    });

    toast({
      title: "Adicionado ao carrinho",
      description: `${qty}x ${product.name}`,
    });

    setQuantities(prev => ({ ...prev, [product.id]: 0 }));
  };

  if (isMaintenanceMode) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 bg-zinc-900 text-white">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-center gap-3">
              <img 
                src={logoImage} 
                alt="Lojamadrugadao" 
                className="h-10 w-10 rounded-full border-2 border-white/20"
                data-testid="img-logo-maintenance"
              />
              <h1 className="font-bold text-lg tracking-wide">LOJAMADRUGADAO</h1>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
              <Store className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-3" data-testid="text-maintenance-title">
              Catálogo em Manutenção
            </h2>
            <p className="text-muted-foreground mb-6" data-testid="text-maintenance-message">
              Estamos realizando melhorias em nosso sistema. Por favor, volte em alguns instantes.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>Dúvidas? Ligue: 11 99294-0168</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isDeliveryMode) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-zinc-900 text-white">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img 
                  src={logoImage} 
                  alt="Lojamadrugadao" 
                  className="h-10 w-10 rounded-full border-2 border-white/20 cursor-pointer"
                  onClick={() => setLocation("/")}
                  data-testid="img-logo"
                />
                <div className="hidden sm:block">
                  <h1 className="font-bold text-sm tracking-wide cursor-pointer" onClick={() => setLocation("/")}>
                    LOJAMADRUGADAO
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white relative"
                  onClick={openCart}
                  data-testid="button-cart"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {itemCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center text-xs">
                      {itemCount}
                    </Badge>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white"
                  onClick={() => setLocation("/login")}
                  data-testid="button-login"
                >
                  <User className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </header>
        <DeliveryCatalog isPublic={true} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-zinc-900 text-white">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img 
                src={logoImage} 
                alt="Lojamadrugadao" 
                className="h-10 w-10 rounded-full border-2 border-white/20 cursor-pointer"
                onClick={() => setLocation("/")}
                data-testid="img-logo"
              />
              <div className="hidden sm:block">
                <h1 className="font-bold text-sm tracking-wide cursor-pointer" onClick={() => setLocation("/")}>
                  LOJAMADRUGADAO
                </h1>
                <div 
                  className="flex items-center gap-1 text-zinc-400 text-xs cursor-pointer select-none"
                  onDoubleClick={() => setLocation("/login")}
                  data-testid="phone-employee-login"
                >
                  <Phone className="h-3 w-3" />
                  <span>11 99294-0168</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-lg mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Buscar produtos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  data-testid="input-search-header"
                />
              </div>
            </form>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/")}
                className="text-white hover:bg-zinc-800"
                data-testid="button-home"
              >
                <Home className="h-5 w-5" />
              </Button>
              
              <Button 
                variant="ghost"
                size="icon"
                className="text-white hover:bg-zinc-800 relative"
                onClick={openCart}
                data-testid="button-cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                )}
              </Button>
              
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/login")}
                className="text-white hover:bg-zinc-800 hidden sm:flex"
                data-testid="button-login"
              >
                <User className="h-4 w-4 mr-1" />
                Entrar
              </Button>
              
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/register")}
                className="text-white hover:bg-zinc-800 hidden sm:flex"
                data-testid="button-register"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Cadastrar
              </Button>
              
              <Button 
                onClick={() => setLocation("/login")}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="button-atacado-login"
              >
                <Store className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Atacado</span>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden lg:block w-64 border-r bg-muted/30 shrink-0">
          <ScrollArea className="h-[calc(100vh-64px)]">
            <div className="p-4">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                Categorias
              </h2>
              <div className="space-y-1">
                <Button
                  variant={category === "all" ? "secondary" : "ghost"}
                  className="w-full justify-start text-sm h-9"
                  onClick={() => selectCategory("all")}
                  data-testid="button-category-all"
                >
                  Todas as Categorias
                  <Badge variant="outline" className="ml-auto text-xs">
                    {totalProducts}
                  </Badge>
                </Button>
                {categoriesData.map(cat => (
                  <Button
                    key={cat.id}
                    variant={category === cat.name ? "secondary" : "ghost"}
                    className="w-full justify-start text-sm h-9"
                    onClick={() => selectCategory(cat.name)}
                    data-testid={`button-category-${cat.id}`}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>

              {brands.length > 0 && (
                <>
                  <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3 mt-6">
                    Marcas
                  </h2>
                  <div className="space-y-1">
                    <Button
                      variant={brand === "all" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm h-9"
                      onClick={() => setBrand("all")}
                      data-testid="button-brand-all"
                    >
                      Todas as Marcas
                    </Button>
                    {brands.map(b => (
                      <Button
                        key={b}
                        variant={brand === b ? "secondary" : "ghost"}
                        className="w-full justify-start text-sm h-9"
                        onClick={() => setBrand(b)}
                        data-testid={`button-brand-${b}`}
                      >
                        {b}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="border-b bg-background sticky top-[64px] z-40">
            <div className="p-4">
              <form onSubmit={handleSearch} className="md:hidden mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produtos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-mobile"
                  />
                </div>
              </form>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="lg:hidden"
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    data-testid="button-toggle-filters"
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    Filtros
                  </Button>
                  
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{filteredProducts.length}</span> produtos
                    {category !== "all" && (
                      <span> em <span className="font-medium text-foreground">{category}</span></span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {hasFilters && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearFilters}
                      data-testid="button-clear-filters"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Limpar filtros
                    </Button>
                  )}
                  
                  <div className="flex border rounded-md">
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8 rounded-r-none"
                      onClick={() => setViewMode("grid")}
                      data-testid="button-view-grid"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8 rounded-l-none"
                      onClick={() => setViewMode("list")}
                      data-testid="button-view-list"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {showMobileFilters && (
                <div className="mt-3 pt-3 border-t lg:hidden">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={category === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => selectCategory("all")}
                    >
                      Todas
                    </Button>
                    {categoriesData.map(cat => (
                      <Button
                        key={cat.id}
                        variant={category === cat.name ? "default" : "outline"}
                        size="sm"
                        onClick={() => selectCategory(cat.name)}
                      >
                        {cat.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 p-4">
            {productsLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Carregando produtos...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Package className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Nenhum produto encontrado</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {hasFilters ? "Tente ajustar os filtros de busca" : "Os produtos serao exibidos aqui quando forem cadastrados"}
                </p>
                {hasFilters && (
                  <Button variant="outline" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {filteredProducts.map(product => (
                  <Card 
                    key={product.id}
                    className="overflow-hidden group hover-elevate transition-all duration-200"
                    data-testid={`card-product-${product.id}`}
                  >
                    <div className="aspect-square bg-muted/30 flex items-center justify-center relative overflow-hidden">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <Package className="h-12 w-12 text-muted-foreground/20" />
                      )}
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm">
                          <Badge variant="destructive">Indisponivel</Badge>
                        </div>
                      )}
                      {product.brand && (
                        <div className="absolute top-1.5 left-1.5">
                          <Badge variant="secondary" className="text-xs font-medium bg-background/90 backdrop-blur-sm">
                            {product.brand}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground mb-1 font-mono">
                        {product.sku}
                      </p>
                      <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem] leading-tight mb-2">
                        {product.name}
                      </h3>
                      <p className="text-base font-bold text-orange-600 dark:text-orange-500 mb-3" data-testid={`text-price-${product.id}`}>
                        {formatPrice(product.price)}
                      </p>
                      
                      {product.stock > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            type="number"
                            min="0"
                            max="999"
                            value={getQuantity(product.id)}
                            onChange={(e) => setQuantity(product.id, parseInt(e.target.value) || 0)}
                            className="h-9 w-16 text-center text-sm"
                            data-testid={`input-qty-${product.id}`}
                          />
                          <Button
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white h-9 font-semibold"
                            onClick={() => handleAddToCart(product)}
                            data-testid={`button-add-cart-${product.id}`}
                          >
                            COMPRAR
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map(product => (
                  <Card 
                    key={product.id}
                    className="overflow-hidden hover-elevate transition-all duration-200"
                    data-testid={`card-product-${product.id}`}
                  >
                    <div className="flex gap-4 p-3">
                      <div className="w-20 h-20 bg-muted/30 rounded-md flex items-center justify-center shrink-0 overflow-hidden">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="h-8 w-8 text-muted-foreground/20" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground font-mono">
                              {product.sku}
                            </p>
                            <h3 className="font-medium text-sm truncate">
                              {product.name}
                            </h3>
                            {product.brand && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {product.brand}
                              </Badge>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-bold text-orange-600 dark:text-orange-500" data-testid={`text-price-${product.id}`}>
                              {formatPrice(product.price)}
                            </p>
                          </div>
                        </div>
                        
                        {product.stock > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <Input
                              type="number"
                              min="0"
                              max="999"
                              value={getQuantity(product.id)}
                              onChange={(e) => setQuantity(product.id, parseInt(e.target.value) || 0)}
                              className="h-8 w-14 text-center text-sm"
                              data-testid={`input-qty-${product.id}`}
                            />
                            <Button
                              className="bg-orange-500 hover:bg-orange-600 text-white h-8 font-semibold"
                              onClick={() => handleAddToCart(product)}
                              data-testid={`button-add-cart-${product.id}`}
                            >
                              COMPRAR
                            </Button>
                          </div>
                        )}
                        
                        {product.stock === 0 && (
                          <Badge variant="destructive" className="mt-2">Indisponivel</Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        className="w-9"
                        onClick={() => setPage(pageNum)}
                        data-testid={`button-page-${pageNum}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  data-testid="button-next-page"
                >
                  Proxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="border-t py-4 bg-zinc-900 text-white">
        <div className="container mx-auto px-4 text-center text-sm">
          <p className="text-zinc-400">
            Precos de varejo. Para precos de atacado, 
            <span 
              className="text-orange-500 cursor-pointer hover:underline ml-1"
              onClick={() => setLocation("/login")}
            >
              faca login
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
