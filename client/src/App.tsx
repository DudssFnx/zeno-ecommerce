import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppSidebar } from "@/components/AppSidebar";
import { CartDrawer } from "@/components/CartDrawer";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import CatalogPage from "@/pages/catalog";
import OrdersPage from "@/pages/orders";
import ProductsPage from "@/pages/products";
import UsersPage from "@/pages/users";
import SettingsPage from "@/pages/settings";
import CustomersPage from "@/pages/customers";
import CategoriesPage from "@/pages/categories";
import BlingPage from "@/pages/bling";
import CouponsPage from "@/pages/coupons";

function AuthenticatedApp() {
  const { user, logout, isAdmin, isApproved } = useAuth();
  const { openCart, itemCount } = useCart();

  const displayName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.email || "User";

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  // Show pending approval message for non-approved users
  if (!isApproved) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold mb-4">Account Pending Approval</h1>
          <p className="text-muted-foreground mb-6">
            Your account is currently pending approval by an administrator. 
            Please check back later or contact support.
          </p>
          <Button onClick={logout} variant="outline" data-testid="button-logout-pending">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          userRole={(user?.role as "admin" | "sales" | "customer") || "customer"}
          userName={displayName}
          onLogout={logout}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openCart}
                data-testid="button-header-cart"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Cart ({itemCount})
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/categories" component={CategoriesPage} />
              <Route path="/catalog" component={CatalogPage} />
              <Route path="/orders" component={OrdersPage} />
              {isAdmin && <Route path="/products" component={ProductsPage} />}
              {isAdmin && <Route path="/customers" component={CustomersPage} />}
              {isAdmin && <Route path="/users" component={UsersPage} />}
              {isAdmin && <Route path="/settings" component={SettingsPage} />}
              {isAdmin && <Route path="/bling" component={BlingPage} />}
              {isAdmin && <Route path="/coupons" component={CouponsPage} />}
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
        <CartDrawer />
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/register" component={RegisterPage} />
        <Route component={LandingPage} />
      </Switch>
    );
  }

  return (
    <CartProvider>
      <AuthenticatedApp />
    </CartProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
