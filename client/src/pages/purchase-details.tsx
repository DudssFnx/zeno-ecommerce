import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { 
  ArrowLeft, Package, Truck, CheckCircle, RotateCcw, 
  FileText, Calendar, DollarSign, User, Clock, Printer, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { PurchaseOrder, PurchaseOrderItem, Supplier, StockMovement } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Package }> = {
  DRAFT: { label: "Rascunho", variant: "secondary", icon: FileText },
  FINALIZED: { label: "Finalizado", variant: "default", icon: CheckCircle },
  STOCK_POSTED: { label: "Estoque Lancado", variant: "outline", icon: Package },
  STOCK_REVERSED: { label: "Estoque Devolvido", variant: "destructive", icon: RotateCcw },
};

interface OrderDetails {
  order: PurchaseOrder;
  items: PurchaseOrderItem[];
  supplier: Supplier | null;
  movements: StockMovement[];
}

export default function PurchaseDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<"finalize" | "post" | "reverse" | "delete" | null>(null);

  const { data, isLoading, error } = useQuery<OrderDetails>({
    queryKey: ["/api/purchases", id],
    queryFn: async () => {
      const res = await fetch(`/api/purchases/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/purchases/${id}/finalize`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases", id] });
      toast({ title: "Pedido finalizado com sucesso" });
      setConfirmAction(null);
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Erro ao finalizar", variant: "destructive" });
      setConfirmAction(null);
    },
  });

  const postStockMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/purchases/${id}/post-stock`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases", id] });
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
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/purchases/${id}/reverse-stock`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Estoque devolvido com sucesso" });
      setConfirmAction(null);
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Erro ao devolver estoque", variant: "destructive" });
      setConfirmAction(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/purchases/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      toast({ title: "Pedido excluido com sucesso" });
      navigate("/purchase-orders");
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Erro ao excluir pedido", variant: "destructive" });
      setConfirmAction(null);
    },
  });

  const handlePrint = () => {
    window.open(`/api/purchases/${id}/pdf`, "_blank");
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return <div className="p-6 text-center">Carregando...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive mb-4">Pedido nao encontrado</p>
        <Button onClick={() => navigate("/purchase-orders")}>Voltar</Button>
      </div>
    );
  }

  const { order, items, supplier, movements } = data;
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.DRAFT;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/purchase-orders")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-order-number">
              {order.number}
              <Badge variant={statusConfig.variant}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {statusConfig.label}
              </Badge>
            </h1>
            <p className="text-muted-foreground">Criado em {formatDate(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(order.status === "DRAFT" || order.status === "FINALIZED") && (
            <Button onClick={() => setConfirmAction("post")} data-testid="button-post-stock">
              <Package className="mr-2 h-4 w-4" />
              Lancar Estoque
            </Button>
          )}
          {order.status === "STOCK_POSTED" && (
            <Button variant="outline" onClick={() => setConfirmAction("reverse")} data-testid="button-reverse-stock">
              <RotateCcw className="mr-2 h-4 w-4" />
              Estornar Estoque
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint} data-testid="button-print">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          {(order.status === "DRAFT" || order.status === "STOCK_REVERSED") && (
            <Button variant="destructive" onClick={() => setConfirmAction("delete")} data-testid="button-delete">
              <Trash2 className="mr-2 h-4 w-4" />
              Apagar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Itens do Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Custo Unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                    <TableCell className="font-medium">{item.descriptionSnapshot}</TableCell>
                    <TableCell className="text-muted-foreground">{item.skuSnapshot || "-"}</TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitCost)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Fornecedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              {supplier ? (
                <div>
                  <p className="font-medium">{supplier.name}</p>
                  {supplier.email && <p className="text-sm text-muted-foreground">{supplier.email}</p>}
                  {supplier.phone && <p className="text-sm text-muted-foreground">{supplier.phone}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhum fornecedor selecionado</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Resumo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Itens:</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantidade total:</span>
                <span>{items.reduce((sum, i) => sum + parseInt(i.qty), 0)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span data-testid="text-total">{formatCurrency(order.totalValue)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Historico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado:</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              {order.finalizedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Finalizado:</span>
                  <span>{formatDate(order.finalizedAt)}</span>
                </div>
              )}
              {order.postedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estoque lancado:</span>
                  <span>{formatDate(order.postedAt)}</span>
                </div>
              )}
              {order.reversedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estoque devolvido:</span>
                  <span>{formatDate(order.reversedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Observacoes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {movements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Movimentacoes de Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((mov) => (
                  <TableRow key={mov.id}>
                    <TableCell>{formatDate(mov.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={mov.type === "IN" ? "default" : "destructive"}>
                        {mov.type === "IN" ? "Entrada" : "Saida"}
                      </Badge>
                    </TableCell>
                    <TableCell>{mov.reason}</TableCell>
                    <TableCell className="text-right">{mov.qty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "finalize" && "Finalizar Pedido?"}
              {confirmAction === "post" && "Lancar Estoque?"}
              {confirmAction === "reverse" && "Estornar Estoque?"}
              {confirmAction === "delete" && "Apagar Pedido?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "finalize" && "Apos finalizar, o pedido nao podera mais ser editado. Os itens serao travados."}
              {confirmAction === "post" && "O estoque dos produtos sera atualizado com as quantidades deste pedido."}
              {confirmAction === "reverse" && "O estoque sera revertido, removendo as quantidades que foram lancadas."}
              {confirmAction === "delete" && "Esta acao nao pode ser desfeita. O pedido sera permanentemente removido. Nao e possivel apagar pedidos com estoque lancado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-action">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction === "finalize") finalizeMutation.mutate();
                if (confirmAction === "post") postStockMutation.mutate();
                if (confirmAction === "reverse") reverseStockMutation.mutate();
                if (confirmAction === "delete") deleteMutation.mutate();
              }}
              className={confirmAction === "delete" ? "bg-destructive text-destructive-foreground" : ""}
              data-testid="button-confirm-action"
            >
              {confirmAction === "delete" ? "Apagar" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
