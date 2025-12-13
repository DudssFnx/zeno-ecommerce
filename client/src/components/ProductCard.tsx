import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Minus, ShoppingCart } from "lucide-react";
import { useState } from "react";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand?: string;
  price: number;
  stock?: number;
  image?: string;
  showPrice?: boolean;
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product, quantity: number) => void;
  showPrice?: boolean;
}

export function ProductCard({ product, onAddToCart, showPrice = true }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const inStock = product.stock === undefined || product.stock > 0;
  const maxStock = product.stock ?? 999;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleIncrement = () => {
    if (quantity < maxStock) {
      setQuantity(q => q + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  const handleAddToCart = () => {
    onAddToCart?.(product, quantity);
    setQuantity(1);
  };

  return (
    <Card 
      className="overflow-hidden group hover-elevate transition-all duration-200"
      data-testid={`card-product-${product.id}`}
    >
      <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center relative overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <Package className="h-16 w-16 text-muted-foreground/20" />
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm">
            <Badge variant="destructive">Indisponível</Badge>
          </div>
        )}
        {product.brand && (
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="text-xs font-medium bg-background/90 backdrop-blur-sm">
              {product.brand}
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1 font-mono">
            {product.sku}
          </p>
          <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem] leading-tight" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {product.category}
          </p>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-baseline gap-1">
            {showPrice ? (
              <>
                <span className="text-xl font-bold" data-testid={`text-product-price-${product.id}`}>
                  {formatPrice(product.price)}
                </span>
                <span className="text-xs text-muted-foreground">/un</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Faça login para ver preços</span>
            )}
          </div>
          
          {product.stock !== undefined && inStock && (
            <p className="text-xs text-muted-foreground">
              {product.stock} disponíveis
            </p>
          )}
          
          {showPrice && inStock && (
            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-md">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-r-none"
                  onClick={handleDecrement}
                  disabled={quantity <= 1}
                  data-testid={`button-decrement-${product.id}`}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-10 text-center text-sm font-medium" data-testid={`text-quantity-${product.id}`}>
                  {quantity}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-l-none"
                  onClick={handleIncrement}
                  disabled={quantity >= maxStock}
                  data-testid={`button-increment-${product.id}`}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Button
                size="sm"
                className="flex-1 gap-1"
                onClick={handleAddToCart}
                disabled={!inStock}
                data-testid={`button-add-to-cart-${product.id}`}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
          )}
          
          {showPrice && !inStock && (
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              disabled
            >
              Indisponível
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
