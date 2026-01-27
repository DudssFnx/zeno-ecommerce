import { OrderTable, type Order } from "@/components/OrderTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { useState } from "react";
// IMPORTANTE: Tipos corrigidos aqui
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  B2bProduct as Product,
  Order as SchemaOrder,
  B2bUser as User,
} from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";

const STORE_WHATSAPP = "5511992845596";

function getWhatsAppLink(orderNumber: string): string {
  const message = `Olá! Gostaria de falar sobre o pedido #${orderNumber}`;
  return `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

interface OrderWithItems extends SchemaOrder {
  items?: { id: number; quantity: number }[];
}

function getCustomerStatusLabel(status: string): string {
  if (status === "ORCAMENTO") return "Orçamento";
  if (status === "PEDIDO_GERADO") return "Pedido Gerado";
  if (status === "FATURADO" || status === "completed") return "Faturado";
  if (status === "CANCELADO" || status === "cancelled") return "Cancelado";
  return "Processando";
}

function getCustomerStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" {
  if (status === "FATURADO" || status === "completed") return "default";
  if (status === "CANCELADO" || status === "cancelled") return "destructive";
  return "secondary";
}

// Tipo estendido para o carrinho (frontend precisa de price, backend tem precoVarejo)
interface CartItem {
  productId: number;
  product: Product & { price?: string }; // Compatibilidade
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
  const [orderSearch, setOrderSearch] = useState("");

  const showAllOrders = isAdmin || isSales;

  const {
    data: ordersData = [],
    isLoading,
    refetch,
  } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders"],
  });

  // Busca de Clientes (Filtro local ou backend se precisar)
  const { data: customersData = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: showAllOrders,
  });

  // BUSCA REAL DE PRODUTOS NO BACKEND
  const { data: productsResponse } = useQuery<{
    products: any[];
    total: number;
  }>({
    queryKey: ["/api/products", { q: productSearch, limit: 20 }],
    // ADD THIS:
    queryFn: async ({ queryKey }) => {
      const [_path, params] = queryKey;
      const queryString = new URLSearchParams(params as any).toString();
      const response = await fetch(`/api/products?${queryString}`);
      if (!response.ok) throw new Error("Erro ao buscar produtos");
      return response.json();
    },
    enabled: showAllOrders && isCreateOpen,
  });

  const productsData = productsResponse?.products || [];

  const approvedCustomers = customersData.filter(
    (u) => u.approved && u.role === "customer",
  );

  // Filtro de clientes (Client-side é ok para < 1000 clientes)
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
      : [];

  const createOrderMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      items: { productId: number; quantity: number }[];
    }) => {
      await apiRequest("POST", "/api/orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setIsCreateOpen(false);
      setSelectedCustomerId("");
      setSelectedCustomer(null);
      setCustomerSearch("");
      setCartItems([]);
      setProductSearch("");
      toast({ title: "Sucesso", description: "Pedido criado com sucesso" });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro",
        description: err.message || "Falha ao criar pedido",
        variant: "destructive",
      });
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

  const handleAddProduct = (product: any) => {
    // Garante que temos um preço (backend manda 'price', schema tem 'precoVarejo')
    const price = product.price || product.precoVarejo || "0";
    const productWithPrice = { ...product, price };

    const existing = cartItems.find((item) => item.productId === product.id);
    if (existing) {
      setCartItems(
        cartItems.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      setCartItems([
        ...cartItems,
        { productId: product.id, product: productWithPrice, quantity: 1 },
      ]);
    }
    // Não limpamos a busca para permitir adicionar mais rápido
    // setProductSearch("");
  };

  const handleUpdateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(cartItems.filter((item) => item.productId !== productId));
    } else {
      setCartItems(
        cartItems.map((item) =>
          item.productId === productId ? { ...item, quantity } : item,
        ),
      );
    }
  };

  const handleRemoveItem = (productId: number) => {
    setCartItems(cartItems.filter((item) => item.productId !== productId));
  };

  const handleCreateOrder = () => {
    if (!selectedCustomerId) {
      toast({
        title: "Erro",
        description: "Selecione um cliente",
        variant: "destructive",
      });
      return;
    }
    if (cartItems.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um produto",
        variant: "destructive",
      });
      return;
    }
    createOrderMutation.mutate({
      userId: selectedCustomerId,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    });
  };

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.product.price || "0") * item.quantity,
    0,
  );

  const orders: Order[] = ordersData.map((order: any) => ({
    id: String(order.id),
    orderNumber: order.orderNumber,
    customer: order.customerName || order.userId.substring(0, 8) + "...",
    date: format(new Date(order.createdAt), "dd/MM/yyyy", { locale: ptBR }),
    status: order.status as Order["status"],
    stage: order.printed ? "IMPRESSO" : "AGUARDANDO_IMPRESSAO",
    total: parseFloat(order.total),
    itemCount:
      order.items?.reduce(
        (sum: number, item: any) => sum + (item.quantity || 1),
        0,
      ) || 0,
    printed: order.printed || false,
  }));

  const newStatuses = [
    "ORCAMENTO",
    "PEDIDO_GERADO",
    "COBRADO",
    "FATURADO",
    "PEDIDO_FATURADO",
    "CANCELADO",
    "PEDIDO_CANCELADO",
  ];

  const filteredOrders = orders.filter((order) => {
    if (orderSearch.trim()) {
      const search = orderSearch.toLowerCase();
      const matchesSearch =
        order.orderNumber.toLowerCase().includes(search) ||
        order.customer.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    if (activeTab === "all") return true;
    if (activeTab === "legacy") return !newStatuses.includes(order.status);
    if (activeTab === "FATURADO")
      return order.status === "FATURADO" || order.status === "PEDIDO_FATURADO";
    if (activeTab === "CANCELADO")
      return (
        order.status === "CANCELADO" || order.status === "PEDIDO_CANCELADO"
      );
    return order.status === activeTab;
  });

  const printOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("PATCH", `/api/orders/${orderId}/print`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Sucesso", description: "Pedido marcado como impresso" });
    },
  });

  const handlePrintOrder = (order: Order) => {
    printOrderMutation.mutate(order.id);
  };

  const handleSelectionChange = (orderId: string, selected: boolean) => {
    setSelectedOrders((prev) => {
      const newSet = new Set(prev);
      if (selected) newSet.add(orderId);
      else newSet.delete(orderId);
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) setSelectedOrders(new Set(filteredOrders.map((o) => o.id)));
    else setSelectedOrders(new Set());
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Todos os Pedidos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie e acompanhe todos os pedidos
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/pdv">
            <Button
              variant="default"
              className="bg-orange-500 hover:bg-orange-600"
            >
              <ShoppingCart className="h-4 w-4 mr-2" /> Gerar Pedido PDV
            </Button>
          </Link>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Criar Pedido
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
                        <p className="text-sm font-medium truncate">
                          {selectedCustomer.nome}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {selectedCustomer.razaoSocial ||
                            selectedCustomer.email}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClearCustomer}
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
                      />
                    </div>
                  )}
                  {!selectedCustomer &&
                    customerSearch &&
                    filteredCustomers.length > 0 && (
                      <div className="border rounded-md max-h-40 overflow-y-auto">
                        {filteredCustomers.map((customer) => (
                          <div
                            key={customer.id}
                            className="p-2 hover-elevate cursor-pointer flex items-center gap-2"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <UserIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {customer.nome}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {customer.razaoSocial || customer.email}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
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
                    />
                  </div>
                  {/* Lista de produtos agora vem do BACKEND com filtro real */}
                  {productSearch && productsData.length > 0 && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {productsData.map((product) => (
                        <div
                          key={product.id}
                          className="p-2 hover-elevate cursor-pointer flex items-center justify-between gap-2"
                          onClick={() => handleAddProduct(product)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {product.name || product.nome}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              SKU: {product.sku}
                            </p>
                          </div>
                          <span className="text-sm font-semibold">
                            R${" "}
                            {parseFloat(
                              product.price || product.precoVarejo || "0",
                            ).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {productSearch && productsData.length === 0 && (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      Nenhum produto encontrado.
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
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {item.product.name ||
                                  (item.product as any).nome}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                R${" "}
                                {parseFloat(item.product.price || "0").toFixed(
                                  2,
                                )}{" "}
                                un.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateQuantity(
                                    item.productId,
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                className="w-16 text-center"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.productId)}
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
                  <span className="text-lg font-bold">
                    R$ {cartTotal.toFixed(2)}
                  </span>
                </div>

                <Button
                  className="w-full"
                  onClick={handleCreateOrder}
                  disabled={
                    createOrderMutation.isPending ||
                    !selectedCustomerId ||
                    cartItems.length === 0
                  }
                >
                  {createOrderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    "Criar Pedido"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Tabela de Pedidos */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">Todos ({orders.length})</TabsTrigger>
          {/* Outras tabs... */}
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
              onPrintOrder={handlePrintOrder}
              canEdit={showAllOrders}
              onEditOrder={(order) => {
                window.location.href = `/orders/${order.id}`;
              }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
