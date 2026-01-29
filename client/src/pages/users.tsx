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
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Tag,
  Users as UsersIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

// --- CONFIGURAÇÃO DOS MÓDULOS (Equipe) ---
const SYSTEM_MODULES = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Visão geral e gráficos",
  },
  {
    key: "users",
    label: "Gestão de Equipe",
    description: "Gerenciar usuários internos",
  },
  {
    key: "customers", // Novo módulo específico
    label: "Gestão de Clientes",
    description: "Aprovar e gerenciar clientes B2B",
  },
  {
    key: "sales_catalog",
    label: "Catálogo de Vendas",
    description: "Visualizar produtos e emitir pedidos",
  },
  {
    key: "products",
    label: "Gestão de Produtos",
    description: "Cadastrar, editar preços e estoque",
  },
  { key: "orders", label: "Pedidos", description: "Vendas e orçamentos" },
  {
    key: "suppliers",
    label: "Fornecedores",
    description: "Gestão de compras e fornecedores",
  },
  {
    key: "settings",
    label: "Configurações / Financeiro",
    description: "Dados da empresa e sistema",
  },
];

export default function UsersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // --- MODAIS ---
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isExtrasOpen, setIsExtrasOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Estados
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  // Create Form
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Default para employee, já que não criamos customers aqui
  const [newUserRole, setNewUserRole] = useState<UserRole>("employee");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  // Extras Form
  const [extrasTag, setExtrasTag] = useState("");
  const [extrasInstagram, setExtrasInstagram] = useState("");
  const [extrasNotes, setExtrasNotes] = useState("");

  // Edit Profile Form
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);

  // ✅ HELPER DE ERRO (Igual ao de fornecedores)
  const parseErrorMessage = (error: Error) => {
    let msg = error.message;
    if (msg.includes(": ")) {
      const parts = msg.split(": ");
      if (parts.length > 1) {
        try {
          const json = JSON.parse(parts.slice(1).join(": "));
          if (json.message) return json.message;
        } catch {
          return parts.slice(1).join(": ");
        }
      }
    }
    try {
      const json = JSON.parse(msg);
      if (json.message) return json.message;
    } catch {}
    return msg;
  };

  const {
    data: usersData = [],
    isLoading,
    refetch,
  } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Query para buscar permissões atuais
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

  // --- DEFAULTS ---
  const getDefaultModulesForRole = (role: UserRole): string[] => {
    const roleDefaults: Record<string, string[]> = {
      admin: SYSTEM_MODULES.map((m) => m.key),
      employee: ["dashboard", "products", "orders", "customers"],
      sales: ["sales_catalog", "orders", "customers"],
      // Customer removido daqui pois não é gerenciado nesta tela
    };
    return roleDefaults[role] || [];
  };

  useEffect(() => {
    if (isCreateOpen) {
      setSelectedModules(getDefaultModulesForRole(newUserRole));
    }
  }, [newUserRole, isCreateOpen]);

  // Mutations
  const updateUserMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<User> & { password?: string; modules?: string };
    }) => {
      await apiRequest("PATCH", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Sucesso", description: "Dados atualizados." });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro",
        description: parseErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: {
      firstName: string;
      email: string;
      password: string;
      role: string;
      modules: string;
    }) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setShowPassword(false);
      setNewUserRole("employee");
      setSelectedModules([]);
      toast({ title: "Sucesso", description: "Membro da equipe adicionado!" });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao criar",
        description: parseErrorMessage(err), // Usa o parser para mostrar msg amigável
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
        title: "Removido",
        description: "Usuário excluído da equipe.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao excluir usuário",
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
        title: "Campos obrigatórios",
        description: "Preencha nome, email e senha.",
        variant: "destructive",
      });
      return;
    }
    if (!isValidEmail(newUserEmail)) {
      toast({
        title: "Email Inválido",
        description: "Digite um e-mail válido.",
        variant: "destructive",
      });
      return;
    }

    createUserMutation.mutate({
      firstName: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      role: newUserRole,
      modules: JSON.stringify(selectedModules),
    });
  };

  const handleSavePermissions = () => {
    if (selectedUser) {
      const modulesString = JSON.stringify(selectedModules);
      updateUserMutation.mutate(
        { id: selectedUser.id, data: { modules: modulesString } as any },
        {
          onSuccess: () => {
            setIsPermissionsOpen(false);
            setSelectedUser(null);
          },
        },
      );
    }
  };

  const handleOpenPermissions = (user: UserData) => {
    setSelectedUser(user);
    const userObj = usersData.find((u) => u.id === user.id);
    let existingModules: string[] = [];

    if (userObj?.modules) {
      try {
        existingModules =
          typeof userObj.modules === "string"
            ? JSON.parse(userObj.modules)
            : userObj.modules;
      } catch (e) {
        existingModules = [];
      }
    }

    if (existingModules.length > 0) {
      setSelectedModules(existingModules);
    } else {
      setSelectedModules(getDefaultModulesForRole(user.role));
    }
    setIsPermissionsOpen(true);
  };

  const toggleModule = (moduleKey: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleKey)
        ? prev.filter((k) => k !== moduleKey)
        : [...prev, moduleKey],
    );
  };

  // ✅ FILTRAGEM INICIAL: Apenas equipe (não mostra customers)
  const users: UserData[] = usersData
    .filter((u) => u.role !== "customer") // <--- O Segredo está aqui!
    .map((u) => ({
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
      active: u.ativo !== false,
      tag: u.tag || undefined,
      instagram: u.instagram || undefined,
      notes: u.notes || undefined,
      avatarUrl: undefined,
    }));

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "all") return matchesSearch;
    // Tabs da equipe interna
    if (activeTab === "admin") return matchesSearch && user.role === "admin";
    if (activeTab === "sales") return matchesSearch && user.role === "sales";
    if (activeTab === "employee")
      return matchesSearch && user.role === "employee";

    return matchesSearch;
  });

  const handleApprove = (user: UserData) => {
    updateUserMutation.mutate({ id: user.id, data: { approved: true } });
  };

  const handleReject = (user: UserData) => {
    if (confirm(`Tem certeza que deseja EXCLUIR ${user.name}?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const handleChangeRole = (user: UserData, role: UserRole) => {
    updateUserMutation.mutate({ id: user.id, data: { role } });
  };

  const handleChangeCustomerType = (
    user: UserData,
    customerType: CustomerType,
  ) => {
    updateUserMutation.mutate({ id: user.id, data: { customerType } });
  };

  const handleToggleActive = (user: UserData) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { ativo: !user.active } as any,
    });
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
            notes: extrasNotes || null,
          },
        },
        {
          onSuccess: () => {
            setIsExtrasOpen(false);
            setSelectedUser(null);
          },
        },
      );
    }
  };

  const handleOpenEditProfile = (user: UserData) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPhone(user.phone || "");
    setEditPassword("");
    setShowEditPassword(false);
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = () => {
    if (!selectedUser) return;

    const updateData: any = {
      nome: editName,
      email: editEmail,
      telefone: editPhone,
    };

    if (editPassword.trim()) {
      updateData.password = editPassword;
    }

    updateUserMutation.mutate(
      { id: selectedUser.id, data: updateData },
      {
        onSuccess: () => {
          setIsEditProfileOpen(false);
          setSelectedUser(null);
        },
      },
    );
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <UsersIcon className="h-8 w-8" />
            Gestão de Equipe
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie administradores, vendedores e funcionários internos.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user">
                <Plus className="h-4 w-4 mr-2" />
                Novo Membro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
                <DialogDescription>
                  Crie acesso para um novo colaborador.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Nome do colaborador"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail *</Label>
                    <Input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="email@empresa.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Senha *</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Senha de acesso"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Cargo / Função</Label>
                    <Select
                      value={newUserRole}
                      onValueChange={(v) => setNewUserRole(v as UserRole)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* 🛑 Clientes e Fornecedores removidos daqui! */}
                        <SelectItem value="employee">
                          Funcionário (Operacional)
                        </SelectItem>
                        <SelectItem value="sales">Vendedor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <Label className="text-base font-medium">
                      Módulos de Acesso
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
                          <p className="text-xs text-muted-foreground">
                            {module.description}
                          </p>
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
                  {createUserMutation.isPending ? "Criando..." : "Criar Acesso"}
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar na equipe..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Todos ({users.length})</TabsTrigger>
          <TabsTrigger value="admin">Administradores</TabsTrigger>
          <TabsTrigger value="sales">Vendas</TabsTrigger>
          <TabsTrigger value="employee">Operacional</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Nenhum membro encontrado nesta categoria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map((user) => (
                <div key={user.id}>
                  <UserCard
                    user={user}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onChangeRole={handleChangeRole}
                    onChangeCustomerType={handleChangeCustomerType}
                    onEditExtras={handleOpenExtras}
                    onEditProfile={handleOpenEditProfile}
                    onOpenPermissions={handleOpenPermissions}
                    onToggleActive={handleToggleActive}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modais auxiliares mantidos igual ao original */}
      <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissões de {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Configure quais módulos este usuário pode acessar
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
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Salvar Permissões"
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
                <div className="relative">
                  <Input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Deixe em branco para não alterar"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                  >
                    {showEditPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
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
