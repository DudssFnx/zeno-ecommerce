import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Search, MoreVertical, Eye, Printer, Package, PackagePlus, PackageMinus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseOrder } from "@shared/schema";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  DRAFT: { label: "Lancamento Pendente", variant: "outline", className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700" },
  FINALIZED: { label: "Lancamento Pendente", variant: "outline", className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700" },
  STOCK_POSTED: { label: "Estoque Lancado", variant: "outline", className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700" },
  STOCK_REVERSED: { label: "Estoque Estornado", variant: "outline", className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700" },
};

export default function PurchasesPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [processingId, setProcessingId] = useState<number | null>(null);

  const { data: orders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchases", statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (search) params.append("search", search);
      const res = await fetch(`/api/purchases?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const postStockMutation = useMutation({
    mutationFn: async (id: number) => {
      setProcessingId(id);
      await apiRequest("POST", `/api/purchases/${id}/post-stock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      toast({ title: "Sucesso", description: "Estoque lancado com sucesso" });
      setProcessingId(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Falha ao lancar estoque", variant: "destructive" });
      setProcessingId(null);
    },
  });

  const reverseStockMutation = useMutation({
    mutationFn: async (id: number) => {
      setProcessingId(id);
      await apiRequest("POST", `/api/purchases/${id}/reverse-stock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      toast({ title: "Sucesso", description: "Estoque estornado com sucesso" });
      setProcessingId(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Falha ao estornar estoque", variant: "destructive" });
      setProcessingId(null);
    },
  });

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Pedidos de Compra</h1>
          <p className="text-muted-foreground">Gerencie suas compras e estoque</p>
        </div>
        <Button asChild data-testid="button-new-purchase">
          <Link href="/purchase-orders/new">
            <Plus className="mr-2 h-4 w-4" />
            Nova Compra
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por numero..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="DRAFT">Lancamento Pendente</SelectItem>
                <SelectItem value="FINALIZED">Lancamento Pendente</SelectItem>
                <SelectItem value="STOCK_POSTED">Estoque Lancado</SelectItem>
                <SelectItem value="STOCK_REVERSED">Estoque Estornado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-state">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum pedido encontrado</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/purchase-orders/new">Criar primeiro pedido</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} data-testid={`row-purchase-${order.id}`}>
                    <TableCell className="font-medium">{order.number}</TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={STATUS_LABELS[order.status]?.variant || "outline"}
                        className={STATUS_LABELS[order.status]?.className}
                      >
                        {STATUS_LABELS[order.status]?.label || order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(order.totalValue)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`button-actions-${order.id}`}>
                            {processingId === order.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => navigate(`/purchase-orders/${order.id}`)}
                            data-testid={`menu-view-${order.id}`}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`/api/purchases/${order.id}/pdf`, '_blank')}
                            data-testid={`menu-print-${order.id}`}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir
                          </DropdownMenuItem>
                          {(order.status === "DRAFT" || order.status === "FINALIZED" || order.status === "STOCK_REVERSED") && (
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm("Deseja lancar o estoque deste pedido?")) {
                                  postStockMutation.mutate(order.id);
                                }
                              }}
                              disabled={postStockMutation.isPending}
                              data-testid={`menu-post-stock-${order.id}`}
                            >
                              <PackagePlus className="mr-2 h-4 w-4" />
                              Lancar Estoque
                            </DropdownMenuItem>
                          )}
                          {order.status === "STOCK_POSTED" && (
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm("Deseja estornar o estoque deste pedido?")) {
                                  reverseStockMutation.mutate(order.id);
                                }
                              }}
                              disabled={reverseStockMutation.isPending}
                              data-testid={`menu-reverse-stock-${order.id}`}
                            >
                              <PackageMinus className="mr-2 h-4 w-4" />
                              Estornar Estoque
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
