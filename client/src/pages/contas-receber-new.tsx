import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  differenceInDays,
  endOfDay,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDownRight,
  Banknote,
  Calendar,
  Check,
  CheckCircle,
  ChevronsUpDown,
  Clock,
  DollarSign,
  Eye,
  FileText,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  TrendingUp,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";

// Tipos para as contas a receber vindas do backend
interface Receivable {
  id: number;
  companyId: string;
  receivableNumber: string;
  description: string | null;
  orderId: number | null;
  customerId: string;
  paymentTypeId: number | null;
  paymentTermId: number | null;
  amount: string;
  amountPaid: string;
  amountRemaining: string;
  issueDate: string;
  dueDate: string;
  status: string;
  isOverdue: boolean;
  paidAt: string | null;
  createdAt: string;
}

interface ReceivableInstallment {
  id: number;
  receivableId: number;
  installmentNumber: number;
  amount: string;
  amountPaid: string;
  amountRemaining: string;
  dueDate: string;
  status: string;
  isOverdue: boolean;
  paidAt: string | null;
}

// Parcela enriquecida com dados do pedido
interface EnrichedInstallment extends ReceivableInstallment {
  receivable?: Receivable;
  customerId?: string;
  orderId?: number | null;
  displayNumber: string; // formato: "pedido/parcela" ex: 287422/001
  description?: string | null;
  sellerId?: string | null; // ID do vendedor (quem faturou o pedido)
}

// Recebimento (título baixado ou venda à vista)
interface ReceivedPayment {
  id: number | string;
  type: "TITULO" | "VISTA";
  amount: string | null;
  paymentMethod: string | null;
  paymentDate: string;
  receivedAt: Date | string | null;
  receivedBy: string | null;
  notes: string | null;
  displayNumber: string;
  customerId: string | null;
  orderId: number | null;
  description: string | null;
}

interface ReceivablePayment {
  id: number;
  companyId: string;
  receivableId: number;
  installmentId: number | null;
  paymentNumber: string;
  amount: string;
  paymentMethod: string | null;
  reference: string | null;
  paymentDate: string;
  receivedAt: string;
  notes: string | null;
  receivedBy: string | null;
}

interface ReceivableWithDetails extends Receivable {
  installments: ReceivableInstallment[];
  payments: ReceivablePayment[];
}

interface ReceivableDashboard {
  overview: {
    totalReceivables: number;
    totalReceived: number;
    totalPending: number;
    totalOverdue: number;
    overdueCount: number;
    receivablesCount: number;
  };
  upcomingReceivables: EnrichedInstallment[];
  overdueReceivables: EnrichedInstallment[];
  upcomingInstallments: EnrichedInstallment[];
  overdueInstallments: EnrichedInstallment[];
}

export default function ContasReceberPage() {
  const { isAdmin, isSales } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [titulosSubTab, setTitulosSubTab] = useState<
    "abertos" | "vencidos" | "recebidos" | "todos"
  >("abertos");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Filtros globais (aplicados)
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Filtros temporários (seleção antes de aplicar)
  const [tempPeriodFilter, setTempPeriodFilter] = useState<string>("all");
  const [tempSellerFilter, setTempSellerFilter] = useState<string>("all");
  const [tempDateFrom, setTempDateFrom] = useState<string>("");
  const [tempDateTo, setTempDateTo] = useState<string>("");

  const [selectedReceivable, setSelectedReceivable] =
    useState<ReceivableWithDetails | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [selectedPayment, setSelectedPayment] =
    useState<ReceivedPayment | null>(null);
  const [paymentType, setPaymentType] = useState<"TOTAL" | "PARCIAL">("TOTAL");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Boleto");
  const [paymentDate, setPaymentDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [paymentNotes, setPaymentNotes] = useState("");
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<
    number | null
  >(null);

  // Estados para campos adicionais de baixa (juros, desconto, multa, tarifa)
  const [paymentInterest, setPaymentInterest] = useState("0");
  const [paymentDiscount, setPaymentDiscount] = useState("0");
  const [paymentFine, setPaymentFine] = useState("0");
  const [paymentFee, setPaymentFee] = useState("0");
  const [showAdvancedPayment, setShowAdvancedPayment] = useState(false);

  // Estados para lançamento manual
  const [manualCustomerId, setManualCustomerId] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualIssueDate, setManualIssueDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [manualDueDate, setManualDueDate] = useState("");
  const [manualDocNumber, setManualDocNumber] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualPaymentTermId, setManualPaymentTermId] =
    useState<string>("avista");
  const [customInstallments, setCustomInstallments] = useState<number>(1);
  const [customInstallmentInput, setCustomInstallmentInput] = useState("");

  // Estados para edição de parcela
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInstallment, setEditingInstallment] =
    useState<InstallmentWithDisplay | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [showDiffWarning, setShowDiffWarning] = useState(false);
  const [diffInfo, setDiffInfo] = useState<{
    orderTotal: number;
    installmentsTotal: number;
    difference: number;
  } | null>(null);

  const showPage = isAdmin || isSales;

  // Dashboard query
  const { data: dashboard, isLoading: dashboardLoading } =
    useQuery<ReceivableDashboard>({
      queryKey: ["/api/receivables/dashboard"],
      enabled: showPage,
    });

  // Lista de parcelas enriquecidas (para a aba Títulos)
  const { data: installmentsData, isLoading: installmentsLoading } = useQuery<
    EnrichedInstallment[]
  >({
    queryKey: ["/api/receivables/installments"],
    enabled: showPage,
  });

  // Lista de recebidos (títulos baixados + vendas à vista)
  const { data: receivedPayments = [], isLoading: receivedLoading } = useQuery<
    ReceivedPayment[]
  >({
    queryKey: ["/api/receivables/payments"],
    enabled: showPage,
  });

  // Lista de clientes para resolver nomes
  const { data: customersData = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: showPage,
  });

  // Filtrar apenas vendedores (admin e sales)
  const sellersData = useMemo(() => {
    return customersData.filter(
      (u) => u.role === "admin" || u.role === "sales",
    );
  }, [customersData]);

  // Função para verificar se uma data está no período selecionado
  const isDateInPeriod = useCallback(
    (dateStr: string): boolean => {
      if (periodFilter === "all") return true;

      const date = parseISO(dateStr);
      const today = new Date();

      if (periodFilter === "custom") {
        if (!dateFrom && !dateTo) return true;
        const from = dateFrom ? startOfDay(parseISO(dateFrom)) : new Date(0);
        const to = dateTo ? endOfDay(parseISO(dateTo)) : new Date(9999, 11, 31);
        return isWithinInterval(date, { start: from, end: to });
      }

      let start: Date;
      const end = endOfDay(today);

      switch (periodFilter) {
        case "today":
          start = startOfDay(today);
          break;
        case "week":
          start = startOfWeek(today, { weekStartsOn: 0 });
          break;
        case "month":
          start = startOfMonth(today);
          break;
        case "quarter":
          start = startOfQuarter(today);
          break;
        case "year":
          start = startOfYear(today);
          break;
        default:
          return true;
      }

      return isWithinInterval(date, { start, end });
    },
    [periodFilter, dateFrom, dateTo],
  );

  // Dados filtrados do dashboard
  const filteredDashboard = useMemo(() => {
    console.log(
      "[DEBUG] installmentsData:",
      installmentsData?.length,
      installmentsData,
    );
    console.log(
      "[DEBUG] periodFilter:",
      periodFilter,
      "sellerFilter:",
      sellerFilter,
    );
    if (!dashboard || !installmentsData) return dashboard;

    // Filtra as parcelas pelos filtros globais
    const filteredInst = installmentsData.filter((inst) => {
      // Filtro de período (por data de vencimento)
      if (!isDateInPeriod(inst.dueDate)) return false;

      // Filtro de vendedor
      if (sellerFilter !== "all") {
        if (sellerFilter === "none") {
          // Filtrar títulos SEM vendedor
          if (inst.sellerId) return false;
        } else {
          // Filtrar por vendedor específico
          if (inst.sellerId !== sellerFilter) return false;
        }
      }

      return true;
    });

    // Recalcula os totais baseado nas parcelas filtradas
    const pending = filteredInst
      .filter((i) => i.status !== "PAGA" && i.status !== "CANCELADA")
      .reduce((sum, i) => sum + parseFloat(i.amountRemaining || "0"), 0);

    const overdue = filteredInst
      .filter(
        (i) => i.isOverdue && i.status !== "PAGA" && i.status !== "CANCELADA",
      )
      .reduce((sum, i) => sum + parseFloat(i.amountRemaining || "0"), 0);

    const overdueCount = filteredInst.filter(
      (i) => i.isOverdue && i.status !== "PAGA" && i.status !== "CANCELADA",
    ).length;

    const received = filteredInst
      .filter((i) => i.status === "PAGA")
      .reduce((sum, i) => sum + parseFloat(i.amount || "0"), 0);

    return {
      overview: {
        ...dashboard.overview,
        totalPending: pending,
        totalOverdue: overdue,
        overdueCount: overdueCount,
        totalReceived: received,
        receivablesCount: filteredInst.length,
      },
      overdueReceivables: filteredInst.filter(
        (i) => i.isOverdue && i.status !== "PAGA" && i.status !== "CANCELADA",
      ),
      upcomingReceivables: filteredInst
        .filter(
          (i) =>
            !i.isOverdue && i.status !== "PAGA" && i.status !== "CANCELADA",
        )
        .sort(
          (a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
        ),
      overdueInstallments: dashboard.overdueInstallments,
      upcomingInstallments: dashboard.upcomingInstallments,
    };
  }, [dashboard, installmentsData, isDateInPeriod, sellerFilter]);

  // Lista de formas de pagamento
  const { data: paymentTypesData = [] } = useQuery<
    {
      id: number;
      name: string;
      active: boolean;
    }[]
  >({
    queryKey: ["/api/payment-types"],
    enabled: showPage,
  });
  const activePaymentTypes = paymentTypesData.filter((pt) => pt.active);

  // Lista de condições de pagamento
  const { data: paymentTermsData = [] } = useQuery<
    {
      id: number;
      name: string;
      installmentCount: number;
      intervalDays: number;
      firstPaymentDays: number;
    }[]
  >({
    queryKey: ["/api/payment-terms"],
    enabled: showPage,
  });

  // Mutation para criar conta manual
  const manualMutation = useMutation({
    mutationFn: async (data: {
      customerId: string;
      amount: number;
      description?: string;
      issueDate: string;
      dueDate: string;
      documentNumber?: string;
      notes?: string;
      paymentTermId?: number;
    }) => {
      const res = await apiRequest("POST", "/api/receivables/manual", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/dashboard"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/installments"],
      });
      setShowManualModal(false);
      resetManualForm();
      toast({
        title: "Conta criada",
        description: "A conta a receber foi lançada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a conta.",
        variant: "destructive",
      });
    },
  });

  // Mutation para registrar pagamento
  const paymentMutation = useMutation({
    mutationFn: async (data: {
      receivableId: number;
      amount: number;
      paymentMethod: string;
      paymentDate: string;
      notes?: string;
      installmentId?: number;
      originalAmount?: number;
      interest?: number;
      discount?: number;
      fine?: number;
      fee?: number;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/receivables/${data.receivableId}/payment`,
        {
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          paymentDate: data.paymentDate,
          notes: data.notes,
          installmentId: data.installmentId,
          originalAmount: data.originalAmount,
          interest: data.interest,
          discount: data.discount,
          fine: data.fine,
          fee: data.fee,
        },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/dashboard"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/installments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/payments"],
      });
      setShowPaymentModal(false);
      resetPaymentForm();
      toast({
        title: "Pagamento registrado",
        description: "O pagamento foi registrado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível registrar o pagamento.",
        variant: "destructive",
      });
    },
  });

  // Mutation para cancelar receivable
  const cancelMutation = useMutation({
    mutationFn: async (data: { receivableId: number; reason: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/receivables/${data.receivableId}/cancel`,
        { reason: data.reason },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/dashboard"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/installments"],
      });
      toast({
        title: "Conta cancelada",
        description: "A conta a receber foi cancelada.",
      });
    },
  });

  // Mutation para excluir parcela
  const deleteInstallmentMutation = useMutation({
    mutationFn: async (installmentId: number) => {
      const res = await apiRequest(
        "DELETE",
        `/api/receivables/installments/${installmentId}`,
      );
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/dashboard"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/installments"],
      });
      toast({
        title: "Parcela excluída",
        description: data.receivableDeleted
          ? "A parcela e a conta a receber foram excluídas."
          : "A parcela foi excluída com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir a parcela.",
        variant: "destructive",
      });
    },
  });

  // Mutation para editar parcela
  const editInstallmentMutation = useMutation({
    mutationFn: async (data: {
      installmentId: number;
      amount?: number;
      dueDate?: string;
      notes?: string;
    }) => {
      const res = await apiRequest(
        "PUT",
        `/api/receivables/installments/${data.installmentId}`,
        { amount: data.amount, dueDate: data.dueDate, notes: data.notes },
      );
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/dashboard"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/installments"],
      });

      if (data.differsFromOrder && data.originalOrderInfo) {
        setDiffInfo(data.originalOrderInfo);
        setShowDiffWarning(true);
      }

      toast({
        title: "Parcela atualizada",
        description: data.differsFromOrder
          ? "Parcela atualizada. Atenção: os valores diferem do pedido original."
          : "Parcela atualizada com sucesso.",
        variant: data.differsFromOrder ? "default" : "default",
      });

      setShowEditModal(false);
      setEditingInstallment(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a parcela.",
        variant: "destructive",
      });
    },
  });

  // Mutation para estornar pagamento
  const reversePaymentMutation = useMutation({
    mutationFn: async (data: {
      paymentId: number;
      amount?: number;
      reason?: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/receivables/payments/${data.paymentId}/reverse`,
        { amount: data.amount, reason: data.reason },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/dashboard"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/installments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/payments"],
      });
      setShowPaymentDetailsModal(false);
      setSelectedPayment(null);
      toast({
        title: "Pagamento estornado",
        description: "O pagamento foi estornado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível estornar o pagamento.",
        variant: "destructive",
      });
    },
  });

  // Helpers
  const formatPrice = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num);
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const getCustomerName = (customerId: string) => {
    const customer = customersData.find((c) => c.id === customerId);
    if (customer) {
      return (
        customer.tradingName ||
        customer.company ||
        `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
        "Cliente"
      );
    }
    return "Cliente";
  };

  const getStatusBadge = (status: string, isOverdue: boolean) => {
    if (isOverdue && status !== "PAGA" && status !== "CANCELADA") {
      return (
        <Badge className="bg-red-500/20 text-red-600 border-red-500/30">
          Vencida
        </Badge>
      );
    }
    switch (status) {
      case "PAGA":
        return (
          <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
            Paga
          </Badge>
        );
      case "PARCIAL":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
            Parcial
          </Badge>
        );
      case "ABERTA":
        return (
          <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">
            Pendente
          </Badge>
        );
      case "CANCELADA":
        return <Badge variant="secondary">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const resetPaymentForm = () => {
    setPaymentType("TOTAL");
    setPaymentAmount("");
    setPaymentMethod("Boleto");
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setPaymentNotes("");
    setSelectedInstallmentId(null);
    setPaymentInterest("0");
    setPaymentDiscount("0");
    setPaymentFine("0");
    setPaymentFee("0");
    setShowAdvancedPayment(false);
  };

  const resetManualForm = () => {
    setManualCustomerId("");
    setManualAmount("");
    setManualDescription("");
    setManualIssueDate(format(new Date(), "yyyy-MM-dd"));
    setManualDueDate("");
    setManualDocNumber("");
    setManualNotes("");
    setManualPaymentTermId("avista");
    setCustomInstallments(1);
    setCustomInstallmentInput("");
  };

  const openEditModal = (inst: InstallmentWithDisplay) => {
    setEditingInstallment(inst);
    setEditAmount(inst.amountRemaining.toString());
    setEditDueDate(inst.dueDate);
    setEditNotes("");
    setShowEditModal(true);
  };

  const handleEditInstallment = () => {
    if (!editingInstallment) return;

    const newAmount = parseFloat(editAmount);
    const originalAmount = parseFloat(editingInstallment.amount.toString());

    // Verificar se há mudança significativa
    const amountChanged = Math.abs(newAmount - originalAmount) > 0.01;
    const dateChanged = editDueDate !== editingInstallment.dueDate;

    if (!amountChanged && !dateChanged) {
      toast({
        title: "Nenhuma alteração",
        description: "Nenhum valor foi modificado.",
      });
      return;
    }

    editInstallmentMutation.mutate({
      installmentId: editingInstallment.id,
      amount: amountChanged ? newAmount : undefined,
      dueDate: dateChanged ? editDueDate : undefined,
      notes: editNotes || undefined,
    });
  };

  const handleCreateManual = () => {
    if (!manualCustomerId || !manualAmount || !manualDueDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha cliente, valor e vencimento.",
        variant: "destructive",
      });
      return;
    }
    manualMutation.mutate({
      customerId: manualCustomerId,
      amount: parseFloat(manualAmount),
      description: manualDescription || undefined,
      issueDate: manualIssueDate,
      dueDate: manualDueDate,
      documentNumber: manualDocNumber || undefined,
      notes: manualNotes || undefined,
      paymentTermId:
        manualPaymentTermId &&
        manualPaymentTermId !== "avista" &&
        manualPaymentTermId !== "custom"
          ? parseInt(manualPaymentTermId)
          : undefined,
      customInstallments:
        manualPaymentTermId === "custom" && customInstallments > 1
          ? customInstallments
          : undefined,
    });
  };

  const openPaymentModal = async (receivable: Receivable) => {
    // Buscar detalhes completos
    try {
      const res = await apiRequest("GET", `/api/receivables/${receivable.id}`);
      const details: ReceivableWithDetails = await res.json();
      setSelectedReceivable(details);
      setPaymentAmount(details.amountRemaining);
      setShowPaymentModal(true);
    } catch (error: any) {
      console.error("[ERROR] openPaymentModal", error);

      // Fallback: tentar obter parcelas e pagamentos via endpoints existentes
      try {
        const instRes = await apiRequest(
          "GET",
          `/api/receivables/installments?receivableId=${receivable.id}`,
        );
        const installments: any[] = await instRes.json();

        const payRes = await apiRequest("GET", "/api/receivables/payments");
        const allPayments: any[] = await payRes.json();
        const payments = allPayments.filter(
          (p) => p.receivableId === receivable.id,
        );

        const details = {
          ...receivable,
          installments,
          payments,
        } as ReceivableWithDetails;

        setSelectedReceivable(details);
        const amtRem =
          details.amountRemaining ||
          (details.installments && details.installments.length > 0
            ? details.installments.reduce(
                (acc: any, i: any) => acc + Number(i.amountRemaining || 0),
                0,
              )
            : undefined);
        setPaymentAmount(amtRem || receivable.amountRemaining || "0");
        setShowPaymentModal(true);

        toast({
          title: "Aviso",
          description:
            "Usando dados reduzidos (fallback) — aplique a migration para correção permanente.",
          variant: "warning",
        });
      } catch (fallbackError) {
        console.error("[ERROR] openPaymentModal fallback", fallbackError);
        toast({
          title: "Erro",
          description:
            error?.message || "Não foi possível carregar os detalhes.",
          variant: "destructive",
        });
      }
    }
  };

  const openDetailsModal = async (receivable: Receivable) => {
    try {
      const res = await apiRequest("GET", `/api/receivables/${receivable.id}`);
      const details: ReceivableWithDetails = await res.json();
      setSelectedReceivable(details);
      setShowDetailsModal(true);
    } catch (error: any) {
      console.error("[ERROR] openDetailsModal", error);

      // Fallback: tentar buscar parcelas e pagamentos e montar detalhes locais
      try {
        const instRes = await apiRequest(
          "GET",
          `/api/receivables/installments?receivableId=${receivable.id}`,
        );
        const installments: any[] = await instRes.json();

        const payRes = await apiRequest("GET", "/api/receivables/payments");
        const allPayments: any[] = await payRes.json();
        const payments = allPayments.filter(
          (p) => p.receivableId === receivable.id,
        );

        const details = {
          ...receivable,
          installments,
          payments,
        } as ReceivableWithDetails;

        setSelectedReceivable(details);
        setShowDetailsModal(true);

        toast({
          title: "Aviso",
          description:
            "Usando dados reduzidos (fallback) — aplique a migration para correção permanente.",
          variant: "warning",
        });
      } catch (fallbackError) {
        console.error("[ERROR] openDetailsModal fallback", fallbackError);
        toast({
          title: "Erro",
          description:
            error?.message || "Não foi possível carregar os detalhes.",
          variant: "destructive",
        });
      }
    }
  };

  const handlePayment = () => {
    if (!selectedReceivable) return;

    // Valor original da parcela (o que está sendo baixado)
    const inst = selectedInstallmentId
      ? selectedReceivable.installments.find(
          (i) => i.id === selectedInstallmentId,
        )
      : null;
    const originalAmount =
      paymentType === "TOTAL"
        ? parseFloat(
            inst ? inst.amountRemaining : selectedReceivable.amountRemaining,
          )
        : parseFloat(paymentAmount);

    // Valores adicionais
    const interest = parseFloat(paymentInterest) || 0;
    const discount = parseFloat(paymentDiscount) || 0;
    const fine = parseFloat(paymentFine) || 0;
    const fee = parseFloat(paymentFee) || 0;

    // Valor efetivamente recebido = original - desconto + juros + multa - tarifa
    const receivedAmount = originalAmount - discount + interest + fine - fee;

    if (isNaN(receivedAmount) || receivedAmount <= 0) {
      toast({
        title: "Valor inválido",
        description: "Informe um valor válido para o pagamento.",
        variant: "destructive",
      });
      return;
    }

    paymentMutation.mutate({
      receivableId: selectedReceivable.id,
      amount: receivedAmount,
      originalAmount: originalAmount,
      paymentMethod,
      paymentDate,
      notes: paymentNotes || undefined,
      installmentId: selectedInstallmentId || undefined,
      interest: interest > 0 ? interest : undefined,
      discount: discount > 0 ? discount : undefined,
      fine: fine > 0 ? fine : undefined,
      fee: fee > 0 ? fee : undefined,
    });
  };

  // Filtrar parcelas (installments) - agora com sub-abas e filtros globais
  const filteredInstallments = useMemo(() => {
    if (!installmentsData) return [];
    return installmentsData.filter((inst) => {
      // Filtro de período global (por data de vencimento)
      if (!isDateInPeriod(inst.dueDate)) return false;

      // Filtro de vendedor global
      if (sellerFilter !== "all") {
        if (sellerFilter === "none") {
          if (inst.sellerId) return false;
        } else {
          if (inst.sellerId !== sellerFilter) return false;
        }
      }

      // Filtro por sub-aba
      if (titulosSubTab === "abertos") {
        // Apenas em aberto (não pagas, não canceladas, não vencidas)
        if (inst.status === "PAGA" || inst.status === "CANCELADA") return false;
        if (inst.isOverdue) return false;
      } else if (titulosSubTab === "vencidos") {
        // Apenas vencidos (não pagas, não canceladas, e vencidas)
        if (inst.status === "PAGA" || inst.status === "CANCELADA") return false;
        if (!inst.isOverdue) return false;
      } else if (titulosSubTab === "recebidos") {
        // Apenas recebidos (pagas)
        if (inst.status !== "PAGA") return false;
      }
      // "todos" não filtra por status

      // Filtro de status adicional (dropdown)
      if (statusFilter !== "ALL") {
        if (statusFilter === "VENCIDA") {
          if (
            !inst.isOverdue ||
            inst.status === "PAGA" ||
            inst.status === "CANCELADA"
          )
            return false;
        } else if (inst.status !== statusFilter) {
          return false;
        }
      }
      // Filtro de busca
      if (searchTerm) {
        const customerName = getCustomerName(
          inst.customerId || "",
        ).toLowerCase();
        const search = searchTerm.toLowerCase();
        if (
          !customerName.includes(search) &&
          !inst.displayNumber.toLowerCase().includes(search) &&
          !(inst.description || "").toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    installmentsData,
    titulosSubTab,
    statusFilter,
    searchTerm,
    customersData,
    isDateInPeriod,
    sellerFilter,
  ]);

  // Contadores para as sub-abas (também aplicam filtros globais)
  const installmentCounts = useMemo(() => {
    if (!installmentsData)
      return { abertos: 0, vencidos: 0, recebidos: 0, todos: 0 };

    // Filtra primeiro pelo período e vendedor
    const globalFiltered = installmentsData.filter((inst) => {
      if (!isDateInPeriod(inst.dueDate)) return false;
      if (sellerFilter !== "all") {
        if (sellerFilter === "none") {
          if (inst.sellerId) return false;
        } else {
          if (inst.sellerId !== sellerFilter) return false;
        }
      }
      return true;
    });

    const abertos = globalFiltered.filter(
      (inst) =>
        inst.status !== "PAGA" &&
        inst.status !== "CANCELADA" &&
        !inst.isOverdue,
    ).length;

    const vencidos = globalFiltered.filter(
      (inst) =>
        inst.status !== "PAGA" && inst.status !== "CANCELADA" && inst.isOverdue,
    ).length;

    const recebidos = globalFiltered.filter(
      (inst) => inst.status === "PAGA",
    ).length;

    return {
      abertos,
      vencidos,
      recebidos,
      todos: globalFiltered.length,
    };
  }, [installmentsData, isDateInPeriod, sellerFilter]);

  if (!showPage) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso não autorizado</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Contas a Receber</h1>
              <p className="text-sm text-muted-foreground">
                Títulos de pedidos faturados a prazo
              </p>
            </div>
          </div>
          <Button onClick={() => setShowManualModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        <div className="border-b px-4">
          <TabsList className="bg-transparent h-12">
            <TabsTrigger value="dashboard" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="titulos" className="gap-2">
              <FileText className="h-4 w-4" />
              Títulos
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="m-0 p-4 md:p-6">
            {dashboardLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDashboard ? (
              <div className="space-y-4 md:space-y-6">
                {/* Filtros */}
                <Card>
                  <CardContent className="p-3 md:p-4">
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline">
                          Período:
                        </span>
                      </div>
                      <Select
                        value={tempPeriodFilter}
                        onValueChange={(value) => {
                          setTempPeriodFilter(value);
                          if (value !== "custom") {
                            setTempDateFrom("");
                            setTempDateTo("");
                          }
                        }}
                      >
                        <SelectTrigger className="w-[130px] md:w-[150px] h-8 text-xs md:text-sm">
                          <SelectValue placeholder="Período" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="today">Hoje</SelectItem>
                          <SelectItem value="week">Esta semana</SelectItem>
                          <SelectItem value="month">Este mês</SelectItem>
                          <SelectItem value="quarter">
                            Este trimestre
                          </SelectItem>
                          <SelectItem value="year">Este ano</SelectItem>
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>

                      {tempPeriodFilter === "custom" && (
                        <>
                          <Input
                            type="date"
                            value={tempDateFrom}
                            onChange={(e) => setTempDateFrom(e.target.value)}
                            className="w-[130px] h-8 text-xs md:text-sm"
                            placeholder="De"
                          />
                          <span className="text-muted-foreground text-xs">
                            até
                          </span>
                          <Input
                            type="date"
                            value={tempDateTo}
                            onChange={(e) => setTempDateTo(e.target.value)}
                            className="w-[130px] h-8 text-xs md:text-sm"
                            placeholder="Até"
                          />
                        </>
                      )}

                      <Separator
                        orientation="vertical"
                        className="h-6 hidden sm:block"
                      />

                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline">
                          Vendedor:
                        </span>
                      </div>
                      <Select
                        value={tempSellerFilter}
                        onValueChange={setTempSellerFilter}
                      >
                        <SelectTrigger className="w-[130px] md:w-[180px] h-8 text-xs md:text-sm">
                          <SelectValue placeholder="Vendedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="none">Sem vendedor</SelectItem>
                          {sellersData.map((seller) => (
                            <SelectItem key={seller.id} value={seller.id}>
                              {seller.name || seller.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Separator
                        orientation="vertical"
                        className="h-6 hidden sm:block"
                      />

                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => {
                          setPeriodFilter(tempPeriodFilter);
                          setSellerFilter(tempSellerFilter);
                          setDateFrom(tempDateFrom);
                          setDateTo(tempDateTo);
                          toast({
                            title: "Filtros aplicados",
                            description: "Os dados foram atualizados.",
                          });
                        }}
                      >
                        <Search className="h-3.5 w-3.5" />
                        Filtrar
                      </Button>

                      {(periodFilter !== "all" || sellerFilter !== "all") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            setPeriodFilter("all");
                            setSellerFilter("all");
                            setDateFrom("");
                            setDateTo("");
                            setTempPeriodFilter("all");
                            setTempSellerFilter("all");
                            setTempDateFrom("");
                            setTempDateTo("");
                            toast({
                              title: "Filtros limpos",
                              description: "Exibindo todos os dados.",
                            });
                          }}
                        >
                          Limpar
                        </Button>
                      )}
                    </div>

                    {/* Indicador de filtros ativos */}
                    {(periodFilter !== "all" || sellerFilter !== "all") && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="gap-1">
                            <Search className="h-3 w-3" />
                            Filtros ativos:
                            {periodFilter !== "all" && (
                              <span className="font-medium">
                                {periodFilter === "today" && "Hoje"}
                                {periodFilter === "week" && "Esta semana"}
                                {periodFilter === "month" && "Este mês"}
                                {periodFilter === "quarter" && "Este trimestre"}
                                {periodFilter === "year" && "Este ano"}
                                {periodFilter === "custom" &&
                                  `${dateFrom || "..."} a ${dateTo || "..."}`}
                              </span>
                            )}
                            {sellerFilter !== "all" && (
                              <span className="font-medium">
                                {sellerFilter === "none"
                                  ? "Sem vendedor"
                                  : sellersData.find(
                                      (s) => s.id === sellerFilter,
                                    )?.name || "Vendedor"}
                              </span>
                            )}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Cards de resumo */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  <Card className="col-span-1 overflow-hidden">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs md:text-sm text-muted-foreground truncate pr-2">
                            Total a Receber
                          </p>
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Wallet className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                          </div>
                        </div>
                        <p className="text-base md:text-xl lg:text-2xl font-bold text-primary truncate">
                          {formatPrice(filteredDashboard.overview.totalPending)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="col-span-1 overflow-hidden">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs md:text-sm text-muted-foreground truncate pr-2">
                            Vencidos
                          </p>
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
                          </div>
                        </div>
                        <p className="text-base md:text-xl lg:text-2xl font-bold text-red-600 truncate">
                          {formatPrice(filteredDashboard.overview.totalOverdue)}
                        </p>
                        <p className="text-[10px] md:text-xs text-muted-foreground -mt-1">
                          {filteredDashboard.overview.overdueCount} títulos
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="col-span-1 overflow-hidden">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs md:text-sm text-muted-foreground truncate pr-2">
                            Total Recebido
                          </p>
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                          </div>
                        </div>
                        <p className="text-base md:text-xl lg:text-2xl font-bold text-green-600 truncate">
                          {formatPrice(
                            filteredDashboard.overview.totalReceived,
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="col-span-1 overflow-hidden">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs md:text-sm text-muted-foreground truncate pr-2">
                            Total de Títulos
                          </p>
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Receipt className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                          </div>
                        </div>
                        <p className="text-base md:text-xl lg:text-2xl font-bold">
                          {filteredDashboard.overview.receivablesCount}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Listas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  {/* Vencidos */}
                  <Card>
                    <CardHeader className="p-3 md:p-4 pb-2">
                      <CardTitle className="text-sm md:text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Títulos Vencidos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 md:p-4 pt-0">
                      {filteredDashboard.overdueReceivables.length === 0 ? (
                        <p className="text-xs md:text-sm text-muted-foreground text-center py-6">
                          Nenhum título vencido
                        </p>
                      ) : (
                        <div className="space-y-2 md:space-y-3">
                          {filteredDashboard.overdueReceivables
                            .slice(0, 5)
                            .map((inst) => {
                              const titleNumber =
                                inst.displayNumber ||
                                inst.description ||
                                `Título #${inst.id}`;
                              return (
                                <div
                                  key={`dash-over-${inst.id}`}
                                  className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-red-500/5"
                                >
                                  <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                    <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                      <UserIcon className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-xs md:text-sm font-mono truncate">
                                        {titleNumber}
                                      </p>
                                      <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                                        {getCustomerName(inst.customerId || "")}{" "}
                                        •{" "}
                                        {differenceInDays(
                                          new Date(),
                                          new Date(inst.dueDate),
                                        )}
                                        d atrás
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0 ml-2">
                                    <p className="font-semibold text-red-600 text-sm md:text-base">
                                      {formatPrice(inst.amountRemaining)}
                                    </p>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 md:h-6 text-[10px] md:text-xs px-1 md:px-2"
                                      onClick={() =>
                                        inst.receivable &&
                                        openPaymentModal(inst.receivable)
                                      }
                                    >
                                      Receber
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Próximos vencimentos */}
                  <Card>
                    <CardHeader className="p-3 md:p-4 pb-2">
                      <CardTitle className="text-sm md:text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-500" />
                        Próximos Vencimentos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 md:p-4 pt-0">
                      {filteredDashboard.upcomingReceivables.length === 0 ? (
                        <p className="text-xs md:text-sm text-muted-foreground text-center py-6">
                          Nenhum vencimento próximo
                        </p>
                      ) : (
                        <div className="space-y-2 md:space-y-3">
                          {filteredDashboard.upcomingReceivables
                            .slice(0, 5)
                            .map((inst) => {
                              const daysUntil = differenceInDays(
                                new Date(inst.dueDate),
                                new Date(),
                              );
                              const titleNumber =
                                inst.displayNumber ||
                                inst.description ||
                                `Título #${inst.id}`;
                              return (
                                <div
                                  key={`dash-up-${inst.id}`}
                                  className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/30"
                                >
                                  <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                    <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                      <UserIcon className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-xs md:text-sm font-mono truncate">
                                        {titleNumber}
                                      </p>
                                      <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                                        {getCustomerName(inst.customerId || "")}{" "}
                                        • em {daysUntil}d (
                                        {formatDate(inst.dueDate)})
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0 ml-2">
                                    <p className="font-semibold text-sm md:text-base">
                                      {formatPrice(inst.amountRemaining)}
                                    </p>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 md:h-6 text-[10px] md:text-xs px-1 md:px-2"
                                      onClick={() =>
                                        inst.receivable &&
                                        openPaymentModal(inst.receivable)
                                      }
                                    >
                                      Receber
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}
          </TabsContent>

          {/* Títulos Tab */}
          <TabsContent value="titulos" className="m-0 p-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-col gap-4">
                  {/* Sub-abas de navegação */}
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Button
                      variant={
                        titulosSubTab === "abertos" ? "default" : "ghost"
                      }
                      size="sm"
                      onClick={() => setTitulosSubTab("abertos")}
                      className="gap-2"
                    >
                      <Clock className="h-4 w-4" />
                      Em Aberto
                      {installmentCounts.abertos > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          {installmentCounts.abertos}
                        </Badge>
                      )}
                    </Button>
                    <Button
                      variant={
                        titulosSubTab === "vencidos" ? "default" : "ghost"
                      }
                      size="sm"
                      onClick={() => setTitulosSubTab("vencidos")}
                      className="gap-2"
                    >
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Vencidos
                      {installmentCounts.vencidos > 0 && (
                        <Badge variant="destructive" className="ml-1">
                          {installmentCounts.vencidos}
                        </Badge>
                      )}
                    </Button>
                    <Button
                      variant={
                        titulosSubTab === "recebidos" ? "default" : "ghost"
                      }
                      size="sm"
                      onClick={() => setTitulosSubTab("recebidos")}
                      className="gap-2"
                    >
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Recebidos
                      {installmentCounts.recebidos > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-1 bg-green-100 text-green-700"
                        >
                          {installmentCounts.recebidos}
                        </Badge>
                      )}
                    </Button>
                    <Button
                      variant={titulosSubTab === "todos" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTitulosSubTab("todos")}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Todos
                      <Badge variant="outline" className="ml-1">
                        {installmentCounts.todos}
                      </Badge>
                    </Button>
                  </div>

                  {/* Filtros */}
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <CardTitle className="text-base">
                      {titulosSubTab === "abertos" && "Títulos em Aberto"}
                      {titulosSubTab === "vencidos" && "Títulos Vencidos"}
                      {titulosSubTab === "recebidos" && "Títulos Recebidos"}
                      {titulosSubTab === "todos" && "Todos os Títulos"}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar..."
                          className="pl-10 w-[200px]"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      {titulosSubTab === "todos" && (
                        <Select
                          value={statusFilter}
                          onValueChange={setStatusFilter}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">Todos</SelectItem>
                            <SelectItem value="ABERTA">Pendente</SelectItem>
                            <SelectItem value="PARCIAL">Parcial</SelectItem>
                            <SelectItem value="VENCIDA">Vencida</SelectItem>
                            <SelectItem value="PAGA">Paga</SelectItem>
                            <SelectItem value="CANCELADA">Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {installmentsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredInstallments.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>
                      {titulosSubTab === "abertos" && "Nenhum título em aberto"}
                      {titulosSubTab === "vencidos" && "Nenhum título vencido"}
                      {titulosSubTab === "recebidos" &&
                        "Nenhum título recebido"}
                      {titulosSubTab === "todos" && "Nenhum título encontrado"}
                    </p>
                    <p className="text-sm">
                      {titulosSubTab === "abertos" &&
                        "Ótimo! Todos os títulos estão em dia ou já foram recebidos"}
                      {titulosSubTab === "vencidos" &&
                        "Excelente! Não há títulos vencidos no momento"}
                      {titulosSubTab === "recebidos" &&
                        "Ainda não há títulos recebidos neste período"}
                      {titulosSubTab === "todos" &&
                        "Os títulos são gerados automaticamente ao faturar pedidos com pagamento a prazo"}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInstallments.map((inst) => (
                        <TableRow
                          key={`tit-${inst.id}`}
                          className="hover:bg-muted/30"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <UserIcon className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-medium">
                                {getCustomerName(inst.customerId || "")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-mono font-semibold">
                                {inst.displayNumber}
                              </p>
                              {inst.orderId && (
                                <Link
                                  href={`/order-details/${inst.orderId}`}
                                  className="text-xs text-primary hover:underline"
                                >
                                  Ver pedido
                                </Link>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(inst.dueDate)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>
                              <p className="font-semibold">
                                {formatPrice(inst.amount)}
                              </p>
                              {parseFloat(inst.amountPaid.toString()) > 0 &&
                                parseFloat(inst.amountRemaining.toString()) >
                                  0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Restante:{" "}
                                    {formatPrice(inst.amountRemaining)}
                                  </p>
                                )}
                              {inst.status === "PAGA" && (
                                <p className="text-xs text-green-600">
                                  Quitado
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(inst.status, inst.isOverdue)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {inst.status !== "PAGA" &&
                                inst.status !== "CANCELADA" &&
                                inst.receivable && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 h-7 text-xs"
                                    onClick={() =>
                                      inst.receivable &&
                                      openPaymentModal(inst.receivable)
                                    }
                                  >
                                    <Banknote className="h-3 w-3 mr-1" />
                                    Baixar
                                  </Button>
                                )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {inst.receivable && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        openDetailsModal(inst.receivable!)
                                      }
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      Ver detalhes
                                    </DropdownMenuItem>
                                  )}
                                  {inst.orderId && (
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/order-details/${inst.orderId}`}
                                      >
                                        <FileText className="h-4 w-4 mr-2" />
                                        Ver pedido
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
                                  {inst.status !== "PAGA" &&
                                    inst.status !== "CANCELADA" && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => openEditModal(inst)}
                                        >
                                          <Pencil className="h-4 w-4 mr-2" />
                                          Editar parcela
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  <DropdownMenuSeparator />
                                  {inst.status !== "PAGA" &&
                                    inst.status !== "CANCELADA" && (
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => {
                                          if (
                                            confirm(
                                              `Tem certeza que deseja excluir a parcela ${inst.displayNumber}?\n\nSe for a última parcela, a conta a receber também será excluída e o pedido terá o "contas lançadas" removido.`,
                                            )
                                          ) {
                                            deleteInstallmentMutation.mutate(
                                              inst.id,
                                            );
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Excluir parcela
                                      </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Modal de Detalhes do Pagamento */}
      <Dialog
        open={showPaymentDetailsModal}
        onOpenChange={setShowPaymentDetailsModal}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-green-600" />
              Detalhes do Recebimento
            </DialogTitle>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Documento:</span>
                  <span className="font-mono font-semibold">
                    {selectedPayment.displayNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium">
                    {getCustomerName(selectedPayment.customerId || "")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data:</span>
                  <span>{formatDate(selectedPayment.paymentDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Forma:</span>
                  <Badge variant="secondary">
                    {selectedPayment.paymentMethod || "—"}
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Valor Recebido:</span>
                  <span className="text-green-600">
                    {formatPrice(selectedPayment.amount || 0)}
                  </span>
                </div>
              </div>

              {selectedPayment.notes && (
                <div className="p-3 rounded-lg bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    Observações:
                  </p>
                  <p className="text-sm">{selectedPayment.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPaymentDetailsModal(false);
                setSelectedPayment(null);
              }}
            >
              Fechar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (
                  selectedPayment &&
                  confirm(
                    `Tem certeza que deseja estornar este recebimento?\n\nO valor de ${formatPrice(selectedPayment.amount || 0)} voltará para pendente.`,
                  )
                ) {
                  reversePaymentMutation.mutate({
                    paymentId: Number(selectedPayment.id),
                    reason: "Estorno solicitado pelo usuário",
                  });
                }
              }}
              disabled={reversePaymentMutation.isPending}
            >
              {reversePaymentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Estornar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Lançamento Manual */}
      <Dialog open={showManualModal} onOpenChange={setShowManualModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Novo Lançamento
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 pr-4">
              {/* Info do lançamento - EXATAMENTE igual ao card da baixa */}
              <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Cliente:</span>
                  <Popover
                    open={customerSearchOpen}
                    onOpenChange={setCustomerSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        role="combobox"
                        aria-expanded={customerSearchOpen}
                        className="h-auto w-auto justify-between border-0 bg-transparent p-0 font-medium hover:bg-transparent"
                      >
                        {manualCustomerId
                          ? (() => {
                              const customer = customersData.find(
                                (c) => c.id === manualCustomerId,
                              );
                              return (
                                customer?.company ||
                                customer?.tradingName ||
                                customer?.firstName ||
                                customer?.email ||
                                "Selecione..."
                              );
                            })()
                          : "Selecione o cliente"}
                        <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="end">
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." />
                        <CommandList>
                          <CommandEmpty>
                            Nenhum cliente encontrado.
                          </CommandEmpty>
                          <CommandGroup>
                            {customersData
                              .filter((c) => c.role === "customer")
                              .map((customer) => (
                                <CommandItem
                                  key={customer.id}
                                  value={`${customer.company || ""} ${customer.tradingName || ""} ${customer.firstName || ""} ${customer.email || ""}`}
                                  onSelect={() => {
                                    setManualCustomerId(customer.id);
                                    setCustomerSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${manualCustomerId === customer.id ? "opacity-100" : "opacity-0"}`}
                                  />
                                  <div className="flex flex-col">
                                    <span>
                                      {customer.company ||
                                        customer.tradingName ||
                                        customer.firstName ||
                                        customer.email}
                                    </span>
                                    {customer.company &&
                                      customer.tradingName && (
                                        <span className="text-xs text-muted-foreground">
                                          {customer.tradingName}
                                        </span>
                                      )}
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nº Documento:</span>
                  <span>
                    <Input
                      placeholder="Opcional"
                      value={manualDocNumber}
                      onChange={(e) => setManualDocNumber(e.target.value)}
                      className="h-auto w-28 border-0 bg-transparent p-0 text-right text-sm focus-visible:ring-0"
                    />
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor Total:</span>
                  <span>
                    {manualAmount
                      ? formatPrice(parseFloat(manualAmount))
                      : "R$ 0,00"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Parcelas:</span>
                  <span>
                    {(() => {
                      const amount = parseFloat(manualAmount || "0");
                      if (
                        manualPaymentTermId === "custom" &&
                        customInstallments > 1
                      ) {
                        return `${customInstallments}x de ${formatPrice(amount / customInstallments)}`;
                      } else if (
                        manualPaymentTermId &&
                        manualPaymentTermId !== "avista" &&
                        manualPaymentTermId !== "custom"
                      ) {
                        const term = paymentTermsData.find(
                          (pt) => pt.id.toString() === manualPaymentTermId,
                        );
                        return term
                          ? `${term.installmentCount}x de ${formatPrice(amount / term.installmentCount)}`
                          : "À vista";
                      }
                      return "À vista";
                    })()}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>1º Vencimento:</span>
                  <span className="text-primary">
                    <Input
                      type="date"
                      value={manualDueDate}
                      onChange={(e) => setManualDueDate(e.target.value)}
                      className="h-auto w-28 border-0 bg-transparent p-0 text-right text-sm font-medium text-primary focus-visible:ring-0"
                    />
                  </span>
                </div>
              </div>

              {/* Valor a Receber - igual ao "Valor a Baixar" */}
              <div className="space-y-2">
                <Label htmlFor="manualAmount">Valor a Receber</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="manualAmount"
                    type="number"
                    step="0.01"
                    className="pl-10"
                    placeholder="0,00"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                  />
                </div>
              </div>

              {/* Condição de Pagamento (Parcelas) */}
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <div className="flex gap-2">
                  <Select
                    value={manualPaymentTermId}
                    onValueChange={(val) => {
                      setManualPaymentTermId(val);
                      if (val !== "custom") {
                        setCustomInstallments(1);
                        setCustomInstallmentInput("");
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione a condição" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avista">À vista (1x)</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  {manualPaymentTermId === "custom" && (
                    <Input
                      className="w-20"
                      placeholder="2x"
                      value={customInstallmentInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomInstallmentInput(val);
                        // Extrai o número de parcelas (ex: "3x" -> 3)
                        const match = val.match(/^(\d+)x?$/i);
                        if (match) {
                          setCustomInstallments(parseInt(match[1]));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const match =
                            customInstallmentInput.match(/^(\d+)x?$/i);
                          if (match) {
                            const num = parseInt(match[1]);
                            setCustomInstallments(num);
                            setCustomInstallmentInput(`${num}x`);
                          }
                        }
                      }}
                    />
                  )}
                </div>
                {/* Preview das parcelas */}
                {manualAmount && (
                  <div className="text-xs text-muted-foreground p-2 rounded bg-muted/30">
                    {manualPaymentTermId === "custom" &&
                    customInstallments > 1 ? (
                      <span>
                        {customInstallments}x de{" "}
                        {formatPrice(
                          parseFloat(manualAmount) / customInstallments,
                        )}{" "}
                        • Intervalo de 30 dias entre parcelas
                      </span>
                    ) : (
                      <span>1x de {formatPrice(parseFloat(manualAmount))}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Forma de Pagamento */}
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a forma" />
                  </SelectTrigger>
                  <SelectContent>
                    {activePaymentTypes.map((pt) => (
                      <SelectItem key={pt.id} value={pt.name}>
                        {pt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Data de Emissão */}
              <div className="space-y-2">
                <Label htmlFor="issueDate">Data de Emissão</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={manualIssueDate}
                  onChange={(e) => setManualIssueDate(e.target.value)}
                />
              </div>

              {/* Histórico / Observações - igual */}
              <div className="space-y-2">
                <Label htmlFor="manualNotes">Histórico / Observações</Label>
                <Textarea
                  id="manualNotes"
                  placeholder="Referência, nº do comprovante..."
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateManual}
              disabled={
                manualMutation.isPending ||
                !manualCustomerId ||
                !manualAmount ||
                !manualDueDate
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {manualMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar Lançamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Pagamento */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Baixa de Lançamentos
            </DialogTitle>
          </DialogHeader>

          {selectedReceivable && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 pr-4">
                {/* Info do título */}
                <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium">
                      {getCustomerName(selectedReceivable.customerId)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Título:</span>
                    <span>{selectedReceivable.receivableNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor Total:</span>
                    <span>{formatPrice(selectedReceivable.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Já Pago:</span>
                    <span className="text-green-600">
                      {formatPrice(selectedReceivable.amountPaid)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Saldo Restante:</span>
                    <span className="text-primary">
                      {formatPrice(selectedReceivable.amountRemaining)}
                    </span>
                  </div>
                </div>

                {/* Parcelas (se houver) */}
                {selectedReceivable.installments.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Parcela</Label>
                    <Select
                      value={selectedInstallmentId?.toString() || "all"}
                      onValueChange={(v) => {
                        const instId = v === "all" ? null : parseInt(v);
                        setSelectedInstallmentId(instId);
                        // Atualizar valor quando mudar parcela
                        if (instId) {
                          const inst = selectedReceivable.installments.find(
                            (i) => i.id === instId,
                          );
                          if (inst) setPaymentAmount(inst.amountRemaining);
                        } else {
                          setPaymentAmount(selectedReceivable.amountRemaining);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma parcela" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Pagamento geral</SelectItem>
                        {selectedReceivable.installments
                          .filter((inst) => inst.status !== "PAGA")
                          .map((inst) => (
                            <SelectItem
                              key={inst.id}
                              value={inst.id.toString()}
                            >
                              Parcela {inst.installmentNumber} -{" "}
                              {formatPrice(inst.amountRemaining)} -{" "}
                              {formatDate(inst.dueDate)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Tipo de pagamento */}
                <div className="space-y-2">
                  <Label className="text-sm">Tipo de Baixa</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={paymentType === "TOTAL" ? "default" : "outline"}
                      className="w-full"
                      onClick={() => {
                        setPaymentType("TOTAL");
                        const inst = selectedInstallmentId
                          ? selectedReceivable.installments.find(
                              (i) => i.id === selectedInstallmentId,
                            )
                          : null;
                        setPaymentAmount(
                          inst
                            ? inst.amountRemaining
                            : selectedReceivable.amountRemaining,
                        );
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Total
                    </Button>
                    <Button
                      variant={
                        paymentType === "PARCIAL" ? "default" : "outline"
                      }
                      className="w-full"
                      onClick={() => setPaymentType("PARCIAL")}
                    >
                      <ArrowDownRight className="h-4 w-4 mr-2" />
                      Parcial
                    </Button>
                  </div>
                </div>

                {/* Valor original */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor a Baixar</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      R$
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      className="pl-10"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      disabled={paymentType === "TOTAL"}
                    />
                  </div>
                </div>

                {/* Campos avançados (juros, desconto, multa, tarifa) */}
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAdvancedPayment(!showAdvancedPayment)}
                  >
                    {showAdvancedPayment ? "▼" : "►"} Juros, Desconto, Multa e
                    Tarifa
                  </Button>

                  {showAdvancedPayment && (
                    <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-muted/20">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Juros (+)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            R$
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            className="pl-8 h-8 text-sm"
                            value={paymentInterest}
                            onChange={(e) => setPaymentInterest(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Desconto (-)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            R$
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            className="pl-8 h-8 text-sm"
                            value={paymentDiscount}
                            onChange={(e) => setPaymentDiscount(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Multa (+)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            R$
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            className="pl-8 h-8 text-sm"
                            value={paymentFine}
                            onChange={(e) => setPaymentFine(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Tarifa (-)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            R$
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            className="pl-8 h-8 text-sm"
                            value={paymentFee}
                            onChange={(e) => setPaymentFee(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Valor recebido calculado */}
                {showAdvancedPayment && (
                  <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/30">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Valor Recebido:
                      </span>
                      <span className="font-bold text-lg text-green-600">
                        {formatPrice(
                          (parseFloat(paymentAmount) || 0) -
                            (parseFloat(paymentDiscount) || 0) +
                            (parseFloat(paymentInterest) || 0) +
                            (parseFloat(paymentFine) || 0) -
                            (parseFloat(paymentFee) || 0),
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      = Valor - Desconto + Juros + Multa - Tarifa
                    </p>
                  </div>
                )}

                <Separator />

                {/* Forma de pagamento */}
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a forma" />
                    </SelectTrigger>
                    <SelectContent>
                      {activePaymentTypes.map((pt) => (
                        <SelectItem key={pt.id} value={pt.name}>
                          {pt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data */}
                <div className="space-y-2">
                  <Label htmlFor="date">Data do Recebimento</Label>
                  <Input
                    id="date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Histórico / Observações</Label>
                  <Textarea
                    id="notes"
                    placeholder="Referência, nº do comprovante..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPaymentModal(false);
                resetPaymentForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePayment}
              disabled={paymentMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {paymentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar Baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Conta a Receber
            </DialogTitle>
          </DialogHeader>

          {selectedReceivable && (
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
                <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 mt-4">
                {/* Cliente e Valor destacados */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserIcon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cliente</p>
                        <p className="font-semibold text-lg">
                          {getCustomerName(selectedReceivable.customerId)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground">
                      Valor a Receber
                    </p>
                    <p className="font-bold text-2xl text-primary">
                      {formatPrice(selectedReceivable.amountRemaining)}
                    </p>
                    {Number(selectedReceivable.amountPaid) > 0 && (
                      <p className="text-xs text-green-600">
                        Já recebido:{" "}
                        {formatPrice(selectedReceivable.amountPaid)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Datas */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Emissão</p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(selectedReceivable.issueDate)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Competência</p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(selectedReceivable.issueDate)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p
                      className={`font-medium flex items-center gap-1 ${selectedReceivable.isOverdue ? "text-red-600" : ""}`}
                    >
                      <Calendar className="h-3 w-3" />
                      {formatDate(selectedReceivable.dueDate)}
                      {selectedReceivable.isOverdue && (
                        <AlertTriangle className="h-3 w-3 ml-1" />
                      )}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Info adicional */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Número do Título
                    </p>
                    <p className="font-medium">
                      {selectedReceivable.receivableNumber}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Status</p>
                    {getStatusBadge(
                      selectedReceivable.status,
                      selectedReceivable.isOverdue,
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Histórico</p>
                    <p className="font-medium">
                      {selectedReceivable.description || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Forma de Pagamento
                    </p>
                    <Badge variant="outline">A prazo</Badge>
                  </div>
                </div>

                {/* Pedido de Origem */}
                {selectedReceivable.orderId && (
                  <>
                    <Separator />
                    <div className="p-3 rounded-lg bg-muted/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Pedido de Origem:</span>
                        <span className="font-medium">
                          #{selectedReceivable.orderId}
                        </span>
                      </div>
                      <Link
                        href={`/order-details/${selectedReceivable.orderId}`}
                      >
                        <Button variant="outline" size="sm">
                          <Eye className="h-3 w-3 mr-1" />
                          Ver Pedido
                        </Button>
                      </Link>
                    </div>
                  </>
                )}

                {/* Resumo de valores */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      Valor Original
                    </p>
                    <p className="text-lg font-bold">
                      {formatPrice(selectedReceivable.amount)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10">
                    <p className="text-xs text-muted-foreground">Total Pago</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatPrice(selectedReceivable.amountPaid)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10">
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className="text-lg font-bold text-primary">
                      {formatPrice(selectedReceivable.amountRemaining)}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="parcelas" className="mt-4">
                {selectedReceivable.installments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReceivable.installments.map((inst) => (
                        <TableRow key={inst.id}>
                          <TableCell className="font-medium">
                            {inst.installmentNumber}/
                            {selectedReceivable.installments.length}
                          </TableCell>
                          <TableCell>
                            <div
                              className={`flex items-center gap-1 ${inst.isOverdue ? "text-red-600" : ""}`}
                            >
                              <Calendar className="h-3 w-3" />
                              {formatDate(inst.dueDate)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPrice(inst.amount)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatPrice(inst.amountPaid)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatPrice(inst.amountRemaining)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(inst.status, inst.isOverdue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Pagamento à vista - sem parcelas</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pagamentos" className="mt-4">
                {selectedReceivable.payments.length > 0 ? (
                  <div className="space-y-3">
                    {selectedReceivable.payments.map((pay) => (
                      <div
                        key={pay.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-green-500/5 border border-green-500/20"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {pay.paymentMethod || "Pagamento"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(pay.paymentDate)}
                              {pay.receivedBy &&
                                ` • Recebido por ${pay.receivedBy}`}
                            </p>
                            {pay.notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {pay.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="font-bold text-lg text-green-600">
                          +{formatPrice(pay.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Banknote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum pagamento registrado</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDetailsModal(false)}
            >
              Fechar
            </Button>
            {selectedReceivable &&
              selectedReceivable.status !== "PAGA" &&
              selectedReceivable.status !== "CANCELADA" && (
                <Button
                  onClick={() => {
                    setShowDetailsModal(false);
                    openPaymentModal(selectedReceivable);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  Registrar Pagamento
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Parcela */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Parcela
            </DialogTitle>
          </DialogHeader>

          {editingInstallment && (
            <div className="space-y-4">
              {/* Info da parcela */}
              <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Título:</span>
                  <span className="font-mono font-semibold">
                    {editingInstallment.displayNumber}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span>
                    {getCustomerName(editingInstallment.customerId || "")}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor Original:</span>
                  <span>{formatPrice(editingInstallment.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Vencimento Original:
                  </span>
                  <span>{formatDate(editingInstallment.dueDate)}</span>
                </div>
              </div>

              {editingInstallment.orderId && (
                <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    Esta parcela está vinculada ao pedido #
                    {editingInstallment.orderId}. Alterações serão registradas.
                  </span>
                </div>
              )}

              <Separator />

              {/* Campos editáveis */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editAmount">Novo Valor</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="editAmount"
                      type="number"
                      step="0.01"
                      className="pl-10"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                    />
                  </div>
                  {editAmount &&
                    parseFloat(editAmount) !==
                      parseFloat(editingInstallment.amount.toString()) && (
                      <p className="text-xs text-yellow-600">
                        Diferença:{" "}
                        {formatPrice(
                          parseFloat(editAmount) -
                            parseFloat(editingInstallment.amount.toString()),
                        )}
                      </p>
                    )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editDueDate">Nova Data de Vencimento</Label>
                  <Input
                    id="editDueDate"
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                  />
                  {editDueDate !== editingInstallment.dueDate && (
                    <p className="text-xs text-yellow-600">
                      Data alterada de {formatDate(editingInstallment.dueDate)}{" "}
                      para {formatDate(editDueDate)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editNotes">
                    Motivo da alteração (opcional)
                  </Label>
                  <Textarea
                    id="editNotes"
                    placeholder="Ex: Reajuste acordado com cliente..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditInstallment}
              disabled={editInstallmentMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {editInstallmentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Aviso de Divergência */}
      <Dialog open={showDiffWarning} onOpenChange={setShowDiffWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Valores Divergentes
            </DialogTitle>
          </DialogHeader>

          {diffInfo && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Os valores das parcelas agora diferem do valor original do
                pedido.
              </p>

              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Valor do Pedido:</span>
                  <span className="font-semibold">
                    {formatPrice(diffInfo.orderTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total das Parcelas:</span>
                  <span className="font-semibold">
                    {formatPrice(diffInfo.installmentsTotal)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-medium">
                  <span>Diferença:</span>
                  <span
                    className={
                      diffInfo.difference > 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {diffInfo.difference > 0 ? "+" : ""}
                    {formatPrice(diffInfo.difference)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Esta informação foi registrada para controle. Você pode ajustar
                novamente se necessário.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowDiffWarning(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
