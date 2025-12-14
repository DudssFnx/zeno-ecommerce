import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge, StageBadge } from "./StatusBadge";
import { Eye } from "lucide-react";
import { Link } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";

export interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  date: string;
  status: string;
  stage: string;
  total: number;
  itemCount: number;
  printed?: boolean;
}

interface OrderTableProps {
  orders: Order[];
  showCustomer?: boolean;
  selectedOrderIds?: Set<string>;
  onSelectionChange?: (orderId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
}


export function OrderTable({ 
  orders, 
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
                <StageBadge printed={order.printed || false} />
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
