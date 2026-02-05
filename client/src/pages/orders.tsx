import { OrderTable } from "@/components/OrderTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  Order as SchemaOrder,
  b2bProducts,
  b2bUsers,
} from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { type InferSelectModel } from "drizzle-orm";
import {
  AlertTriangle,
  Box,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

type User = InferSelectModel<typeof b2bUsers>;
type Product = InferSelectModel<typeof b2bProducts>;

// --- TIPOS ---
interface CartItem {
  productId: number;
  product: Product;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
}

interface Installment {
  number: number;
  days: number;
  date: string;
  value: number;
  method: string;
  obs: string;
}

interface OrderWithItems extends SchemaOrder {
  items?: { id: number; quantity: number }[];
  customerName?: string;
}

export default function OrdersPage() {
  const { isAdmin, isSales, user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // --- ESTADO DE SELEÇÃO (ARRAY) ---
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // --- MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reverseStock, setReverseStock] = useState(true);
  const [ordersWithStock, setOrdersWithStock] = useState<number>(0);

  // --- ESTADOS DO FORMULÁRIO ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string>("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [deliveryDeadline, setDeliveryDeadline] = useState<string>("0");
  const [saleDate, setSaleDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [departureDate, setDepartureDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [customerPO, setCustomerPO] = useState("");
  const [paymentCondition, setPaymentCondition] = useState("");
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Boleto");
  const [carrierName, setCarrierName] = useState("");
  const [shippingType, setShippingType] = useState("CIF");
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const showAllOrders = isAdmin || isSales;

  // --- QUERIES ---
  const {
    data: ordersData = [],
    isLoading: isLoadingOrders,
    refetch: refetchOrders,
  } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders"],
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: usersData = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: showAllOrders,
  });

  const customersList = usersData.filter(
    (u) => u.role === "customer" || !u.role,
  );
  const sellersList = usersData.filter(
    (u) => u.role === "admin" || u.role === "sales",
  );

  useEffect(() => {
    if (isCreateOpen && user && !selectedSellerId) {
      setSelectedSellerId(user.id);
    }
  }, [isCreateOpen, user]);

  const { data: productsResponse } = useQuery<{
    products: any[];
    total: number;
  }>({
    queryKey: ["/api/products", { limit: 1000 }],
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

  // --- LÓGICA DE SELEÇÃO ---
  const mappedOrders = ordersData
    .map((o) => ({
      ...o,
      id: String(o.id),
      customer:
        o.customerName ||
        usersData.find((u) => u.id === o.userId)?.firstName ||
        "Cliente Desconhecido",
      date: format(new Date(o.createdAt || new Date()), "dd/MM/yyyy"),
      total: parseFloat(o.total),
      itemCount: o.items?.length || 0,
      status: o.status as any,
      printed: false,
      stockPosted: o.stockPosted || false,
      accountsPosted: o.accountsPosted || false,
    }))
    .filter((o) => {
      if (activeTab === "all") return true;
      return o.status === activeTab;
    });

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === mappedOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(mappedOrders.map((o) => o.id));
    }
  };

  // --- MUTAÇÕES DE STATUS (COM REFRESH EM PRODUTOS) ---
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/orders/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] }); // <--- IMPORTANTE
      refetchOrders();
      toast({
        title: "Status Atualizado",
        className: "bg-green-600 text-white",
      });
    },
  });

  const handleSingleStatusChange = (id: string, newStatus: string) => {
    updateStatusMutation.mutate({ id, status: newStatus });
  };

  // --- AÇÕES DE ESTOQUE MANUAL ---
  const stockActionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "post" | "reverse" }) => {
      const endpoint = action === "post" ? `/api/orders/${id}/reserve` : `/api/orders/${id}/unreserve`;
      await apiRequest("POST", endpoint, {});
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      refetchOrders();
      toast({
        title: variables.action === "post" ? "Estoque Lançado" : "Estoque Estornado",
        className: "bg-green-600 text-white",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível executar a ação de estoque.",
        variant: "destructive",
      });
    },
  });

  const handleStockAction = (id: string, action: "post" | "reverse") => {
    stockActionMutation.mutate({ id, action });
  };

  // --- AÇÕES DE CONTAS A RECEBER MANUAL ---
  const accountsActionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "post" | "reverse" }) => {
      const endpoint = action === "post" ? `/api/orders/${id}/post-accounts` : `/api/orders/${id}/reverse-accounts`;
      await apiRequest("POST", endpoint, {});
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      refetchOrders();
      toast({
        title: variables.action === "post" ? "Contas Lançadas" : "Contas Estornadas",
        className: "bg-green-600 text-white",
      });
    },
    onError: (error: any) => {
      let desc = error.message || "Não foi possível executar a ação de contas.";
      const errorMsg = error.message || "";
      const match = errorMsg.match(/\d+:\s*(.+)/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.message) desc = parsed.message;
        } catch {
          desc = match[1];
        }
      }
      toast({
        title: "Erro",
        description: desc,
        variant: "destructive",
      });
    },
  });

  const handleAccountsAction = (id: string, action: "post" | "reverse") => {
    accountsActionMutation.mutate({ id, action });
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    const promises = selectedIds.map((id) =>
      apiRequest("PATCH", `/api/orders/${id}`, { status: newStatus }),
    );
    await Promise.all(promises);

    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/products"] }); // <--- IMPORTANTE
    refetchOrders();
    setSelectedIds([]);
    toast({
      title: `Status alterado para ${newStatus}`,
      description: `${selectedIds.length} pedidos atualizados.`,
    });
  };

  // --- EXCLUSÃO EM MASSA ---
  const handleBulkDeleteClick = () => {
    if (selectedIds.length === 0) return;

    // Conta quantos pedidos selecionados têm estoque lançado
    const selectedOrders = (ordersData || []).filter((o: any) =>
      selectedIds.includes(String(o.id)),
    );
    const withStock = selectedOrders.filter((o: any) => o.stockPosted).length;
    setOrdersWithStock(withStock);
    setReverseStock(true); // reset default
    setIsDeleteModalOpen(true);
  };

  const handleBulkDelete = async () => {
    setIsDeleteModalOpen(false);

    try {
      const ids = selectedIds
        .map((i) => {
          const n = parseInt(i);
          return Number.isFinite(n) ? n : NaN;
        })
        .filter((n) => Number.isInteger(n) && !Number.isNaN(n));

      if (ids.length === 0) {
        toast({
          title: "Nenhum ID válido selecionado",
          variant: "destructive",
        });
        return;
      }

      // Use fetch diretamente para ter controle total da resposta
      const res = await fetch("/api/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids, reverseStock }),
      });

      // Lê o body uma única vez
      let body: any = null;
      try {
        body = await res.json();
      } catch (e) {
        body = null;
      }

      // Se não autenticado, mostra erro específico
      if (res.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente para continuar.",
          variant: "destructive",
        });
        return;
      }

      // Se outro erro, mostra mensagem
      if (!res.ok) {
        toast({
          title: "Erro ao excluir pedidos",
          description: body?.message || `Erro ${res.status}`,
          variant: "destructive",
        });
        return;
      }

      if (body && Array.isArray(body.processed) && body.processed.length > 0) {
        // atualiza cache do react-query removendo os pedidos processados
        queryClient.setQueryData(["/api/orders"], (old: any) => {
          if (!old) return old;
          return (old as any[]).filter((o: any) => {
            const oid = typeof o.id === "string" ? parseInt(o.id) : o.id;
            return !body.processed.includes(oid);
          });
        });
      } else {
        // fallback: invalidar cache e refetch
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      refetchOrders();
      setSelectedIds([]);
      // mensagem detalhada com contagem de processados/ignorados
      const processedCount = Array.isArray(body?.processed)
        ? body.processed.length
        : 0;
      const ignoredCount = Array.isArray(body?.ignored)
        ? body.ignored.length
        : 0;
      const title =
        processedCount > 0
          ? "Pedidos excluídos com sucesso"
          : "Nenhum pedido excluído";
      const description =
        processedCount > 0
          ? `${processedCount} excluído(s)${ignoredCount > 0 ? `, ${ignoredCount} ignorado(s)` : ""}`
          : ignoredCount > 0
            ? `${ignoredCount} ignorado(s)`
            : undefined;

      toast({
        title,
        description,
        className:
          processedCount > 0
            ? "bg-green-600 text-white"
            : "bg-yellow-600 text-white",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao excluir pedidos",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // --- FILTROS E OUTROS ---
  const filteredCustomers =
    customerSearch.length >= 2
      ? customersList
          .filter((c) => {
            const search = customerSearch.toLowerCase();
            return (
              (c.nome || c.firstName || "").toLowerCase().includes(search) ||
              (c.email || "").toLowerCase().includes(search) ||
              (c.cpf || "").includes(search) ||
              (c.cnpj || "").includes(search) ||
              (c.razaoSocial || "").toLowerCase().includes(search)
            );
          })
          .slice(0, 15)
      : [];

  const filteredProducts =
    productSearch.length >= 1
      ? productsData
          .filter((p) => {
            const search = productSearch.toLowerCase();
            return (
              p.name.toLowerCase().includes(search) ||
              p.sku.toLowerCase().includes(search)
            );
          })
          .slice(0, 50)
      : [];

  const handleAddProduct = (product: any) => {
    const existing = cartItems.find((item) => item.productId === product.id);
    if (existing) {
      toast({ title: "Produto já na lista", variant: "destructive" });
      return;
    }
    const price = parseFloat(product.price || "0");
    const newItem: CartItem = {
      productId: product.id,
      product: product,
      quantity: 1,
      unitPrice: price,
      discountPercent: 0,
      total: price,
    };
    setCartItems([...cartItems, newItem]);
    setProductSearch("");
  };

  const updateCartItem = (id: number, field: keyof CartItem, value: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === id) {
          const updated = { ...item, [field]: value };
          const discountValue =
            updated.unitPrice * (updated.discountPercent / 100);
          updated.total =
            (updated.unitPrice - discountValue) * updated.quantity;
          return updated;
        }
        return item;
      }),
    );
  };

  const removeCartItem = (id: number) => {
    setCartItems(cartItems.filter((i) => i.productId !== id));
  };

  const totalItemsValue = cartItems.reduce((acc, i) => acc + i.total, 0);
  const totalOrderValue =
    totalItemsValue - globalDiscount + shippingCost + otherExpenses;

  const generateInstallments = () => {
    if (!paymentCondition || totalOrderValue <= 0) {
      toast({
        title: "Defina a condição e adicione itens",
        variant: "destructive",
      });
      return;
    }
    const daysArray = paymentCondition
      .trim()
      .split(/\s+/)
      .map((d) => parseInt(d))
      .filter((n) => !isNaN(n) && n > 0);
    if (daysArray.length === 0) {
      setInstallments([
        {
          number: 1,
          days: 0,
          date: format(new Date(), "dd/MM/yyyy"),
          value: totalOrderValue,
          method: paymentMethod,
          obs: "",
        },
      ]);
      return;
    }
    const valuePerInst = totalOrderValue / daysArray.length;
    const newInsts = daysArray.map((days, idx) => ({
      number: idx + 1,
      days: days,
      date: format(addDays(new Date(), days), "dd/MM/yyyy"),
      value: parseFloat(valuePerInst.toFixed(2)),
      method: paymentMethod,
      obs: "",
    }));
    const sum = newInsts.reduce((a, b) => a + b.value, 0);
    const diff = totalOrderValue - sum;
    if (diff !== 0) newInsts[newInsts.length - 1].value += diff;
    setInstallments(newInsts);
  };

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/orders", data);
    },
    onSuccess: async () => {
      setIsCreateOpen(false);
      setCartItems([]);
      setSelectedCustomer(null);
      setSelectedCustomerId("");
      setCustomerSearch("");
      setInstallments([]);
      setPaymentCondition("");
      setProductSearch("");
      setNotes("");
      setInternalNotes("");
      await queryClient.resetQueries({ queryKey: ["/api/orders"] });
      await refetchOrders();
      toast({
        title: "Pedido Salvo com Sucesso!",
        className: "bg-green-600 text-white",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!selectedCustomerId) {
      toast({ title: "Selecione o Cliente", variant: "destructive" });
      return;
    }
    if (cartItems.length === 0) {
      toast({ title: "Adicione itens ao pedido", variant: "destructive" });
      return;
    }

    // Observações são apenas o que o vendedor digitou - sem dados internos
    const payload = {
      userId: selectedCustomerId,
      items: cartItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        price: (i.total / i.quantity).toFixed(2),
      })),
      shippingCost: shippingCost.toString(),
      total: totalOrderValue.toString(),
      notes: notes.trim() || null, // Apenas as observações do vendedor
      paymentNotes: paymentCondition.trim() || null, // Condição de pagamento (ex: "30 60 90 120")
      status: "ORCAMENTO",
    };
    createOrderMutation.mutate(payload);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 relative">
      {/* Modal de confirmação de exclusão em massa */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Você está prestes a excluir{" "}
                  <strong>{selectedIds.length} pedido(s)</strong>. Esta ação não
                  pode ser desfeita.
                </p>

                {ordersWithStock > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <p className="text-amber-800 dark:text-amber-200 font-medium mb-3">
                      ⚠️ {ordersWithStock} pedido(s) selecionado(s) possuem
                      estoque já lançado.
                    </p>
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="reverseStock"
                        checked={reverseStock}
                        onCheckedChange={(checked) =>
                          setReverseStock(checked === true)
                        }
                      />
                      <label
                        htmlFor="reverseStock"
                        className="text-sm text-amber-700 dark:text-amber-300 cursor-pointer select-none"
                      >
                        <strong>Estornar estoque</strong> - devolver as
                        quantidades aos produtos
                      </label>
                    </div>
                    {!reverseStock && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 ml-6">
                        Os pedidos serão excluídos mas o estoque{" "}
                        <strong>não</strong> será devolvido.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir {selectedIds.length} pedido(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Pedidos de Venda
          </h1>
          <p className="text-muted-foreground">Gerencie vendas e orçamentos.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              queryClient.resetQueries({ queryKey: ["/api/orders"] });
              refetchOrders();
            }}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoadingOrders ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="mr-2 h-4 w-4" /> Incluir Pedido
          </Button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border shadow-xl rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
          <span className="font-semibold text-sm">
            {selectedIds.length} selecionado(s)
          </span>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkStatusChange("PEDIDO_GERADO")}
              className="hover:bg-green-500/10 hover:text-green-600"
            >
              Virar Venda
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkStatusChange("FATURADO")}
              className="hover:bg-blue-500/10 hover:text-blue-600"
            >
              Faturar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkStatusChange("CANCELADO")}
              className="hover:bg-red-500/10 hover:text-red-600"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDeleteClick}
              className="ml-2"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
            <Separator orientation="vertical" className="h-4 mx-2" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="ORCAMENTO">Orçamentos</TabsTrigger>
          <TabsTrigger value="PEDIDO_GERADO">Vendas</TabsTrigger>
          <TabsTrigger value="FATURADO">Faturados</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          {isLoadingOrders ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
            </div>
          ) : (
            <OrderTable
              key={activeTab}
              orders={mappedOrders}
              showCustomer={true}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onPrintOrder={() => {}}
              onStatusChange={handleSingleStatusChange}
              onStockAction={handleStockAction}
              onAccountsAction={handleAccountsAction}
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-[100vw] h-[100vh] p-0 rounded-none bg-background flex flex-col border-none">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-card shadow-sm h-14 shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">Novo Pedido</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  Rascunho
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="h-8"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                className="bg-green-600 hover:bg-green-700 h-8 px-6 font-semibold"
              >
                {createOrderMutation.isPending ? (
                  <Loader2 className="animate-spin h-3 w-3" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 bg-muted/10">
            <div className="p-4 max-w-[1600px] mx-auto space-y-4">
              <Card className="border-l-2 border-l-orange-500 shadow-sm">
                <CardHeader className="py-2 px-4 border-b bg-muted/20">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-600">
                    <UserIcon className="h-4 w-4" /> Dados Gerais
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3 px-4 grid grid-cols-12 gap-3">
                  <div className="col-span-12 md:col-span-6 relative">
                    <Label className="text-xs text-muted-foreground">
                      Cliente *
                    </Label>
                    {selectedCustomer ? (
                      <div className="relative mt-1">
                        <Input
                          readOnly
                          value={`${selectedCustomer.nome || selectedCustomer.firstName} (${selectedCustomer.email})`}
                          className="h-8 text-sm font-bold bg-background pr-8 border-input text-foreground"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 absolute right-0 top-0 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setSelectedCustomerId("");
                            setCustomerSearch("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="relative mt-1">
                        <Input
                          placeholder="Buscar cliente (Min 2 letras)..."
                          className="pl-8 h-8 text-sm"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                        />
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        {customerSearch.length >= 2 &&
                          filteredCustomers.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-xl max-h-60 overflow-y-auto p-1">
                              {filteredCustomers.map((c) => (
                                <div
                                  key={c.id}
                                  className="px-3 py-2 hover:bg-accent cursor-pointer rounded-sm text-sm border-b last:border-0"
                                  onClick={() => {
                                    setSelectedCustomer(c);
                                    setSelectedCustomerId(c.id);
                                    setCustomerSearch("");
                                  }}
                                >
                                  <div className="font-bold">
                                    {c.nome || c.firstName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {c.razaoSocial ? `${c.razaoSocial} | ` : ""}
                                    {c.cnpj || c.cpf || c.email}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    <Label className="text-xs text-muted-foreground">
                      Vendedor
                    </Label>
                    <Select
                      value={selectedSellerId}
                      onValueChange={setSelectedSellerId}
                    >
                      <SelectTrigger className="mt-1 h-8 text-sm">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sellersList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nome || s.firstName || s.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">
                      Data Emissão
                    </Label>
                    <Input
                      type="date"
                      className="mt-1 h-8 text-sm"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="py-2 px-4 border-b bg-muted/20 flex flex-row items-center justify-between h-12">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-600">
                    <ShoppingCart className="h-4 w-4" /> Itens
                  </CardTitle>
                  <div className="relative w-96">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Adicionar produto (Nome/SKU)..."
                      className="pl-8 h-8 text-sm bg-background"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                    {productSearch && filteredProducts.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-xl max-h-60 overflow-y-auto right-0 p-1">
                        {filteredProducts.map((p) => (
                          <div
                            key={p.id}
                            className="px-3 py-2 hover:bg-accent cursor-pointer rounded-sm text-sm flex justify-between items-center border-b last:border-0"
                            onClick={() => handleAddProduct(p)}
                          >
                            <div>
                              <span className="font-medium">{p.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                SKU: {p.sku}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-600 text-xs">
                                R$ {p.price}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                Est: {p.stock}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 h-8 hover:bg-muted/10">
                        <TableHead className="h-8 w-[35%] pl-4 text-xs">
                          Descrição
                        </TableHead>
                        <TableHead className="h-8 w-[8%] text-center text-xs">
                          Un
                        </TableHead>
                        <TableHead className="h-8 w-[10%] text-center text-xs">
                          Qtd
                        </TableHead>
                        <TableHead className="h-8 w-[12%] text-right text-xs">
                          Preço Un
                        </TableHead>
                        <TableHead className="h-8 w-[10%] text-center text-xs">
                          Desc %
                        </TableHead>
                        <TableHead className="h-8 w-[8%] text-center text-xs">
                          Estoque
                        </TableHead>
                        <TableHead className="h-8 w-[12%] text-right pr-4 text-xs">
                          Total
                        </TableHead>
                        <TableHead className="h-8 w-[5%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cartItems.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="h-20 text-center text-xs text-muted-foreground"
                          >
                            Nenhum item inserido
                          </TableCell>
                        </TableRow>
                      ) : (
                        cartItems.map((item, idx) => {
                          const finalStock =
                            (item.product.stock || 0) - item.quantity;
                          const hasStock = finalStock >= 0;
                          return (
                            <TableRow
                              key={item.productId}
                              className="h-9 hover:bg-muted/5 border-b border-muted/50"
                            >
                              <TableCell className="pl-4 py-1">
                                <div className="text-sm font-medium">
                                  {item.product.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {item.product.sku}
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-xs py-1">
                                {item.product.unit || "UN"}
                              </TableCell>
                              <TableCell className="py-1">
                                <Input
                                  type="number"
                                  className="h-7 text-center text-sm px-1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateCartItem(
                                      item.productId,
                                      "quantity",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="py-1">
                                <Input
                                  type="number"
                                  className="h-7 text-right text-sm px-1"
                                  value={item.unitPrice}
                                  onChange={(e) =>
                                    updateCartItem(
                                      item.productId,
                                      "unitPrice",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="py-1">
                                <Input
                                  type="number"
                                  className="h-7 text-center text-sm px-1 text-blue-500"
                                  value={item.discountPercent}
                                  onChange={(e) =>
                                    updateCartItem(
                                      item.productId,
                                      "discountPercent",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-center py-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`h-6 w-full rounded flex items-center justify-center text-xs font-bold cursor-help ${hasStock ? "bg-green-500/20 text-green-700 border border-green-500/30" : "bg-red-500/20 text-red-700 border border-red-500/30"}`}
                                      >
                                        <Box className="h-3 w-3 mr-1" />
                                        {finalStock}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Atual: {item.product.stock || 0}</p>
                                      <p>Pedido: -{item.quantity}</p>
                                      <Separator className="my-1" />
                                      <p
                                        className={
                                          hasStock
                                            ? "text-green-500"
                                            : "text-red-500"
                                        }
                                      >
                                        Saldo: {finalStock}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="text-right pr-4 py-1 font-bold text-sm">
                                {item.total.toFixed(2)}
                              </TableCell>
                              <TableCell className="py-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeCartItem(item.productId)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <Card className="shadow-sm">
                    <CardHeader className="py-2 px-3 border-b bg-muted/20">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                        Financeiro e Transporte
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-3">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] flex items-center gap-1">
                            Condição de pagamento
                            <span className="text-muted-foreground">(i)</span>
                          </Label>
                          <Input
                            className="h-7 text-xs"
                            placeholder="Ex: 30 60 90"
                            value={paymentCondition}
                            onChange={(e) =>
                              setPaymentCondition(e.target.value)
                            }
                          />
                        </div>
                        <Button
                          variant="outline"
                          className="h-7 text-xs border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                          onClick={generateInstallments}
                        >
                          Gerar
                        </Button>
                      </div>
                      {installments.length > 0 && (
                        <div className="border rounded-md overflow-hidden">
                          {/* Header da tabela estilo Bling */}
                          <div className="grid grid-cols-[60px_1fr_1fr_1fr_80px] gap-1 bg-muted/40 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground border-b">
                            <span>Dias</span>
                            <span>Data</span>
                            <span>Valor</span>
                            <span>Forma</span>
                            <span>Obs</span>
                          </div>
                          {/* Linhas das parcelas */}
                          {installments.map((inst, i) => (
                            <div
                              key={i}
                              className="grid grid-cols-[60px_1fr_1fr_1fr_80px] gap-1 items-center px-2 py-1 border-b last:border-b-0 hover:bg-muted/20"
                            >
                              <div className="flex items-center gap-1">
                                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] flex items-center justify-center font-medium">
                                  {i + 1}
                                </span>
                                <span className="text-xs">{inst.days}</span>
                              </div>
                              <Input
                                type="date"
                                className="h-6 text-xs px-1"
                                value={inst.date.split("/").reverse().join("-")}
                                onChange={(e) => {
                                  const [y, m, d] = e.target.value
                                    .split("-")
                                    .map(Number);
                                  const n = [...installments];
                                  n[i].date = format(
                                    new Date(y, m - 1, d),
                                    "dd/MM/yyyy",
                                  );
                                  setInstallments(n);
                                }}
                              />
                              <Input
                                className="h-6 text-xs px-1"
                                value={inst.value.toFixed(2)}
                                readOnly
                              />
                              <Select
                                value={inst.method}
                                onValueChange={(v) => {
                                  const n = [...installments];
                                  n[i].method = v;
                                  setInstallments(n);
                                }}
                              >
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Boleto">Boleto</SelectItem>
                                  <SelectItem value="Pix">Pix</SelectItem>
                                  <SelectItem value="Cartão">Cartão</SelectItem>
                                  <SelectItem value="Depósito">
                                    Depósito
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                className="h-6 text-xs px-1"
                                placeholder=""
                                value={inst.obs}
                                onChange={(e) => {
                                  const n = [...installments];
                                  n[i].obs = e.target.value;
                                  setInstallments(n);
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      <Separator className="my-1" />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Transportadora</Label>
                          <Input
                            className="h-7 text-xs"
                            value={carrierName}
                            onChange={(e) => setCarrierName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Tipo Frete</Label>
                          <Select
                            value={shippingType}
                            onValueChange={setShippingType}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CIF">
                                CIF (Emitente)
                              </SelectItem>
                              <SelectItem value="FOB">
                                FOB (Destinatário)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <Card className="bg-muted/10 border-none shadow-none h-full">
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs">
                          Total Itens
                        </span>
                        <span className="font-medium bg-background px-2 py-1 rounded border min-w-[80px] text-right">
                          {totalItemsValue.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs">
                          Desconto (R$)
                        </span>
                        <Input
                          type="number"
                          className="h-7 w-[80px] text-right text-xs text-red-500"
                          value={globalDiscount}
                          onChange={(e) =>
                            setGlobalDiscount(parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs">
                          Frete (R$)
                        </span>
                        <Input
                          type="number"
                          className="h-7 w-[80px] text-right text-xs"
                          value={shippingCost}
                          onChange={(e) =>
                            setShippingCost(parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs">
                          Outras Desp.
                        </span>
                        <Input
                          type="number"
                          className="h-7 w-[80px] text-right text-xs"
                          value={otherExpenses}
                          onChange={(e) =>
                            setOtherExpenses(parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>
                    <Separator className="bg-muted-foreground/20" />
                    <div className="flex justify-between items-end pt-2">
                      <div className="text-right w-full">
                        <div className="text-xs text-muted-foreground mb-1">
                          TOTAL LÍQUIDO
                        </div>
                        <div className="text-3xl font-bold text-green-500">
                          R$ {totalOrderValue.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-sm">
                <CardHeader className="py-2 px-4 border-b bg-muted/20">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                    Observações
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <Textarea
                    placeholder="Observações impressas no pedido..."
                    className="h-16 text-xs resize-none bg-background"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
