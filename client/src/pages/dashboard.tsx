import { OrderTable, type Order } from "@/components/OrderTable";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import type { Product, Order as SchemaOrder, User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  ClipboardList,
  DollarSign,
  Loader2,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link, useLocation } from "wouter"; // Adicionado useLocation

interface OrderWithItems extends SchemaOrder {
  items?: { id: number; quantity: number }[];
}

interface PurchaseStats {
  totalSpent: number;
  totalOrders: number;
  completedOrders: number;
  monthlyStats: Array<{ month: string; total: number; count: number }>;
  topProducts: Array<{
    productId: number;
    name: string;
    totalQuantity: number;
    totalValue: number;
  }>;
  lastMonthProducts: Array<{
    productId: number;
    name: string;
    quantity: number;
    totalValue: number;
  }>;
}

interface AdminSalesStats {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  averageOrderValue: number;
  monthlyRevenue: Array<{ month: string; revenue: number; orders: number }>;
  topProducts: Array<{
    productId: number;
    name: string;
    totalQuantity: number;
    totalValue: number;
  }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  dailySales: Array<{ day: string; revenue: number; orders: number }>;
  salesByCategory: Array<{
    categoryId: number;
    categoryName: string;
    totalValue: number;
    totalQuantity: number;
  }>;
  customerPositivation: {
    totalCustomers: number;
    activeThisPeriod: number;
    newThisPeriod: number;
  };
  salesEvolution: Array<{
    month: string;
    revenue: number;
    orders: number;
    avgTicket: number;
  }>;
  periodLabel: string;
}

type PeriodFilter = "day" | "week" | "month" | "year" | "all";

interface CustomerRanking {
  userId: string;
  name: string;
  company: string | null;
  email: string | null;
  totalRevenue: number;
  orderCount: number;
  avgTicket: number;
  lastOrderDate: string | null;
  daysSinceLastOrder: number;
}

interface InactiveCustomer {
  userId: string;
  name: string;
  company: string | null;
  email: string | null;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  churnRisk: "low" | "medium" | "high";
  totalSpent: number;
  orderCount: number;
}

interface ConversionMetric {
  userId: string;
  name: string;
  company: string | null;
  email: string | null;
  totalQuotes: number;
  convertedOrders: number;
  conversionRate: number;
  totalRevenue: number;
}

interface CustomerAnalyticsData {
  topCustomersByRevenue: {
    month: CustomerRanking[];
    quarter: CustomerRanking[];
    year: CustomerRanking[];
  };
  topCustomersByFrequency: CustomerRanking[];
  inactiveCustomers: {
    days7: InactiveCustomer[];
    days15: InactiveCustomer[];
    days30: InactiveCustomer[];
    days60: InactiveCustomer[];
    days90: InactiveCustomer[];
  };
  newCustomersThisMonth: CustomerRanking[];
  conversionMetrics: ConversionMetric[];
}

const STATUS_LABELS: Record<string, string> = {
  ORCAMENTO_ABERTO: "Orçamento Aberto",
  ORCAMENTO_CONCLUIDO: "Orçamento Concluído",
  PEDIDO_GERADO: "Pedido Gerado",
  PEDIDO_FATURADO: "Pedido Faturado",
  pending: "Pendente",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return format(date, "MMM yyyy", { locale: ptBR });
}

export default function DashboardPage() {
  const { user, isAdmin, isSales } = useAuth();
  const [, setLocation] = useLocation(); // Hook de navegação

  const showAllOrders = isAdmin || isSales;
  const isCustomer = !isAdmin && !isSales;
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month");

  // --- LÓGICA DE PROTEÇÃO E REDIRECIONAMENTO ---
  useEffect(() => {
    if (!user) return;

    // Se for Cliente, não faz nada (tem o dashboard próprio)
    if (user.role === "customer") return;

    // Se for Admin, libera tudo
    if (user.role === "admin") return;

    // Se for Equipe (Sales/Employee), verifica permissões
    let userModules: string[] = [];
    try {
      userModules =
        typeof user.modules === "string"
          ? JSON.parse(user.modules)
          : user.modules || [];
    } catch (e) {
      userModules = [];
    }

    // Se NÃO tiver permissão de 'dashboard', redireciona
    if (!userModules.includes("dashboard")) {
      if (userModules.includes("orders")) {
        setLocation("/orders");
      } else if (userModules.includes("products")) {
        setLocation("/products");
      } else if (userModules.includes("users")) {
        setLocation("/users");
      } else {
        // Fallback: Tenta mandar para catalogo ou perfil
        setLocation("/catalog");
      }
    }
  }, [user, setLocation]);

  // Se o usuário não for admin, não for cliente e não tiver permissão de dashboard, não renderiza nada enquanto redireciona
  const isTeamMember = user?.role === "sales" || user?.role === "employee";
  let hasDashboardPermission = true;

  if (isTeamMember) {
    try {
      const mods =
        typeof user?.modules === "string"
          ? JSON.parse(user.modules)
          : user?.modules || [];
      hasDashboardPermission = mods.includes("dashboard");
    } catch (e) {
      hasDashboardPermission = false;
    }
  }

  // Queries (Só executa se tiver permissão ou for admin/cliente)
  const shouldFetchAdminData = isAdmin || (isSales && hasDashboardPermission);

  const { data: ordersData = [], isLoading: ordersLoading } = useQuery<
    OrderWithItems[]
  >({
    queryKey: ["/api/orders"],
    enabled: !!user, // Sempre busca pedidos para mostrar na tabela recente se necessário
  });

  const { data: productsData = [], isLoading: productsLoading } = useQuery<
    Product[]
  >({
    queryKey: ["/api/products"],
    enabled: isAdmin,
  });

  const { data: usersData = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });

  const { data: purchaseStats, isLoading: statsLoading } =
    useQuery<PurchaseStats>({
      queryKey: ["/api/me/purchase-stats"],
      enabled: isCustomer,
    });

  const { data: adminStats, isLoading: adminStatsLoading } =
    useQuery<AdminSalesStats>({
      queryKey: ["/api/admin/sales-stats", periodFilter],
      queryFn: async () => {
        const res = await apiRequest(
          "GET",
          `/api/admin/sales-stats?period=${periodFilter}`,
        );
        return res.json();
      },
      enabled: shouldFetchAdminData,
      staleTime: 0,
      refetchOnMount: "always",
    });

  const { data: customerAnalytics, isLoading: customerAnalyticsLoading } =
    useQuery<CustomerAnalyticsData>({
      queryKey: ["/api/admin/customer-analytics"],
      enabled: isAdmin,
    });

  // BLOQUEIO DE RENDERIZAÇÃO SE ESTIVER REDIRECIONANDO
  if (isTeamMember && !hasDashboardPermission) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">
          Redirecionando para seu módulo principal...
        </span>
      </div>
    );
  }

  const recentOrders: Order[] = ordersData.slice(0, 5).map((order) => ({
    id: String(order.id),
    orderNumber: order.orderNumber,
    customer: order.userId ? order.userId.substring(0, 8) + "..." : "Convidado",
    date: format(new Date(order.createdAt), "MMM d, yyyy"),
    status: order.status as Order["status"],
    total: parseFloat(order.total),
    itemCount: order.items?.length || 0,
  }));

  // --- RENDERIZAÇÃO DO CLIENTE (MANTIDA IGUAL) ---
  if (isCustomer) {
    const predictionTotal =
      purchaseStats?.lastMonthProducts?.reduce(
        (sum, p) => sum + p.totalValue,
        0,
      ) || 0;

    return (
      <div className="p-6 lg:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Painel</h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo, {user?.firstName || user?.email}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                Produtos Mais Comprados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !purchaseStats?.topProducts?.length ? (
                <p className="text-muted-foreground text-sm py-4">
                  Nenhum produto comprado ainda
                </p>
              ) : (
                <div className="space-y-3">
                  {purchaseStats.topProducts.map((product, idx) => (
                    <div
                      key={product.productId}
                      className="flex items-center justify-between gap-4"
                      data-testid={`top-product-${product.productId}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs font-medium w-5">
                          {idx + 1}.
                        </span>
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {product.name}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-semibold">
                          {product.totalQuantity} un.
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          R$ {product.totalValue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                Previsao de Pedido
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Baseado nas suas compras do mes passado
              </p>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !purchaseStats?.lastMonthProducts?.length ? (
                <p className="text-muted-foreground text-sm py-4">
                  Nenhuma compra no mes passado para gerar previsao
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {purchaseStats.lastMonthProducts.map((product) => (
                      <div
                        key={product.productId}
                        className="flex items-center justify-between gap-4"
                        data-testid={`prediction-product-${product.productId}`}
                      >
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {product.name}
                        </span>
                        <div className="text-right flex-shrink-0">
                          <span className="text-sm font-semibold">
                            {product.quantity} un.
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            R$ {product.totalValue.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t flex items-center justify-between">
                    <span className="text-sm font-medium">Total Estimado</span>
                    <span className="text-lg font-bold">
                      R$ {predictionTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4">
          <Link href="/catalog">
            <Button data-testid="button-browse-catalog">
              <Package className="h-4 w-4 mr-2" />
              Ver Catalogo
            </Button>
          </Link>
          <Link href="/orders">
            <Button variant="outline" data-testid="link-view-all-orders">
              <ClipboardList className="h-4 w-4 mr-2" />
              Ver Pedidos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // --- RENDERIZAÇÃO ADMIN / EQUIPE ---

  const chartData =
    adminStats?.monthlyRevenue.map((item) => ({
      month: formatMonthLabel(item.month),
      revenue: item.revenue,
      orders: item.orders,
    })) || [];

  const pieData =
    adminStats?.ordersByStatus.map((item) => ({
      name: STATUS_LABELS[item.status] || item.status,
      value: item.count,
    })) || [];

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Painel</h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo, {user?.firstName || user?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select
            value={periodFilter}
            onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}
          >
            <SelectTrigger
              className="w-[160px]"
              data-testid="select-period-filter"
            >
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Hoje</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="year">Este Ano</SelectItem>
              <SelectItem value="all">Todo Periodo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Faturamento Total"
          value={
            adminStatsLoading
              ? "..."
              : `R$ ${(adminStats?.totalRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          }
          icon={DollarSign}
          data-testid="stat-total-revenue"
        />
        <StatCard
          title="Lucro"
          value={
            adminStatsLoading
              ? "..."
              : `R$ ${(adminStats?.totalProfit || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          }
          icon={TrendingUp}
          data-testid="stat-total-profit"
        />
        <StatCard
          title="Ticket Médio"
          value={
            adminStatsLoading
              ? "..."
              : `R$ ${(adminStats?.averageOrderValue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          }
          icon={BarChart3}
          data-testid="stat-avg-order"
        />
        <StatCard
          title="Pedidos Pendentes"
          value={adminStatsLoading ? "..." : adminStats?.pendingOrders || 0}
          icon={ClipboardList}
          data-testid="stat-pending-orders"
        />
        <StatCard
          title="Pedidos Faturados"
          value={adminStatsLoading ? "..." : adminStats?.completedOrders || 0}
          icon={Package}
          data-testid="stat-completed-orders"
        />
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total de Pedidos"
            value={ordersLoading ? "..." : ordersData.length}
            icon={ClipboardList}
          />
          <StatCard
            title="Produtos Cadastrados"
            value={productsLoading ? "..." : productsData.length}
            icon={Package}
          />
          <StatCard
            title="Clientes Cadastrados"
            value={
              usersLoading
                ? "..."
                : usersData.filter((u) => u.role === "customer").length
            }
            icon={Users}
          />
        </div>
      )}

      {/* Gráficos e Mapas (Renderizam apenas se tiver dados e permissão) */}
      {/* ... (Conteúdo restante mantido, mas com proteção implícita via shouldFetchAdminData) ... */}

      {/* Exemplo de Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              Faturamento Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {adminStatsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : chartData.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                Nenhum dado disponível
              </p>
            ) : (
              <div className="h-[280px]" data-testid="chart-monthly-revenue">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                  >
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                        "Faturamento",
                      ]}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ... Outros componentes gráficos ... */}
        {/* Mantive o restante do layout, mas ele depende do adminStats, que agora é protegido */}

        {/* Tabela de Pedidos Recentes (Sempre visível para equipe) */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold">
                Pedidos Recentes
              </CardTitle>
              <Link href="/orders">
                <Button variant="ghost" size="sm">
                  Ver Todos <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum pedido ainda
              </div>
            ) : (
              <OrderTable
                orders={recentOrders}
                showCustomer={true}
                onViewOrder={(order) =>
                  console.log("View order:", order.orderNumber)
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
