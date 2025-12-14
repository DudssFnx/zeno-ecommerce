import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { Eye, Printer, Check, DollarSign, FileText } from "lucide-react";
import { Link } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";

export interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  date: string;
  status: string;
  total: number;
  itemCount: number;
  printed?: boolean;
}

interface OrderTableProps {
  orders: Order[];
  onViewOrder?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
  onUpdateStatus?: (order: Order, status: string) => void;
  onPrintOrder?: (order: Order) => void;
  onReserveStock?: (order: Order) => void;
  onInvoice?: (order: Order) => void;
  showCustomer?: boolean;
  selectedOrderIds?: Set<string>;
  onSelectionChange?: (orderId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
}

export function OrderTable({ 
  orders, 
  onViewOrder, 
  onEditOrder, 
  onUpdateStatus,
  onPrintOrder,
  onReserveStock,
  onInvoice,
  showCustomer = true,
  selectedOrderIds,
  onSelectionChange,
  onSelectAll,
}: OrderTableProps) {
  const allSelected = orders.length > 0 && selectedOrderIds && orders.every(o => selectedOrderIds.has(o.id));
  const someSelected = selectedOrderIds && orders.some(o => selectedOrderIds.has(o.id)) && !allSelected;

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {onSelectionChange && (
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onSelectAll?.(!!checked)}
                  data-testid="checkbox-select-all"
                  className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                />
              </TableHead>
            )}
            <TableHead className="font-semibold">Pedido #</TableHead>
            {showCustomer && <TableHead className="font-semibold">Cliente</TableHead>}
            <TableHead className="font-semibold">Data</TableHead>
            <TableHead className="font-semibold">Itens</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Etapa</TableHead>
            <TableHead className="font-semibold text-right">Total</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order, idx) => (
            <TableRow 
              key={order.id} 
              className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}
              data-testid={`row-order-${order.id}`}
            >
              {onSelectionChange && (
                <TableCell>
                  <Checkbox
                    checked={selectedOrderIds?.has(order.id) || false}
                    onCheckedChange={(checked) => onSelectionChange(order.id, !!checked)}
                    data-testid={`checkbox-order-${order.id}`}
                  />
                </TableCell>
              )}
              <TableCell className="font-medium" data-testid={`text-order-number-${order.id}`}>
                {order.orderNumber}
              </TableCell>
              {showCustomer && (
                <TableCell>{order.customer}</TableCell>
              )}
              <TableCell className="text-muted-foreground">{order.date}</TableCell>
              <TableCell>{order.itemCount} itens</TableCell>
              <TableCell>
                <StatusBadge status={order.status as any} />
              </TableCell>
              <TableCell>
                {order.status === "ORCAMENTO" && !order.printed ? (
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className="bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 text-xs"
                    >
                      Orçamento
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPrintOrder?.(order)}
                      data-testid={`button-imprimir-${order.id}`}
                    >
                      <Printer className="h-3 w-3 mr-1" />
                      Imprimir
                    </Button>
                  </div>
                ) : order.status === "ORCAMENTO" && order.printed ? (
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-xs gap-1"
                    >
                      <Check className="h-3 w-3" />
                      Impresso
                    </Badge>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      onClick={() => onReserveStock ? onReserveStock(order) : onUpdateStatus?.(order, "PEDIDO_GERADO")}
                      data-testid={`button-separar-${order.id}`}
                    >
                      Eu Separei Pedido
                    </Button>
                  </div>
                ) : order.status === "PEDIDO_GERADO" ? (
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 text-xs gap-1"
                    >
                      <Check className="h-3 w-3" />
                      Separado
                    </Badge>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                      onClick={() => onUpdateStatus?.(order, "COBRADO")}
                      data-testid={`button-cobrar-${order.id}`}
                    >
                      <DollarSign className="h-3 w-3 mr-1" />
                      Cobrar
                    </Button>
                  </div>
                ) : order.status === "COBRADO" ? (
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800 text-xs gap-1"
                    >
                      <Check className="h-3 w-3" />
                      Cobrado
                    </Badge>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onInvoice?.(order)}
                      data-testid={`button-faturar-${order.id}`}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Faturar
                    </Button>
                  </div>
                ) : order.status === "FATURADO" || order.status === "PEDIDO_FATURADO" ? (
                  <Badge 
                    variant="outline" 
                    className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 text-xs gap-1"
                  >
                    <Check className="h-3 w-3" />
                    Finalizado
                  </Badge>
                ) : order.status === "CANCELADO" || order.status === "PEDIDO_CANCELADO" ? (
                  <Badge 
                    variant="outline" 
                    className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 text-xs"
                  >
                    Cancelado
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">{order.status}</span>
                )}
              </TableCell>
              <TableCell className="text-right font-medium">
                R$ {order.total.toFixed(2)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 justify-end">
                  <Link href={`/orders/${order.id}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-view-order-${order.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
