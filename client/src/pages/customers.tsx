import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useCompanyResource } from "@/hooks/useCompanyResource";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle, // 🛑 Ícone do Alerta
  Ban,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

// --- MÁSCARAS ---
const masks = {
  cnpj: (v: string) =>
    v
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
      .substring(0, 18),
  cpf: (v: string) =>
    v
      .replace(/\D/g, "")
      .replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
      .substring(0, 14),
  cep: (v: string) =>
    v
      .replace(/\D/g, "")
      .replace(/^(\d{5})(\d{3})/, "$1-$2")
      .substring(0, 9),
  phone: (v: string) =>
    v
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
      .substring(0, 15),
};

type CustomerType = User & {
  company?: string | null;
  tradingName?: string | null;
};

// Interface do estado do formulário
interface CustomerFormState {
  personType: string;
  cnpj: string;
  cpf: string;
  company: string;
  tradingName: string;
  stateRegistration: string;
  firstName: string;
  email: string;
  phone: string;
  password?: string;
  cep: string;
  address: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

const initialFormState: CustomerFormState = {
  personType: "juridica",
  cnpj: "",
  cpf: "",
  company: "",
  tradingName: "",
  stateRegistration: "",
  firstName: "",
  email: "",
  phone: "",
  password: "",
  cep: "",
  address: "",
  addressNumber: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

// ✅ HELPER PARA LIMPAR A MENSAGEM DE ERRO
const getCleanErrorMessage = (error: any) => {
  if (!error) return "Erro desconhecido";
  let msg = error.message || error.toString();

  // Tenta remover prefixos como "409: " ou "Error: "
  msg = msg.replace(/^(Error: )?(\d{3}: )?/, "");

  // Se a mensagem for um JSON stringificado, tenta parsear
  try {
    const parsed = JSON.parse(msg);
    if (parsed.message) return parsed.message;
  } catch (e) {
    // Não é JSON, retorna a string limpa
  }

  return msg;
};

// ✅ COMPONENTE DE FORMULÁRIO COM O BOX VERMELHO
function CustomerFormContent({
  formData,
  setFormData,
  isEdit = false,
  formLoading,
  onSearchCNPJ,
  onSearchCEP,
  error, // Recebe o erro
}: {
  formData: CustomerFormState;
  setFormData: (data: CustomerFormState) => void;
  isEdit?: boolean;
  formLoading: boolean;
  onSearchCNPJ: (cnpj: string) => void;
  onSearchCEP: (cep: string) => void;
  error: string | null;
}) {
  return (
    <div className="py-4 space-y-6">
      {/* 🛑 BOX VERMELHO - IGUAL AO DE PRODUTOS */}
      {error && (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h4 className="font-medium text-red-600 leading-none">
                Erro de Validação
              </h4>
              <p className="text-sm text-red-500 opacity-90">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Label className="text-base font-semibold">Tipo de Pessoa</Label>
        <RadioGroup
          value={formData.personType}
          onValueChange={(v) => setFormData({ ...formData, personType: v })}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2 border p-3 rounded-lg w-full cursor-pointer hover:bg-muted/50">
            <RadioGroupItem
              value="juridica"
              id={`pj${isEdit ? "-edit" : ""}`}
            />
            <Label
              htmlFor={`pj${isEdit ? "-edit" : ""}`}
              className="cursor-pointer flex-1"
            >
              Pessoa Jurídica (CNPJ)
            </Label>
          </div>
          <div className="flex items-center space-x-2 border p-3 rounded-lg w-full cursor-pointer hover:bg-muted/50">
            <RadioGroupItem value="fisica" id={`pf${isEdit ? "-edit" : ""}`} />
            <Label
              htmlFor={`pf${isEdit ? "-edit" : ""}`}
              className="cursor-pointer flex-1"
            >
              Pessoa Física (CPF)
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {formData.personType === "juridica" && (
          <>
            <div className="md:col-span-2 space-y-2">
              <Label>CNPJ *</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.cnpj}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cnpj: masks.cnpj(e.target.value),
                    })
                  }
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
                <Button
                  type="button"
                  onClick={() => onSearchCNPJ(formData.cnpj)}
                  disabled={formLoading}
                  variant="secondary"
                >
                  {formLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Buscar"
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Razão Social *</Label>
              <Input
                value={formData.company}
                onChange={(e) =>
                  setFormData({ ...formData, company: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Nome Fantasia</Label>
              <Input
                value={formData.tradingName}
                onChange={(e) =>
                  setFormData({ ...formData, tradingName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Inscrição Estadual</Label>
              <Input
                value={formData.stateRegistration}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stateRegistration: e.target.value,
                  })
                }
                placeholder="Isento ou número"
              />
            </div>
            <div className="space-y-2">
              <Label>Responsável / Contato</Label>
              <Input
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                placeholder="Quem recebe o pedido?"
              />
            </div>
          </>
        )}

        {formData.personType === "fisica" && (
          <>
            <div className="md:col-span-2 space-y-2">
              <Label>CPF *</Label>
              <Input
                value={formData.cpf}
                onChange={(e) =>
                  setFormData({ ...formData, cpf: masks.cpf(e.target.value) })
                }
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Nome Completo *</Label>
              <Input
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>Email de Acesso *</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Telefone / WhatsApp</Label>
          <Input
            value={formData.phone}
            onChange={(e) =>
              setFormData({
                ...formData,
                phone: masks.phone(e.target.value),
              })
            }
            placeholder="(00) 00000-0000"
          />
        </div>

        {isEdit && (
          <div className="space-y-2 md:col-span-2">
            <Label className="text-yellow-600">Alterar Senha (Opcional)</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="Deixe em branco para manter a atual"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>CEP</Label>
          <Input
            value={formData.cep}
            onChange={(e) => {
              const v = masks.cep(e.target.value);
              setFormData({ ...formData, cep: v });
              if (v.length === 9) onSearchCEP(v);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Endereço</Label>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="Rua/Av"
            />
            <Input
              className="w-24"
              value={formData.addressNumber}
              onChange={(e) =>
                setFormData({ ...formData, addressNumber: e.target.value })
              }
              placeholder="Nº"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Bairro</Label>
          <Input
            value={formData.neighborhood}
            onChange={(e) =>
              setFormData({ ...formData, neighborhood: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Estado (UF)</Label>
          <Input
            value={formData.state}
            maxLength={2}
            onChange={(e) =>
              setFormData({ ...formData, state: e.target.value })
            }
          />
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerType | null>(
    null,
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomerFormState>(initialFormState);

  // Multi-tenant: busca clientes da empresa
  const {
    data: usersData = [],
    isLoading,
    refetch,
  } = useCompanyResource("users", companyId);

  const allCustomers = useMemo(
    () => (usersData || []).filter((u: any) => u.role === "customer"),
    [usersData],
  );
  const pendingCustomers = allCustomers.filter((u: any) => !u.approved);
  const activeCustomers = allCustomers.filter(
    (u: any) => u.approved && u.ativo !== false,
  );
  const inactiveCustomers = allCustomers.filter(
    (u: any) => u.approved && u.ativo === false,
  );
  const filterList = (list: CustomerType[]) => {
    const term = searchQuery.toLowerCase();
    return list.filter(
      (u) =>
        (u.firstName?.toLowerCase().includes(term) ?? false) ||
        (u.company?.toLowerCase().includes(term) ?? false) ||
        (u.email?.toLowerCase().includes(term) ?? false) ||
        (u.cnpj?.includes(term) ?? false) ||
        (u.cpf?.includes(term) ?? false),
    );
  };
  const getDisplayedList = () => {
    switch (activeTab) {
      case "pending":
        return filterList(pendingCustomers);
      case "inactive":
        return filterList(inactiveCustomers);
      default:
        return filterList(activeCustomers);
    }
  };

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Excluído", description: "Cliente removido." });
      setCustomerToDelete(null);
    },
    onError: () =>
      toast({
        title: "Erro",
        description: "Falha ao excluir",
        variant: "destructive",
      }),
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormState) => {
      // Limpa erro anterior
      setErrorMessage(null);

      const payload = {
        ...data,
        username: data.email,
        role: "customer",
        customerType: data.personType,
        cnpj: data.personType === "juridica" ? data.cnpj : null,
        company: data.personType === "juridica" ? data.company : null,
        tradingName: data.personType === "juridica" ? data.tradingName : null,
        stateRegistration:
          data.personType === "juridica" ? data.stateRegistration : null,
        cpf: data.personType === "fisica" ? data.cpf : null,
        firstName:
          data.personType === "juridica" ? data.tradingName : data.firstName,
      };

      const res = await apiRequest("POST", "/api/register", payload);
      // Se a resposta não for OK, capturamos o body para pegar a mensagem
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(JSON.stringify(errData)); // Lança o JSON inteiro para processarmos no onError
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreateDialog(false);
      setFormData(initialFormState);
      setErrorMessage(null);
      toast({ title: "Sucesso!", description: "Cliente cadastrado." });
    },
    onError: (err: any) => {
      // ✅ AQUI: Limpamos a mensagem feia antes de mostrar
      const cleanMsg = getCleanErrorMessage(err);
      setErrorMessage(cleanMsg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<User> }) => {
      setErrorMessage(null);
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(JSON.stringify(errData));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Atualizado", description: "Dados salvos com sucesso." });
      setShowEditDialog(false);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      const cleanMsg = getCleanErrorMessage(err);
      setErrorMessage(cleanMsg);
    },
  });

  const handleApprove = (id: string) => {
    updateMutation.mutate({ id, data: { approved: true, ativo: true } });
    toast({ title: "Aprovado", description: "Acesso liberado." });
  };

  const handleToggleStatus = (user: CustomerType) => {
    updateMutation.mutate({ id: user.id, data: { ativo: !user.ativo } });
  };

  const handleEdit = (customer: CustomerType) => {
    setSelectedCustomerId(customer.id);
    setErrorMessage(null);
    setFormData({
      personType: customer.cnpj ? "juridica" : "fisica",
      cnpj: customer.cnpj || "",
      cpf: customer.cpf || "",
      company: customer.company || "",
      tradingName: customer.tradingName || "",
      stateRegistration: customer.stateRegistration || "",
      firstName: customer.firstName || "",
      email: customer.email || "",
      phone: customer.phone || "",
      cep: customer.cep || "",
      address: customer.address || "",
      addressNumber: customer.addressNumber || "",
      complement: customer.complement || "",
      neighborhood: customer.neighborhood || "",
      city: customer.city || "",
      state: customer.state || "",
      password: "",
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!selectedCustomerId) return;
    const data = formData;
    const payload: any = {
      customerType: data.personType,
      cnpj: data.personType === "juridica" ? data.cnpj : null,
      company: data.personType === "juridica" ? data.company : null,
      tradingName: data.personType === "juridica" ? data.tradingName : null,
      stateRegistration:
        data.personType === "juridica" ? data.stateRegistration : null,
      cpf: data.personType === "fisica" ? data.cpf : null,
      firstName:
        data.personType === "juridica" ? data.tradingName : data.firstName,
      email: data.email,
      phone: data.phone,
      cep: data.cep,
      address: data.address,
      addressNumber: data.addressNumber,
      complement: data.complement,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
    };

    if (data.password && data.password.trim() !== "") {
      payload.password = data.password;
    }

    updateMutation.mutate({ id: selectedCustomerId, data: payload });
  };

  const fetchCNPJData = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return;
    setFormLoading(true);
    try {
      const response = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`,
      );
      if (!response.ok) throw new Error();
      const data = await response.json();
      setFormData((prev) => ({
        ...prev,
        company: data.razao_social,
        tradingName: data.nome_fantasia || data.razao_social,
        cep: masks.cep(data.cep || ""),
        address: data.logradouro,
        addressNumber: data.numero,
        neighborhood: data.bairro,
        city: data.municipio,
        state: data.uf,
        complement: data.complemento,
        phone: data.ddd_telefone_1
          ? masks.phone(`${data.ddd_telefone_1}${data.telefone_1}`)
          : prev.phone,
      }));
      toast({ title: "Encontrado!", description: "Dados carregados." });
    } catch (e) {
      toast({
        title: "Erro",
        description: "CNPJ não encontrado.",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const fetchCEPData = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData((p) => ({
          ...p,
          address: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf,
        }));
      }
    } catch (e) {}
  };

  const stats = useMemo(() => {
    return {
      total: allCustomers.length,
      approved: activeCustomers.length,
      pending: pendingCustomers.length,
    };
  }, [allCustomers, activeCustomers, pendingCustomers]);

  const CustomerCard = ({ customer }: { customer: CustomerType }) => {
    const isPJ = !!customer.cnpj;

    // ✅ LÓGICA NOVA: Aplica a máscara correta antes de exibir
    let documentDisplay = "N/A";
    if (customer.cnpj) {
      documentDisplay = masks.cnpj(customer.cnpj);
    } else if (customer.cpf) {
      documentDisplay = masks.cpf(customer.cpf);
    }

    return (
      <Card className="hover:shadow-md transition-all border-l-4 border-l-primary/50">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{isPJ ? "Jurídica" : "Física"}</Badge>
                <h3 className="font-bold text-lg leading-none">
                  {isPJ
                    ? customer.tradingName || customer.company
                    : customer.firstName}
                </h3>
              </div>
              {isPJ && (
                <p className="text-sm text-muted-foreground">
                  {customer.company}
                </p>
              )}
            </div>
            <div className="flex gap-1">
              {!customer.approved && (
                <Button
                  size="sm"
                  className="h-8 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleApprove(customer.id)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEdit(customer)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={() => setCustomerToDelete(customer)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="text-sm space-y-1.5 text-muted-foreground bg-muted/20 p-3 rounded-md">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs border px-1 bg-background rounded">
                {isPJ ? "CNPJ" : "CPF"}
              </span>
              <span className="font-medium text-foreground">
                {/* ✅ USA A VARIÁVEL FORMATADA */}
                {documentDisplay}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" /> {customer.email}
            </div>
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> {customer.phone}
              </div>
            )}
            {(customer.city || customer.state) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> {customer.city} -{" "}
                {customer.state}
              </div>
            )}
          </div>

          {customer.approved && (
            <div className="mt-3 flex justify-end">
              <Button
                variant={customer.ativo !== false ? "ghost" : "outline"}
                size="sm"
                className={`h-7 text-xs ${
                  customer.ativo !== false
                    ? "text-muted-foreground hover:text-red-600"
                    : "text-green-600 border-green-200 bg-green-50"
                }`}
                onClick={() => handleToggleStatus(customer)}
              >
                {customer.ativo !== false ? (
                  <>
                    <Ban className="h-3 w-3 mr-1" /> Bloquear
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Reativar
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" /> Gestão de Clientes
          </h1>
          <p className="text-muted-foreground">
            Aprovação e controle de carteira B2B e B2C.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => {
              setErrorMessage(null);
              setFormData(initialFormState);
              setShowCreateDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Novo Cliente
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm text-muted-foreground font-medium">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
        </Card>
        <Card className="p-4 flex items-center justify-between shadow-sm border-l-4 border-l-green-500">
          <div>
            <p className="text-sm text-muted-foreground font-medium">Ativos</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.approved}
            </p>
          </div>
          <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
            <UserCheck className="h-5 w-5 text-green-600" />
          </div>
        </Card>
        <Card className="p-4 flex items-center justify-between shadow-sm border-l-4 border-l-yellow-500">
          <div>
            <p className="text-sm text-muted-foreground font-medium">
              Pendentes
            </p>
            <p className="text-2xl font-bold text-yellow-600">
              {stats.pending}
            </p>
          </div>
          <div className="h-10 w-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <UserX className="h-5 w-5 text-yellow-600" />
          </div>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por Razão Social, Nome, CNPJ ou Email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-[600px] grid-cols-3">
          <TabsTrigger value="active">Ativos</TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            Pendentes
            {stats.pending > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                {stats.pending}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="inactive">Bloqueados</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : getDisplayedList().length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/10">
              <p className="text-muted-foreground">
                Nenhum cliente encontrado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {getDisplayedList().map((customer) => (
                <CustomerCard key={customer.id} customer={customer} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL DE CRIAÇÃO */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Cadastro</DialogTitle>
          </DialogHeader>
          <CustomerFormContent
            formData={formData}
            setFormData={setFormData}
            isEdit={false}
            formLoading={formLoading}
            onSearchCNPJ={fetchCNPJData}
            onSearchCEP={fetchCEPData}
            error={errorMessage}
          />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createCustomerMutation.mutate(formData)}
              disabled={createCustomerMutation.isPending}
            >
              {createCustomerMutation.isPending && (
                <Loader2 className="mr-2 animate-spin h-4 w-4" />
              )}{" "}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE EDIÇÃO */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <CustomerFormContent
            formData={formData}
            setFormData={setFormData}
            isEdit={true}
            formLoading={formLoading}
            onSearchCNPJ={fetchCNPJData}
            onSearchCEP={fetchCEPData}
            error={errorMessage}
          />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 animate-spin h-4 w-4" />
              )}{" "}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão */}
      <AlertDialog
        open={!!customerToDelete}
        onOpenChange={(open) => !open && setCustomerToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá permanentemente{" "}
              <span className="font-bold text-foreground">
                {customerToDelete?.company || customerToDelete?.firstName}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() =>
                customerToDelete &&
                deleteUserMutation.mutate(customerToDelete.id)
              }
            >
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
