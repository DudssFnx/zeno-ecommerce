import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Phone, X, Users } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logoImage from "@assets/image_1765659931449.png";
import bannerImage from "@assets/image_1765667052902.png";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [showEmployeeLogin, setShowEmployeeLogin] = useState(false);
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Login realizado com sucesso!",
        description: "Redirecionando...",
      });
      setTimeout(() => {
        window.location.href = "/catalog";
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no login",
        description: error.message || "Verifique suas credenciais",
        variant: "destructive",
      });
    },
  });

  const employeeLoginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Login de funcionario realizado!",
        description: "Redirecionando para o painel...",
      });
      setShowEmployeeLogin(false);
      setTimeout(() => {
        window.location.href = "/admin";
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no login",
        description: error.message || "Credenciais invalidas",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Campos obrigatorios",
        description: "Preencha email e senha",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ email, password });
  };

  const handleEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeEmail || !employeePassword) {
      toast({
        title: "Campos obrigatorios",
        description: "Preencha email e senha",
        variant: "destructive",
      });
      return;
    }
    employeeLoginMutation.mutate({ email: employeeEmail, password: employeePassword });
  };

  const handleLogoClick = () => {
    clickCountRef.current += 1;
    
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    
    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      setShowEmployeeLogin(true);
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 1000);
    }
  };

  const handleForgotPassword = () => {
    toast({
      title: "Recuperacao de senha",
      description: "Entre em contato pelo WhatsApp para recuperar sua senha",
    });
  };

  const handleRequestAccess = () => {
    setLocation("/register");
  };

  const handleViewCatalog = () => {
    setLocation("/catalog");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="flex-1 bg-white dark:bg-background flex flex-col justify-center px-8 py-12 lg:px-16 lg:py-0">
        <div className="max-w-md mx-auto w-full">
          <div className="flex flex-col items-center mb-8">
            <div
              onClick={handleLogoClick}
              className="select-none"
              data-testid="button-logo-secret"
            >
              <img 
                src={logoImage} 
                alt="Lojamadrugadao" 
                className="h-20 w-20 rounded-full mb-4"
                draggable={false}
                data-testid="img-logo"
              />
            </div>
            <h1 className="text-xl font-bold text-foreground text-center" data-testid="text-title">
              LOJAMADRUGADAO SAO PAULO
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground mt-2">
              <Phone className="h-4 w-4" />
              <span className="text-sm" data-testid="text-phone">11 99294-0168</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="sr-only">Email ou CPF/CNPJ</Label>
              <Input
                id="email"
                type="text"
                placeholder="Email ou CPF/CNPJ"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="sr-only">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-10"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-lg"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? "Entrando..." : "Acessar"}
            </Button>
          </form>

          <div className="flex items-center justify-between mt-6 text-sm">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-primary hover:underline"
              data-testid="link-forgot-password"
            >
              Esqueci minha senha
            </button>
            <button
              type="button"
              onClick={handleRequestAccess}
              className="text-primary hover:underline"
              data-testid="link-request-access"
            >
              Solicitar acesso
            </button>
          </div>

          <div className="mt-12 pt-6 border-t border-border">
            <button
              type="button"
              onClick={handleViewCatalog}
              className="w-full text-center text-muted-foreground hover:text-foreground text-sm"
              data-testid="link-view-catalog"
            >
              Continuar visualizando o catalogo sem precos
            </button>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <img 
          src={bannerImage} 
          alt="Promocao BEM BOLADO 10% desconto" 
          className="absolute inset-0 w-full h-full object-cover object-right"
          data-testid="img-banner"
        />
      </div>

      <div className="lg:hidden relative h-48 overflow-hidden">
        <img 
          src={bannerImage} 
          alt="Promocao BEM BOLADO 10% desconto" 
          className="w-full h-full object-cover object-right"
          data-testid="img-banner-mobile"
        />
      </div>

      <Dialog open={showEmployeeLogin} onOpenChange={setShowEmployeeLogin}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Acesso Funcionarios
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEmployeeSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="employee-email">Email</Label>
              <Input
                id="employee-email"
                type="email"
                placeholder="email@empresa.com.br"
                value={employeeEmail}
                onChange={(e) => setEmployeeEmail(e.target.value)}
                className="h-12"
                data-testid="input-employee-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee-password">Senha</Label>
              <div className="relative">
                <Input
                  id="employee-password"
                  type={showEmployeePassword ? "text" : "password"}
                  placeholder="Senha"
                  value={employeePassword}
                  onChange={(e) => setEmployeePassword(e.target.value)}
                  className="h-12 pr-10"
                  data-testid="input-employee-password"
                />
                <button
                  type="button"
                  onClick={() => setShowEmployeePassword(!showEmployeePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  data-testid="button-toggle-employee-password"
                >
                  {showEmployeePassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12"
              disabled={employeeLoginMutation.isPending}
              data-testid="button-employee-login"
            >
              {employeeLoginMutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
