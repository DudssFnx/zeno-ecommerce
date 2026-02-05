import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRightCircle,
  CheckCircle,
  DollarSign,
  Edit2,
  Eye,
  MoreHorizontal,
  PackageMinus,
  PackagePlus,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Link, useLocation } from "wouter";
import { StageBadge, StatusBadge } from "./StatusBadge";

const STORE_WHATSAPP = "5511992845596";

function getWhatsAppLink(order: Order): string {
  const message = `Olá! Gostaria de falar sobre o pedido #${order.orderNumber}`;
  return `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

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
  stockPosted?: boolean;
  accountsPosted?: boolean;
}

interface OrderTableProps {
  orders: Order[];
  showCustomer?: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onPrintOrder?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
  onStatusChange?: (orderId: string, newStatus: string) => void;
  onStockAction?: (orderId: string, action: "post" | "reverse") => void;
  onAccountsAction?: (orderId: string, action: "post" | "reverse") => void;
  onDeleteOrder?: (orderId: string) => void;
  canEdit?: boolean;
}

export function OrderTable({
  orders,
  showCustomer = true,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onStatusChange,
  onStockAction,
  onAccountsAction,
  onDeleteOrder,
}: OrderTableProps) {
  const [, navigate] = useLocation();
  const allSelected =
    orders.length > 0 &&
    selectedIds &&
    orders.every((o) => selectedIds.includes(o.id));

  const handleRowClick = (orderId: string) => {
    navigate(`/orders/${orderId}`);
  };

  return (
    <div className="rounded-lg border overflow-hidden pb-20 bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {selectedIds && (
              <TableHead className="w-[50px] text-center">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleSelectAll}
                />
              </TableHead>
            )}
            <TableHead className="font-semibold">Pedido #</TableHead>
            {showCustomer && (
              <TableHead className="font-semibold">Cliente</TableHead>
            )}
            <TableHead className="font-semibold">Data</TableHead>
            <TableHead className="font-semibold">Itens</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Etapa (Ações)</TableHead>
            <TableHead className="font-semibold text-right">Total</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order, idx) => {
            const isSelected = selectedIds?.includes(order.id);

            return (
              <TableRow
                key={order.id}
                onClick={() => handleRowClick(order.id)}
                className={`cursor-pointer ${
                  isSelected
                    ? "bg-orange-500/10 hover:bg-orange-500/20 transition-colors"
                    : idx % 2 === 0
                      ? "bg-background hover:bg-muted/50"
                      : "bg-muted/30 hover:bg-muted/50"
                }`}
              >
                {selectedIds && (
                  <TableCell
                    className="text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(order.id)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  {order.orderNumber}
                </TableCell>
                {showCustomer && <TableCell>{order.customer}</TableCell>}
                <TableCell className="text-muted-foreground">
                  {order.date}
                </TableCell>
                <TableCell>{order.itemCount} itens</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={order.status as any} />
                  </div>
                </TableCell>

                {/* MENU DE AÇÕES E STATUS */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-8 p-0 hover:bg-transparent justify-start font-normal"
                      >
                        <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                          <StageBadge printed={order.printed || false} />
                          {order.stockPosted && (
                            <div title="Estoque já baixado">
                              <PackageMinus className="h-3 w-3 text-orange-600" />
                            </div>
                          )}
                          {order.accountsPosted && (
                            <div title="Contas lançadas">
                              <DollarSign className="h-3 w-3 text-green-600" />
                            </div>
                          )}
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>Estoque & Ações</DropdownMenuLabel>
                      {/* BOTÕES DE ESTOQUE MANUAL */}
                      {!order.stockPosted ? (
                        <DropdownMenuItem
                          onClick={() => onStockAction?.(order.id, "post")}
                        >
                          <PackageMinus className="mr-2 h-4 w-4 text-orange-500" />{" "}
                          Lançar Estoque (Manual)
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => onStockAction?.(order.id, "reverse")}
                        >
                          <PackagePlus className="mr-2 h-4 w-4 text-blue-500" />{" "}
                          Estornar Estoque
                        </DropdownMenuItem>
                      )}
                      {!order.accountsPosted ? (
                        <DropdownMenuItem
                          onClick={() => onAccountsAction?.(order.id, "post")}
                        >
                          <DollarSign className="mr-2 h-4 w-4 text-green-500" />{" "}
                          Lançar Contas (Manual)
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => onAccountsAction?.(order.id, "reverse")}
                        >
                          <Undo2 className="mr-2 h-4 w-4 text-red-500" />{" "}
                          Estornar Contas
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Mudar Status</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => onStatusChange?.(order.id, "ORCAMENTO")}
                      >
                        <Edit2 className="mr-2 h-4 w-4" /> Voltar para Orçamento
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          onStatusChange?.(order.id, "PEDIDO_GERADO")
                        }
                      >
                        <CheckCircle className="mr-2 h-4 w-4 text-green-500" />{" "}
                        Virar Venda (Gerado)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onStatusChange?.(order.id, "FATURADO")}
                      >
                        <ArrowRightCircle className="mr-2 h-4 w-4 text-blue-500" />{" "}
                        Faturar Pedido
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onStatusChange?.(order.id, "CANCELADO")}
                      >
                        <XCircle className="mr-2 h-4 w-4 text-red-500" />{" "}
                        Cancelar
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDeleteOrder?.(order.id)}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir Pedido
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>

                <TableCell className="text-right font-medium">
                  R$ {order.total.toFixed(2)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1 justify-end">
                    <Link href={`/orders/${order.id}`}>
                      <Button variant="ghost" size="icon" title="Ver Detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <a
                      href={getWhatsAppLink(order)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-green-600 hover:text-green-700"
                        title="WhatsApp"
                      >
                        <SiWhatsapp className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
