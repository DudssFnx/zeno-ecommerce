import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, Supplier } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

interface OrderItem {
  productId: number;
  productName: string;
  sku: string;
  qty: string;
  unitCost: string;
  sellPrice: string;
  lineTotal: number;
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

  // Fetch products explicitly and accept either array or { products: [] } shape
  const { data: productsData = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products?limit=10000");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const products: Product[] = Array.isArray(productsData)
    ? productsData
    : (productsData as any)?.products || [];

  // Filtra produtos inválidos e normaliza termo de busca (aceita `nome`, `name` ou `sku`)
  const visibleProducts = products.filter(
    (p) => p && (p.nome || (p as any).name || p.sku),
  );
  const normalizedSearch = productSearch.toLowerCase().trim();

  // Lista já filtrada pelo termo de pesquisa (nome/name ou SKU)
  const filteredProducts =
    normalizedSearch.length >= 2
      ? visibleProducts.filter((p) => {
          const term = normalizedSearch;
          const nameForSearch = (p?.nome || (p as any).name || "")
            .toString()
            .toLowerCase();
          const skuForSearch = (p?.sku || "").toString().toLowerCase();
          return nameForSearch.includes(term) || skuForSearch.includes(term);
        })
      : [];

  // Limita a 10 resultados para não poluir a tela
  const filteredProductsLimited = filteredProducts.slice(0, 10);

  // Função para calcular margem
  const calculateMargin = (cost: string, sell: string) => {
    const c = parseFloat(cost) || 0;
    const s = parseFloat(sell) || 0;
    if (c === 0) return 0;
    return ((s - c) / c) * 100;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      // Validação cliente: proibir valores negativos nos campos de preço
      for (const item of items) {
        if (item.unitCost && parseFloat(item.unitCost) < 0) {
          throw new Error(
            `Valor de custo inválido para o produto ${item.productName}`,
          );
        }
        if (item.sellPrice && parseFloat(item.sellPrice) < 0) {
          throw new Error(
            `Valor de venda inválido para o produto ${item.productName}`,
          );
        }
      }

      const payload = {
        supplierId: supplierId ? parseInt(supplierId) : null,
        notes,
        totalValue: total.toFixed(2),
        items: items.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          // Enviar null quando o campo estiver vazio para preservar o valor original do produto
          unitCost: item.unitCost === "" ? null : item.unitCost,
          sellPrice: item.sellPrice === "" ? null : item.sellPrice,
          descriptionSnapshot: item.productName,
          skuSnapshot: item.sku,
        })),
      };

      // Rota unificada que definimos no server/routes.ts
      const res = await apiRequest("POST", "/api/purchases", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      toast({ title: "Sucesso", description: "Pedido de compra criado!" });
      navigate("/purchase-orders");
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const addProduct = (product: any) => {
    if (items.some((i) => i.productId === product.id)) return;
    const cost = product.precoAtacado || "0.00";
    const sell = product.precoVarejo || "0.00";

    setItems([
      ...items,
      {
        productId: product.id,
        productName: product.nome,
        sku: product.sku || "",
        qty: "1",
        unitCost: cost,
        sellPrice: sell,
        lineTotal: parseFloat(cost),
      },
    ]);
    setShowProductDialog(false);
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;

    // Calcula custo efetivo: usa unitCost fornecido, senão usa o custo do produto
    const item = updated[index];
    const product = products.find((p) => p.id === item.productId) as any;
    const qty = parseFloat(item.qty || "0") || 0;
    let effectiveUnitCost = 0;

    if (
      item.unitCost === "" ||
      item.unitCost === null ||
      item.unitCost === undefined
    ) {
      effectiveUnitCost =
        parseFloat(product?.precoAtacado || product?.cost || "0") || 0;
    } else {
      effectiveUnitCost = parseFloat(item.unitCost) || 0;
    }

    item.lineTotal = qty * effectiveUnitCost;
    setItems(updated);
  };

  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/purchase-orders")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Nova Compra</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Itens do Pedido</CardTitle>
            <Button onClick={() => setShowProductDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar Produto
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-32 text-center">Qtd</TableHead>
                  <TableHead className="w-40 text-center">
                    Custo Unit.
                  </TableHead>
                  <TableHead className="w-44 text-center text-orange-500">
                    Preço Venda
                  </TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const margin = calculateMargin(item.unitCost, item.sellPrice);
                  return (
                    <TableRow key={item.productId}>
                      <TableCell>
                        <div className="font-bold">{item.productName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {item.sku}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-10 text-lg text-center font-bold"
                          value={item.qty}
                          onChange={(e) =>
                            updateItem(index, "qty", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-10 font-mono text-center"
                          value={item.unitCost}
                          onChange={(e) =>
                            updateItem(index, "unitCost", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Input
                            type="number"
                            className="h-10 border-orange-400 font-bold text-orange-600 text-center"
                            value={item.sellPrice}
                            onChange={(e) =>
                              updateItem(index, "sellPrice", e.target.value)
                            }
                          />
                          <div
                            className={`text-[10px] font-black text-center uppercase ${margin < 20 ? "text-red-500" : "text-green-600"}`}
                          >
                            {margin > 0 ? `Lucro: ${margin.toFixed(0)}%` : "--"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold whitespace-nowrap">
                        R$ {item.lineTotal.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setItems(items.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fornecedor</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione o fornecedor" />
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
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between text-2xl font-black">
                <span>Total:</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
              <Button
                className="w-full h-14 text-lg bg-orange-500 hover:bg-orange-600 font-bold"
                onClick={() => createMutation.mutate()}
                disabled={items.length === 0 || createMutation.isPending}
              >
                <Save className="mr-2 h-6 w-6" />{" "}
                {createMutation.isPending ? "Salvando..." : "Salvar Pedido"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buscar Produto</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome ou SKU..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="h-12"
          />
          <div className="max-h-60 overflow-y-auto mt-4 border rounded-md bg-popover">
            {normalizedSearch.length < 2 ? (
              <div className="p-3 text-sm text-muted-foreground">
                Digite 2 ou mais caracteres
              </div>
            ) : filteredProductsLimited.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">
                Nenhum produto encontrado
              </div>
            ) : (
              filteredProductsLimited.map((p) => {
                const title = (p.nome || (p as any).name || p.sku || "")
                  .toString()
                  .trim();
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 hover:bg-accent cursor-pointer border-b"
                    onClick={() => addProduct(p)}
                  >
                    <div>
                      <div className="font-bold text-foreground">
                        {title || "Sem nome"}
                      </div>
                      {p.sku && p.sku !== title && (
                        <div className="text-xs text-muted-foreground font-mono italic opacity-80">
                          {p.sku}
                        </div>
                      )}
                    </div>
                    <Plus className="h-4 w-4" />
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
