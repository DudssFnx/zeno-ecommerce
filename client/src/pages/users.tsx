import { useState } from "react";
import { UserCard, type UserData, type UserRole } from "@/components/UserCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, RefreshCw, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
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

type UserStatus = "pending" | "approved" | "rejected";

export default function UsersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("customer");

  const { data: usersData = [], isLoading, refetch } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { firstName: string; email: string; password: string; role: string }) => {
      await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsCreateOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("customer");
      toast({ title: "Sucesso", description: "Usuário criado com sucesso" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message || "Falha ao criar usuário", variant: "destructive" });
    },
  });

  const handleCreateUser = () => {
    if (!newUserName || !newUserEmail || !newUserPassword) {
      toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    createUserMutation.mutate({
      firstName: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      role: newUserRole,
    });
  };

  const users: UserData[] = usersData.map((u) => ({
    id: u.id,
    name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "Unknown",
    email: u.email || "",
    company: u.company || undefined,
    role: u.role as UserRole,
    status: u.approved ? "approved" : "pending" as UserStatus,
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
          toast({ title: "Usuário Aprovado", description: `${user.name} foi aprovado.` });
        },
        onError: () => {
          toast({ title: "Erro", description: "Falha ao aprovar usuário", variant: "destructive" });
        },
      }
    );
  };

  const handleReject = (user: UserData) => {
    updateUserMutation.mutate(
      { id: user.id, data: { approved: false } },
      {
        onSuccess: () => {
          toast({ title: "Usuário Rejeitado", description: `${user.name} foi rejeitado.` });
        },
        onError: () => {
          toast({ title: "Erro", description: "Falha ao rejeitar usuário", variant: "destructive" });
        },
      }
    );
  };

  const handleChangeRole = (user: UserData, role: UserRole) => {
    updateUserMutation.mutate(
      { id: user.id, data: { role } },
      {
        onSuccess: () => {
          toast({ title: "Função Atualizada", description: `${user.name} agora é ${role}.` });
        },
        onError: () => {
          toast({ title: "Erro", description: "Falha ao atualizar função", variant: "destructive" });
        },
      }
    );
  };

  const pendingCount = users.filter((u) => u.status === "pending").length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground mt-1">Gerencie contas de clientes e membros da equipe</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user">
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Preencha os dados para criar um novo usuário
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Nome do usuário"
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
                  <Label htmlFor="role">Função</Label>
                  <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as UserRole)}>
                    <SelectTrigger data-testid="select-create-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Cliente</SelectItem>
                      <SelectItem value="sales">Vendedor</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
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
                    "Criar Usuário"
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
          placeholder="Buscar usuários..."
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
              <p className="text-muted-foreground">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onChangeRole={handleChangeRole}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
