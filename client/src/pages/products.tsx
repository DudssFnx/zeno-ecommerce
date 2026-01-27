import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Category, Product as SchemaProduct } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Barcode,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Loader2,
  Package,
  Pencil,
  Plus,
  Ruler,
  Save,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface ProductData {
  id: string;
  name: string;
  sku: string;
  category: string;
  categoryId: number | null;
  brand: string;
  price: number;
  cost: number | null;
  stock: number;
  description: string | null;
  image: string | null;
  images: string[] | null;
  featured: boolean;
  weight: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
}

const productSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  sku: z.string().min(1, "SKU é obrigatório"),
  categoryId: z.string().optional(),
  brand: z.string().optional(),
  price: z.coerce.number().min(0, "Preço não pode ser negativo"),
  cost: z.coerce
    .number()
    .min(0, "Custo deve ser positivo")
    .optional()
    .or(z.literal("")),
  stock: z.coerce.number().int().min(0, "Estoque deve ser 0 ou mais"),
  description: z.string().optional(),
  featured: z.boolean().default(false),
  weight: z.coerce
    .number()
    .min(0, "Peso deve ser positivo")
    .optional()
    .or(z.literal("")),
  width: z.coerce
    .number()
    .min(0, "Largura deve ser positiva")
    .optional()
    .or(z.literal("")),
  height: z.coerce
    .number()
    .min(0, "Altura deve ser positiva")
    .optional()
    .or(z.literal("")),
  depth: z.coerce
    .number()
    .min(0, "Profundidade deve ser positiva")
    .optional()
    .or(z.literal("")),
  gtin: z.string().optional(),
  gtinTributario: z.string().optional(),
  ncm: z.string().optional(),
  cest: z.string().optional(),
  taxOrigin: z.string().optional(),
  icmsCst: z.string().optional(),
  icmsAliquota: z.coerce.number().min(0).optional().or(z.literal("")),
  ipiCst: z.string().optional(),
  ipiAliquota: z.coerce.number().min(0).optional().or(z.literal("")),
  pisCst: z.string().optional(),
  pisAliquota: z.coerce.number().min(0).optional().or(z.literal("")),
  cofinsCst: z.string().optional(),
  cofinsAliquota: z.coerce.number().min(0).optional().or(z.literal("")),
});

type ProductFormValues = z.infer<typeof productSchema>;

const PRODUCTS_PER_PAGE = 50;

const fieldLabels: Record<string, string> = {
  name: "Nome do Produto",
  sku: "Código (SKU)",
  price: "Preço de Venda",
  stock: "Estoque",
  cost: "Custo",
  weight: "Peso",
  width: "Largura",
  height: "Altura",
  depth: "Profundidade",
};

export default function ProductsPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterBrand, setFilterBrand] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const [editingProduct, setEditingProduct] = useState<ProductData | null>(
    null,
  );
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState("dados");
  const [brandPopoverOpen, setBrandPopoverOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");

  // States for Alert Dialog
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [pendingData, setPendingData] = useState<ProductFormValues | null>(
    null,
  );

  const MAX_IMAGES = 5;

  const { data: productsResponse, isLoading } = useQuery<{
    products: SchemaProduct[];
    total: number;
  }>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products?limit=10000", {
        credentials: "include",
      });
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
      const res = await fetch("/api/categories?limit=1000", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: brandsData = [] } = useQuery<string[]>({
    queryKey: ["/api/brands"],
    queryFn: async () => {
      const res = await fetch("/api/brands", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch brands");
      return res.json();
    },
  });

  const categoryMap: Record<number, string> = {};
  categoriesData.forEach((cat) => {
    categoryMap[cat.id] = cat.name;
  });

  // Mapeamento dos produtos para o formato local
  const products: ProductData[] = productsData.map((p) => ({
    id: String(p.id),
    name: p.name,
    sku: p.sku,
    category: p.categoryId
      ? categoryMap[p.categoryId] || "Sem categoria"
      : "Sem categoria",
    categoryId: p.categoryId,
    brand: p.brand || "",
    price: parseFloat(p.price),
    cost: p.cost ? parseFloat(p.cost) : null,
    // CORREÇÃO CRÍTICA: Garante que o estoque seja 0 se vier null/undefined do banco
    stock: p.stock ?? 0,
    description: p.description,
    image: p.image,
    images: p.images || null,
    featured: p.featured || false,
    weight: p.weight ? parseFloat(p.weight) : null,
    width: p.width ? parseFloat(p.width) : null,
    height: p.height ? parseFloat(p.height) : null,
    depth: p.depth ? parseFloat(p.depth) : null,
  }));

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      categoryId: "",
      brand: "",
      price: 0,
      cost: "",
      stock: 0,
      description: "",
      featured: false,
      weight: "",
      width: "",
      height: "",
      depth: "",
    },
  });

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !filterCategory || String(p.categoryId) === filterCategory;
    const matchesBrand =
      !filterBrand || p.brand.toLowerCase() === filterBrand.toLowerCase();
    return matchesSearch && matchesCategory && matchesBrand;
  });

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const endIndex = startIndex + PRODUCTS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleCategoryFilter = (value: string) => {
    setFilterCategory(value === "all" ? "" : value);
    setCurrentPage(1);
  };

  const handleBrandFilter = (value: string) => {
    setFilterBrand(value === "all" ? "" : value);
    setCurrentPage(1);
  };

  const handleImageUpload = async (file: File) => {
    if (imageUrls.length >= MAX_IMAGES) {
      toast({
        title: "Limite atingido",
        description: `Máximo de ${MAX_IMAGES} imagens por produto.`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Falha no upload");
      }

      const data = await response.json();
      setImageUrls((prev) => [...prev, data.url]);
      toast({ title: "Imagem enviada" });
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message || "Falha ao enviar imagem",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const payload = {
        name: data.name,
        sku: data.sku,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        brand: data.brand || null,
        price: data.price.toFixed(2),
        cost:
          data.cost && typeof data.cost === "number"
            ? data.cost.toFixed(2)
            : null,
        stock: data.stock,
        description: data.description || null,
        image: imageUrls[0] || null,
        images: imageUrls.length > 0 ? imageUrls : null,
        featured: data.featured,
        gtin: data.gtin || null,
        gtinTributario: data.gtinTributario || null,
        ncm: data.ncm || null,
        cest: data.cest || null,
        origem: data.taxOrigin || null,
        icmsCst: data.icmsCst || null,
        icmsAliquota:
          data.icmsAliquota && typeof data.icmsAliquota === "number"
            ? data.icmsAliquota.toFixed(2)
            : null,
        ipiCst: data.ipiCst || null,
        ipiAliquota:
          data.ipiAliquota && typeof data.ipiAliquota === "number"
            ? data.ipiAliquota.toFixed(2)
            : null,
        pisCst: data.pisCst || null,
        pisAliquota:
          data.pisAliquota && typeof data.pisAliquota === "number"
            ? data.pisAliquota.toFixed(2)
            : null,
        cofinsCst: data.cofinsCst || null,
        cofinsAliquota:
          data.cofinsAliquota && typeof data.cofinsAliquota === "number"
            ? data.cofinsAliquota.toFixed(2)
            : null,
      };
      await apiRequest("POST", "/api/products", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
    },
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
        name: data.name,
        sku: data.sku,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        brand: data.brand || null,
        price: data.price.toFixed(2),
        cost:
          data.cost && typeof data.cost === "number"
            ? data.cost.toFixed(2)
            : null,
        stock: data.stock,
        description: data.description || null,
        image: imageUrls[0] || null,
        images: imageUrls.length > 0 ? imageUrls : null,
        featured: data.featured,
        gtin: data.gtin || null,
        gtinTributario: data.gtinTributario || null,
        ncm: data.ncm || null,
        cest: data.cest || null,
        origem: data.taxOrigin || null,
        icmsCst: data.icmsCst || null,
        icmsAliquota:
          data.icmsAliquota && typeof data.icmsAliquota === "number"
            ? data.icmsAliquota.toFixed(2)
            : null,
        ipiCst: data.ipiCst || null,
        ipiAliquota:
          data.ipiAliquota && typeof data.ipiAliquota === "number"
            ? data.ipiAliquota.toFixed(2)
            : null,
        pisCst: data.pisCst || null,
        pisAliquota:
          data.pisAliquota && typeof data.pisAliquota === "number"
            ? data.pisAliquota.toFixed(2)
            : null,
        cofinsCst: data.cofinsCst || null,
        cofinsAliquota:
          data.cofinsAliquota && typeof data.cofinsAliquota === "number"
            ? data.cofinsAliquota.toFixed(2)
            : null,
      };
      await apiRequest("PATCH", `/api/products/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/products/${id}/toggle-featured`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  const handleToggleFeatured = (product: ProductData) => {
    toggleFeaturedMutation.mutate(product.id, {
      onSuccess: () => {
        toast({
          title: product.featured
            ? "Removido dos destaques"
            : "Adicionado aos destaques",
          description: product.name,
        });
      },
      onError: (error: Error) => {
        const desc = isAdmin
          ? `Falha ao alterar destaque: ${error.message}`
          : "Falha ao alterar destaque";
        toast({ title: "Erro", description: desc, variant: "destructive" });
      },
    });
  };

  const openAddForm = () => {
    form.reset({
      name: "",
      sku: "",
      categoryId: "",
      brand: "",
      price: 0,
      cost: "",
      stock: 0,
      description: "",
      featured: false,
      weight: "",
      width: "",
      height: "",
      depth: "",
      gtin: "",
      gtinTributario: "",
      ncm: "",
      cest: "",
      taxOrigin: "",
      icmsCst: "",
      icmsAliquota: "",
      ipiCst: "",
      ipiAliquota: "",
      pisCst: "",
      pisAliquota: "",
      cofinsCst: "",
      cofinsAliquota: "",
    });
    setEditingProduct(null);
    setImageUrls([]);
    setActiveFormTab("dados");
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
      brand: product.brand,
      price: product.price,
      cost: product.cost ?? "",
      stock: product.stock,
      description: product.description || "",
      featured: product.featured,
      weight: product.weight ?? "",
      width: product.width ?? "",
      height: product.height ?? "",
      depth: product.depth ?? "",
      gtin: schemaProduct?.gtin || "",
      gtinTributario: schemaProduct?.gtinTributario || "",
      ncm: schemaProduct?.ncm || "",
      cest: schemaProduct?.cest || "",
      taxOrigin: schemaProduct?.origem || "",
      icmsCst: schemaProduct?.icmsCst || "",
      icmsAliquota: schemaProduct?.icmsAliquota
        ? parseFloat(schemaProduct.icmsAliquota)
        : "",
      ipiCst: schemaProduct?.ipiCst || "",
      ipiAliquota: schemaProduct?.ipiAliquota
        ? parseFloat(schemaProduct.ipiAliquota)
        : "",
      pisCst: schemaProduct?.pisCst || "",
      pisAliquota: schemaProduct?.pisAliquota
        ? parseFloat(schemaProduct.pisAliquota)
        : "",
      cofinsCst: schemaProduct?.cofinsCst || "",
      cofinsAliquota: schemaProduct?.cofinsAliquota
        ? parseFloat(schemaProduct.cofinsAliquota)
        : "",
    });
    setEditingProduct(product);
    const existingImages =
      product.images || (product.image ? [product.image] : []);
    setImageUrls(existingImages);
    setActiveFormTab("dados");
    setViewMode("form");
  };

  const openCloneForm = (product: ProductData) => {
    const baseSku = product.sku.replace(/-\d+$/, "");
    const existingSkus = products.map((p) => p.sku);
    let counter = 1;
    let newSku = `${baseSku}-${counter}`;
    while (existingSkus.includes(newSku)) {
      counter++;
      newSku = `${baseSku}-${counter}`;
    }
    const schemaProductDup = productsData.find(
      (p) => p.id === parseInt(product.id),
    );
    form.reset({
      name: product.name + " (Cópia)",
      sku: newSku,
      categoryId: product.categoryId ? String(product.categoryId) : "",
      brand: product.brand,
      price: product.price,
      cost: product.cost ?? "",
      stock: product.stock,
      description: product.description || "",
      featured: false,
      weight: product.weight ?? "",
      width: product.width ?? "",
      height: product.height ?? "",
      depth: product.depth ?? "",
      gtin: "",
      gtinTributario: "",
      ncm: schemaProductDup?.ncm || "",
      cest: schemaProductDup?.cest || "",
      taxOrigin: schemaProductDup?.origem || "",
      icmsCst: schemaProductDup?.icmsCst || "",
      icmsAliquota: schemaProductDup?.icmsAliquota
        ? parseFloat(schemaProductDup.icmsAliquota)
        : "",
      ipiCst: schemaProductDup?.ipiCst || "",
      ipiAliquota: schemaProductDup?.ipiAliquota
        ? parseFloat(schemaProductDup.ipiAliquota)
        : "",
      pisCst: schemaProductDup?.pisCst || "",
      pisAliquota: schemaProductDup?.pisAliquota
        ? parseFloat(schemaProductDup.pisAliquota)
        : "",
      cofinsCst: schemaProductDup?.cofinsCst || "",
      cofinsAliquota: schemaProductDup?.cofinsAliquota
        ? parseFloat(schemaProductDup.cofinsAliquota)
        : "",
    });
    setEditingProduct(null);
    const existingImages =
      product.images || (product.image ? [product.image] : []);
    setImageUrls(existingImages);
    setActiveFormTab("dados");
    setViewMode("form");
  };

  const executeSubmit = (values: ProductFormValues) => {
    if (editingProduct) {
      updateProductMutation.mutate(
        { id: editingProduct.id, data: values },
        {
          onSuccess: () => {
            toast({ title: "Produto atualizado", description: values.name });
            setViewMode("list");
            setPendingData(null);
          },
          onError: (error: Error) => {
            const desc = isAdmin
              ? `Falha ao atualizar produto: ${error.message}`
              : "Falha ao atualizar produto";
            toast({ title: "Erro", description: desc, variant: "destructive" });
          },
        },
      );
    } else {
      createProductMutation.mutate(values, {
        onSuccess: () => {
          toast({ title: "Produto criado", description: values.name });
          setViewMode("list");
          setPendingData(null);
        },
        onError: (error: Error) => {
          const desc = isAdmin
            ? `Falha ao criar produto: ${error.message}`
            : "Falha ao criar produto";
          toast({ title: "Erro", description: desc, variant: "destructive" });
        },
      });
    }
  };

  const handleSubmit = (values: ProductFormValues) => {
    const isZeroStock = values.stock === 0;
    const isZeroPrice = values.price === 0;

    const costValue =
      typeof values.cost === "number" ? values.cost : Number(values.cost || 0);
    const isCostHigher = costValue > values.price;

    if (isZeroStock || isZeroPrice || isCostHigher) {
      const warnings = [];

      if (isZeroPrice) warnings.push("Preço R$ 0,00");
      if (isZeroStock) warnings.push("Estoque zerado");
      if (isCostHigher) warnings.push("Custo maior que o Preço de Venda");

      let msg = "";
      if (warnings.length === 1) {
        msg = `O produto possui ${warnings[0]}.`;
      } else {
        msg = `O produto possui: ${warnings.join(", ")}.`;
      }

      setAlertMessage(msg);
      setPendingData(values);
      setIsAlertOpen(true);
    } else {
      executeSubmit(values);
    }
  };

  const handleDelete = (product: ProductData) => {
    if (!window.confirm(`Excluir "${product.name}"?`)) return;
    deleteProductMutation.mutate(product.id, {
      onSuccess: () => {
        toast({ title: "Produto excluído", description: product.name });
      },
      onError: (error: Error) => {
        const desc = isAdmin
          ? `Falha ao excluir produto: ${error.message}`
          : "Falha ao excluir produto";
        toast({ title: "Erro", description: desc, variant: "destructive" });
      },
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getTabErrors = (tabName: string) => {
    const errors = form.formState.errors;
    switch (tabName) {
      case "dados":
        return (
          errors.name ||
          errors.sku ||
          errors.brand ||
          errors.categoryId ||
          errors.description
        );
      case "precos":
        return errors.price || errors.cost;
      case "estoque":
        return errors.stock;
      case "dimensoes":
        return errors.weight || errors.width || errors.height || errors.depth;
      case "fiscal":
        return (
          errors.ncm ||
          errors.cest ||
          errors.taxOrigin ||
          errors.icmsCst ||
          errors.icmsAliquota ||
          errors.ipiCst ||
          errors.ipiAliquota ||
          errors.pisCst ||
          errors.pisAliquota ||
          errors.cofinsCst ||
          errors.cofinsAliquota
        );
      default:
        return false;
    }
  };

  const isPending =
    createProductMutation.isPending || updateProductMutation.isPending;

  if (viewMode === "form") {
    const formErrors = Object.keys(form.formState.errors);

    return (
      <div className="h-full flex flex-col bg-background">
        <div className="border-b p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("list")}
              data-testid="button-back-products"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {editingProduct
                  ? `Editando: ${editingProduct.name}`
                  : "Preencha os dados do produto"}
              </p>
            </div>
            <Button
              onClick={form.handleSubmit(handleSubmit)}
              disabled={isPending}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="button-save-product"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-auto p-6">
            <Form {...form}>
              <form className="space-y-6 max-w-4xl">
                {formErrors.length > 0 && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro de Validação</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 mt-2">
                        {formErrors.map((key) => (
                          <li key={key}>
                            {fieldLabels[key] || key}:{" "}
                            {form.formState.errors[
                              key as keyof ProductFormValues
                            ]?.message?.toString()}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <Tabs value={activeFormTab} onValueChange={setActiveFormTab}>
                  <TabsList className="mb-4 flex flex-wrap h-auto">
                    {[
                      {
                        value: "dados",
                        icon: Package,
                        label: "Dados",
                      },
                      {
                        value: "precos",
                        icon: DollarSign,
                        label: "Preços",
                      },
                      {
                        value: "estoque",
                        icon: Boxes,
                        label: "Estoque",
                      },
                      {
                        value: "imagens",
                        icon: ImageIcon,
                        label: "Imagens",
                      },
                      {
                        value: "dimensoes",
                        icon: Ruler,
                        label: "Dimensões",
                      },
                      {
                        value: "fiscal",
                        icon: FileText,
                        label: "Fiscal",
                      },
                    ].map((tab) => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="gap-2 relative"
                      >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                        {getTabErrors(tab.value) && (
                          <AlertCircle className="h-3 w-3 text-red-500 absolute -top-1 -right-1 fill-white" />
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <TabsContent value="dados" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">
                          Informações Básicas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome do Produto *</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  placeholder="Ex: Camiseta Polo Masculina"
                                  data-testid="input-product-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="sku"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Código (SKU) *</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    placeholder="Ex: CAM-001"
                                    data-testid="input-product-sku"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="brand"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>Marca</FormLabel>
                                <Popover
                                  open={brandPopoverOpen}
                                  onOpenChange={setBrandPopoverOpen}
                                >
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={brandPopoverOpen}
                                        className="justify-between font-normal"
                                        data-testid="input-product-brand"
                                      >
                                        {field.value ||
                                          "Selecione ou crie uma marca"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-[300px] p-0"
                                    align="start"
                                  >
                                    <Command>
                                      <CommandInput
                                        placeholder="Buscar ou criar marca..."
                                        value={brandSearch}
                                        onValueChange={setBrandSearch}
                                      />
                                      <CommandList>
                                        <CommandEmpty>
                                          {brandSearch.trim() && (
                                            <div
                                              className="cursor-pointer p-2 hover-elevate rounded-md mx-1"
                                              onClick={() => {
                                                field.onChange(
                                                  brandSearch.trim(),
                                                );
                                                setBrandSearch("");
                                                setBrandPopoverOpen(false);
                                              }}
                                            >
                                              <div className="flex items-center gap-2">
                                                <Plus className="h-4 w-4" />
                                                <span>
                                                  Criar marca "
                                                  {brandSearch.trim()}"
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                        </CommandEmpty>
                                        <CommandGroup>
                                          {brandsData
                                            .filter((brand) =>
                                              brand
                                                .toLowerCase()
                                                .includes(
                                                  brandSearch.toLowerCase(),
                                                ),
                                            )
                                            .map((brand) => (
                                              <CommandItem
                                                key={brand}
                                                value={brand}
                                                onSelect={() => {
                                                  field.onChange(brand);
                                                  setBrandSearch("");
                                                  setBrandPopoverOpen(false);
                                                }}
                                              >
                                                <Check
                                                  className={`mr-2 h-4 w-4 ${
                                                    field.value === brand
                                                      ? "opacity-100"
                                                      : "opacity-0"
                                                  }`}
                                                />
                                                {brand}
                                              </CommandItem>
                                            ))}
                                          {brandSearch.trim() &&
                                            !brandsData.some(
                                              (b) =>
                                                b.toLowerCase() ===
                                                brandSearch
                                                  .trim()
                                                  .toLowerCase(),
                                            ) && (
                                              <CommandItem
                                                value={`create-${brandSearch}`}
                                                onSelect={() => {
                                                  field.onChange(
                                                    brandSearch.trim(),
                                                  );
                                                  setBrandSearch("");
                                                  setBrandPopoverOpen(false);
                                                }}
                                              >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Criar "{brandSearch.trim()}"
                                              </CommandItem>
                                            )}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                {field.value && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="w-fit h-6 px-2 text-xs text-muted-foreground"
                                    onClick={() => field.onChange("")}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Limpar marca
                                  </Button>
                                )}
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

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
                                  <SelectTrigger data-testid="select-product-category">
                                    <SelectValue placeholder="Selecione uma categoria" />
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
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Descrição</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  value={field.value ?? ""}
                                  placeholder="Descreva as características do produto..."
                                  className="min-h-[120px]"
                                  data-testid="input-product-description"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="featured"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel>Produto em Destaque</FormLabel>
                                <p className="text-sm text-muted-foreground">
                                  Exibir na seção de destaques do catálogo
                                </p>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-product-featured"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="precos" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">Valores</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Preço de Venda *</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                      R$
                                    </span>
                                    <Input
                                      {...field}
                                      value={field.value ?? ""}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="pl-10"
                                      data-testid="input-product-price"
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
                                <FormLabel>Custo</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                      R$
                                    </span>
                                    <Input
                                      {...field}
                                      value={field.value ?? ""}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="pl-10"
                                      placeholder="0.00"
                                      data-testid="input-product-cost"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {form.watch("price") > 0 &&
                          form.watch("cost") &&
                          typeof form.watch("cost") === "number" &&
                          (form.watch("cost") as number) > 0 && (
                            <div className="rounded-lg bg-muted/50 p-4">
                              <p className="text-sm text-muted-foreground">
                                Margem de Lucro
                              </p>
                              <p className="text-2xl font-bold text-green-600">
                                {(
                                  ((form.watch("price") -
                                    (form.watch("cost") as number)) /
                                    form.watch("price")) *
                                  100
                                ).toFixed(1)}
                                %
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Lucro:{" "}
                                {formatPrice(
                                  form.watch("price") -
                                    (form.watch("cost") as number),
                                )}
                              </p>
                            </div>
                          )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="estoque" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">
                          Controle de Estoque
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="stock"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantidade em Estoque</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  type="number"
                                  min="0"
                                  className="max-w-[200px]"
                                  data-testid="input-product-stock"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="imagens" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">
                          Imagens do Produto
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-5 gap-4">
                          {imageUrls.map((url, index) => (
                            <div
                              key={index}
                              className="relative aspect-square rounded-lg border-2 overflow-hidden bg-muted group"
                            >
                              <img
                                src={url}
                                alt={`Imagem ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeImage(index)}
                                data-testid={`button-remove-image-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              {index === 0 && (
                                <Badge className="absolute bottom-2 left-2 text-xs bg-orange-500">
                                  Principal
                                </Badge>
                              )}
                            </div>
                          ))}

                          {imageUrls.length < MAX_IMAGES && (
                            <label className="cursor-pointer aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-orange-500 hover:text-orange-500 transition-colors">
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="sr-only"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(file);
                                  e.target.value = "";
                                }}
                                data-testid="input-product-image"
                              />
                              {isUploading ? (
                                <Loader2 className="h-8 w-8 animate-spin" />
                              ) : (
                                <>
                                  <Upload className="h-8 w-8" />
                                  <span className="text-xs text-center">
                                    Adicionar
                                    <br />
                                    imagem
                                  </span>
                                </>
                              )}
                            </label>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Formatos: JPG, PNG, WebP, GIF. Máximo 5 imagens. A
                          primeira será a imagem principal.
                        </p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="dimensoes" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">
                          Medidas e Peso
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Informações para cálculo de frete e logística
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="weight"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Peso (kg)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  placeholder="Ex: 0.500"
                                  className="max-w-[200px]"
                                  data-testid="input-product-weight"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Separator />

                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="width"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Largura (cm)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Ex: 20"
                                    data-testid="input-product-width"
                                  />
                                </FormControl>
                                <FormMessage />
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
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Ex: 15"
                                    data-testid="input-product-height"
                                  />
                                </FormControl>
                                <FormMessage />
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
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Ex: 10"
                                    data-testid="input-product-depth"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="fiscal" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Barcode className="h-4 w-4" />
                          Códigos de Barras
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="gtin"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>GTIN/EAN</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    placeholder="Ex: 7891234567890"
                                    data-testid="input-product-gtin"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="gtinTributario"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>GTIN/EAN Tributário</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    placeholder="Ex: 7891234567890"
                                    data-testid="input-product-gtin-tributario"
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
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">
                          Classificação Fiscal
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="ncm"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>NCM</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    placeholder="Ex: 6109.10.00"
                                    data-testid="input-product-ncm"
                                  />
                                </FormControl>
                                <FormMessage />
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
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    placeholder="Ex: 28.038.00"
                                    data-testid="input-product-cest"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="taxOrigin"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Origem</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value || ""}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-product-tax-origin">
                                    <SelectValue placeholder="Selecione a origem" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="0">
                                    0 - Nacional
                                  </SelectItem>
                                  <SelectItem value="1">
                                    1 - Estrangeira - Importação direta
                                  </SelectItem>
                                  <SelectItem value="2">
                                    2 - Estrangeira - Adquirida no mercado
                                    interno
                                  </SelectItem>
                                  <SelectItem value="3">
                                    3 - Nacional - Mercadoria ou bem com
                                    conteúdo de importação superior a 40%
                                  </SelectItem>
                                  <SelectItem value="4">
                                    4 - Nacional - Produção em conformidade com
                                    PPB
                                  </SelectItem>
                                  <SelectItem value="5">
                                    5 - Nacional - Mercadoria ou bem com
                                    conteúdo de importação inferior ou igual a
                                    40%
                                  </SelectItem>
                                  <SelectItem value="6">
                                    6 - Estrangeira - Importação direta, sem
                                    similar nacional, constante em lista da
                                    CAMEX
                                  </SelectItem>
                                  <SelectItem value="7">
                                    7 - Estrangeira - Adquirida no mercado
                                    interno, sem similar nacional, constante em
                                    lista da CAMEX
                                  </SelectItem>
                                  <SelectItem value="8">
                                    8 - Nacional - Mercadoria ou bem com
                                    conteúdo de importação superior a 70%
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">ICMS</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="icmsCst"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CST ICMS</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value || ""}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="select-product-icms-cst">
                                      <SelectValue placeholder="Selecione CST" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="00">
                                      00 - Tributada integralmente
                                    </SelectItem>
                                    <SelectItem value="10">
                                      10 - Tributada com cobrança de ICMS por ST
                                    </SelectItem>
                                    <SelectItem value="20">
                                      20 - Com redução de base de cálculo
                                    </SelectItem>
                                    <SelectItem value="30">
                                      30 - Isenta ou não tributada com cobrança
                                      de ICMS por ST
                                    </SelectItem>
                                    <SelectItem value="40">
                                      40 - Isenta
                                    </SelectItem>
                                    <SelectItem value="41">
                                      41 - Não tributada
                                    </SelectItem>
                                    <SelectItem value="50">
                                      50 - Suspensão
                                    </SelectItem>
                                    <SelectItem value="51">
                                      51 - Diferimento
                                    </SelectItem>
                                    <SelectItem value="60">
                                      60 - ICMS cobrado anteriormente por ST
                                    </SelectItem>
                                    <SelectItem value="70">
                                      70 - Com redução de base de cálculo e
                                      cobrança de ICMS por ST
                                    </SelectItem>
                                    <SelectItem value="90">
                                      90 - Outras
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="icmsAliquota"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Alíquota ICMS (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Ex: 18"
                                    data-testid="input-product-icms-aliquota"
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
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">IPI</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="ipiCst"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CST IPI</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value || ""}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="select-product-ipi-cst">
                                      <SelectValue placeholder="Selecione CST" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="00">
                                      00 - Entrada com recuperação de crédito
                                    </SelectItem>
                                    <SelectItem value="01">
                                      01 - Entrada tributada com alíquota zero
                                    </SelectItem>
                                    <SelectItem value="02">
                                      02 - Entrada isenta
                                    </SelectItem>
                                    <SelectItem value="03">
                                      03 - Entrada não tributada
                                    </SelectItem>
                                    <SelectItem value="04">
                                      04 - Entrada imune
                                    </SelectItem>
                                    <SelectItem value="05">
                                      05 - Entrada com suspensão
                                    </SelectItem>
                                    <SelectItem value="49">
                                      49 - Outras entradas
                                    </SelectItem>
                                    <SelectItem value="50">
                                      50 - Saída tributada
                                    </SelectItem>
                                    <SelectItem value="51">
                                      51 - Saída tributada com alíquota zero
                                    </SelectItem>
                                    <SelectItem value="52">
                                      52 - Saída isenta
                                    </SelectItem>
                                    <SelectItem value="53">
                                      53 - Saída não tributada
                                    </SelectItem>
                                    <SelectItem value="54">
                                      54 - Saída imune
                                    </SelectItem>
                                    <SelectItem value="55">
                                      55 - Saída com suspensão
                                    </SelectItem>
                                    <SelectItem value="99">
                                      99 - Outras saídas
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="ipiAliquota"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Alíquota IPI (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Ex: 5"
                                    data-testid="input-product-ipi-aliquota"
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
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">PIS/COFINS</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="pisCst"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CST PIS</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value || ""}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="select-product-pis-cst">
                                      <SelectValue placeholder="Selecione CST" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="01">
                                      01 - Operação tributável com alíquota
                                      básica
                                    </SelectItem>
                                    <SelectItem value="02">
                                      02 - Operação tributável com alíquota
                                      diferenciada
                                    </SelectItem>
                                    <SelectItem value="03">
                                      03 - Operação tributável com alíquota por
                                      unidade de medida de produto
                                    </SelectItem>
                                    <SelectItem value="04">
                                      04 - Operação tributável monofásica -
                                      revenda a alíquota zero
                                    </SelectItem>
                                    <SelectItem value="05">
                                      05 - Operação tributável por ST
                                    </SelectItem>
                                    <SelectItem value="06">
                                      06 - Operação tributável a alíquota zero
                                    </SelectItem>
                                    <SelectItem value="07">
                                      07 - Operação isenta da contribuição
                                    </SelectItem>
                                    <SelectItem value="08">
                                      08 - Operação sem incidência da
                                      contribuição
                                    </SelectItem>
                                    <SelectItem value="09">
                                      09 - Operação com suspensão da
                                      contribuição
                                    </SelectItem>
                                    <SelectItem value="49">
                                      49 - Outras operações de saída
                                    </SelectItem>
                                    <SelectItem value="99">
                                      99 - Outras operações
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="pisAliquota"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Alíquota PIS (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Ex: 1.65"
                                    data-testid="input-product-pis-aliquota"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="cofinsCst"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CST COFINS</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value || ""}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="select-product-cofins-cst">
                                      <SelectValue placeholder="Selecione CST" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="01">
                                      01 - Operação tributável com alíquota
                                      básica
                                    </SelectItem>
                                    <SelectItem value="02">
                                      02 - Operação tributável com alíquota
                                      diferenciada
                                    </SelectItem>
                                    <SelectItem value="03">
                                      03 - Operação tributável com alíquota por
                                      unidade de medida de produto
                                    </SelectItem>
                                    <SelectItem value="04">
                                      04 - Operação tributável monofásica -
                                      revenda a alíquota zero
                                    </SelectItem>
                                    <SelectItem value="05">
                                      05 - Operação tributável por ST
                                    </SelectItem>
                                    <SelectItem value="06">
                                      06 - Operação tributável a alíquota zero
                                    </SelectItem>
                                    <SelectItem value="07">
                                      07 - Operação isenta da contribuição
                                    </SelectItem>
                                    <SelectItem value="08">
                                      08 - Operação sem incidência da
                                      contribuição
                                    </SelectItem>
                                    <SelectItem value="09">
                                      09 - Operação com suspensão da
                                      contribuição
                                    </SelectItem>
                                    <SelectItem value="49">
                                      49 - Outras operações de saída
                                    </SelectItem>
                                    <SelectItem value="99">
                                      99 - Outras operações
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="cofinsAliquota"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Alíquota COFINS (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Ex: 7.6"
                                    data-testid="input-product-cofins-aliquota"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </form>
            </Form>
          </div>

          <div className="w-80 border-l bg-muted/30 p-4 hidden lg:block">
            <h3 className="font-semibold mb-4">Preview</h3>
            <Card>
              <CardContent className="p-3">
                <div className="aspect-square rounded-md bg-muted mb-3 flex items-center justify-center overflow-hidden">
                  {imageUrls[0] ? (
                    <img
                      src={imageUrls[0]}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <h4 className="font-medium text-sm truncate">
                  {form.watch("name") || "Nome do produto"}
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {form.watch("sku") || "SKU"}
                </p>
                <p className="font-bold text-orange-500 mt-2">
                  {formatPrice(form.watch("price") || 0)}
                </p>
                {form.watch("featured") && (
                  <Badge className="mt-2 bg-yellow-500/20 text-yellow-600">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    Destaque
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* --- CONFIRMATION DIALOG (NEW) --- */}
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmação de Dados</AlertDialogTitle>
              <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
              <AlertDialogDescription>
                Tem certeza que deseja salvar mesmo assim?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingData) {
                    executeSubmit(pendingData);
                  }
                  setIsAlertOpen(false);
                }}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* ---------------------------------- */}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie seu catálogo de produtos
          </p>
        </div>
        <Button
          onClick={openAddForm}
          className="bg-orange-500 hover:bg-orange-600"
          data-testid="button-add-product"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
            data-testid="input-search-products"
          />
        </div>
        <Select
          value={filterCategory || "all"}
          onValueChange={handleCategoryFilter}
        >
          <SelectTrigger className="w-[180px]" data-testid="filter-category">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {categoriesData.map((cat) => (
              <SelectItem key={cat.id} value={String(cat.id)}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBrand || "all"} onValueChange={handleBrandFilter}>
          <SelectTrigger className="w-[180px]" data-testid="filter-brand">
            <SelectValue placeholder="Marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Marcas</SelectItem>
            {brandsData.map((brand) => (
              <SelectItem key={brand} value={brand}>
                {brand}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {filteredProducts.length} produto(s)
          {totalPages > 1 && ` - Página ${currentPage} de ${totalPages}`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery
                ? "Tente buscar por outro termo"
                : "Adicione seu primeiro produto"}
            </p>
            {!searchQuery && (
              <Button
                onClick={openAddForm}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Produto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16"></TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.map((product) => (
                <TableRow
                  key={product.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => openEditForm(product)}
                  data-testid={`row-product-${product.id}`}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{product.sku}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{product.name}</span>
                      {product.featured && (
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.category}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(product.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        product.stock === 0
                          ? "text-destructive font-medium"
                          : ""
                      }
                    >
                      {/* Correção visual para garantir que o 0 apareça */}
                      {product.stock ?? 0}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleFeatured(product)}
                        title={
                          product.featured
                            ? "Remover destaque"
                            : "Adicionar destaque"
                        }
                        data-testid={`button-featured-${product.id}`}
                      >
                        <Star
                          className={`h-4 w-4 ${product.featured ? "fill-yellow-500 text-yellow-500" : ""}`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openCloneForm(product)}
                        title="Duplicar"
                        data-testid={`button-clone-${product.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditForm(product)}
                        data-testid={`button-edit-${product.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(product)}
                        className="text-destructive"
                        data-testid={`button-delete-${product.id}`}
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
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1}-
            {Math.min(endIndex, filteredProducts.length)} de{" "}
            {filteredProducts.length} produtos
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="icon"
                    onClick={() => setCurrentPage(pageNum)}
                    data-testid={`button-page-${pageNum}`}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              data-testid="button-next-page"
            >
              Próxima
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
