import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDownRight,
  Banknote,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Eye,
  FileText,
  Loader2,
  Receipt,
  Search,
  TrendingUp,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
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
  upcomingReceivables: Receivable[];
  overdueReceivables: Receivable[];
}

export default function ContasReceberPage() {
  const { isAdmin, isSales } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedReceivable, setSelectedReceivable] =
    useState<ReceivableWithDetails | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
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

  const showPage = isAdmin || isSales;

  // Dashboard query
  const { data: dashboard, isLoading: dashboardLoading } =
    useQuery<ReceivableDashboard>({
      queryKey: ["/api/receivables/dashboard"],
      enabled: showPage,
    });

  // Lista de receivables
  const { data: receivablesData, isLoading: receivablesLoading } = useQuery<
    Receivable[]
  >({
    queryKey: ["/api/receivables"],
    enabled: showPage,
  });

  // Lista de clientes para resolver nomes
  const { data: customersData = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: showPage,
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
        },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/receivables/dashboard"],
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
      toast({
        title: "Conta cancelada",
        description: "A conta a receber foi cancelada.",
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
  };

  const openPaymentModal = async (receivable: Receivable) => {
    // Buscar detalhes completos
    try {
      const res = await apiRequest("GET", `/api/receivables/${receivable.id}`);
      const details: ReceivableWithDetails = await res.json();
      setSelectedReceivable(details);
      setPaymentAmount(details.amountRemaining);
      setShowPaymentModal(true);
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os detalhes.",
        variant: "destructive",
      });
    }
  };

  const openDetailsModal = async (receivable: Receivable) => {
    try {
      const res = await apiRequest("GET", `/api/receivables/${receivable.id}`);
      const details: ReceivableWithDetails = await res.json();
      setSelectedReceivable(details);
      setShowDetailsModal(true);
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os detalhes.",
        variant: "destructive",
      });
    }
  };

  const handlePayment = () => {
    if (!selectedReceivable) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Valor inválido",
        description: "Informe um valor válido para o pagamento.",
        variant: "destructive",
      });
      return;
    }

    paymentMutation.mutate({
      receivableId: selectedReceivable.id,
      amount,
      paymentMethod,
      paymentDate,
      notes: paymentNotes || undefined,
      installmentId: selectedInstallmentId || undefined,
    });
  };

  // Filtrar receivables
  const filteredReceivables = useMemo(() => {
    if (!receivablesData) return [];
    return receivablesData.filter((r) => {
      // Filtro de status
      if (statusFilter !== "ALL") {
        if (statusFilter === "VENCIDA") {
          if (!r.isOverdue || r.status === "PAGA" || r.status === "CANCELADA")
            return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
      }
      // Filtro de busca
      if (searchTerm) {
        const customerName = getCustomerName(r.customerId).toLowerCase();
        const search = searchTerm.toLowerCase();
        if (
          !customerName.includes(search) &&
          !r.receivableNumber.toLowerCase().includes(search) &&
          !(r.description || "").toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [receivablesData, statusFilter, searchTerm, customersData]);

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
            <TabsTrigger value="vencimentos" className="gap-2">
              <Calendar className="h-4 w-4" />
              Vencimentos
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="m-0 p-4">
            {dashboardLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : dashboard ? (
              <div className="space-y-6">
                {/* Cards de resumo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Total a Receber
                          </p>
                          <p className="text-2xl font-bold text-primary">
                            {formatPrice(dashboard.overview.totalPending)}
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Wallet className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Vencidos
                          </p>
                          <p className="text-2xl font-bold text-red-600">
                            {formatPrice(dashboard.overview.totalOverdue)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {dashboard.overview.overdueCount} títulos
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Total Recebido
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatPrice(dashboard.overview.totalReceived)}
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Total de Títulos
                          </p>
                          <p className="text-2xl font-bold">
                            {dashboard.overview.receivablesCount}
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <Receipt className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Listas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Vencidos */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Títulos Vencidos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboard.overdueReceivables.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum título vencido
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {dashboard.overdueReceivables
                            .slice(0, 5)
                            .map((rec) => (
                              <div
                                key={rec.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-red-500/5"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <UserIcon className="h-4 w-4 text-red-500" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">
                                      {getCustomerName(rec.customerId)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {rec.description || rec.receivableNumber}{" "}
                                      • Venceu{" "}
                                      {differenceInDays(
                                        new Date(),
                                        new Date(rec.dueDate),
                                      )}{" "}
                                      dias
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-red-600">
                                    {formatPrice(rec.amountRemaining)}
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-xs"
                                    onClick={() => openPaymentModal(rec)}
                                  >
                                    Receber
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Próximos vencimentos */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-500" />
                        Próximos Vencimentos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboard.upcomingReceivables.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum vencimento próximo
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {dashboard.upcomingReceivables
                            .slice(0, 5)
                            .map((rec) => {
                              const daysUntil = differenceInDays(
                                new Date(rec.dueDate),
                                new Date(),
                              );
                              return (
                                <div
                                  key={rec.id}
                                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                      <UserIcon className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm">
                                        {getCustomerName(rec.customerId)}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Vence em {daysUntil} dias (
                                        {formatDate(rec.dueDate)})
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold">
                                      {formatPrice(rec.amountRemaining)}
                                    </p>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-xs"
                                      onClick={() => openPaymentModal(rec)}
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
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-base">
                    Todos os Títulos a Receber
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
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {receivablesLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredReceivables.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum título encontrado</p>
                    <p className="text-sm">
                      Os títulos são gerados automaticamente ao faturar pedidos
                      com pagamento a prazo
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Histórico</TableHead>
                        <TableHead>Forma Pagamento</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReceivables.map((rec) => (
                        <TableRow key={rec.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <UserIcon className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-medium">
                                {getCustomerName(rec.customerId)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">
                                {rec.description || rec.receivableNumber}
                              </p>
                              {rec.orderId && (
                                <Link
                                  href={`/order-details/${rec.orderId}`}
                                  className="text-xs text-primary hover:underline"
                                >
                                  Pedido #{rec.orderId}
                                </Link>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              A prazo
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(rec.dueDate)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPrice(rec.amountRemaining)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(rec.status, rec.isOverdue)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDetailsModal(rec)}
                                title="Ver detalhes"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {rec.status !== "PAGA" &&
                                rec.status !== "CANCELADA" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600"
                                    onClick={() => openPaymentModal(rec)}
                                    title="Receber"
                                  >
                                    <Banknote className="h-4 w-4" />
                                  </Button>
                                )}
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

          {/* Vencimentos Tab */}
          <TabsContent value="vencimentos" className="m-0 p-4">
            <div className="space-y-4">
              {/* Vencidos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    Vencidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard?.overdueReceivables.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum título vencido
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard?.overdueReceivables.map((rec) => (
                        <div
                          key={rec.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 hover:bg-red-500/10"
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">
                                {getCustomerName(rec.customerId)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {rec.description || rec.receivableNumber} •
                                Venceu em {formatDate(rec.dueDate)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold text-red-600">
                                {formatPrice(rec.amountRemaining)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => openPaymentModal(rec)}
                            >
                              <Banknote className="h-4 w-4 mr-1" />
                              Receber
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* A vencer */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />A Vencer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard?.upcomingReceivables.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum título a vencer
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard?.upcomingReceivables.map((rec) => {
                        const daysUntil = differenceInDays(
                          new Date(rec.dueDate),
                          new Date(),
                        );
                        return (
                          <div
                            key={rec.id}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30"
                          >
                            <div>
                              <p className="font-medium">
                                {getCustomerName(rec.customerId)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {rec.description || rec.receivableNumber} •
                                Vence em {daysUntil} dias
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-semibold">
                                  {formatPrice(rec.amountRemaining)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(rec.dueDate)}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPaymentModal(rec)}
                              >
                                <Banknote className="h-4 w-4 mr-1" />
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
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Modal de Pagamento */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Registrar Pagamento
            </DialogTitle>
          </DialogHeader>

          {selectedReceivable && (
            <div className="space-y-4">
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
                  <Label className="text-sm">Parcela (opcional)</Label>
                  <Select
                    value={selectedInstallmentId?.toString() || "all"}
                    onValueChange={(v) =>
                      setSelectedInstallmentId(v === "all" ? null : parseInt(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma parcela" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Pagamento geral</SelectItem>
                      {selectedReceivable.installments
                        .filter((inst) => inst.status !== "PAGA")
                        .map((inst) => (
                          <SelectItem key={inst.id} value={inst.id.toString()}>
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
                    variant={paymentType === "PARCIAL" ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setPaymentType("PARCIAL")}
                  >
                    <ArrowDownRight className="h-4 w-4 mr-2" />
                    Parcial
                  </Button>
                </div>
              </div>

              {/* Valor */}
              <div className="space-y-2">
                <Label htmlFor="amount">Valor do Pagamento</Label>
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

              {/* Forma de pagamento */}
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                    <SelectItem value="Pix">Pix</SelectItem>
                    <SelectItem value="Transferência">Transferência</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Cartão">Cartão</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data */}
              <div className="space-y-2">
                <Label htmlFor="date">Data do Pagamento</Label>
                <Input
                  id="date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Referência, nº do comprovante..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
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
              Confirmar Pagamento
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
    </div>
  );
}
