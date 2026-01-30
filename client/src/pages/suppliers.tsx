import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Supplier } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Contact,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  XSquare,
} from "lucide-react";
import { useState } from "react";

// MÁSCARAS DE FORMATAÇÃO
const masks = {
  cnpj: (v: string) =>
    v
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
      .substring(0, 18),
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
  currency: (v: string) => {
    const numbers = v.replace(/\D/g, "");
    const amount = parseFloat(numbers) / 100;
    return isNaN(amount)
      ? ""
      : amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  },
  unmaskCurrency: (v: string) => {
    if (!v) return "0";
    return v.replace(/\./g, "").replace(",", ".");
  },
};

export default function SuppliersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Estado para erros visuais (Box Vermelho)
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  const initialFormState = {
    id: 0,
    name: "",
    tradingName: "",
    cnpj: "",
    email: "",
    phone: "",
    contact: "",
    paymentTerms: "",
    leadTime: "",
    minOrderValue: "",
    cep: "",
    address: "",
    addressNumber: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  };

  const [formData, setFormData] = useState(initialFormState);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const filteredSuppliers = Array.isArray(suppliers)
    ? suppliers.filter(
        (s) =>
          s.name?.toLowerCase().includes(search.toLowerCase()) ||
          s.tradingName?.toLowerCase().includes(search.toLowerCase()) ||
          s.cnpj?.includes(search),
      )
    : [];

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredSuppliers.map((s) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const fetchCnpj = async () => {
    const cleanCnpj = formData.cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      toast({
        title: "CNPJ Inválido",
        description: "Verifique os números digitados.",
        variant: "destructive",
      });
      return;
    }
    setLoadingCnpj(true);
    setValidationErrors([]);
    try {
      const res = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`,
      );
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      setFormData((prev) => ({
        ...prev,
        name: data.razao_social,
        tradingName: data.nome_fantasia || data.razao_social,
        email: data.email || prev.email,
        phone: data.ddd_telefone_1
          ? masks.phone(data.ddd_telefone_1)
          : prev.phone,
        cep: data.cep ? masks.cep(data.cep) : prev.cep,
        address: data.logradouro || prev.address,
        addressNumber: data.numero || prev.addressNumber,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
        complement: data.complemento || prev.complement,
      }));
      toast({
        title: "Dados encontrados!",
        description: "Informações preenchidas.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "CNPJ não encontrado na base.",
        variant: "destructive",
      });
    } finally {
      setLoadingCnpj(false);
    }
  };

  const fetchCep = async () => {
    const cleanCep = formData.cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(
        `https://brasilapi.com.br/api/cep/v1/${cleanCep}`,
      );
      if (!res.ok) throw new Error("CEP não encontrado");
      const data = await res.json();
      setFormData((prev) => ({
        ...prev,
        address: data.street,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
      }));
    } catch (error) {
    } finally {
      setLoadingCep(false);
    }
  };

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

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        leadTime: data.leadTime ? parseInt(data.leadTime) : 0,
        minOrderValue: masks.unmaskCurrency(data.minOrderValue),
      };
      const res = await apiRequest("POST", "/api/suppliers", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Sucesso", description: "Fornecedor cadastrado!" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setValidationErrors([parseErrorMessage(error)]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        leadTime: data.leadTime ? parseInt(data.leadTime) : 0,
        minOrderValue: masks.unmaskCurrency(data.minOrderValue),
      };
      await apiRequest("PATCH", `/api/suppliers/${data.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Atualizado", description: "Dados salvos." });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setValidationErrors([parseErrorMessage(error)]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Excluído", description: "Fornecedor removido." });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        selectedIds.map((id) => apiRequest("DELETE", `/api/suppliers/${id}`)),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Exclusão em Massa",
        description: `${selectedIds.length} fornecedores removidos.`,
      });
      setSelectedIds([]);
    },
  });

  const handleOpenCreate = () => {
    setFormData(initialFormState);
    setValidationErrors([]);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setFormData({
      id: supplier.id,
      name: supplier.name,
      tradingName: supplier.tradingName || "",
      cnpj: supplier.cnpj || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      contact: supplier.contact || "",
      paymentTerms: supplier.paymentTerms || "",
      leadTime: supplier.leadTime?.toString() || "",
      minOrderValue: supplier.minOrderValue
        ? masks.currency(supplier.minOrderValue.replace(".", ""))
        : "",
      cep: supplier.cep || "",
      address: supplier.address || "",
      addressNumber: supplier.addressNumber || "",
      complement: supplier.complement || "",
      neighborhood: supplier.neighborhood || "",
      city: supplier.city || "",
      state: supplier.state || "",
    });
    setValidationErrors([]);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setFormData(initialFormState);
    setValidationErrors([]);
  };

  const handleSave = () => {
    const errors = [];
    if (!formData.name) errors.push("Razão Social é obrigatória");
    if (!formData.cnpj) errors.push("CNPJ é obrigatório");

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    if (isEditing) updateMutation.mutate(formData);
    else createMutation.mutate(formData);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este fornecedor?"))
      deleteMutation.mutate(id);
  };

  const handleBulkDelete = () => {
    if (
      confirm(
        `Tem certeza que deseja excluir os ${selectedIds.length} fornecedores selecionados?`,
      )
    ) {
      bulkDeleteMutation.mutate();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gestão de Fornecedores
          </h1>
          <p className="text-muted-foreground">
            Controle de parceiros, prazos e automação de dados.
          </p>
        </div>
        <Button
          size="lg"
          onClick={handleOpenCreate}
          className="bg-primary hover:bg-primary/90 shadow-lg transition-all"
        >
          <Plus className="mr-2 h-5 w-5" /> Novo Fornecedor
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 justify-between">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por Razão Social, Fantasia ou CNPJ..."
                className="pl-9 h-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* ✅ BARRA DE AÇÕES EM MASSA (PADRONIZADO NO TOPO) */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg border animate-in fade-in slide-in-from-right-5">
                <span className="text-sm font-medium px-2">
                  {selectedIds.length} selecionados
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                  className="text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                  )}
                  Excluir
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedIds([])}
                  className="h-8 w-8"
                >
                  <XSquare className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground animate-pulse">
              Carregando lista...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center gap-3">
              <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-2">
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-xl font-semibold">
                Nenhum fornecedor encontrado
              </h3>
              <p className="text-muted-foreground">
                Cadastre seu primeiro parceiro para começar.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-12 text-center">
                      <Checkbox
                        checked={
                          filteredSuppliers.length > 0 &&
                          selectedIds.length === filteredSuppliers.length
                        }
                        onCheckedChange={(checked) =>
                          handleSelectAll(!!checked)
                        }
                      />
                    </TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Condições</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((s) => (
                    <TableRow
                      key={s.id}
                      className={`hover:bg-muted/40 transition-colors ${selectedIds.includes(s.id) ? "bg-primary/5" : ""}`}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedIds.includes(s.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(s.id, !!checked)
                          }
                        />
                      </TableCell>

                      {/* ✅ EMPRESA + CNPJ UNIFICADOS */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-base text-foreground/90">
                            {s.name}
                          </span>
                          {s.tradingName && s.tradingName !== s.name && (
                            <span className="text-xs text-muted-foreground">
                              {s.tradingName}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground font-mono mt-0.5">
                            {s.cnpj}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {s.contact && (
                            <div className="flex items-center gap-2 font-medium">
                              <Contact className="h-3.5 w-3.5 text-primary" />{" "}
                              {s.contact}
                            </div>
                          )}
                          {s.phone && (
                            <div className="text-muted-foreground text-xs">
                              {s.phone}
                            </div>
                          )}
                          {s.email && (
                            <div className="text-muted-foreground text-xs flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {s.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {s.city && s.state ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" /> {s.city}/
                              {s.state}
                            </div>
                          ) : (
                            <span className="opacity-50">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {s.leadTime ? (
                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase border px-2 py-1 rounded bg-blue-50 text-blue-700 border-blue-200">
                              {s.leadTime}d Entrega
                            </div>
                          ) : null}
                          {s.minOrderValue &&
                            parseFloat(s.minOrderValue) > 0 && (
                              <div className="flex items-center gap-1 text-[10px] font-bold uppercase border px-2 py-1 rounded bg-green-50 text-green-700 border-green-200">
                                Min:{" "}
                                {parseFloat(s.minOrderValue).toLocaleString(
                                  "pt-BR",
                                  { style: "currency", currency: "BRL" },
                                )}
                              </div>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-primary/10"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenEdit(s)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(s.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="text-2xl flex items-center gap-2">
              {isEditing ? (
                <Pencil className="h-5 w-5" />
              ) : (
                <Plus className="h-6 w-6" />
              )}{" "}
              {isEditing ? "Editar Fornecedor" : "Cadastrar Novo Fornecedor"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo. Campos com{" "}
              <span className="text-red-500">*</span> são obrigatórios.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-8">
              {/* ✅ BOX DE ERRO CORRIGIDO */}
              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro de Validação</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 mt-1">
                      {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
                <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Dados Empresariais
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex justify-between">
                      CNPJ <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.cnpj}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cnpj: masks.cnpj(e.target.value),
                          })
                        }
                        placeholder="00.000.000/0001-00"
                        className="font-mono"
                        maxLength={18}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchCnpj}
                        disabled={loadingCnpj}
                        className="bg-blue-50 border-blue-200 text-blue-700"
                      >
                        {loadingCnpj ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Razão Social <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Fantasia</Label>
                    <Input
                      value={formData.tradingName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tradingName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contato Principal (Nome)</Label>
                    <Input
                      value={formData.contact}
                      onChange={(e) =>
                        setFormData({ ...formData, contact: e.target.value })
                      }
                      placeholder="Ex: João Silva"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
                <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Endereço & Contato
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.cep}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cep: masks.cep(e.target.value),
                          })
                        }
                        onBlur={fetchCep}
                        maxLength={9}
                        placeholder="00000-000"
                      />
                      {loadingCep && (
                        <Loader2 className="h-8 w-8 animate-spin" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Rua</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input
                      value={formData.addressNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          addressNumber: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={formData.neighborhood}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          neighborhood: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Input
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Complemento</Label>
                    <Input
                      value={formData.complement}
                      onChange={(e) =>
                        setFormData({ ...formData, complement: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Email de Contato</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="contato@empresa.com"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Telefone / WhatsApp</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          phone: masks.phone(e.target.value),
                        })
                      }
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
                <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Condições Comerciais
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Lead Time (Dias)</Label>
                    <Input
                      type="number"
                      value={formData.leadTime}
                      onChange={(e) =>
                        setFormData({ ...formData, leadTime: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pedido Mínimo (R$)</Label>
                    <Input
                      value={formData.minOrderValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          minOrderValue: masks.currency(e.target.value),
                        })
                      }
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo Pagamento</Label>
                    <Input
                      value={formData.paymentTerms}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          paymentTerms: e.target.value,
                        })
                      }
                      placeholder="Ex: 30/60/90 dias"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-4 border-t bg-background mt-auto">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              className="h-12 px-6"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-primary h-12 px-8 text-lg font-bold"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" /> Salvar Cadastro
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
