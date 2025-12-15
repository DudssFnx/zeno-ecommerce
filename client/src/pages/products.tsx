import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Pencil, Trash2, Loader2, Upload, Image, X, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product as SchemaProduct, Category } from "@shared/schema";

interface ProductData {
  id: string;
  name: string;
  sku: string;
  category: string;
  categoryId: number | null;
  brand: string;
  price: number;
  stock: number;
  description: string | null;
  image: string | null;
  images: string[] | null;
}

const productSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  sku: z.string().min(1, "SKU é obrigatório"),
  categoryId: z.string().optional(),
  brand: z.string().min(1, "Marca é obrigatória"),
  price: z.coerce.number().min(0, "Preço deve ser positivo"),
  stock: z.coerce.number().int().min(0, "Estoque deve ser 0 ou mais"),
  description: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function ProductsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductData | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_IMAGES = 5;

  const { data: productsResponse, isLoading } = useQuery<{ products: SchemaProduct[]; total: number }>({
    queryKey: ['/api/products'],
    queryFn: async () => {
      const res = await fetch('/api/products?limit=10000', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
  });
  
  const productsData = productsResponse?.products || [];

  const { data: categoriesResponse } = useQuery<{ categories: Category[]; total: number }>({
    queryKey: ['/api/categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories?limit=1000', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });
  
  const categoriesData = categoriesResponse?.categories || [];

  const categoryMap: Record<number, string> = {};
  categoriesData.forEach(cat => {
    categoryMap[cat.id] = cat.name;
  });

  const products: ProductData[] = productsData.map((p) => ({
    id: String(p.id),
    name: p.name,
    sku: p.sku,
    category: p.categoryId ? categoryMap[p.categoryId] || "Sem categoria" : "Sem categoria",
    categoryId: p.categoryId,
    brand: p.brand || "",
    price: parseFloat(p.price),
    stock: p.stock,
    description: p.description,
    image: p.image,
    images: p.images || null,
  }));

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      categoryId: "",
      brand: "",
      price: 0,
      stock: 0,
      description: "",
    },
  });

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleImageUpload = async (file: File) => {
    if (imageUrls.length >= MAX_IMAGES) {
      toast({ 
        title: "Limite atingido", 
        description: `Máximo de ${MAX_IMAGES} imagens por produto.`, 
        variant: "destructive" 
      });
      return;
    }
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha no upload');
      }
      
      const data = await response.json();
      setImageUrls(prev => [...prev, data.url]);
      toast({ title: "Imagem enviada", description: `Imagem ${imageUrls.length + 1} de ${MAX_IMAGES} enviada.` });
    } catch (error: any) {
      toast({ 
        title: "Erro no upload", 
        description: error.message || "Falha ao enviar imagem", 
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const payload = {
        name: data.name,
        sku: data.sku,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        brand: data.brand,
        price: data.price.toFixed(2),
        stock: data.stock,
        description: data.description || null,
        image: imageUrls[0] || null,
        images: imageUrls.length > 0 ? imageUrls : null,
      };
      await apiRequest("POST", "/api/products", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductFormValues }) => {
      const payload = {
        name: data.name,
        sku: data.sku,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        brand: data.brand,
        price: data.price.toFixed(2),
        stock: data.stock,
        description: data.description || null,
        image: imageUrls[0] || null,
        images: imageUrls.length > 0 ? imageUrls : null,
      };
      await apiRequest("PATCH", `/api/products/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    },
  });

  const openAddDialog = () => {
    form.reset({ name: "", sku: "", categoryId: "", brand: "", price: 0, stock: 0, description: "" });
    setEditingProduct(null);
    setImageUrls([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: ProductData) => {
    form.reset({
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId ? String(product.categoryId) : "",
      brand: product.brand,
      price: product.price,
      stock: product.stock,
      description: product.description || "",
    });
    setEditingProduct(product);
    const existingImages = product.images || (product.image ? [product.image] : []);
    setImageUrls(existingImages);
    setIsDialogOpen(true);
  };

  const openCloneDialog = (product: ProductData) => {
    const baseSku = product.sku.replace(/-\d+$/, '');
    const existingSkus = products.map(p => p.sku);
    let counter = 1;
    let newSku = `${baseSku}-${counter}`;
    while (existingSkus.includes(newSku)) {
      counter++;
      newSku = `${baseSku}-${counter}`;
    }
    form.reset({
      name: product.name + " (Cópia)",
      sku: newSku,
      categoryId: product.categoryId ? String(product.categoryId) : "",
      brand: product.brand,
      price: product.price,
      stock: product.stock,
      description: product.description || "",
    });
    setEditingProduct(null);
    const existingImages = product.images || (product.image ? [product.image] : []);
    setImageUrls(existingImages);
    setIsDialogOpen(true);
  };

  const handleSubmit = (values: ProductFormValues) => {
    if (editingProduct) {
      updateProductMutation.mutate(
        { id: editingProduct.id, data: values },
        {
          onSuccess: () => {
            toast({ title: "Produto Atualizado", description: `${values.name} foi atualizado.` });
            setIsDialogOpen(false);
          },
          onError: () => {
            toast({ title: "Erro", description: "Falha ao atualizar produto", variant: "destructive" });
          },
        }
      );
    } else {
      createProductMutation.mutate(values, {
        onSuccess: () => {
          toast({ title: "Produto Criado", description: `${values.name} foi adicionado.` });
          setIsDialogOpen(false);
        },
        onError: () => {
          toast({ title: "Erro", description: "Falha ao criar produto", variant: "destructive" });
        },
      });
    }
  };

  const handleDelete = (product: ProductData) => {
    deleteProductMutation.mutate(product.id, {
      onSuccess: () => {
        toast({ title: "Produto Excluído", description: `${product.name} foi removido.` });
      },
      onError: () => {
        toast({ title: "Erro", description: "Falha ao excluir produto", variant: "destructive" });
      },
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const isPending = createProductMutation.isPending || updateProductMutation.isPending;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Gerenciamento de Produtos</h1>
          <p className="text-muted-foreground mt-1">Adicione, edite e gerencie seu catálogo de produtos</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openAddDialog} data-testid="button-add-product">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Produto
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produtos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-products"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-16">Foto</TableHead>
                <TableHead className="font-semibold">SKU</TableHead>
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Categoria</TableHead>
                <TableHead className="font-semibold">Marca</TableHead>
                <TableHead className="font-semibold text-right">Preço</TableHead>
                <TableHead className="font-semibold text-right">Estoque</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Nenhum produto encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product, idx) => (
                  <TableRow 
                    key={product.id} 
                    className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}
                    data-testid={`row-product-${product.id}`}
                  >
                    <TableCell>
                      <div className="w-10 h-10 rounded bg-muted/50 flex items-center justify-center overflow-hidden">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Image className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.sku}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>{product.brand}</TableCell>
                    <TableCell className="text-right">{formatPrice(product.price)}</TableCell>
                    <TableCell className="text-right">
                      <span className={product.stock === 0 ? "text-destructive" : ""}>
                        {product.stock}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openCloneDialog(product)}
                          title="Duplicar produto"
                          data-testid={`button-clone-product-${product.id}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(product)}
                          data-testid={`button-edit-product-${product.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product)}
                          className="text-destructive"
                          disabled={deleteProductMutation.isPending}
                          data-testid={`button-delete-product-${product.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Adicionar Produto"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FormLabel>Imagens do Produto ({imageUrls.length}/{MAX_IMAGES})</FormLabel>
                  <div className="mt-2 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {imageUrls.map((url, index) => (
                        <div key={index} className="relative w-20 h-20 rounded-lg border overflow-hidden group">
                          <img 
                            src={url} 
                            alt={`Imagem ${index + 1}`} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden w-full h-full flex items-center justify-center bg-muted/50">
                            <Image className="h-5 w-5 text-muted-foreground/50" />
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(index)}
                            data-testid={`button-remove-image-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          {index === 0 && (
                            <Badge className="absolute bottom-1 left-1 text-xs px-1 py-0">Principal</Badge>
                          )}
                        </div>
                      ))}
                      {imageUrls.length < MAX_IMAGES && (
                        <div 
                          className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/30 cursor-pointer hover-elevate"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {isUploading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          ) : (
                            <Plus className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                        e.target.value = '';
                      }}
                      data-testid="input-product-image"
                    />
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP ou GIF. Máximo 5MB por imagem. A primeira imagem é a principal.</p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nome do Produto</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-product-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Descreva o produto..."
                          className="min-h-[80px]"
                          data-testid="input-product-description" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-product-sku" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product-category">
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoriesData.map((cat) => (
                            <SelectItem key={cat.id} value={String(cat.id)}>
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
                        <Input {...field} data-testid="input-product-brand" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-product-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Quantidade em Estoque</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-product-stock" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending || isUploading} data-testid="button-save-product">
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingProduct ? "Salvar Alterações" : "Adicionar Produto"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
