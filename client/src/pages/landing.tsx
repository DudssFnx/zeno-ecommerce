import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Moon, Sun, Package, ShoppingCart, Users, TrendingUp } from "lucide-react";

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4">
        <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme-toggle">
          {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">B2B Wholesale Catalog</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Your complete wholesale ordering platform. Browse products, manage orders, 
            and streamline your B2B operations.
          </p>
          <Button size="lg" onClick={handleLogin} data-testid="button-login">
            Sign In to Continue
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <Package className="h-10 w-10 text-muted-foreground mb-2" />
              <CardTitle>Product Catalog</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Browse our complete wholesale catalog with real-time pricing and stock levels.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <ShoppingCart className="h-10 w-10 text-muted-foreground mb-2" />
              <CardTitle>Easy Ordering</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Add products to cart and generate orders with just a few clicks.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-10 w-10 text-muted-foreground mb-2" />
              <CardTitle>Account Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Manage your team and track all orders in one central dashboard.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-10 w-10 text-muted-foreground mb-2" />
              <CardTitle>Order Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Monitor order status from pending to delivery with full transparency.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-16 text-sm text-muted-foreground">
          <p>Private wholesale platform. Account required for access.</p>
        </div>
      </div>
    </div>
  );
}
