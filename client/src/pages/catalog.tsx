import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { CatalogFilters } from "@/components/CatalogFilters";
import { ProductGrid } from "@/components/ProductGrid";
import { Loader2, Package, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Product } from "@/components/ProductCard";
import { useQuery } from "@tanstack/react-query";
import type { Product as SchemaProduct, Category } from "@shared/schema";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";

interface ProductsResponse {
  products: SchemaProduct[];
  total: number;
  page: number;
  totalPages: number;
}

export default function CatalogPage() {
  const searchString = useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const { addItem } = useCart();
  const { toast } = useToast();

  const handleAddToCart = (product: Product, quantity: number) => {
    if (quantity <= 0) {
      toast({
        title: "Informe a quantidade",
        description: "Digite a quantidade desejada",
        variant: "destructive",
      });
      return;
    }
    
    addItem({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      quantity: quantity,
      image: product.image || undefined,
    });

    toast({
      title: "Adicionado ao carrinho",
      description: `${quantity}x ${product.name}`,
    });
  };

  const { data: categoriesData = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const categoryParam = params.get("category");
    if (categoryParam) {
      const decodedCategory = decodeURIComponent(categoryParam);
      setCategory(decodedCategory);
      const cat = categoriesData.find(c => c.name === decodedCategory);
      if (cat) {
        setSelectedCategoryId(cat.id);
      }
    }
  }, [searchString, categoriesData]);

  useEffect(() => {
    if (category === "all") {
      setSelectedCategoryId(undefined);
    } else {
      const cat = categoriesData.find(c => c.name === category);
      setSelectedCategoryId(cat?.id);
    }
    setPage(1);
  }, [category, categoriesData]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, brand]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '50');
    if (selectedCategoryId) params.set('categoryId', String(selectedCategoryId));
    if (searchQuery) params.set('search', searchQuery);
    return params.toString();
  }, [page, selectedCategoryId, searchQuery]);

  const { data: productsResponse, isLoading: productsLoading } = useQuery<ProductsResponse>({
    queryKey: ['/api/products', queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/products?${queryParams}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
  });

  const productsData = productsResponse?.products || [];
  const totalPages = productsResponse?.totalPages || 1;

  const categoryMap = useMemo(() => {
    const map: Record<number, string> = {};
    categoriesData.forEach(cat => {
      map[cat.id] = cat.name;
    });
    return map;
  }, [categoriesData]);

  const products: Product[] = useMemo(() => {
    return productsData.map((p) => ({
      id: String(p.id),
      name: p.name,
      sku: p.sku,
      category: p.categoryId ? categoryMap[p.categoryId] || "Sem categoria" : "Sem categoria",
      brand: p.brand || undefined,
      price: parseFloat(p.price),
      stock: p.stock,
      image: p.image || undefined,
      featured: p.featured || false,
    }));
  }, [productsData, categoryMap]);

  const featuredProducts = useMemo(() => {
    return products.filter(p => p.featured);
  }, [products]);

  const categories = useMemo(() => {
    return categoriesData.map(c => c.name);
  }, [categoriesData]);

  const brands = useMemo(() => {
    const brandSet = new Set<string>();
    productsData.forEach(p => {
      if (p.brand) brandSet.add(p.brand);
    });
    return Array.from(brandSet);
  }, [productsData]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesBrand = brand === "all" || product.brand === brand;
      const notFeatured = !product.featured;
      return matchesBrand && notFeatured;
    });
  }, [products, brand]);

  const filteredFeaturedProducts = useMemo(() => {
    return featuredProducts.filter((product) => {
      const matchesBrand = brand === "all" || product.brand === brand;
      return matchesBrand;
    });
  }, [featuredProducts, brand]);

  const clearFilters = () => {
    setSearchQuery("");
    setCategory("all");
    setBrand("all");
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Catálogo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Consulta de preços - {products.length} produtos disponíveis
          </p>
        </div>
      </div>

      <CatalogFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        category={category}
        onCategoryChange={setCategory}
        brand={brand}
        onBrandChange={setBrand}
        categories={categories}
        brands={brands}
        onClearFilters={clearFilters}
      />

      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          {filteredProducts.length === products.length 
            ? `${products.length} produtos` 
            : `${filteredProducts.length} de ${products.length} produtos`}
        </p>
      </div>

      {productsLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Carregando produtos...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Package className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Nenhum produto disponível</h3>
          <p className="text-muted-foreground text-sm">
            Os produtos serão exibidos aqui quando forem cadastrados
          </p>
        </div>
      ) : (
        <>
          {filteredFeaturedProducts.length > 0 && (
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                <h2 className="text-xl font-semibold">Produtos em Destaque</h2>
              </div>
              <ProductGrid products={filteredFeaturedProducts} onAddToCart={handleAddToCart} />
            </div>
          )}
          
          <ProductGrid products={filteredProducts} onAddToCart={handleAddToCart} />
          
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                data-testid="button-next-page"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
