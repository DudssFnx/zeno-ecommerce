import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Package, User, Calendar, FileText, DollarSign, Printer, MapPin, Download, Pencil, Plus, Trash2, Search, X, AlertTriangle, ChevronDown, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Order, OrderItem, Product as SchemaProduct, PaymentType } from "@shared/schema";
import { CreditCard } from "lucide-react";

interface ProductInfo {
  id: number;
  name: string;
  sku: string;
  image: string | null;
  price: string;
}

interface CustomerInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  tradingName: string | null;
  stateRegistration: string | null;
  email: string | null;
  phone: string | null;
  personType: string | null;
  cnpj: string | null;
  cpf: string | null;
  cep: string | null;
  address: string | null;
  addressNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

interface PrintedByUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

interface OrderWithDetails extends Order {
  items: (OrderItem & { product: ProductInfo })[];
  customer: CustomerInfo;
  printedByUser: PrintedByUser | null;
}

const statusLabels: Record<string, string> = {
  ORCAMENTO: "Orçamento",
  ORCAMENTO_ABERTO: "Orçamento Aberto",
  ORCAMENTO_CONCLUIDO: "Orçamento Enviado",
  PEDIDO_GERADO: "Pedido Gerado",
  PEDIDO_FATURADO: "Faturado",
  PEDIDO_CANCELADO: "Cancelado",
  CANCELADO: "Cancelado",
  pending: "Pendente",
  approved: "Aprovado",
  processing: "Processando",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ORCAMENTO: "secondary",
  ORCAMENTO_ABERTO: "secondary",
  ORCAMENTO_CONCLUIDO: "outline",
  CANCELADO: "destructive",
  PEDIDO_GERADO: "default",
  PEDIDO_FATURADO: "default",
  PEDIDO_CANCELADO: "destructive",
  pending: "secondary",
  approved: "default",
  processing: "default",
  completed: "default",
  cancelled: "destructive",
};

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const { isAdmin, isSales } = useAuth();
  const { toast } = useToast();
  const canEditStatus = isAdmin || isSales;
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [editItems, setEditItems] = useState<Map<number, { productId: number; quantity: number; price: string; originalPrice: string; product: ProductInfo }>>(new Map());
  const [productSearch, setProductSearch] = useState("");
  const [visibleItems, setVisibleItems] = useState(10);
  const ITEMS_PER_LOAD = 30;

  const { data: orderData, isLoading } = useQuery<OrderWithDetails>({
    queryKey: ["/api/orders", orderId],
    enabled: !!orderId,
  });

  const { data: productsData } = useQuery<{ products: { id: number; name: string; sku: string; price: string; image: string | null }[] }>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch('/api/products?limit=1000', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    enabled: isEditMode,
  });

  const { data: paymentTypes } = useQuery<PaymentType[]>({
    queryKey: ["/api/payment-types"],
  });

  const activePaymentTypes = useMemo(() => {
    return paymentTypes?.filter(pt => pt.active) || [];
  }, [paymentTypes]);

  const { editSubtotal, editDiscount, editTotal } = useMemo(() => {
    let subtotal = 0;
    let total = 0;
    editItems.forEach(item => {
      subtotal += parseFloat(item.originalPrice) * item.quantity;
      total += parseFloat(item.price) * item.quantity;
    });
    return { editSubtotal: subtotal, editDiscount: subtotal - total, editTotal: total };
  }, [editItems]);

  const filteredProducts = useMemo(() => {
    if (!productsData?.products || !productSearch.trim()) return [];
    const search = productSearch.toLowerCase();
    return productsData.products
      .filter(p => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search))
      .slice(0, 10);
  }, [productsData?.products, productSearch]);

  const updateItemsMutation = useMutation({
    mutationFn: async (items: { productId: number; quantity: number; price: string }[]) => {
      const response = await apiRequest("PUT", `/api/orders/${orderId}/items`, { items });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setIsEditMode(false);
      setEditItems(new Map());
      toast({
        title: "Pedido Atualizado",
        description: "Os itens do pedido foram atualizados com sucesso.",
      });
    },
    onError: (error: Error) => {
      const desc = isAdmin 
        ? (error.message || "Não foi possível atualizar o pedido.")
        : "Não foi possível atualizar o pedido. Contate o administrador.";
      toast({
        title: "Erro",
        description: desc,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/orders/${orderId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Status Atualizado",
        description: "O status do pedido foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do pedido.",
        variant: "destructive",
      });
    },
  });

  const updatePaymentTypeMutation = useMutation({
    mutationFn: async (paymentTypeId: number) => {
      await apiRequest("PATCH", `/api/orders/${orderId}`, { paymentTypeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Forma de Pagamento Atualizada",
        description: "A forma de pagamento foi alterada com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a forma de pagamento.",
        variant: "destructive",
      });
    },
  });

  const reserveStockMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/orders/${orderId}/reserve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Sucesso",
        description: "Estoque reservado - Pedido gerado com sucesso.",
      });
    },
    onError: (err: Error) => {
      let desc = "Não foi possível reservar o estoque. Verifique se há estoque disponível.";
      const errorMsg = err.message || "";
      const match = errorMsg.match(/\d+:\s*(.+)/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.message) {
            desc = parsed.message;
          }
        } catch {
          desc = match[1];
        }
      }
      toast({
        title: "Estoque Insuficiente",
        description: desc,
        variant: "destructive",
      });
    },
  });

  const invoiceMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/orders/${orderId}/invoice`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Sucesso",
        description: "Pedido faturado - Estoque baixado com sucesso.",
      });
    },
    onError: (err: Error) => {
      const desc = isAdmin 
        ? (err.message || "Não foi possível faturar o pedido.")
        : "Não foi possível faturar o pedido. Contate o administrador.";
      toast({
        title: "Erro",
        description: desc,
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "PEDIDO_GERADO") {
      reserveStockMutation.mutate();
    } else if (newStatus === "FATURADO" || newStatus === "PEDIDO_FATURADO") {
      invoiceMutation.mutate();
    } else {
      updateStatusMutation.mutate(newStatus);
    }
  };

  const printMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/orders/${orderId}/print`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      window.print();
      toast({
        title: "Pedido Impresso",
        description: "O pedido foi marcado como impresso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível marcar o pedido como impresso.",
        variant: "destructive",
      });
    },
  });

  const unreserveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/orders/${orderId}/unreserve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Sucesso",
        description: "Pedido retornado para Orçamento. Estoque liberado.",
      });
    },
    onError: (err: Error) => {
      const desc = isAdmin 
        ? (err.message || "Não foi possível retornar o pedido.")
        : "Não foi possível retornar o pedido. Contate o administrador.";
      toast({
        title: "Erro",
        description: desc,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="p-6 lg:p-8">
        <Link href="/orders">
          <Button variant="ghost" size="sm" data-testid="link-back-orders">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Pedidos
          </Button>
        </Link>
        <div className="text-center py-12 text-muted-foreground">
          Pedido não encontrado
        </div>
      </div>
    );
  }

  const customer = orderData.customer;
  const itemsWithProducts = orderData.items || [];

  const subtotal = itemsWithProducts.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0
  );

  const formatDocument = () => {
    if (customer?.personType === 'juridica' && customer?.cnpj) {
      return `CNPJ: ${customer.cnpj}`;
    }
    if (customer?.personType === 'fisica' && customer?.cpf) {
      return `CPF: ${customer.cpf}`;
    }
    return null;
  };

  const formatAddress = () => {
    const parts = [];
    if (customer?.address) {
      let addressLine = customer.address;
      if (customer.addressNumber) addressLine += `, ${customer.addressNumber}`;
      if (customer.complement) addressLine += ` - ${customer.complement}`;
      parts.push(addressLine);
    }
    if (customer?.neighborhood) parts.push(customer.neighborhood);
    if (customer?.city || customer?.state) {
      parts.push([customer.city, customer.state].filter(Boolean).join(" - "));
    }
    if (customer?.cep) parts.push(`CEP: ${customer.cep}`);
    return parts;
  };

  const canEditItems = orderData?.status === 'ORCAMENTO' || orderData?.status === 'ORCAMENTO_CONCLUIDO' || orderData?.status === 'ORCAMENTO_ABERTO';
  const isFaturado = orderData?.status === 'PEDIDO_FATURADO';
  const isPedidoGerado = orderData?.status === 'PEDIDO_GERADO';

  const startEditMode = () => {
    const initialItems = new Map<number, { productId: number; quantity: number; price: string; originalPrice: string; product: ProductInfo }>();
    itemsWithProducts.forEach(item => {
      initialItems.set(item.productId, {
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        originalPrice: item.product?.price || item.price,
        product: item.product,
      });
    });
    setEditItems(initialItems);
    setIsEditMode(true);
  };

  const cancelEditMode = () => {
    setIsEditMode(false);
    setEditItems(new Map());
    setProductSearch("");
  };

  const updateEditItemQuantity = (productId: number, newQty: number) => {
    setEditItems(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(productId);
      if (item) {
        newMap.set(productId, { ...item, quantity: Math.max(1, newQty) });
      }
      return newMap;
    });
  };

  const updateEditItemPrice = (productId: number, newPrice: string) => {
    setEditItems(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(productId);
      if (item) {
        newMap.set(productId, { ...item, price: newPrice });
      }
      return newMap;
    });
  };

  const removeEditItem = (productId: number) => {
    setEditItems(prev => {
      const newMap = new Map(prev);
      newMap.delete(productId);
      return newMap;
    });
  };

  const addProductToEdit = (product: { id: number; name: string; sku: string; price: string; image: string | null }) => {
    setEditItems(prev => {
      const newMap = new Map(prev);
      if (newMap.has(product.id)) {
        const existing = newMap.get(product.id)!;
        newMap.set(product.id, { ...existing, quantity: existing.quantity + 1 });
      } else {
        newMap.set(product.id, {
          productId: product.id,
          quantity: 1,
          price: product.price,
          originalPrice: product.price,
          product: { id: product.id, name: product.name, sku: product.sku, price: product.price, image: product.image },
        });
      }
      return newMap;
    });
    setProductSearch("");
  };

  const saveEditItems = () => {
    const items = Array.from(editItems.values()).map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
    }));
    if (items.length === 0) {
      toast({ title: "Erro", description: "O pedido deve ter pelo menos um item.", variant: "destructive" });
      return;
    }
    updateItemsMutation.mutate(items);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/orders">
          <Button variant="ghost" size="sm" data-testid="link-back-orders">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold" data-testid="text-order-number">
            Pedido {orderData.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            Criado em {format(new Date(orderData.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {orderData.printed && (
            <Badge variant="outline" data-testid="badge-printed">
              Impresso
            </Badge>
          )}
          <Badge variant={statusVariants[orderData.status]} data-testid="badge-order-status">
            {statusLabels[orderData.status] || orderData.status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {isFaturado && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive font-medium" data-testid="alert-faturado">
                  Pedidos faturados não podem ser modificados.
                </p>
              </CardContent>
            </Card>
          )}

          {isPedidoGerado && (
            <Card className="border-orange-500/50 bg-orange-500/5">
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                  <p className="text-sm text-orange-700 dark:text-orange-300" data-testid="alert-gerado">
                    Este pedido tem estoque reservado.
                  </p>
                </div>
                {canEditStatus && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => unreserveMutation.mutate()}
                    disabled={unreserveMutation.isPending}
                    data-testid="button-unreserve"
                  >
                    {unreserveMutation.isPending ? "Retornando..." : "Retornar para Orçamento"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Itens do Pedido
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {isEditMode ? editItems.size : itemsWithProducts.length} {(isEditMode ? editItems.size : itemsWithProducts.length) === 1 ? "item" : "itens"}
                </span>
                {canEditStatus && canEditItems && !isEditMode && (
                  <Button variant="outline" size="sm" onClick={startEditMode} data-testid="button-edit-items">
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditMode ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produtos para adicionar..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-products"
                    />
                    {filteredProducts.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredProducts.map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center gap-3 p-3 cursor-pointer hover-elevate"
                            onClick={() => addProductToEdit(product)}
                            data-testid={`add-product-${product.id}`}
                          >
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                              {product.image ? (
                                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate text-sm">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.sku}</p>
                            </div>
                            <p className="text-sm font-medium">R$ {parseFloat(product.price).toFixed(2)}</p>
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {Array.from(editItems.values()).map((item) => (
                    <div key={item.productId} className="flex items-center gap-3" data-testid={`edit-item-${item.productId}`}>
                      <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.product?.image ? (
                          <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{item.product?.name}</p>
                        <p className="text-xs text-muted-foreground">SKU: {item.product?.sku}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateEditItemQuantity(item.productId, parseInt(e.target.value) || 1)}
                          className="w-14 h-8 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          data-testid={`input-qty-${item.productId}`}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updateEditItemPrice(item.productId, e.target.value || "0")}
                          className="w-20 h-8 text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          data-testid={`input-price-${item.productId}`}
                        />
                      </div>
                      <div className="text-right w-20">
                        <p className="font-medium text-sm">R$ {(parseFloat(item.price) * item.quantity).toFixed(2)}</p>
                        {parseFloat(item.price) < parseFloat(item.originalPrice) && (
                          <p className="text-xs text-green-600">-{(((parseFloat(item.originalPrice) - parseFloat(item.price)) / parseFloat(item.originalPrice)) * 100).toFixed(0)}%</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeEditItem(item.productId)} data-testid={`btn-remove-${item.productId}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {editItems.size === 0 && (
                    <p className="text-center text-muted-foreground py-4">Nenhum item no pedido. Adicione produtos acima.</p>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>R$ {editSubtotal.toFixed(2)}</span>
                    </div>
                    {editDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Desconto</span>
                        <span>- R$ {editDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-medium">Total</span>
                      <span className="text-lg font-semibold">R$ {editTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={cancelEditMode} className="flex-1" data-testid="button-cancel-edit">
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button onClick={saveEditItems} disabled={updateItemsMutation.isPending} className="flex-1" data-testid="button-save-edit">
                      {updateItemsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Salvar Alterações
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {itemsWithProducts.slice(0, visibleItems).map((item) => (
                      <div key={item.id} className="flex items-center gap-4" data-testid={`order-item-${item.id}`}>
                        <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.product?.image ? (
                            <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" data-testid={`text-product-name-${item.id}`}>
                            {item.product?.name || `Produto #${item.productId}`}
                          </p>
                          <p className="text-sm text-muted-foreground">SKU: {item.product?.sku || "-"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium" data-testid={`text-item-total-${item.id}`}>
                            R$ {(parseFloat(item.price) * item.quantity).toFixed(2)}
                          </p>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity}x R$ {parseFloat(item.price).toFixed(2)}
                            {item.product?.price && parseFloat(item.product.price) > parseFloat(item.price) && (
                              <span className="ml-1 line-through text-xs">
                                R$ {parseFloat(item.product.price).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {itemsWithProducts.length > visibleItems && (
                    <div className="flex justify-center pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => setVisibleItems(prev => prev + ITEMS_PER_LOAD)}
                        data-testid="button-show-more-items"
                      >
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Mostrar mais ({itemsWithProducts.length - visibleItems} restantes)
                      </Button>
                    </div>
                  )}
                  <Separator className="my-4" />
                  
                  {canEditStatus && (
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CreditCard className="h-4 w-4" />
                        <span>Forma de Pagamento</span>
                      </div>
                      <Select
                        value={orderData.paymentTypeId?.toString() || ""}
                        onValueChange={(val) => {
                          if (val) updatePaymentTypeMutation.mutate(parseInt(val));
                        }}
                        disabled={updatePaymentTypeMutation.isPending}
                      >
                        <SelectTrigger data-testid="select-payment-type">
                          <SelectValue placeholder="Selecione a forma de pagamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {activePaymentTypes.map((pt) => (
                            <SelectItem key={pt.id} value={pt.id.toString()} data-testid={`payment-type-${pt.id}`}>
                              {pt.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {!canEditStatus && orderData.paymentTypeId && (
                    <div className="flex items-center gap-2 mb-4 text-sm">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Pagamento:</span>
                      <span className="font-medium">
                        {activePaymentTypes.find(pt => pt.id === orderData.paymentTypeId)?.name || '-'}
                      </span>
                    </div>
                  )}

                  {(() => {
                    const subtotal = itemsWithProducts.reduce((acc, item) => {
                      const originalPrice = item.product?.price ? parseFloat(item.product.price) : parseFloat(item.price);
                      return acc + (originalPrice * item.quantity);
                    }, 0);
                    const total = parseFloat(orderData.total);
                    const discount = subtotal - total;
                    
                    return (
                      <div className="space-y-2">
                        {discount > 0.01 && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span data-testid="text-order-subtotal">R$ {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Desconto</span>
                              <span data-testid="text-order-discount">- R$ {discount.toFixed(2)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between items-center pt-1">
                          <span className="font-medium">Total do Pedido</span>
                          <span className="text-lg font-semibold" data-testid="text-order-total">R$ {total.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>

          {orderData.notes && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Observações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-order-notes">
                  {orderData.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {canEditStatus && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={orderData.status}
                  onValueChange={handleStatusChange}
                  disabled={updateStatusMutation.isPending || reserveStockMutation.isPending || invoiceMutation.isPending}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Selecionar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ORCAMENTO_ABERTO">Orçamento Aberto</SelectItem>
                    <SelectItem value="ORCAMENTO_CONCLUIDO">Orçamento Enviado</SelectItem>
                    <SelectItem value="PEDIDO_GERADO">Gerar Pedido (Reservar Estoque)</SelectItem>
                    <SelectItem value="PEDIDO_FATURADO">Faturar (Baixar Estoque)</SelectItem>
                    <SelectItem value="PEDIDO_CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => printMutation.mutate()}
                  disabled={printMutation.isPending}
                  data-testid="button-print"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  {printMutation.isPending ? "Imprimindo..." : "Imprimir Pedido"}
                </Button>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/orders/${orderId}/pdf?type=cobranca`, {
                          credentials: 'include',
                        });
                        if (!response.ok) throw new Error('Failed to generate PDF');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Orcamento_${orderData?.orderNumber || orderId}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                        
                        await apiRequest("PATCH", `/api/orders/${orderId}/print`, {});
                        queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
                        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                        
                        toast({
                          title: "PDF Gerado",
                          description: "PDF de Cobranca gerado com sucesso.",
                        });
                      } catch (error) {
                        toast({
                          title: "Erro",
                          description: "Nao foi possivel gerar o PDF.",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="button-pdf-cobranca"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF Cobranca
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/orders/${orderId}/pdf?type=separacao`, {
                          credentials: 'include',
                        });
                        if (!response.ok) throw new Error('Failed to generate PDF');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Separacao_${orderData?.orderNumber || orderId}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                        
                        toast({
                          title: "PDF Gerado",
                          description: "PDF de Separacao gerado com sucesso.",
                        });
                      } catch (error) {
                        toast({
                          title: "Erro",
                          description: "Nao foi possivel gerar o PDF.",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="button-pdf-separacao"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF Separacao
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/orders/${orderId}/pdf?type=conferencia`, {
                          credentials: 'include',
                        });
                        if (!response.ok) throw new Error('Failed to generate PDF');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Conferencia_${orderData?.orderNumber || orderId}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                        
                        toast({
                          title: "PDF Gerado",
                          description: "PDF de Conferencia gerado com sucesso.",
                        });
                      } catch (error) {
                        toast({
                          title: "Erro",
                          description: "Nao foi possivel gerar o PDF.",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="button-pdf-conferencia"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF Conferencia
                  </Button>
                </div>
                <Separator className="my-2" />
                <div className="grid grid-cols-1 gap-2">
                  {customer?.phone && (
                    <Button
                      variant="outline"
                      className="w-full bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
                      onClick={() => {
                        const phone = customer.phone?.replace(/\D/g, '');
                        const customerName = customer.firstName || 'Cliente';
                        const message = encodeURIComponent(
                          `Oi ${customerName}, tudo bem? Estou entrando em contato sobre o pedido ${orderData.orderNumber}.`
                        );
                        window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
                      }}
                      data-testid="button-whatsapp-customer"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Chamar Cliente no WhatsApp
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
                    onClick={() => {
                      const customerName = customer?.firstName || 'Cliente';
                      const total = parseFloat(orderData.total).toFixed(2);
                      const message = encodeURIComponent(
                        `Oi ${customerName} acabei de mandar orçamento de número ${orderData.orderNumber} de valor R$ ${total} aguardando para darmos andamento`
                      );
                      window.open(`https://wa.me/5511992845596?text=${message}`, '_blank');
                    }}
                    data-testid="button-whatsapp-store"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Enviar Pedido no WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium" data-testid="text-customer-name">
                      {customer.firstName} {customer.lastName}
                    </p>
                  </div>
                  {customer.company && (
                    <div>
                      <p className="text-sm text-muted-foreground">Empresa</p>
                      <p className="font-medium">{customer.company}</p>
                    </div>
                  )}
                  {formatDocument() && (
                    <div>
                      <p className="text-sm text-muted-foreground">Documento</p>
                      <p className="font-medium" data-testid="text-customer-document">{formatDocument()}</p>
                    </div>
                  )}
                  {customer.email && (
                    <div>
                      <p className="text-sm text-muted-foreground">E-mail</p>
                      <p className="font-medium">{customer.email}</p>
                    </div>
                  )}
                  {customer.phone && (
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{customer.phone}</p>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">ID do Cliente</p>
                  <p className="font-medium font-mono text-sm" data-testid="text-customer-id">
                    {orderData.userId}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {customer && formatAddress().length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1" data-testid="text-customer-address">
                  {formatAddress().map((line, idx) => (
                    <p key={idx} className={idx === 0 ? "font-medium" : "text-muted-foreground text-sm"}>
                      {line}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Resumo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span data-testid="text-summary-total">R$ {parseFloat(orderData.total).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Número do Pedido</p>
                <p className="font-medium font-mono">{orderData.orderNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data de Criação</p>
                <p className="font-medium">
                  {format(new Date(orderData.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
              {orderData.printed && orderData.printedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Impresso em</p>
                  <p className="font-medium">
                    {format(new Date(orderData.printedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  {orderData.printedByUser && (
                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-printed-by">
                      por {orderData.printedByUser.firstName || orderData.printedByUser.email}
                    </p>
                  )}
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Status Atual</p>
                <Badge variant={statusVariants[orderData.status]} className="mt-1">
                  {statusLabels[orderData.status] || orderData.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
