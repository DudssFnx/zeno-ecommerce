import { ProductCard, type Product } from "./ProductCard";
import { Package } from "lucide-react";

interface ProductGridProps {
  products: Product[];
  onAddToCart?: (product: Product, quantity: number) => void;
  showPrice?: boolean;
}

export function ProductGrid({ products, onAddToCart, showPrice = true }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Package className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <p className="text-lg font-medium">Nenhum produto encontrado</p>
        <p className="text-sm text-muted-foreground mt-1">Tente ajustar seus filtros de busca</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" data-testid="grid-products">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
          showPrice={showPrice}
        />
      ))}
    </div>
  );
}
