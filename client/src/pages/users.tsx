import {
  UserCard,
  type CustomerType,
  type UserData,
  type UserRole,
} from "@/components/UserCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Tag,
} from "lucide-react";
import { useEffect, useState } from "react";

type UserStatus = "pending" | "approved" | "rejected";

const SYSTEM_MODULES = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Visão geral e gráficos",
  },
  {
    key: "users",
    label: "Usuários",
    description: "Gerenciar equipe e clientes",
  },
  { key: "products", label: "Produtos", description: "Catálogo e estoque" },
  { key: "orders", label: "Pedidos", description: "Vendas e orçamentos" },
  {
    key: "settings",
    label: "Configurações",
    description: "Dados da empresa e sistema",
  },
];

export default function UsersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isExtrasOpen, setIsExtrasOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false); // NOVO MODAL

  // Estados de Seleção e Edição
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  // Create Form
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("customer");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  // Extras Form
  const [extrasTag, setExtrasTag] = useState("");
  const [extrasInstagram, setExtrasInstagram] = useState("");
  const [extrasNotes, setExtrasNotes] = useState("");

  // Edit Profile Form (NOVO)
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState(""); // Opcional

  const {
    data: usersData = [],
    isLoading,
    refetch,
  } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: brandsData = [] } = useQuery<string[]>({
    queryKey: ["/api/admin/all-brands"],
  });

  const { data: userPermissions } = useQuery<{
    userId: string;
    modules: string[];
  }>({
    queryKey: ["/api/users", selectedUser?.id, "permissions"],
    queryFn: async () => {
      if (!selectedUser?.id) return { userId: "", modules: [] };
      const res = await fetch(`/api/users/${selectedUser.id}/permissions`, {
        credentials: "include",
      });
      if (!res.ok) {
        return { userId: selectedUser.id, modules: [] };
      }
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
      admin: SYSTEM_MODULES.map((m) => m.key),
      sales: ["products", "orders", "customers"],
      customer: ["products", "orders"],
    };
    return roleDefaults[role] || [];
  };

  useEffect(() => {
    if (isCreateOpen) {
      setSelectedModules(getDefaultModulesForRole(newUserRole));
    }
  }, [newUserRole, isCreateOpen]);

  const createUserMutation = useMutation({
    mutationFn: async (data: {
      firstName: string;
      email: string;
      password: string;
      role: string;
      allowedBrands?: string[];
    }) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: async (newUser) => {
      if (selectedModules.length > 0 && newUser?.id) {
        try {
          await apiRequest("POST", `/api/users/${newUser.id}/permissions`, {
            modules: selectedModules,
          });
        } catch (e) {
          console.warn(
            "Backend de permissões ainda não configurado completamente",
          );
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
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
      toast({
        title: "Erro",
        description: err.message || "Falha ao criar usuario",
        variant: "destructive",
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({
      userId,
      modules,
    }: {
      userId: string;
      modules: string[];
    }) => {
      await apiRequest("POST", `/api/users/${userId}/permissions`, { modules });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/users", selectedUser?.id, "permissions"],
      });
      toast({
        title: "Sucesso",
        description: "Permissoes atualizadas com sucesso",
      });
      setIsPermissionsOpen(false);
      setSelectedUser(null);
    },
    onError: (err: Error) => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar permissoes",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Usuario Removido",
        description: "Usuario excluido com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao excluir usuario",
        variant: "destructive",
      });
    },
  });

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleCreateUser = () => {
    if (!newUserName || !newUserEmail || !newUserPassword) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }
    if (!isValidEmail(newUserEmail)) {
      toast({
        title: "Erro",
        description: "Digite um email valido",
        variant: "destructive",
      });
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
      updatePermissionsMutation.mutate({
        userId: selectedUser.id,
        modules: selectedModules,
      });
    }
  };

  const handleOpenPermissions = (user: UserData) => {
    setSelectedUser(user);
    const existingModules =
      userPermissions?.userId === user.id ? userPermissions.modules : [];
    setSelectedModules(
      existingModules.length > 0
        ? existingModules
        : getDefaultModulesForRole(user.role),
    );
    setIsPermissionsOpen(true);
  };

  const toggleModule = (moduleKey: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleKey)
        ? prev.filter((k) => k !== moduleKey)
        : [...prev, moduleKey],
    );
  };

  const users: UserData[] = usersData.map((u) => ({
    id: u.id,
    name:
      `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
      u.nome ||
      u.email ||
      "Unknown",
    email: u.email || "",
    phone: u.telefone || "",
    company: u.company || u.razaoSocial || undefined,
    role: u.role as UserRole,
    customerType: (u.customerType || "varejo") as CustomerType,
    status: u.approved ? "approved" : ("pending" as UserStatus),
    tag: u.tag || undefined,
    instagram: u.instagram || undefined,
    notes: u.notes || undefined,
  }));

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.company &&
        user.company.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "pending")
      return matchesSearch && user.status === "pending";
    if (activeTab === "customers")
      return matchesSearch && user.role === "customer";
    if (activeTab === "staff")
      return matchesSearch && (user.role === "admin" || user.role === "sales");
    return matchesSearch;
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<User> & { password?: string };
    }) => {
      await apiRequest("PATCH", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });

  const handleApprove = (user: UserData) => {
    updateUserMutation.mutate(
      { id: user.id, data: { approved: true } },
      {
        onSuccess: () =>
          toast({
            title: "Usuario Aprovado",
            description: `${user.name} foi aprovado.`,
          }),
      },
    );
  };

  const handleReject = (user: UserData) => {
    if (confirm(`Tem certeza que deseja EXCLUIR ${user.name}?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const handleChangeRole = (user: UserData, role: UserRole) => {
    updateUserMutation.mutate(
      { id: user.id, data: { role } },
      {
        onSuccess: () =>
          toast({
            title: "Funcao Atualizada",
            description: `${user.name} agora e ${role}.`,
          }),
      },
    );
  };

  const handleChangeCustomerType = (
    user: UserData,
    customerType: CustomerType,
  ) => {
    updateUserMutation.mutate(
      { id: user.id, data: { customerType } },
      {
        onSuccess: () =>
          toast({
            title: "Tipo Atualizado",
            description: `${user.name} agora e ${customerType}.`,
          }),
      },
    );
  };

  // --- LOGICA DE EXTRAS ---
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
            notes: extrasNotes || null,
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Extras Salvos" });
            setIsExtrasOpen(false);
            setSelectedUser(null);
          },
        },
      );
    }
  };

  // --- LOGICA DE EDICAO DE PERFIL (NOVO) ---
  const handleOpenEditProfile = (user: UserData) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPhone(user.phone || "");
    setEditPassword(""); // Reset da senha (opcional)
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = () => {
    if (!selectedUser) return;

    // Objeto de update
    const updateData: any = {
      nome: editName,
      email: editEmail,
      telefone: editPhone,
    };

    // Só envia senha se foi digitada
    if (editPassword.trim()) {
      updateData.password = editPassword;
    }

    updateUserMutation.mutate(
      { id: selectedUser.id, data: updateData },
      {
        onSuccess: () => {
          toast({
            title: "Perfil Atualizado",
            description: "Dados alterados com sucesso.",
          });
          setIsEditProfileOpen(false);
          setSelectedUser(null);
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Falha ao atualizar perfil.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const pendingCount = users.filter((u) => u.status === "pending").length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* --- Header --- */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Gerenciamento de Usuarios</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie contas de clientes e membros da equipe
          </p>
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
                  Preencha os dados e selecione os modulos que o usuario pode
                  acessar
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Nome do usuario"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail *</Label>
                    <Input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha *</Label>
                    <Input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Senha de acesso"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Funcao</Label>
                    <Select
                      value={newUserRole}
                      onValueChange={(v) => setNewUserRole(v as UserRole)}
                    >
                      <SelectTrigger>
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

                {/* Lista de Módulos no Cadastro */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <Label className="text-base font-medium">
                      Permissoes Iniciais
                    </Label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {SYSTEM_MODULES.map((module) => (
                      <div
                        key={module.key}
                        className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30 hover-elevate cursor-pointer"
                        onClick={() => toggleModule(module.key)}
                      >
                        <Checkbox
                          checked={selectedModules.includes(module.key)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{module.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleCreateUser}
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending
                    ? "Criando..."
                    : "Criar Usuario"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* --- Busca --- */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar usuarios..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* --- Tabs & Lista --- */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Todos ({users.length})</TabsTrigger>
          <TabsTrigger value="pending">Pendentes ({pendingCount})</TabsTrigger>
          <TabsTrigger value="customers">
            Clientes ({users.filter((u) => u.role === "customer").length})
          </TabsTrigger>
          <TabsTrigger value="staff">
            Equipe (
            {
              users.filter((u) => u.role === "admin" || u.role === "sales")
                .length
            }
            )
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
                <div key={user.id} className="relative group">
                  <UserCard
                    user={user}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onChangeRole={handleChangeRole}
                    onChangeCustomerType={handleChangeCustomerType}
                    onEditExtras={handleOpenExtras}
                  />

                  {/* CORREÇÃO VISUAL: Mudamos de 'right-2' para 'right-14' para não cobrir o menu "..." */}
                  <div className="absolute top-2 right-14 flex gap-1">
                    {/* Botão de EDITAR DADOS */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-muted"
                      onClick={() => handleOpenEditProfile(user)}
                      title="Editar Dados"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>

                    {/* Botão de Permissões (Só para Admin/Staff) */}
                    {(user.role === "admin" || user.role === "sales") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 hover:bg-muted"
                        onClick={() => handleOpenPermissions(user)}
                        title="Permissões"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* --- Modal Permissões --- */}
      <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissoes de {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Configure quais modulos este usuario pode acessar
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2">
              {SYSTEM_MODULES.map((module) => (
                <div
                  key={module.key}
                  className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30 hover-elevate cursor-pointer"
                  onClick={() => toggleModule(module.key)}
                >
                  <Checkbox
                    checked={selectedModules.includes(module.key)}
                    className="pointer-events-none"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{module.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {module.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsPermissionsOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSavePermissions}
              disabled={updatePermissionsMutation.isPending}
            >
              {updatePermissionsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Salvar Permissoes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Modal Extras --- */}
      <Dialog open={isExtrasOpen} onOpenChange={setIsExtrasOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Extras de {selectedUser?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tag</Label>
              <Input
                value={extrasTag}
                onChange={(e) => setExtrasTag(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input
                value={extrasInstagram}
                onChange={(e) => setExtrasInstagram(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={extrasNotes}
                onChange={(e) => setExtrasNotes(e.target.value)}
                rows={4}
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
            >
              {updateUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Salvar Extras"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Modal EDITAR PERFIL (NOVO) --- */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Dados de {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Altere dados cadastrais e senha
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone / WhatsApp</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="pt-2 border-t mt-4">
              <div className="space-y-2">
                <Label className="text-destructive">
                  Alterar Senha (Opcional)
                </Label>
                <Input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Deixe em branco para não alterar"
                />
                <p className="text-xs text-muted-foreground">
                  Só preencha se quiser redefinir a senha deste usuário.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditProfileOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
