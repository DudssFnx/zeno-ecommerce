import { OrderTable } from "@/components/OrderTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  B2bProduct as Product,
  Order as SchemaOrder,
  B2bUser as User,
} from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import {
  Box,
  Loader2,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

// --- TIPOS ---
interface CartItem {
  productId: number;
  product: Product;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
}

interface Installment {
  number: number;
  days: number;
  date: string;
  value: number;
  method: string;
  obs: string;
}

interface OrderWithItems extends SchemaOrder {
  items?: { id: number; quantity: number }[];
}

export default function OrdersPage() {
  const { isAdmin, isSales, user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // --- ESTADOS DO FORMULÁRIO ---

  // 1. Cliente & Vendedor
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string>("");

  // 2. Itens
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // 3. Totais e Descontos Globais
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [deliveryDeadline, setDeliveryDeadline] = useState<string>("0");

  // 4. Detalhes da Venda
  const [saleDate, setSaleDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [departureDate, setDepartureDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [customerPO, setCustomerPO] = useState("");

  // 5. Pagamento
  const [paymentCondition, setPaymentCondition] = useState(""); // Ex: "28 59"
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Boleto");

  // 6. Transporte
  const [carrierName, setCarrierName] = useState("");
  const [shippingType, setShippingType] = useState("CIF");
  const [shippingCost, setShippingCost] = useState<number>(0);

  // 7. Observações
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const showAllOrders = isAdmin || isSales;

  // --- QUERIES ---
  const { data: ordersData = [], refetch } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders"],
  });

  const { data: usersData = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: showAllOrders,
  });

  // Filtra listas
  const customersList = usersData.filter(
    (u) => u.role === "customer" || !u.role,
  );
  const sellersList = usersData.filter(
    (u) => u.role === "admin" || u.role === "sales",
  );

  // Define vendedor padrão ao abrir
  useEffect(() => {
    if (isCreateOpen && user && !selectedSellerId) {
      setSelectedSellerId(user.id);
    }
  }, [isCreateOpen, user]);

  // Busca produtos (traz mais itens para filtrar no front)
  const { data: productsResponse } = useQuery<{
    products: any[];
    total: number;
  }>({
    queryKey: ["/api/products", { limit: 1000 }], // Traz mais produtos para garantir que a busca funcione
    queryFn: async ({ queryKey }) => {
      const [_path, params] = queryKey;
      const queryString = new URLSearchParams(params as any).toString();
      const response = await fetch(`/api/products?${queryString}`);
      if (!response.ok) throw new Error("Erro ao buscar produtos");
      return response.json();
    },
    enabled: showAllOrders && isCreateOpen,
  });

  const productsData = productsResponse?.products || [];

  // --- 🔍 LÓGICA DE FILTROS APRIMORADA ---

  // Filtro de Clientes (Nome, Email, CPF/CNPJ, Razão Social)
  const filteredCustomers =
    customerSearch.length >= 2
      ? customersList
          .filter((c) => {
            const search = customerSearch.toLowerCase();
            return (
              (c.nome || c.firstName || "").toLowerCase().includes(search) ||
              (c.email || "").toLowerCase().includes(search) ||
              (c.cpf || "").includes(search) ||
              (c.cnpj || "").includes(search) ||
              (c.razaoSocial || "").toLowerCase().includes(search)
            );
          })
          .slice(0, 15)
      : [];

  // Filtro de Produtos (Nome, SKU)
  const filteredProducts =
    productSearch.length >= 1
      ? productsData
          .filter((p) => {
            const search = productSearch.toLowerCase();
            return (
              p.name.toLowerCase().includes(search) ||
              p.sku.toLowerCase().includes(search)
            );
          })
          .slice(0, 50) // Limita a 50 resultados na lista
      : [];

  // --- LÓGICA DE CARRINHO ---
  const handleAddProduct = (product: any) => {
    const existing = cartItems.find((item) => item.productId === product.id);
    if (existing) {
      toast({ title: "Produto já na lista", variant: "destructive" });
      return;
    }
    const price = parseFloat(product.price || "0");
    const newItem: CartItem = {
      productId: product.id,
      product: product,
      quantity: 1,
      unitPrice: price,
      discountPercent: 0,
      total: price,
    };
    setCartItems([...cartItems, newItem]);
    setProductSearch("");
  };

  const updateCartItem = (id: number, field: keyof CartItem, value: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === id) {
          const updated = { ...item, [field]: value };
          const discountValue =
            updated.unitPrice * (updated.discountPercent / 100);
          updated.total =
            (updated.unitPrice - discountValue) * updated.quantity;
          return updated;
        }
        return item;
      }),
    );
  };

  const removeCartItem = (id: number) => {
    setCartItems(cartItems.filter((i) => i.productId !== id));
  };

  // --- CÁLCULOS TOTAIS ---
  const totalItemsValue = cartItems.reduce((acc, i) => acc + i.total, 0);
  const totalOrderValue =
    totalItemsValue - globalDiscount + shippingCost + otherExpenses;

  // --- GERADOR DE PARCELAS ---
  const generateInstallments = () => {
    if (!paymentCondition || totalOrderValue <= 0) {
      toast({
        title: "Defina a condição e adicione itens",
        variant: "destructive",
      });
      return;
    }
    const daysArray = paymentCondition
      .split(" ")
      .map((d) => parseInt(d))
      .filter((n) => !isNaN(n));

    if (daysArray.length === 0) {
      setInstallments([
        {
          number: 1,
          days: 0,
          date: format(new Date(), "dd/MM/yyyy"),
          value: totalOrderValue,
          method: paymentMethod,
          obs: "",
        },
      ]);
      return;
    }

    const valuePerInst = totalOrderValue / daysArray.length;
    const newInsts = daysArray.map((days, idx) => ({
      number: idx + 1,
      days: days,
      date: format(addDays(new Date(), days), "dd/MM/yyyy"),
      value: parseFloat(valuePerInst.toFixed(2)),
      method: paymentMethod,
      obs: "",
    }));

    const sum = newInsts.reduce((a, b) => a + b.value, 0);
    const diff = totalOrderValue - sum;
    if (diff !== 0) newInsts[newInsts.length - 1].value += diff;

    setInstallments(newInsts);
  };

  // --- SALVAR ---
  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setIsCreateOpen(false);
      setCartItems([]);
      setSelectedCustomer(null);
      setInstallments([]);
      toast({ title: "Pedido Salvo!", className: "bg-green-600 text-white" });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!selectedCustomerId) {
      toast({ title: "Selecione o Cliente", variant: "destructive" });
      return;
    }
    if (cartItems.length === 0) {
      toast({ title: "Adicione itens ao pedido", variant: "destructive" });
      return;
    }

    const sellerName =
      sellersList.find((s) => s.id === selectedSellerId)?.nome || "Admin";

    const richNotes = `
${notes}
[INTERNAL_DATA]
SellerId: ${selectedSellerId}
SellerName: ${sellerName}
DeliveryDeadline: ${deliveryDeadline}
GlobalDiscount: ${globalDiscount}
OtherExpenses: ${otherExpenses}
SaleDate: ${saleDate}
DepartureDate: ${departureDate}
CustomerPO: ${customerPO}
Carrier: ${carrierName}
ShippingType: ${shippingType}
InternalNotes: ${internalNotes}
Installments: ${JSON.stringify(installments)}
[/INTERNAL_DATA]
    `.trim();

    const payload = {
      userId: selectedCustomerId,
      items: cartItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        price: (i.total / i.quantity).toFixed(2),
      })),
      shippingCost: shippingCost.toString(),
      total: totalOrderValue.toString(),
      notes: richNotes,
    };

    createOrderMutation.mutate(payload);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* HEADER DA PÁGINA */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Pedidos de Venda
          </h1>
          <p className="text-muted-foreground">Gerencie vendas e orçamentos.</p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Plus className="mr-2 h-4 w-4" /> Incluir Pedido
        </Button>
      </div>

      {/* TABELA DE LISTAGEM */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="ORCAMENTO">Orçamentos</TabsTrigger>
          <TabsTrigger value="PEDIDO_GERADO">Vendas</TabsTrigger>
          <TabsTrigger value="FATURADO">Faturados</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          <OrderTable
            orders={ordersData
              .map((o) => ({
                ...o,
                id: String(o.id),
                customer: o.customerName || "Cliente",
                date: format(new Date(o.createdAt), "dd/MM/yyyy"),
                total: parseFloat(o.total),
                itemCount: o.items?.length || 0,
                status: o.status as any,
                printed: false,
              }))
              .filter((o) => activeTab === "all" || o.status === activeTab)}
            showCustomer={true}
            selectedOrderIds={new Set()}
            onSelectionChange={() => {}}
            onSelectAll={() => {}}
            onPrintOrder={() => {}}
          />
        </TabsContent>
      </Tabs>

      {/* --- MODAL DE CRIAÇÃO --- */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-[100vw] h-[100vh] p-0 rounded-none bg-background flex flex-col border-none">
          {/* HEADER DO MODAL */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-card shadow-sm h-14 shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">Novo Pedido</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  Rascunho
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="h-8"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                className="bg-green-600 hover:bg-green-700 h-8 px-6 font-semibold"
              >
                {createOrderMutation.isPending ? (
                  <Loader2 className="animate-spin h-3 w-3" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>

          {/* CORPO DO MODAL */}
          <ScrollArea className="flex-1 bg-muted/10">
            <div className="p-4 max-w-[1600px] mx-auto space-y-4">
              {/* 1. DADOS DO CLIENTE E VENDEDOR */}
              <Card className="border-l-2 border-l-orange-500 shadow-sm">
                <CardHeader className="py-2 px-4 border-b bg-muted/20">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-600">
                    <UserIcon className="h-4 w-4" /> Dados Gerais
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3 px-4 grid grid-cols-12 gap-3">
                  <div className="col-span-12 md:col-span-6 relative">
                    <Label className="text-xs text-muted-foreground">
                      Cliente * (Nome, Email, CPF/CNPJ)
                    </Label>
                    {selectedCustomer ? (
                      <div className="flex gap-2 items-center mt-1">
                        <div className="flex-1 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded text-sm font-medium text-green-700 flex justify-between items-center h-8">
                          {selectedCustomer.nome || selectedCustomer.firstName}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => setSelectedCustomer(null)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="relative mt-1">
                        <Input
                          placeholder="Digite para buscar..."
                          className="pl-8 h-8 text-sm"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                        />
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        {customerSearch.length >= 2 &&
                          filteredCustomers.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-xl max-h-60 overflow-y-auto p-1">
                              {filteredCustomers.map((c) => (
                                <div
                                  key={c.id}
                                  className="px-3 py-2 hover:bg-accent cursor-pointer rounded-sm text-sm"
                                  onClick={() => {
                                    setSelectedCustomer(c);
                                    setSelectedCustomerId(c.id);
                                    setCustomerSearch("");
                                  }}
                                >
                                  <span className="font-bold">
                                    {c.nome || c.firstName}
                                  </span>
                                  <span className="text-muted-foreground text-xs ml-2">
                                    {c.razaoSocial ? `(${c.razaoSocial})` : ""}{" "}
                                    - {c.cnpj || c.cpf || c.email}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    )}
                  </div>

                  <div className="col-span-12 md:col-span-4">
                    <Label className="text-xs text-muted-foreground">
                      Vendedor
                    </Label>
                    <Select
                      value={selectedSellerId}
                      onValueChange={setSelectedSellerId}
                    >
                      <SelectTrigger className="mt-1 h-8 text-sm">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sellersList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nome || s.firstName || s.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-6 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">
                      Data Emissão
                    </Label>
                    <Input
                      type="date"
                      className="mt-1 h-8 text-sm"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 2. ITENS COM ESTOQUE INTELIGENTE */}
              <Card className="shadow-sm">
                <CardHeader className="py-2 px-4 border-b bg-muted/20 flex flex-row items-center justify-between h-12">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-600">
                    <ShoppingCart className="h-4 w-4" /> Itens
                  </CardTitle>
                  <div className="relative w-96">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Adicionar produto (Nome/SKU)..."
                      className="pl-8 h-8 text-sm bg-background"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                    {productSearch && filteredProducts.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-xl max-h-60 overflow-y-auto right-0 p-1">
                        {filteredProducts.map((p) => (
                          <div
                            key={p.id}
                            className="px-3 py-2 hover:bg-accent cursor-pointer rounded-sm text-sm flex justify-between items-center"
                            onClick={() => handleAddProduct(p)}
                          >
                            <div>
                              <span className="font-medium">{p.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                SKU: {p.sku}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-600 text-xs">
                                R$ {p.price}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                Est: {p.stock}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 h-8 hover:bg-muted/10">
                        <TableHead className="h-8 w-[35%] pl-4 text-xs">
                          Descrição
                        </TableHead>
                        <TableHead className="h-8 w-[8%] text-center text-xs">
                          Un
                        </TableHead>
                        <TableHead className="h-8 w-[10%] text-center text-xs">
                          Qtd
                        </TableHead>
                        <TableHead className="h-8 w-[12%] text-right text-xs">
                          Preço Un
                        </TableHead>
                        <TableHead className="h-8 w-[10%] text-center text-xs">
                          Desc %
                        </TableHead>
                        <TableHead className="h-8 w-[8%] text-center text-xs">
                          Estoque
                        </TableHead>
                        <TableHead className="h-8 w-[12%] text-right pr-4 text-xs">
                          Total
                        </TableHead>
                        <TableHead className="h-8 w-[5%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cartItems.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="h-20 text-center text-xs text-muted-foreground"
                          >
                            Nenhum item inserido
                          </TableCell>
                        </TableRow>
                      ) : (
                        cartItems.map((item, idx) => {
                          const finalStock =
                            (item.product.stock || 0) - item.quantity;
                          const hasStock = finalStock >= 0;

                          return (
                            <TableRow
                              key={item.productId}
                              className="h-9 hover:bg-muted/5 border-b border-muted/50"
                            >
                              <TableCell className="pl-4 py-1">
                                <div className="text-sm font-medium">
                                  {item.product.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {item.product.sku}
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-xs py-1">
                                {item.product.unit || "UN"}
                              </TableCell>
                              <TableCell className="py-1">
                                <Input
                                  type="number"
                                  className="h-7 text-center text-sm px-1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateCartItem(
                                      item.productId,
                                      "quantity",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="py-1">
                                <Input
                                  type="number"
                                  className="h-7 text-right text-sm px-1"
                                  value={item.unitPrice}
                                  onChange={(e) =>
                                    updateCartItem(
                                      item.productId,
                                      "unitPrice",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="py-1">
                                <Input
                                  type="number"
                                  className="h-7 text-center text-sm px-1 text-blue-500"
                                  value={item.discountPercent}
                                  onChange={(e) =>
                                    updateCartItem(
                                      item.productId,
                                      "discountPercent",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </TableCell>

                              {/* CAIXA DE ESTOQUE INTELIGENTE */}
                              <TableCell className="text-center py-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`h-6 w-full rounded flex items-center justify-center text-xs font-bold cursor-help ${hasStock ? "bg-green-500/20 text-green-700 border border-green-500/30" : "bg-red-500/20 text-red-700 border border-red-500/30"}`}
                                      >
                                        <Box className="h-3 w-3 mr-1" />
                                        {finalStock}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Atual: {item.product.stock || 0}</p>
                                      <p>Pedido: -{item.quantity}</p>
                                      <Separator className="my-1" />
                                      <p
                                        className={
                                          hasStock
                                            ? "text-green-500"
                                            : "text-red-500"
                                        }
                                      >
                                        Saldo: {finalStock}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>

                              <TableCell className="text-right pr-4 py-1 font-bold text-sm">
                                {item.total.toFixed(2)}
                              </TableCell>
                              <TableCell className="py-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeCartItem(item.productId)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* 3. TOTAIS E INFOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  {/* PAGAMENTO E FRETE */}
                  <Card className="shadow-sm">
                    <CardHeader className="py-2 px-3 border-b bg-muted/20">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                        Financeiro e Transporte
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-[10px]">
                            Condição Pagamento (Dias ex: 30 60)
                          </Label>
                          <Input
                            className="h-7 text-xs"
                            value={paymentCondition}
                            onChange={(e) =>
                              setPaymentCondition(e.target.value)
                            }
                          />
                        </div>
                        <Button
                          variant="outline"
                          className="h-7 text-xs border-green-600 text-green-600"
                          onClick={generateInstallments}
                        >
                          Gerar
                        </Button>
                      </div>

                      {installments.length > 0 && (
                        <div className="border rounded bg-muted/10 p-2">
                          <div className="text-[10px] font-bold text-muted-foreground mb-1 grid grid-cols-4 gap-2 px-2">
                            <span>DATA</span>
                            <span>VALOR</span>
                            <span>FORMA</span>
                            <span></span>
                          </div>
                          {installments.map((inst, i) => (
                            <div
                              key={i}
                              className="grid grid-cols-4 gap-2 items-center mb-1"
                            >
                              <Input
                                type="date"
                                className="h-6 text-xs px-1"
                                value={inst.date.split("/").reverse().join("-")}
                                onChange={(e) => {
                                  const [y, m, d] = e.target.value
                                    .split("-")
                                    .map(Number);
                                  const n = [...installments];
                                  // Cria data sem fuso horário para evitar erro de dia anterior
                                  n[i].date = format(
                                    new Date(y, m - 1, d),
                                    "dd/MM/yyyy",
                                  );
                                  setInstallments(n);
                                }}
                              />
                              <Input
                                className="h-6 text-xs px-1"
                                value={inst.value.toFixed(2)}
                                readOnly
                              />
                              <Select
                                value={inst.method}
                                onValueChange={(v) => {
                                  const n = [...installments];
                                  n[i].method = v;
                                  setInstallments(n);
                                }}
                              >
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Boleto">Boleto</SelectItem>
                                  <SelectItem value="Pix">Pix</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      )}

                      <Separator className="my-1" />

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Transportadora</Label>
                          <Input
                            className="h-7 text-xs"
                            value={carrierName}
                            onChange={(e) => setCarrierName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Tipo Frete</Label>
                          <Select
                            value={shippingType}
                            onValueChange={setShippingType}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CIF">
                                CIF (Emitente)
                              </SelectItem>
                              <SelectItem value="FOB">
                                FOB (Destinatário)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Direita: Totais Limpos */}
                <Card className="bg-muted/10 border-none shadow-none h-full">
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs">
                          Total Itens
                        </span>
                        <span className="font-medium bg-background px-2 py-1 rounded border min-w-[80px] text-right">
                          {totalItemsValue.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs">
                          Desconto (R$)
                        </span>
                        <Input
                          type="number"
                          className="h-7 w-[80px] text-right text-xs text-red-500"
                          value={globalDiscount}
                          onChange={(e) =>
                            setGlobalDiscount(parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs">
                          Frete (R$)
                        </span>
                        <Input
                          type="number"
                          className="h-7 w-[80px] text-right text-xs"
                          value={shippingCost}
                          onChange={(e) =>
                            setShippingCost(parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs">
                          Outras Desp.
                        </span>
                        <Input
                          type="number"
                          className="h-7 w-[80px] text-right text-xs"
                          value={otherExpenses}
                          onChange={(e) =>
                            setOtherExpenses(parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>

                    <Separator className="bg-muted-foreground/20" />

                    <div className="flex justify-between items-end pt-2">
                      <div className="text-right w-full">
                        <div className="text-xs text-muted-foreground mb-1">
                          TOTAL LÍQUIDO
                        </div>
                        <div className="text-3xl font-bold text-green-500">
                          R$ {totalOrderValue.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 4. OBSERVAÇÕES */}
              <Card className="shadow-sm">
                <CardHeader className="py-2 px-4 border-b bg-muted/20">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                    Observações
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <Textarea
                    placeholder="Observações impressas no pedido..."
                    className="h-16 text-xs resize-none bg-background"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
