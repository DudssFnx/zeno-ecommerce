import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { Order, OrderItem, b2bUsers } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { type InferSelectModel } from "drizzle-orm";
import {
  AlertTriangle,
  Box,
  DollarSign,
  Loader2,
  Pencil,
  Search,
  ShoppingCart,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";

type User = InferSelectModel<typeof b2bUsers>;

interface ProductInfo {
  id: number;
  name: string;
  sku: string;
  image: string | null;
  price: string;
  stock?: number;
  unit?: string;
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
  nome?: string;
  razaoSocial?: string;
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
  stockPosted?: boolean;
  accountsPosted?: boolean;
  accountsPostedAt?: string;
  accountsPostedBy?: string;
  seller?: User | null;
}

interface CartItem {
  productId: number;
  product: ProductInfo;
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

const statusLabels: Record<string, string> = {
  ORCAMENTO: "Orçamento",
  ORCAMENTO_ABERTO: "Orçamento Aberto",
  ORCAMENTO_CONCLUIDO: "Orçamento Enviado",
  PEDIDO_GERADO: "Pedido Gerado",
  FATURADO: "Faturado",
  PEDIDO_FATURADO: "Faturado",
  PEDIDO_CANCELADO: "Cancelado",
  CANCELADO: "Cancelado",
  pending: "Pendente",
  approved: "Aprovado",
  processing: "Processando",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const statusVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ORCAMENTO: "secondary",
  ORCAMENTO_ABERTO: "secondary",
  ORCAMENTO_CONCLUIDO: "outline",
  CANCELADO: "destructive",
  PEDIDO_GERADO: "default",
  FATURADO: "default",
  PEDIDO_FATURADO: "default",
  PEDIDO_CANCELADO: "destructive",
  pending: "secondary",
  approved: "default",
  processing: "default",
  completed: "default",
  cancelled: "destructive",
};

// Função para limpar dados internos do campo notes (para pedidos antigos)
function cleanInternalData(notes: string | null): string {
  if (!notes) return "";
  // Remove o bloco [INTERNAL_DATA]...[/INTERNAL_DATA]
  const cleanedNotes = notes
    .replace(/\[INTERNAL_DATA\][\s\S]*?\[\/INTERNAL_DATA\]/g, "")
    .trim();
  return cleanedNotes;
}

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const { isAdmin, isSales } = useAuth();
  const { toast } = useToast();
  const canEditStatus = isAdmin || isSales;

  const [isEditMode, setIsEditMode] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Form states mirroring creation form
  const [saleDate, setSaleDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [paymentCondition, setPaymentCondition] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [carrierName, setCarrierName] = useState("");
  const [shippingType, setShippingType] = useState("CIF");
  const [shippingCost, setShippingCost] = useState(0);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [otherExpenses, setOtherExpenses] = useState(0);
  const [notes, setNotes] = useState("");
  const [selectedPaymentTypeId, setSelectedPaymentTypeId] = useState<
    number | null
  >(null);

  const {
    data: orderData,
    isLoading,
    refetch: refetchOrder,
  } = useQuery<OrderWithDetails>({
    queryKey: ["/api/orders", orderId],
    enabled: !!orderId,
    staleTime: 0, // Sempre buscar dados frescos para este pedido
  });

  const { data: productsData } = useQuery<{
    products: ProductInfo[];
  }>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products?limit=1000", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const { data: paymentTypesData } = useQuery<
    {
      id: number;
      name: string;
      paymentTermType: string;
      paymentTermId: number | null;
      active: boolean;
    }[]
  >({
    queryKey: ["/api/payment-types"],
    queryFn: async () => {
      const res = await fetch("/api/payment-types", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payment types");
      return res.json();
    },
  });

  const activePaymentTypes = (paymentTypesData || []).filter((pt) => pt.active);

  // Buscar condições de prazo para mostrar parcelas
  const { data: paymentTermsData } = useQuery<
    {
      id: number;
      name: string;
      installmentCount: number;
      firstPaymentDays: number;
      intervalDays: number;
    }[]
  >({
    queryKey: ["/api/payment-terms"],
    queryFn: async () => {
      const res = await fetch("/api/payment-terms", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payment terms");
      return res.json();
    },
  });

  const { data: sellersData } = useQuery<User[]>({
    queryKey: ["/api/sellers"],
    queryFn: async () => {
      const res = await fetch("/api/sellers", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sellers");
      return res.json();
    },
  });

  const sellersList = sellersData || [];

  // Initialize form from order data
  useEffect(() => {
    if (orderData) {
      // Initialize cart items from order
      const items: CartItem[] = orderData.items
        .filter((item) => item.productId !== null)
        .map((item) => {
          const originalPrice = parseFloat(item.product?.price || item.price);
          const itemPrice = parseFloat(item.price);
          const discountPercent =
            originalPrice > 0
              ? Math.round((1 - itemPrice / originalPrice) * 100 * 100) / 100
              : 0;

          return {
            productId: item.productId!,
            product: {
              ...item.product,
              stock: item.product?.stock || 0,
              unit: item.product?.unit || "UN",
            },
            quantity: item.quantity,
            unitPrice: itemPrice,
            discountPercent: discountPercent >= 0 ? discountPercent : 0,
            total: itemPrice * item.quantity,
          };
        });
      setCartItems(items);

      // Initialize other fields - usar createdAt já que saleDate não existe
      if (orderData.createdAt) {
        setSaleDate(format(new Date(orderData.createdAt), "yyyy-MM-dd"));
      }
      // Limpar dados internos das observações (para pedidos antigos)
      setNotes(cleanInternalData(orderData.notes));
      setShippingCost(parseFloat(orderData.shippingCost || "0"));
      setPaymentMethod(orderData.paymentMethod || "");
      setSelectedPaymentTypeId(orderData.paymentTypeId || null);
      // Carregar vendedor do pedido (invoicedBy)
      setSelectedSellerId(orderData.invoicedBy || "");
      // Carregar condição de pagamento (ex: "30 60 90 120")
      // Só atualiza se tiver valor no banco OU se ainda não tiver valor local
      const savedCondition = orderData.paymentNotes || "";
      if (savedCondition || !paymentCondition) {
        setPaymentCondition(savedCondition);
      }

      // Gerar parcelas automaticamente se tiver condição de pagamento salva
      if (savedCondition) {
        const days = savedCondition
          .trim()
          .split(/\s+/)
          .map(Number)
          .filter((n) => !isNaN(n) && n > 0);
        if (days.length > 0) {
          const orderTotal = parseFloat(orderData.total || "0");
          const installmentValue = orderTotal / days.length;
          const baseDate = orderData.createdAt
            ? new Date(orderData.createdAt)
            : new Date();
          const newInstallments: Installment[] = days.map((d, i) => ({
            number: i + 1,
            days: d,
            date: format(addDays(baseDate, d), "dd/MM/yyyy"),
            value: installmentValue,
            method: orderData.paymentMethod || "Boleto",
            obs: "",
          }));
          setInstallments(newInstallments);
        }
      }
      // Não existe campo discount global no schema
      setGlobalDiscount(0);
    }
  }, [orderData]);

  // Calculations
  const totalItemsValue = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.total, 0);
  }, [cartItems]);

  const totalOrderValue = useMemo(() => {
    return totalItemsValue - globalDiscount + shippingCost + otherExpenses;
  }, [totalItemsValue, globalDiscount, shippingCost, otherExpenses]);

  const filteredProducts = useMemo(() => {
    if (!productsData?.products || !productSearch.trim()) return [];
    const search = productSearch.toLowerCase();
    return productsData.products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.sku.toLowerCase().includes(search),
      )
      .slice(0, 10);
  }, [productsData?.products, productSearch]);

  // Cart operations
  const handleAddProduct = (product: ProductInfo) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                total: i.unitPrice * (i.quantity + 1),
              }
            : i,
        );
      }
      const price = parseFloat(product.price);
      return [
        ...prev,
        {
          productId: product.id,
          product,
          quantity: 1,
          unitPrice: price,
          discountPercent: 0,
          total: price,
        },
      ];
    });
    setProductSearch("");
  };

  const updateCartItem = (
    productId: number,
    field: "quantity" | "unitPrice" | "discountPercent",
    value: number,
  ) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const updated = { ...item, [field]: value };

        if (field === "discountPercent") {
          const originalPrice = parseFloat(item.product.price);
          updated.unitPrice = originalPrice * (1 - value / 100);
        }

        updated.total = updated.unitPrice * updated.quantity;
        return updated;
      }),
    );
  };

  const removeCartItem = (productId: number) => {
    setCartItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  // Generate installments
  const generateInstallments = () => {
    if (!paymentCondition.trim()) return;
    const days = paymentCondition
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
    if (days.length === 0) return;

    const installmentValue = totalOrderValue / days.length;
    const newInstallments: Installment[] = days.map((d, i) => ({
      number: i + 1,
      days: d,
      date: format(addDays(new Date(), d), "dd/MM/yyyy"),
      value: installmentValue,
      method: "Boleto",
      obs: "",
    }));
    setInstallments(newInstallments);
  };

  // Mutations
  const updateOrderMutation = useMutation({
    mutationFn: async (data: {
      items: { productId: number; quantity: number; price: string }[];
      notes?: string;
      shippingCost?: string;
      discount?: string;
      sellerId?: string;
      saleDate?: string;
      paymentMethod?: string;
      paymentTypeId?: number | null;
      paymentNotes?: string;
    }) => {
      // Try to update items (may fail if stock is reserved)
      try {
        await apiRequest("PUT", `/api/orders/${orderId}/items`, {
          items: data.items,
        });
      } catch (e) {
        // Ignore item update error if stock is reserved - we'll still update other fields
        console.log("Could not update items (stock may be reserved):", e);
      }

      // Always update other fields
      await apiRequest("PATCH", `/api/orders/${orderId}`, {
        notes: data.notes,
        shippingCost: data.shippingCost,
        discount: data.discount,
        sellerId: data.sellerId,
        saleDate: data.saleDate,
        paymentMethod: data.paymentMethod,
        paymentTypeId: data.paymentTypeId,
        paymentNotes: data.paymentNotes,
      });
    },
    onSuccess: async () => {
      // Invalidar cache
      queryClient.invalidateQueries({
        queryKey: ["/api/orders", orderId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      // Forçar refetch usando a função do hook
      await refetchOrder();
      // Pequeno delay para garantir que o React processe os novos dados
      await new Promise((resolve) => setTimeout(resolve, 100));
      setIsEditMode(false);
      toast({
        title: "Pedido Atualizado",
        description: "O pedido foi atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o pedido.",
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
      let desc =
        "Não foi possível reservar o estoque. Verifique se há estoque disponível.";
      const errorMsg = err.message || "";
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
      toast({
        title: "Erro",
        description: err.message || "Não foi possível faturar o pedido.",
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
      toast({
        title: "Erro",
        description: err.message || "Não foi possível retornar o pedido.",
        variant: "destructive",
      });
    },
  });

  const unfaturarMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/orders/${orderId}/unfaturar`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Sucesso",
        description: "Pedido retornado para Pedido Gerado. Estoque restaurado.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro",
        description: err.message || "Não foi possível retornar o pedido.",
        variant: "destructive",
      });
    },
  });

  // Mutations para lançar/estornar contas a receber
  const postAccountsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/orders/${orderId}/post-accounts`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      toast({
        title: "Sucesso",
        description: "Contas a receber lançadas com sucesso.",
      });
    },
    onError: (err: Error) => {
      let desc = "Não foi possível lançar as contas a receber.";
      const errorMsg = (err as any).message || "";
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

  const handlePostAccounts = async () => {
    // Cliente: valida se existe forma de pagamento e se é do tipo PRAZO antes de chamar a API
    if (!orderData.paymentTypeId) {
      toast({
        title: "Forma de pagamento não selecionada",
        description:
          "Defina a forma de pagamento do pedido para poder lançar contas a receber.",
        variant: "destructive",
      });
      return;
    }
    const pt = (paymentTypesData || []).find(
      (p) => p.id === orderData.paymentTypeId,
    );
    if (!pt) {
      toast({ title: "Forma de pagamento inválida", variant: "destructive" });
      return;
    }
    if (pt.paymentTermType !== "PRAZO") {
      toast({
        title: "Forma de pagamento inválida",
        description: `A forma de pagamento "${pt.name}" não é do tipo A PRAZO. Selecione uma forma de pagamento do tipo A PRAZO.`,
        variant: "destructive",
      });
      return;
    }

    if (confirm("Lançar contas a receber para este pedido?")) {
      postAccountsMutation.mutate();
    }
  };

  const reverseAccountsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/orders/${orderId}/reverse-accounts`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      toast({
        title: "Sucesso",
        description: "Contas a receber estornadas com sucesso.",
      });
    },
    onError: (err: Error) => {
      let desc = "Não foi possível estornar as contas a receber.";
      const errorMsg = (err as any).message || "";
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

  const printMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/orders/${orderId}/print`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      window.print();
      toast({
        title: "Pedido Impresso",
        description: "O pedido foi marcado como impresso.",
      });
    },
  });

  const handleSave = () => {
    if (cartItems.length === 0) {
      toast({
        title: "Erro",
        description: "O pedido deve ter pelo menos um item.",
        variant: "destructive",
      });
      return;
    }

    const items = cartItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.unitPrice.toFixed(2),
    }));

    // Buscar nome da forma de pagamento pelo ID
    const selectedPt = activePaymentTypes.find(
      (pt) => pt.id === selectedPaymentTypeId,
    );
    const paymentMethodName = selectedPt?.name || paymentMethod;

    console.log(
      "[DEBUG] Saving with paymentTypeId:",
      selectedPaymentTypeId,
      "paymentMethod:",
      paymentMethodName,
      "paymentNotes:",
      paymentCondition.trim(),
    );

    updateOrderMutation.mutate({
      items,
      notes,
      shippingCost: shippingCost.toFixed(2),
      discount: globalDiscount.toFixed(2),
      sellerId: selectedSellerId, // Enviar mesmo se vazio para permitir limpar
      saleDate,
      paymentMethod: paymentMethodName,
      paymentTypeId: selectedPaymentTypeId,
      paymentNotes: paymentCondition.trim(),
    });
  };

  const handleStatusChange = (newStatus: string) => {
    const currentStatus = orderData?.status;

    if (newStatus === "PEDIDO_GERADO") {
      reserveStockMutation.mutate();
    } else if (newStatus === "FATURADO" || newStatus === "PEDIDO_FATURADO") {
      invoiceMutation.mutate();
    } else if (newStatus === "ORCAMENTO" && currentStatus === "PEDIDO_GERADO") {
      unreserveMutation.mutate();
    } else if (
      newStatus === "ORCAMENTO" &&
      (currentStatus === "FATURADO" || currentStatus === "PEDIDO_FATURADO")
    ) {
      toast({
        title: "Atenção",
        description:
          "Para retornar para Orçamento, primeiro retorne para Pedido Gerado.",
        variant: "destructive",
      });
    } else {
      updateStatusMutation.mutate(newStatus);
    }
  };

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
          <Button variant="ghost" size="sm">
            <X className="h-4 w-4 mr-2" />
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
  const isOrcamento =
    orderData.status === "ORCAMENTO" ||
    orderData.status === "ORCAMENTO_CONCLUIDO" ||
    orderData.status === "ORCAMENTO_ABERTO";
  const isFaturado =
    orderData.status === "PEDIDO_FATURADO" || orderData.status === "FATURADO";
  const isPedidoGerado = orderData.status === "PEDIDO_GERADO";
  const hasStockPosted = orderData.stockPosted === true;
  const hasAccountsPosted = orderData.accountsPosted === true;
  // Permite edição em orçamento ou em pedido gerado (não faturado)
  const canEdit = isOrcamento || isPedidoGerado;

  return (
    <div className="max-w-[100vw] min-h-[100vh] bg-background flex flex-col">
      {/* Header - igual ao de criação */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card shadow-sm h-14 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="ghost" size="sm">
              <X className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">
              Pedido {orderData.orderNumber}
            </span>
            <Badge variant={statusVariants[orderData.status || "ORCAMENTO"]}>
              {statusLabels[orderData.status || "ORCAMENTO"] ||
                orderData.status}
            </Badge>
            {orderData.printed && (
              <Badge variant="outline" className="text-xs">
                Impresso
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditMode ? (
            <>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditMode(true)}
                  className="h-8"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Editar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => printMutation.mutate()}
                className="h-8"
              >
                Imprimir
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditMode(false);
                  // Reset form to original data
                  if (orderData) {
                    const items: CartItem[] = orderData.items
                      .filter((item) => item.productId !== null)
                      .map((item) => {
                        const originalPrice = parseFloat(
                          item.product?.price || item.price,
                        );
                        const itemPrice = parseFloat(item.price);
                        const discountPercent =
                          originalPrice > 0
                            ? Math.round(
                                (1 - itemPrice / originalPrice) * 100 * 100,
                              ) / 100
                            : 0;
                        return {
                          productId: item.productId!,
                          product: { ...item.product, stock: 0, unit: "UN" },
                          quantity: item.quantity,
                          discountPercent:
                            discountPercent >= 0 ? discountPercent : 0,
                          unitPrice: itemPrice,
                          total: itemPrice * item.quantity,
                        };
                      });
                    setCartItems(items);
                  }
                }}
                className="h-8"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                className="bg-green-600 hover:bg-green-700 h-8 px-6 font-semibold"
                disabled={updateOrderMutation.isPending}
              >
                {updateOrderMutation.isPending ? (
                  <Loader2 className="animate-spin h-3 w-3" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 bg-muted/10">
        <div className="p-4 max-w-[1600px] mx-auto space-y-4">
          {/* Alertas de status */}
          {isFaturado && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/50 bg-destructive/5">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive font-medium">
                Pedido faturado. Para editar, retorne para "Pedido Gerado".
              </p>
              {canEditStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto text-destructive border-destructive"
                  onClick={() => unfaturarMutation.mutate()}
                  disabled={unfaturarMutation.isPending}
                >
                  {unfaturarMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Retornar para Pedido Gerado
                </Button>
              )}
            </div>
          )}

          {isPedidoGerado && hasStockPosted && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/5">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                Estoque já reservado. Para editar, retorne para "Orçamento".
              </p>
              {canEditStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto text-yellow-600 border-yellow-500"
                  onClick={() => unreserveMutation.mutate()}
                  disabled={unreserveMutation.isPending}
                >
                  {unreserveMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Retornar para Orçamento
                </Button>
              )}
            </div>
          )}

          {/* Alerta de contas lançadas */}
          {hasAccountsPosted && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/50 bg-green-500/5">
              <DollarSign className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                  Contas a receber lançadas
                </p>
                {orderData.accountsPostedAt && (
                  <p className="text-xs text-green-600/70">
                    Em{" "}
                    {new Date(orderData.accountsPostedAt).toLocaleString(
                      "pt-BR",
                    )}
                    {orderData.accountsPostedBy &&
                      ` por ${orderData.accountsPostedBy}`}
                  </p>
                )}
              </div>
              {canEditStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto text-green-600 border-green-500"
                  onClick={() => reverseAccountsMutation.mutate()}
                  disabled={reverseAccountsMutation.isPending}
                >
                  {reverseAccountsMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Estornar Contas
                </Button>
              )}
            </div>
          )}

          {/* Dados Gerais - igual ao de criação */}
          <Card className="border-l-2 border-l-orange-500 shadow-sm">
            <CardHeader className="py-2 px-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-600">
                <UserIcon className="h-4 w-4" /> Dados Gerais
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3 px-4 grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6">
                <Label className="text-xs text-muted-foreground">Cliente</Label>
                <Input
                  readOnly
                  value={
                    customer?.nome ||
                    customer?.firstName ||
                    customer?.company ||
                    "Não informado"
                  }
                  className="mt-1 h-8 text-sm font-bold bg-muted/50"
                />
                {customer?.email && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {customer.email}
                  </p>
                )}
              </div>
              <div className="col-span-12 md:col-span-4">
                <Label className="text-xs text-muted-foreground">
                  Vendedor
                </Label>
                {isEditMode ? (
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
                          {s.firstName || s.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    readOnly
                    value={
                      orderData?.seller
                        ? orderData.seller.firstName ||
                          orderData.seller.email ||
                          "Vendedor"
                        : "Não informado"
                    }
                    className="mt-1 h-8 text-sm bg-muted/50"
                  />
                )}
              </div>
              <div className="col-span-6 md:col-span-2">
                <Label className="text-xs text-muted-foreground">
                  Data Emissão
                </Label>
                {isEditMode ? (
                  <Input
                    type="date"
                    className="mt-1 h-8 text-sm"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                  />
                ) : (
                  <Input
                    readOnly
                    value={
                      orderData.createdAt
                        ? format(new Date(orderData.createdAt), "dd/MM/yyyy")
                        : "-"
                    }
                    className="mt-1 h-8 text-sm bg-muted/50"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Itens - igual ao de criação */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-4 border-b bg-muted/20 flex flex-row items-center justify-between h-12">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-600">
                <ShoppingCart className="h-4 w-4" /> Itens
              </CardTitle>
              {isEditMode && (
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
                              Est: {p.stock || 0}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
                    {isEditMode && (
                      <TableHead className="h-8 w-[5%]"></TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cartItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isEditMode ? 8 : 7}
                        className="h-20 text-center text-xs text-muted-foreground"
                      >
                        Nenhum item inserido
                      </TableCell>
                    </TableRow>
                  ) : (
                    cartItems.map((item) => {
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
                            {isEditMode ? (
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
                            ) : (
                              <div className="text-center text-sm">
                                {item.quantity}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-1">
                            {isEditMode ? (
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
                            ) : (
                              <div className="text-right text-sm">
                                {item.unitPrice.toFixed(2)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-1">
                            {isEditMode ? (
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
                            ) : (
                              <div className="text-center text-sm text-blue-500">
                                {item.discountPercent > 0
                                  ? `${item.discountPercent.toFixed(1)}%`
                                  : "-"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`h-6 w-full rounded flex items-center justify-center text-xs font-bold cursor-help ${
                                      hasStock
                                        ? "bg-green-500/20 text-green-700 border border-green-500/30"
                                        : "bg-red-500/20 text-red-700 border border-red-500/30"
                                    }`}
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
                          {isEditMode && (
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
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Financeiro e Totais - igual ao de criação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader className="py-2 px-3 border-b bg-muted/20">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                    Financeiro e Transporte
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                  {isEditMode ? (
                    <>
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
                          <div className="grid grid-cols-[60px_1fr_1fr_80px] gap-1 bg-muted/40 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground border-b">
                            <span>Dias</span>
                            <span>Data</span>
                            <span>Valor</span>
                            <span>Obs</span>
                          </div>
                          {/* Linhas das parcelas */}
                          {installments.map((inst, i) => (
                            <div
                              key={i}
                              className="grid grid-cols-[60px_1fr_1fr_80px] gap-1 items-center px-2 py-1 border-b last:border-b-0 hover:bg-muted/20"
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
                              <Input
                                className="h-6 text-xs px-1"
                                placeholder={`${orderData?.orderNumber || ""}/${i + 1}`}
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
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Forma Pagamento</Label>
                          <Select
                            value={selectedPaymentTypeId?.toString() || ""}
                            onValueChange={(val) => {
                              const id = val ? parseInt(val) : null;
                              setSelectedPaymentTypeId(id);
                              // Também atualiza paymentMethod com o nome para manter compatibilidade
                              const pt = activePaymentTypes.find(
                                (p) => p.id === id,
                              );
                              setPaymentMethod(pt?.name || "");
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {activePaymentTypes.map((pt) => (
                                <SelectItem
                                  key={pt.id}
                                  value={pt.id.toString()}
                                >
                                  {pt.name}{" "}
                                  {pt.paymentTermType === "PRAZO"
                                    ? "(A Prazo)"
                                    : "(À Vista)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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
                    </>
                  ) : (
                    <div className="space-y-3 text-sm">
                      {/* Mostrar condição de pagamento - sempre usa o estado local que é sincronizado */}
                      {paymentCondition && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-[10px] flex items-center gap-1 text-muted-foreground">
                              Condição de pagamento
                              <span>(i)</span>
                            </Label>
                            <div className="h-7 text-xs bg-muted/30 border rounded px-2 flex items-center">
                              {paymentCondition}
                            </div>
                          </div>
                          {/* Mostrar parcelas baseadas na condição de pagamento */}
                          {(() => {
                            const days = paymentCondition
                              .trim()
                              .split(/\s+/)
                              .map(Number)
                              .filter((n) => !isNaN(n) && n > 0);
                            if (days.length === 0) return null;

                            const total = parseFloat(orderData.total || "0");
                            const installmentValue = total / days.length;
                            const baseDate = orderData.createdAt
                              ? new Date(orderData.createdAt)
                              : new Date();

                            return (
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
                                {days.map((d, i) => {
                                  const dueDate = new Date(baseDate);
                                  dueDate.setDate(dueDate.getDate() + d);
                                  return (
                                    <div
                                      key={i}
                                      className="grid grid-cols-[60px_1fr_1fr_1fr_80px] gap-1 items-center px-2 py-1.5 border-b last:border-b-0 text-xs"
                                    >
                                      <div className="flex items-center gap-1">
                                        <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] flex items-center justify-center font-medium">
                                          {i + 1}
                                        </span>
                                        <span>{d}</span>
                                      </div>
                                      <span>
                                        {dueDate.toLocaleDateString("pt-BR")}
                                      </span>
                                      <span>{installmentValue.toFixed(2)}</span>
                                      <span>
                                        {orderData.paymentMethod || "Boleto"}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {orderData.orderNumber}/{i + 1}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </>
                      )}
                      <Separator className="my-1" />
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Forma Pagamento
                          </Label>
                          <div className="h-7 text-xs bg-muted/30 border rounded px-2 flex items-center">
                            {(() => {
                              const pt = activePaymentTypes.find(
                                (p) => p.id === orderData.paymentTypeId,
                              );
                              if (pt) {
                                return `${pt.name} ${pt.paymentTermType === "PRAZO" ? "(A Prazo)" : "(À Vista)"}`;
                              }
                              return orderData.paymentMethod || "Não informado";
                            })()}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Transportadora
                          </Label>
                          <div className="h-7 text-xs bg-muted/30 border rounded px-2 flex items-center">
                            Não informado
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Tipo Frete
                          </Label>
                          <div className="h-7 text-xs bg-muted/30 border rounded px-2 flex items-center">
                            CIF (Emitente)
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
                    {isEditMode ? (
                      <Input
                        type="number"
                        className="h-7 w-[80px] text-right text-xs text-red-500"
                        value={globalDiscount}
                        onChange={(e) =>
                          setGlobalDiscount(parseFloat(e.target.value) || 0)
                        }
                      />
                    ) : (
                      <span className="font-medium bg-background px-2 py-1 rounded border min-w-[80px] text-right text-red-500">
                        {globalDiscount.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">
                      Frete (R$)
                    </span>
                    {isEditMode ? (
                      <Input
                        type="number"
                        className="h-7 w-[80px] text-right text-xs"
                        value={shippingCost}
                        onChange={(e) =>
                          setShippingCost(parseFloat(e.target.value) || 0)
                        }
                      />
                    ) : (
                      <span className="font-medium bg-background px-2 py-1 rounded border min-w-[80px] text-right">
                        {shippingCost.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">
                      Outras Desp.
                    </span>
                    {isEditMode ? (
                      <Input
                        type="number"
                        className="h-7 w-[80px] text-right text-xs"
                        value={otherExpenses}
                        onChange={(e) =>
                          setOtherExpenses(parseFloat(e.target.value) || 0)
                        }
                      />
                    ) : (
                      <span className="font-medium bg-background px-2 py-1 rounded border min-w-[80px] text-right">
                        {otherExpenses.toFixed(2)}
                      </span>
                    )}
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

          {/* Observações - igual ao de criação */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-4 border-b bg-muted/20">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Observações
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {isEditMode ? (
                <Textarea
                  placeholder="Observações impressas no pedido..."
                  className="h-16 text-xs resize-none bg-background"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              ) : (
                <p className="text-sm text-muted-foreground min-h-[4rem] whitespace-pre-wrap">
                  {cleanInternalData(orderData.notes) || "Nenhuma observação"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Ações de Status - apenas em modo visualização */}
          {!isEditMode && canEditStatus && (
            <Card className="shadow-sm">
              <CardHeader className="py-2 px-4 border-b bg-muted/20">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                  Ações
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-2">
                  {isOrcamento && (
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleStatusChange("PEDIDO_GERADO")}
                      disabled={reserveStockMutation.isPending}
                    >
                      {reserveStockMutation.isPending && (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      )}
                      Gerar Pedido (Reservar Estoque)
                    </Button>
                  )}
                  {isPedidoGerado && (
                    <>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleStatusChange("FATURADO")}
                        disabled={invoiceMutation.isPending}
                      >
                        {invoiceMutation.isPending && (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        )}
                        Faturar Pedido
                      </Button>
                      {!hasAccountsPosted && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => handlePostAccounts()}
                          disabled={postAccountsMutation.isPending}
                        >
                          {postAccountsMutation.isPending && (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          )}
                          <DollarSign className="h-3 w-3 mr-1" />
                          Lançar Contas
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange("ORCAMENTO")}
                        disabled={unreserveMutation.isPending}
                      >
                        {unreserveMutation.isPending && (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        )}
                        Retornar para Orçamento
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
