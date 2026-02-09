import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState } from "react";
// Tipo mínimo para usuário (funcionário)
interface User {
  id: string;
  // ...adicione outros campos conforme necessário
}
    queryFn: async () => {
      const res = await axios.get("/api/users");
      return res.data;
    },
    enabled: !!selectedCompany,
  });

  // Filtra funcionários da empresa selecionada (exclui clientes)
  const selectedCompanyEmployees = selectedCompany
    ? allUsers.filter(
        (u) => u.companyId === selectedCompany.id && u.role !== "customer",
      )
    : [];

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [companiesRes, metricsRes] = await Promise.all([
          axios.get("/api/superadmin/companies"),
          axios.get("/api/superadmin/metrics"),
        ]);
        setCompanies(companiesRes.data);
        setMetrics(metricsRes.data);
      } catch (err: any) {
        setError(err.response?.data?.message || "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleBlockCompany(id: string, block: boolean) {
    try {
      await axios.patch(`/api/superadmin/companies/${id}/block`, { block });
      setCompanies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, active: !block } : c)),
      );
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao atualizar empresa");
    }
  }

  if (loading) return <div>Carregando...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  // Filtro de empresas
  const filteredCompanies = companies.filter((c) => {
    if (companyFilter === "all") return true;
    if (companyFilter === "active") return c.active;
    if (companyFilter === "inactive") return !c.active;
    return true;
  });

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-[#181f2a] border-r border-[#232b3b] p-4 flex flex-col text-white min-h-screen shadow-lg">
        <h2 className="text-2xl font-extrabold mb-6 tracking-tight flex items-center gap-2">
          <span className="inline-block w-2 h-6 bg-blue-600 rounded-sm mr-2"></span>
          Empresas
        </h2>
        <div className="flex gap-2 mb-6">
          <button
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg font-semibold text-sm transition-colors ${companyFilter === "all" ? "bg-blue-600 text-white shadow" : "bg-[#232b3b] text-blue-200 hover:bg-blue-800/40"}`}
            onClick={() => setCompanyFilter("all")}
            title="Todas"
          >
            <span>●</span> Todas
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg font-semibold text-sm transition-colors ${companyFilter === "active" ? "bg-green-600 text-white shadow" : "bg-[#232b3b] text-green-200 hover:bg-green-800/40"}`}
            onClick={() => setCompanyFilter("active")}
            title="Ativas"
          >
            <span>✔</span> Ativas
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg font-semibold text-sm transition-colors ${companyFilter === "inactive" ? "bg-red-600 text-white shadow" : "bg-[#232b3b] text-red-200 hover:bg-red-800/40"}`}
            onClick={() => setCompanyFilter("inactive")}
            title="Inativas"
          >
            <span>✖</span> Inativas
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          {filteredCompanies.length === 0 && (
            <div className="text-gray-400 text-center mt-8">
              Nenhuma empresa
            </div>
          )}
          <ul className="space-y-2">
            {filteredCompanies.map((c) => (
              <li
                key={c.id}
                className={`rounded-lg cursor-pointer transition-all border border-transparent px-3 py-2 ${selectedCompany?.id === c.id ? "bg-blue-700/90 border-blue-400 shadow text-white scale-[1.03]" : "hover:bg-blue-900/40 bg-[#232b3b] text-gray-200 hover:scale-[1.01]"}`}
                onClick={() => setSelectedCompany(c)}
              >
                <div className="font-bold text-base truncate">
                  {c.fantasyName || "-"}
                </div>
                <div className="text-xs text-blue-200 truncate">
                  {c.razaoSocial || "-"}
                </div>
                <div
                  className={`text-xs mt-1 font-semibold ${c.active ? "text-green-400" : "text-red-400"}`}
                >
                  {c.active ? "Ativa" : "Bloqueada"}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <button
          className="bg-gradient-to-r from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600 text-white px-4 py-2 rounded-lg mt-6 font-bold shadow transition-all text-base"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancelar" : "Cadastrar nova empresa"}
        </button>
      </aside>

      {/* Conteúdo principal com grid para métricas e detalhes */}
      <main className="flex-1 p-8 flex flex-col gap-8 bg-[#101624] text-white min-h-screen">
        <h1 className="text-3xl font-extrabold mb-6 text-white tracking-tight flex items-center gap-3">
          <span className="inline-block w-2 h-8 bg-blue-600 rounded-sm"></span>
          Painel Superadmin
        </h1>
        <div className="flex flex-col lg:flex-row gap-8 w-full">
          {/* Cards de métricas */}
          {metrics && (
            <div className="flex flex-1 gap-8 mb-0">
              <div className="bg-gradient-to-br from-blue-800 to-blue-600 rounded-2xl p-6 flex-1 min-w-[180px] border border-[#2e3a54] shadow-lg text-white flex flex-col items-center justify-center hover:scale-[1.03] transition-transform">
                <div className="text-lg font-bold text-blue-200 mb-1 tracking-tight">
                  Empresas
                </div>
                <div className="text-3xl font-extrabold">
                  {metrics.totalEmpresas}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-800 to-blue-500 rounded-2xl p-6 flex-1 min-w-[180px] border border-[#2e3a54] shadow-lg text-white flex flex-col items-center justify-center hover:scale-[1.03] transition-transform">
                <div className="text-lg font-bold text-blue-200 mb-1 tracking-tight">
                  Produtos
                </div>
                <div className="text-3xl font-extrabold">
                  {metrics.totalProdutos}
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-800 to-blue-500 rounded-2xl p-6 flex-1 min-w-[180px] border border-[#2e3a54] shadow-lg text-white flex flex-col items-center justify-center hover:scale-[1.03] transition-transform">
                <div className="text-lg font-bold text-blue-200 mb-1 tracking-tight">
                  Usuários
                </div>
                <div className="text-3xl font-extrabold">
                  {metrics.totalUsuarios}
                </div>
              </div>
            </div>
          )}

          {/* Detalhes da empresa selecionada */}
          {selectedCompany && (
            <div className="bg-[#232b3b] border border-[#2e3a54] rounded-2xl shadow-lg p-6 flex-1 min-w-[340px] max-w-xl self-start text-white flex flex-col gap-2 animate-fade-in">
              <h2 className="text-2xl font-extrabold mb-2 text-blue-200 tracking-tight flex items-center gap-2">
                <span className="inline-block w-2 h-6 bg-blue-600 rounded-sm"></span>
                {selectedCompany.fantasyName}
              </h2>
              <div className="mb-1 text-base text-blue-100 font-medium">
                Razão Social:{" "}
                <span className="font-normal">
                  {selectedCompany.razaoSocial}
                </span>
              </div>
              <div className="mb-1 text-base text-blue-100 font-medium">
                Email:{" "}
                <span className="font-normal">{selectedCompany.email}</span>
              </div>
              <div className="mb-1 text-base text-blue-100 font-medium">
                Status:{" "}
                <span
                  className={`font-bold ${selectedCompany.active ? "text-green-400" : "text-red-400"}`}
                >
                  {selectedCompany.active ? "Ativa" : "Bloqueada"}
                </span>
              </div>

              <div className="border-t border-[#2e3a54] my-4"></div>

              {/* Funcionários */}
              <div className="mt-2">
                <h3 className="text-lg font-bold mb-2 text-blue-300 tracking-tight">
                  Funcionários
                </h3>
                {loadingUsers ? (
                  <div className="text-blue-100">
                    Carregando funcionários...
                  </div>
                ) : selectedCompanyEmployees.length === 0 ? (
                  <div className="text-gray-400">
                    Nenhum funcionário cadastrado.
                  </div>
                ) : (
                  <ul className="divide-y divide-[#2e3a54]">
                    {selectedCompanyEmployees.map((u) => (
                      <li key={u.id} className="py-2">
                        <div className="font-bold text-white text-base">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-xs text-blue-100">{u.email}</div>
                        <div className="text-xs text-blue-200">
                          Cargo: {u.role}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Clientes e produtos virão em seguida */}
            </div>
          )}
        </div>

        {/* Formulário de nova empresa */}
        {showForm && (
          <form
            className="bg-[#232b3b] border border-[#2e3a54] rounded-2xl shadow-lg p-6 mb-8 max-w-2xl text-white animate-fade-in"
            onSubmit={handleCreateCompany}
          >
            <h3 className="text-2xl font-extrabold mb-4 text-blue-200 tracking-tight flex items-center gap-2">
              <span className="inline-block w-2 h-6 bg-blue-600 rounded-sm"></span>
              Nova Empresa
            </h3>
            <div className="mb-4 text-blue-100 text-base">
              Preencha os dados da empresa e do usuário administrador principal. O admin receberá acesso imediato e poderá cadastrar os demais usuários e configurar a conta.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-base text-blue-100 font-semibold mb-1">Nome Fantasia</label>
                <input
                  className="border border-[#2e3a54] rounded-lg px-3 py-2 w-full bg-[#181f2a] text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={companyForm.fantasyName}
                  onChange={(e) =>
                    setCompanyForm((f) => ({
                      ...f,
                      fantasyName: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-base text-blue-100 font-semibold mb-1">Razão Social</label>
                <input
                  className="border border-[#2e3a54] rounded-lg px-3 py-2 w-full bg-[#181f2a] text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={companyForm.razaoSocial}
                  onChange={(e) =>
                    setCompanyForm((f) => ({
                      ...f,
                      razaoSocial: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-base text-blue-100 font-semibold mb-1">Email da Empresa</label>
                <input
                  className="border border-[#2e3a54] rounded-lg px-3 py-2 w-full bg-[#181f2a] text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  type="email"
                  value={companyForm.email}
                  onChange={(e) =>
                    setCompanyForm((f) => ({ ...f, email: e.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <h4 className="text-xl font-bold mt-6 mb-3 text-blue-300 tracking-tight">Admin Inicial</h4>
            <div className="mb-4 text-blue-100 text-base">
              O usuário admin será responsável por toda a configuração inicial e gestão da conta da empresa.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-base text-blue-100 font-semibold mb-1">Nome</label>
                <input
                  className="border border-[#2e3a54] rounded-lg px-3 py-2 w-full bg-[#181f2a] text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={adminForm.firstName}
                  onChange={(e) =>
                    setAdminForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-base text-blue-100 font-semibold mb-1">Sobrenome</label>
                <input
                  className="border border-[#2e3a54] rounded-lg px-3 py-2 w-full bg-[#181f2a] text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={adminForm.lastName}
                  onChange={(e) =>
                    setAdminForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-base text-blue-100 font-semibold mb-1">Email do Admin</label>
                <input
                  className="border border-[#2e3a54] rounded-lg px-3 py-2 w-full bg-[#181f2a] text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  type="email"
                  value={adminForm.email}
                  onChange={(e) =>
                    setAdminForm((f) => ({ ...f, email: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-base text-blue-100 font-semibold mb-1">Senha</label>
                <input
                  className="border border-[#2e3a54] rounded-lg px-3 py-2 w-full bg-[#181f2a] text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  type="password"
                  value={adminForm.password}
                  onChange={(e) =>
                    setAdminForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <button
              className="bg-gradient-to-r from-green-700 to-green-500 hover:from-green-800 hover:to-green-600 text-white px-6 py-3 rounded-lg mt-6 font-bold shadow transition-all text-lg w-full"
              type="submit"
              disabled={formLoading}
            >
              {formLoading ? "Cadastrando..." : "Cadastrar Empresa"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
