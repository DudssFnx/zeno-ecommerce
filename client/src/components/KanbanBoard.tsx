import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { STAGES, getStageIndex, getStageLabel, STAGE_MAPPING } from "./StatusBadge";
import { Package, Clock, CheckCircle2, Truck, ClipboardCheck, CreditCard, Printer } from "lucide-react";
import type { Order } from "./OrderTable";

interface KanbanBoardProps {
  orders: Order[];
  onOrderClick?: (order: Order) => void;
  onStageChange?: (order: Order, newStage: string) => void;
}

const STAGE_ICONS: Record<string, typeof Package> = {
  "AGUARDANDO_IMPRESSAO": Printer,
  "PEDIDO_IMPRESSO": ClipboardCheck,
  "PEDIDO_SEPARADO": Package,
  "COBRADO": CreditCard,
  "CONFERENCIA": CheckCircle2,
  "AGUARDANDO_ENVIO": Truck,
  "FINALIZADO": CheckCircle2,
};

const STAGE_COLORS: Record<string, { bg: string; border: string; header: string }> = {
  "AGUARDANDO_IMPRESSAO": { 
    bg: "bg-amber-50/50 dark:bg-amber-950/20", 
    border: "border-amber-200 dark:border-amber-800",
    header: "bg-amber-100 dark:bg-amber-900/40"
  },
  "PEDIDO_IMPRESSO": { 
    bg: "bg-blue-50/50 dark:bg-blue-950/20", 
    border: "border-blue-200 dark:border-blue-800",
    header: "bg-blue-100 dark:bg-blue-900/40"
  },
  "PEDIDO_SEPARADO": { 
    bg: "bg-violet-50/50 dark:bg-violet-950/20", 
    border: "border-violet-200 dark:border-violet-800",
    header: "bg-violet-100 dark:bg-violet-900/40"
  },
  "COBRADO": { 
    bg: "bg-orange-50/50 dark:bg-orange-950/20", 
    border: "border-orange-200 dark:border-orange-800",
    header: "bg-orange-100 dark:bg-orange-900/40"
  },
  "CONFERENCIA": { 
    bg: "bg-cyan-50/50 dark:bg-cyan-950/20", 
    border: "border-cyan-200 dark:border-cyan-800",
    header: "bg-cyan-100 dark:bg-cyan-900/40"
  },
  "AGUARDANDO_ENVIO": { 
    bg: "bg-indigo-50/50 dark:bg-indigo-950/20", 
    border: "border-indigo-200 dark:border-indigo-800",
    header: "bg-indigo-100 dark:bg-indigo-900/40"
  },
  "FINALIZADO": { 
    bg: "bg-emerald-50/50 dark:bg-emerald-950/20", 
    border: "border-emerald-200 dark:border-emerald-800",
    header: "bg-emerald-100 dark:bg-emerald-900/40"
  },
};

function normalizeStage(stage: string): string {
  return STAGE_MAPPING[stage] || stage;
}

function getOrdersForStage(orders: Order[], stageKey: string): Order[] {
  return orders.filter(order => {
    const normalizedStage = normalizeStage(order.stage);
    return normalizedStage === stageKey;
  });
}

function OrderCard({ order, onClick }: { order: Order; onClick?: () => void }) {
  return (
    <Card 
      className="cursor-pointer hover-elevate active-elevate-2 transition-all"
      onClick={onClick}
      data-testid={`kanban-card-${order.id}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm truncate" data-testid={`kanban-order-number-${order.id}`}>
            {order.orderNumber}
          </span>
          <Badge variant="secondary" className="text-xs shrink-0">
            {order.itemCount} itens
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate" data-testid={`kanban-customer-${order.id}`}>
          {order.customer}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{order.date}</span>
          <span className="font-medium text-sm" data-testid={`kanban-total-${order.id}`}>
            R$ {order.total.toFixed(2)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function KanbanBoard({ orders, onOrderClick, onStageChange }: KanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-board">
      {STAGES.map((stage) => {
        const stageOrders = getOrdersForStage(orders, stage.key);
        const Icon = STAGE_ICONS[stage.key] || Package;
        const colors = STAGE_COLORS[stage.key] || STAGE_COLORS["AGUARDANDO_IMPRESSAO"];
        
        return (
          <div 
            key={stage.key}
            className={cn(
              "flex-shrink-0 w-72 rounded-md border",
              colors.bg,
              colors.border
            )}
            data-testid={`kanban-column-${stage.key}`}
          >
            <div className={cn("p-3 rounded-t-md border-b", colors.header, colors.border)}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">{stage.label}</h3>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {stageOrders.length}
                </Badge>
              </div>
            </div>
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="p-2 space-y-2">
                {stageOrders.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-xs">
                    Nenhum pedido
                  </div>
                ) : (
                  stageOrders.map((order) => (
                    <OrderCard 
                      key={order.id} 
                      order={order}
                      onClick={() => onOrderClick?.(order)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
