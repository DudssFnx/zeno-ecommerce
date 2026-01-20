import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ZenoLogo } from "@/components/ZenoLogo";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import type { Category, Product as SchemaProduct } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import Autoplay from "embla-carousel-autoplay";
import { Loader2, Package, ShoppingCart, User } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useLocation } from "wouter";

/**
 * ✅ BANNERS SEGUROS (URLs Externas)
 * Removidos imports de @assets que quebravam o build no Railway
 */
const BANNERS = [
  "https://images.unsplash.com/photo-1542831371-d531d36971e6?q=80&w=1920",
  "https://images.unsplash.com/photo-1515168833906-d2a3b82b302a?q=80&w=1920",
];

interface ProductsResponse {
  products: SchemaProduct[];
  total: number;
  page: number;
  totalPages: number;
}

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [showEmployeeLogin, setShowEmployeeLogin] = useState(false);
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<NodeJS.Timeout | null>(null);
  const { addItem, itemCount, openCart } = useCart();
  const { toast } = useToast();

  const handleLogoClick = useCallback(() => {
    logoClickCount.current += 1;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);

    if (logoClickCount.current >= 3) {
      setShowEmployeeLogin(true);
      logoClickCount.current = 0;
    } else {
      logoClickTimer.current = setTimeout(() => {
        logoClickCount.current = 0;
      }, 1000);
    }
  }, []);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/public/categories"],
    queryFn: async () => {
      const res = await fetch("/api/public/categories");
      if (!res.ok) throw new Error("Erro ao buscar categorias");
      return res.json();
    },
  });

  const { data: productsResponse, isLoading } = useQuery<ProductsResponse>({
    queryKey: ["/api/public/products"],
    queryFn: async () => {
      const res = await fetch("/api/public/products?limit=12");
      if (!res.ok) throw new Error("Erro ao buscar produtos");
      return res.json();
    },
  });

  const products = productsResponse?.products ?? [];

  const formatPrice = (price: string | number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(price));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/catalogo?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const setQuantity = (id: number, qty: number) => {
    setQuantities((p) => ({ ...p, [id]: Math.max(0, qty) }));
  };

  const handleAddToCart = (product: SchemaProduct) => {
    const qty = quantities[product.id] ?? 0;
    if (!qty) {
      toast({
        title: "Informe a quantidade",
        variant: "destructive",
      });
      return;
    }

    addItem({
      productId: String(product.id),
      name: product.name,
      sku: product.sku,
      price: Number(product.price),
      quantity: qty,
      image: product.image ?? undefined,
    });

    toast({ title: "Produto adicionado ao carrinho" });
    setQuantity(product.id, 0);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-zinc-900 text-white">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <div onClick={handleLogoClick} className="cursor-pointer">
            <ZenoLogo variant="light" />
          </div>

          <form onSubmit={handleSearch} className="flex-1 hidden md:block">
            <Input
              className="bg-zinc-800 border-zinc-700 text-white"
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <Button
            variant="ghost"
            onClick={openCart}
            className="text-white hover:bg-zinc-800"
          >
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="ml-2 bg-orange-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                {itemCount}
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={() => setLocation("/login")}
            className="text-white hover:bg-zinc-800"
          >
            <User className="mr-2 h-4 w-4" /> Entrar
          </Button>

          <ThemeToggle />
        </div>
      </header>

      {/* BANNERS */}
      <Carousel plugins={[Autoplay({ delay: 4000 })]} className="w-full">
        <CarouselContent>
          {BANNERS.map((src, i) => (
            <CarouselItem key={i}>
              <div className="relative h-[300px] w-full">
                <img
                  src={src}
                  alt={`Banner ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-4" />
        <CarouselNext className="right-4" />
      </Carousel>

      {/* PRODUTOS */}
      <main className="container mx-auto px-4 py-8 flex-1">
        <h2 className="text-2xl font-bold mb-6">Destaques</h2>
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {products.map((p) => (
              <Card
                key={p.id}
                className="overflow-hidden hover:shadow-md transition-shadow"
              >
                <CardContent className="p-2">
                  <div className="aspect-square bg-muted flex items-center justify-center rounded-md overflow-hidden mb-2">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {p.sku}
                  </p>
                  <p className="font-medium text-sm line-clamp-2 h-10 mb-1">
                    {p.name}
                  </p>
                  <p className="font-bold text-lg text-orange-600">
                    {formatPrice(p.price)}
                  </p>
                  <div className="flex flex-col gap-2 mt-3">
                    <Input
                      type="number"
                      min="0"
                      className="h-8"
                      placeholder="Qtd"
                      value={quantities[p.id] || ""}
                      onChange={(e) =>
                        setQuantity(p.id, Number(e.target.value))
                      }
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleAddToCart(p)}
                    >
                      Adicionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-zinc-900 text-zinc-400 py-8 text-center text-xs border-t border-zinc-800">
        <div className="container mx-auto px-4">
          <p>© 2026 Zeno — Plataforma de E-commerce B2B & Varejo</p>
          <p className="mt-2 text-zinc-600">Todos os direitos reservados</p>
        </div>
      </footer>

      {/* LOGIN FUNCIONÁRIO */}
      <Dialog open={showEmployeeLogin} onOpenChange={setShowEmployeeLogin}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Painel Administrativo</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <p className="text-sm text-muted-foreground mb-4">
              Você está acessando a área restrita para funcionários e
              administradores.
            </p>
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Ir para tela de login
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
