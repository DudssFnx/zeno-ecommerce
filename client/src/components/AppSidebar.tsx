import { CompanySelector } from "@/components/CompanySelector";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Calendar,
  ChevronRight,
  ClipboardList,
  CreditCard,
  ExternalLink,
  Grid3X3,
  LayoutDashboard,
  Link2,
  LogOut,
  Package,
  Palette,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store, // <--- NOVO IMPORT
  Tag,
  Ticket,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import { Link, useLocation } from "wouter";

type UserRole = "admin" | "sales" | "customer" | "supplier" | "employee";

interface MenuItem {
  title: string;
  url?: string;
  icon: any;
  moduleKey?: string;
  badge?: string;
  subItems?: {
    title: string;
    url: string;
    icon: any;
    moduleKey?: string;
    badge?: string;
  }[];
}

interface AppSidebarProps {
  onLogout?: () => void;
}

// --- CONFIGURAÇÃO DOS MENUS ---
const allMenuItems: MenuItem[] = [
  {
    title: "Painel",
    icon: LayoutDashboard,
    moduleKey: "dashboard",
    subItems: [
      {
        title: "Visao Geral",
        url: "/",
        icon: LayoutDashboard,
        moduleKey: "dashboard",
      },
      {
        title: "Analise de Clientes",
        url: "/customer-analytics",
        icon: BarChart3,
        moduleKey: "dashboard",
      },
      {
        title: "Analise de Produtos",
        url: "/product-analytics",
        icon: TrendingUp,
        moduleKey: "dashboard",
      },
      {
        title: "Analise de Funcionarios",
        url: "/employee-analytics",
        icon: Users,
        moduleKey: "dashboard",
      },
      {
        title: "Analise de Compras",
        url: "/purchases-dashboard",
        icon: ShoppingCart,
        moduleKey: "dashboard",
      },
      {
        title: "Marcas",
        url: "/brand-analytics",
        icon: Tag,
        moduleKey: "brands",
      },
    ],
  },
  {
    title: "Categorias",
    url: "/categories",
    icon: Grid3X3,
    moduleKey: "products", // Pode manter products ou criar um key especifico se quiser
  },

  // --- ALTERAÇÃO AQUI: Catálogo separado para Vendas ---
  {
    title: "Catálogo",
    url: "/catalog",
    icon: Store, // Ícone de loja para diferenciar
    moduleKey: "sales_catalog", // <--- A NOVA CHAVE QUE CRIAMOS NO BANCO
  },

  {
    title: "Pedido de Vendas",
    url: "/orders",
    icon: ClipboardList,
    moduleKey: "orders",
  },

  // --- ALTERAÇÃO AQUI: Gestão Restrita ---
  {
    title: "Gestão de Produtos", // Nome mais claro
    url: "/products",
    icon: Package,
    moduleKey: "products", // <--- A CHAVE ANTIGA (Restrita a Admins)
  },

  { title: "Clientes", url: "/customers", icon: UserCheck, moduleKey: "users" },
  { title: "Usuarios", url: "/users", icon: Users, moduleKey: "users" },
  {
    title: "Fornecedores",
    url: "/suppliers",
    icon: Truck,
    moduleKey: "products",
  },
  {
    title: "Pedidos de Compra",
    url: "/purchase-orders",
    icon: ShoppingBag,
    moduleKey: "products",
  },
  { title: "Cupons", url: "/coupons", icon: Ticket, moduleKey: "products" },
  {
    title: "Financeiro",
    icon: Banknote,
    moduleKey: "settings",
    subItems: [
      {
        title: "Contas a Receber",
        url: "/contas-receber",
        icon: ArrowUpRight,
        moduleKey: "settings",
      },
      {
        title: "Contas a Pagar",
        url: "/contas-pagar",
        icon: ArrowDownRight,
        moduleKey: "settings",
      },
      {
        title: "Pagamentos",
        url: "/payments",
        icon: CreditCard,
        moduleKey: "settings",
      },
    ],
  },
  { title: "Agenda", url: "/agenda", icon: Calendar, moduleKey: "agenda" },
  { title: "Bling", url: "/bling", icon: Link2, moduleKey: "settings" },
  {
    title: "Aparencia",
    url: "/appearance",
    icon: Palette,
    moduleKey: "settings",
  },
  {
    title: "Configuracoes",
    url: "/settings",
    icon: Settings,
    moduleKey: "settings",
  },
];

const customerMenuItems: MenuItem[] = [
  { title: "Painel", url: "/", icon: LayoutDashboard, moduleKey: "catalog" },
  {
    title: "Categorias",
    url: "/categories",
    icon: Grid3X3,
    moduleKey: "catalog",
  },
  { title: "Catalogo", url: "/catalog", icon: Package, moduleKey: "catalog" },
  {
    title: "Meus Pedidos",
    url: "/orders",
    icon: ClipboardList,
    moduleKey: "orders",
  },
];

const supplierMenuItems: MenuItem[] = [
  { title: "Marcas", url: "/brand-analytics", icon: Tag, moduleKey: "brands" },
];

export function AppSidebar({ onLogout }: AppSidebarProps) {
  const [location] = useLocation();
  const { user: contextUser, isLoading, logout } = useAuth();

  // 1. Busca dados frescos do usuário para garantir que temos os módulos
  const { data: userData } = useQuery<any>({
    queryKey: ["/api/auth/user"],
    staleTime: 0, // Sempre pega dados frescos
    enabled: !!contextUser, // Só busca se estiver logado
  });

  if (isLoading) {
    return (
      <Sidebar className="border-r-0">
        <SidebarContent>
          <div className="p-4 space-y-4">
            <SidebarMenuSkeleton />
            <SidebarMenuSkeleton />
            <SidebarMenuSkeleton />
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  // Define qual objeto de usuário usar (o da query fresca ou do contexto)
  const user = userData || contextUser;
  const role = (user?.role as UserRole) || "customer";
  const name = user?.firstName || user?.email || "User";
  const isAdmin = role === "admin";

  // 2. Processamento robusto dos módulos
  let userModules: string[] = [];
  try {
    if (user?.modules) {
      userModules =
        typeof user.modules === "string"
          ? JSON.parse(user.modules)
          : user.modules;
    }
  } catch (e) {
    console.error("Erro ao processar módulos:", e);
    userModules = [];
  }

  // --- DEBUG: Veja isso no Console do navegador (F12) ---
  console.log("DEBUG SIDEBAR:", { role, userModules, isAdmin });

  // 3. Função de Filtro
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    if (isAdmin) return items;

    return items
      .filter((item) => {
        // Se não tem moduleKey, mostra sempre (ex: links públicos se houver)
        // Se tem moduleKey, checa se está na lista do usuário
        if (item.moduleKey && !userModules.includes(item.moduleKey)) {
          return false;
        }

        // Verifica subitens
        if (item.subItems) {
          const visibleSubItems = item.subItems.filter(
            (sub) => !sub.moduleKey || userModules.includes(sub.moduleKey),
          );
          return visibleSubItems.length > 0;
        }

        return true;
      })
      .map((item) => {
        if (item.subItems) {
          return {
            ...item,
            subItems: item.subItems.filter(
              (sub) => !sub.moduleKey || userModules.includes(sub.moduleKey),
            ),
          };
        }
        return item;
      });
  };

  const baseItems =
    role === "customer"
      ? customerMenuItems
      : role === "supplier"
        ? supplierMenuItems
        : allMenuItems;

  const items = filterMenuItems(baseItems);

  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const getRoleBadgeVariant = (r: UserRole) => {
    switch (r) {
      case "admin":
        return "default";
      case "sales":
        return "secondary";
      case "supplier":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (r: UserRole) => {
    switch (r) {
      case "admin":
        return "Administrador";
      case "sales":
        return "Vendedor";
      case "employee":
        return "Funcionário";
      case "supplier":
        return "Fornecedor";
      default:
        return "Cliente";
    }
  };

  const handleLogout = () => {
    if (onLogout) onLogout();
    logout();
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-0">
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
              <span className="text-xl font-black text-white tracking-tighter">
                Z
              </span>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 ring-2 ring-sidebar" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-lg tracking-tight truncate bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-400 dark:to-emerald-300 bg-clip-text text-transparent">
                Zeno
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Sparkles className="h-3 w-3 text-emerald-500" />
                <span className="text-xs text-muted-foreground">
                  B2B Platform
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Empresa
          </p>
          <CompanySelector />
        </div>

        <div className="px-4 pb-4 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Visualizar como
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => window.open("/", "_blank")}
              data-testid="button-ver-varejo"
            >
              <ExternalLink className="h-3 w-3 mr-1.5" />
              Varejo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => window.open("/catalog", "_blank")}
              data-testid="button-ver-atacado"
            >
              <ExternalLink className="h-3 w-3 mr-1.5" />
              Atacado
            </Button>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-2">
            Navegacao
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) =>
                item.subItems ? (
                  <Collapsible
                    key={item.title}
                    defaultOpen
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          className="group/btn rounded-lg"
                          data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/50 group-hover/btn:bg-primary/10 transition-colors">
                            <item.icon className="h-4 w-4 text-muted-foreground group-hover/btn:text-primary transition-colors" />
                          </div>
                          <span className="font-medium">{item.title}</span>
                          {item.badge && (
                            <Badge
                              variant="secondary"
                              className="ml-auto mr-2 h-5 text-[10px]"
                            >
                              {item.badge}
                            </Badge>
                          )}
                          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="transition-all">
                        <SidebarMenuSub className="ml-6 border-l border-border/50 pl-2">
                          {item.subItems.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={location === subItem.url}
                                className="rounded-md"
                                data-testid={`link-nav-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                              >
                                <Link href={subItem.url}>
                                  <subItem.icon className="h-3.5 w-3.5" />
                                  <span className="text-[13px]">
                                    {subItem.title}
                                  </span>
                                  {subItem.badge && (
                                    <Badge
                                      variant="secondary"
                                      className="ml-auto h-4 text-[9px] px-1.5"
                                    >
                                      {subItem.badge}
                                    </Badge>
                                  )}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      className="group/btn rounded-lg"
                      data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.url!}>
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/50 group-hover/btn:bg-primary/10 data-[active=true]:bg-primary/15 transition-colors">
                          <item.icon className="h-4 w-4 text-muted-foreground group-hover/btn:text-primary transition-colors" />
                        </div>
                        <span className="font-medium">{item.title}</span>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            className="ml-auto h-5 text-[10px]"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 mt-auto">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-muted/30">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{name}</p>
            <Badge
              variant={getRoleBadgeVariant(role)}
              className="h-4 text-[9px] px-1.5 mt-0.5"
            >
              {getRoleLabel(role)}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
