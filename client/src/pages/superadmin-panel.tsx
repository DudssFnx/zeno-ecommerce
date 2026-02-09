import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Package, UserCheck, Users } from "lucide-react";
import { useState } from "react";

type Company = {
  id: string;
  razaoSocial?: string;
  fantasyName?: string;
  nomeFantasia?: string;
  cnpj?: string;
  email?: string;
  active?: boolean;
  approvalStatus?: string;
  createdAt?: string;
};

interface CompanyStats {
  totalProdutos: number;
  totalFuncionarios: number;
  totalClientes: number;
}

interface Metrics {
  totalEmpresas: number;
  totalProdutos: number;
  totalUsuarios: number;
}

function useCompanyStats(companyId: string | null) {
  return useQuery<CompanyStats | null>({
    queryKey: ["superadmin-company-stats", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const [prod, func, cli] = await Promise.all([
        axios.get(`/api/products?companyId=${companyId}`),
        axios.get(`/api/users?companyId=${companyId}&role=admin,employee`),
        axios.get(`/api/users?companyId=${companyId}&role=customer`),
      ]);
      return {
        totalProdutos: prod.data?.length || 0,
        totalFuncionarios: func.data?.length || 0,
        totalClientes: cli.data?.length || 0,
      };
    },
    enabled: !!companyId,
  });
}

function SuperadminPanel() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newCompany, setNewCompany] = useState({
    razaoSocial: "",
    fantasyName: "",
    cnpj: "",
    email: "",
  });
  const [newAdmin, setNewAdmin] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });
  const [createError, setCreateError] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Empresas
  const {
    data: companies,
    isLoading: loadingCompanies,
    isError: errorCompanies,
  } = useQuery<Company[]>({
    queryKey: ["superadmin-companies"],
    queryFn: () => axios.get("/api/superadmin/companies").then((r) => r.data),
  });

  // Métricas globais
  const { data: metrics } = useQuery<Metrics>({
    queryKey: ["superadmin-metrics"],
    queryFn: () => axios.get("/api/superadmin/metrics").then((r) => r.data),
  });

  // Bloquear/desbloquear empresa
  const blockMutation = useMutation({
    mutationFn: ({ id, block }: { id: string; block: boolean }) =>
      axios.patch(`/api/superadmin/companies/${id}/block`, { block }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["superadmin-companies"] }),
  });

  // Criar empresa + admin
  const createMutation = useMutation({
    mutationFn: (data: any) => axios.post("/api/superadmin/companies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-companies"] });
      setShowCreate(false);
      setNewCompany({ razaoSocial: "", fantasyName: "", cnpj: "", email: "" });
      setNewAdmin({ email: "", password: "", firstName: "", lastName: "" });
      setCreateError("");
    },
    onError: (err: any) =>
      setCreateError(err?.response?.data?.message || "Erro ao criar empresa"),
  });

  const { data: stats, isLoading: loadingStats } = useCompanyStats(
    selectedCompany?.id || null,
  );

  if (loadingCompanies) return <div>Carregando empresas...</div>;
  if (errorCompanies) return <div>Erro ao carregar empresas</div>;

  return (
    <div className="flex flex-col md:flex-row max-w-6xl mx-auto p-4 md:p-8 gap-6">
      {/* Coluna de empresas */}
      <Card className="w-full md:w-72 bg-card/80 border-card-border flex flex-col h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Empresas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="h-[420px] pr-2 overflow-auto">
            <ul className="flex flex-col gap-2">
              {companies?.map((c: Company) => (
                <li key={c.id}>
                  <Button
                    variant={
                      selectedCompany?.id === c.id ? "default" : "outline"
                    }
                    className={
                      "w-full flex justify-between items-center px-3 py-2 rounded-lg text-base font-semibold transition-all" +
                      (selectedCompany?.id === c.id
                        ? " ring-2 ring-primary"
                        : "")
                    }
                    onClick={() => setSelectedCompany(c)}
                  >
                    <span className="truncate">
                      {c.nomeFantasia || c.fantasyName || c.razaoSocial}
                    </span>
                    <Badge
                      variant={c.active ? "default" : "destructive"}
                      className="ml-2"
                    >
                      {c.active ? "Ativa" : "Bloqueada"}
                    </Badge>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <Button
            className="mt-2 w-full"
            onClick={() => setShowCreate((v: boolean) => !v)}
          >
            {showCreate ? "Cancelar" : "Nova Empresa + Admin"}
          </Button>
          {showCreate && (
            <form
              className="flex flex-col gap-2 mt-2 bg-muted/60 rounded-lg p-3"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({ company: newCompany, admin: newAdmin });
              }}
            >
              <Input
                required
                placeholder="Razão Social"
                value={newCompany.razaoSocial}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewCompany((c) => ({ ...c, razaoSocial: e.target.value }))
                }
              />
              <Input
                required
                placeholder="Nome Fantasia"
                value={newCompany.fantasyName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewCompany((c) => ({ ...c, fantasyName: e.target.value }))
                }
              />
              <Input
                required
                placeholder="CNPJ"
                value={newCompany.cnpj}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewCompany((c) => ({ ...c, cnpj: e.target.value }))
                }
              />
              <Input
                required
                placeholder="Email da empresa"
                value={newCompany.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewCompany((c) => ({ ...c, email: e.target.value }))
                }
              />
              <div className="flex gap-2">
                <Input
                  required
                  placeholder="Nome Admin"
                  value={newAdmin.firstName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewAdmin((a) => ({ ...a, firstName: e.target.value }))
                  }
                />
                <Input
                  required
                  placeholder="Sobrenome Admin"
                  value={newAdmin.lastName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewAdmin((a) => ({ ...a, lastName: e.target.value }))
                  }
                />
              </div>
              <Input
                required
                placeholder="Email Admin"
                value={newAdmin.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewAdmin((a) => ({ ...a, email: e.target.value }))
                }
              />
              <Input
                required
                placeholder="Senha Admin"
                type="password"
                value={newAdmin.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewAdmin((a) => ({ ...a, password: e.target.value }))
                }
              />
              {createError && (
                <span className="text-destructive text-sm">{createError}</span>
              )}
              <Button type="submit" className="w-full" variant="secondary">
                Criar Empresa + Admin
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Detalhes da empresa selecionada */}
      <Card className="flex-1 bg-card/80 border-card-border min-h-[340px] flex flex-col">
        {selectedCompany ? (
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center gap-2">
              {selectedCompany.nomeFantasia ||
                selectedCompany.fantasyName ||
                selectedCompany.razaoSocial}
              <Badge
                variant={selectedCompany.active ? "default" : "destructive"}
              >
                {selectedCompany.active ? "Ativa" : "Bloqueada"}
              </Badge>
            </CardTitle>
            <div className="text-muted-foreground text-sm mt-1">
              CNPJ: {selectedCompany.cnpj} &nbsp;|&nbsp; Email:{" "}
              {selectedCompany.email}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span
                className={
                  selectedCompany.active
                    ? "text-green-500 font-semibold"
                    : "text-red-500 font-semibold"
                }
              >
                {selectedCompany.active ? "Ativa" : "Bloqueada"}
              </span>
              <span className="text-xs text-muted-foreground">
                Criada em:{" "}
                {selectedCompany.createdAt
                  ? new Date(selectedCompany.createdAt).toLocaleDateString()
                  : ""}
              </span>
            </div>
            <Button
              variant={selectedCompany.active ? "destructive" : "default"}
              className="mt-4 w-fit"
              onClick={() =>
                blockMutation.mutate({
                  id: selectedCompany.id,
                  block: !!selectedCompany.active,
                })
              }
            >
              {selectedCompany.active ? "Bloquear Empresa" : "Ativar Empresa"}
            </Button>
          </CardHeader>
        ) : (
          <CardHeader className="flex-1 flex items-center justify-center min-h-[220px]">
            <span className="text-muted-foreground text-lg">
              Selecione uma empresa para ver detalhes.
            </span>
          </CardHeader>
        )}
        {selectedCompany && (
          <CardContent className="flex flex-col gap-6 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="Produtos"
                value={loadingStats ? "..." : (stats?.totalProdutos ?? 0)}
                icon={Package}
                className="bg-muted/60"
              />
              <StatCard
                title="Funcionários"
                value={loadingStats ? "..." : (stats?.totalFuncionarios ?? 0)}
                icon={UserCheck}
                className="bg-muted/60"
              />
              <StatCard
                title="Clientes"
                value={loadingStats ? "..." : (stats?.totalClientes ?? 0)}
                icon={Users}
                className="bg-muted/60"
              />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default SuperadminPanel;
