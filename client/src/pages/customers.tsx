import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  RefreshCw, 
  Loader2, 
  Users, 
  UserCheck, 
  UserX, 
  Building2,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export default function CustomersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    personType: "juridica",
    cnpj: "", cpf: "", company: "", tradingName: "", firstName: "", email: "", phone: "",
    stateRegistration: "", cep: "", address: "", addressNumber: "", complement: "",
    neighborhood: "", city: "", state: "",
  });

  const { data: usersData = [], isLoading, refetch } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const customers = useMemo(() => {
    return usersData.filter(u => u.role === "customer");
  }, [usersData]);

  const stats = useMemo(() => {
    const total = customers.length;
    const approved = customers.filter(c => c.approved).length;
    const pending = customers.filter(c => !c.approved).length;
    const withCompany = customers.filter(c => c.company).length;
    
    return {
      total,
      approved,
      pending,
      withCompany,
      approvedPercent: total > 0 ? Math.round((approved / total) * 100) : 0,
      pendingPercent: total > 0 ? Math.round((pending / total) * 100) : 0,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.email?.toLowerCase().includes(query) ||
      c.firstName?.toLowerCase().includes(query) ||
      c.lastName?.toLowerCase().includes(query) ||
      c.company?.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      await apiRequest("PATCH", `/api/users/${id}`, { approved });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
  });

  const handleApprove = (user: User) => {
    updateUserMutation.mutate(
      { id: user.id, approved: true },
      {
        onSuccess: () => {
          toast({ title: "Cliente Aprovado", description: `${user.email} foi aprovado.` });
        },
        onError: () => {
          toast({ title: "Erro", description: "Falha ao aprovar cliente", variant: "destructive" });
        },
      }
    );
  };

  const handleReject = (user: User) => {
    updateUserMutation.mutate(
      { id: user.id, approved: false },
      {
        onSuccess: () => {
          toast({ title: "Cliente Bloqueado", description: `${user.email} foi bloqueado.` });
        },
        onError: () => {
          toast({ title: "Erro", description: "Falha ao bloquear cliente", variant: "destructive" });
        },
      }
    );
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  };

  const fetchCNPJData = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;
    setFormLoading(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (response.ok) {
        const data = await response.json();
        setNewCustomer(prev => ({
          ...prev,
          company: data.razao_social || "",
          tradingName: data.nome_fantasia || "",
          firstName: data.nome_fantasia || data.razao_social || "",
          phone: data.ddd_telefone_1 || "",
          cep: data.cep?.replace(/\D/g, '') || "",
          address: data.logradouro || "",
          addressNumber: data.numero || "",
          complement: data.complemento || "",
          neighborhood: data.bairro || "",
          city: data.municipio || "",
          state: data.uf || "",
        }));
        toast({ title: "Dados carregados", description: "Dados da empresa preenchidos automaticamente" });
      }
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao buscar dados do CNPJ", variant: "destructive" });
    }
    setFormLoading(false);
  };

  const fetchCEPData = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (response.ok) {
        const data = await response.json();
        if (!data.erro) {
          setNewCustomer(prev => ({
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

  const createCustomerMutation = useMutation({
    mutationFn: async (data: typeof newCustomer) => {
      await apiRequest("POST", "/api/register", {
        ...data,
        firstName: data.firstName || data.tradingName || data.company,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowCreateDialog(false);
      setNewCustomer({ personType: "juridica", cnpj: "", cpf: "", company: "", tradingName: "", firstName: "", email: "", phone: "", stateRegistration: "", cep: "", address: "", addressNumber: "", complement: "", neighborhood: "", city: "", state: "" });
      toast({ title: "Sucesso", description: "Cliente cadastrado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao cadastrar cliente", variant: "destructive" });
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
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-customers">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-customer">
            Cadastrar Cliente
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-total-customers">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total de Clientes</p>
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
                <p className="text-2xl font-bold text-green-600" data-testid="stat-approved-customers">{stats.approved}</p>
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
                <p className="text-2xl font-bold text-yellow-600" data-testid="stat-pending-customers">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Aguardando Aprovação</p>
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
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-companies">{stats.withCompany}</p>
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
                data-testid="input-search-customers"
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
                <Card key={customer.id} className="hover-elevate" data-testid={`card-customer-${customer.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant={customer.approved ? "default" : "secondary"}
                            className={customer.approved ? "bg-green-500" : "bg-yellow-500"}
                          >
                            {customer.approved ? "Ativo" : "Pendente"}
                          </Badge>
                          {customer.company && (
                            <span className="text-sm font-semibold truncate">
                              {customer.company}
                            </span>
                          )}
                        </div>
                        <p className="font-medium">
                          {customer.firstName} {customer.lastName}
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
                        {!customer.approved && (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(customer)}
                            disabled={updateUserMutation.isPending}
                            data-testid={`button-approve-${customer.id}`}
                          >
                            Aprovar
                          </Button>
                        )}
                        {customer.approved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(customer)}
                            disabled={updateUserMutation.isPending}
                            data-testid={`button-reject-${customer.id}`}
                          >
                            Bloquear
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" data-testid={`button-edit-${customer.id}`}>
                          <Pencil className="h-4 w-4" />
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
                  <span className="text-xs text-muted-foreground">Clientes</span>
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
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Pessoa</Label>
              <Select value={newCustomer.personType} onValueChange={(v) => setNewCustomer(p => ({ ...p, personType: v }))}>
                <SelectTrigger data-testid="select-person-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="juridica">Pessoa Juridica</SelectItem>
                  <SelectItem value="fisica">Pessoa Fisica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newCustomer.personType === "juridica" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CNPJ</Label>
                  <Input
                    value={newCustomer.cnpj}
                    onChange={(e) => setNewCustomer(p => ({ ...p, cnpj: e.target.value }))}
                    onBlur={() => fetchCNPJData(newCustomer.cnpj)}
                    placeholder="00.000.000/0000-00"
                    data-testid="input-cnpj"
                  />
                </div>
                <div>
                  <Label>Inscricao Estadual</Label>
                  <Input
                    value={newCustomer.stateRegistration}
                    onChange={(e) => setNewCustomer(p => ({ ...p, stateRegistration: e.target.value }))}
                    placeholder="Inscricao Estadual"
                    data-testid="input-state-registration"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Razao Social</Label>
                  <Input
                    value={newCustomer.company}
                    onChange={(e) => setNewCustomer(p => ({ ...p, company: e.target.value }))}
                    placeholder="Razao Social"
                    data-testid="input-company"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Nome Fantasia</Label>
                  <Input
                    value={newCustomer.tradingName}
                    onChange={(e) => setNewCustomer(p => ({ ...p, tradingName: e.target.value }))}
                    placeholder="Nome Fantasia"
                    data-testid="input-trading-name"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CPF</Label>
                  <Input
                    value={newCustomer.cpf}
                    onChange={(e) => setNewCustomer(p => ({ ...p, cpf: e.target.value }))}
                    placeholder="000.000.000-00"
                    data-testid="input-cpf"
                  />
                </div>
                <div>
                  <Label>Nome Completo</Label>
                  <Input
                    value={newCustomer.firstName}
                    onChange={(e) => setNewCustomer(p => ({ ...p, firstName: e.target.value }))}
                    placeholder="Nome Completo"
                    data-testid="input-first-name"
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
                  onChange={(e) => setNewCustomer(p => ({ ...p, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  data-testid="input-email"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  data-testid="input-phone"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Endereco</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>CEP</Label>
                  <Input
                    value={newCustomer.cep}
                    onChange={(e) => setNewCustomer(p => ({ ...p, cep: e.target.value }))}
                    onBlur={() => fetchCEPData(newCustomer.cep)}
                    placeholder="00000-000"
                    data-testid="input-cep"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Logradouro</Label>
                  <Input
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer(p => ({ ...p, address: e.target.value }))}
                    placeholder="Rua, Avenida..."
                    data-testid="input-address"
                  />
                </div>
                <div>
                  <Label>Numero</Label>
                  <Input
                    value={newCustomer.addressNumber}
                    onChange={(e) => setNewCustomer(p => ({ ...p, addressNumber: e.target.value }))}
                    placeholder="Numero"
                    data-testid="input-address-number"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Complemento</Label>
                  <Input
                    value={newCustomer.complement}
                    onChange={(e) => setNewCustomer(p => ({ ...p, complement: e.target.value }))}
                    placeholder="Apto, Sala..."
                    data-testid="input-complement"
                  />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input
                    value={newCustomer.neighborhood}
                    onChange={(e) => setNewCustomer(p => ({ ...p, neighborhood: e.target.value }))}
                    placeholder="Bairro"
                    data-testid="input-neighborhood"
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input
                    value={newCustomer.city}
                    onChange={(e) => setNewCustomer(p => ({ ...p, city: e.target.value }))}
                    placeholder="Cidade"
                    data-testid="input-city"
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input
                    value={newCustomer.state}
                    onChange={(e) => setNewCustomer(p => ({ ...p, state: e.target.value }))}
                    placeholder="UF"
                    data-testid="input-state"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-customer">
                Cancelar
              </Button>
              <Button 
                onClick={() => createCustomerMutation.mutate(newCustomer)}
                disabled={createCustomerMutation.isPending || formLoading}
                data-testid="button-save-customer"
              >
                {createCustomerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Cadastrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
