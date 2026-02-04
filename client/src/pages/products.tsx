import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Category, Product as SchemaProduct } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Calculator,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// --- TIPAGEM ---
interface ProductData {
  id: string;
  name: string;
  sku: string;
  category: string;
  categoryId: number | null;
  supplierId: number | null;
  brand: string;
  price: number;
  cost: number | null;
  stock: number;
  minStock: number | null; // Adicionado
  maxStock: number | null; // Adicionado
  description: string | null;
  image: string | null;
  images: string[] | null;
  featured: boolean;
  weight: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  unit: string | null;
  format: string | null;
}

// --- SCHEMA DE VALIDAÇÃO ---
const productSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  sku: z.string().min(1, "SKU é obrigatório"),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  brand: z.string().optional(),
  price: z.coerce.number().min(0, "Preço não pode ser negativo"),
  cost: z.coerce
    .number()
    .min(0, "Custo deve ser positivo")
    .optional()
    .or(z.literal("")),
  stock: z.coerce.number().int(), // Removido .min(0) para permitir estoque negativo
  minStock: z.coerce.number().int().min(0).optional().or(z.literal("")), // Novo
  maxStock: z.coerce.number().int().min(0).optional().or(z.literal("")), // Novo
  description: z.string().optional(),
  featured: z.boolean().default(false),
  unit: z.string().default("UN"),
  format: z.string().default("simple"),
  weight: z.coerce.number().min(0).optional().or(z.literal("")),
  width: z.coerce.number().min(0).optional().or(z.literal("")),
  height: z.coerce.number().min(0).optional().or(z.literal("")),
  depth: z.coerce.number().min(0).optional().or(z.literal("")),
  ncm: z.string().optional(),
  cest: z.string().optional(),
  taxOrigin: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

const PRODUCTS_PER_PAGE = 50;

export default function ProductsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const [editingProduct, setEditingProduct] = useState<ProductData | null>(
    null,
  );
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("dados");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const MAX_IMAGES = 5;

  // --- QUERIES ---
  const { data: productsResponse, isLoading } = useQuery<{
    products: SchemaProduct[];
    total: number;
  }>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products?limit=10000");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const productsData = Array.isArray(productsResponse)
    ? productsResponse
    : productsResponse?.products || [];

  const { data: categoriesData = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories?limit=1000");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: suppliersData = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const categoryMap: Record<number, string> = {};
  categoriesData.forEach((cat) => {
    categoryMap[cat.id] = cat.name;
  });

  const products: ProductData[] = productsData.map((p) => ({
    id: String(p.id),
    name: p.name,
    sku: p.sku,
    category: p.categoryId
      ? categoryMap[p.categoryId] || "Sem categoria"
      : "Sem categoria",
    categoryId: p.categoryId,
    supplierId: p.supplierId,
    brand: p.brand || "",
    price: parseFloat(p.price),
    cost: p.cost ? parseFloat(p.cost) : null,
    stock: p.stock ?? 0,
    minStock: p.minStock,
    maxStock: p.maxStock,
    description: p.description,
    image: p.image,
    images: p.images || null,
    featured: p.featured || false,
    weight: p.weight ? parseFloat(p.weight) : null,
    width: p.width ? parseFloat(p.width) : null,
    height: p.height ? parseFloat(p.height) : null,
    depth: p.depth ? parseFloat(p.depth) : null,
    unit: p.unit || "UN",
    format: p.format || "simple",
  }));

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      categoryId: "",
      supplierId: "",
      brand: "",
      price: 0,
      cost: "",
      stock: 0,
      minStock: "",
      maxStock: "",
      description: "",
      featured: false,
      unit: "UN",
      format: "simple",
      weight: "",
      width: "",
      height: "",
      depth: "",
      ncm: "",
      cest: "",
      taxOrigin: "",
    },
  });

  // --- LOGICA DE MONITORAMENTO (WATCH) ---
  const watchPrice = Number(form.watch("price")) || 0;
  const watchCost = Number(form.watch("cost")) || 0;
  const watchStock = Number(form.watch("stock")) || 0; // Para o alerta de estoque

  const profitValue = watchPrice - watchCost;
  const marginPercent = watchPrice > 0 ? (profitValue / watchPrice) * 100 : 0;

  const isProfit = profitValue > 0;
  const isLoss = profitValue < 0;
  const isZero = profitValue === 0;

  // --- FILTROS E PAGINAÇÃO ---
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !filterCategory || String(p.categoryId) === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + PRODUCTS_PER_PAGE,
  );

  // --- ACTIONS ---
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedProducts.length) setSelectedIds([]);
    else setSelectedIds(paginatedProducts.map((p) => p.id));
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id))
      setSelectedIds(selectedIds.filter((item) => item !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imageUrls.length >= MAX_IMAGES) {
      toast({
        title: "Limite atingido",
        description: `Máximo de ${MAX_IMAGES} imagens.`,
        variant: "destructive",
      });
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Falha no upload");
      const data = await res.json();
      setImageUrls((prev) => [...prev, data.url]);
      toast({ title: "Imagem enviada" });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao enviar imagem",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // --- MUTATIONS ---
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const payload = {
        ...data,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        supplierId: data.supplierId ? parseInt(data.supplierId) : null,
        price: data.price.toFixed(2),
        cost: typeof data.cost === "number" ? data.cost.toFixed(2) : null,
        minStock: typeof data.minStock === "number" ? data.minStock : null,
        maxStock: typeof data.maxStock === "number" ? data.maxStock : null,
        image: imageUrls[0] || null,
        images: imageUrls.length > 0 ? imageUrls : null,
      };
      await apiRequest("POST", "/api/products", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto criado com sucesso" });
      setViewMode("list");
    },
    onError: (err: Error) =>
      toast({
        title: "Erro ao criar",
        description: err.message,
        variant: "destructive",
      }),
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: ProductFormValues;
    }) => {
      const payload = {
        ...data,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        supplierId: data.supplierId ? parseInt(data.supplierId) : null,
        price: data.price.toFixed(2),
        cost: typeof data.cost === "number" ? data.cost.toFixed(2) : null,
        minStock: typeof data.minStock === "number" ? data.minStock : null,
        maxStock: typeof data.maxStock === "number" ? data.maxStock : null,
        image: imageUrls[0] || null,
        images: imageUrls.length > 0 ? imageUrls : null,
      };
      await apiRequest("PATCH", `/api/products/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto atualizado" });
      setViewMode("list");
    },
    onError: (err: Error) =>
      toast({
        title: "Erro ao atualizar",
        description: err.message,
        variant: "destructive",
      }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/products"] }),
  });

  const handleSubmit = (values: ProductFormValues) => {
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: values });
    } else {
      createProductMutation.mutate(values);
    }
  };

  const openAddForm = () => {
    form.reset({
      name: "",
      sku: "",
      categoryId: "",
      supplierId: "",
      brand: "",
      price: 0,
      cost: "",
      stock: 0,
      minStock: "",
      maxStock: "",
      description: "",
      featured: false,
      unit: "UN",
      format: "simple",
      weight: "",
      width: "",
      height: "",
      depth: "",
      ncm: "",
      cest: "",
      taxOrigin: "",
    });
    setEditingProduct(null);
    setImageUrls([]);
    setActiveTab("dados");
    setViewMode("form");
  };

  const openEditForm = (product: ProductData) => {
    const schemaProduct = productsData.find(
      (p) => p.id === parseInt(product.id),
    );
    form.reset({
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId ? String(product.categoryId) : "",
      supplierId: product.supplierId ? String(product.supplierId) : "",
      brand: product.brand,
      price: product.price,
      cost: product.cost ?? "",
      stock: product.stock,
      minStock: product.minStock ?? "",
      maxStock: product.maxStock ?? "",
      description: product.description || "",
      featured: product.featured,
      unit: product.unit || "UN",
      format: product.format || "simple",
      weight: product.weight ?? "",
      width: product.width ?? "",
      height: product.height ?? "",
      depth: product.depth ?? "",
      ncm: schemaProduct?.ncm || "",
      cest: schemaProduct?.cest || "",
      taxOrigin: schemaProduct?.origem || "",
    });
    setEditingProduct(product);
    setImageUrls(product.images || (product.image ? [product.image] : []));
    setActiveTab("dados");
    setViewMode("form");
  };

  const formatPrice = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);

  // --- FORM VIEW ---
  if (viewMode === "form") {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="border-b p-4 flex items-center justify-between bg-card">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Preencha os dados do produto
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setViewMode("list")}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={form.handleSubmit(handleSubmit)}
              disabled={
                createProductMutation.isPending ||
                updateProductMutation.isPending
              }
            >
              {createProductMutation.isPending ||
              updateProductMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Produto
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <Form {...form}>
            <form className="max-w-5xl mx-auto space-y-8">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-5 lg:w-[800px] bg-muted/50 p-1">
                  <TabsTrigger value="dados">Características</TabsTrigger>
                  <TabsTrigger value="precos">Preços</TabsTrigger>
                  <TabsTrigger value="imagens">Imagens</TabsTrigger>
                  <TabsTrigger value="estoque">Estoque</TabsTrigger>
                  <TabsTrigger value="tributacao">Tributação</TabsTrigger>
                </TabsList>

                {/* --- ABA 1: CARACTERÍSTICAS --- */}
                <TabsContent value="dados" className="space-y-6 mt-6">
                  {/* Alerta de Campos Obrigatórios */}
                  {(!form.watch("name") ||
                    !form.watch("sku") ||
                    !form.watch("price")) && (
                    <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-amber-900">
                          Campos obrigatórios faltando
                        </p>
                        <ul className="text-sm text-amber-800 mt-1 space-y-1">
                          {!form.watch("name") && <li>• Nome do Produto</li>}
                          {!form.watch("sku") && <li>• Código (SKU)</li>}
                          {!form.watch("price") && <li>• Preço de Venda</li>}
                        </ul>
                      </div>
                    </div>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle>Informações Básicas</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Nome do Produto{" "}
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Ex: Camiseta Básica Preta"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="sku"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Código (SKU)
                                <span className="text-red-500">*</span>
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
                          name="format"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Formato</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="simple">
                                    Simples
                                  </SelectItem>
                                  <SelectItem value="variation">
                                    Com Variação
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="unit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unidade</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="UN" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="UN">
                                    UN - Unidade
                                  </SelectItem>
                                  <SelectItem value="KG">
                                    KG - Quilograma
                                  </SelectItem>
                                  <SelectItem value="CX">CX - Caixa</SelectItem>
                                  <SelectItem value="KIT">KIT - Kit</SelectItem>
                                  <SelectItem value="MT">MT - Metro</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="categoryId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Categoria</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {categoriesData.map((cat) => (
                                    <SelectItem
                                      key={cat.id}
                                      value={String(cat.id)}
                                    >
                                      {cat.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="brand"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Marca</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Marca do produto"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Pesos e Dimensões</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="weight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Peso Líquido (kg)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.001" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="width"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Largura (cm)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="height"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Altura (cm)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="depth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Profundidade (cm)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* --- ABA 2: PREÇOS --- */}
                <TabsContent value="precos" className="space-y-6 mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Definição de Valores</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-base font-semibold text-blue-600">
                                  Preço de Venda
                                  <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground">
                                      R$
                                    </span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="pl-9 text-lg font-bold"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="cost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Preço de Custo</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground">
                                      R$
                                    </span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="pl-9"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormDescription>
                                  Valor de compra/produção
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Separator />
                        <FormField
                          control={form.control}
                          name="supplierId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fornecedor Padrão</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione um fornecedor" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {suppliersData.map((sup) => (
                                    <SelectItem
                                      key={sup.id}
                                      value={String(sup.id)}
                                    >
                                      {sup.name}
                                    </SelectItem>
                                  ))}
                                  {suppliersData.length === 0 && (
                                    <SelectItem value="none" disabled>
                                      Nenhum fornecedor cadastrado
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Usado para pedidos de compra automáticos.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>

                    <Card
                      className={`border-2 transition-all ${
                        isProfit
                          ? "border-green-200 bg-green-50/50"
                          : isLoss
                            ? "border-red-200 bg-red-50/50"
                            : "border-muted"
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Calculator className="h-5 w-5 text-muted-foreground" />
                          Análise de Lucratividade
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-center mt-2">
                          <div className="bg-background rounded-lg p-4 border shadow-sm">
                            <p className="text-sm text-muted-foreground mb-1">
                              Margem (%)
                            </p>
                            <div
                              className={`text-3xl font-bold flex items-center justify-center gap-1 ${
                                isProfit
                                  ? "text-green-600"
                                  : isLoss
                                    ? "text-red-600"
                                    : "text-gray-600"
                              }`}
                            >
                              {isProfit && <TrendingUp className="h-5 w-5" />}
                              {isLoss && <TrendingDown className="h-5 w-5" />}
                              {marginPercent.toFixed(1)}%
                            </div>
                          </div>
                          <div className="bg-background rounded-lg p-4 border shadow-sm">
                            <p className="text-sm text-muted-foreground mb-1">
                              Lucro Bruto (R$)
                            </p>
                            <div
                              className={`text-3xl font-bold ${
                                isProfit
                                  ? "text-green-600"
                                  : isLoss
                                    ? "text-red-600"
                                    : "text-gray-600"
                              }`}
                            >
                              {formatPrice(profitValue)}
                            </div>
                          </div>
                        </div>
                        {isLoss && (
                          <div className="mt-4 flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
                            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-red-900">
                                Aviso: Prejuízo
                              </p>
                              <p className="text-sm text-red-800 mt-1">
                                O preço de venda (R$ {watchPrice.toFixed(2)}) é
                                menor que o custo (R$ {watchCost.toFixed(2)}).
                              </p>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-center text-muted-foreground mt-4">
                          * Cálculo simples: Venda - Custo. Não considera
                          impostos e taxas.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* --- ABA 3: IMAGENS --- */}
                <TabsContent value="imagens" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Galeria do Produto</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {imageUrls.map((url, index) => (
                          <div
                            key={index}
                            className="relative group aspect-square rounded-lg border overflow-hidden"
                          >
                            <img
                              src={url}
                              alt={`Img ${index}`}
                              className="w-full h-full object-cover"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeImage(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            {index === 0 && (
                              <Badge className="absolute bottom-2 left-2 bg-yellow-500 hover:bg-yellow-600">
                                Capa
                              </Badge>
                            )}
                          </div>
                        ))}
                        {imageUrls.length < MAX_IMAGES && (
                          <label className="border-2 border-dashed rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                            {isUploading ? (
                              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                <span className="text-sm text-muted-foreground">
                                  Upload
                                </span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageUpload}
                              disabled={isUploading}
                            />
                          </label>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* --- ABA 4: ESTOQUE (ATUALIZADA) --- */}
                <TabsContent value="estoque" className="mt-6 space-y-6">
                  <Card
                    className={`transition-all ${watchStock < 0 ? "border-red-200 bg-red-50/20" : ""}`}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        Controle Físico
                        {watchStock < 0 && (
                          <div className="flex items-center gap-2 text-sm font-normal text-red-600 bg-red-100 px-3 py-1 rounded-full border border-red-200 animate-pulse">
                            <AlertCircle className="h-4 w-4" />
                            Estoque Negativo
                          </div>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="stock"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estoque Atual</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                className={`text-lg font-mono font-bold ${watchStock < 0 ? "text-red-600" : ""}`}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Quantidade física disponível no depósito.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PackageCheck className="h-5 w-5 text-muted-foreground" />
                        Planejamento de Reposição
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="minStock"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estoque Mínimo</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormDescription>
                              Nível de alerta para recompra.
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="maxStock"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estoque Máximo</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormDescription>
                              Limite ideal para evitar excesso.
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* --- ABA 5: TRIBUTAÇÃO --- */}
                <TabsContent value="tributacao" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Dados Fiscais</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="ncm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NCM</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="0000.00.00" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cest"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEST</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="taxOrigin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Origem</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="0">0 - Nacional</SelectItem>
                                <SelectItem value="1">
                                  1 - Estrangeira (Imp. Direta)
                                </SelectItem>
                                <SelectItem value="2">
                                  2 - Estrangeira (Adq. no mercado interno)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </form>
          </Form>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie seu catálogo de produtos
          </p>
        </div>
        <Button
          onClick={openAddForm}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Plus className="h-4 w-4 mr-2" /> Novo Produto
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[50px] text-center">
                    <Checkbox
                      checked={
                        selectedIds.length === paginatedProducts.length &&
                        paginatedProducts.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>Produto / SKU</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Estoque</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.map((product) => (
                  <TableRow
                    key={product.id}
                    className="hover:bg-muted/40 cursor-pointer"
                    onClick={() => openEditForm(product)}
                  >
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.includes(product.id)}
                        onCheckedChange={() => toggleSelect(product.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center border overflow-hidden">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {product.sku}
                      </div>
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(product.price)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          product.stock < (product.minStock || 5)
                            ? "text-red-500 border-red-200 bg-red-50"
                            : ""
                        }
                      >
                        {product.stock}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditForm(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() =>
                            deleteProductMutation.mutate(product.id)
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
