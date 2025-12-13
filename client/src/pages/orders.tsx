import { useState } from "react";
import { OrderTable, type Order } from "@/components/OrderTable";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Loader2, Package, Eye, Plus, Trash2, Search, X, User as UserIcon, Printer, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Order as SchemaOrder, Product, User } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OrderWithItems extends SchemaOrder {
  items?: { id: number; quantity: number }[];
}

function getCustomerStatusLabel(status: string): string {
  const inProgress = ["ORCAMENTO_ABERTO", "ORCAMENTO_CONCLUIDO", "PEDIDO_GERADO", "pending", "approved", "processing"];
  if (inProgress.includes(status)) return "Em andamento";
  if (status === "PEDIDO_FATURADO" || status === "completed") return "Faturado";
  if (status === "PEDIDO_CANCELADO" || status === "cancelled") return "Cancelado";
  return "Processando";
}

function getCustomerStatusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "PEDIDO_FATURADO" || status === "completed") return "default";
  if (status === "PEDIDO_CANCELADO" || status === "cancelled") return "destructive";
  return "secondary";
}

interface CartItem {
  productId: number;
  product: Product;
  quantity: number;
}

export default function OrdersPage() {
  const { isAdmin, isSales } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  const showAllOrders = isAdmin || isSales;

  const { data: ordersData = [], isLoading, refetch } = useQuery<OrderWithItems[]>({
    queryKey: ['/api/orders'],
  });

  const { data: customersData = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: showAllOrders,
  });

  const { data: productsResponse } = useQuery<{ products: Product[]; total: number }>({
    queryKey: ['/api/products'],
    enabled: showAllOrders,
  });

  const productsData = productsResponse?.products || [];
  const approvedCustomers = customersData.filter(u => u.approved && u.role === "customer");
  const filteredCustomers = customerSearch.length > 0 
    ? approvedCustomers.filter(c => 
        (c.firstName?.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.lastName?.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.company?.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.email?.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.tradingName?.toLowerCase().includes(customerSearch.toLowerCase()))
      ).slice(0, 10)
    : [];
  const filteredProducts = productsData.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 10);

  const createOrderMutation = useMutation({
    mutationFn: async (data: { userId: string; items: { productId: number; quantity: number }[] }) => {
      await apiRequest("POST", "/api/orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setIsCreateOpen(false);
      setSelectedCustomerId("");
      setSelectedCustomer(null);
      setCustomerSearch("");
      setCartItems([]);
      setProductSearch("");
      toast({ title: "Sucesso", description: "Pedido criado com sucesso" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message || "Falha ao criar pedido", variant: "destructive" });
    },
  });

  const handleSelectCustomer = (customer: User) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomer(customer);
    setCustomerSearch("");
  };

  const handleClearCustomer = () => {
    setSelectedCustomerId("");
    setSelectedCustomer(null);
    setCustomerSearch("");
  };

  const handleAddProduct = (product: Product) => {
    const existing = cartItems.find(item => item.productId === product.id);
    if (existing) {
      setCartItems(cartItems.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCartItems([...cartItems, { productId: product.id, product, quantity: 1 }]);
    }
    setProductSearch("");
  };

  const handleUpdateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(cartItems.filter(item => item.productId !== productId));
    } else {
      setCartItems(cartItems.map(item => 
        item.productId === productId ? { ...item, quantity } : item
      ));
    }
  };

  const handleRemoveItem = (productId: number) => {
    setCartItems(cartItems.filter(item => item.productId !== productId));
  };

  const handleCreateOrder = () => {
    if (!selectedCustomerId) {
      toast({ title: "Erro", description: "Selecione um cliente", variant: "destructive" });
      return;
    }
    if (cartItems.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um produto", variant: "destructive" });
      return;
    }
    createOrderMutation.mutate({
      userId: selectedCustomerId,
      items: cartItems.map(item => ({ productId: item.productId, quantity: item.quantity })),
    });
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.product.price) * item.quantity), 0);

  const orders: Order[] = ordersData.map((order: any) => ({
    id: String(order.id),
    orderNumber: order.orderNumber,
    customer: order.customerName || order.userId.substring(0, 8) + "...",
    date: format(new Date(order.createdAt), "MMM d, yyyy"),
    status: order.status as Order["status"],
    total: parseFloat(order.total),
    itemCount: order.items?.length || 0,
    printed: order.printed || false,
  }));

  const newStatuses = ["ORCAMENTO_ABERTO", "ORCAMENTO_CONCLUIDO", "PEDIDO_GERADO", "PEDIDO_FATURADO", "PEDIDO_CANCELADO"];
  
  const filteredOrders = orders.filter((order) => {
    if (activeTab === "all") return true;
    if (activeTab === "legacy") return !newStatuses.includes(order.status);
    return order.status === activeTab;
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      await apiRequest("PATCH", `/api/orders/${orderId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
  });

  const printOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("PATCH", `/api/orders/${orderId}/print`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: "Sucesso", description: "Pedido marcado como impresso" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao marcar como impresso", variant: "destructive" });
    },
  });

  const reserveStockMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("POST", `/api/orders/${orderId}/reserve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: "Sucesso", description: "Estoque reservado - Pedido gerado" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message || "Falha ao reservar estoque", variant: "destructive" });
    },
  });

  const invoiceMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("POST", `/api/orders/${orderId}/invoice`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: "Sucesso", description: "Pedido faturado com sucesso" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message || "Falha ao faturar pedido", variant: "destructive" });
    },
  });

  const handlePrintOrder = (order: Order) => {
    printOrderMutation.mutate(order.id);
  };

  const handleReserveStock = (order: Order) => {
    reserveStockMutation.mutate(order.id);
  };

  const handleInvoice = (order: Order) => {
    invoiceMutation.mutate(order.id);
  };

  const handleSelectionChange = (orderId: string, selected: boolean) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(orderId);
      } else {
        newSet.delete(orderId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleBatchPrint = async (pdfType: 'separacao' | 'cobranca' | 'conferencia') => {
    if (selectedOrders.size === 0) {
      toast({ title: "Aviso", description: "Selecione pelo menos um pedido", variant: "destructive" });
      return;
    }
    const orderIds = Array.from(selectedOrders);
    
    try {
      const response = await fetch('/api/orders/pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderIds, type: pdfType })
      });
      
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      await Promise.all(orderIds.map(orderId => 
        apiRequest("PATCH", `/api/orders/${orderId}/print`, {})
      ));
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setSelectedOrders(new Set());
      toast({ title: "Sucesso", description: `PDF gerado com ${orderIds.length} pedido(s)` });
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao gerar PDF", variant: "destructive" });
    }
  };

  const [isBatchStatusLoading, setIsBatchStatusLoading] = useState(false);
  const [isBatchDeleteLoading, setIsBatchDeleteLoading] = useState(false);

  const handleBatchDelete = async () => {
    if (selectedOrders.size === 0) {
      toast({ title: "Aviso", description: "Selecione pelo menos um pedido", variant: "destructive" });
      return;
    }
    
    if (!confirm(`Tem certeza que deseja excluir ${selectedOrders.size} pedido(s)? Esta ação não pode ser desfeita.`)) {
      return;
    }
    
    setIsBatchDeleteLoading(true);
    const orderIds = Array.from(selectedOrders);
    let successCount = 0;
    let errorCount = 0;

    for (const orderId of orderIds) {
      try {
        await apiRequest("DELETE", `/api/orders/${orderId}`);
        successCount++;
      } catch (e) {
        errorCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    setSelectedOrders(new Set());
    setIsBatchDeleteLoading(false);

    if (errorCount === 0) {
      toast({ title: "Sucesso", description: `${successCount} pedido(s) excluído(s) com sucesso` });
    } else {
      toast({ 
        title: "Aviso", 
        description: `${successCount} excluído(s), ${errorCount} erro(s)`,
        variant: errorCount > 0 && successCount === 0 ? "destructive" : "default"
      });
    }
  };

  const handleBatchStatusChange = async (newStatus: string) => {
    if (selectedOrders.size === 0) {
      toast({ title: "Aviso", description: "Selecione pelo menos um pedido", variant: "destructive" });
      return;
    }
    
    setIsBatchStatusLoading(true);
    const orderIds = Array.from(selectedOrders);
    let successCount = 0;
    let errorCount = 0;

    for (const orderId of orderIds) {
      try {
        if (newStatus === "PEDIDO_GERADO") {
          await apiRequest("POST", `/api/orders/${orderId}/reserve`, {});
        } else if (newStatus === "PEDIDO_FATURADO") {
          await apiRequest("POST", `/api/orders/${orderId}/invoice`, {});
        } else {
          await apiRequest("PATCH", `/api/orders/${orderId}`, { status: newStatus });
        }
        successCount++;
      } catch (e) {
        errorCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    setSelectedOrders(new Set());
    setIsBatchStatusLoading(false);

    if (errorCount === 0) {
      toast({ title: "Sucesso", description: `${successCount} pedido(s) atualizado(s) com sucesso` });
    } else {
      toast({ 
        title: "Aviso", 
        description: `${successCount} atualizado(s), ${errorCount} erro(s)`,
        variant: errorCount > 0 && successCount === 0 ? "destructive" : "default"
      });
    }
  };

  const handleUpdateStatus = (order: Order, status: string) => {
    updateStatusMutation.mutate(
      { orderId: order.id, status },
      {
        onSuccess: () => {
          toast({
            title: "Pedido Atualizado",
            description: `Pedido ${order.orderNumber} marcado como ${status}`,
          });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Falha ao atualizar status do pedido",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/orders/export/csv", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Export failed");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "orders.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Exportação Concluída",
        description: "Os pedidos foram exportados para CSV",
      });
    } catch (error) {
      toast({
        title: "Falha na Exportação",
        description: "Não foi possível exportar os pedidos",
        variant: "destructive",
      });
    }
  };

  if (!showAllOrders) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">Meus Pedidos</h1>
            <p className="text-muted-foreground mt-1">
              Visualize e acompanhe seu histórico de pedidos
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-orders">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Você ainda não tem pedidos</p>
            <p className="text-sm mt-1">Adicione produtos ao carrinho para fazer seu primeiro pedido</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} data-testid={`card-order-${order.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-semibold" data-testid={`text-order-number-${order.id}`}>
                          {order.orderNumber}
                        </span>
                        <Badge 
                          variant={getCustomerStatusVariant(order.status)}
                          data-testid={`badge-status-${order.id}`}
                        >
                          {getCustomerStatusLabel(order.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(ordersData.find(o => String(o.id) === order.id)?.createdAt || new Date()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">R$ {order.total.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{order.itemCount} itens</p>
                    </div>
                    <Link href={`/orders/${order.id}`}>
                      <Button variant="outline" size="sm" data-testid={`button-view-order-${order.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalhes
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Todos os Pedidos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie e acompanhe todos os pedidos de clientes
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-order">
                <Plus className="h-4 w-4 mr-2" />
                Criar Pedido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Criar Novo Pedido</DialogTitle>
                <DialogDescription>
                  Selecione o cliente e adicione os produtos
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-auto space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  {selectedCustomer ? (
                    <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" data-testid="text-selected-customer">
                          {selectedCustomer.firstName} {selectedCustomer.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {selectedCustomer.company || selectedCustomer.tradingName || selectedCustomer.email}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClearCustomer}
                        data-testid="button-clear-customer"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Digite o nome do cliente..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="pl-9"
                        data-testid="input-search-customer"
                      />
                    </div>
                  )}
                  {!selectedCustomer && customerSearch && filteredCustomers.length > 0 && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {filteredCustomers.map((customer) => (
                        <div 
                          key={customer.id}
                          className="p-2 hover-elevate cursor-pointer flex items-center gap-2"
                          onClick={() => handleSelectCustomer(customer)}
                          data-testid={`customer-option-${customer.id}`}
                        >
                          <UserIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {customer.firstName} {customer.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {customer.company || customer.tradingName || customer.email}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!selectedCustomer && customerSearch && filteredCustomers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Nenhum cliente encontrado
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Adicionar Produtos</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produto por nome ou SKU..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-product"
                    />
                  </div>
                  {productSearch && filteredProducts.length > 0 && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {filteredProducts.map((product) => (
                        <div 
                          key={product.id}
                          className="p-2 hover-elevate cursor-pointer flex items-center justify-between gap-2"
                          onClick={() => handleAddProduct(product)}
                          data-testid={`product-option-${product.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                          </div>
                          <span className="text-sm font-semibold">R$ {parseFloat(product.price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {cartItems.length > 0 && (
                  <div className="space-y-2">
                    <Label>Itens do Pedido ({cartItems.length})</Label>
                    <ScrollArea className="h-48 border rounded-md">
                      <div className="p-2 space-y-2">
                        {cartItems.map((item) => (
                          <div 
                            key={item.productId}
                            className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-md"
                            data-testid={`cart-item-${item.productId}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                R$ {parseFloat(item.product.price).toFixed(2)} un.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateQuantity(item.productId, parseInt(e.target.value) || 0)}
                                className="w-16 text-center"
                                data-testid={`input-qty-${item.productId}`}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.productId)}
                                data-testid={`button-remove-${item.productId}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <span className="font-semibold">Total:</span>
                  <span className="text-lg font-bold" data-testid="text-cart-total">
                    R$ {cartTotal.toFixed(2)}
                  </span>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleCreateOrder}
                  disabled={createOrderMutation.isPending || !selectedCustomerId || cartItems.length === 0}
                  data-testid="button-submit-order"
                >
                  {createOrderMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Pedido"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant={selectedOrders.size > 0 ? "default" : "outline"}
                data-testid="button-batch-print"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir {selectedOrders.size > 0 ? `(${selectedOrders.size})` : "Selecionados"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => handleBatchPrint('separacao')}
                data-testid="menu-print-separacao"
              >
                Separação
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleBatchPrint('cobranca')}
                data-testid="menu-print-cobranca"
              >
                Cobrança
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleBatchPrint('conferencia')}
                data-testid="menu-print-conferencia"
              >
                Conferência
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant={selectedOrders.size > 0 ? "default" : "outline"}
                disabled={isBatchStatusLoading}
                data-testid="button-batch-status"
              >
                {isBatchStatusLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Edit2 className="h-4 w-4 mr-2" />
                )}
                Alterar Status {selectedOrders.size > 0 ? `(${selectedOrders.size})` : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => handleBatchStatusChange('ORCAMENTO_CONCLUIDO')}
                data-testid="batch-status-orcamento-concluido"
              >
                Enviar Orçamento
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleBatchStatusChange('PEDIDO_GERADO')}
                data-testid="batch-status-pedido-gerado"
              >
                Gerar Pedido (Reservar Estoque)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleBatchStatusChange('PEDIDO_FATURADO')}
                data-testid="batch-status-pedido-faturado"
              >
                Faturar Pedido
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleBatchStatusChange('PEDIDO_CANCELADO')}
                data-testid="batch-status-pedido-cancelado"
                className="text-destructive"
              >
                Cancelar Pedido (Devolver Estoque)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isAdmin && (
            <Button 
              variant="destructive" 
              onClick={handleBatchDelete}
              disabled={selectedOrders.size === 0 || isBatchDeleteLoading}
              data-testid="button-batch-delete"
            >
              {isBatchDeleteLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir {selectedOrders.size > 0 ? `(${selectedOrders.size})` : "Selecionados"}
            </Button>
          )}
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-orders">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={handleExport} data-testid="button-export-orders">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all" data-testid="tab-all">Todos ({orders.length})</TabsTrigger>
          <TabsTrigger value="ORCAMENTO_ABERTO" data-testid="tab-orcamento-aberto">
            Orçamentos ({orders.filter(o => o.status === "ORCAMENTO_ABERTO").length})
          </TabsTrigger>
          <TabsTrigger value="ORCAMENTO_CONCLUIDO" data-testid="tab-orcamento-concluido">
            Enviados ({orders.filter(o => o.status === "ORCAMENTO_CONCLUIDO").length})
          </TabsTrigger>
          <TabsTrigger value="PEDIDO_GERADO" data-testid="tab-pedido-gerado">
            Pedidos ({orders.filter(o => o.status === "PEDIDO_GERADO").length})
          </TabsTrigger>
          <TabsTrigger value="PEDIDO_FATURADO" data-testid="tab-pedido-faturado">
            Faturados ({orders.filter(o => o.status === "PEDIDO_FATURADO").length})
          </TabsTrigger>
          <TabsTrigger value="legacy" data-testid="tab-legacy">
            Outros ({orders.filter(o => !newStatuses.includes(o.status)).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum pedido encontrado
            </div>
          ) : (
            <OrderTable
              orders={filteredOrders}
              showCustomer={true}
              selectedOrderIds={selectedOrders}
              onSelectionChange={handleSelectionChange}
              onSelectAll={handleSelectAll}
              onViewOrder={(order) => console.log("View:", order.orderNumber)}
              onEditOrder={(order) => console.log("Edit:", order.orderNumber)}
              onUpdateStatus={handleUpdateStatus}
              onPrintOrder={handlePrintOrder}
              onReserveStock={handleReserveStock}
              onInvoice={handleInvoice}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
