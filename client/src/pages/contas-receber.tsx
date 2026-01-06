import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { User, CustomerCredit, CreditPayment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Wallet,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  Plus,
  Search,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  User as UserIcon,
  Building2,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Calculator,
  Receipt,
  X,
  ChevronRight,
  Banknote
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CreditsDashboard {
  overview: {
    totalInCirculation: number;
    totalPending: number;
    totalPaid: number;
    totalOverdue: number;
    customersWithDebt: number;
    averageDebtPerCustomer: number;
  };
  customerSummaries: Array<{
    userId: string;
    userName: string;
    company: string | null;
    totalDebt: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    nextDueDate: Date | null;
    creditCount: number;
  }>;
  upcomingPayments: Array<{
    creditId: number;
    userId: string;
    userName: string;
    company: string | null;
    amount: number;
    pendingAmount: number;
    dueDate: Date;
    daysUntilDue: number;
    status: string;
  }>;
  overduePayments: Array<{
    creditId: number;
    userId: string;
    userName: string;
    company: string | null;
    amount: number;
    pendingAmount: number;
    dueDate: Date;
    daysUntilDue: number;
    status: string;
  }>;
  recentPayments: Array<{
    paymentId: number;
    creditId: number;
    userId: string;
    userName: string;
    amount: number;
    paymentMethod: string | null;
    createdAt: Date;
  }>;
}

export default function ContasReceberPage() {
  const { isAdmin, isSales } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showNewDebtModal, setShowNewDebtModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState<number | null>(null);

  const showPage = isAdmin || isSales;

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<CreditsDashboard>({
    queryKey: ['/api/credits/dashboard'],
    enabled: showPage,
  });

  const { data: customersData = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: showPage,
  });

  const { data: customerCreditsData } = useQuery<{ credits: CustomerCredit[]; balance: { total: number; pending: number; paid: number } }>({
    queryKey: ['/api/credits/customer', selectedCustomerId],
    enabled: !!selectedCustomerId,
  });

  const approvedCustomers = customersData.filter(u => u.approved && u.role === "customer");

  const filteredCustomers = customerSearch.length > 0
    ? approvedCustomers.filter(c =>
        (c.firstName?.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.lastName?.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.company?.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.tradingName?.toLowerCase().includes(customerSearch.toLowerCase()))
      )
    : approvedCustomers;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: Date | string) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAGO':
        return <Badge className="bg-green-500/20 text-green-600">Pago</Badge>;
      case 'PARCIAL':
        return <Badge className="bg-yellow-500/20 text-yellow-600">Parcial</Badge>;
      case 'VENCIDO':
        return <Badge className="bg-red-500/20 text-red-600">Vencido</Badge>;
      case 'PENDENTE':
        return <Badge className="bg-blue-500/20 text-blue-600">Pendente</Badge>;
      case 'CANCELADO':
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!showPage) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso nao autorizado</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Contas a Receber</h1>
              <p className="text-sm text-muted-foreground">Gerenciamento de credito de clientes</p>
            </div>
          </div>
          <Button onClick={() => setShowNewDebtModal(true)} data-testid="button-new-debt">
            <Plus className="h-4 w-4 mr-2" />
            Novo Lancamento
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b px-4">
          <TabsList className="bg-transparent h-12">
            <TabsTrigger value="dashboard" className="gap-2" data-testid="tab-fiado-dashboard">
              <TrendingUp className="h-4 w-4" />
              Visao Geral
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2" data-testid="tab-fiado-customers">
              <Users className="h-4 w-4" />
              Por Cliente
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-2" data-testid="tab-fiado-upcoming">
              <Calendar className="h-4 w-4" />
              Vencimentos
            </TabsTrigger>
            <TabsTrigger value="calculator" className="gap-2" data-testid="tab-fiado-calculator">
              <Calculator className="h-4 w-4" />
              Calculadora
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value="dashboard" className="m-0 p-4">
            {dashboardLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : dashboard ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total na Rua</p>
                          <p className="text-2xl font-bold text-primary" data-testid="text-total-pending">
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
                          <p className="text-sm text-muted-foreground">Vencido</p>
                          <p className="text-2xl font-bold text-red-600" data-testid="text-total-overdue">
                            {formatPrice(dashboard.overview.totalOverdue)}
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
                          <p className="text-sm text-muted-foreground">Total Recebido</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatPrice(dashboard.overview.totalPaid)}
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
                          <p className="text-sm text-muted-foreground">Clientes com Divida</p>
                          <p className="text-2xl font-bold">{dashboard.overview.customersWithDebt}</p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Pagamentos Vencidos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboard.overduePayments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum pagamento vencido</p>
                      ) : (
                        <div className="space-y-3">
                          {dashboard.overduePayments.slice(0, 5).map((payment) => (
                            <div key={payment.creditId} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                                  <UserIcon className="h-4 w-4 text-red-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{payment.userName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Venceu {formatDistanceToNow(new Date(payment.dueDate), { addSuffix: true, locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-red-600">{formatPrice(payment.pendingAmount)}</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-xs"
                                  onClick={() => {
                                    setSelectedCreditId(payment.creditId);
                                    setShowPaymentModal(true);
                                  }}
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

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-500" />
                        Proximos Vencimentos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboard.upcomingPayments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum vencimento proximo</p>
                      ) : (
                        <div className="space-y-3">
                          {dashboard.upcomingPayments.slice(0, 5).map((payment) => (
                            <div key={payment.creditId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <UserIcon className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{payment.userName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Vence em {payment.daysUntilDue} dias ({formatDate(payment.dueDate)})
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{formatPrice(payment.pendingAmount)}</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-xs"
                                  onClick={() => {
                                    setSelectedCreditId(payment.creditId);
                                    setShowPaymentModal(true);
                                  }}
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
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Ultimos Pagamentos Recebidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboard.recentPayments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum pagamento recente</p>
                    ) : (
                      <div className="space-y-2">
                        {dashboard.recentPayments.map((payment) => (
                          <div key={payment.paymentId} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                <ArrowDownRight className="h-4 w-4 text-green-500" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{payment.userName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {payment.paymentMethod || 'Pagamento'} - {formatDate(payment.createdAt)}
                                </p>
                              </div>
                            </div>
                            <p className="font-semibold text-green-600">+{formatPrice(payment.amount)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Clientes com Maior Divida
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboard.customerSummaries.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente com divida</p>
                    ) : (
                      <div className="space-y-2">
                        {dashboard.customerSummaries.slice(0, 10).map((customer) => (
                          <div
                            key={customer.userId}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 cursor-pointer"
                            onClick={() => {
                              setSelectedCustomerId(customer.userId);
                              setActiveTab("customers");
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <UserIcon className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{customer.userName}</p>
                                {customer.company && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {customer.company}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-4">
                              <div>
                                <p className="font-semibold text-primary">{formatPrice(customer.pendingAmount)}</p>
                                {customer.overdueAmount > 0 && (
                                  <p className="text-xs text-red-500">{formatPrice(customer.overdueAmount)} vencido</p>
                                )}
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="customers" className="m-0 p-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1">
                <Card className="h-fit">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Clientes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente..."
                        className="pl-10"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        data-testid="input-fiado-customer-search"
                      />
                    </div>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-1">
                        {filteredCustomers.map((customer) => {
                          const summary = dashboard?.customerSummaries.find(s => s.userId === customer.id);
                          return (
                            <div
                              key={customer.id}
                              className={`p-3 rounded-lg cursor-pointer transition-all ${
                                selectedCustomerId === customer.id
                                  ? 'bg-primary/10 ring-1 ring-primary'
                                  : 'hover:bg-muted/50'
                              }`}
                              onClick={() => setSelectedCustomerId(customer.id)}
                              data-testid={`card-fiado-customer-${customer.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{customer.firstName} {customer.lastName}</p>
                                  <p className="text-xs text-muted-foreground">{customer.company || customer.tradingName}</p>
                                </div>
                                {summary && summary.pendingAmount > 0 && (
                                  <Badge className={summary.overdueAmount > 0 ? 'bg-red-500/20 text-red-600' : 'bg-primary/20 text-primary'}>
                                    {formatPrice(summary.pendingAmount)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                {selectedCustomerId ? (
                  <CustomerCreditDetails
                    customerId={selectedCustomerId}
                    customer={customersData.find(c => c.id === selectedCustomerId)}
                    creditsData={customerCreditsData}
                    onPayment={(creditId) => {
                      setSelectedCreditId(creditId);
                      setShowPaymentModal(true);
                    }}
                    onNewDebt={() => setShowNewDebtModal(true)}
                  />
                ) : (
                  <Card className="h-full flex items-center justify-center">
                    <div className="text-center py-20 text-muted-foreground">
                      <UserIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>Selecione um cliente para ver detalhes</p>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="upcoming" className="m-0 p-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Calendario de Vencimentos</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard && (
                  <div className="space-y-6">
                    {dashboard.overduePayments.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-red-600 mb-3 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Vencidos ({dashboard.overduePayments.length})
                        </h3>
                        <div className="space-y-2">
                          {dashboard.overduePayments.map((payment) => (
                            <div key={payment.creditId} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                  <UserIcon className="h-5 w-5 text-red-500" />
                                </div>
                                <div>
                                  <p className="font-medium">{payment.userName}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Venceu em {formatDate(payment.dueDate)} ({Math.abs(payment.daysUntilDue)} dias)
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <p className="font-semibold text-red-600">{formatPrice(payment.pendingAmount)}</p>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCreditId(payment.creditId);
                                    setShowPaymentModal(true);
                                  }}
                                >
                                  Receber
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {dashboard.upcomingPayments.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Proximos Vencimentos ({dashboard.upcomingPayments.length})
                        </h3>
                        <div className="space-y-2">
                          {dashboard.upcomingPayments.map((payment) => (
                            <div key={payment.creditId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <UserIcon className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{payment.userName}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Vence em {formatDate(payment.dueDate)} ({payment.daysUntilDue} dias)
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <p className="font-semibold">{formatPrice(payment.pendingAmount)}</p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedCreditId(payment.creditId);
                                    setShowPaymentModal(true);
                                  }}
                                >
                                  Receber
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {dashboard.overduePayments.length === 0 && dashboard.upcomingPayments.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhum vencimento pendente</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calculator" className="m-0 p-4">
            <DebtCalculator />
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <NewDebtModal
        open={showNewDebtModal}
        onClose={() => setShowNewDebtModal(false)}
        customers={approvedCustomers}
        preselectedCustomerId={selectedCustomerId}
      />

      <PaymentModal
        open={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedCreditId(null);
        }}
        creditId={selectedCreditId}
      />
    </div>
  );
}

function CustomerCreditDetails({
  customerId,
  customer,
  creditsData,
  onPayment,
  onNewDebt
}: {
  customerId: string;
  customer?: User;
  creditsData?: { credits: CustomerCredit[]; balance: { total: number; pending: number; paid: number } };
  onPayment: (creditId: number) => void;
  onNewDebt: () => void;
}) {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: Date | string) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAGO':
        return <Badge className="bg-green-500/20 text-green-600">Pago</Badge>;
      case 'PARCIAL':
        return <Badge className="bg-yellow-500/20 text-yellow-600">Parcial</Badge>;
      case 'VENCIDO':
        return <Badge className="bg-red-500/20 text-red-600">Vencido</Badge>;
      case 'PENDENTE':
        return <Badge className="bg-blue-500/20 text-blue-600">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!customer || !creditsData) {
    return (
      <Card className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{customer.firstName} {customer.lastName}</CardTitle>
              <p className="text-sm text-muted-foreground">{customer.company || customer.tradingName}</p>
            </div>
          </div>
          <Button onClick={onNewDebt} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Lancamento
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-xl font-bold">{formatPrice(creditsData.balance.total)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-green-500/10">
            <p className="text-sm text-muted-foreground">Pago</p>
            <p className="text-xl font-bold text-green-600">{formatPrice(creditsData.balance.paid)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-primary/10">
            <p className="text-sm text-muted-foreground">Pendente</p>
            <p className="text-xl font-bold text-primary">{formatPrice(creditsData.balance.pending)}</p>
          </div>
        </div>

        <Separator className="my-4" />

        <h4 className="font-semibold mb-3">Historico de Lancamentos</h4>
        <ScrollArea className="h-[300px]">
          {creditsData.credits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum lancamento encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {creditsData.credits.map((credit) => {
                const amount = parseFloat(credit.amount);
                const paidAmount = parseFloat(credit.paidAmount);
                const pendingAmount = amount - paidAmount;
                const isOverdue = credit.dueDate && new Date(credit.dueDate) < new Date() && credit.status !== 'PAGO';

                return (
                  <div
                    key={credit.id}
                    className={`p-4 rounded-lg border ${isOverdue ? 'border-red-500/30 bg-red-500/5' : 'bg-muted/30'}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {credit.type === 'DEBITO' ? (
                          <ArrowUpRight className="h-4 w-4 text-red-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-green-500" />
                        )}
                        <span className="font-medium">
                          {credit.type === 'DEBITO' ? 'Debito' : 'Credito'}
                        </span>
                        {getStatusBadge(isOverdue ? 'VENCIDO' : credit.status)}
                      </div>
                      <p className={`font-bold ${credit.type === 'DEBITO' ? 'text-red-600' : 'text-green-600'}`}>
                        {credit.type === 'DEBITO' ? '-' : '+'}{formatPrice(amount)}
                      </p>
                    </div>

                    {credit.description && (
                      <p className="text-sm text-muted-foreground mb-2">{credit.description}</p>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span>Criado: {formatDate(credit.createdAt)}</span>
                        {credit.dueDate && (
                          <span className={isOverdue ? 'text-red-500' : ''}>
                            Vence: {formatDate(credit.dueDate)}
                          </span>
                        )}
                      </div>
                      {credit.type === 'DEBITO' && credit.status !== 'PAGO' && pendingAmount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => onPayment(credit.id)}
                        >
                          <Banknote className="h-3 w-3 mr-1" />
                          Receber {formatPrice(pendingAmount)}
                        </Button>
                      )}
                    </div>

                    {credit.type === 'DEBITO' && paidAmount > 0 && (
                      <div className="mt-2 pt-2 border-t text-xs">
                        <p className="text-muted-foreground">
                          Pago: {formatPrice(paidAmount)} de {formatPrice(amount)}
                        </p>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                          <div
                            className="bg-green-500 h-1.5 rounded-full"
                            style={{ width: `${(paidAmount / amount) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function NewDebtModal({
  open,
  onClose,
  customers,
  preselectedCustomerId
}: {
  open: boolean;
  onClose: () => void;
  customers: User[];
  preselectedCustomerId: string | null;
}) {
  const { toast } = useToast();
  const [selectedCustomer, setSelectedCustomer] = useState<string>(preselectedCustomerId || "");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [type, setType] = useState<string>("DEBITO");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.firstName?.toLowerCase().includes(search) ||
      c.lastName?.toLowerCase().includes(search) ||
      c.company?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search)
    );
  }, [customers, customerSearch]);

  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  const createMutation = useMutation({
    mutationFn: async (data: { userId: string; type: string; amount: string; description?: string; dueDate?: string }) => {
      await apiRequest("POST", "/api/credits", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/credits/dashboard'] });
      toast({ title: "Sucesso", description: "Lancamento criado com sucesso" });
      onClose();
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setSelectedCustomer("");
    setCustomerSearch("");
    setType("DEBITO");
    setAmount("");
    setDescription("");
    setDueDate("");
  };

  const handleSubmit = () => {
    if (!selectedCustomer || !amount) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatorios", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      userId: selectedCustomer,
      type,
      amount,
      description: description || undefined,
      dueDate: dueDate || undefined
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Novo Lancamento de Fiado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Cliente *</Label>
            <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerSearchOpen}
                  className="w-full justify-between font-normal"
                  data-testid="select-new-debt-customer"
                >
                  {selectedCustomerData ? (
                    <span className="truncate">
                      {selectedCustomerData.firstName} {selectedCustomerData.lastName}
                      {selectedCustomerData.company && ` (${selectedCustomerData.company})`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Buscar cliente...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Digite para buscar..."
                    value={customerSearch}
                    onValueChange={setCustomerSearch}
                    data-testid="input-search-customer"
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredCustomers.slice(0, 50).map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={customer.id}
                          onSelect={() => {
                            setSelectedCustomer(customer.id);
                            setCustomerSearchOpen(false);
                          }}
                          data-testid={`option-customer-${customer.id}`}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCustomer === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{customer.firstName} {customer.lastName}</span>
                            {customer.company && (
                              <span className="text-xs text-muted-foreground">{customer.company}</span>
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

          <div>
            <Label>Tipo *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-new-debt-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEBITO">Debito (Compra no Fiado)</SelectItem>
                <SelectItem value="CREDITO">Credito (Ajuste/Devolucao)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Valor (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-new-debt-amount"
            />
          </div>

          <div>
            <Label>Data de Vencimento</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              data-testid="input-new-debt-duedate"
            />
          </div>

          <div>
            <Label>Descricao</Label>
            <Textarea
              placeholder="Descricao do lancamento..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-new-debt-description"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Lancamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentModal({
  open,
  onClose,
  creditId
}: {
  open: boolean;
  onClose: () => void;
  creditId: number | null;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const { data: creditData } = useQuery<{ credit: CustomerCredit; payments: CreditPayment[] }>({
    queryKey: ['/api/credits', creditId],
    enabled: !!creditId,
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: { amount: string; paymentMethod?: string; notes?: string }) => {
      await apiRequest("POST", `/api/credits/${creditId}/payments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/credits/dashboard'] });
      toast({ title: "Sucesso", description: "Pagamento registrado com sucesso" });
      onClose();
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setAmount("");
    setPaymentMethod("");
    setNotes("");
  };

  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Erro", description: "Informe um valor valido", variant: "destructive" });
      return;
    }
    paymentMutation.mutate({
      amount,
      paymentMethod: paymentMethod || undefined,
      notes: notes || undefined
    });
  };

  const pendingAmount = creditData
    ? parseFloat(creditData.credit.amount) - parseFloat(creditData.credit.paidAmount)
    : 0;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Registrar Pagamento
          </DialogTitle>
        </DialogHeader>

        {creditData && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted-foreground">Valor Total:</span>
                <span className="font-medium">{formatPrice(parseFloat(creditData.credit.amount))}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted-foreground">Ja Pago:</span>
                <span className="font-medium text-green-600">{formatPrice(parseFloat(creditData.credit.paidAmount))}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Restante:</span>
                <span className="font-bold text-primary">{formatPrice(pendingAmount)}</span>
              </div>
            </div>

            <div>
              <Label>Valor do Pagamento (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={pendingAmount}
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-payment-amount"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-xs text-muted-foreground"
                onClick={() => setAmount(pendingAmount.toFixed(2))}
              >
                Preencher valor total ({formatPrice(pendingAmount)})
              </Button>
            </div>

            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="CARTAO">Cartao</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observacoes</Label>
              <Textarea
                placeholder="Observacoes do pagamento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="input-payment-notes"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={paymentMutation.isPending}>
            {paymentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DebtCalculator() {
  const [principal, setPrincipal] = useState<string>("");
  const [interestRate, setInterestRate] = useState<string>("2");
  const [days, setDays] = useState<string>("30");
  const [interestType, setInterestType] = useState<string>("simple");

  const calculate = () => {
    const p = parseFloat(principal) || 0;
    const r = parseFloat(interestRate) / 100;
    const d = parseInt(days) || 0;
    const months = d / 30;

    if (interestType === "simple") {
      return p * (1 + r * months);
    } else {
      return p * Math.pow(1 + r, months);
    }
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const totalAmount = calculate();
  const interestAmount = totalAmount - (parseFloat(principal) || 0);

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculadora de Juros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Valor Principal (R$)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="1000,00"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              data-testid="input-calc-principal"
            />
          </div>

          <div>
            <Label>Taxa de Juros (% ao mes)</Label>
            <Input
              type="number"
              step="0.1"
              placeholder="2"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              data-testid="input-calc-rate"
            />
          </div>

          <div>
            <Label>Dias em Atraso</Label>
            <Input
              type="number"
              placeholder="30"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              data-testid="input-calc-days"
            />
          </div>

          <div>
            <Label>Tipo de Juros</Label>
            <Select value={interestType} onValueChange={setInterestType}>
              <SelectTrigger data-testid="select-calc-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Juros Simples</SelectItem>
                <SelectItem value="compound">Juros Compostos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor Principal:</span>
              <span>{formatPrice(parseFloat(principal) || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Juros:</span>
              <span className="text-red-600">+{formatPrice(interestAmount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total a Receber:</span>
              <span className="text-primary" data-testid="text-calc-total">{formatPrice(totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
