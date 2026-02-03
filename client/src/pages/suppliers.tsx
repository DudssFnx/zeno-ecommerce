import { Badge } from "@/components/ui/badge";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Supplier } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Contact,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck,
  XSquare,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// --- MÁSCARAS ---
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

// --- SCHEMA DE VALIDAÇÃO (ZOD) ---
const formSchema = z.object({
  name: z.string().min(1, "Razão Social é obrigatória"),
  tradingName: z.string().optional(),
  cnpj: z.string().min(14, "CNPJ inválido").optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  contact: z.string().optional(),

  // Endereço
  cep: z.string().optional(),
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),

  // Comercial
  paymentTerms: z.string().optional(),
  leadTime: z.coerce.number().min(0).optional(),
  minOrderValue: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function SuppliersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  // --- FORMULÁRIO (React Hook Form) ---
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      tradingName: "",
      cnpj: "",
      email: "",
      phone: "",
      contact: "",
      cep: "",
      address: "",
      addressNumber: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      paymentTerms: "",
      leadTime: 0,
      minOrderValue: "",
      notes: "",
    },
  });

  // --- QUERY DE DADOS ---
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

  // --- INTEGRAÇÕES (BRASIL API) ---
  const fetchCnpj = async () => {
    const currentCnpj = form.getValues("cnpj");
    if (!currentCnpj) return;

    const cleanCnpj = currentCnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      toast({
        title: "CNPJ Inválido",
        description: "Verifique os números.",
        variant: "destructive",
      });
      return;
    }

    setLoadingCnpj(true);
    try {
      const res = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`,
      );
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();

      form.setValue("name", data.razao_social);
      form.setValue("tradingName", data.nome_fantasia || data.razao_social);
      form.setValue("email", data.email || "");
      if (data.ddd_telefone_1) {
        form.setValue(
          "phone",
          masks.phone(`${data.ddd_telefone_1}${data.telefone_1}`),
        );
      }
      if (data.cep) form.setValue("cep", masks.cep(data.cep));
      form.setValue("address", data.logradouro);
      form.setValue("addressNumber", data.numero);
      form.setValue("neighborhood", data.bairro);
      form.setValue("city", data.municipio);
      form.setValue("state", data.uf);
      form.setValue("complement", data.complemento);

      toast({ title: "Sucesso!", description: "Dados da empresa carregados." });
    } catch (error) {
      toast({
        title: "Atenção",
        description: "CNPJ não encontrado na base pública.",
        variant: "destructive",
      });
    } finally {
      setLoadingCnpj(false);
    }
  };

  const fetchCep = async () => {
    const currentCep = form.getValues("cep");
    if (!currentCep) return;

    const cleanCep = currentCep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setLoadingCep(true);
    try {
      const res = await fetch(
        `https://brasilapi.com.br/api/cep/v1/${cleanCep}`,
      );
      if (!res.ok) throw new Error("CEP não encontrado");
      const data = await res.json();

      form.setValue("address", data.street);
      form.setValue("neighborhood", data.neighborhood);
      form.setValue("city", data.city);
      form.setValue("state", data.state);
    } catch (error) {
      // Silencioso
    } finally {
      setLoadingCep(false);
    }
  };

  // --- MUTAÇÕES (Salvar/Excluir) ---
  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        minOrderValue: masks.unmaskCurrency(data.minOrderValue || ""),
      };
      await apiRequest("POST", "/api/suppliers", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Sucesso", description: "Fornecedor cadastrado!" });
      handleCloseDialog();
    },
    onError: (err: Error) =>
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormValues }) => {
      const payload = {
        ...data,
        minOrderValue: masks.unmaskCurrency(data.minOrderValue || ""),
      };
      await apiRequest("PATCH", `/api/suppliers/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Atualizado", description: "Dados salvos com sucesso." });
      handleCloseDialog();
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
        description: `${selectedIds.length} removidos.`,
      });
      setSelectedIds([]);
    },
  });

  const onSubmit = (values: FormValues) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleOpenCreate = () => {
    form.reset({
      name: "",
      tradingName: "",
      cnpj: "",
      email: "",
      phone: "",
      contact: "",
      cep: "",
      address: "",
      addressNumber: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      paymentTerms: "",
      leadTime: 0,
      minOrderValue: "",
      notes: "",
    });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    form.reset({
      name: s.name,
      tradingName: s.tradingName || "",
      cnpj: s.cnpj || "",
      email: s.email || "",
      phone: s.phone || "",
      contact: s.contact || "",
      cep: s.cep || "",
      address: s.address || "",
      addressNumber: s.addressNumber || "",
      complement: s.complement || "",
      neighborhood: s.neighborhood || "",
      city: s.city || "",
      state: s.state || "",
      paymentTerms: s.paymentTerms || "",
      leadTime: s.leadTime || 0,
      minOrderValue: s.minOrderValue
        ? masks.currency(s.minOrderValue.replace(".", ""))
        : "",
      notes: s.notes || "",
    });
    setEditingId(s.id);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    form.reset();
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? filteredSuppliers.map((s) => s.id) : []);
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id),
    );
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
          className="bg-orange-500 hover:bg-orange-600 shadow-lg"
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
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg border animate-in fade-in slide-in-from-right-5">
                <span className="text-sm font-medium px-2">
                  {selectedIds.length} selecionados
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Excluir selecionados?"))
                      bulkDeleteMutation.mutate();
                  }}
                  disabled={bulkDeleteMutation.isPending}
                  className="text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
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
                      onCheckedChange={(c) => handleSelectAll(!!c)}
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
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-muted-foreground"
                    >
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      Nenhum fornecedor encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((s) => (
                    <TableRow
                      key={s.id}
                      className={`hover:bg-muted/40 transition-colors ${selectedIds.includes(s.id) ? "bg-primary/5" : ""}`}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedIds.includes(s.id)}
                          onCheckedChange={(c) => handleSelectOne(s.id, !!c)}
                        />
                      </TableCell>
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
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          {s.contact && (
                            <span className="flex items-center gap-1">
                              <Contact className="h-3 w-3" /> {s.contact}
                            </span>
                          )}
                          {s.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {s.phone}
                            </span>
                          )}
                          {s.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {s.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{" "}
                          {s.city && s.state ? `${s.city}/${s.state}` : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {s.leadTime ? (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-200"
                            >
                              {s.leadTime}d Entrega
                            </Badge>
                          ) : null}
                          {s.minOrderValue &&
                            parseFloat(s.minOrderValue) > 0 && (
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-green-700 border-green-200"
                              >
                                Min:{" "}
                                {parseFloat(s.minOrderValue).toLocaleString(
                                  "pt-BR",
                                  { style: "currency", currency: "BRL" },
                                )}
                              </Badge>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
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
                              onClick={() => {
                                if (confirm("Excluir?"))
                                  deleteMutation.mutate(s.id);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* DIALOG DE CADASTRO/EDIÇÃO */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="text-2xl flex items-center gap-2">
              {editingId ? (
                <Pencil className="h-5 w-5" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
              {editingId ? "Editar Fornecedor" : "Cadastrar Novo Fornecedor"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo. Campos com * são obrigatórios.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* DADOS EMPRESARIAIS */}
                <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Dados Empresariais
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                {...field}
                                maxLength={18}
                                placeholder="00.000.000/0001-00"
                                className="font-mono"
                                onChange={(e) =>
                                  field.onChange(masks.cnpj(e.target.value))
                                }
                              />
                            </FormControl>
                            <Button
                              type="button"
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Razão Social <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tradingName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Fantasia</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contato Principal</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* ENDEREÇO & CONTATO */}
                <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Endereço & Contato
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="col-span-1">
                      <FormField
                        control={form.control}
                        name="cep"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input
                                  {...field}
                                  maxLength={9}
                                  onChange={(e) =>
                                    field.onChange(masks.cep(e.target.value))
                                  }
                                  onBlur={fetchCep}
                                />
                              </FormControl>
                              {loadingCep && (
                                <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Endereço</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="addressNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="neighborhood"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <FormControl>
                            <Input {...field} maxLength={2} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                onChange={(e) =>
                                  field.onChange(masks.phone(e.target.value))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* CONDIÇÕES COMERCIAIS */}
                <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Condições Comerciais
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="leadTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lead Time (Dias)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="minOrderValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pedido Mínimo (R$)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onChange={(e) =>
                                field.onChange(masks.currency(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="paymentTerms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prazo Pagamento</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: 30/60/90" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <DialogFooter className="p-6 pt-4 border-t bg-background mt-auto">
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleCloseDialog}
                  className="h-12 px-6"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="bg-orange-500 hover:bg-orange-600 h-12 px-8 text-lg font-bold"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-5 w-5" /> Salvar Cadastro
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
