import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Package, Grid3X3, Box, Zap, Wrench, Coffee, Heart, Star, Bookmark, Layers, ShoppingBag, ChevronRight, ChevronDown, FolderTree, Plus, Edit, Trash2, EyeOff } from "lucide-react";
import type { Category, Product } from "@shared/schema";

const categoryIcons: Record<string, typeof Package> = {
  eletronicos: Zap,
  ferramentas: Wrench,
  bebidas: Coffee,
  saude: Heart,
  destaques: Star,
  favoritos: Bookmark,
  diversos: Layers,
  default: Box,
};

const categoryColors: Record<string, string> = {
  eletronicos: "from-blue-500/20 to-blue-600/10",
  ferramentas: "from-orange-500/20 to-orange-600/10",
  bebidas: "from-amber-500/20 to-amber-600/10",
  saude: "from-rose-500/20 to-rose-600/10",
  destaques: "from-yellow-500/20 to-yellow-600/10",
  favoritos: "from-purple-500/20 to-purple-600/10",
  diversos: "from-emerald-500/20 to-emerald-600/10",
  default: "from-primary/20 to-primary/10",
};

const categoryIconColors: Record<string, string> = {
  eletronicos: "text-blue-500",
  ferramentas: "text-orange-500",
  bebidas: "text-amber-600",
  saude: "text-rose-500",
  destaques: "text-yellow-500",
  favoritos: "text-purple-500",
  diversos: "text-emerald-500",
  default: "text-primary",
};

function getCategoryIcon(slug: string) {
  const normalizedSlug = slug.toLowerCase().replace(/[^a-z]/g, '');
  return categoryIcons[normalizedSlug] || categoryIcons.default;
}

function getCategoryColor(slug: string) {
  const normalizedSlug = slug.toLowerCase().replace(/[^a-z]/g, '');
  return categoryColors[normalizedSlug] || categoryColors.default;
}

function getCategoryIconColor(slug: string) {
  const normalizedSlug = slug.toLowerCase().replace(/[^a-z]/g, '');
  return categoryIconColors[normalizedSlug] || categoryIconColors.default;
}

interface CategoryWithHierarchy extends Category {
  productCount: number;
  children: CategoryWithHierarchy[];
  parentName?: string;
  fullPath: string;
}

function buildCategoryTree(
  categories: Category[],
  countMap: Record<number, number>
): CategoryWithHierarchy[] {
  const categoryMap = new Map<number, CategoryWithHierarchy>();
  
  categories.forEach((cat) => {
    categoryMap.set(cat.id, {
      ...cat,
      productCount: countMap[cat.id] || 0,
      children: [],
      fullPath: cat.name,
    });
  });

  const rootCategories: CategoryWithHierarchy[] = [];

  categories.forEach((cat) => {
    const catWithHierarchy = categoryMap.get(cat.id)!;
    
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      const parent = categoryMap.get(cat.parentId)!;
      catWithHierarchy.parentName = parent.name;
      catWithHierarchy.fullPath = `${parent.fullPath} > ${cat.name}`;
      parent.children.push(catWithHierarchy);
    } else {
      rootCategories.push(catWithHierarchy);
    }
  });

  return rootCategories;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface CategoryDialogProps {
  category?: Category | null;
  allCategories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function CategoryDialog({ category, allCategories, open, onOpenChange, onSuccess }: CategoryDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(category?.name || "");
  const [slug, setSlug] = useState(category?.slug || "");
  const [parentId, setParentId] = useState<string>(category?.parentId?.toString() || "none");
  const [hideFromVarejo, setHideFromVarejo] = useState(category?.hideFromVarejo || false);
  const [autoSlug, setAutoSlug] = useState(!category);

  const isEdit = !!category;

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string; parentId: number | null; hideFromVarejo: boolean }) => {
      return apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "Categoria criada com sucesso" });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar categoria", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string; parentId: number | null; hideFromVarejo: boolean }) => {
      return apiRequest(`/api/categories/${category!.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "Categoria atualizada com sucesso" });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar categoria", description: error.message, variant: "destructive" });
    },
  });

  const handleNameChange = (value: string) => {
    setName(value);
    if (autoSlug) {
      setSlug(slugify(value));
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || !slug.trim()) {
      toast({ title: "Preencha nome e slug", variant: "destructive" });
      return;
    }

    const data = {
      name: name.trim(),
      slug: slug.trim(),
      parentId: parentId === "none" ? null : parseInt(parentId),
      hideFromVarejo,
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const availableParents = allCategories.filter(c => 
    !category || (c.id !== category.id && c.parentId !== category.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Nome da categoria"
              data-testid="input-category-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL)</Label>
            <div className="flex gap-2">
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setAutoSlug(false);
                }}
                placeholder="slug-da-categoria"
                data-testid="input-category-slug"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent">Categoria Pai (opcional)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger data-testid="select-category-parent">
                <SelectValue placeholder="Selecione a categoria pai" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma (categoria principal)</SelectItem>
                {availableParents.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="hideFromVarejo">Ocultar do Varejo</Label>
              <p className="text-xs text-muted-foreground">
                Categoria visivel apenas para atacado
              </p>
            </div>
            <Switch
              id="hideFromVarejo"
              checked={hideFromVarejo}
              onCheckedChange={setHideFromVarejo}
              data-testid="switch-hide-varejo"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" data-testid="button-cancel-category">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-category">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteDialogProps {
  category: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function DeleteCategoryDialog({ category, open, onOpenChange, onSuccess }: DeleteDialogProps) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/categories/${category.id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "Categoria excluida com sucesso" });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir categoria", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir Categoria</DialogTitle>
        </DialogHeader>
        <p className="py-4">
          Tem certeza que deseja excluir a categoria <strong>{category.name}</strong>?
          Esta acao nao pode ser desfeita.
        </p>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" data-testid="button-cancel-delete">Cancelar</Button>
          </DialogClose>
          <Button 
            variant="destructive" 
            onClick={() => deleteMutation.mutate()} 
            disabled={deleteMutation.isPending}
            data-testid="button-confirm-delete"
          >
            {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryCard({ 
  category, 
  depth = 0,
  expandedCategories,
  toggleExpanded,
  isAdmin,
  onEdit,
  onDelete,
  onToggleVarejo,
  isTogglingVarejo,
}: { 
  category: CategoryWithHierarchy; 
  depth?: number;
  expandedCategories: Set<number>;
  toggleExpanded: (id: number) => void;
  isAdmin: boolean;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onToggleVarejo: (cat: Category) => void;
  isTogglingVarejo: boolean;
}) {
  const Icon = getCategoryIcon(category.slug);
  const bgGradient = getCategoryColor(category.slug);
  const iconColor = getCategoryIconColor(category.slug);
  const hasChildren = category.children.length > 0;
  const isExpanded = expandedCategories.has(category.id);
  const isSubcategory = depth > 0;

  return (
    <div className={isSubcategory ? "ml-6 border-l-2 border-muted pl-4" : ""}>
      <div className="flex items-start gap-2">
        {hasChildren && (
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 mt-2"
            onClick={(e) => {
              e.preventDefault();
              toggleExpanded(category.id);
            }}
            data-testid={`button-toggle-category-${category.id}`}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}
        <div className={`flex-1 ${!hasChildren ? (isSubcategory ? "" : "ml-11") : ""}`}>
          <Card className="group overflow-visible hover-elevate active-elevate-2 transition-all duration-200">
            <CardContent className="p-0">
              <Link 
                href={`/catalog?category=${encodeURIComponent(category.name)}`}
                data-testid={`card-category-${category.id}`}
              >
                <div className={`relative ${isSubcategory ? "h-20" : "h-32"} bg-gradient-to-br ${bgGradient} rounded-t-lg overflow-hidden`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className={`${isSubcategory ? "h-10 w-10" : "h-16 w-16"} ${iconColor} opacity-80 group-hover:scale-110 transition-transform duration-300`} />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/20 to-transparent" />
                  {category.hideFromVarejo && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-xs gap-1">
                        <EyeOff className="h-3 w-3" />
                        Atacado
                      </Badge>
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <Link 
                    href={`/catalog?category=${encodeURIComponent(category.name)}`}
                    className="min-w-0 flex-1"
                  >
                    {isSubcategory && category.parentName && (
                      <p className="text-xs text-muted-foreground truncate">{category.parentName}</p>
                    )}
                    <h3 className="font-semibold text-base truncate">{category.name}</h3>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasChildren && (
                      <Badge variant="outline" className="text-xs">
                        {category.children.length} sub
                      </Badge>
                    )}
                    <Badge variant="secondary">
                      {category.productCount}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    {category.productCount === 0 
                      ? "Nenhum produto" 
                      : category.productCount === 1 
                        ? "1 produto disponivel" 
                        : `${category.productCount} produtos disponiveis`}
                  </p>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`h-7 w-7 ${category.hideFromVarejo ? 'text-orange-500' : 'text-muted-foreground'}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleVarejo(category);
                        }}
                        disabled={isTogglingVarejo}
                        title={category.hideFromVarejo ? "Mostrar para Varejo" : "Ocultar do Varejo"}
                        data-testid={`button-toggle-varejo-${category.id}`}
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onEdit(category);
                        }}
                        data-testid={`button-edit-category-${category.id}`}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDelete(category);
                        }}
                        data-testid={`button-delete-category-${category.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2">
          {category.children.map((child) => (
            <CategoryCard 
              key={child.id} 
              category={child} 
              depth={depth + 1}
              expandedCategories={expandedCategories}
              toggleExpanded={toggleExpanded}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleVarejo={onToggleVarejo}
              isTogglingVarejo={isTogglingVarejo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const { user, isAdmin } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"hierarchy" | "flat">("hierarchy");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const isVarejo = user?.customerType === "varejo";

  const { data: categoriesData = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const { data: productsResponse, isLoading: productsLoading } = useQuery<{ products: Product[]; total: number }>({
    queryKey: ['/api/products', { limit: 10000 }],
  });
  
  const productsData = productsResponse?.products || [];

  const filteredCategories = useMemo(() => {
    if (isAdmin || !isVarejo) {
      return categoriesData;
    }
    return categoriesData.filter(cat => !cat.hideFromVarejo);
  }, [categoriesData, isAdmin, isVarejo]);

  const countMap = useMemo(() => {
    const map: Record<number, number> = {};
    productsData.forEach((p) => {
      if (p.categoryId) {
        map[p.categoryId] = (map[p.categoryId] || 0) + 1;
      }
    });
    return map;
  }, [productsData]);

  const categoryTree = useMemo(() => {
    return buildCategoryTree(filteredCategories, countMap);
  }, [filteredCategories, countMap]);

  const flatCategories = useMemo(() => {
    return filteredCategories.map((cat) => {
      const parent = cat.parentId ? filteredCategories.find(c => c.id === cat.parentId) : null;
      return {
        ...cat,
        productCount: countMap[cat.id] || 0,
        children: [],
        parentName: parent?.name,
        fullPath: parent ? `${parent.name} > ${cat.name}` : cat.name,
      } as CategoryWithHierarchy;
    });
  }, [filteredCategories, countMap]);

  const toggleExpanded = (id: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set(filteredCategories.filter(c => 
      filteredCategories.some(child => child.parentId === c.id)
    ).map(c => c.id));
    setExpandedCategories(allIds);
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setDialogOpen(true);
  };

  const handleDelete = (category: Category) => {
    setDeletingCategory(category);
  };

  const handleCreateNew = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  const { toast } = useToast();

  const toggleVarejoMutation = useMutation({
    mutationFn: async (category: Category) => {
      return apiRequest(`/api/categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ hideFromVarejo: !category.hideFromVarejo }),
      });
    },
    onSuccess: (_, category) => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ 
        title: category.hideFromVarejo 
          ? "Categoria visivel para varejo" 
          : "Categoria oculta do varejo" 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar categoria", description: error.message, variant: "destructive" });
    },
  });

  const handleToggleVarejo = (category: Category) => {
    toggleVarejoMutation.mutate(category);
  };

  const rootCategoriesCount = categoryTree.length;
  const subcategoriesCount = filteredCategories.length - rootCategoriesCount;
  const totalProducts = productsData.length;
  const isLoading = categoriesLoading || productsLoading;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Categorias</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rootCategoriesCount} categorias principais, {subcategoriesCount} subcategorias, {totalProducts} produtos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button onClick={handleCreateNew} data-testid="button-create-category">
              <Plus className="h-4 w-4 mr-1" />
              Nova Categoria
            </Button>
          )}
          <Button
            variant={viewMode === "hierarchy" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("hierarchy")}
            data-testid="button-view-hierarchy"
          >
            <FolderTree className="h-4 w-4 mr-1" />
            Hierarquia
          </Button>
          <Button
            variant={viewMode === "flat" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("flat")}
            data-testid="button-view-flat"
          >
            <Grid3X3 className="h-4 w-4 mr-1" />
            Lista
          </Button>
          <Link href="/catalog" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline ml-2" data-testid="link-view-all-products">
            <ShoppingBag className="h-4 w-4" />
            Ver todos os produtos
          </Link>
        </div>
      </div>

      {viewMode === "hierarchy" && categoryTree.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} data-testid="button-expand-all">
            Expandir Tudo
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} data-testid="button-collapse-all">
            Recolher Tudo
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Carregando categorias...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Grid3X3 className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Nenhuma categoria cadastrada</h3>
          <p className="text-muted-foreground text-sm mb-4">
            As categorias serao exibidas aqui quando forem cadastradas
          </p>
          {isAdmin && (
            <Button onClick={handleCreateNew} data-testid="button-create-first-category">
              <Plus className="h-4 w-4 mr-1" />
              Criar primeira categoria
            </Button>
          )}
        </div>
      ) : viewMode === "hierarchy" ? (
        <div className="space-y-4">
          {categoryTree.map((category) => (
            <CategoryCard 
              key={category.id} 
              category={category}
              expandedCategories={expandedCategories}
              toggleExpanded={toggleExpanded}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleVarejo={handleToggleVarejo}
              isTogglingVarejo={toggleVarejoMutation.isPending}
            />
          ))}

          <Link href="/catalog" className="block ml-11" data-testid="card-all-products">
            <Card className="group overflow-visible hover-elevate active-elevate-2 transition-all duration-200 border-dashed">
              <CardContent className="p-0">
                <div className="relative h-20 bg-gradient-to-br from-muted/50 to-muted/30 rounded-t-lg overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Package className="h-10 w-10 text-muted-foreground/60 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-base">Todos os Produtos</h3>
                    <Badge variant="outline" className="shrink-0">
                      {totalProducts}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ver catalogo completo
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {flatCategories.map((category) => {
            const Icon = getCategoryIcon(category.slug);
            const bgGradient = getCategoryColor(category.slug);
            const iconColor = getCategoryIconColor(category.slug);

            return (
              <div key={category.id}>
                <Card className="group overflow-visible hover-elevate active-elevate-2 transition-all duration-200">
                  <CardContent className="p-0">
                    <Link href={`/catalog?category=${encodeURIComponent(category.name)}`} data-testid={`card-category-${category.id}`}>
                      <div className={`relative h-32 bg-gradient-to-br ${bgGradient} rounded-t-lg overflow-hidden`}>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icon className={`h-16 w-16 ${iconColor} opacity-80 group-hover:scale-110 transition-transform duration-300`} />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/20 to-transparent" />
                        {category.hideFromVarejo && (
                          <div className="absolute top-2 right-2">
                            <Badge variant="secondary" className="text-xs gap-1">
                              <EyeOff className="h-3 w-3" />
                              Atacado
                            </Badge>
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Link 
                          href={`/catalog?category=${encodeURIComponent(category.name)}`}
                          className="min-w-0 flex-1"
                        >
                          {category.parentName && (
                            <p className="text-xs text-muted-foreground truncate">{category.parentName}</p>
                          )}
                          <h3 className="font-semibold text-base truncate">{category.name}</h3>
                        </Link>
                        <Badge variant="secondary" className="shrink-0">
                          {category.productCount}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">
                          {category.productCount === 0 
                            ? "Nenhum produto" 
                            : category.productCount === 1 
                              ? "1 produto disponivel" 
                              : `${category.productCount} produtos disponiveis`}
                        </p>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className={`h-7 w-7 ${category.hideFromVarejo ? 'text-orange-500' : 'text-muted-foreground'}`}
                              onClick={(e) => {
                                e.preventDefault();
                                handleToggleVarejo(category);
                              }}
                              disabled={toggleVarejoMutation.isPending}
                              title={category.hideFromVarejo ? "Mostrar para Varejo" : "Ocultar do Varejo"}
                              data-testid={`button-toggle-varejo-${category.id}`}
                            >
                              <EyeOff className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.preventDefault();
                                handleEdit(category);
                              }}
                              data-testid={`button-edit-category-${category.id}`}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDelete(category);
                              }}
                              data-testid={`button-delete-category-${category.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}

          <Link href="/catalog" className="block" data-testid="card-all-products-flat">
            <Card className="group overflow-visible hover-elevate active-elevate-2 transition-all duration-200 border-dashed">
              <CardContent className="p-0">
                <div className="relative h-32 bg-gradient-to-br from-muted/50 to-muted/30 rounded-t-lg overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Package className="h-16 w-16 text-muted-foreground/60 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-base">Todos os Produtos</h3>
                    <Badge variant="outline" className="shrink-0">
                      {totalProducts}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ver catalogo completo
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {!isLoading && filteredCategories.length > 0 && (
        <div className="mt-8">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary" data-testid="stat-root-categories">{rootCategoriesCount}</p>
                  <p className="text-xs text-muted-foreground">Categorias</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-secondary-foreground" data-testid="stat-subcategories">{subcategoriesCount}</p>
                  <p className="text-xs text-muted-foreground">Subcategorias</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-total-products">{totalProducts}</p>
                  <p className="text-xs text-muted-foreground">Produtos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600" data-testid="stat-active-categories">
                    {flatCategories.filter(c => c.productCount > 0).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Com Produtos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-muted-foreground" data-testid="stat-empty-categories">
                    {flatCategories.filter(c => c.productCount === 0).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Sem Produtos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <CategoryDialog
        category={editingCategory}
        allCategories={categoriesData}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => setEditingCategory(null)}
      />

      {deletingCategory && (
        <DeleteCategoryDialog
          category={deletingCategory}
          open={!!deletingCategory}
          onOpenChange={(open) => !open && setDeletingCategory(null)}
          onSuccess={() => setDeletingCategory(null)}
        />
      )}
    </div>
  );
}
