import { StatCard } from "@/components/StatCard";
import { OrderTable, type Order } from "@/components/OrderTable";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Package, ClipboardList, Users, ArrowRight, Loader2, TrendingUp, DollarSign, Calendar, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Order as SchemaOrder, Product, User } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

interface OrderWithItems extends SchemaOrder {
  items?: { id: number; quantity: number }[];
}

interface PurchaseStats {
  totalSpent: number;
  totalOrders: number;
  completedOrders: number;
  monthlyStats: Array<{ month: string; total: number; count: number }>;
  topProducts: Array<{ productId: number; name: string; totalQuantity: number; totalValue: number }>;
  lastMonthProducts: Array<{ productId: number; name: string; quantity: number; totalValue: number }>;
}

interface AdminSalesStats {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  averageOrderValue: number;
  monthlyRevenue: Array<{ month: string; revenue: number; orders: number }>;
  topProducts: Array<{ productId: number; name: string; totalQuantity: number; totalValue: number }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  dailySales: Array<{ day: string; revenue: number; orders: number }>;
  salesByCategory: Array<{ categoryId: number; categoryName: string; totalValue: number; totalQuantity: number }>;
  customerPositivation: { totalCustomers: number; activeThisMonth: number; newThisMonth: number };
  salesEvolution: Array<{ month: string; revenue: number; orders: number; avgTicket: number }>;
}

const STATUS_LABELS: Record<string, string> = {
  'ORCAMENTO_ABERTO': 'Orçamento Aberto',
  'ORCAMENTO_CONCLUIDO': 'Orçamento Concluído',
  'PEDIDO_GERADO': 'Pedido Gerado',
  'PEDIDO_FATURADO': 'Pedido Faturado',
  'pending': 'Pendente',
  'completed': 'Concluído',
  'cancelled': 'Cancelado',
};

const STATUS_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return format(date, "MMM yyyy", { locale: ptBR });
}

export default function DashboardPage() {
  const { user, isAdmin, isSales } = useAuth();
  const showAllOrders = isAdmin || isSales;
  const isCustomer = !isAdmin && !isSales;

  const { data: ordersData = [], isLoading: ordersLoading } = useQuery<OrderWithItems[]>({
    queryKey: ['/api/orders'],
  });

  const { data: productsData = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    enabled: isAdmin,
  });

  const { data: usersData = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: isAdmin,
  });

  const { data: purchaseStats, isLoading: statsLoading } = useQuery<PurchaseStats>({
    queryKey: ['/api/me/purchase-stats'],
    enabled: isCustomer,
  });

  const { data: adminStats, isLoading: adminStatsLoading } = useQuery<AdminSalesStats>({
    queryKey: ['/api/admin/sales-stats'],
    enabled: isAdmin || isSales,
  });

  const recentOrders: Order[] = ordersData.slice(0, 5).map((order) => ({
    id: String(order.id),
    orderNumber: order.orderNumber,
    customer: order.userId.substring(0, 8) + "...",
    date: format(new Date(order.createdAt), "MMM d, yyyy"),
    status: order.status as Order["status"],
    total: parseFloat(order.total),
    itemCount: order.items?.length || 0,
  }));

  const pendingOrdersCount = ordersData.filter(o => o.status === "pending" || o.status === "ORCAMENTO_ABERTO" || o.status === "ORCAMENTO_CONCLUIDO").length;
  const lastOrderDate = ordersData.length > 0 
    ? format(new Date(ordersData[0].createdAt), "dd MMM", { locale: ptBR })
    : "N/A";

  if (isCustomer) {
    const predictionTotal = purchaseStats?.lastMonthProducts?.reduce(
      (sum, p) => sum + p.totalValue, 0
    ) || 0;

    return (
      <div className="p-6 lg:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Painel</h1>
          <p className="text-muted-foreground mt-1">Bem-vindo, {user?.firstName || user?.email}</p>
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
                <p className="text-muted-foreground text-sm py-4">Nenhum produto comprado ainda</p>
              ) : (
                <div className="space-y-3">
                  {purchaseStats.topProducts.map((product, idx) => (
                    <div key={product.productId} className="flex items-center justify-between gap-4" data-testid={`top-product-${product.productId}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs font-medium w-5">{idx + 1}.</span>
                        <span className="text-sm font-medium truncate max-w-[200px]">{product.name}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-semibold">{product.totalQuantity} un.</span>
                        <span className="text-xs text-muted-foreground ml-2">R$ {product.totalValue.toFixed(2)}</span>
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
              <p className="text-xs text-muted-foreground">Baseado nas suas compras do mes passado</p>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !purchaseStats?.lastMonthProducts?.length ? (
                <p className="text-muted-foreground text-sm py-4">Nenhuma compra no mes passado para gerar previsao</p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {purchaseStats.lastMonthProducts.map((product) => (
                      <div key={product.productId} className="flex items-center justify-between gap-4" data-testid={`prediction-product-${product.productId}`}>
                        <span className="text-sm font-medium truncate max-w-[200px]">{product.name}</span>
                        <div className="text-right flex-shrink-0">
                          <span className="text-sm font-semibold">{product.quantity} un.</span>
                          <span className="text-xs text-muted-foreground ml-2">R$ {product.totalValue.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t flex items-center justify-between">
                    <span className="text-sm font-medium">Total Estimado</span>
                    <span className="text-lg font-bold">R$ {predictionTotal.toFixed(2)}</span>
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

  const chartData = adminStats?.monthlyRevenue.map(item => ({
    month: formatMonthLabel(item.month),
    revenue: item.revenue,
    orders: item.orders,
  })) || [];

  const pieData = adminStats?.ordersByStatus.map(item => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: item.count,
  })) || [];

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Painel</h1>
        <p className="text-muted-foreground mt-1">Bem-vindo, {user?.firstName || user?.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Faturamento Total"
          value={adminStatsLoading ? "..." : `R$ ${(adminStats?.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          data-testid="stat-total-revenue"
        />
        <StatCard
          title="Ticket Médio"
          value={adminStatsLoading ? "..." : `R$ ${(adminStats?.averageOrderValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
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
            value={usersLoading ? "..." : usersData.filter(u => u.role === "customer").length}
            icon={Users}
          />
        </div>
      )}

      {isAdmin && adminStats?.customerPositivation && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-customers">{adminStats.customerPositivation.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Ativos (Mes)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="stat-active-customers">{adminStats.customerPositivation.activeThisMonth}</div>
              <p className="text-xs text-muted-foreground">
                {adminStats.customerPositivation.totalCustomers > 0 
                  ? `${((adminStats.customerPositivation.activeThisMonth / adminStats.customerPositivation.totalCustomers) * 100).toFixed(1)}% positivacao`
                  : 'Positivacao'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Novos (Mes)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="stat-new-customers">{adminStats.customerPositivation.newThisMonth}</div>
              <p className="text-xs text-muted-foreground">Novos cadastros</p>
            </CardContent>
          </Card>
        </div>
      )}

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
              <p className="text-muted-foreground text-sm py-4">Nenhum dado disponível</p>
            ) : (
              <div className="h-[280px]" data-testid="chart-monthly-revenue">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento']}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-muted-foreground" />
              Pedidos por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {adminStatsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pieData.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">Nenhum dado disponível</p>
            ) : (
              <div className="h-[280px]" data-testid="chart-orders-by-status">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [value, 'Pedidos']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {isAdmin && adminStats?.salesByCategory && adminStats.salesByCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-muted-foreground" />
              Vendas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]" data-testid="chart-sales-by-category">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={adminStats.salesByCategory.map(c => ({ name: c.categoryName, value: c.totalValue }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name.substring(0, 12)}${name.length > 12 ? '...' : ''} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {adminStats.salesByCategory.map((_, index) => (
                      <Cell key={`cat-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            Produtos Mais Vendidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {adminStatsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !adminStats?.topProducts?.length ? (
            <p className="text-muted-foreground text-sm py-4">Nenhum produto vendido ainda</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {adminStats.topProducts.map((product, idx) => (
                <div key={product.productId} className="flex items-center justify-between gap-4 p-3 rounded-md bg-muted/50" data-testid={`admin-top-product-${product.productId}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm font-bold w-6">{idx + 1}.</span>
                    <span className="text-sm font-medium truncate max-w-[180px]">{product.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-semibold">R$ {product.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span className="text-xs text-muted-foreground ml-2">({product.totalQuantity} un.)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">
            {showAllOrders ? "Pedidos Recentes" : "Meus Pedidos Recentes"}
          </h2>
          <Link href="/orders">
            <Button variant="ghost" size="sm" data-testid="link-view-all-orders">
              Ver Todos <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
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
            showCustomer={showAllOrders}
            onViewOrder={(order) => console.log("View order:", order.orderNumber)}
          />
        )}
      </div>

      <div className="flex gap-4">
        <Link href="/catalog">
          <Button data-testid="button-browse-catalog">
            <Package className="h-4 w-4 mr-2" />
            Ver Catálogo
          </Button>
        </Link>
      </div>
    </div>
  );
}
