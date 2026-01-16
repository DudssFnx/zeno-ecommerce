import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CompanySelector } from "@/components/CompanySelector";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Users,
  UserCheck,
  Settings,
  LogOut,
  Grid3X3,
  Link2,
  Ticket,
  BarChart3,
  TrendingUp,
  ChevronRight,
  ExternalLink,
  ShoppingCart,
  ShoppingBag,
  Calendar,
  Palette,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Truck,
  Sparkles,
  Tag,
  CreditCard,
} from "lucide-react";

type UserRole = "admin" | "sales" | "customer" | "supplier";

interface MenuItem {
  title: string;
  url?: string;
  icon: any;
  moduleKey?: string;
  badge?: string;
  subItems?: { title: string; url: string; icon: any; moduleKey?: string; badge?: string }[];
}

interface AppSidebarProps {
  userRole?: UserRole;
  userName?: string;
  onLogout?: () => void;
}

const allMenuItems: MenuItem[] = [
  { 
    title: "Painel", 
    icon: LayoutDashboard,
    moduleKey: "reports",
    subItems: [
      { title: "Visao Geral", url: "/", icon: LayoutDashboard, moduleKey: "reports" },
      { title: "Analise de Clientes", url: "/customer-analytics", icon: BarChart3, moduleKey: "reports" },
      { title: "Analise de Produtos", url: "/product-analytics", icon: TrendingUp, moduleKey: "reports" },
      { title: "Analise de Funcionarios", url: "/employee-analytics", icon: Users, moduleKey: "reports" },
      { title: "Analise de Compras", url: "/purchases-dashboard", icon: ShoppingCart, moduleKey: "reports" },
      { title: "Marcas", url: "/brand-analytics", icon: Tag, moduleKey: "brands" },
    ]
  },
  { title: "Categorias", url: "/categories", icon: Grid3X3, moduleKey: "catalog" },
  { title: "Catalogo", url: "/catalog", icon: Package, moduleKey: "catalog" },
  { title: "Pedido de Vendas", url: "/orders", icon: ClipboardList, moduleKey: "orders" },
  { title: "Produtos", url: "/products", icon: Package, moduleKey: "products" },
  { title: "Clientes", url: "/customers", icon: UserCheck, moduleKey: "customers" },
  { title: "Usuarios", url: "/users", icon: Users, moduleKey: "customers" },
  { title: "Fornecedores", url: "/suppliers", icon: Truck, moduleKey: "products" },
  { title: "Pedidos de Compra", url: "/purchase-orders", icon: ShoppingBag, moduleKey: "products" },
  { title: "Cupons", url: "/coupons", icon: Ticket, moduleKey: "products" },
  { 
    title: "Financeiro", 
    icon: Banknote,
    subItems: [
      { title: "Contas a Receber", url: "/contas-receber", icon: ArrowUpRight, moduleKey: "financial_receivables" },
      { title: "Contas a Pagar", url: "/contas-pagar", icon: ArrowDownRight, moduleKey: "financial_payables" },
      { title: "Pagamentos", url: "/payments", icon: CreditCard, moduleKey: "payments" },
    ]
  },
  { title: "Agenda", url: "/agenda", icon: Calendar, moduleKey: "agenda" },
  { title: "Bling", url: "/bling", icon: Link2, moduleKey: "settings" },
  { title: "Aparencia", url: "/appearance", icon: Palette, moduleKey: "appearance" },
  { title: "Configuracoes", url: "/settings", icon: Settings, moduleKey: "settings" },
];

const customerMenuItems: MenuItem[] = [
  { title: "Painel", url: "/", icon: LayoutDashboard, moduleKey: "catalog" },
  { title: "Categorias", url: "/categories", icon: Grid3X3, moduleKey: "catalog" },
  { title: "Catalogo", url: "/catalog", icon: Package, moduleKey: "catalog" },
  { title: "Meus Pedidos", url: "/orders", icon: ClipboardList, moduleKey: "orders" },
];

const supplierMenuItems: MenuItem[] = [
  { title: "Marcas", url: "/brand-analytics", icon: Tag, moduleKey: "brands" },
];

export function AppSidebar({ userRole = "customer", userName = "User", onLogout }: AppSidebarProps) {
  const [location] = useLocation();

  const { data: permissionsData } = useQuery<{ modules: string[]; role: string }>({
    queryKey: ['/api/auth/permissions'],
    staleTime: 1000 * 60 * 5,
  });

  const userModules = permissionsData?.modules || [];
  const isAdmin = userRole === "admin";

  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    if (isAdmin) return items;

    return items
      .filter(item => {
        if (item.subItems) {
          const filteredSubItems = item.subItems.filter(sub => 
            !sub.moduleKey || userModules.includes(sub.moduleKey)
          );
          return filteredSubItems.length > 0;
        }
        return !item.moduleKey || userModules.includes(item.moduleKey);
      })
      .map(item => {
        if (item.subItems) {
          return {
            ...item,
            subItems: item.subItems.filter(sub => 
              !sub.moduleKey || userModules.includes(sub.moduleKey)
            )
          };
        }
        return item;
      });
  };

  const baseItems = userRole === "customer" 
    ? customerMenuItems 
    : userRole === "supplier" 
      ? supplierMenuItems 
      : allMenuItems;
  const items = filterMenuItems(baseItems);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "admin": return "default";
      case "sales": return "secondary";
      case "supplier": return "secondary";
      default: return "outline";
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case "admin": return "Administrador";
      case "sales": return "Vendedor";
      case "supplier": return "Fornecedor";
      default: return "Cliente";
    }
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-0">
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
              <span className="text-xl font-black text-white tracking-tighter">Z</span>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 ring-2 ring-sidebar" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-lg tracking-tight truncate bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-400 dark:to-emerald-300 bg-clip-text text-transparent">Zeno</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Sparkles className="h-3 w-3 text-emerald-500" />
                <span className="text-xs text-muted-foreground">B2B Platform</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-4 pb-4 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Empresa</p>
          <CompanySelector />
        </div>

        <div className="px-4 pb-4 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Visualizar como</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => window.open('/', '_blank')}
              data-testid="button-ver-varejo"
            >
              <ExternalLink className="h-3 w-3 mr-1.5" />
              Varejo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => window.open('/catalog', '_blank')}
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
              {items.map((item) => (
                item.subItems ? (
                  <Collapsible key={item.title} defaultOpen className="group/collapsible">
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
                            <Badge variant="secondary" className="ml-auto mr-2 h-5 text-[10px]">
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
                                  <span className="text-[13px]">{subItem.title}</span>
                                  {subItem.badge && (
                                    <Badge variant="secondary" className="ml-auto h-4 text-[9px] px-1.5">
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
                          <Badge variant="secondary" className="ml-auto h-5 text-[10px]">
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              ))}
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
            <p className="text-sm font-semibold truncate">{userName}</p>
            <Badge variant={getRoleBadgeVariant(userRole)} className="h-4 text-[9px] px-1.5 mt-0.5">
              {getRoleLabel(userRole)}
            </Badge>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={onLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
