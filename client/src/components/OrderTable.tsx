import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { Eye, MoreHorizontal, Printer } from "lucide-react";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  showCustomer?: boolean;
}

export function OrderTable({ 
  orders, 
  onViewOrder, 
  onEditOrder, 
  onUpdateStatus,
  onPrintOrder,
  showCustomer = true 
}: OrderTableProps) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Pedido #</TableHead>
            {showCustomer && <TableHead className="font-semibold">Cliente</TableHead>}
            <TableHead className="font-semibold">Data</TableHead>
            <TableHead className="font-semibold">Itens</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">IMPRESSAO</TableHead>
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
                {order.printed ? (
                  <span className="text-sm font-semibold text-muted-foreground" data-testid={`text-printed-${order.id}`}>
                    PEDIDO IMPRESSO
                  </span>
                ) : (
                  <button
                    onClick={() => onPrintOrder?.(order)}
                    className="text-sm font-semibold cursor-pointer hover:underline"
                    data-testid={`button-print-${order.id}`}
                  >
                    IMPRIMIR PEDIDO
                  </button>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        data-testid={`button-order-menu-${order.id}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditOrder?.(order)}>
                        Editar Pedido
                      </DropdownMenuItem>
                      {order.status === "ORCAMENTO_ABERTO" && (
                        <DropdownMenuItem onClick={() => onUpdateStatus?.(order, "ORCAMENTO_CONCLUIDO")}>
                          Enviar Orçamento
                        </DropdownMenuItem>
                      )}
                      {order.status === "ORCAMENTO_CONCLUIDO" && (
                        <DropdownMenuItem onClick={() => onUpdateStatus?.(order, "PEDIDO_GERADO")}>
                          Gerar Pedido
                        </DropdownMenuItem>
                      )}
                      {order.status === "PEDIDO_GERADO" && (
                        <DropdownMenuItem 
                          onClick={() => onUpdateStatus?.(order, "PEDIDO_FATURADO")}
                          className="text-foreground"
                        >
                          Marcar como Faturado
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={() => onUpdateStatus?.(order, "PEDIDO_CANCELADO")}
                        className="text-destructive"
                      >
                        Cancelar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
