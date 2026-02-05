import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PaymentTerm, PaymentType } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  CreditCard,
  Edit2,
  Loader2,
  Plug,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";

// Tipo local para integrações de pagamento (não existe no schema ainda)
interface PaymentIntegration {
  id: number;
  provider: string;
  name: string;
  status: string;
  sandbox: boolean;
  enabledMethods: string[] | null;
}

export default function PaymentsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("types");
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  const [isIntegrationDialogOpen, setIsIntegrationDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<PaymentType | null>(null);
  const [editingIntegration, setEditingIntegration] =
    useState<PaymentIntegration | null>(null);

  const [typeForm, setTypeForm] = useState<{
    name: string;
    description: string;
    active: boolean;
    feeType: string;
    feeValue: string;
    compensationDays: string;
    isStoreCredit: boolean;
    paymentTermType: string;
    paymentTermId: number | null;
  }>({
    name: "",
    description: "",
    active: true,
    feeType: "" as "PERCENTUAL" | "FIXO" | "",
    feeValue: "",
    compensationDays: "",
    isStoreCredit: false,
    paymentTermType: "VISTA",
    paymentTermId: null,
  });

  const [integrationForm, setIntegrationForm] = useState({
    provider: "",
    name: "",
    status: "INATIVO" as "ATIVO" | "INATIVO" | "PENDENTE",
    sandbox: true,
    enabledMethods: [] as string[],
  });

  const { data: paymentTypes = [], isLoading: loadingTypes } = useQuery<
    PaymentType[]
  >({
    queryKey: ["/api/payment-types"],
  });

  const { data: paymentTerms = [] } = useQuery<PaymentTerm[]>({
    queryKey: ["/api/payment-terms"],
  });

  const { data: integrations = [], isLoading: loadingIntegrations } = useQuery<
    PaymentIntegration[]
  >({
    queryKey: ["/api/payment-integrations"],
  });

  const createTypeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payment-types", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-types"] });
      toast({ title: "Tipo de pagamento criado com sucesso" });
      resetTypeForm();
      setIsTypeDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Erro ao criar tipo de pagamento",
        variant: "destructive",
      });
    },
  });

  const updateTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/payment-types/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-types"] });
      toast({ title: "Tipo de pagamento atualizado" });
      resetTypeForm();
      setIsTypeDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/payment-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-types"] });
      toast({ title: "Tipo de pagamento removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover", variant: "destructive" });
    },
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/payment-types/seed-defaults"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-types"] });
      toast({ title: "Tipos de pagamento padrão criados com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar tipos padrão", variant: "destructive" });
    },
  });

  const createIntegrationMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/payment-integrations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/payment-integrations"],
      });
      toast({ title: "Integração criada com sucesso" });
      resetIntegrationForm();
      setIsIntegrationDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao criar integração", variant: "destructive" });
    },
  });

  const updateIntegrationMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/payment-integrations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/payment-integrations"],
      });
      toast({ title: "Integração atualizada" });
      resetIntegrationForm();
      setIsIntegrationDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar integração", variant: "destructive" });
    },
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/payment-integrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/payment-integrations"],
      });
      toast({ title: "Integração removida" });
    },
    onError: () => {
      toast({ title: "Erro ao remover integração", variant: "destructive" });
    },
  });

  function resetTypeForm() {
    setTypeForm({
      name: "",
      description: "",
      active: true,
      feeType: "",
      feeValue: "",
      compensationDays: "",
      isStoreCredit: false,
      paymentTermType: "VISTA",
      paymentTermId: null,
    });
    setEditingType(null);
  }

  function resetIntegrationForm() {
    setIntegrationForm({
      provider: "",
      name: "",
      status: "INATIVO",
      sandbox: true,
      enabledMethods: [],
    });
    setEditingIntegration(null);
  }

  function openEditType(pt: PaymentType) {
    setEditingType(pt);
    setTypeForm({
      name: pt.name,
      description: pt.description || "",
      active: pt.active,
      feeType: (pt.feeType as "PERCENTUAL" | "FIXO" | "") || "",
      feeValue: pt.feeValue || "",
      compensationDays: pt.compensationDays?.toString() || "",
      isStoreCredit: pt.isStoreCredit ?? false,
      paymentTermType: pt.paymentTermType || "VISTA",
      paymentTermId: pt.paymentTermId || null,
    });
    setIsTypeDialogOpen(true);
  }

  function openEditIntegration(int: PaymentIntegration) {
    setEditingIntegration(int);
    setIntegrationForm({
      provider: int.provider,
      name: int.name,
      status: int.status as any,
      sandbox: int.sandbox,
      enabledMethods: int.enabledMethods || [],
    });
    setIsIntegrationDialogOpen(true);
  }

  function handleSubmitType(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: typeForm.name,
      description: typeForm.description || null,
      active: typeForm.active,
      feeType: typeForm.feeType || null,
      feeValue: typeForm.feeValue || null,
      compensationDays: typeForm.compensationDays
        ? parseInt(typeForm.compensationDays)
        : null,
      isStoreCredit: typeForm.isStoreCredit,
      paymentTermType: typeForm.paymentTermType,
      paymentTermId:
        typeForm.paymentTermType === "PRAZO" ? typeForm.paymentTermId : null,
    };
    if (editingType) {
      updateTypeMutation.mutate({ id: editingType.id, data });
    } else {
      createTypeMutation.mutate(data);
    }
  }

  function handleSubmitIntegration(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      provider: integrationForm.provider,
      name: integrationForm.name,
      status: integrationForm.status,
      sandbox: integrationForm.sandbox,
      enabledMethods:
        integrationForm.enabledMethods.length > 0
          ? integrationForm.enabledMethods
          : null,
    };
    if (editingIntegration) {
      updateIntegrationMutation.mutate({ id: editingIntegration.id, data });
    } else {
      createIntegrationMutation.mutate(data);
    }
  }

  const availableProviders = [
    { value: "mercadopago", label: "Mercado Pago" },
    { value: "pagseguro", label: "PagSeguro" },
    { value: "stripe", label: "Stripe" },
    { value: "paypal", label: "PayPal" },
    { value: "asaas", label: "Asaas" },
    { value: "pix", label: "Pix Manual" },
  ];

  const availableMethods = ["pix", "credit_card", "debit_card", "boleto"];

  return (
    <div className="container py-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Pagamentos
          </h1>
          <p className="text-muted-foreground">
            Gerencie tipos de pagamento e integrações
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="types" data-testid="tab-payment-types">
            <CreditCard className="w-4 h-4 mr-2" />
            Tipos de Pagamento
          </TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">
            <Plug className="w-4 h-4 mr-2" />
            Integrações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <div>
                <CardTitle>Tipos de Pagamento</CardTitle>
                <CardDescription>
                  Cadastre formas de pagamento personalizadas
                </CardDescription>
              </div>
              <Dialog
                open={isTypeDialogOpen}
                onOpenChange={(open) => {
                  setIsTypeDialogOpen(open);
                  if (!open) resetTypeForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button data-testid="button-create-payment-type">
                    <Plus className="w-4 h-4 mr-2" />
                    Criar tipo de pagamento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingType
                        ? "Editar Tipo de Pagamento"
                        : "Novo Tipo de Pagamento"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmitType} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome *</Label>
                      <Input
                        id="name"
                        value={typeForm.name}
                        onChange={(e) =>
                          setTypeForm({ ...typeForm, name: e.target.value })
                        }
                        placeholder="Ex: Pagar na entrega, Pix, Cartão..."
                        required
                        data-testid="input-payment-type-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={typeForm.description}
                        onChange={(e) =>
                          setTypeForm({
                            ...typeForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="Descrição opcional..."
                        data-testid="input-payment-type-description"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Recebimento *</Label>
                      <Select
                        value={typeForm.paymentTermType}
                        onValueChange={(v) =>
                          setTypeForm({
                            ...typeForm,
                            paymentTermType: v,
                            paymentTermId:
                              v === "VISTA" ? null : typeForm.paymentTermId,
                          })
                        }
                      >
                        <SelectTrigger data-testid="select-payment-term-type">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VISTA">
                            À Vista (entra no caixa direto)
                          </SelectItem>
                          <SelectItem value="PRAZO">
                            A Prazo (gera contas a receber)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {typeForm.paymentTermType === "VISTA"
                          ? "Pagamentos à vista são contabilizados diretamente no caixa."
                          : "Pagamentos a prazo geram parcelas em Contas a Receber para baixa manual."}
                      </p>
                    </div>
                    {typeForm.paymentTermType === "PRAZO" && (
                      <div className="space-y-2">
                        <Label>Condição de Prazo *</Label>
                        <Select
                          value={typeForm.paymentTermId?.toString() || ""}
                          onValueChange={(v) =>
                            setTypeForm({
                              ...typeForm,
                              paymentTermId: v ? parseInt(v) : null,
                            })
                          }
                        >
                          <SelectTrigger data-testid="select-payment-term-id">
                            <SelectValue placeholder="Selecione a condição..." />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentTerms.map((term) => (
                              <SelectItem
                                key={term.id}
                                value={term.id.toString()}
                              >
                                {term.name} ({term.installmentCount}x -{" "}
                                {term.firstPaymentDays} dias)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Define como as parcelas serão geradas em Contas a
                          Receber.
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Switch
                        id="active"
                        checked={typeForm.active}
                        onCheckedChange={(checked) =>
                          setTypeForm({ ...typeForm, active: checked })
                        }
                        data-testid="switch-payment-type-active"
                      />
                      <Label htmlFor="active">Ativo</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Taxa</Label>
                        <Select
                          value={typeForm.feeType}
                          onValueChange={(v) =>
                            setTypeForm({ ...typeForm, feeType: v as any })
                          }
                        >
                          <SelectTrigger data-testid="select-fee-type">
                            <SelectValue placeholder="Sem taxa" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PERCENTUAL">
                              Percentual (%)
                            </SelectItem>
                            <SelectItem value="FIXO">
                              Valor Fixo (R$)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="feeValue">Valor da Taxa</Label>
                        <Input
                          id="feeValue"
                          type="number"
                          step="0.01"
                          value={typeForm.feeValue}
                          onChange={(e) =>
                            setTypeForm({
                              ...typeForm,
                              feeValue: e.target.value,
                            })
                          }
                          placeholder="0.00"
                          data-testid="input-fee-value"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="compensationDays">
                        Prazo de Compensação (dias)
                      </Label>
                      <Input
                        id="compensationDays"
                        type="number"
                        value={typeForm.compensationDays}
                        onChange={(e) =>
                          setTypeForm({
                            ...typeForm,
                            compensationDays: e.target.value,
                          })
                        }
                        placeholder="0"
                        data-testid="input-compensation-days"
                      />
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      <Switch
                        id="isStoreCredit"
                        checked={typeForm.isStoreCredit}
                        onCheckedChange={(checked) =>
                          setTypeForm({ ...typeForm, isStoreCredit: checked })
                        }
                        data-testid="switch-is-store-credit"
                      />
                      <div>
                        <Label htmlFor="isStoreCredit" className="font-medium">
                          Crédito em Loja (Fiado)
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Gera débito automaticamente no financeiro do cliente
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsTypeDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          createTypeMutation.isPending ||
                          updateTypeMutation.isPending
                        }
                        data-testid="button-save-payment-type"
                      >
                        {(createTypeMutation.isPending ||
                          updateTypeMutation.isPending) && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        {editingType ? "Salvar" : "Criar"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingTypes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : paymentTypes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum tipo de pagamento cadastrado</p>
                  <p className="text-sm mb-4">
                    Clique em "Criar tipo de pagamento" para começar ou crie os
                    tipos padrão
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => seedDefaultsMutation.mutate()}
                    disabled={seedDefaultsMutation.isPending}
                  >
                    {seedDefaultsMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Criar Tipos Padrão (Dinheiro, Pix, Cartão, etc.)
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentTypes.map((pt) => (
                    <div
                      key={pt.id}
                      className="flex items-center justify-between p-4 border rounded-md gap-4"
                      data-testid={`card-payment-type-${pt.id}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <CreditCard className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{pt.name}</span>
                            {pt.active ? (
                              <Badge variant="secondary" className="text-xs">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                <XCircle className="w-3 h-3 mr-1" />
                                Inativo
                              </Badge>
                            )}
                            {pt.paymentTermType === "PRAZO" ? (
                              <Badge
                                variant="default"
                                className="text-xs bg-blue-600"
                              >
                                A Prazo
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs text-green-600 border-green-600"
                              >
                                À Vista
                              </Badge>
                            )}
                            {pt.isStoreCredit && (
                              <Badge variant="default" className="text-xs">
                                Fiado
                              </Badge>
                            )}
                          </div>
                          {pt.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {pt.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                            {pt.feeType && pt.feeValue && (
                              <span>
                                Taxa:{" "}
                                {pt.feeType === "PERCENTUAL"
                                  ? `${pt.feeValue}%`
                                  : `R$ ${pt.feeValue}`}
                              </span>
                            )}
                            {pt.compensationDays && (
                              <span>
                                Compensação: {pt.compensationDays} dias
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditType(pt)}
                          data-testid={`button-edit-type-${pt.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteTypeMutation.mutate(pt.id)}
                          disabled={deleteTypeMutation.isPending}
                          data-testid={`button-delete-type-${pt.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <div>
                <CardTitle>Integrações de Pagamento</CardTitle>
                <CardDescription>
                  Conecte gateways de pagamento externos
                </CardDescription>
              </div>
              <Dialog
                open={isIntegrationDialogOpen}
                onOpenChange={(open) => {
                  setIsIntegrationDialogOpen(open);
                  if (!open) resetIntegrationForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button data-testid="button-create-integration">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Integração
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingIntegration
                        ? "Editar Integração"
                        : "Nova Integração"}
                    </DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={handleSubmitIntegration}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Provedor *</Label>
                      <Select
                        value={integrationForm.provider}
                        onValueChange={(v) =>
                          setIntegrationForm({
                            ...integrationForm,
                            provider: v,
                          })
                        }
                      >
                        <SelectTrigger data-testid="select-provider">
                          <SelectValue placeholder="Selecione o provedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProviders.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="intName">Nome da Integração *</Label>
                      <Input
                        id="intName"
                        value={integrationForm.name}
                        onChange={(e) =>
                          setIntegrationForm({
                            ...integrationForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="Ex: Mercado Pago - Produção"
                        required
                        data-testid="input-integration-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={integrationForm.status}
                        onValueChange={(v) =>
                          setIntegrationForm({
                            ...integrationForm,
                            status: v as any,
                          })
                        }
                      >
                        <SelectTrigger data-testid="select-integration-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ATIVO">Ativo</SelectItem>
                          <SelectItem value="INATIVO">Inativo</SelectItem>
                          <SelectItem value="PENDENTE">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="sandbox"
                        checked={integrationForm.sandbox}
                        onCheckedChange={(checked) =>
                          setIntegrationForm({
                            ...integrationForm,
                            sandbox: checked,
                          })
                        }
                        data-testid="switch-sandbox"
                      />
                      <Label htmlFor="sandbox">Modo Sandbox/Teste</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>Métodos Habilitados</Label>
                      <div className="flex flex-wrap gap-2">
                        {availableMethods.map((method) => (
                          <Badge
                            key={method}
                            variant={
                              integrationForm.enabledMethods.includes(method)
                                ? "default"
                                : "outline"
                            }
                            className="cursor-pointer"
                            onClick={() => {
                              const newMethods =
                                integrationForm.enabledMethods.includes(method)
                                  ? integrationForm.enabledMethods.filter(
                                      (m) => m !== method,
                                    )
                                  : [...integrationForm.enabledMethods, method];
                              setIntegrationForm({
                                ...integrationForm,
                                enabledMethods: newMethods,
                              });
                            }}
                            data-testid={`badge-method-${method}`}
                          >
                            {method === "pix" && "Pix"}
                            {method === "credit_card" && "Cartão de Crédito"}
                            {method === "debit_card" && "Cartão de Débito"}
                            {method === "boleto" && "Boleto"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsIntegrationDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          createIntegrationMutation.isPending ||
                          updateIntegrationMutation.isPending
                        }
                        data-testid="button-save-integration"
                      >
                        {(createIntegrationMutation.isPending ||
                          updateIntegrationMutation.isPending) && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        {editingIntegration ? "Salvar" : "Criar"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingIntegrations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : integrations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Plug className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma integração configurada</p>
                  <p className="text-sm">
                    Conecte um gateway de pagamento para processar pagamentos
                    online
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {integrations.map((int) => (
                    <div
                      key={int.id}
                      className="flex items-center justify-between p-4 border rounded-md gap-4"
                      data-testid={`card-integration-${int.id}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Plug className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{int.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {int.provider}
                            </Badge>
                            {int.status === "ATIVO" && (
                              <Badge variant="secondary" className="text-xs">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Ativo
                              </Badge>
                            )}
                            {int.status === "INATIVO" && (
                              <Badge variant="outline" className="text-xs">
                                <XCircle className="w-3 h-3 mr-1" />
                                Inativo
                              </Badge>
                            )}
                            {int.status === "PENDENTE" && (
                              <Badge variant="outline" className="text-xs">
                                Pendente
                              </Badge>
                            )}
                            {int.sandbox && (
                              <Badge variant="outline" className="text-xs">
                                Sandbox
                              </Badge>
                            )}
                          </div>
                          {int.enabledMethods &&
                            int.enabledMethods.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Métodos: {int.enabledMethods.join(", ")}
                              </p>
                            )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditIntegration(int)}
                          data-testid={`button-edit-integration-${int.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            deleteIntegrationMutation.mutate(int.id)
                          }
                          disabled={deleteIntegrationMutation.isPending}
                          data-testid={`button-delete-integration-${int.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
