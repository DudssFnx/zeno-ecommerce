import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, TrendingDown, TrendingUp, ShoppingCart, Package, DollarSign, Tag, ChevronDown, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";

interface LowStockProduct {
  productId: number;
  name: string;
  sku: string;
  categoryName: string | null;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  avgDailySales: number;
  daysOfStock: number;
  suggestedPurchaseQty: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

interface SlowMovingProduct {
  productId: number;
  name: string;
  sku: string;
  categoryName: string | null;
  currentStock: number;
  stockValue: number;
  daysSinceLastSale: number;
  totalSalesLast90Days: number;
  avgDailySales: number;
  recommendation: string;
}

interface FastMovingProduct {
  productId: number;
  name: string;
  sku: string;
  categoryName: string | null;
  currentStock: number;
  avgDailySales: number;
  daysOfStock: number;
  salesLast30Days: number;
  growthPercent: number;
  suggestedPurchaseQty: number;
}

interface PurchaseSuggestion {
  productId: number;
  name: string;
  sku: string;
  categoryName: string | null;
  currentStock: number;
  suggestedQty: number;
  estimatedCost: number;
  reason: string;
  priority: 'urgent' | 'high' | 'normal';
}

interface PurchasesAnalyticsData {
  overview: {
    totalLowStockProducts: number;
    totalSlowMovingProducts: number;
    totalFastMovingProducts: number;
    estimatedPurchaseValue: number;
    criticalItems: number;
  };
  lowStock: LowStockProduct[];
  slowMoving: SlowMovingProduct[];
  fastMoving: FastMovingProduct[];
  suggestions: PurchaseSuggestion[];
}

interface BrandSummary {
  brand: string;
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalSales30d: number;
  totalRevenue30d: number;
  avgTurnover: number;
}

interface BrandProductDetail {
  productId: number;
  name: string;
  sku: string;
  brand: string;
  stock: number;
  sales30d: number;
  sales60d: number;
  sales90d: number;
  revenue30d: number;
  lastSaleDate: string | null;
  turnoverDays: number | null;
  status: 'critical' | 'low' | 'ok' | 'overstock';
  suggestedPurchase: number;
}

interface BrandAnalyticsData {
  brands: BrandSummary[];
  productsByBrand: Record<string, BrandProductDetail[]>;
  overview: {
    totalBrands: number;
    totalProducts: number;
    totalLowStock: number;
    totalOutOfStock: number;
    topSellingBrand: string | null;
    topSellingBrandRevenue: number;
  };
}

const brandStatusColors = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  low: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  ok: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
  overstock: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
};

const brandStatusLabels = {
  critical: 'Critico',
  low: 'Baixo',
  ok: 'OK',
  overstock: 'Excesso',
};

const urgencyColors = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  low: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
};

const priorityColors = {
  urgent: 'bg-red-500/10 text-red-600 dark:text-red-400',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  normal: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

export default function PurchasesDashboardPage() {
  const { isSupplier, user, isAuthenticated } = useAuth();
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<PurchasesAnalyticsData>({
    queryKey: ['/api/admin/purchases-analytics'],
    enabled: !isSupplier && isAuthenticated,
  });

  const { data: brandData, isLoading: brandLoading } = useQuery<BrandAnalyticsData>({
    queryKey: ['/api/admin/brand-analytics'],
    enabled: isAuthenticated,
  });

  const toggleBrandExpansion = (brand: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brand)) {
        next.delete(brand);
      } else {
        next.add(brand);
      }
      return next;
    });
  };

  if (isSupplier) {
    if (brandLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!brandData) {
      return (
        <div className="p-6 lg:p-8">
          <p className="text-muted-foreground">Erro ao carregar dados de marcas.</p>
        </div>
      );
    }

    return (
      <div className="p-6 lg:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Minhas Marcas</h1>
          <p className="text-muted-foreground mt-1">
            Visualizacao das marcas: {user?.allowedBrands?.join(', ') || 'Nenhuma'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total de Marcas"
            value={brandData.overview.totalBrands}
            icon={Tag}
            data-testid="stat-total-brands"
          />
          <StatCard
            title="Total de Produtos"
            value={brandData.overview.totalProducts}
            icon={Package}
            data-testid="stat-total-products"
          />
          <StatCard
            title="Estoque Baixo"
            value={brandData.overview.totalLowStock}
            icon={AlertTriangle}
            data-testid="stat-low-stock"
          />
          <StatCard
            title="Sem Estoque"
            value={brandData.overview.totalOutOfStock}
            icon={AlertTriangle}
            data-testid="stat-out-of-stock"
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Produtos por Marca</h2>
          
          {brandData.brands.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">Nenhuma marca atribuida a voce.</p>
              </CardContent>
            </Card>
          ) : (
            brandData.brands.map(brand => (
              <Collapsible 
                key={brand.brand}
                open={expandedBrands.has(brand.brand)}
                onOpenChange={() => toggleBrandExpansion(brand.brand)}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent" data-testid={`brand-toggle-${brand.brand}`}>
                        <div className="flex items-center gap-4">
                          {expandedBrands.has(brand.brand) ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <CardTitle className="text-lg">{brand.brand}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{brand.totalProducts} produtos</Badge>
                            {brand.outOfStockCount > 0 && (
                              <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
                                {brand.outOfStockCount} sem estoque
                              </Badge>
                            )}
                            {brand.lowStockCount > 0 && (
                              <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                {brand.lowStockCount} baixo
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-right">
                            <span className="text-muted-foreground">Estoque:</span>
                            <span className="ml-2 font-semibold">{brand.totalStock}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-muted-foreground">Vendas 30d:</span>
                            <span className="ml-2 font-semibold">{brand.totalSales30d}</span>
                          </div>
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                          <div className="col-span-3">Produto</div>
                          <div className="col-span-1 text-center">SKU</div>
                          <div className="col-span-1 text-center">Estoque</div>
                          <div className="col-span-1 text-center">30d</div>
                          <div className="col-span-1 text-center">60d</div>
                          <div className="col-span-1 text-center">90d</div>
                          <div className="col-span-1 text-center">Giro</div>
                          <div className="col-span-1 text-center">Status</div>
                          <div className="col-span-2 text-center">Sugestao Compra</div>
                        </div>
                        {(brandData.productsByBrand[brand.brand] || []).map(product => (
                          <div 
                            key={product.productId}
                            className="grid grid-cols-12 gap-4 text-sm items-center py-2 hover-elevate rounded-md px-2"
                            data-testid={`product-row-${product.productId}`}
                          >
                            <div className="col-span-3 font-medium truncate" title={product.name}>
                              {product.name}
                            </div>
                            <div className="col-span-1 text-center">
                              <Badge variant="outline" className="text-xs">{product.sku}</Badge>
                            </div>
                            <div className="col-span-1 text-center font-semibold">
                              {product.stock}
                            </div>
                            <div className="col-span-1 text-center">
                              {product.sales30d}
                            </div>
                            <div className="col-span-1 text-center">
                              {product.sales60d}
                            </div>
                            <div className="col-span-1 text-center">
                              {product.sales90d}
                            </div>
                            <div className="col-span-1 text-center">
                              {product.turnoverDays !== null ? `${product.turnoverDays}d` : '-'}
                            </div>
                            <div className="col-span-1 text-center">
                              <Badge className={brandStatusColors[product.status]}>
                                {brandStatusLabels[product.status]}
                              </Badge>
                            </div>
                            <div className="col-span-2 text-center">
                              {product.suggestedPurchase > 0 ? (
                                <div className="flex items-center justify-center gap-2">
                                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-semibold text-primary">{product.suggestedPurchase} un.</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))
          )}
        </div>
      </div>
    );
  }

  if (isLoading || brandLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-muted-foreground">Erro ao carregar dados de compras.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Painel de Compras</h1>
        <p className="text-muted-foreground mt-1">Analise de estoque e sugestoes de reposicao</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Estoque Baixo"
          value={data.overview.totalLowStockProducts}
          icon={AlertTriangle}
          data-testid="stat-low-stock"
        />
        <StatCard
          title="Itens Criticos"
          value={data.overview.criticalItems}
          icon={AlertTriangle}
          data-testid="stat-critical-items"
        />
        <StatCard
          title="Giro Lento"
          value={data.overview.totalSlowMovingProducts}
          icon={TrendingDown}
          data-testid="stat-slow-moving"
        />
        <StatCard
          title="Giro Rapido"
          value={data.overview.totalFastMovingProducts}
          icon={TrendingUp}
          data-testid="stat-fast-moving"
        />
        <StatCard
          title="Custo Est. Compra"
          value={`R$ ${(data.overview.estimatedPurchaseValue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          data-testid="stat-estimated-cost"
        />
      </div>

      <Tabs defaultValue="suggestions" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="suggestions" data-testid="tab-suggestions">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Sugestoes
          </TabsTrigger>
          <TabsTrigger value="brands" data-testid="tab-brands">
            <Tag className="h-4 w-4 mr-2" />
            Marcas
          </TabsTrigger>
          <TabsTrigger value="low-stock" data-testid="tab-low-stock">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Estoque Baixo
          </TabsTrigger>
          <TabsTrigger value="slow-moving" data-testid="tab-slow-moving">
            <TrendingDown className="h-4 w-4 mr-2" />
            Giro Lento
          </TabsTrigger>
          <TabsTrigger value="fast-moving" data-testid="tab-fast-moving">
            <TrendingUp className="h-4 w-4 mr-2" />
            Giro Rapido
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                Sugestoes Inteligentes de Compra
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.suggestions.length === 0 ? (
                <p className="text-muted-foreground py-4">Nenhuma sugestao de compra no momento.</p>
              ) : (
                <div className="space-y-3">
                  {data.suggestions.map((item) => (
                    <div 
                      key={item.productId} 
                      className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-md bg-muted/50"
                      data-testid={`suggestion-${item.productId}`}
                    >
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{item.name}</span>
                          <Badge variant="outline" className="text-xs">{item.sku}</Badge>
                          <Badge className={priorityColors[item.priority]}>
                            {item.priority === 'urgent' ? 'Urgente' : item.priority === 'high' ? 'Alta' : 'Normal'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{item.reason}</p>
                        {item.categoryName && (
                          <p className="text-xs text-muted-foreground">{item.categoryName}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Estoque: <span className="font-semibold">{item.currentStock}</span></p>
                        <p className="text-sm">Sugerido: <span className="font-semibold text-primary">{item.suggestedQty} un.</span></p>
                        <p className="text-sm text-muted-foreground">Est.: R$ {(item.estimatedCost ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brands" className="mt-6">
          <div className="space-y-4">
            {!brandData || brandData.brands.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">Nenhuma marca encontrada.</p>
                </CardContent>
              </Card>
            ) : (
              brandData.brands.map(brand => (
                <Collapsible 
                  key={brand.brand}
                  open={expandedBrands.has(brand.brand)}
                  onOpenChange={() => toggleBrandExpansion(brand.brand)}
                >
                  <Card>
                    <CardHeader className="pb-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent" data-testid={`brand-toggle-${brand.brand}`}>
                          <div className="flex items-center gap-4">
                            {expandedBrands.has(brand.brand) ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <CardTitle className="text-lg">{brand.brand}</CardTitle>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{brand.totalProducts} produtos</Badge>
                              {brand.outOfStockCount > 0 && (
                                <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
                                  {brand.outOfStockCount} sem estoque
                                </Badge>
                              )}
                              {brand.lowStockCount > 0 && (
                                <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                  {brand.lowStockCount} baixo
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-right">
                              <span className="text-muted-foreground">Estoque:</span>
                              <span className="ml-2 font-semibold">{brand.totalStock}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground">Vendas 30d:</span>
                              <span className="ml-2 font-semibold">{brand.totalSales30d}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground">Receita 30d:</span>
                              <span className="ml-2 font-semibold">
                                R$ {brand.totalRevenue30d.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </Button>
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                            <div className="col-span-3">Produto</div>
                            <div className="col-span-1 text-center">SKU</div>
                            <div className="col-span-1 text-center">Estoque</div>
                            <div className="col-span-1 text-center">30d</div>
                            <div className="col-span-1 text-center">60d</div>
                            <div className="col-span-1 text-center">90d</div>
                            <div className="col-span-1 text-center">Giro</div>
                            <div className="col-span-1 text-center">Status</div>
                            <div className="col-span-2 text-center">Sugestao Compra</div>
                          </div>
                          {(brandData.productsByBrand[brand.brand] || []).map(product => (
                            <div 
                              key={product.productId}
                              className="grid grid-cols-12 gap-4 text-sm items-center py-2 hover-elevate rounded-md px-2"
                              data-testid={`brand-product-row-${product.productId}`}
                            >
                              <div className="col-span-3 font-medium truncate" title={product.name}>
                                {product.name}
                              </div>
                              <div className="col-span-1 text-center">
                                <Badge variant="outline" className="text-xs">{product.sku}</Badge>
                              </div>
                              <div className="col-span-1 text-center font-semibold">
                                {product.stock}
                              </div>
                              <div className="col-span-1 text-center">
                                {product.sales30d}
                              </div>
                              <div className="col-span-1 text-center">
                                {product.sales60d}
                              </div>
                              <div className="col-span-1 text-center">
                                {product.sales90d}
                              </div>
                              <div className="col-span-1 text-center">
                                {product.turnoverDays !== null ? `${product.turnoverDays}d` : '-'}
                              </div>
                              <div className="col-span-1 text-center">
                                <Badge className={brandStatusColors[product.status]}>
                                  {brandStatusLabels[product.status]}
                                </Badge>
                              </div>
                              <div className="col-span-2 text-center">
                                {product.suggestedPurchase > 0 ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold text-primary">{product.suggestedPurchase} un.</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="low-stock" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                Produtos com Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.lowStock.length === 0 ? (
                <p className="text-muted-foreground py-4">Nenhum produto com estoque baixo.</p>
              ) : (
                <div className="space-y-3">
                  {data.lowStock.map((item) => (
                    <div 
                      key={item.productId} 
                      className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-md bg-muted/50"
                      data-testid={`low-stock-${item.productId}`}
                    >
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{item.name}</span>
                          <Badge variant="outline" className="text-xs">{item.sku}</Badge>
                          <Badge className={urgencyColors[item.urgency]}>
                            {item.urgency === 'critical' ? 'Critico' : 
                             item.urgency === 'high' ? 'Alto' : 
                             item.urgency === 'medium' ? 'Medio' : 'Baixo'}
                          </Badge>
                        </div>
                        {item.categoryName && (
                          <p className="text-xs text-muted-foreground">{item.categoryName}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Estoque</p>
                          <p className="font-semibold">{item.currentStock}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Disponivel</p>
                          <p className="font-semibold">{item.availableStock}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Dias Rest.</p>
                          <p className="font-semibold">{item.daysOfStock}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Comprar</p>
                          <p className="font-semibold text-primary">{item.suggestedPurchaseQty} un.</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slow-moving" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
                Produtos com Giro Lento (para queimar)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.slowMoving.length === 0 ? (
                <p className="text-muted-foreground py-4">Nenhum produto com giro lento.</p>
              ) : (
                <div className="space-y-3">
                  {data.slowMoving.map((item) => (
                    <div 
                      key={item.productId} 
                      className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-md bg-muted/50"
                      data-testid={`slow-moving-${item.productId}`}
                    >
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{item.name}</span>
                          <Badge variant="outline" className="text-xs">{item.sku}</Badge>
                        </div>
                        <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">{item.recommendation}</p>
                        {item.categoryName && (
                          <p className="text-xs text-muted-foreground">{item.categoryName}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Estoque</p>
                          <p className="font-semibold">{item.currentStock}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Valor Est.</p>
                          <p className="font-semibold">R$ {(item.stockValue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Dias s/ Venda</p>
                          <p className="font-semibold">{item.daysSinceLastSale}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Vendas 90d</p>
                          <p className="font-semibold">{item.totalSalesLast90Days}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fast-moving" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                Produtos com Giro Rapido (precisa repor)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.fastMoving.length === 0 ? (
                <p className="text-muted-foreground py-4">Nenhum produto com giro rapido identificado.</p>
              ) : (
                <div className="space-y-3">
                  {data.fastMoving.map((item) => (
                    <div 
                      key={item.productId} 
                      className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-md bg-muted/50"
                      data-testid={`fast-moving-${item.productId}`}
                    >
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{item.name}</span>
                          <Badge variant="outline" className="text-xs">{item.sku}</Badge>
                          {item.growthPercent > 0 && (
                            <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">
                              +{item.growthPercent}%
                            </Badge>
                          )}
                        </div>
                        {item.categoryName && (
                          <p className="text-xs text-muted-foreground">{item.categoryName}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Estoque</p>
                          <p className="font-semibold">{item.currentStock}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Vendas/dia</p>
                          <p className="font-semibold">{item.avgDailySales}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Vendas 30d</p>
                          <p className="font-semibold">{item.salesLast30Days}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Comprar</p>
                          <p className="font-semibold text-primary">{item.suggestedPurchaseQty} un.</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
