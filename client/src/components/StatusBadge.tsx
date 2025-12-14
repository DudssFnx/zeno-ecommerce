import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileText, Package, Receipt, XCircle } from "lucide-react";

export type OrderStatus = 
  | "ORCAMENTO"
  | "ORCAMENTO_ABERTO" 
  | "ORCAMENTO_CONCLUIDO" 
  | "PEDIDO_GERADO" 
  | "PEDIDO_FATURADO"
  | "FATURADO" 
  | "PEDIDO_CANCELADO"
  | "CANCELADO"
  | "pending" | "approved" | "processing" | "completed" | "cancelled";

export type OrderStage =
  | "AGUARDANDO_IMPRESSAO"
  | "IMPRESSO";

export type UserStatus = "pending" | "approved" | "rejected";

interface StatusBadgeProps {
  status: OrderStatus | UserStatus;
  className?: string;
}

const statusConfig: Record<string, { 
  label: string; 
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon?: typeof FileText;
}> = {
  ORCAMENTO: { 
    label: "Orçamento", 
    bgColor: "bg-slate-100 dark:bg-slate-800/50",
    textColor: "text-slate-700 dark:text-slate-300",
    borderColor: "border-slate-300 dark:border-slate-600",
    icon: FileText
  },
  ORCAMENTO_ABERTO: { 
    label: "Orçamento Aberto", 
    bgColor: "bg-slate-100 dark:bg-slate-800/50",
    textColor: "text-slate-700 dark:text-slate-300",
    borderColor: "border-slate-300 dark:border-slate-600",
    icon: FileText
  },
  ORCAMENTO_CONCLUIDO: { 
    label: "Orçamento Enviado", 
    bgColor: "bg-blue-100 dark:bg-blue-900/40",
    textColor: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-300 dark:border-blue-700",
    icon: FileText
  },
  PEDIDO_GERADO: { 
    label: "Pedido Gerado", 
    bgColor: "bg-amber-100 dark:bg-amber-900/40",
    textColor: "text-amber-700 dark:text-amber-300",
    borderColor: "border-amber-300 dark:border-amber-700",
    icon: Package
  },
  PEDIDO_FATURADO: { 
    label: "Faturado", 
    bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
    textColor: "text-emerald-700 dark:text-emerald-300",
    borderColor: "border-emerald-300 dark:border-emerald-700",
    icon: Receipt
  },
  FATURADO: { 
    label: "Faturado", 
    bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
    textColor: "text-emerald-700 dark:text-emerald-300",
    borderColor: "border-emerald-300 dark:border-emerald-700",
    icon: Receipt
  },
  PEDIDO_CANCELADO: { 
    label: "Cancelado", 
    bgColor: "bg-red-100 dark:bg-red-900/40",
    textColor: "text-red-700 dark:text-red-300",
    borderColor: "border-red-300 dark:border-red-700",
    icon: XCircle
  },
  CANCELADO: { 
    label: "Cancelado", 
    bgColor: "bg-red-100 dark:bg-red-900/40",
    textColor: "text-red-700 dark:text-red-300",
    borderColor: "border-red-300 dark:border-red-700",
    icon: XCircle
  },
  pending: { 
    label: "Pendente", 
    bgColor: "bg-yellow-100 dark:bg-yellow-900/40",
    textColor: "text-yellow-700 dark:text-yellow-300",
    borderColor: "border-yellow-300 dark:border-yellow-700"
  },
  approved: { 
    label: "Aprovado", 
    bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
    textColor: "text-emerald-700 dark:text-emerald-300",
    borderColor: "border-emerald-300 dark:border-emerald-700"
  },
  processing: { 
    label: "Processando", 
    bgColor: "bg-blue-100 dark:bg-blue-900/40",
    textColor: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-300 dark:border-blue-700"
  },
  completed: { 
    label: "Concluído", 
    bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
    textColor: "text-emerald-700 dark:text-emerald-300",
    borderColor: "border-emerald-300 dark:border-emerald-700"
  },
  cancelled: { 
    label: "Cancelado", 
    bgColor: "bg-red-100 dark:bg-red-900/40",
    textColor: "text-red-700 dark:text-red-300",
    borderColor: "border-red-300 dark:border-red-700"
  },
  rejected: { 
    label: "Rejeitado", 
    bgColor: "bg-red-100 dark:bg-red-900/40",
    textColor: "text-red-700 dark:text-red-300",
    borderColor: "border-red-300 dark:border-red-700"
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { 
    label: status, 
    bgColor: "bg-muted",
    textColor: "text-muted-foreground",
    borderColor: "border-muted"
  };

  const Icon = config.icon;

  return (
    <Badge 
      variant="outline"
      className={cn(
        "text-xs font-semibold gap-1 border",
        config.bgColor,
        config.textColor,
        config.borderColor,
        className
      )}
      data-testid={`badge-status-${status}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

interface StageBadgeProps {
  printed: boolean;
  className?: string;
}

export function StageBadge({ printed, className }: StageBadgeProps) {
  if (printed) {
    return (
      <Badge 
        variant="outline"
        className={cn(
          "text-xs font-medium gap-1 border",
          "bg-emerald-100 dark:bg-emerald-900/40",
          "text-emerald-700 dark:text-emerald-300",
          "border-emerald-300 dark:border-emerald-700",
          className
        )}
        data-testid="badge-stage-impresso"
      >
        Impresso
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline"
      className={cn(
        "text-xs font-medium gap-1 border",
        "bg-amber-100 dark:bg-amber-900/40",
        "text-amber-700 dark:text-amber-300",
        "border-amber-300 dark:border-amber-700",
        className
      )}
      data-testid="badge-stage-aguardando"
    >
      Aguardando impressão
    </Badge>
  );
}
