import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Moon, Sun, Package, ShoppingCart, Truck, Shield, ArrowRight, Store, Users, DollarSign, Handshake, BadgeCheck } from "lucide-react";
import logoImage from "@assets/image_1765659931449.png";

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const handleRegister = () => {
    window.location.href = "/register";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Lojamadrugadao" className="h-10 w-10 rounded-full" />
            <span className="font-bold text-xl hidden sm:block">Lojamadrugadao</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme-toggle">
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <Button onClick={handleLogin} data-testid="button-login">
              Entrar
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Package className="h-4 w-4" />
              Portal de Atacado Exclusivo
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Bem-vindo ao Portal de Atacado da
              <span className="text-primary block mt-2">Lojamadrugadao</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Fornecendo produtos no atacado para lojistas, revendedores e distribuidores em todo o Brasil.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={handleLogin} className="gap-2" data-testid="button-login-hero">
                Acessar Catálogo
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={handleRegister} data-testid="button-register">
                Criar Conta
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Sobre a Lojamadrugadao</h2>
            </div>
            <div className="prose prose-lg dark:prose-invert max-w-none text-center">
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                A Lojamadrugadao é uma empresa especializada exclusivamente em vendas no atacado, 
                atendendo lojistas, revendedores e empreendedores que buscam preço competitivo, 
                variedade de produtos e atendimento profissional.
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                Nosso foco é facilitar a reposição de estoque dos nossos parceiros comerciais, 
                oferecendo um catálogo completo, condições especiais para grandes volumes e um 
                processo de compra simples, rápido e seguro.
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Aqui não realizamos vendas no varejo. Todas as condições, preços e negociações 
                são pensadas para quem compra em quantidade e precisa de um fornecedor confiável 
                para crescer no mercado.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Para Quem Vendemos</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Atendemos exclusivamente clientes do segmento B2B
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Store className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Lojistas</h3>
                <p className="text-muted-foreground text-sm">
                  Donos de lojas físicas ou virtuais que precisam de produtos para revenda
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Revendedores</h3>
                <p className="text-muted-foreground text-sm">
                  Empreendedores que trabalham com revenda e buscam preços competitivos
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Truck className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Distribuidores</h3>
                <p className="text-muted-foreground text-sm">
                  Empresas que distribuem produtos em sua região e buscam um fornecedor confiável
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Nossos Diferenciais</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Por que escolher a Lojamadrugadao como seu fornecedor de atacado
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="p-6">
              <CardContent className="pt-4">
                <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <BadgeCheck className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">Venda Exclusiva no Atacado</h4>
                <p className="text-sm text-muted-foreground">
                  100% focados em vendas por atacado, sem concorrência com varejo
                </p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardContent className="pt-4">
                <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">Preços Competitivos</h4>
                <p className="text-sm text-muted-foreground">
                  Condições especiais para compras em grandes volumes
                </p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardContent className="pt-4">
                <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <Handshake className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">Atendimento Especializado</h4>
                <p className="text-sm text-muted-foreground">
                  Equipe preparada para atender as necessidades do seu negócio
                </p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardContent className="pt-4">
                <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">Catálogo Amplo</h4>
                <p className="text-sm text-muted-foreground">
                  Grande variedade de produtos para abastecer seu estoque
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Como Funciona</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Sistema prático para você comprar no atacado de forma rápida e organizada
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Package className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">1. Navegue o Catálogo</h3>
                <p className="text-muted-foreground text-sm">
                  Explore nossos produtos organizados por categoria com fotos, preços e estoque atualizado
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">2. Monte seu Pedido</h3>
                <p className="text-muted-foreground text-sm">
                  Adicione produtos ao carrinho e gere seu pedido com poucos cliques. Simples assim.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Truck className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">3. Acompanhe</h3>
                <p className="text-muted-foreground text-sm">
                  Acompanhe o status do seu pedido em tempo real, do processamento até a entrega
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Pronto para Começar?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Entre com sua conta ou crie uma nova para acessar nosso catálogo exclusivo de produtos atacado
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={handleLogin} 
            className="gap-2"
            data-testid="button-login-cta"
          >
            Acessar Agora
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      <footer className="py-8 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              <span>Lojamadrugadao - Portal de Atacado</span>
            </div>
            <p>Plataforma exclusiva para lojistas, revendedores e distribuidores</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
