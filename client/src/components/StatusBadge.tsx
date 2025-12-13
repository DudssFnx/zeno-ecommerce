import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OrderStatus = 
  | "ORCAMENTO_ABERTO" 
  | "ORCAMENTO_CONCLUIDO" 
  | "PEDIDO_GERADO" 
  | "PEDIDO_FATURADO" 
  | "PEDIDO_CANCELADO"
  | "pending" | "approved" | "processing" | "completed" | "cancelled";
export type UserStatus = "pending" | "approved" | "rejected";

interface StatusBadgeProps {
  status: OrderStatus | UserStatus;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ORCAMENTO_ABERTO: { label: "Orçamento Aberto", variant: "secondary" },
  ORCAMENTO_CONCLUIDO: { label: "Orçamento Enviado", variant: "outline" },
  PEDIDO_GERADO: { label: "Pedido Gerado", variant: "default" },
  PEDIDO_FATURADO: { label: "Faturado", variant: "default" },
  PEDIDO_CANCELADO: { label: "Cancelado", variant: "destructive" },
  pending: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  processing: { label: "Processando", variant: "outline" },
  completed: { label: "Concluído", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "secondary" as const };

  return (
    <Badge 
      variant={config.variant} 
      className={cn("text-xs font-semibold", className)}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}
