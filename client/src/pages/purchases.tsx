import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { PurchaseOrder } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Eye,
  Loader2,
  MoreVertical,
  Package,
  PackagePlus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  XSquare,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

type PurchaseOrderWithDetails = PurchaseOrder & {
  supplierName: string | null;
  itemCount: number;
};

const STATUS_LABELS: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  DRAFT: {
    label: "Rascunho",
    variant: "outline",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  FINALIZED: {
    label: "Aprovado",
    variant: "outline",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  STOCK_POSTED: {
    label: "Estoque Lançado",
    variant: "outline",
    className: "bg-green-50 text-green-700 border-green-200",
  },
};

export default function PurchasesPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  // Modal state to show updated products after post-stock
  const [updatedProductsModal, setUpdatedProductsModal] = useState<
    any[] | null
  >(null);

  const { data: orders = [], isLoading } = useQuery<PurchaseOrderWithDetails[]>(
    {
      queryKey: ["/api/purchases", statusFilter, search],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (statusFilter && statusFilter !== "all")
          params.append("status", statusFilter);
        if (search) params.append("search", search);

        const res = await fetch(`/api/purchases?${params.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      },
    },
  );

  // --- MUTAÇÕES ---

  const postStockMutation = useMutation({
    mutationFn: async (id: number) => {
      setProcessingId(id);
      const res = await apiRequest("POST", `/api/purchases/${id}/post-stock`);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      if (data?.updatedProducts && data.updatedProducts.length > 0) {
        const count = data.updatedProducts.length;
        const costCount = data.updatedProducts.filter(
          (u: any) => u.updatedCost,
        ).length;
        const priceCount = data.updatedProducts.filter(
          (u: any) => u.updatedPrice,
        ).length;
        toast({
          title: "Estoque lançado",
          description: `Estoque lançado. ${count} produto(s) atualizado(s): ${costCount} custo(s), ${priceCount} preço(s).`,
        });
        // Open modal with details
        setUpdatedProductsModal(data.updatedProducts);
      } else {
        toast({ title: "Sucesso", description: "Estoque lançado." });
      }
      setProcessingId(null);
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
      setProcessingId(null);
    },
  });

  const reverseStockMutation = useMutation({
    mutationFn: async (id: number) => {
      setProcessingId(id);
      await apiRequest("POST", `/api/purchases/${id}/reverse-stock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Estornado",
        description: "Estoque revertido e pedido voltou para Rascunho.",
      });
      setProcessingId(null);
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
      setProcessingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      setProcessingId(id);
      await apiRequest("DELETE", `/api/purchases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Sucesso", description: "Pedido excluído." });
      setProcessingId(null);
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
      setProcessingId(null);
    },
  });

  // --- AÇÕES EM MASSA ---

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(orders.map((o) => o.id));
    else setSelectedIds([]);
  };

  const handleSelectOne = (checked: boolean, id: number) => {
    if (checked) setSelectedIds((prev) => [...prev, id]);
    else setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  const handleBulkPostStock = async () => {
    const drafts = orders.filter(
      (o) => selectedIds.includes(o.id) && o.status === "DRAFT",
    );
    if (drafts.length === 0) return;
    if (!confirm(`Lançar estoque de ${drafts.length} pedidos?`)) return;

    setIsBulkProcessing(true);
    try {
      const results = await Promise.all(
        drafts.map((order) =>
          apiRequest("POST", `/api/purchases/${order.id}/post-stock`).then(
            (r) => r.json(),
          ),
        ),
      );
      // Agrega atualizações de produtos de todos os resultados
      const updatedProducts = results.flatMap((r) => r?.updatedProducts || []);
      if (updatedProducts.length > 0) {
        const costCount = updatedProducts.filter((u) => u.updatedCost).length;
        const priceCount = updatedProducts.filter((u) => u.updatedPrice).length;
        toast({
          title: "Sucesso",
          description: `Pedidos lançados. ${updatedProducts.length} produto(s) atualizado(s): ${costCount} custo(s), ${priceCount} preço(s).`,
        });
        setUpdatedProductsModal(updatedProducts);
      } else {
        toast({ title: "Sucesso", description: "Pedidos lançados." });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedIds([]);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao processar.",
        variant: "destructive",
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkReverseStock = async () => {
    const posted = orders.filter(
      (o) => selectedIds.includes(o.id) && o.status === "STOCK_POSTED",
    );
    if (posted.length === 0) return;
    if (
      !confirm(
        `Deseja ESTORNAR o estoque de ${posted.length} pedidos e voltá-los para Rascunho?`,
      )
    )
      return;

    setIsBulkProcessing(true);
    try {
      await Promise.all(
        posted.map((order) =>
          apiRequest("POST", `/api/purchases/${order.id}/reverse-stock`),
        ),
      );
      toast({
        title: "Sucesso",
        description: "Pedidos estornados para Rascunho.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedIds([]);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao estornar.",
        variant: "destructive",
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const hasPosted = orders.some(
      (o) => selectedIds.includes(o.id) && o.status === "STOCK_POSTED",
    );
    const msg = hasPosted
      ? `ATENÇÃO: Alguns pedidos já lançaram estoque. Ao excluir, o estoque será ESTORNADO.\n\nDeseja continuar?`
      : `Excluir ${selectedIds.length} pedidos?`;

    if (!confirm(msg)) return;

    setIsBulkProcessing(true);
    try {
      await Promise.all(
        selectedIds.map((id) => apiRequest("DELETE", `/api/purchases/${id}`)),
      );
      toast({ title: "Sucesso", description: "Pedidos excluídos." });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedIds([]);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao excluir.",
        variant: "destructive",
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const hasDraftsSelected = orders.some(
    (o) => selectedIds.includes(o.id) && o.status === "DRAFT",
  );
  const hasPostedSelected = orders.some(
    (o) => selectedIds.includes(o.id) && o.status === "STOCK_POSTED",
  );

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Pedidos de Compra
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas compras e entrada de notas
          </p>
        </div>
        <Button asChild data-testid="button-new-purchase">
          <Link href="/purchase-orders/new">
            <Plus className="mr-2 h-4 w-4" /> Nova Compra
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex gap-4 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="DRAFT">Rascunho</SelectItem>
                  <SelectItem value="STOCK_POSTED">Estoque Lançado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 bg-muted/50 p-2 rounded-lg border animate-in fade-in slide-in-from-right-5">
                <span className="text-sm font-medium px-2">
                  {selectedIds.length} selecionados
                </span>

                {hasDraftsSelected && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-200 bg-green-50 hover:bg-green-100"
                    onClick={handleBulkPostStock}
                    disabled={isBulkProcessing}
                  >
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Lançar
                  </Button>
                )}

                {hasPostedSelected && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100"
                    onClick={handleBulkReverseStock}
                    disabled={isBulkProcessing}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Estornar
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                  onClick={handleBulkDelete}
                  disabled={isBulkProcessing}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSelectedIds([])}
                  className="h-8 w-8 ml-auto"
                >
                  <XSquare className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum pedido encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={
                        orders.length > 0 &&
                        selectedIds.length === orders.length
                      }
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                  </TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead>Fornecedor / Pedido</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead className="text-center">Volume</TableHead>
                  <TableHead className="text-right">Criado em</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow
                    key={order.id}
                    className={
                      selectedIds.includes(order.id) ? "bg-muted/50" : ""
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(order.id)}
                        onCheckedChange={(checked) =>
                          handleSelectOne(!!checked, order.id)
                        }
                      />
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          STATUS_LABELS[order.status]?.variant || "outline"
                        }
                        className={STATUS_LABELS[order.status]?.className}
                      >
                        {STATUS_LABELS[order.status]?.label || order.status}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div
                        className="flex flex-col cursor-pointer"
                        onClick={() => navigate(`/purchase-orders/${order.id}`)}
                      >
                        <span className="font-bold text-base text-foreground/90">
                          {order.supplierName || "Fornecedor Avulso"}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono mt-0.5">
                          #{order.number}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          ME
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Eu
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-center text-sm text-muted-foreground">
                      {order.itemCount} itens
                    </TableCell>

                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </TableCell>

                    <TableCell
                      className={`text-right font-bold ${parseFloat(order.totalValue as any) === 0 ? "text-muted-foreground/40" : ""}`}
                    >
                      {formatCurrency(order.totalValue)}
                    </TableCell>

                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            {processingId === order.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/purchase-orders/${order.id}`)
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" /> Visualizar
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() =>
                              window.open(
                                `/api/purchases/${order.id}/pdf`,
                                "_blank",
                              )
                            }
                          >
                            <Printer className="mr-2 h-4 w-4" /> Imprimir
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {order.status === "DRAFT" && (
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm("Lançar estoque?"))
                                  postStockMutation.mutate(order.id);
                              }}
                              className="text-green-600 focus:text-green-700"
                            >
                              <PackagePlus className="mr-2 h-4 w-4" /> Lançar
                              Estoque
                            </DropdownMenuItem>
                          )}

                          {order.status === "STOCK_POSTED" && (
                            <DropdownMenuItem
                              onClick={() => {
                                if (
                                  confirm(
                                    "Deseja estornar o estoque e voltar para Rascunho?",
                                  )
                                )
                                  reverseStockMutation.mutate(order.id);
                              }}
                              className="text-orange-600 focus:text-orange-700"
                            >
                              <RotateCcw className="mr-2 h-4 w-4" /> Estornar
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onClick={() => {
                              const isPosted = order.status === "STOCK_POSTED";
                              const msg = isPosted
                                ? "⚠️ ATENÇÃO: Ao excluir, o sistema vai ESTORNAR o estoque automaticamente.\n\nDeseja continuar?"
                                : "Excluir pedido?";
                              if (confirm(msg)) deleteMutation.mutate(order.id);
                            }}
                            className="text-red-600 focus:text-red-700"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {order.status === "STOCK_POSTED"
                              ? "Estornar e Excluir"
                              : "Excluir"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {updatedProductsModal && updatedProductsModal.length > 0 && (
        <Dialog open={true} onOpenChange={() => setUpdatedProductsModal(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Produtos atualizados</DialogTitle>
            </DialogHeader>
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {updatedProductsModal.map((u) => (
                <div
                  key={u.productId}
                  className="flex items-center justify-between border-b pb-2"
                >
                  <div>
                    <div className="font-bold">
                      {u.name || `#${u.productId}`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {u.updatedCost && u.cost
                        ? `Custo atualizado: R$ ${Number(u.cost).toFixed(2)}`
                        : ""}
                      {u.updatedPrice && u.price
                        ? ` ${u.updatedPrice ? `Preço atualizado: R$ ${Number(u.price).toFixed(2)}` : ""}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Estoque: {u.newStock ?? "-"}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end p-4">
              <Button onClick={() => setUpdatedProductsModal(null)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
