import { useState, useMemo } from "react";
import { CatalogFilters } from "@/components/CatalogFilters";
import { ProductGrid } from "@/components/ProductGrid";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2, Package } from "lucide-react";
import type { Product } from "@/components/ProductCard";
import { useQuery } from "@tanstack/react-query";
import type { Product as SchemaProduct, Category } from "@shared/schema";

export default function CatalogPage() {
  const { addItem, openCart, itemCount, total } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");

  const { data: productsData = [], isLoading: productsLoading } = useQuery<SchemaProduct[]>({
    queryKey: ['/api/products'],
  });

  const { data: categoriesData = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

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
    }));
  }, [productsData, categoryMap]);

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
      const matchesSearch = 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = category === "all" || product.category === category;
      const matchesBrand = brand === "all" || product.brand === brand;
      return matchesSearch && matchesCategory && matchesBrand;
    });
  }, [products, searchQuery, category, brand]);

  const handleAddToCart = (product: Product, quantity: number) => {
    addItem({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      quantity: quantity,
      image: product.image,
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setCategory("all");
    setBrand("all");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Catálogo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {products.length} produtos disponíveis
          </p>
        </div>
        <Button onClick={openCart} className="gap-2" data-testid="button-view-cart">
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline">Carrinho</span>
          {itemCount > 0 && (
            <span className="bg-primary-foreground text-primary font-semibold px-2 py-0.5 rounded-full text-xs">
              {itemCount}
            </span>
          )}
        </Button>
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
        {itemCount > 0 && (
          <p className="text-muted-foreground">
            Total no carrinho: <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
          </p>
        )}
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
        <ProductGrid products={filteredProducts} onAddToCart={handleAddToCart} />
      )}
    </div>
  );
}
