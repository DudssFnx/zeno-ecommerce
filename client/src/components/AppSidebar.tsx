import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  Calendar,
  Palette,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import logoImage from "@assets/image_1765659931449.png";

type UserRole = "admin" | "sales" | "customer";

interface MenuItem {
  title: string;
  url?: string;
  icon: any;
  moduleKey?: string;
  subItems?: { title: string; url: string; icon: any; moduleKey?: string }[];
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
      { title: "Compras", url: "/purchases", icon: ShoppingCart, moduleKey: "reports" },
    ]
  },
  { title: "Categorias", url: "/categories", icon: Grid3X3, moduleKey: "catalog" },
  { title: "Catalogo", url: "/catalog", icon: Package, moduleKey: "catalog" },
  { title: "Pedidos", url: "/orders", icon: ClipboardList, moduleKey: "orders" },
  { title: "Produtos", url: "/products", icon: Package, moduleKey: "products" },
  { title: "Clientes", url: "/customers", icon: UserCheck, moduleKey: "customers" },
  { title: "Usuarios", url: "/users", icon: Users, moduleKey: "customers" },
  { title: "Cupons", url: "/coupons", icon: Ticket, moduleKey: "products" },
  { 
    title: "Financeiro", 
    icon: Banknote,
    subItems: [
      { title: "Contas a Receber", url: "/contas-receber", icon: ArrowUpRight, moduleKey: "financial_receivables" },
      { title: "Contas a Pagar", url: "/contas-pagar", icon: ArrowDownRight, moduleKey: "financial_payables" },
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

  const baseItems = userRole === "customer" ? customerMenuItems : allMenuItems;
  const items = filterMenuItems(baseItems);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="Lojamadrugadao" className="h-10 w-10 rounded-full" />
          <div>
            <h2 className="font-semibold text-sm">Lojamadrugadao</h2>
            <p className="text-xs text-muted-foreground capitalize">Portal Atacado</p>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-xs text-muted-foreground mb-1">Ver Catalogo como:</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => window.open('/', '_blank')}
              data-testid="button-ver-varejo"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Varejo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => window.open('/catalog', '_blank')}
              data-testid="button-ver-atacado"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Atacado
            </Button>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                item.subItems ? (
                  <Collapsible key={item.title} defaultOpen className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.subItems.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={location === subItem.url}
                                data-testid={`link-nav-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                              >
                                <Link href={subItem.url}>
                                  <subItem.icon className="h-4 w-4" />
                                  <span>{subItem.title}</span>
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
                      data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.url!}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
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
