import { Link, useLocation } from "wouter";
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
  ShoppingCart,
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
} from "lucide-react";
type UserRole = "admin" | "sales" | "customer";

interface MenuItem {
  title: string;
  url?: string;
  icon: any;
  subItems?: { title: string; url: string; icon: any }[];
}

interface AppSidebarProps {
  userRole?: UserRole;
  userName?: string;
  onLogout?: () => void;
}

const menuItems: Record<UserRole, MenuItem[]> = {
  customer: [
    { title: "Painel", url: "/", icon: LayoutDashboard },
    { title: "Categorias", url: "/categories", icon: Grid3X3 },
    { title: "Catálogo", url: "/catalog", icon: Package },
    { title: "Meus Pedidos", url: "/orders", icon: ClipboardList },
  ],
  sales: [
    { title: "Painel", url: "/", icon: LayoutDashboard },
    { title: "Categorias", url: "/categories", icon: Grid3X3 },
    { title: "Catálogo", url: "/catalog", icon: Package },
    { title: "Todos os Pedidos", url: "/orders", icon: ClipboardList },
  ],
  admin: [
    { 
      title: "Painel", 
      icon: LayoutDashboard,
      subItems: [
        { title: "Visão Geral", url: "/", icon: LayoutDashboard },
        { title: "Análise de Clientes", url: "/customer-analytics", icon: BarChart3 },
        { title: "Análise de Produtos", url: "/product-analytics", icon: TrendingUp },
      ]
    },
    { title: "Categorias", url: "/categories", icon: Grid3X3 },
    { title: "Catálogo", url: "/catalog", icon: Package },
    { title: "Todos os Pedidos", url: "/orders", icon: ClipboardList },
    { title: "Produtos", url: "/products", icon: Package },
    { title: "Clientes", url: "/customers", icon: UserCheck },
    { title: "Usuários", url: "/users", icon: Users },
    { title: "Cupons", url: "/coupons", icon: Ticket },
    { title: "Bling", url: "/bling", icon: Link2 },
    { title: "Configurações", url: "/settings", icon: Settings },
  ],
};

export function AppSidebar({ userRole = "customer", userName = "User", onLogout }: AppSidebarProps) {
  const [location] = useLocation();
  const items = menuItems[userRole] || menuItems.customer;

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
          <div className="p-2 bg-primary rounded-md">
            <ShoppingCart className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Lojamadrugadao</h2>
            <p className="text-xs text-muted-foreground capitalize">Portal Atacado</p>
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
