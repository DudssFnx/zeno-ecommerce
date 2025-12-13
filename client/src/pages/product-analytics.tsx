import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  RefreshCw, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Package,
  DollarSign,
  ShoppingCart,
  Layers,
  RotateCcw,
  AlertTriangle,
  Zap,
  Crown,
  Grid3X3
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ProductRanking {
  productId: number;
  name: string;
  sku: string;
  brand: string | null;
  categoryId: number | null;
  categoryName: string | null;
  totalRevenue: number;
  totalQuantity: number;
  orderCount: number;
  avgPrice: number;
  revenueShare: number;
  growthPercent: number;
}

interface ProductABC {
  productId: number;
  name: string;
  sku: string;
  categoryName: string | null;
  totalRevenue: number;
  revenueShare: number;
  cumulativeShare: number;
  abcClass: 'A' | 'B' | 'C';
}

interface ProductVelocity {
  productId: number;
  name: string;
  sku: string;
  avgSalesPerDay: number;
  totalQuantity: number;
  daysSinceLastSale: number;
  status: 'fast' | 'normal' | 'slow' | 'stopped';
}

interface ProductRepurchase {
  productId: number;
  name: string;
  sku: string;
  uniqueCustomers: number;
  repeatCustomers: number;
  repurchaseRate: number;
  avgDaysBetweenPurchases: number;
  singlePurchaseCustomers: number;
}

interface ProductCrossSell {
  productId: number;
  name: string;
  pairedProducts: Array<{
    productId: number;
    name: string;
    coOccurrence: number;
  }>;
  isLeader: boolean;
}

interface CategoryPerformance {
  categoryId: number;
  categoryName: string;
  totalRevenue: number;
  totalQuantity: number;
  productCount: number;
  topProducts: Array<{
    productId: number;
    name: string;
    revenue: number;
  }>;
}

interface ProblematicProduct {
  productId: number;
  name: string;
  sku: string;
  issue: 'low_turnover' | 'declining' | 'no_sales';
  metric: number;
  description: string;
}

interface ProductAnalyticsData {
  overview: {
    totalRevenue: number;
    totalQuantitySold: number;
    avgTicketPerProduct: number;
    uniqueProductsSold: number;
  };
  rankingByRevenue: {
    days7: ProductRanking[];
    days30: ProductRanking[];
    days60: ProductRanking[];
    days90: ProductRanking[];
  };
  rankingByVolume: {
    days7: ProductRanking[];
    days30: ProductRanking[];
    days60: ProductRanking[];
    days90: ProductRanking[];
  };
  topGrowing: ProductRanking[];
  topDeclining: ProductRanking[];
  abcAnalysis: {
    a: ProductABC[];
    b: ProductABC[];
    c: ProductABC[];
  };
  velocity: ProductVelocity[];
  repurchase: ProductRepurchase[];
  crossSell: ProductCrossSell[];
  categoryPerformance: CategoryPerformance[];
  problematicProducts: ProblematicProduct[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function VelocityBadge({ status }: { status: 'fast' | 'normal' | 'slow' | 'stopped' }) {
  const variants = {
    fast: { className: 'bg-green-500/10 text-green-600 dark:text-green-400', label: 'Rápido' },
    normal: { className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', label: 'Normal' },
    slow: { className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400', label: 'Lento' },
    stopped: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'Parado' }
  };
  const { className, label } = variants[status];
  return <Badge className={className}>{label}</Badge>;
}

function ABCBadge({ abcClass }: { abcClass: 'A' | 'B' | 'C' }) {
  const variants = {
    A: { className: 'bg-green-500/10 text-green-600 dark:text-green-400', label: 'A' },
    B: { className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400', label: 'B' },
    C: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'C' }
  };
  const { className, label } = variants[abcClass];
  return <Badge className={className}>{label}</Badge>;
}

function IssueBadge({ issue }: { issue: 'low_turnover' | 'declining' | 'no_sales' }) {
  const variants = {
    low_turnover: { className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400', label: 'Baixo Giro' },
    declining: { className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', label: 'Declínio' },
    no_sales: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'Sem Vendas' }
  };
  const { className, label } = variants[issue];
  return <Badge className={className}>{label}</Badge>;
}

function RankingTable({ products, showGrowth = false }: { products: ProductRanking[], showGrowth?: boolean }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum produto encontrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">#</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Produto</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Faturamento</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Qtd</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Pedidos</th>
            {showGrowth && <th className="text-right py-3 px-2 font-medium text-muted-foreground">Crescimento</th>}
          </tr>
        </thead>
        <tbody>
          {products.map((product, idx) => (
            <tr key={product.productId} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-product-${product.productId}`}>
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
              <td className="py-3 px-2">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                  {product.categoryName && (
                    <p className="text-xs text-muted-foreground">{product.categoryName}</p>
                  )}
                </div>
              </td>
              <td className="py-3 px-2 text-right font-medium">{formatCurrency(product.totalRevenue)}</td>
              <td className="py-3 px-2 text-right">{product.totalQuantity}</td>
              <td className="py-3 px-2 text-right">{product.orderCount}</td>
              {showGrowth && (
                <td className="py-3 px-2 text-right">
                  <div className={`flex items-center justify-end gap-1 ${
                    product.growthPercent > 0 ? 'text-green-600' :
                    product.growthPercent < 0 ? 'text-red-600' : 'text-muted-foreground'
                  }`}>
                    {product.growthPercent > 0 ? <TrendingUp className="h-3 w-3" /> : 
                     product.growthPercent < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                    {product.growthPercent.toFixed(1)}%
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ABCTable({ products }: { products: ProductABC[] }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum produto encontrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Classe</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Produto</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Faturamento</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">% Receita</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">% Acumulado</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.productId} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-abc-${product.productId}`}>
              <td className="py-3 px-2">
                <ABCBadge abcClass={product.abcClass} />
              </td>
              <td className="py-3 px-2">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                </div>
              </td>
              <td className="py-3 px-2 text-right font-medium">{formatCurrency(product.totalRevenue)}</td>
              <td className="py-3 px-2 text-right">{(product.revenueShare * 100).toFixed(1)}%</td>
              <td className="py-3 px-2 text-right">{(product.cumulativeShare * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VelocityTable({ products }: { products: ProductVelocity[] }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum produto encontrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Produto</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Vendas/Dia</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total Vendido</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Dias s/ Venda</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.productId} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-velocity-${product.productId}`}>
              <td className="py-3 px-2">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                </div>
              </td>
              <td className="py-3 px-2">
                <VelocityBadge status={product.status} />
              </td>
              <td className="py-3 px-2 text-right font-medium">{product.avgSalesPerDay.toFixed(2)}</td>
              <td className="py-3 px-2 text-right">{product.totalQuantity}</td>
              <td className="py-3 px-2 text-right">{product.daysSinceLastSale}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RepurchaseTable({ products }: { products: ProductRepurchase[] }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum produto encontrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Produto</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Clientes</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Recompras</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Taxa Recompra</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Dias entre Compras</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.productId} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-repurchase-${product.productId}`}>
              <td className="py-3 px-2">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                </div>
              </td>
              <td className="py-3 px-2 text-right">{product.uniqueCustomers}</td>
              <td className="py-3 px-2 text-right">{product.repeatCustomers}</td>
              <td className="py-3 px-2 text-right font-medium">{(product.repurchaseRate * 100).toFixed(1)}%</td>
              <td className="py-3 px-2 text-right">{product.avgDaysBetweenPurchases.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CrossSellTable({ products }: { products: ProductCrossSell[] }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum produto encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {products.map((product) => (
        <Card key={product.productId} className="overflow-hidden" data-testid={`card-crosssell-${product.productId}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{product.name}</CardTitle>
              {product.isLeader && <Badge className="bg-primary/10 text-primary">Líder</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {product.pairedProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem produtos associados</p>
              ) : (
                product.pairedProducts.map((paired) => (
                  <Badge key={paired.productId} variant="outline">
                    {paired.name} ({paired.coOccurrence}x)
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CategoryTable({ categories }: { categories: CategoryPerformance[] }) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Grid3X3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhuma categoria encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <Card key={category.categoryId} data-testid={`card-category-${category.categoryId}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-base">{category.categoryName}</CardTitle>
              <Badge variant="outline">{category.productCount} produtos</Badge>
            </div>
            <CardDescription>
              {formatCurrency(category.totalRevenue)} | {category.totalQuantity} unidades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Top 3 Produtos</p>
              <div className="space-y-1">
                {category.topProducts.slice(0, 3).map((product, idx) => (
                  <div key={product.productId} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{idx + 1}.</span>
                      {product.name}
                    </span>
                    <span className="font-medium">{formatCurrency(product.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProblematicTable({ products }: { products: ProblematicProduct[] }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum produto problemático encontrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Produto</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Problema</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.productId} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-problematic-${product.productId}`}>
              <td className="py-3 px-2">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                </div>
              </td>
              <td className="py-3 px-2">
                <IssueBadge issue={product.issue} />
              </td>
              <td className="py-3 px-2 text-muted-foreground">{product.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ProductAnalyticsPage() {
  const [rankingPeriod, setRankingPeriod] = useState<'days7' | 'days30' | 'days60' | 'days90'>('days30');
  const [rankingType, setRankingType] = useState<'revenue' | 'volume'>('revenue');

  const { data: analytics, isLoading, refetch } = useQuery<ProductAnalyticsData>({
    queryKey: ['/api/admin/product-analytics'],
  });

  const periodLabels = {
    days7: '7 dias',
    days30: '30 dias',
    days60: '60 dias',
    days90: '90 dias',
  };

  const currentRanking = rankingType === 'revenue' 
    ? analytics?.rankingByRevenue[rankingPeriod] || []
    : analytics?.rankingByVolume[rankingPeriod] || [];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold" data-testid="text-page-title">Análise de Produtos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Métricas e insights sobre seu catálogo de produtos
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <DollarSign className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-total-revenue">
                      {formatCurrency(analytics?.overview.totalRevenue || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Faturamento Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <ShoppingCart className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-total-quantity">
                      {analytics?.overview.totalQuantitySold || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Qtd Vendida</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <DollarSign className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-avg-ticket">
                      {formatCurrency(analytics?.overview.avgTicketPerProduct || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Ticket Médio</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <Package className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-unique-products">
                      {analytics?.overview.uniqueProductsSold || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Produtos Vendidos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="ranking" className="space-y-4">
            <TabsList data-testid="tabs-analytics" className="flex-wrap h-auto gap-1">
              <TabsTrigger value="ranking" data-testid="tab-ranking">
                <Crown className="h-4 w-4 mr-2" />
                Ranking
              </TabsTrigger>
              <TabsTrigger value="abc" data-testid="tab-abc">
                <Layers className="h-4 w-4 mr-2" />
                Curva ABC
              </TabsTrigger>
              <TabsTrigger value="velocity" data-testid="tab-velocity">
                <Zap className="h-4 w-4 mr-2" />
                Giro
              </TabsTrigger>
              <TabsTrigger value="repurchase" data-testid="tab-repurchase">
                <RotateCcw className="h-4 w-4 mr-2" />
                Recompra
              </TabsTrigger>
              <TabsTrigger value="crosssell" data-testid="tab-crosssell">
                <Package className="h-4 w-4 mr-2" />
                Cross-sell
              </TabsTrigger>
              <TabsTrigger value="category" data-testid="tab-category">
                <Grid3X3 className="h-4 w-4 mr-2" />
                Categoria
              </TabsTrigger>
              <TabsTrigger value="problems" data-testid="tab-problems">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Problemas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ranking" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="text-lg">Ranking de Produtos</CardTitle>
                      <CardDescription>Os produtos mais vendidos no período</CardDescription>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex gap-1">
                        <Button
                          variant={rankingType === 'revenue' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRankingType('revenue')}
                          data-testid="button-type-revenue"
                        >
                          Faturamento
                        </Button>
                        <Button
                          variant={rankingType === 'volume' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRankingType('volume')}
                          data-testid="button-type-volume"
                        >
                          Volume
                        </Button>
                      </div>
                      <div className="flex gap-1">
                        {(['days7', 'days30', 'days60', 'days90'] as const).map((period) => (
                          <Button
                            key={period}
                            variant={rankingPeriod === period ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setRankingPeriod(period)}
                            data-testid={`button-period-${period}`}
                          >
                            {periodLabels[period]}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <RankingTable products={currentRanking} />
                </CardContent>
              </Card>

              <div className="grid lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      <CardTitle className="text-lg">Em Crescimento</CardTitle>
                    </div>
                    <CardDescription>Produtos com maior crescimento em vendas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RankingTable products={analytics?.topGrowing || []} showGrowth />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-500" />
                      <CardTitle className="text-lg">Em Declínio</CardTitle>
                    </div>
                    <CardDescription>Produtos com queda em vendas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RankingTable products={analytics?.topDeclining || []} showGrowth />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="abc" className="space-y-4">
              <div className="grid lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <ABCBadge abcClass="A" />
                      <CardTitle className="text-lg">Classe A</CardTitle>
                    </div>
                    <CardDescription>~80% do faturamento ({analytics?.abcAnalysis.a.length || 0} produtos)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ABCTable products={analytics?.abcAnalysis.a || []} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <ABCBadge abcClass="B" />
                      <CardTitle className="text-lg">Classe B</CardTitle>
                    </div>
                    <CardDescription>~15% do faturamento ({analytics?.abcAnalysis.b.length || 0} produtos)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ABCTable products={analytics?.abcAnalysis.b || []} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <ABCBadge abcClass="C" />
                      <CardTitle className="text-lg">Classe C</CardTitle>
                    </div>
                    <CardDescription>~5% do faturamento ({analytics?.abcAnalysis.c.length || 0} produtos)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ABCTable products={analytics?.abcAnalysis.c || []} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="velocity" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Velocidade de Vendas</CardTitle>
                  <CardDescription>Análise do giro de estoque por produto</CardDescription>
                </CardHeader>
                <CardContent>
                  <VelocityTable products={analytics?.velocity || []} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="repurchase" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Taxa de Recompra</CardTitle>
                  <CardDescription>Produtos com maior fidelização de clientes</CardDescription>
                </CardHeader>
                <CardContent>
                  <RepurchaseTable products={analytics?.repurchase || []} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="crosssell" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Produtos Complementares</CardTitle>
                  <CardDescription>Produtos frequentemente comprados juntos</CardDescription>
                </CardHeader>
                <CardContent>
                  <CrossSellTable products={analytics?.crossSell || []} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="category" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Desempenho por Categoria</CardTitle>
                  <CardDescription>Performance de vendas por categoria de produto</CardDescription>
                </CardHeader>
                <CardContent>
                  <CategoryTable categories={analytics?.categoryPerformance || []} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="problems" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Produtos Problemáticos</CardTitle>
                  <CardDescription>Produtos que precisam de atenção</CardDescription>
                </CardHeader>
                <CardContent>
                  <ProblematicTable products={analytics?.problematicProducts || []} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
