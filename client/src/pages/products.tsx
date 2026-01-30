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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Category, Product as SchemaProduct } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Image as ImageIcon,
  Loader2,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  XSquare,
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

  // ✅ Estado para Seleção em Massa
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  // ✅ Lógica de Seleção em Massa
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedProducts.map((p) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

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

  // ✅ Mutation para exclusão em massa
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Deletar um por um
      await Promise.all(
        ids.map((id) => apiRequest("DELETE", `/api/products/${id}`)),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedIds([]); // Limpar seleção
      toast({ title: "Produtos excluídos com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir produtos", variant: "destructive" });
    },
  });

  // ✅ Mutation para destacar em massa (NOVO)
  const bulkToggleFeaturedMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Alternar destaque um por um
      await Promise.all(
        ids.map((id) =>
          apiRequest("PATCH", `/api/products/${id}/toggle-featured`),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedIds([]); // Limpar seleção
      toast({ title: "Destaques atualizados com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar destaques", variant: "destructive" });
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

  // ✅ Lógica de cálculo de margem para o form
  const watchPrice = form.watch("price") || 0;
  const watchCostRaw = form.watch("cost");
  const watchCost =
    typeof watchCostRaw === "number" ? watchCostRaw : Number(watchCostRaw || 0);

  const profitValue = watchPrice - watchCost;
  const marginPercentage =
    watchPrice > 0 ? (profitValue / watchPrice) * 100 : 0;

  // Definição de cores da margem
  let marginColorClass = "text-muted-foreground";
  let MarginIcon = AlertCircle;

  if (watchPrice > 0) {
    if (marginPercentage < 0) {
      marginColorClass = "text-red-600";
      MarginIcon = TrendingDown;
    } else if (marginPercentage < 20) {
      marginColorClass = "text-amber-600";
      MarginIcon = TrendingUp;
    } else {
      marginColorClass = "text-emerald-600";
      MarginIcon = TrendingUp;
    }
  }

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

        {/* ... (CONTEÚDO DO FORMULÁRIO MANTIDO IGUAL - É ÓTIMO) ... */}
        {/* Vou omitir o meio do código do formulário pois ele já está perfeito na sua versão. */}
        {/* Se precisar dele completo de novo, me avise, mas vou focar em entregar a TABELA atualizada abaixo. */}
        {/* Para usar, basta manter todo o bloco "if (viewMode === 'form')" do seu código original. */}

        {/* ... */}

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

      {/* ✅ BARRA DE FILTROS E AÇÕES */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 justify-between flex-wrap">
            <div className="flex gap-2 flex-1 min-w-[300px]">
              <div className="relative flex-1">
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
                <SelectTrigger
                  className="w-[160px]"
                  data-testid="filter-category"
                >
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
            </div>

            {/* ✅ BARRA DE AÇÕES EM MASSA PADRONIZADA */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg border animate-in fade-in slide-in-from-right-5">
                <span className="text-sm font-medium px-2">
                  {selectedIds.length} selecionados
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                  onClick={() => bulkToggleFeaturedMutation.mutate(selectedIds)}
                >
                  <Star className="h-3.5 w-3.5 mr-2 fill-yellow-500" />
                  Destacar
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Tem certeza que deseja excluir ${selectedIds.length} produtos?`,
                      )
                    ) {
                      bulkDeleteMutation.mutate(selectedIds);
                    }
                  }}
                  className="text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <h3 className="font-semibold mb-2">Nenhum produto encontrado</h3>
              <p className="text-sm">
                Tente buscar por outro termo ou adicione um novo.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={
                          selectedIds.length === paginatedProducts.length &&
                          paginatedProducts.length > 0
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="w-16"></TableHead>
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
                      className={`hover:bg-muted/40 transition-colors cursor-pointer ${selectedIds.includes(product.id) ? "bg-primary/5" : ""}`}
                      onClick={() => openEditForm(product)}
                      data-testid={`row-product-${product.id}`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(product.id)}
                          onCheckedChange={() => toggleSelect(product.id)}
                          aria-label={`Select ${product.name}`}
                        />
                      </TableCell>

                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center overflow-hidden border">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground/90">
                              {product.name}
                            </span>
                            {product.featured && (
                              <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">
                            {product.sku}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground text-sm">
                        {product.category}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold">
                            {formatPrice(product.price)}
                          </span>
                          {product.cost && product.cost > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              Custo: {formatPrice(product.cost)}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={`font-mono ${product.stock < 10 ? "text-red-600 bg-red-50" : "text-foreground"}`}
                        >
                          {product.stock}
                        </Badge>
                      </TableCell>

                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openEditForm(product)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openCloneForm(product)}
                            title="Duplicar"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground mx-2">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Próxima <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
