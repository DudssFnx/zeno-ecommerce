import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, User, Category, PaymentType } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  User as UserIcon,
  ShoppingCart,
  Package,
  ArrowLeft,
  Loader2,
  FileText,
  CheckCircle,
  Building2,
  Mail,
  Phone,
  Printer,
  Download,
  Share2,
  RotateCcw
} from "lucide-react";

interface CartItem {
  productId: number;
  product: Product;
  quantity: number;
  discount: number;
  unitPrice: number;
  subtotal: number;
}

interface QuoteResult {
  id: number;
  orderNumber: string;
  total: number;
  itemCount: number;
  customer: string;
}

export default function PDVPage() {
  const [, setLocation] = useLocation();
  const { user, isAdmin, isSales } = useAuth();
  const { toast } = useToast();
  
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [comment, setComment] = useState("");
  const [addedProductId, setAddedProductId] = useState<number | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [selectedPaymentTypeId, setSelectedPaymentTypeId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showPDV = isAdmin || isSales;

  const { data: productsResponse, isLoading: productsLoading } = useQuery<{ products: Product[]; total: number }>({
    queryKey: ['/api/products'],
    enabled: showPDV,
  });

  const { data: customersData = [], isLoading: customersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: showPDV,
  });

  const { data: categoriesData = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    enabled: showPDV,
  });

  const { data: paymentTypesData = [] } = useQuery<PaymentType[]>({
    queryKey: ['/api/payment-types'],
    enabled: showPDV,
  });

  const activePaymentTypes = paymentTypesData.filter(pt => pt.active);

  const productsData = productsResponse?.products || [];
  const approvedCustomers = customersData.filter(u => u.approved && u.role === "customer");

  const filteredProducts = productsData.filter(p => {
    const matchesSearch = productSearch.length === 0 || 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = selectedCategory === "all" || p.categoryId === parseInt(selectedCategory);
    return matchesSearch && matchesCategory;
  }).slice(0, 24);

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
    mutationFn: async (data: { 
      userId: string; 
      items: { productId: number; quantity: number; unitPrice: number; discount: number }[]; 
      notes?: string;
      subtotal: number;
      total: number;
      paymentTypeId?: number;
      paymentMethod?: string;
    }) => {
      const res = await apiRequest("POST", "/api/orders", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setQuoteResult({
        id: data.id,
        orderNumber: data.orderNumber || `#${data.id}`,
        total: cartTotal,
        itemCount: cartItemCount,
        customer: selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}` : ''
      });
      setShowSuccessModal(true);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message || "Falha ao gerar orçamento", variant: "destructive" });
    },
  });

  const resetPDV = () => {
    setCartItems([]);
    setSelectedCustomer(null);
    setComment("");
    setProductSearch("");
    setSelectedCategory("all");
    setCustomerSearch("");
    setQuoteResult(null);
    setShowSuccessModal(false);
    setSelectedPaymentTypeId(null);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleQuickAddToCart = (product: Product) => {
    const unitPrice = parseFloat(product.price);
    const existingIndex = cartItems.findIndex(item => item.productId === product.id);
    
    if (existingIndex >= 0) {
      const newItems = [...cartItems];
      newItems[existingIndex].quantity += 1;
      newItems[existingIndex].subtotal = unitPrice * newItems[existingIndex].quantity;
      setCartItems(newItems);
    } else {
      setCartItems([...cartItems, {
        productId: product.id,
        product: product,
        quantity: 1,
        discount: 0,
        unitPrice,
        subtotal: unitPrice
      }]);
    }
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 400);
  };

  const handleRemoveFromCart = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) {
      handleRemoveFromCart(index);
      return;
    }
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
    setShowCustomerModal(false);
    setCustomerSearch("");
  };

  const handleGenerateQuote = () => {
    if (!selectedCustomer) {
      toast({ title: "Selecione um cliente", description: "Clique no botão 'Selecionar Cliente' para continuar", variant: "destructive" });
      setShowCustomerModal(true);
      return;
    }
    if (cartItems.length === 0) {
      toast({ title: "Carrinho vazio", description: "Adicione produtos ao carrinho", variant: "destructive" });
      return;
    }
    if (!selectedPaymentTypeId) {
      toast({ title: "Selecione uma forma de pagamento", description: "Escolha como o cliente vai pagar", variant: "destructive" });
      return;
    }

    const selectedPaymentType = activePaymentTypes.find(pt => pt.id === selectedPaymentTypeId);
    
    createOrderMutation.mutate({
      userId: selectedCustomer.id,
      items: cartItems.map(item => ({ 
        productId: item.productId, 
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount
      })),
      notes: comment || undefined,
      subtotal: cartTotal,
      total: cartTotal,
      paymentTypeId: selectedPaymentTypeId,
      paymentMethod: selectedPaymentType?.name
    });
  };

  const getProductImage = (product: Product) => {
    if (product.image) return product.image;
    if (product.images && product.images.length > 0) return product.images[0];
    return null;
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
      <div className="border-b bg-card">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/orders")} data-testid="button-back-pdv">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">PDV</h1>
              <p className="text-xs text-muted-foreground">Ponto de Venda</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant={selectedCustomer ? "secondary" : "outline"}
              onClick={() => setShowCustomerModal(true)}
              className="gap-2"
              data-testid="button-select-customer"
            >
              <UserIcon className="h-4 w-4" />
              {selectedCustomer ? (
                <span className="max-w-[150px] truncate">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </span>
              ) : (
                "Selecionar Cliente"
              )}
            </Button>
            
            {selectedCustomer && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSelectedCustomer(null)}
                data-testid="button-clear-customer"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b bg-card/50">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar produto por nome ou SKU..."
                  className="pl-10"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  data-testid="input-pdv-product-search"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-44" data-testid="select-pdv-category">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categoriesData.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              {productsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Nenhum produto encontrado</p>
                  <p className="text-sm">Tente buscar por outro termo</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredProducts.map((product) => {
                    const inCart = cartItems.find(item => item.productId === product.id);
                    const imageUrl = getProductImage(product);
                    
                    return (
                      <Card 
                        key={product.id} 
                        className={`hover-elevate cursor-pointer relative transition-all ${inCart ? 'ring-2 ring-primary/50' : ''}`}
                        onClick={() => handleQuickAddToCart(product)}
                        data-testid={`card-pdv-product-${product.id}`}
                      >
                        <CardContent className="p-2">
                          <div className="relative">
                            {addedProductId === product.id && (
                              <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/90 rounded-md animate-in fade-in zoom-in duration-150">
                                <span className="text-primary-foreground font-bold text-lg">+1</span>
                              </div>
                            )}
                            {inCart && (
                              <Badge className="absolute top-1 right-1 z-10 bg-primary text-primary-foreground">
                                {inCart.quantity}
                              </Badge>
                            )}
                            <div className="aspect-square bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
                              {imageUrl ? (
                                <img 
                                  src={imageUrl} 
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <Package className="h-8 w-8 text-muted-foreground/40" />
                              )}
                            </div>
                          </div>
                          <p className="font-medium text-xs leading-tight line-clamp-2 min-h-[32px]">{product.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{product.sku}</p>
                          <p className="font-semibold text-primary text-sm mt-1">{formatPrice(parseFloat(product.price))}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="w-80 lg:w-96 flex flex-col border-l bg-card">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Carrinho
              </h2>
              {cartItemCount > 0 && (
                <Badge variant="secondary">{cartItemCount} {cartItemCount === 1 ? 'item' : 'itens'}</Badge>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3">
              {cartItems.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Carrinho vazio</p>
                  <p className="text-xs mt-1">Clique nos produtos para adicionar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cartItems.map((item, index) => {
                    const imageUrl = getProductImage(item.product);
                    
                    return (
                      <div 
                        key={index} 
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                        data-testid={`card-pdv-cart-item-${index}`}
                      >
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                          {imageUrl ? (
                            <img 
                              src={imageUrl} 
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs truncate">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">{formatPrice(item.unitPrice)}</p>
                        </div>
                        
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
                          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
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
                        
                        <div className="text-right min-w-[70px]">
                          <p className="font-semibold text-sm">{formatPrice(item.subtotal)}</p>
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveFromCart(index)}
                          data-testid={`button-pdv-remove-item-${index}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          {cartItems.length > 0 && (
            <div className="p-4 border-t space-y-3">
              <Textarea
                placeholder="Observacoes do pedido..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[60px] text-sm resize-none"
                data-testid="input-pdv-comment"
              />
              
              <Separator />
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Forma de Pagamento</Label>
                <Select
                  value={selectedPaymentTypeId?.toString() || ""}
                  onValueChange={(val) => setSelectedPaymentTypeId(parseInt(val))}
                >
                  <SelectTrigger className="w-full" data-testid="select-pdv-payment-type">
                    <SelectValue placeholder="Selecione a forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {activePaymentTypes.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id.toString()} data-testid={`select-item-payment-${pt.id}`}>
                        <span>{pt.name}</span>
                        {pt.feePercentage && parseFloat(pt.feePercentage) > 0 && (
                          <span className="text-muted-foreground ml-2">({pt.feePercentage}%)</span>
                        )}
                        {pt.feeFixed && parseFloat(pt.feeFixed) > 0 && (
                          <span className="text-muted-foreground ml-2">(+R${pt.feeFixed})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary" data-testid="text-pdv-total">{formatPrice(cartTotal)}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={resetPDV}
                  data-testid="button-pdv-clear"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleGenerateQuote}
                  disabled={createOrderMutation.isPending}
                  data-testid="button-pdv-generate-quote"
                >
                  {createOrderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Gerar Orcamento
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Selecionar Cliente
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, empresa ou email..."
                className="pl-10"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                data-testid="input-pdv-customer-search"
              />
            </div>
            
            <ScrollArea className="h-[300px]">
              {customersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum cliente encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className={`p-3 rounded-lg cursor-pointer hover-elevate transition-all ${
                        selectedCustomer?.id === customer.id ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted/30'
                      }`}
                      onClick={() => handleSelectCustomer(customer)}
                      data-testid={`card-pdv-customer-${customer.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                          {(customer.company || customer.tradingName) && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {customer.company || customer.tradingName}
                            </p>
                          )}
                          {customer.email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </p>
                          )}
                        </div>
                        {selectedCustomer?.id === customer.id && (
                          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md text-center">
          <div className="py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Orcamento Gerado!</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Orcamento {quoteResult?.orderNumber} criado com sucesso
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{quoteResult?.customer}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Itens</span>
                <span className="font-medium">{quoteResult?.itemCount}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="font-medium">Total</span>
                <span className="font-bold text-primary text-lg">{quoteResult && formatPrice(quoteResult.total)}</span>
              </div>
            </div>
            
            <div className="flex gap-2 mb-4">
              <Button variant="outline" className="flex-1" disabled>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button variant="outline" className="flex-1" disabled>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" className="flex-1" disabled>
                <Share2 className="h-4 w-4 mr-2" />
                Enviar
              </Button>
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/orders")}
              className="w-full sm:w-auto"
            >
              Ver Pedidos
            </Button>
            <Button 
              onClick={resetPDV}
              className="w-full sm:w-auto"
              data-testid="button-pdv-new-quote"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Novo Orcamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
