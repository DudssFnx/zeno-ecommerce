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
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ClipboardList,
  Users,
  UserCheck,
  Settings,
  LogOut,
} from "lucide-react";
type UserRole = "admin" | "sales" | "customer";

interface AppSidebarProps {
  userRole?: UserRole;
  userName?: string;
  onLogout?: () => void;
}

const menuItems = {
  customer: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Catalog", url: "/catalog", icon: Package },
    { title: "My Orders", url: "/orders", icon: ClipboardList },
  ],
  sales: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Catalog", url: "/catalog", icon: Package },
    { title: "All Orders", url: "/orders", icon: ClipboardList },
  ],
  admin: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Catalog", url: "/catalog", icon: Package },
    { title: "All Orders", url: "/orders", icon: ClipboardList },
    { title: "Products", url: "/products", icon: Package },
    { title: "Customers", url: "/customers", icon: UserCheck },
    { title: "Users", url: "/users", icon: Users },
    { title: "Settings", url: "/settings", icon: Settings },
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
            <h2 className="font-semibold text-sm">B2B Catalog</h2>
            <p className="text-xs text-muted-foreground capitalize">{userRole} Portal</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
