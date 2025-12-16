import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  User as UserIcon,
  ShoppingCart,
  CreditCard,
  Package,
  Star,
  ArrowLeft,
  Loader2,
  Percent
} from "lucide-react";

interface CartItem {
  productId: number;
  product: Product;
  quantity: number;
  discount: number;
  unitPrice: number;
  subtotal: number;
}

export default function PDVPage() {
  const [, setLocation] = useLocation();
  const { user, isAdmin, isSales } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("produto");
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [comment, setComment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const showPDV = isAdmin || isSales;

  const { data: productsResponse, isLoading: productsLoading } = useQuery<{ products: Product[]; total: number }>({
    queryKey: ['/api/products'],
    enabled: showPDV,
  });

  const { data: customersData = [], isLoading: customersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: showPDV,
  });

  const productsData = productsResponse?.products || [];
  const approvedCustomers = customersData.filter(u => u.approved && u.role === "customer");

  const filteredProducts = productSearch.length > 0 
    ? productsData.filter(p => 
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase())
      ).slice(0, 20)
    : productsData.slice(0, 20);

  const filteredCustomers = customerSearch.length > 0 
    ? approvedCustomers.filter(c => 
        (c.firstName?.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.lastName?.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.company?.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.email?.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.tradingName?.toLowerCase().includes(customerSearch.toLowerCase()))
      ).slice(0, 10)
    : approvedCustomers.slice(0, 10);

  const createOrderMutation = useMutation({
    mutationFn: async (data: { userId: string; items: { productId: number; quantity: number }[]; notes?: string }) => {
      await apiRequest("POST", "/api/orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: "Sucesso", description: "Pedido criado com sucesso!" });
      resetPDV();
      setLocation("/orders");
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message || "Falha ao criar pedido", variant: "destructive" });
    },
  });

  const resetPDV = () => {
    setCartItems([]);
    setSelectedCustomer(null);
    setSelectedProduct(null);
    setQuantity(1);
    setDiscount(0);
    setComment("");
    setPaymentMethod("");
    setPaymentNotes("");
    setProductSearch("");
    setCustomerSearch("");
    setActiveTab("produto");
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setDiscount(0);
    setProductSearch("");
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    const unitPrice = parseFloat(selectedProduct.price);
    const discountAmount = (unitPrice * discount) / 100;
    const finalPrice = unitPrice - discountAmount;
    const subtotal = finalPrice * quantity;

    const existingIndex = cartItems.findIndex(item => item.productId === selectedProduct.id);
    
    if (existingIndex >= 0) {
      const newItems = [...cartItems];
      newItems[existingIndex].quantity += quantity;
      newItems[existingIndex].subtotal = (unitPrice - (unitPrice * newItems[existingIndex].discount / 100)) * newItems[existingIndex].quantity;
      setCartItems(newItems);
    } else {
      setCartItems([...cartItems, {
        productId: selectedProduct.id,
        product: selectedProduct,
        quantity,
        discount,
        unitPrice,
        subtotal
      }]);
    }

    setSelectedProduct(null);
    setQuantity(1);
    setDiscount(0);
    toast({ title: "Produto adicionado", description: `${selectedProduct.name} adicionado ao carrinho` });
  };

  const handleRemoveFromCart = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    const newItems = [...cartItems];
    newItems[index].quantity = newQuantity;
    const unitPrice = newItems[index].unitPrice;
    const discountAmount = (unitPrice * newItems[index].discount) / 100;
    newItems[index].subtotal = (unitPrice - discountAmount) * newQuantity;
    setCartItems(newItems);
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleSelectCustomer = (customer: User) => {
    setSelectedCustomer(customer);
    setCustomerSearch("");
    setActiveTab("produto");
  };

  const handleFinalizeSale = () => {
    if (!selectedCustomer) {
      toast({ title: "Erro", description: "Selecione um cliente", variant: "destructive" });
      setActiveTab("cliente");
      return;
    }
    if (cartItems.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um produto", variant: "destructive" });
      setActiveTab("produto");
      return;
    }

    createOrderMutation.mutate({
      userId: selectedCustomer.id,
      items: cartItems.map(item => ({ productId: item.productId, quantity: item.quantity })),
      notes: comment || undefined,
    });
  };

  const handleCancelSale = () => {
    if (cartItems.length > 0 || selectedCustomer) {
      if (window.confirm("Deseja realmente cancelar esta venda? Todos os itens serão removidos.")) {
        resetPDV();
      }
    } else {
      setLocation("/orders");
    }
  };

  if (!showPDV) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso nao autorizado</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/orders")} data-testid="button-back-pdv">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">PDV - Ponto de Venda</h1>
              <p className="text-sm text-muted-foreground">Crie pedidos de forma rapida</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {selectedCustomer && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                <UserIcon className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium" data-testid="text-pdv-customer">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={() => setSelectedCustomer(null)}
                  data-testid="button-clear-pdv-customer"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col border-r">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="border-b px-4 pt-2">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="produto" className="gap-2" data-testid="tab-produto">
                  <Package className="h-4 w-4" />
                  Produto
                </TabsTrigger>
                <TabsTrigger value="cliente" className="gap-2" data-testid="tab-cliente">
                  <UserIcon className="h-4 w-4" />
                  Cliente
                </TabsTrigger>
                <TabsTrigger value="pagamento" className="gap-2" data-testid="tab-pagamento">
                  <CreditCard className="h-4 w-4" />
                  Pagamento
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="produto" className="flex-1 flex flex-col m-0 p-4 overflow-hidden">
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por codigo, descricao ou SKU..."
                    className="pl-10"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    data-testid="input-pdv-product-search"
                  />
                </div>

                {selectedProduct ? (
                  <Card className="border-orange-500/50">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="w-32 h-32 bg-muted rounded-md flex items-center justify-center overflow-hidden">
                          {selectedProduct.images && selectedProduct.images.length > 0 ? (
                            <img 
                              src={selectedProduct.images[0]} 
                              alt={selectedProduct.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-12 w-12 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <h3 className="font-semibold text-lg">{selectedProduct.name}</h3>
                          <p className="text-sm text-muted-foreground">SKU: {selectedProduct.sku}</p>
                          <p className="text-2xl font-bold text-orange-500">{formatPrice(parseFloat(selectedProduct.price))}</p>
                          {selectedProduct.stock !== null && (
                            <Badge variant={selectedProduct.stock > 0 ? "secondary" : "destructive"}>
                              Estoque: {selectedProduct.stock}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <Separator className="my-4" />
                      
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Quantidade</Label>
                          <div className="flex items-center gap-1 mt-1">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                              data-testid="button-pdv-qty-minus"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              value={quantity}
                              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                              className="h-8 w-16 text-center"
                              data-testid="input-pdv-quantity"
                            />
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setQuantity(quantity + 1)}
                              data-testid="button-pdv-qty-plus"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Desconto (%)</Label>
                          <div className="flex items-center gap-1 mt-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={discount}
                              onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                              className="h-8"
                              data-testid="input-pdv-discount"
                            />
                            <Percent className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Valor Unitario</Label>
                          <p className="font-semibold mt-2">
                            {formatPrice(parseFloat(selectedProduct.price) * (1 - discount / 100))}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Subtotal</Label>
                          <p className="font-semibold text-orange-500 mt-2">
                            {formatPrice(parseFloat(selectedProduct.price) * (1 - discount / 100) * quantity)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 mt-4">
                        <Button 
                          variant="ghost" 
                          onClick={() => setSelectedProduct(null)}
                          data-testid="button-pdv-cancel-product"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button 
                          className="bg-orange-500 hover:bg-orange-600"
                          onClick={handleAddToCart}
                          data-testid="button-pdv-add-to-cart"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar ao Carrinho
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <ScrollArea className="flex-1">
                    {productsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhum produto encontrado</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filteredProducts.map((product) => (
                          <Card 
                            key={product.id} 
                            className="hover-elevate cursor-pointer"
                            onClick={() => handleSelectProduct(product)}
                            data-testid={`card-pdv-product-${product.id}`}
                          >
                            <CardContent className="p-3">
                              <div className="aspect-square bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
                                {product.images && product.images.length > 0 ? (
                                  <img 
                                    src={product.images[0]} 
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package className="h-8 w-8 text-muted-foreground" />
                                )}
                              </div>
                              <h4 className="font-medium text-sm truncate">{product.name}</h4>
                              <p className="text-xs text-muted-foreground truncate">{product.sku}</p>
                              <p className="font-bold text-orange-500 mt-1">{formatPrice(parseFloat(product.price))}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                )}
              </div>
            </TabsContent>

            <TabsContent value="cliente" className="flex-1 m-0 p-4 overflow-hidden">
              <div className="space-y-4 h-full flex flex-col">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente por nome, empresa ou email..."
                    className="pl-10"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    data-testid="input-pdv-customer-search"
                  />
                </div>

                {selectedCustomer && (
                  <Card className="border-orange-500/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                          <UserIcon className="h-6 w-6 text-orange-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{selectedCustomer.firstName} {selectedCustomer.lastName}</h3>
                          <p className="text-sm text-muted-foreground">{selectedCustomer.company || selectedCustomer.tradingName}</p>
                          <p className="text-xs text-muted-foreground">{selectedCustomer.email}</p>
                        </div>
                        <Badge className="bg-green-500/20 text-green-600">Selecionado</Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <ScrollArea className="flex-1">
                  {customersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredCustomers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <UserIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum cliente encontrado</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredCustomers.map((customer) => (
                        <Card 
                          key={customer.id}
                          className={`hover-elevate cursor-pointer ${selectedCustomer?.id === customer.id ? 'border-orange-500/50' : ''}`}
                          onClick={() => handleSelectCustomer(customer)}
                          data-testid={`card-pdv-customer-${customer.id}`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                <UserIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{customer.firstName} {customer.lastName}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {customer.company || customer.tradingName || customer.email}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="pagamento" className="flex-1 m-0 p-4 overflow-hidden">
              <div className="space-y-4">
                <div>
                  <Label>Observacoes do Pedido</Label>
                  <Textarea
                    placeholder="Adicione observacoes sobre o pedido..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="mt-2 min-h-[100px]"
                    data-testid="input-pdv-comment"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="font-semibold">Resumo do Pedido</h3>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Itens</span>
                    <span>{cartItemCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(cartTotal)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-orange-500">{formatPrice(cartTotal)}</span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="border-t p-4 flex items-center justify-between gap-4">
            <Button 
              variant="outline" 
              onClick={handleCancelSale}
              data-testid="button-pdv-cancel"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar Venda
            </Button>
            <Button 
              className="bg-orange-500 hover:bg-orange-600 px-8"
              onClick={handleFinalizeSale}
              disabled={createOrderMutation.isPending}
              data-testid="button-pdv-finalize"
            >
              {createOrderMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4 mr-2" />
              )}
              Finalizar Venda
            </Button>
          </div>
        </div>

        <div className="w-80 lg:w-96 flex flex-col bg-muted/30">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-orange-500" />
              Carrinho
              {cartItemCount > 0 && (
                <Badge className="bg-orange-500 text-white">{cartItemCount}</Badge>
              )}
            </h2>
          </div>

          <ScrollArea className="flex-1 p-4">
            {cartItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>Nenhum produto no carrinho</p>
                <p className="text-sm mt-1">Adicione produtos para iniciar a venda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cartItems.map((item, index) => (
                  <Card key={index} data-testid={`card-pdv-cart-item-${index}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.product.images && item.product.images.length > 0 ? (
                            <img 
                              src={item.product.images[0]} 
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{item.product.name}</h4>
                          <p className="text-xs text-muted-foreground">{formatPrice(item.unitPrice)} un.</p>
                          {item.discount > 0 && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              -{item.discount}%
                            </Badge>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-destructive"
                          onClick={() => handleRemoveFromCart(index)}
                          data-testid={`button-pdv-remove-item-${index}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                            data-testid={`button-pdv-cart-minus-${index}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                            data-testid={`button-pdv-cart-plus-${index}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="font-semibold text-orange-500">{formatPrice(item.subtotal)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-t p-4 bg-card">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-2xl font-bold text-orange-500" data-testid="text-pdv-total">
                {formatPrice(cartTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
