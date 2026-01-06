import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { 
  ArrowLeft, Package, RotateCcw, 
  FileText, DollarSign, User, Clock, Printer
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
import type { PurchaseOrder, PurchaseOrderItem, Supplier, StockMovement } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Package; className?: string }> = {
  DRAFT: { label: "Lancamento Pendente", variant: "outline", icon: FileText, className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700" },
  FINALIZED: { label: "Lancamento Pendente", variant: "outline", icon: FileText, className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700" },
  STOCK_POSTED: { label: "Estoque Lancado", variant: "outline", icon: Package, className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700" },
  STOCK_REVERSED: { label: "Estoque Estornado", variant: "outline", icon: RotateCcw, className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700" },
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

  const { data, isLoading, error } = useQuery<OrderDetails>({
    queryKey: ["/api/purchases", id],
    queryFn: async () => {
      const res = await fetch(`/api/purchases/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
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
              <Badge variant={statusConfig.variant} className={statusConfig.className}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {statusConfig.label}
              </Badge>
            </h1>
            <p className="text-muted-foreground">Criado em {formatDate(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrint} data-testid="button-print">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
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
                  <span className="text-muted-foreground">Estoque estornado:</span>
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
    </div>
  );
}
