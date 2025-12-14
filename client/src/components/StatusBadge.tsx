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
  | "PEDIDO_IMPRESSO"
  | "PEDIDO_SEPARADO"
  | "COBRADO"
  | "CONFERENCIA"
  | "AGUARDANDO_ENVIO"
  | "FINALIZADO"
  | "PENDENTE_IMPRESSAO"
  | "IMPRESSO"
  | "SEPARADO"
  | "CONFERIR_COMPROVANTE"
  | "EM_CONFERENCIA"
  | "PEDIDO_ENVIADO";

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

const STAGES = [
  { key: "AGUARDANDO_IMPRESSAO", label: "Aguardando Impressão", shortLabel: "Impressão" },
  { key: "PEDIDO_IMPRESSO", label: "Impresso", shortLabel: "Impresso" },
  { key: "PEDIDO_SEPARADO", label: "Separado", shortLabel: "Separado" },
  { key: "COBRADO", label: "Cobrado", shortLabel: "Cobrado" },
  { key: "CONFERENCIA", label: "Conferência", shortLabel: "Conferência" },
  { key: "AGUARDANDO_ENVIO", label: "Aguardando Envio", shortLabel: "Envio" },
  { key: "FINALIZADO", label: "Finalizado", shortLabel: "Finalizado" },
];

const STAGE_MAPPING: Record<string, string> = {
  "PENDENTE_IMPRESSAO": "AGUARDANDO_IMPRESSAO",
  "IMPRESSO": "PEDIDO_IMPRESSO",
  "SEPARADO": "PEDIDO_SEPARADO",
  "PEDIDO_ENVIADO": "FINALIZADO",
  "EM_CONFERENCIA": "CONFERENCIA",
  "CONFERIR_COMPROVANTE": "CONFERENCIA",
};

export function getStageIndex(stage: string): number {
  const normalizedStage = STAGE_MAPPING[stage] || stage;
  const index = STAGES.findIndex(s => s.key === normalizedStage);
  return index >= 0 ? index : 0;
}

export function getNextStage(currentStage: string): string | null {
  const normalizedStage = STAGE_MAPPING[currentStage] || currentStage;
  const currentIndex = getStageIndex(normalizedStage);
  if (currentIndex < STAGES.length - 1) {
    return STAGES[currentIndex + 1].key;
  }
  return null;
}

export function getStageLabel(stage: string): string {
  const normalizedStage = STAGE_MAPPING[stage] || stage;
  const stageConfig = STAGES.find(s => s.key === normalizedStage);
  return stageConfig?.label || stage;
}

interface StageProgressProps {
  currentStage: string;
  className?: string;
}

export function StageProgress({ currentStage, className }: StageProgressProps) {
  const currentIndex = getStageIndex(currentStage);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {STAGES.map((stage, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        
        return (
          <div key={stage.key} className="flex items-center">
            <div 
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                isCompleted && "bg-emerald-500 dark:bg-emerald-400",
                isCurrent && "bg-blue-500 dark:bg-blue-400 ring-2 ring-blue-200 dark:ring-blue-800",
                !isCompleted && !isCurrent && "bg-muted-foreground/30"
              )}
              title={stage.label}
            />
            {index < STAGES.length - 1 && (
              <div 
                className={cn(
                  "w-3 h-0.5",
                  index < currentIndex ? "bg-emerald-500 dark:bg-emerald-400" : "bg-muted-foreground/30"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export { STAGES, STAGE_MAPPING };
