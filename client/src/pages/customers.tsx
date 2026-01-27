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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMemo, useState } from "react";
// IMPORTANTE: Importamos o B2bUser base
import type { B2bUser } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";

// === CORREÇÃO DE TIPAGEM ===
// Definimos um tipo que combina o Schema do Banco com os campos mapeados pela API
type CustomerType = B2bUser & {
  // Campos mapeados pelo storage.ts (Inglês)
  company?: string | null;
  tradingName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  taxRegime?: string | null;
  stateRegistration?: string | null;
  phone?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

export default function CustomersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Usamos o novo tipo CustomerType aqui
  const [editingCustomer, setEditingCustomer] = useState<CustomerType | null>(
    null,
  );
  const [formLoading, setFormLoading] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerType | null>(
    null,
  );

  // Estado inicial do formulário
  const [newCustomer, setNewCustomer] = useState({
    personType: "juridica",
    cnpj: "",
    cpf: "",
    company: "",
    tradingName: "",
    firstName: "",
    email: "",
    phone: "",
    stateRegistration: "",
    taxRegime: "1", // 1 = Simples Nacional (Padrão)
    cep: "",
    address: "",
    addressNumber: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const {
    data: usersData = [],
    isLoading,
    refetch,
  } = useQuery<CustomerType[]>({
    // Tipagem corrigida aqui também
    queryKey: ["/api/users"],
  });

  // Filtra apenas quem tem role 'customer'
  const customers = useMemo(() => {
    return usersData.filter((u) => u.role === "customer");
  }, [usersData]);

  const stats = useMemo(() => {
    const total = customers.length;
    const approved = customers.filter((c) => c.approved).length;
    const pending = customers.filter((c) => !c.approved).length;
    // Agora o TS sabe que 'company' existe
    const withCompany =
      customers.filter((c) => c.company).length ||
      customers.filter((c) => c.razaoSocial).length;
    const atacado = customers.filter(
      (c) => c.customerType === "atacado",
    ).length;
    const varejo = customers.filter(
      (c) => c.customerType === "varejo" || !c.customerType,
    ).length;

    return {
      total,
      approved,
      pending,
      withCompany,
      atacado,
      varejo,
      approvedPercent: total > 0 ? Math.round((approved / total) * 100) : 0,
      pendingPercent: total > 0 ? Math.round((pending / total) * 100) : 0,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.email?.toLowerCase().includes(query) ||
        c.firstName?.toLowerCase().includes(query) ||
        c.nome?.toLowerCase().includes(query) ||
        c.razaoSocial?.toLowerCase().includes(query) ||
        c.company?.toLowerCase().includes(query) ||
        c.cnpj?.includes(query) ||
        c.cpf?.includes(query),
    );
  }, [customers, searchQuery]);

  const updateUserMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CustomerType>;
    }) => {
      await apiRequest("PATCH", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Cliente Excluído",
        description: "O cliente foi removido com sucesso.",
      });
      setCustomerToDelete(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao excluir cliente",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (customer: CustomerType) => {
    setEditingCustomer(customer);
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!editingCustomer) return;
    updateUserMutation.mutate(
      { id: editingCustomer.id, data: editingCustomer },
      {
        onSuccess: () => {
          toast({
            title: "Sucesso",
            description: "Cadastro atualizado com sucesso",
          });
          setShowEditDialog(false);
          setEditingCustomer(null);
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Falha ao atualizar cadastro",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleApprove = (user: CustomerType) => {
    updateUserMutation.mutate(
      { id: user.id, data: { approved: true } },
      {
        onSuccess: () => {
          toast({
            title: "Cliente Aprovado",
            description: `${user.email} foi aprovado.`,
          });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Falha ao aprovar cliente",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleReject = (user: CustomerType) => {
    updateUserMutation.mutate(
      { id: user.id, data: { approved: false } },
      {
        onSuccess: () => {
          toast({
            title: "Cliente Bloqueado",
            description: `${user.email} foi bloqueado.`,
          });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Falha ao bloquear cliente",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleToggleCustomerType = (user: CustomerType) => {
    const newType = user.customerType === "atacado" ? "varejo" : "atacado";
    updateUserMutation.mutate(
      { id: user.id, data: { customerType: newType } },
      {
        onSuccess: () => {
          toast({
            title: "Tipo Atualizado",
            description: `${user.nome || user.email} agora é ${newType === "atacado" ? "Atacado" : "Varejo"}.`,
          });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Falha ao atualizar tipo de cliente",
            variant: "destructive",
          });
        },
      },
    );
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  };

  // === BUSCA INTELIGENTE DE CNPJ (CRIAÇÃO) ===
  const fetchCNPJData = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, "");

    if (cleanCnpj.length !== 14) {
      toast({
        title: "CNPJ Inválido",
        description: "O CNPJ deve ter 14 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setFormLoading(true);
    try {
      const response = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`,
      );

      if (!response.ok) throw new Error("CNPJ não encontrado");

      const data = await response.json();

      let regimeSugerido = "3";
      if (data.porte === "MEI" || data.porte === "ME" || data.porte === "EPP") {
        regimeSugerido = "1";
      }

      setNewCustomer((prev) => ({
        ...prev,
        company: data.razao_social || "",
        tradingName: data.nome_fantasia || data.razao_social || "",
        firstName: data.nome_fantasia || data.razao_social || "",
        phone: data.ddd_telefone_1 || "",
        cep: data.cep?.replace(/\D/g, "") || "",
        address: data.logradouro || "",
        addressNumber: data.numero || "",
        complement: data.complemento || "",
        neighborhood: data.bairro || "",
        city: data.municipio || "",
        state: data.uf || "",
        taxRegime: regimeSugerido,
      }));

      toast({
        title: "Dados Importados!",
        description:
          "Dados da empresa e regime tributário sugerido carregados.",
        className: "bg-green-600 text-white border-green-700",
      });
    } catch (e) {
      toast({
        title: "Erro na Busca",
        description: "Não foi possível buscar dados deste CNPJ na Receita.",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  // === BUSCA INTELIGENTE DE CNPJ (EDIÇÃO) ===
  const fetchCNPJDataEdit = async (cnpj: string) => {
    if (!editingCustomer) return;
    const cleanCnpj = cnpj.replace(/\D/g, "");

    if (cleanCnpj.length !== 14) {
      toast({
        title: "CNPJ Inválido",
        description: "O CNPJ deve ter 14 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setFormLoading(true);
    try {
      const response = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`,
      );
      if (!response.ok) throw new Error("CNPJ não encontrado");
      const data = await response.json();

      let regimeSugerido = "3";
      if (data.porte === "MEI" || data.porte === "ME" || data.porte === "EPP") {
        regimeSugerido = "1";
      }

      setEditingCustomer((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          company: data.razao_social || "",
          razaoSocial: data.razao_social || "",
          tradingName: data.nome_fantasia || data.razao_social || "",
          nomeFantasia: data.nome_fantasia || data.razao_social || "",
          firstName: data.nome_fantasia || data.razao_social || "",
          nome: data.nome_fantasia || data.razao_social || "",
          phone: data.ddd_telefone_1 || "",
          telefone: data.ddd_telefone_1 || "",
          cep: data.cep?.replace(/\D/g, "") || "",
          address: data.logradouro || "",
          endereco: data.logradouro || "",
          addressNumber: data.numero || "",
          numero: data.numero || "",
          complement: data.complemento || "",
          complemento: data.complemento || "",
          neighborhood: data.bairro || "",
          bairro: data.bairro || "",
          city: data.municipio || "",
          cidade: data.municipio || "",
          state: data.uf || "",
          estado: data.uf || "",
          taxRegime: regimeSugerido,
          regimeTributario: regimeSugerido,
        };
      });

      toast({
        title: "Dados Atualizados!",
        description: "Informações da Receita aplicadas ao cadastro.",
        className: "bg-green-600 text-white",
      });
    } catch (e) {
      toast({
        title: "Erro na Busca",
        description: "Falha ao buscar dados na Receita.",
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
      const response = await fetch(
        `https://viacep.com.br/ws/${cleanCep}/json/`,
      );
      if (response.ok) {
        const data = await response.json();
        if (!data.erro) {
          setNewCustomer((prev) => ({
            ...prev,
            address: data.logradouro || prev.address,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
        }
      }
    } catch (e) {}
  };

  const fetchCEPDataEdit = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8 || !editingCustomer) return;
    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cleanCep}/json/`,
      );
      if (response.ok) {
        const data = await response.json();
        if (!data.erro) {
          setEditingCustomer({
            ...editingCustomer,
            address: data.logradouro || editingCustomer.address,
            neighborhood: data.bairro || editingCustomer.neighborhood,
            city: data.localidade || editingCustomer.city,
            state: data.uf || editingCustomer.state,
          });
        }
      }
    } catch (e) {}
  };

  const createCustomerMutation = useMutation({
    mutationFn: async (data: typeof newCustomer) => {
      await apiRequest("POST", "/api/register", {
        ...data,
        username: data.email,
        role: "customer",
        firstName: data.firstName || data.tradingName || data.company,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreateDialog(false);
      setNewCustomer({
        personType: "juridica",
        cnpj: "",
        cpf: "",
        company: "",
        tradingName: "",
        firstName: "",
        email: "",
        phone: "",
        stateRegistration: "",
        taxRegime: "1",
        cep: "",
        address: "",
        addressNumber: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
      });
      toast({
        title: "Sucesso",
        description: "Cliente cadastrado com sucesso",
      });
    },
    onError: (error: any) => {
      const msg = error.message || "Falha ao cadastrar cliente";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie sua carteira de clientes
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            data-testid="button-refresh-customers"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            data-testid="button-add-customer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar Cliente
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">
                  Total de Clientes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <UserCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {stats.approved}
                </p>
                <p className="text-xs text-muted-foreground">Clientes Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <UserX className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.pending}
                </p>
                <p className="text-xs text-muted-foreground">
                  Aguardando Aprovação
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Store className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.atacado}
                </p>
                <p className="text-xs text-muted-foreground">Atacado</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <ShoppingCart className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.varejo}
                </p>
                <p className="text-xs text-muted-foreground">Varejo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.withCompany}
                </p>
                <p className="text-xs text-muted-foreground">Com Empresa</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome ou CNPJ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCustomers.map((customer) => (
                <Card key={customer.id} className="hover-elevate">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge
                            variant={
                              customer.approved ? "default" : "secondary"
                            }
                            className={
                              customer.approved
                                ? "bg-green-500"
                                : "bg-yellow-500"
                            }
                          >
                            {customer.approved ? "Ativo" : "Pendente"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              customer.customerType === "atacado"
                                ? "border-purple-500 text-purple-600"
                                : "border-orange-500 text-orange-600"
                            }
                          >
                            {customer.customerType === "atacado"
                              ? "Atacado"
                              : "Varejo"}
                          </Badge>
                          {(customer.razaoSocial || customer.company) && (
                            <span className="text-sm font-semibold truncate">
                              {customer.razaoSocial || customer.company}
                            </span>
                          )}
                        </div>
                        <p className="font-medium">
                          {customer.nome || customer.firstName}{" "}
                          {customer.lastName}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {customer.email}
                          </span>
                          <span className="text-xs">
                            Cadastro: {formatDate(customer.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleCustomerType(customer)}
                          disabled={updateUserMutation.isPending}
                          className={
                            customer.customerType === "atacado"
                              ? "border-orange-500 text-orange-600"
                              : "border-purple-500 text-purple-600"
                          }
                        >
                          {customer.customerType === "atacado"
                            ? "Mudar p/ Varejo"
                            : "Mudar p/ Atacado"}
                        </Button>
                        {!customer.approved && (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(customer)}
                          >
                            Aprovar
                          </Button>
                        )}
                        {customer.approved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(customer)}
                          >
                            Bloquear
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(customer)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCustomerToDelete(customer)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="w-full lg:w-80">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Carteira de Clientes</CardTitle>
              <p className="text-xs text-muted-foreground">Dezembro de 2025</p>
            </CardHeader>
            <CardContent>
              <div className="relative w-48 h-48 mx-auto">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    className="text-muted/30"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeDasharray={`${stats.approvedPercent * 2.51} 251`}
                    className="text-green-500"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeDasharray={`${stats.pendingPercent * 2.51} 251`}
                    strokeDashoffset={`-${stats.approvedPercent * 2.51}`}
                    className="text-yellow-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{stats.total}</span>
                  <span className="text-xs text-muted-foreground">
                    Clientes
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>Ativos</span>
                  </div>
                  <span className="font-medium">{stats.approved}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span>Pendentes</span>
                  </div>
                  <span className="font-medium">{stats.pending}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
            <DialogDescription className="sr-only">
              Preencha os dados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Pessoa</Label>
              <Select
                value={newCustomer.personType}
                onValueChange={(v) =>
                  setNewCustomer((p) => ({ ...p, personType: v }))
                }
              >
                <SelectTrigger data-testid="select-person-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                  <SelectItem value="fisica">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newCustomer.personType === "juridica" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>CNPJ</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newCustomer.cnpj}
                      onChange={(e) =>
                        setNewCustomer((p) => ({ ...p, cnpj: e.target.value }))
                      }
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                    <Button
                      type="button"
                      onClick={() => fetchCNPJData(newCustomer.cnpj)}
                      disabled={formLoading || newCustomer.cnpj.length < 14}
                      className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                    >
                      {formLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" /> Importar
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    * Busca automática na Receita Federal
                  </p>
                </div>
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input
                    value={newCustomer.stateRegistration}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        stateRegistration: e.target.value,
                      }))
                    }
                    placeholder="Inscrição Estadual"
                  />
                </div>
                <div>
                  <Label>Regime Tributário</Label>
                  <Select
                    value={newCustomer.taxRegime}
                    onValueChange={(v) =>
                      setNewCustomer((p) => ({ ...p, taxRegime: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Simples Nacional</SelectItem>
                      <SelectItem value="2">Lucro Presumido</SelectItem>
                      <SelectItem value="3">Lucro Real</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Razão Social</Label>
                  <Input
                    value={newCustomer.company}
                    onChange={(e) =>
                      setNewCustomer((p) => ({ ...p, company: e.target.value }))
                    }
                    className="bg-muted/30"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Nome Fantasia</Label>
                  <Input
                    value={newCustomer.tradingName}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        tradingName: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CPF</Label>
                  <Input
                    value={newCustomer.cpf}
                    onChange={(e) =>
                      setNewCustomer((p) => ({ ...p, cpf: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Nome Completo</Label>
                  <Input
                    value={newCustomer.firstName}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        firstName: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Endereço</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>CEP</Label>
                  <Input
                    value={newCustomer.cep}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNewCustomer((p) => ({ ...p, cep: v }));
                      if (v.replace(/\D/g, "").length === 8) fetchCEPData(v);
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Logradouro</Label>
                  <Input
                    value={newCustomer.address}
                    onChange={(e) =>
                      setNewCustomer((p) => ({ ...p, address: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input
                    value={newCustomer.addressNumber}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        addressNumber: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label>Complemento</Label>
                  <Input
                    value={newCustomer.complement}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        complement: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input
                    value={newCustomer.neighborhood}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        neighborhood: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input
                    value={newCustomer.city}
                    onChange={(e) =>
                      setNewCustomer((p) => ({ ...p, city: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input
                    value={newCustomer.state}
                    onChange={(e) =>
                      setNewCustomer((p) => ({ ...p, state: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => createCustomerMutation.mutate(newCustomer)}
                disabled={createCustomerMutation.isPending || formLoading}
              >
                {createCustomerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}{" "}
                Cadastrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription className="sr-only">
              Edite os dados.
            </DialogDescription>
          </DialogHeader>
          {editingCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Razão Social / Empresa</Label>
                  <Input
                    value={
                      editingCustomer.company ||
                      editingCustomer.razaoSocial ||
                      ""
                    }
                    onChange={(e) =>
                      setEditingCustomer({
                        ...editingCustomer,
                        company: e.target.value,
                        razaoSocial: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={
                      editingCustomer.firstName || editingCustomer.nome || ""
                    }
                    onChange={(e) =>
                      setEditingCustomer({
                        ...editingCustomer,
                        firstName: e.target.value,
                        nome: e.target.value,
                      })
                    }
                  />
                </div>

                {/* Botão de Importar na Edição */}
                <div className="col-span-2 sm:col-span-1">
                  <Label>CNPJ</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editingCustomer.cnpj || ""}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          cnpj: e.target.value,
                        })
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={() =>
                        fetchCNPJDataEdit(editingCustomer.cnpj || "")
                      }
                      disabled={
                        formLoading || (editingCustomer.cnpj?.length || 0) < 14
                      }
                      title="Atualizar dados na Receita"
                    >
                      {formLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Regime Tributário</Label>
                  <Select
                    value={
                      editingCustomer.taxRegime ||
                      editingCustomer.regimeTributario ||
                      "1"
                    }
                    onValueChange={(v) =>
                      setEditingCustomer({
                        ...editingCustomer,
                        taxRegime: v,
                        regimeTributario: v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Simples Nacional</SelectItem>
                      <SelectItem value="2">Lucro Presumido</SelectItem>
                      <SelectItem value="3">Lucro Real</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input
                    value={
                      editingCustomer.stateRegistration ||
                      editingCustomer.inscricaoEstadual ||
                      ""
                    }
                    onChange={(e) =>
                      setEditingCustomer({
                        ...editingCustomer,
                        stateRegistration: e.target.value,
                        inscricaoEstadual: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editingCustomer.email || ""}
                    onChange={(e) =>
                      setEditingCustomer({
                        ...editingCustomer,
                        email: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={
                      editingCustomer.phone || editingCustomer.telefone || ""
                    }
                    onChange={(e) =>
                      setEditingCustomer({
                        ...editingCustomer,
                        phone: e.target.value,
                        telefone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Endereço</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>CEP</Label>
                    <Input
                      value={editingCustomer.cep || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditingCustomer({ ...editingCustomer, cep: v });
                        if (v.replace(/\D/g, "").length === 8)
                          fetchCEPDataEdit(v);
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Logradouro</Label>
                    <Input
                      value={
                        editingCustomer.address ||
                        editingCustomer.endereco ||
                        ""
                      }
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          address: e.target.value,
                          endereco: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Número</Label>
                    <Input
                      value={
                        editingCustomer.addressNumber ||
                        editingCustomer.numero ||
                        ""
                      }
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          addressNumber: e.target.value,
                          numero: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Complemento</Label>
                    <Input
                      value={
                        editingCustomer.complement ||
                        editingCustomer.complemento ||
                        ""
                      }
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          complement: e.target.value,
                          complemento: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input
                      value={
                        editingCustomer.neighborhood ||
                        editingCustomer.bairro ||
                        ""
                      }
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          neighborhood: e.target.value,
                          bairro: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input
                      value={
                        editingCustomer.city || editingCustomer.cidade || ""
                      }
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          city: e.target.value,
                          cidade: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Input
                      value={
                        editingCustomer.state || editingCustomer.estado || ""
                      }
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          state: e.target.value,
                          estado: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingCustomer(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}{" "}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!customerToDelete}
        onOpenChange={(open) => !open && setCustomerToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <DialogDescription className="sr-only">Confirme.</DialogDescription>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente{" "}
              <strong>
                {customerToDelete?.firstName ||
                  customerToDelete?.company ||
                  customerToDelete?.email}
              </strong>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                customerToDelete &&
                deleteUserMutation.mutate(customerToDelete.id)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}{" "}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
