import { AgeVerificationPopup } from "@/components/AgeVerificationPopup";
import { AppSidebar } from "@/components/AppSidebar";
import { CartDrawer } from "@/components/CartDrawer";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AgendaPage from "@/pages/agenda";
import AppearancePage from "@/pages/appearance";
import BlingPage from "@/pages/bling";
import BrandAnalyticsPage from "@/pages/brand-analytics";
import CatalogPage from "@/pages/catalog";
import CatalogCustomizationPage from "@/pages/catalog-customization";
import CategoriesPage from "@/pages/categories";
import CheckoutPage from "@/pages/checkout";
import ContasPagarPage from "@/pages/contas-pagar";
import ContasReceberPage from "@/pages/contas-receber-new";
import CouponsPage from "@/pages/coupons";
import CustomerAnalyticsPage from "@/pages/customer-analytics";
import CustomersPage from "@/pages/customers";
import DashboardPage from "@/pages/dashboard";
import EmployeeAnalyticsPage from "@/pages/employee-analytics";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import OrderDetailsPage from "@/pages/order-details";
import OrdersPage from "@/pages/orders";
import PaymentsPage from "@/pages/payments";
import PDVPage from "@/pages/pdv";
import ProductAnalyticsPage from "@/pages/product-analytics";
import ProductsPage from "@/pages/products";
import PublicCatalogPage from "@/pages/public-catalog";
import PurchaseDetailsPage from "@/pages/purchase-details";
import PurchaseNewPage from "@/pages/purchase-new";
import PurchasesPage from "@/pages/purchases";
import PurchasesDashboardPage from "@/pages/purchases-dashboard";
import RegisterPage from "@/pages/register";
import SettingsPage from "@/pages/settings";
import CompanySettings from "@/pages/settings/CompanySettings"; // ✅ IMPORTADO
import StoreCatalogPage from "@/pages/store-catalog";
import SuppliersPage from "@/pages/suppliers";
import UsersPage from "@/pages/users";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Loader2, ShoppingCart } from "lucide-react";
import { Route, Switch } from "wouter";
import { queryClient } from "./lib/queryClient";

function AuthenticatedApp() {
  const { user, logout, isAdmin, isSupplier, isSales, isApproved } = useAuth();
  const { openCart, itemCount } = useCart();

  const displayName =
    user?.firstName && user?.lastName
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
          <Button
            onClick={logout}
            variant="outline"
            data-testid="button-logout-pending"
          >
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
          userRole={
            (user?.role as "admin" | "sales" | "customer" | "supplier") ||
            "customer"
          }
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
              <Route path="/orders/:id" component={OrderDetailsPage} />
              <Route path="/pdv" component={PDVPage} />
              {isAdmin && <Route path="/products" component={ProductsPage} />}
              {isAdmin && <Route path="/suppliers" component={SuppliersPage} />}
              {isAdmin && (
                <Route path="/purchase-orders" component={PurchasesPage} />
              )}
              {isAdmin && (
                <Route
                  path="/purchase-orders/new"
                  component={PurchaseNewPage}
                />
              )}
              {isAdmin && (
                <Route
                  path="/purchase-orders/:id"
                  component={PurchaseDetailsPage}
                />
              )}
              {isAdmin && <Route path="/customers" component={CustomersPage} />}
              {isAdmin && <Route path="/users" component={UsersPage} />}

              {/* ✅ ROTAS DE CONFIGURAÇÃO */}
              {isAdmin && <Route path="/settings" component={SettingsPage} />}
              {isAdmin && (
                <Route path="/settings/company" component={CompanySettings} />
              )}

              {isAdmin && <Route path="/bling" component={BlingPage} />}
              {isAdmin && <Route path="/coupons" component={CouponsPage} />}
              <Route path="/loja/:slug" component={StoreCatalogPage} />
              {isAdmin && (
                <Route
                  path="/customer-analytics"
                  component={CustomerAnalyticsPage}
                />
              )}
              {isAdmin && (
                <Route
                  path="/product-analytics"
                  component={ProductAnalyticsPage}
                />
              )}
              {isAdmin && (
                <Route
                  path="/employee-analytics"
                  component={EmployeeAnalyticsPage}
                />
              )}
              {isAdmin && (
                <Route
                  path="/purchases-dashboard"
                  component={PurchasesDashboardPage}
                />
              )}
              {(isAdmin || isSales || isSupplier) && (
                <Route path="/brand-analytics" component={BrandAnalyticsPage} />
              )}
              {isAdmin && <Route path="/agenda" component={AgendaPage} />}
              {isAdmin && (
                <Route
                  path="/catalog-customization"
                  component={CatalogCustomizationPage}
                />
              )}
              {isAdmin && (
                <Route path="/appearance" component={AppearancePage} />
              )}
              {isAdmin && <Route path="/payments" component={PaymentsPage} />}
              <Route path="/contas-receber" component={ContasReceberPage} />
              <Route path="/contas-pagar" component={ContasPagarPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
        <CartDrawer isAuthenticated={true} />
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
      <CartProvider>
        <Switch>
          <Route path="/register" component={RegisterPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/loja/:slug" component={StoreCatalogPage} />
          <Route path="/catalogo" component={PublicCatalogPage} />
          <Route path="/checkout" component={CheckoutPage} />
          <Route component={LandingPage} />
        </Switch>
        <CartDrawer isAuthenticated={false} />
      </CartProvider>
    );
  }

  return (
    <CompanyProvider>
      <CartProvider>
        <AuthenticatedApp />
      </CartProvider>
    </CompanyProvider>
  );
}

function AgeVerificationWrapper() {
  const { data: agePopupSetting } = useQuery<{
    key: string;
    value: string | null;
  }>({
    queryKey: ["/api/settings/age_verification_popup"],
  });

  const isAgePopupEnabled = agePopupSetting?.value === "true";

  return <AgeVerificationPopup enabled={isAgePopupEnabled} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <AgeVerificationWrapper />
          <PWAInstallPrompt />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
