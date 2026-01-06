import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Search, Package, MoreVertical, Eye, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PurchaseOrder } from "@shared/schema";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Rascunho", variant: "secondary" },
  FINALIZED: { label: "Finalizado", variant: "default" },
  STOCK_POSTED: { label: "Estoque Lancado", variant: "outline" },
  STOCK_REVERSED: { label: "Estoque Devolvido", variant: "destructive" },
};

type ConfirmAction = {
  type: "delete" | "post" | "reverse";
  orderId: number;
} | null;

export default function PurchasesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/purchases/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      toast({ title: "Pedido excluido com sucesso" });
      setConfirmAction(null);
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Erro ao excluir pedido", variant: "destructive" });
      setConfirmAction(null);
    },
  });

  const postStockMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/purchases/${id}/post-stock`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Estoque lancado com sucesso" });
      setConfirmAction(null);
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Erro ao lancar estoque", variant: "destructive" });
      setConfirmAction(null);
    },
  });

  const reverseStockMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/purchases/${id}/reverse-stock`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Estoque estornado com sucesso" });
      setConfirmAction(null);
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Erro ao estornar estoque", variant: "destructive" });
      setConfirmAction(null);
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
                <SelectItem value="DRAFT">Rascunho</SelectItem>
                <SelectItem value="FINALIZED">Finalizado</SelectItem>
                <SelectItem value="STOCK_POSTED">Estoque Lancado</SelectItem>
                <SelectItem value="STOCK_REVERSED">Estoque Devolvido</SelectItem>
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
                      <Badge variant={STATUS_LABELS[order.status]?.variant || "secondary"}>
                        {STATUS_LABELS[order.status]?.label || order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(order.totalValue)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`button-actions-${order.id}`}>
                            <MoreVertical className="h-4 w-4" />
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
                          {(order.status === "DRAFT" || order.status === "FINALIZED") && (
                            <DropdownMenuItem
                              onClick={() => setConfirmAction({ type: "post", orderId: order.id })}
                              data-testid={`menu-post-${order.id}`}
                            >
                              <Package className="mr-2 h-4 w-4" />
                              Lancar Estoque
                            </DropdownMenuItem>
                          )}
                          {order.status === "STOCK_POSTED" && (
                            <DropdownMenuItem
                              onClick={() => setConfirmAction({ type: "reverse", orderId: order.id })}
                              data-testid={`menu-reverse-${order.id}`}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Estornar Estoque
                            </DropdownMenuItem>
                          )}
                          {(order.status === "DRAFT" || order.status === "STOCK_REVERSED") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({ type: "delete", orderId: order.id })}
                                className="text-destructive"
                                data-testid={`menu-delete-${order.id}`}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Apagar
                              </DropdownMenuItem>
                            </>
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

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "delete" && "Apagar pedido?"}
              {confirmAction?.type === "post" && "Lancar Estoque?"}
              {confirmAction?.type === "reverse" && "Estornar Estoque?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "delete" && "Esta acao nao pode ser desfeita. O pedido sera permanentemente removido."}
              {confirmAction?.type === "post" && "O estoque dos produtos sera atualizado com as quantidades deste pedido."}
              {confirmAction?.type === "reverse" && "O estoque sera revertido, removendo as quantidades que foram lancadas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-action">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction?.type === "delete") deleteMutation.mutate(confirmAction.orderId);
                if (confirmAction?.type === "post") postStockMutation.mutate(confirmAction.orderId);
                if (confirmAction?.type === "reverse") reverseStockMutation.mutate(confirmAction.orderId);
              }}
              className={confirmAction?.type === "delete" ? "bg-destructive text-destructive-foreground" : ""}
              data-testid="button-confirm-action"
            >
              {confirmAction?.type === "delete" ? "Apagar" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
