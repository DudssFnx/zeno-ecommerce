import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Grid3X3, Box, Zap, Wrench, Coffee, Heart, Star, Bookmark, Layers, ShoppingBag, ChevronRight, ChevronDown, FolderTree } from "lucide-react";
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

function CategoryCard({ 
  category, 
  depth = 0,
  expandedCategories,
  toggleExpanded 
}: { 
  category: CategoryWithHierarchy; 
  depth?: number;
  expandedCategories: Set<number>;
  toggleExpanded: (id: number) => void;
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
        <Link 
          href={`/catalog?category=${encodeURIComponent(category.name)}`} 
          className={`block flex-1 ${!hasChildren ? (isSubcategory ? "" : "ml-11") : ""}`}
          data-testid={`card-category-${category.id}`}
        >
          <Card className="group overflow-visible hover-elevate active-elevate-2 transition-all duration-200">
            <CardContent className="p-0">
              <div className={`relative ${isSubcategory ? "h-20" : "h-32"} bg-gradient-to-br ${bgGradient} rounded-t-lg overflow-hidden`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon className={`${isSubcategory ? "h-10 w-10" : "h-16 w-16"} ${iconColor} opacity-80 group-hover:scale-110 transition-transform duration-300`} />
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/20 to-transparent" />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {isSubcategory && category.parentName && (
                      <p className="text-xs text-muted-foreground truncate">{category.parentName}</p>
                    )}
                    <h3 className="font-semibold text-base truncate">{category.name}</h3>
                  </div>
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
                <p className="text-xs text-muted-foreground mt-1">
                  {category.productCount === 0 
                    ? "Nenhum produto" 
                    : category.productCount === 1 
                      ? "1 produto disponivel" 
                      : `${category.productCount} produtos disponiveis`}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"hierarchy" | "flat">("hierarchy");

  const { data: categoriesData = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const { data: productsResponse, isLoading: productsLoading } = useQuery<{ products: Product[]; total: number }>({
    queryKey: ['/api/products', { limit: 10000 }],
  });
  
  const productsData = productsResponse?.products || [];

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
    return buildCategoryTree(categoriesData, countMap);
  }, [categoriesData, countMap]);

  const flatCategories = useMemo(() => {
    return categoriesData.map((cat) => {
      const parent = cat.parentId ? categoriesData.find(c => c.id === cat.parentId) : null;
      return {
        ...cat,
        productCount: countMap[cat.id] || 0,
        children: [],
        parentName: parent?.name,
        fullPath: parent ? `${parent.name} > ${cat.name}` : cat.name,
      } as CategoryWithHierarchy;
    });
  }, [categoriesData, countMap]);

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
    const allIds = new Set(categoriesData.filter(c => 
      categoriesData.some(child => child.parentId === c.id)
    ).map(c => c.id));
    setExpandedCategories(allIds);
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const rootCategoriesCount = categoryTree.length;
  const subcategoriesCount = categoriesData.length - rootCategoriesCount;
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
      ) : categoriesData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Grid3X3 className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Nenhuma categoria cadastrada</h3>
          <p className="text-muted-foreground text-sm">
            As categorias serao exibidas aqui quando forem cadastradas
          </p>
        </div>
      ) : viewMode === "hierarchy" ? (
        <div className="space-y-4">
          {categoryTree.map((category) => (
            <CategoryCard 
              key={category.id} 
              category={category}
              expandedCategories={expandedCategories}
              toggleExpanded={toggleExpanded}
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
              <Link key={category.id} href={`/catalog?category=${encodeURIComponent(category.name)}`} className="block" data-testid={`card-category-${category.id}`}>
                <Card className="group overflow-visible hover-elevate active-elevate-2 transition-all duration-200">
                  <CardContent className="p-0">
                    <div className={`relative h-32 bg-gradient-to-br ${bgGradient} rounded-t-lg overflow-hidden`}>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Icon className={`h-16 w-16 ${iconColor} opacity-80 group-hover:scale-110 transition-transform duration-300`} />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/20 to-transparent" />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {category.parentName && (
                            <p className="text-xs text-muted-foreground truncate">{category.parentName}</p>
                          )}
                          <h3 className="font-semibold text-base truncate">{category.name}</h3>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {category.productCount}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {category.productCount === 0 
                          ? "Nenhum produto" 
                          : category.productCount === 1 
                            ? "1 produto disponivel" 
                            : `${category.productCount} produtos disponiveis`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
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

      {!isLoading && categoriesData.length > 0 && (
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
    </div>
  );
}
