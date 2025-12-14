import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi
} from "@/components/ui/carousel";
import { 
  Phone, 
  Store, 
  Search, 
  Package,
  ChevronRight,
  Loader2,
  ShoppingBag,
  Sparkles,
  Truck,
  CreditCard,
  Shield,
  Percent,
  ShoppingCart,
  User,
  UserPlus
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Product as SchemaProduct, Category } from "@shared/schema";
import { useCart } from "@/contexts/CartContext";
import logoImage from "@assets/image_1765659931449.png";
import bannerImage1 from "@assets/image_1765676126936.png";
import bannerImage2 from "@assets/image_1765676145067.png";

interface ProductsResponse {
  products: SchemaProduct[];
  total: number;
  page: number;
  totalPages: number;
}

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { totalItems } = useCart();

  const { data: categoriesData = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/public/categories'],
    queryFn: async () => {
      const res = await fetch('/api/public/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });

  const { data: newProductsResponse, isLoading: newProductsLoading } = useQuery<ProductsResponse>({
    queryKey: ['/api/public/products', 'new'],
    queryFn: async () => {
      const res = await fetch('/api/public/products?limit=6&sort=newest');
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
  });

  const { data: productsResponse, isLoading: productsLoading } = useQuery<ProductsResponse>({
    queryKey: ['/api/public/products', 'featured'],
    queryFn: async () => {
      const res = await fetch('/api/public/products?limit=12');
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
  });

  const newProductsData = newProductsResponse?.products || [];
  const productsData = productsResponse?.products || [];

  const categoryMap = useMemo(() => {
    const map: Record<number, string> = {};
    categoriesData.forEach(cat => {
      map[cat.id] = cat.name;
    });
    return map;
  }, [categoriesData]);

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numPrice);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/catalogo?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-zinc-900 text-white">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img 
                src={logoImage} 
                alt="Lojamadrugadao" 
                className="h-12 w-12 rounded-full border-2 border-white/20"
                data-testid="img-logo"
              />
              <div className="hidden sm:block">
                <h1 className="font-bold text-lg tracking-wide">LOJAMADRUGADAO</h1>
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

            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Buscar produtos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  data-testid="input-search"
                />
              </div>
            </form>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/login")}
                className="text-white hover:bg-zinc-800 relative"
                data-testid="button-cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                    {totalItems > 99 ? "99+" : totalItems}
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

      <section className="relative">
        <Carousel 
          opts={{ loop: true }} 
          className="w-full"
          data-testid="carousel-banner"
        >
          <CarouselContent>
            <CarouselItem>
              <div className="relative aspect-[21/9] md:aspect-[3/1] w-full overflow-hidden">
                <img 
                  src={bannerImage1} 
                  alt="Promocao Bem Bolado" 
                  className="w-full h-full object-cover"
                  data-testid="img-banner-1"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center">
                  <div className="container mx-auto px-4">
                    <div className="max-w-lg">
                      <h2 className="text-2xl md:text-4xl font-bold text-white mb-2">
                        Bem-vindo ao Madrugadao
                      </h2>
                      <p className="text-white/80 text-sm md:text-base mb-4">
                        Os melhores produtos com os melhores precos
                      </p>
                      <Button 
                        size="lg"
                        onClick={() => setLocation("/catalogo")}
                        className="bg-orange-500 hover:bg-orange-600"
                        data-testid="button-ver-catalogo"
                      >
                        <ShoppingBag className="h-5 w-5 mr-2" />
                        Ver Catalogo Completo
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>
            <CarouselItem>
              <div className="relative aspect-[21/9] md:aspect-[3/1] w-full overflow-hidden">
                <img 
                  src={bannerImage2} 
                  alt="Promocao Especial" 
                  className="w-full h-full object-cover"
                  data-testid="img-banner-2"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center">
                  <div className="container mx-auto px-4">
                    <div className="max-w-lg">
                      <h2 className="text-2xl md:text-4xl font-bold text-white mb-2">
                        Ofertas Especiais
                      </h2>
                      <p className="text-white/80 text-sm md:text-base mb-4">
                        Confira nossas promocoes exclusivas
                      </p>
                      <Button 
                        size="lg"
                        onClick={() => setLocation("/catalogo")}
                        className="bg-orange-500 hover:bg-orange-600"
                        data-testid="button-ver-ofertas"
                      >
                        <ShoppingBag className="h-5 w-5 mr-2" />
                        Ver Ofertas
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>
            <CarouselItem>
              <div className="relative aspect-[21/9] md:aspect-[3/1] w-full overflow-hidden bg-gradient-to-r from-zinc-900 to-zinc-800">
                <div className="absolute inset-0 flex items-center">
                  <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="max-w-lg text-center md:text-left">
                        <h2 className="text-2xl md:text-4xl font-bold text-white mb-2">
                          Compre no Atacado
                        </h2>
                        <p className="text-white/80 text-sm md:text-base mb-4">
                          Precos exclusivos para revendedores. Cadastre-se e economize ate 40% nos produtos!
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                          <Button 
                            size="lg"
                            onClick={() => setLocation("/register")}
                            className="bg-orange-500 hover:bg-orange-600"
                            data-testid="button-cadastrar-atacado"
                          >
                            <Store className="h-5 w-5 mr-2" />
                            Solicitar Cadastro
                          </Button>
                          <Button 
                            size="lg"
                            variant="outline"
                            onClick={() => setLocation("/login")}
                            className="border-white/30 text-white hover:bg-white/10"
                            data-testid="button-ja-tenho-conta"
                          >
                            Ja tenho conta
                          </Button>
                        </div>
                      </div>
                      <div className="hidden md:flex items-center gap-4">
                        <div className="text-center p-4 bg-white/10 rounded-lg">
                          <p className="text-3xl font-bold text-orange-500">40%</p>
                          <p className="text-white/80 text-sm">de desconto</p>
                        </div>
                        <div className="text-center p-4 bg-white/10 rounded-lg">
                          <p className="text-3xl font-bold text-orange-500">12x</p>
                          <p className="text-white/80 text-sm">sem juros</p>
                        </div>
                        <div className="text-center p-4 bg-white/10 rounded-lg">
                          <p className="text-3xl font-bold text-orange-500">Frete</p>
                          <p className="text-white/80 text-sm">Gratis SP</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>
          </CarouselContent>
          <CarouselPrevious className="left-4" />
          <CarouselNext className="right-4" />
        </Carousel>
      </section>

      <form onSubmit={handleSearch} className="md:hidden container mx-auto px-4 py-4">
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

      {categoriesData.length > 0 && (
        <section className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Categorias</h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/catalogo")}
              data-testid="button-ver-categorias"
            >
              Ver todas
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          {categoriesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {categoriesData.slice(0, 10).map(category => (
                <Button
                  key={category.id}
                  variant="outline"
                  className="shrink-0 px-4"
                  onClick={() => setLocation(`/catalogo?category=${encodeURIComponent(category.name)}`)}
                  data-testid={`button-category-${category.id}`}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="bg-muted/50 py-4 border-y">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 md:gap-12 text-sm">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-orange-500" />
              <div>
                <p className="font-semibold">Frete Gratis</p>
                <p className="text-xs text-muted-foreground">Acima de R$299</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-orange-500" />
              <div>
                <p className="font-semibold">12x no Cartao</p>
                <p className="text-xs text-muted-foreground">Sem juros</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              <div>
                <p className="font-semibold">100% Seguro</p>
                <p className="text-xs text-muted-foreground">Compra protegida</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-orange-500" />
              <div>
                <p className="font-semibold">5% Desconto</p>
                <p className="text-xs text-muted-foreground">Pagamento via PIX</p>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            *Condicoes validas apenas para compras no varejo
          </p>
        </div>
      </section>

      {categoriesData.length >= 3 && (
        <section className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categoriesData.slice(0, 3).map((category, index) => (
              <Card 
                key={category.id}
                className="overflow-hidden cursor-pointer group hover-elevate"
                onClick={() => setLocation(`/catalogo?category=${encodeURIComponent(category.name)}`)}
                data-testid={`banner-category-${category.id}`}
              >
                <div className="relative h-32 md:h-40 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <h3 className="relative text-xl md:text-2xl font-bold text-white text-center px-4 group-hover:scale-105 transition-transform">
                    {category.name.toUpperCase()}
                  </h3>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {newProductsData.length > 0 && (
        <section className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              <h2 className="text-xl font-bold">Lancamentos</h2>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/catalogo")}
              data-testid="button-ver-lancamentos"
            >
              Ver todos
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          {newProductsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {newProductsData.map(product => (
                <Card 
                  key={product.id}
                  className="overflow-hidden group hover-elevate transition-all duration-200 cursor-pointer ring-2 ring-orange-500/20"
                  onClick={() => setLocation("/catalogo")}
                  data-testid={`card-new-product-${product.id}`}
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
                    <div className="absolute top-1.5 right-1.5">
                      <Badge className="text-xs font-medium bg-orange-500 text-white">
                        Novo
                      </Badge>
                    </div>
                    {product.brand && (
                      <div className="absolute top-1.5 left-1.5">
                        <Badge variant="secondary" className="text-xs font-medium bg-background/90 backdrop-blur-sm">
                          {product.brand}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs text-muted-foreground mb-0.5 font-mono">
                      {product.sku}
                    </p>
                    <h3 className="font-medium text-xs line-clamp-2 min-h-[2rem] leading-tight mb-1">
                      {product.name}
                    </h3>
                    <p className="text-sm font-bold text-primary">
                      {formatPrice(product.price)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="container mx-auto px-4 py-6 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Produtos em Destaque</h2>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation("/catalogo")}
            data-testid="button-ver-produtos"
          >
            Ver todos
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {productsLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando produtos...</p>
          </div>
        ) : productsData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Package className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Nenhum produto disponivel</h3>
            <p className="text-muted-foreground text-sm">
              Os produtos serao exibidos aqui quando forem cadastrados
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {productsData.map(product => (
              <Card 
                key={product.id}
                className="overflow-hidden group hover-elevate transition-all duration-200 cursor-pointer"
                onClick={() => setLocation("/catalogo")}
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
                <CardContent className="p-2">
                  <p className="text-xs text-muted-foreground mb-0.5 font-mono">
                    {product.sku}
                  </p>
                  <h3 className="font-medium text-xs line-clamp-2 min-h-[2rem] leading-tight mb-1">
                    {product.name}
                  </h3>
                  <p className="text-sm font-bold text-primary" data-testid={`text-price-${product.id}`}>
                    {formatPrice(product.price)}
                  </p>
                  {product.categoryId && categoryMap[product.categoryId] && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {categoryMap[product.categoryId]}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="bg-zinc-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Quer precos de atacado?</h2>
            <p className="text-zinc-400 mb-6">
              Faca seu cadastro e tenha acesso a precos exclusivos para revendedores
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                size="lg"
                onClick={() => setLocation("/register")}
                className="bg-orange-500 hover:bg-orange-600"
                data-testid="button-cadastrar"
              >
                Solicitar Cadastro
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => setLocation("/login")}
                className="border-zinc-700 text-white hover:bg-zinc-800"
                data-testid="button-entrar"
              >
                Ja tenho cadastro
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img 
                src={logoImage} 
                alt="Lojamadrugadao" 
                className="h-10 w-10 rounded-full"
              />
              <div>
                <p className="font-semibold text-sm">LOJAMADRUGADAO SAO PAULO</p>
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <Phone className="h-3 w-3" />
                  <span>11 99294-0168</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Precos de varejo. Para precos de atacado, faca login.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
