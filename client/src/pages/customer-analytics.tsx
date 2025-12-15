import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  RefreshCw, 
  Loader2, 
  TrendingUp, 
  Users, 
  AlertTriangle,
  Crown,
  Clock,
  BarChart3,
  UserPlus,
  RotateCcw,
  Star
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
  firstOrderDate: string | null;
}

interface RFMSegment {
  userId: string;
  name: string;
  company: string | null;
  recency: number;
  frequency: number;
  monetary: number;
  rfmScore: string;
  segment: string;
}

interface InactiveCustomer {
  userId: string;
  name: string;
  company: string | null;
  email: string | null;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  avgDaysBetweenOrders: number;
  churnRisk: 'low' | 'medium' | 'high';
  totalSpent: number;
  orderCount: number;
}

interface CustomerAnalyticsData {
  topCustomersByRevenue: {
    month: CustomerRanking[];
    quarter: CustomerRanking[];
    year: CustomerRanking[];
  };
  topCustomersByFrequency: CustomerRanking[];
  abcAnalysis: {
    a: CustomerRanking[];
    b: CustomerRanking[];
    c: CustomerRanking[];
  };
  inactiveCustomers: {
    days7: InactiveCustomer[];
    days15: InactiveCustomer[];
    days30: InactiveCustomer[];
    days60: InactiveCustomer[];
    days90: InactiveCustomer[];
  };
  reactivatedThisMonth: CustomerRanking[];
  newCustomersThisMonth: CustomerRanking[];
  rfmSegments: RFMSegment[];
  avgDaysBetweenOrders: number;
  cohortRetention: {
    days30: number;
    days60: number;
    days90: number;
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(dateStr));
}

function ChurnRiskBadge({ risk }: { risk: 'low' | 'medium' | 'high' }) {
  const variants = {
    low: { className: 'bg-green-500/10 text-green-600 dark:text-green-400', label: 'Baixo' },
    medium: { className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400', label: 'Médio' },
    high: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'Alto' }
  };
  const { className, label } = variants[risk];
  return <Badge className={className}>{label}</Badge>;
}

function RFMSegmentBadge({ segment }: { segment: string }) {
  const colors: Record<string, string> = {
    'Campeões': 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    'Leais': 'bg-green-500/10 text-green-600 dark:text-green-400',
    'Potenciais Leais': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    'Novos': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    'Promissores': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    'Precisam de Atenção': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    'Em Risco': 'bg-red-500/10 text-red-600 dark:text-red-400',
    'Hibernando': 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    'Perdidos': 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  };
  return <Badge className={colors[segment] || 'bg-muted'}>{segment}</Badge>;
}

function RankingTable({ customers, showRank = true }: { customers: CustomerRanking[], showRank?: boolean }) {
  if (customers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum cliente encontrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {showRank && <th className="text-left py-3 px-2 font-medium text-muted-foreground">#</th>}
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Cliente</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Faturamento</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Pedidos</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Ticket Médio</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Último Pedido</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer, idx) => (
            <tr key={customer.userId} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-customer-${customer.userId}`}>
              {showRank && (
                <td className="py-3 px-2">
                  {idx < 3 ? (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                      idx === 1 ? 'bg-gray-400/20 text-gray-600' :
                      'bg-orange-500/20 text-orange-600'
                    }`}>
                      {idx + 1}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{idx + 1}</span>
                  )}
                </td>
              )}
              <td className="py-3 px-2">
                <div>
                  <p className="font-medium">{customer.name}</p>
                  {customer.company && (
                    <p className="text-xs text-muted-foreground">{customer.company}</p>
                  )}
                </div>
              </td>
              <td className="py-3 px-2 text-right font-medium">{formatCurrency(customer.totalRevenue)}</td>
              <td className="py-3 px-2 text-right">{customer.orderCount}</td>
              <td className="py-3 px-2 text-right">{formatCurrency(customer.avgTicket)}</td>
              <td className="py-3 px-2 text-right">
                <div>
                  <p>{formatDate(customer.lastOrderDate)}</p>
                  {customer.daysSinceLastOrder < 9999 && (
                    <p className="text-xs text-muted-foreground">{customer.daysSinceLastOrder}d atrás</p>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InactiveCustomersTable({ customers }: { customers: InactiveCustomer[] }) {
  if (customers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum cliente inativo neste período</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Cliente</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Risco Churn</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Dias Inativo</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Média Dias</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total Gasto</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Pedidos</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Último Pedido</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.userId} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-inactive-${customer.userId}`}>
              <td className="py-3 px-2">
                <div>
                  <p className="font-medium">{customer.name}</p>
                  {customer.company && (
                    <p className="text-xs text-muted-foreground">{customer.company}</p>
                  )}
                  {customer.email && (
                    <p className="text-xs text-muted-foreground">{customer.email}</p>
                  )}
                </div>
              </td>
              <td className="py-3 px-2">
                <ChurnRiskBadge risk={customer.churnRisk} />
              </td>
              <td className="py-3 px-2 text-right font-medium">{customer.daysSinceLastOrder}</td>
              <td className="py-3 px-2 text-right">{customer.avgDaysBetweenOrders.toFixed(0)}</td>
              <td className="py-3 px-2 text-right">{formatCurrency(customer.totalSpent)}</td>
              <td className="py-3 px-2 text-right">{customer.orderCount}</td>
              <td className="py-3 px-2 text-right">{formatDate(customer.lastOrderDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RFMTable({ segments }: { segments: RFMSegment[] }) {
  if (segments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum cliente para análise RFM</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Cliente</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Segmento</th>
            <th className="text-center py-3 px-2 font-medium text-muted-foreground">Score RFM</th>
            <th className="text-center py-3 px-2 font-medium text-muted-foreground">R</th>
            <th className="text-center py-3 px-2 font-medium text-muted-foreground">F</th>
            <th className="text-center py-3 px-2 font-medium text-muted-foreground">M</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((customer) => (
            <tr key={customer.userId} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-rfm-${customer.userId}`}>
              <td className="py-3 px-2">
                <div>
                  <p className="font-medium">{customer.name}</p>
                  {customer.company && (
                    <p className="text-xs text-muted-foreground">{customer.company}</p>
                  )}
                </div>
              </td>
              <td className="py-3 px-2">
                <RFMSegmentBadge segment={customer.segment} />
              </td>
              <td className="py-3 px-2 text-center font-mono font-bold">{customer.rfmScore}</td>
              <td className="py-3 px-2 text-center">{customer.recency}</td>
              <td className="py-3 px-2 text-center">{customer.frequency}</td>
              <td className="py-3 px-2 text-center">{customer.monetary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomerAnalyticsPage() {
  const [revenuePeriod, setRevenuePeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [inactivePeriod, setInactivePeriod] = useState<'days7' | 'days15' | 'days30' | 'days60' | 'days90'>('days30');

  const { data: analytics, isLoading, refetch } = useQuery<CustomerAnalyticsData>({
    queryKey: ['/api/admin/customer-analytics'],
  });

  const rfmSummary = useMemo(() => {
    if (!analytics?.rfmSegments) return {};
    const summary: Record<string, number> = {};
    for (const customer of analytics.rfmSegments) {
      summary[customer.segment] = (summary[customer.segment] || 0) + 1;
    }
    return summary;
  }, [analytics?.rfmSegments]);

  const periodLabels = {
    month: 'Mês',
    quarter: '90 Dias',
    year: 'Ano',
  };

  const inactiveLabels = {
    days7: '7 dias',
    days15: '15 dias',
    days30: '30 dias',
    days60: '60 dias',
    days90: '90 dias',
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold" data-testid="text-page-title">Análise de Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Métricas baseadas apenas em pedidos faturados
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-analytics">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <UserPlus className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-new-customers">
                      {analytics?.newCustomersThisMonth.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Novos no Mês</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <RotateCcw className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-reactivated">
                      {analytics?.reactivatedThisMonth.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Reativados</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-inactive-30">
                      {analytics?.inactiveCustomers.days30.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Inativos 30d</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Clock className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-avg-days">
                      {analytics?.avgDaysBetweenOrders.toFixed(0) || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Média Dias/Pedido</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <Star className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-retention-30">
                      {((analytics?.cohortRetention.days30 || 0) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Retenção 30d</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="ranking" className="space-y-4">
            <TabsList data-testid="tabs-analytics">
              <TabsTrigger value="ranking" data-testid="tab-ranking">
                <Crown className="h-4 w-4 mr-2" />
                Ranking
              </TabsTrigger>
              <TabsTrigger value="inactive" data-testid="tab-inactive">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Inativos
              </TabsTrigger>
              <TabsTrigger value="rfm" data-testid="tab-rfm">
                <BarChart3 className="h-4 w-4 mr-2" />
                RFM
              </TabsTrigger>
              <TabsTrigger value="abc" data-testid="tab-abc">
                <TrendingUp className="h-4 w-4 mr-2" />
                Curva ABC
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ranking" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="text-lg">Top Clientes por Faturamento</CardTitle>
                      <CardDescription>Os clientes que mais compraram no período</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      {(['month', 'quarter', 'year'] as const).map((period) => (
                        <Button
                          key={period}
                          variant={revenuePeriod === period ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRevenuePeriod(period)}
                          data-testid={`button-period-${period}`}
                        >
                          {periodLabels[period]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <RankingTable customers={analytics?.topCustomersByRevenue[revenuePeriod] || []} />
                </CardContent>
              </Card>

              <div className="grid lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Top por Frequência</CardTitle>
                    <CardDescription>Clientes com mais pedidos realizados</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RankingTable customers={analytics?.topCustomersByFrequency || []} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Novos Clientes do Mês</CardTitle>
                    <CardDescription>Clientes que fizeram primeira compra este mês</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RankingTable customers={analytics?.newCustomersThisMonth || []} showRank={false} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="inactive" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="text-lg">Clientes Inativos</CardTitle>
                      <CardDescription>Clientes sem pedidos no período selecionado</CardDescription>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {(['days7', 'days15', 'days30', 'days60', 'days90'] as const).map((period) => (
                        <Button
                          key={period}
                          variant={inactivePeriod === period ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setInactivePeriod(period)}
                          data-testid={`button-inactive-${period}`}
                        >
                          {inactiveLabels[period]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <InactiveCustomersTable customers={analytics?.inactiveCustomers[inactivePeriod] || []} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Clientes Reativados</CardTitle>
                  <CardDescription>Clientes que voltaram a comprar este mês após período inativo</CardDescription>
                </CardHeader>
                <CardContent>
                  <RankingTable customers={analytics?.reactivatedThisMonth || []} showRank={false} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rfm" className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {Object.entries(rfmSummary).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([segment, count]) => (
                  <Card key={segment}>
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2">
                        <RFMSegmentBadge segment={segment} />
                        <p className="text-2xl font-bold" data-testid={`stat-rfm-${segment.toLowerCase().replace(/\s+/g, '-')}`}>
                          {count}
                        </p>
                        <p className="text-xs text-muted-foreground">clientes</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Segmentação RFM</CardTitle>
                  <CardDescription>Análise Recency-Frequency-Monetary de todos os clientes</CardDescription>
                </CardHeader>
                <CardContent>
                  <RFMTable segments={analytics?.rfmSegments || []} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="abc" className="space-y-4">
              <div className="grid lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <span className="font-bold text-green-600">A</span>
                      </div>
                      <div>
                        <CardTitle className="text-lg">Curva A</CardTitle>
                        <CardDescription>80% do faturamento</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 p-3 rounded-lg bg-green-500/10">
                      <p className="text-sm text-muted-foreground">Total de clientes</p>
                      <p className="text-2xl font-bold text-green-600" data-testid="stat-abc-a">
                        {analytics?.abcAnalysis.a.length || 0}
                      </p>
                    </div>
                    <RankingTable customers={analytics?.abcAnalysis.a.slice(0, 10) || []} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <span className="font-bold text-yellow-600">B</span>
                      </div>
                      <div>
                        <CardTitle className="text-lg">Curva B</CardTitle>
                        <CardDescription>15% do faturamento</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 p-3 rounded-lg bg-yellow-500/10">
                      <p className="text-sm text-muted-foreground">Total de clientes</p>
                      <p className="text-2xl font-bold text-yellow-600" data-testid="stat-abc-b">
                        {analytics?.abcAnalysis.b.length || 0}
                      </p>
                    </div>
                    <RankingTable customers={analytics?.abcAnalysis.b.slice(0, 10) || []} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
                        <span className="font-bold text-gray-600">C</span>
                      </div>
                      <div>
                        <CardTitle className="text-lg">Curva C</CardTitle>
                        <CardDescription>5% do faturamento</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 p-3 rounded-lg bg-gray-500/10">
                      <p className="text-sm text-muted-foreground">Total de clientes</p>
                      <p className="text-2xl font-bold text-gray-600" data-testid="stat-abc-c">
                        {analytics?.abcAnalysis.c.length || 0}
                      </p>
                    </div>
                    <RankingTable customers={analytics?.abcAnalysis.c.slice(0, 10) || []} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
