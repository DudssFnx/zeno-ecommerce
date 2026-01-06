import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Supplier, Product } from "@shared/schema";

interface OrderItem {
  productId: number;
  productName: string;
  sku: string;
  qty: string;
  unitCost: string;
  lineTotal: number;
}

interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export default function PurchaseNewPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [supplierId, setSupplierId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: productsData } = useQuery<ProductsResponse>({
    queryKey: ["/api/products"],
  });

  const products = productsData?.products || [];

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create the order
      const order = await apiRequest("POST", "/api/purchases", {
        supplierId: supplierId ? parseInt(supplierId) : null,
        notes,
      });
      const orderData = await order.json();

      // Add items
      for (const item of items) {
        await apiRequest("POST", `/api/purchases/${orderData.id}/items`, {
          productId: item.productId,
          qty: item.qty,
          unitCost: item.unitCost,
        });
      }

      return orderData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      toast({ title: "Pedido criado com sucesso" });
      navigate(`/purchases/${data.id}`);
    },
    onError: () => {
      toast({ title: "Erro ao criar pedido", variant: "destructive" });
    },
  });

  const addProduct = (product: Product) => {
    if (items.some((i) => i.productId === product.id)) {
      toast({ title: "Produto ja adicionado", variant: "destructive" });
      return;
    }
    const defaultCost = product.price ? (parseFloat(product.price) * 0.7).toFixed(2) : "0.00";
    setItems([
      ...items,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku || "",
        qty: "1",
        unitCost: defaultCost,
        lineTotal: parseFloat(defaultCost),
      },
    ]);
    setShowProductDialog(false);
    setProductSearch("");
  };

  const updateItem = (index: number, field: "qty" | "unitCost", value: string) => {
    const updated = [...items];
    updated[index][field] = value;
    updated[index].lineTotal = parseFloat(updated[index].qty || "0") * parseFloat(updated[index].unitCost || "0");
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/purchases")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Nova Compra</h1>
          <p className="text-muted-foreground">Crie um novo pedido de compra</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Itens do Pedido</CardTitle>
            <Button onClick={() => setShowProductDialog(true)} data-testid="button-add-product">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Produto
            </Button>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-items">
                Nenhum item adicionado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="w-24">Qtd</TableHead>
                    <TableHead className="w-32">Custo Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.productId} data-testid={`row-item-${item.productId}`}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.sku}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => updateItem(index, "qty", e.target.value)}
                          className="w-20"
                          data-testid={`input-qty-${item.productId}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) => updateItem(index, "unitCost", e.target.value)}
                          className="w-28"
                          data-testid={`input-cost-${item.productId}`}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.lineTotal)}</TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeItem(index)}
                          data-testid={`button-remove-${item.productId}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fornecedor</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger data-testid="select-supplier">
                  <SelectValue placeholder="Selecione um fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Observacoes</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observacoes do pedido..."
                className="w-full min-h-[100px] p-3 rounded-md border bg-background resize-none"
                data-testid="textarea-notes"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Itens:</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span data-testid="text-total">{formatCurrency(total)}</span>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={items.length === 0 || createMutation.isPending}
                data-testid="button-save"
              >
                <Save className="mr-2 h-4 w-4" />
                {createMutation.isPending ? "Salvando..." : "Salvar Pedido"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Produto</DialogTitle>
          </DialogHeader>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-9"
              data-testid="input-product-search"
            />
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Preco</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.slice(0, 20).map((product) => (
                  <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell className="text-muted-foreground">{product.sku || "-"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(parseFloat(product.price || "0"))}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addProduct(product)}
                        disabled={items.some((i) => i.productId === product.id)}
                        data-testid={`button-add-${product.id}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
