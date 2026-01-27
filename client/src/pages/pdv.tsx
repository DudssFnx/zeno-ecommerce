import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Category, PaymentType, B2bUser as User } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useLocation } from "wouter";
// CORREÇÃO: ArrowLeft movido para cá
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  Download,
  FileText,
  Loader2,
  Mail,
  Package,
  Printer,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";

interface CartItem {
  productId: number;
  product: any;
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
  const [selectedPaymentTypeId, setSelectedPaymentTypeId] = useState<
    number | null
  >(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showPDV = isAdmin || isSales;

  // Busca conectada com o backend
  const { data: productsResponse, isLoading: productsLoading } = useQuery<{
    products: any[];
    total: number;
  }>({
    queryKey: ["/api/products", { q: productSearch, limit: 50 }],
    // ADD THIS:
    queryFn: async ({ queryKey }) => {
      const [_path, params] = queryKey;
      const queryString = new URLSearchParams(params as any).toString();
      const response = await fetch(`/api/products?${queryString}`);
      if (!response.ok) throw new Error("Erro ao buscar produtos");
      return response.json();
    },
    enabled: showPDV,
  });

  const { data: customersData = [], isLoading: customersLoading } = useQuery<
    User[]
  >({
    queryKey: ["/api/users"],
    enabled: showPDV,
  });

  const { data: categoriesData = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: showPDV,
  });

  const { data: paymentTypesData = [] } = useQuery<PaymentType[]>({
    queryKey: ["/api/payment-types"],
    enabled: showPDV,
  });

  const activePaymentTypes = paymentTypesData.filter((pt) => pt.active);
  const productsData = Array.isArray(productsResponse)
    ? productsResponse
    : productsResponse?.products || [];
  const filteredProducts = productsData.filter((p) => {
    if (selectedCategory === "all") return true;
    return p.categoryId === parseInt(selectedCategory);
  });

  const approvedCustomers = customersData.filter(
    (u) => u.approved && u.role === "customer",
  );
  const filteredCustomers =
    customerSearch.length > 0
      ? approvedCustomers
          .filter(
            (c) =>
              c.nome?.toLowerCase().includes(customerSearch.toLowerCase()) ||
              c.razaoSocial
                ?.toLowerCase()
                .includes(customerSearch.toLowerCase()) ||
              c.email?.toLowerCase().includes(customerSearch.toLowerCase()),
          )
          .slice(0, 10)
      : approvedCustomers.slice(0, 10);

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/orders", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setQuoteResult({
        id: data.id,
        orderNumber: data.orderNumber || `#${data.id}`,
        total: cartTotal,
        itemCount: cartItemCount,
        customer: selectedCustomer ? `${selectedCustomer.nome}` : "",
      });
      setShowSuccessModal(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao gerar orçamento",
        variant: "destructive",
      });
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
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const handleQuickAddToCart = (product: any) => {
    const rawPrice = product.price || product.precoVarejo || "0";
    const unitPrice = parseFloat(rawPrice);

    const existingIndex = cartItems.findIndex(
      (item) => item.productId === product.id,
    );

    if (existingIndex >= 0) {
      const newItems = [...cartItems];
      newItems[existingIndex].quantity += 1;
      newItems[existingIndex].subtotal =
        unitPrice * newItems[existingIndex].quantity;
      setCartItems(newItems);
    } else {
      setCartItems([
        ...cartItems,
        {
          productId: product.id,
          product: product,
          quantity: 1,
          discount: 0,
          unitPrice,
          subtotal: unitPrice,
        },
      ]);
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

  const handleUpdatePrice = (index: number, newPrice: number) => {
    const newItems = [...cartItems];
    newItems[index].unitPrice = newPrice;
    const discountAmount = (newPrice * newItems[index].discount) / 100;
    newItems[index].subtotal =
      (newPrice - discountAmount) * newItems[index].quantity;
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
      toast({
        title: "Selecione um cliente",
        description: "Necessário para gerar o pedido",
        variant: "destructive",
      });
      setShowCustomerModal(true);
      return;
    }
    if (cartItems.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho",
        variant: "destructive",
      });
      return;
    }
    if (!selectedPaymentTypeId) {
      toast({
        title: "Selecione Pagamento",
        description: "Escolha a forma de pagamento",
        variant: "destructive",
      });
      return;
    }

    const selectedPaymentType = activePaymentTypes.find(
      (pt) => pt.id === selectedPaymentTypeId,
    );

    createOrderMutation.mutate({
      userId: selectedCustomer.id,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      })),
      notes: comment || undefined,
      subtotal: cartTotal,
      total: cartTotal,
      paymentTypeId: selectedPaymentTypeId,
      paymentMethod: selectedPaymentType?.name,
    });
  };

  const getProductImage = (product: any) => {
    if (product.image) return product.image;
    if (product.imagem) return product.imagem;
    return null;
  };

  if (!showPDV)
    return (
      <div className="flex items-center justify-center h-full">
        <p>Acesso negado</p>
      </div>
    );

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b bg-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/orders")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">PDV</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={selectedCustomer ? "secondary" : "outline"}
            onClick={() => setShowCustomerModal(true)}
            className="gap-2"
          >
            <UserIcon className="h-4 w-4" />
            {selectedCustomer ? (
              <span className="max-w-[150px] truncate">
                {selectedCustomer.nome}
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
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b bg-card/50 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar produto (Nome ou SKU)..."
                className="pl-10"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-44">
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

          <ScrollArea className="flex-1 p-4">
            {productsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredProducts.map((product) => {
                  const inCart = cartItems.find(
                    (item) => item.productId === product.id,
                  );
                  const imageUrl = getProductImage(product);
                  const price = parseFloat(
                    product.price || product.precoVarejo || "0",
                  );

                  return (
                    <Card
                      key={product.id}
                      className={`hover-elevate cursor-pointer relative transition-all ${inCart ? "ring-2 ring-primary/50" : ""}`}
                      onClick={() => handleQuickAddToCart(product)}
                    >
                      <CardContent className="p-2">
                        <div className="relative aspect-square bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
                          {addedProductId === product.id && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/90 rounded-md animate-in fade-in zoom-in">
                              <span className="text-primary-foreground font-bold text-lg">
                                +1
                              </span>
                            </div>
                          )}
                          {inCart && (
                            <Badge className="absolute top-1 right-1 z-10">
                              {inCart.quantity}
                            </Badge>
                          )}
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={product.name || product.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-8 w-8 text-muted-foreground/40" />
                          )}
                        </div>
                        <p className="font-medium text-xs line-clamp-2 min-h-[32px]">
                          {product.name || product.nome}
                        </p>
                        <p className="font-semibold text-primary text-sm mt-1">
                          {formatPrice(price)}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="w-80 lg:w-96 flex flex-col border-l bg-card">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" /> Carrinho
            </h2>
            {cartItemCount > 0 && (
              <Badge variant="secondary">{cartItemCount} itens</Badge>
            )}
          </div>

          <ScrollArea className="flex-1 p-3">
            {cartItems.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Carrinho vazio</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item, index) => (
                  <div key={index} className="p-2 rounded-lg bg-muted/30">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">
                          {item.product.name || item.product.nome}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(item.unitPrice)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveFromCart(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(
                              index,
                              parseInt(e.target.value) || 1,
                            )
                          }
                          className="w-14 h-7 text-center text-sm p-1"
                        />
                      </div>
                      <div className="font-semibold text-sm">
                        {formatPrice(item.subtotal)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {cartItems.length > 0 && (
            <div className="p-4 border-t space-y-3">
              <Textarea
                placeholder="Observações..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[60px] text-sm resize-none"
              />
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Pagamento</Label>
                <Select
                  value={selectedPaymentTypeId?.toString() || ""}
                  onValueChange={(val) =>
                    setSelectedPaymentTypeId(parseInt(val))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activePaymentTypes.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id.toString()}>
                        {pt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatPrice(cartTotal)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={resetPDV}>
                  <Trash2 className="h-4 w-4 mr-2" /> Limpar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleGenerateQuote}
                  disabled={createOrderMutation.isPending}
                >
                  {createOrderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}{" "}
                  Gerar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Cliente */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Selecionar Cliente</DialogTitle>
            <DialogDescription className="sr-only">
              Selecione um cliente para o pedido
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, empresa ou email..."
                className="pl-10"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
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
                      className={`p-3 rounded-lg cursor-pointer hover-elevate ${selectedCustomer?.id === customer.id ? "bg-primary/10 ring-1 ring-primary" : "bg-muted/30"}`}
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">
                            {customer.firstName} {customer.lastName}
                          </p>
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

      {/* Modal de Sucesso */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="sr-only">Pedido Criado</DialogTitle>
            <DialogDescription className="sr-only">
              Detalhes do pedido criado
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Pedido Gerado!</h2>
            <p className="text-muted-foreground text-sm mb-4">
              {quoteResult?.orderNumber}
            </p>
            <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{quoteResult?.customer}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="font-medium">Total</span>
                <span className="font-bold text-primary text-lg">
                  {quoteResult && formatPrice(quoteResult.total)}
                </span>
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <Button variant="outline" className="flex-1" disabled>
                <Printer className="h-4 w-4 mr-2" /> Imprimir
              </Button>
              <Button variant="outline" className="flex-1" disabled>
                <Download className="h-4 w-4 mr-2" /> PDF
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
            <Button onClick={resetPDV} className="w-full sm:w-auto">
              <RotateCcw className="h-4 w-4 mr-2" /> Novo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
