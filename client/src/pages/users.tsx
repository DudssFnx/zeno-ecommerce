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

// --- MÁSCARAS ---
const masks = {
  cpf: (v: string) =>
    v
      .replace(/\D/g, "")
      .replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
      .substring(0, 14),
  phone: (v: string) =>
    v
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
      .substring(0, 15),
};

// --- CONFIGURAÇÃO DOS MÓDULOS ---
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
    key: "customers",
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

// Definição dos perfis padrão para comparação
const ROLE_PRESETS: Record<string, string[]> = {
  admin: SYSTEM_MODULES.map((m) => m.key),
  employee: ["dashboard", "products", "orders", "customers"],
  sales: ["sales_catalog", "orders", "customers"],
};

export default function UsersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // --- MODAIS ---
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExtrasOpen, setIsExtrasOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Estados
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  // Create Form
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserCPF, setNewUserCPF] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newUserRole, setNewUserRole] = useState<string>("employee");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  // Extras Form
  const [extrasTag, setExtrasTag] = useState("");
  const [extrasInstagram, setExtrasInstagram] = useState("");
  const [extrasNotes, setExtrasNotes] = useState("");

  // Edit Profile Form (Agora Completo)
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCPF, setEditCPF] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editRole, setEditRole] = useState<string>("employee");
  const [editModules, setEditModules] = useState<string[]>([]);

  // ✅ HELPER DE ERRO
  const parseErrorMessage = (error: Error) => {
    let msg = error.message;
    try {
      if (msg.includes("{")) {
        const jsonMatch = msg.match(/\{.*\}/);
        if (jsonMatch) {
          const json = JSON.parse(jsonMatch[0]);
          if (json.message) return json.message;
        }
      }
    } catch {}
    return msg;
  };

  // ✅ LÓGICA INTELIGENTE DE PERMISSÕES
  // Verifica se os módulos atuais batem com algum preset
  const checkRoleByModules = (modules: string[]): string => {
    const sortedModules = [...modules].sort().join(",");

    if (sortedModules === [...ROLE_PRESETS.admin].sort().join(","))
      return "admin";
    if (sortedModules === [...ROLE_PRESETS.sales].sort().join(","))
      return "sales";
    if (sortedModules === [...ROLE_PRESETS.employee].sort().join(","))
      return "employee";

    return "custom";
  };

  const {
    data: usersData = [],
    isLoading,
    refetch,
  } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // --- Handlers para Criação ---

  // Ao mudar o cargo no Create, atualiza os módulos
  const handleNewUserRoleChange = (role: string) => {
    setNewUserRole(role);
    if (role !== "custom" && ROLE_PRESETS[role]) {
      setSelectedModules([...ROLE_PRESETS[role]]);
    } else if (role === "custom") {
      // Se mudar para personalizado manualmente, não limpa, mantem o que estava
    }
  };

  // Ao mudar módulos no Create, verifica se virou personalizado
  const handleNewUserModuleToggle = (moduleKey: string) => {
    const newModules = selectedModules.includes(moduleKey)
      ? selectedModules.filter((k) => k !== moduleKey)
      : [...selectedModules, moduleKey];

    setSelectedModules(newModules);
    setNewUserRole(checkRoleByModules(newModules));
  };

  // --- Handlers para Edição ---

  // Ao mudar o cargo no Edit, atualiza os módulos
  const handleEditRoleChange = (role: string) => {
    setEditRole(role);
    if (role !== "custom" && ROLE_PRESETS[role]) {
      setEditModules([...ROLE_PRESETS[role]]);
    }
  };

  // Ao mudar módulos no Edit, verifica se virou personalizado
  const handleEditModuleToggle = (moduleKey: string) => {
    const newModules = editModules.includes(moduleKey)
      ? editModules.filter((k) => k !== moduleKey)
      : [...editModules, moduleKey];

    setEditModules(newModules);
    setEditRole(checkRoleByModules(newModules));
  };

  // Inicializa o form de criação com defaults
  useEffect(() => {
    if (isCreateOpen && selectedModules.length === 0) {
      handleNewUserRoleChange("employee");
    }
  }, [isCreateOpen]);

  // --- Mutations ---
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao atualizar");
      }
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
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/register", data);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Erro ao criar usuário");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateOpen(false);
      // Reset form
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPhone("");
      setNewUserCPF("");
      setNewUserPassword("");
      setShowPassword(false);
      handleNewUserRoleChange("employee");
      toast({ title: "Sucesso", description: "Membro da equipe adicionado!" });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao criar",
        description: parseErrorMessage(err),
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
      toast({ title: "Removido", description: "Usuário excluído da equipe." });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao excluir usuário",
        variant: "destructive",
      });
    },
  });

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
      role: newUserRole === "custom" ? "employee" : newUserRole, // Salva 'employee' se for custom, mas os módulos definem a permissão real
      modules: JSON.stringify(selectedModules),
      phone: newUserPhone,
      cpf: newUserCPF,
    });
  };

  const users: UserData[] = usersData
    .filter((u) => u.role !== "customer")
    .map((u) => ({
      id: u.id,
      name:
        `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
        u.nome ||
        u.email ||
        "Unknown",
      email: u.email || "",
      phone: u.telefone || u.phone || "",
      company: u.company || u.razaoSocial || undefined,
      role: u.role as UserRole,
      customerType: (u.customerType || "varejo") as CustomerType,
      status: u.approved ? "approved" : ("pending" as UserStatus),
      active: u.ativo !== false,
      tag: u.tag || undefined,
      instagram: u.instagram || undefined,
      notes: u.notes || undefined,
      modules: u.modules, // Passando módulos para uso na edição
    }));

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "admin") return matchesSearch && user.role === "admin";
    if (activeTab === "sales") return matchesSearch && user.role === "sales";
    if (activeTab === "employee")
      return matchesSearch && user.role === "employee";
    return matchesSearch;
  });

  // --- Actions ---
  const handleApprove = (user: UserData) =>
    updateUserMutation.mutate({ id: user.id, data: { approved: true } });
  const handleToggleActive = (user: UserData) =>
    updateUserMutation.mutate({
      id: user.id,
      data: { ativo: !user.active } as any,
    });
  const handleReject = (user: UserData) => {
    if (confirm(`Excluir ${user.name}?`)) deleteUserMutation.mutate(user.id);
  };

  // Estas funções não são mais usadas diretamente pois movemos para o modal de edição completo
  const handleChangeRole = (user: UserData, role: UserRole) =>
    updateUserMutation.mutate({ id: user.id, data: { role } });
  const handleChangeCustomerType = (
    user: UserData,
    customerType: CustomerType,
  ) => updateUserMutation.mutate({ id: user.id, data: { customerType } });

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
        { onSuccess: () => setIsExtrasOpen(false) },
      );
    }
  };

  // ✅ ABRIR MODAL DE EDIÇÃO COMPLETO
  const handleOpenEditProfile = (user: UserData) => {
    setSelectedUser(user);
    const fullUser = usersData.find((u) => u.id === user.id);

    setEditName(user.name);
    setEditEmail(user.email);
    setEditPhone(user.phone || "");
    setEditCPF(fullUser?.cpf || "");
    setEditPassword("");
    setShowEditPassword(false);

    // Carregar Permissões e Role
    let currentModules: string[] = [];
    if (fullUser?.modules) {
      try {
        currentModules =
          typeof fullUser.modules === "string"
            ? JSON.parse(fullUser.modules)
            : fullUser.modules;
      } catch {
        currentModules = [];
      }
    }
    setEditModules(currentModules);
    setEditRole(checkRoleByModules(currentModules)); // Detecta se é Custom ou Preset

    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = () => {
    if (!selectedUser) return;

    const updateData: any = {
      firstName: editName,
      email: editEmail,
      phone: editPhone,
      cpf: editCPF,
      role: editRole === "custom" ? "employee" : editRole, // Salva role compatível
      modules: JSON.stringify(editModules),
    };

    if (editPassword.trim()) {
      updateData.password = editPassword;
    }

    updateUserMutation.mutate(
      { id: selectedUser.id, data: updateData },
      { onSuccess: () => setIsEditProfileOpen(false) },
    );
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <UsersIcon className="h-8 w-8 text-primary" />
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
                <Plus className="h-4 w-4 mr-2" /> Novo Membro
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
                    <Label>CPF</Label>
                    <Input
                      value={newUserCPF}
                      onChange={(e) => setNewUserCPF(masks.cpf(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone / WhatsApp</Label>
                    <Input
                      value={newUserPhone}
                      onChange={(e) =>
                        setNewUserPhone(masks.phone(e.target.value))
                      }
                      placeholder="(00) 00000-0000"
                      maxLength={15}
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
                      onValueChange={handleNewUserRoleChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">
                          Funcionário (Operacional)
                        </SelectItem>
                        <SelectItem value="sales">Vendedor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
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
                        onClick={() => handleNewUserModuleToggle(module.key)}
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
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
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
                    onEditProfile={handleOpenEditProfile} // ✅ Abre o modal novo completo
                    onOpenPermissions={() => {}} // Desativado pois está integrado no EditProfile
                    onToggleActive={handleToggleActive}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isExtrasOpen} onOpenChange={setIsExtrasOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" /> Extras de {selectedUser?.name}
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

      {/* ✅ MODAL DE EDIÇÃO COMPLETO */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Dados de {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Altere dados cadastrais, senha e permissões de acesso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label>CPF</Label>
                <Input
                  value={editCPF}
                  onChange={(e) => setEditCPF(masks.cpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>

              <div className="space-y-2">
                <Label>Telefone / WhatsApp</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(masks.phone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                />
              </div>

              <div className="space-y-2">
                <Label>Senha (Opcional)</Label>
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
              </div>

              <div className="space-y-2">
                <Label>Cargo / Função</Label>
                <Select value={editRole} onValueChange={handleEditRoleChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">
                      Funcionário (Operacional)
                    </SelectItem>
                    <SelectItem value="sales">Vendedor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <Label className="text-base font-medium">
                  Permissões de Acesso
                </Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {SYSTEM_MODULES.map((module) => (
                  <div
                    key={module.key}
                    className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30 hover-elevate cursor-pointer"
                    onClick={() => handleEditModuleToggle(module.key)}
                  >
                    <Checkbox
                      checked={editModules.includes(module.key)}
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
