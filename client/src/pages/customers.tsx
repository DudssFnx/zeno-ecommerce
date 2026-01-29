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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { useMemo, useState } from "react";

// ✅ 1. HELPERS DE MÁSCARA (FORMATO BRASILEIRO)
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

export default function CustomersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerType | null>(
    null,
  );
  const [formLoading, setFormLoading] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerType | null>(
    null,
  );

  const [newCustomer, setNewCustomer] = useState({
    personType: "juridica",
    cnpj: "",
    cpf: "",
    company: "",
    tradingName: "",
    firstName: "",
    email: "",
    phone: "",
    password: "",
    cep: "",
    address: "",
    addressNumber: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const {
    data: usersData = [],
    isLoading,
    refetch,
  } = useQuery<CustomerType[]>({
    queryKey: ["/api/users"],
  });

  const customers = useMemo(
    () => usersData.filter((u) => u.role === "customer"),
    [usersData],
  );

  // ✅ 2. MUTAÇÃO DE EXCLUSÃO (ATIVA O BOTÃO DE LIXEIRA)
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Excluído",
        description: "Cliente removido com sucesso.",
      });
      setCustomerToDelete(null);
    },
    onError: () =>
      toast({
        title: "Erro",
        description: "Falha ao excluir",
        variant: "destructive",
      }),
  });

  // ✅ 3. MUTAÇÃO DE CADASTRO (SINCRONIZADO COM BACKEND)
  const createCustomerMutation = useMutation({
    mutationFn: async (data: typeof newCustomer) => {
      const res = await apiRequest("POST", "/api/register", {
        ...data,
        username: data.email,
        role: "customer",
        firstName: data.firstName || data.tradingName || data.company,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: "Sucesso!",
        description: "Cliente cadastrado e visível na lista.",
      });
    },
    onError: (err: any) =>
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      }),
  });

  const resetForm = () => {
    setNewCustomer({
      personType: "juridica",
      cnpj: "",
      cpf: "",
      company: "",
      tradingName: "",
      firstName: "",
      email: "",
      phone: "",
      password: "",
      cep: "",
      address: "",
      addressNumber: "",
      neighborhood: "",
      city: "",
      state: "",
    });
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
      setNewCustomer((prev) => ({
        ...prev,
        company: data.razao_social,
        tradingName: data.nome_fantasia || data.razao_social,
        firstName: data.nome_fantasia || data.razao_social,
        cep: masks.cep(data.cep || ""),
        address: data.logradouro,
        addressNumber: data.numero,
        neighborhood: data.bairro,
        city: data.municipio,
        state: data.uf,
      }));
      toast({
        title: "Dados Importados",
        description: "Campos preenchidos via Receita Federal.",
      });
    } catch (e) {
      toast({
        title: "Erro",
        description: "CNPJ não encontrado",
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
        setNewCustomer((p) => ({
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
    const total = customers.length;
    const approved = customers.filter((c) => c.approved).length;
    const pending = customers.filter((c) => !c.approved).length;
    return {
      total,
      approved,
      pending,
      approvedPercent: total > 0 ? Math.round((approved / total) * 100) : 0,
      pendingPercent: total > 0 ? Math.round((pending / total) * 100) : 0,
    };
  }, [customers]);

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
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Cadastrar Cliente
          </Button>
        </div>
      </div>

      {/* Cards de Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Users className="text-primary h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total de Clientes</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-green-500/10 rounded-full">
            <UserCheck className="text-green-600 h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {stats.approved}
            </p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-yellow-500/10 rounded-full">
            <UserX className="text-yellow-600 h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-600">
              {stats.pending}
            </p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
        </Card>
      </div>

      {/* Lista de Clientes */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome ou CNPJ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/20">
            Nenhum cliente cadastrado.
          </div>
        ) : (
          <div className="grid gap-2">
            {customers.map((customer) => (
              <Card
                key={customer.id}
                className="hover:bg-muted/10 transition-colors"
              >
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <div className="flex gap-2 mb-1 items-center">
                      <Badge
                        className={
                          customer.approved ? "bg-green-500" : "bg-yellow-500"
                        }
                      >
                        {customer.approved ? "Ativo" : "Pendente"}
                      </Badge>
                      <span className="font-bold">
                        {customer.razaoSocial || customer.firstName}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground flex gap-3">
                      <Mail className="h-3 w-3 mt-1" /> {customer.email} |{" "}
                      {customer.cnpj || customer.cpf}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setCustomerToDelete(customer)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Cadastro com Máscaras */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>CNPJ / CPF</Label>
                <div className="flex gap-2">
                  <Input
                    value={
                      newCustomer.personType === "juridica"
                        ? newCustomer.cnpj
                        : newCustomer.cpf
                    }
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        cnpj:
                          newCustomer.personType === "juridica"
                            ? masks.cnpj(e.target.value)
                            : "",
                        cpf:
                          newCustomer.personType === "fisica"
                            ? masks.cpf(e.target.value)
                            : "",
                      })
                    }
                    placeholder="Somente números"
                  />
                  {newCustomer.personType === "juridica" && (
                    <Button
                      type="button"
                      onClick={() => fetchCNPJData(newCustomer.cnpj)}
                      disabled={formLoading}
                    >
                      {formLoading ? (
                        <Loader2 className="animate-spin h-4 w-4" />
                      ) : (
                        "Importar"
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <Label>Razão Social / Nome</Label>
                <Input
                  value={newCustomer.company}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      company: e.target.value,
                      firstName: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      phone: masks.phone(e.target.value),
                    })
                  }
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label>CEP</Label>
                <Input
                  value={newCustomer.cep}
                  onChange={(e) => {
                    const v = masks.cep(e.target.value);
                    setNewCustomer({ ...newCustomer, cep: v });
                    if (v.length === 9) fetchCEPData(v);
                  }}
                  placeholder="00000-000"
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input
                  value={newCustomer.city}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, city: e.target.value })
                  }
                />
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
                disabled={createCustomerMutation.isPending}
              >
                {createCustomerMutation.isPending && (
                  <Loader2 className="mr-2 animate-spin h-4 w-4" />
                )}{" "}
                Salvar Cliente
              </Button>
            </div>
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
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o cliente{" "}
              <strong>
                {customerToDelete?.razaoSocial || customerToDelete?.firstName}
              </strong>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() =>
                customerToDelete &&
                deleteUserMutation.mutate(customerToDelete.id)
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
