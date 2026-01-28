import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Supplier } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const supplierSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  tradingName: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  email: z
    .string()
    .email("Email inválido")
    .optional()
    .or(z.literal(""))
    .nullable(),
  phone: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  // NOVOS CAMPOS NO SCHEMA
  paymentTerms: z.string().optional().nullable(),
  minOrderValue: z.string().optional().nullable(),
  leadTime: z.coerce.number().optional().nullable(),
  bankInfo: z.string().optional().nullable(),
  // ----------------------
  cep: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

export default function SuppliersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      tradingName: "",
      cnpj: "",
      email: "",
      phone: "",
      contact: "",
      paymentTerms: "",
      minOrderValue: "0",
      leadTime: 0,
      bankInfo: "",
      cep: "",
      address: "",
      neighborhood: "",
      city: "",
      state: "",
      notes: "",
      active: true,
    },
  });

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const fetchCEPData = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cleanCep}/json/`,
      );
      const data = await response.json();
      if (!data.erro) {
        form.setValue("address", data.logradouro);
        form.setValue("neighborhood", data.bairro);
        form.setValue("city", data.localidade);
        form.setValue("state", data.uf);
        toast({ title: "Endereço encontrado" });
      }
    } catch (error) {
      console.error("Erro ao buscar CEP", error);
    }
  };

  const fetchCNPJData = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return;
    setCnpjLoading(true);
    try {
      const response = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`,
      );
      if (response.ok) {
        const data = await response.json();
        form.setValue("name", data.razao_social || "");
        form.setValue("tradingName", data.nome_fantasia || "");
        form.setValue("email", data.email || "");
        form.setValue("phone", data.ddd_telefone_1 || "");
        form.setValue("cep", data.cep || "");
        form.setValue("address", data.logradouro || "");
        form.setValue("neighborhood", data.bairro || "");
        form.setValue("city", data.municipio || "");
        form.setValue("state", data.uf || "");
        toast({ title: "Dados carregados via CNPJ" });
      }
    } catch (error) {
      toast({ title: "Erro ao buscar CNPJ", variant: "destructive" });
    } finally {
      setCnpjLoading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: SupplierFormValues) => {
      await apiRequest("POST", "/api/suppliers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Sucesso", description: "Fornecedor criado" });
      setIsDialogOpen(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: SupplierFormValues;
    }) => {
      await apiRequest("PATCH", `/api/suppliers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Sucesso", description: "Fornecedor atualizado" });
      setIsDialogOpen(false);
      setEditingSupplier(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Excluído com sucesso" });
    },
  });

  const onSubmit = (data: SupplierFormValues) => {
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.cnpj && s.cnpj.includes(searchQuery)),
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Fornecedores</h1>
          <p className="text-muted-foreground">
            Gerencie seus fornecedores e contatos estratégicos
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingSupplier(null);
                form.reset();
              }}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="h-4 w-4 mr-2" /> Novo Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados comerciais e financeiros.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Dados Básicos */}
                  <div className="space-y-4 col-span-2 border-b pb-4">
                    <h3 className="font-semibold text-orange-500">
                      Dados Cadastrais
                    </h3>
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
                                  placeholder="00.000.000/0000-00"
                                  onBlur={() =>
                                    fetchCNPJData(field.value || "")
                                  }
                                />
                              </FormControl>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={() => fetchCNPJData(field.value || "")}
                                disabled={cnpjLoading}
                              >
                                {cnpjLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Razão Social *</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Negociação e Financeiro */}
                  <div className="space-y-4 col-span-2 border-b pb-4">
                    <h3 className="font-semibold text-orange-500">
                      Negociação e Financeiro
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="paymentTerms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prazo de Pagamento</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: 30 dias" />
                            </FormControl>
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
                              <Input {...field} type="number" step="0.01" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="leadTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lead Time (Dias)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="bankInfo"
                        render={({ field }) => (
                          <FormItem className="col-span-3">
                            <FormLabel>Dados Bancários / PIX</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Banco, Agência, Conta ou Chave PIX"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Endereço */}
                  <div className="space-y-4 col-span-2">
                    <h3 className="font-semibold text-orange-500">Endereço</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="cep"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="00000-000"
                                onBlur={(e) => fetchCEPData(e.target.value)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Endereço</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                    className="bg-orange-500 w-full md:w-auto"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Salvar Fornecedor
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> Prazo
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Wallet className="h-4 w-4" /> Ped. Mínimo
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Truck className="h-4 w-4" /> Lead Time
                  </div>
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Nenhum fornecedor encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.cnpj || "Sem CNPJ"}
                      </div>
                    </TableCell>
                    <TableCell>{s.paymentTerms || "-"}</TableCell>
                    <TableCell>
                      {s.minOrderValue
                        ? `R$ ${Number(s.minOrderValue).toLocaleString("pt-BR")}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {s.leadTime ? `${s.leadTime} dias` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingSupplier(s);
                          form.reset(s);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Excluir?")) deleteMutation.mutate(s.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
