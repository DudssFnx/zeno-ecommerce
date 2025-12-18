import { useState, useEffect } from "react";
import { UserCard, type UserData, type UserRole, type CustomerType } from "@/components/UserCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, RefreshCw, Loader2, Plus, Settings, Shield, Tag, Instagram, StickyNote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User, Module } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

type UserStatus = "pending" | "approved" | "rejected";

export default function UsersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isExtrasOpen, setIsExtrasOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [extrasTag, setExtrasTag] = useState("");
  const [extrasInstagram, setExtrasInstagram] = useState("");
  const [extrasNotes, setExtrasNotes] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("customer");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  const { data: usersData = [], isLoading, refetch } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: modulesData = [], isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ['/api/modules'],
  });

  const { data: brandsData = [] } = useQuery<string[]>({
    queryKey: ['/api/admin/all-brands'],
  });

  const { data: userPermissions } = useQuery<{ userId: string; modules: string[] }>({
    queryKey: ['/api/users', selectedUser?.id, 'permissions'],
    queryFn: async () => {
      if (!selectedUser?.id) return { userId: '', modules: [] };
      const res = await fetch(`/api/users/${selectedUser.id}/permissions`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch permissions');
      return res.json();
    },
    enabled: !!selectedUser?.id && isPermissionsOpen,
  });

  useEffect(() => {
    if (userPermissions?.modules) {
      setSelectedModules(userPermissions.modules);
    }
  }, [userPermissions]);


  const getDefaultModulesForRole = (role: UserRole): string[] => {
    const roleDefaults: Record<string, string[]> = {
      admin: modulesData.map(m => m.key),
      sales: modulesData.filter(m => m.defaultRoles?.includes('sales')).map(m => m.key),
      customer: modulesData.filter(m => m.defaultRoles?.includes('customer')).map(m => m.key),
    };
    return roleDefaults[role] || [];
  };

  useEffect(() => {
    if (isCreateOpen && modulesData.length > 0) {
      setSelectedModules(getDefaultModulesForRole(newUserRole));
    }
  }, [newUserRole, isCreateOpen, modulesData]);

  const createUserMutation = useMutation({
    mutationFn: async (data: { firstName: string; email: string; password: string; role: string; allowedBrands?: string[] }) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: async (newUser) => {
      if (selectedModules.length > 0 && newUser?.id) {
        await apiRequest("POST", `/api/users/${newUser.id}/permissions`, { modules: selectedModules });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsCreateOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("customer");
      setSelectedModules([]);
      setSelectedBrands([]);
      toast({ title: "Sucesso", description: "Usuario criado com sucesso" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message || "Falha ao criar usuario", variant: "destructive" });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, modules }: { userId: string; modules: string[] }) => {
      await apiRequest("POST", `/api/users/${userId}/permissions`, { modules });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', selectedUser?.id, 'permissions'] });
      toast({ title: "Sucesso", description: "Permissoes atualizadas com sucesso" });
      setIsPermissionsOpen(false);
      setSelectedUser(null);
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message || "Falha ao atualizar permissoes", variant: "destructive" });
    },
  });

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleCreateUser = () => {
    if (!newUserName || !newUserEmail || !newUserPassword) {
      toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (!isValidEmail(newUserEmail)) {
      toast({ title: "Erro", description: "Digite um email valido (ex: usuario@empresa.com)", variant: "destructive" });
      return;
    }
    createUserMutation.mutate({
      firstName: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      role: newUserRole,
      allowedBrands: newUserRole === "supplier" ? selectedBrands : undefined,
    });
  };

  const handleSavePermissions = () => {
    if (selectedUser) {
      updatePermissionsMutation.mutate({ userId: selectedUser.id, modules: selectedModules });
    }
  };

  const handleOpenPermissions = (user: UserData) => {
    setSelectedUser(user);
    setSelectedModules([]);
    setIsPermissionsOpen(true);
  };

  const toggleModule = (moduleKey: string) => {
    setSelectedModules(prev => 
      prev.includes(moduleKey) 
        ? prev.filter(k => k !== moduleKey)
        : [...prev, moduleKey]
    );
  };

  const users: UserData[] = usersData.map((u) => ({
    id: u.id,
    name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "Unknown",
    email: u.email || "",
    company: u.company || undefined,
    role: u.role as UserRole,
    customerType: (u.customerType || "varejo") as CustomerType,
    status: u.approved ? "approved" : "pending" as UserStatus,
    tag: u.tag || undefined,
    instagram: u.instagram || undefined,
    notes: u.notes || undefined,
  }));

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.company?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "pending") return matchesSearch && user.status === "pending";
    if (activeTab === "customers") return matchesSearch && user.role === "customer";
    if (activeTab === "staff") return matchesSearch && (user.role === "admin" || user.role === "sales");
    return matchesSearch;
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<User> }) => {
      await apiRequest("PATCH", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
  });

  const handleApprove = (user: UserData) => {
    updateUserMutation.mutate(
      { id: user.id, data: { approved: true } },
      {
        onSuccess: () => {
          toast({ title: "Usuario Aprovado", description: `${user.name} foi aprovado.` });
        },
        onError: () => {
          toast({ title: "Erro", description: "Falha ao aprovar usuario", variant: "destructive" });
        },
      }
    );
  };

  const handleReject = (user: UserData) => {
    updateUserMutation.mutate(
      { id: user.id, data: { approved: false } },
      {
        onSuccess: () => {
          toast({ title: "Usuario Rejeitado", description: `${user.name} foi rejeitado.` });
        },
        onError: () => {
          toast({ title: "Erro", description: "Falha ao rejeitar usuario", variant: "destructive" });
        },
      }
    );
  };

  const handleChangeRole = (user: UserData, role: UserRole) => {
    updateUserMutation.mutate(
      { id: user.id, data: { role } },
      {
        onSuccess: () => {
          toast({ title: "Funcao Atualizada", description: `${user.name} agora e ${role}.` });
        },
        onError: () => {
          toast({ title: "Erro", description: "Falha ao atualizar funcao", variant: "destructive" });
        },
      }
    );
  };

  const handleChangeCustomerType = (user: UserData, customerType: CustomerType) => {
    updateUserMutation.mutate(
      { id: user.id, data: { customerType } },
      {
        onSuccess: () => {
          toast({ title: "Tipo Atualizado", description: `${user.name} agora e ${customerType === "atacado" ? "Atacado" : "Varejo"}.` });
        },
        onError: () => {
          toast({ title: "Erro", description: "Falha ao atualizar tipo de cliente", variant: "destructive" });
        },
      }
    );
  };

  const handleOpenExtras = (user: UserData) => {
    setSelectedUser(user);
    setExtrasTag(user.tag || "");
    setExtrasInstagram(user.instagram || "");
    setExtrasNotes(user.notes || "");
    setIsExtrasOpen(true);
  };

  const handleSaveExtras = () => {
    if (selectedUser) {
      updateUserMutation.mutate(
        { 
          id: selectedUser.id, 
          data: { 
            tag: extrasTag || null, 
            instagram: extrasInstagram || null, 
            notes: extrasNotes || null 
          } 
        },
        {
          onSuccess: () => {
            toast({ title: "Extras Salvos", description: "Informacoes extras atualizadas com sucesso." });
            setIsExtrasOpen(false);
            setSelectedUser(null);
          },
          onError: () => {
            toast({ title: "Erro", description: "Falha ao salvar extras", variant: "destructive" });
          },
        }
      );
    }
  };

  const pendingCount = users.filter((u) => u.status === "pending").length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Gerenciamento de Usuarios</h1>
          <p className="text-muted-foreground mt-1">Gerencie contas de clientes e membros da equipe</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user">
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Usuario</DialogTitle>
                <DialogDescription>
                  Preencha os dados e selecione os modulos que o usuario pode acessar
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Nome do usuario"
                      data-testid="input-create-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      data-testid="input-create-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Senha de acesso"
                      data-testid="input-create-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Funcao</Label>
                    <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as UserRole)}>
                      <SelectTrigger data-testid="select-create-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Cliente</SelectItem>
                        <SelectItem value="sales">Vendedor</SelectItem>
                        <SelectItem value="supplier">Fornecedor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newUserRole === "supplier" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <Label className="text-base font-medium">Marcas Permitidas</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Selecione quais marcas este fornecedor pode visualizar
                    </p>
                    {brandsData.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">Nenhuma marca cadastrada.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                        {brandsData.map((brand) => (
                          <div
                            key={brand}
                            className="flex items-center space-x-2 p-2 rounded-lg border bg-muted/30 hover-elevate cursor-pointer"
                            onClick={() => {
                              setSelectedBrands(prev => 
                                prev.includes(brand) 
                                  ? prev.filter(b => b !== brand) 
                                  : [...prev, brand]
                              );
                            }}
                            data-testid={`checkbox-brand-${brand}`}
                          >
                            <Checkbox
                              checked={selectedBrands.includes(brand)}
                              onCheckedChange={() => {
                                setSelectedBrands(prev => 
                                  prev.includes(brand) 
                                    ? prev.filter(b => b !== brand) 
                                    : [...prev, brand]
                                );
                              }}
                            />
                            <span className="text-sm">{brand}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <Label className="text-base font-medium">Permissoes de Modulos</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selecione quais areas do sistema este usuario pode acessar
                  </p>
                  
                  {modulesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {modulesData.map((module) => (
                        <div
                          key={module.key}
                          className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30 hover-elevate cursor-pointer"
                          onClick={() => toggleModule(module.key)}
                          data-testid={`checkbox-module-${module.key}`}
                        >
                          <Checkbox
                            checked={selectedModules.includes(module.key)}
                            onCheckedChange={() => toggleModule(module.key)}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{module.label}</p>
                            <p className="text-xs text-muted-foreground">{module.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleCreateUser}
                  disabled={createUserMutation.isPending}
                  data-testid="button-submit-create-user"
                >
                  {createUserMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Usuario"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-users">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar usuarios..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-users"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-users">Todos ({users.length})</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending-users">
            Pendentes ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">
            Clientes ({users.filter(u => u.role === "customer").length})
          </TabsTrigger>
          <TabsTrigger value="staff" data-testid="tab-staff">
            Equipe ({users.filter(u => u.role === "admin" || u.role === "sales").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhum usuario encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map((user) => (
                <div key={user.id} className="relative">
                  <UserCard
                    user={user}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onChangeRole={handleChangeRole}
                    onChangeCustomerType={handleChangeCustomerType}
                    onEditExtras={handleOpenExtras}
                  />
                  {user.role !== "admin" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2 gap-1"
                      onClick={() => handleOpenPermissions(user)}
                      data-testid={`button-permissions-${user.id}`}
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Permissoes
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissoes de {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Configure quais modulos este usuario pode acessar no sistema
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2">
              {modulesData.map((module) => (
                <div
                  key={module.key}
                  className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30 hover-elevate cursor-pointer"
                  onClick={() => toggleModule(module.key)}
                >
                  <Checkbox
                    checked={selectedModules.includes(module.key)}
                    onCheckedChange={() => toggleModule(module.key)}
                    data-testid={`checkbox-edit-module-${module.key}`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{module.label}</p>
                    <p className="text-xs text-muted-foreground">{module.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsPermissionsOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSavePermissions}
              disabled={updatePermissionsMutation.isPending}
              data-testid="button-save-permissions"
            >
              {updatePermissionsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Permissoes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isExtrasOpen} onOpenChange={setIsExtrasOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Extras de {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Adicione informacoes extras como tag, Instagram e notas
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="extras-tag" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tag
              </Label>
              <Input
                id="extras-tag"
                value={extrasTag}
                onChange={(e) => setExtrasTag(e.target.value)}
                placeholder="Ex: VIP, Parceiro, Novo"
                data-testid="input-extras-tag"
              />
              <p className="text-xs text-muted-foreground">
                Uma etiqueta para identificar o cliente rapidamente
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="extras-instagram" className="flex items-center gap-2">
                <Instagram className="h-4 w-4" />
                Instagram
              </Label>
              <Input
                id="extras-instagram"
                value={extrasInstagram}
                onChange={(e) => setExtrasInstagram(e.target.value)}
                placeholder="@usuario"
                data-testid="input-extras-instagram"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="extras-notes" className="flex items-center gap-2">
                <StickyNote className="h-4 w-4" />
                Notas
              </Label>
              <Textarea
                id="extras-notes"
                value={extrasNotes}
                onChange={(e) => setExtrasNotes(e.target.value)}
                placeholder="Observacoes sobre o cliente..."
                rows={4}
                data-testid="input-extras-notes"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsExtrasOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveExtras}
              disabled={updateUserMutation.isPending}
              data-testid="button-save-extras"
            >
              {updateUserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Extras"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
