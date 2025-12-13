import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CatalogFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  brand: string;
  onBrandChange: (brand: string) => void;
  categories: string[];
  brands: string[];
  onClearFilters: () => void;
}

export function CatalogFilters({
  searchQuery,
  onSearchChange,
  category,
  onCategoryChange,
  brand,
  onBrandChange,
  categories,
  brands,
  onClearFilters,
}: CatalogFiltersProps) {
  const hasFilters = searchQuery || category !== "all" || brand !== "all";
  const activeFiltersCount = [
    searchQuery ? 1 : 0,
    category !== "all" ? 1 : 0,
    brand !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10"
            data-testid="input-search-products"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-[160px] h-10" data-testid="select-category">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={onBrandChange}>
            <SelectTrigger className="w-[160px] h-10" data-testid="select-brand">
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Marcas</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="outline" size="default" onClick={onClearFilters} className="gap-1 h-10" data-testid="button-clear-filters">
              <X className="h-4 w-4" />
              Limpar
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          )}
        </div>
      </div>
      
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Filtros ativos:</span>
          {searchQuery && (
            <Badge variant="outline" className="text-xs gap-1">
              Busca: "{searchQuery}"
              <button onClick={() => onSearchChange("")} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {category !== "all" && (
            <Badge variant="outline" className="text-xs gap-1">
              {category}
              <button onClick={() => onCategoryChange("all")} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {brand !== "all" && (
            <Badge variant="outline" className="text-xs gap-1">
              {brand}
              <button onClick={() => onBrandChange("all")} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
