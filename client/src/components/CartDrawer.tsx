import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import { Minus, Plus, Trash2, Package, ShoppingCart, Loader2, ArrowRight } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface CartDrawerProps {
  isAuthenticated?: boolean;
}

export function CartDrawer({ isAuthenticated = false }: CartDrawerProps) {
  const { items, isOpen, closeCart, updateQuantity, removeItem, total, clearCart, selectedCustomer } = useCart();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const orderItems = items.map(item => ({
        productId: parseInt(item.productId),
        quantity: item.quantity,
      }));
      const payload: any = { items: orderItems };
      if (selectedCustomer) {
        payload.userId = selectedCustomer.id;
      }
      const response = await apiRequest("POST", "/api/orders", payload);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      clearCart();
      closeCart();
      toast({
        title: "Orçamento Criado",
        description: `Orçamento ${data.orderNumber} foi criado com sucesso.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no Orçamento",
        description: error.message || "Falha ao criar orçamento. Por favor, tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateOrder = () => {
    createOrderMutation.mutate();
  };

  const handleContinueCheckout = () => {
    closeCart();
    setLocation("/checkout");
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrinho de Compras
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">Seu carrinho esta vazio</p>
            <p className="text-sm text-muted-foreground mt-1">Adicione produtos para continuar</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto py-4 space-y-4">
              {items.map((item) => (
                <div 
                  key={item.id} 
                  className="flex gap-4 p-3 rounded-lg bg-muted/50"
                  data-testid={`cart-item-${item.id}`}
                >
                  <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-md" />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.sku}</p>
                    <p className="text-sm font-semibold mt-1">{formatPrice(item.price)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      data-testid={`button-remove-item-${item.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        data-testid={`button-decrease-${item.id}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        data-testid={`button-increase-${item.id}`}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-500" data-testid="text-cart-total">
                  {formatPrice(total)}
                </span>
              </div>
              <SheetFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={clearCart} className="flex-1" data-testid="button-clear-cart">
                  Limpar
                </Button>
                {isAuthenticated ? (
                  <Button 
                    onClick={handleGenerateOrder} 
                    className="flex-1 bg-orange-500 hover:bg-orange-600" 
                    disabled={createOrderMutation.isPending}
                    data-testid="button-generate-order"
                  >
                    {createOrderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Gerar Orçamento
                  </Button>
                ) : (
                  <Button 
                    onClick={handleContinueCheckout} 
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                    data-testid="button-continue-checkout"
                  >
                    Continuar
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </SheetFooter>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
