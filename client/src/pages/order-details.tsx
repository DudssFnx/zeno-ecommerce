import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Package, User, Calendar, FileText, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Order, OrderItem } from "@shared/schema";

interface ProductInfo {
  id: number;
  name: string;
  sku: string;
  image: string | null;
  price: string;
}

interface CustomerInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
}

interface OrderWithDetails extends Order {
  items: (OrderItem & { product: ProductInfo })[];
  customer: CustomerInfo;
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  processing: "Processando",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  processing: "default",
  completed: "default",
  cancelled: "destructive",
};

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const { isAdmin, isSales } = useAuth();
  const { toast } = useToast();
  const canEditStatus = isAdmin || isSales;

  const { data: orderData, isLoading } = useQuery<OrderWithDetails>({
    queryKey: ["/api/orders", orderId],
    enabled: !!orderId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/orders/${orderId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Status Atualizado",
        description: "O status do pedido foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do pedido.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="p-6 lg:p-8">
        <Link href="/orders">
          <Button variant="ghost" size="sm" data-testid="link-back-orders">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Pedidos
          </Button>
        </Link>
        <div className="text-center py-12 text-muted-foreground">
          Pedido não encontrado
        </div>
      </div>
    );
  }

  const customer = orderData.customer;
  const itemsWithProducts = orderData.items || [];

  const subtotal = itemsWithProducts.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/orders">
          <Button variant="ghost" size="sm" data-testid="link-back-orders">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold" data-testid="text-order-number">
            Pedido {orderData.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            Criado em {format(new Date(orderData.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <Badge variant={statusVariants[orderData.status]} data-testid="badge-order-status">
          {statusLabels[orderData.status] || orderData.status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Itens do Pedido
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {itemsWithProducts.length} {itemsWithProducts.length === 1 ? "item" : "itens"}
              </span>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {itemsWithProducts.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4"
                    data-testid={`order-item-${item.id}`}
                  >
                    <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.product?.image ? (
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" data-testid={`text-product-name-${item.id}`}>
                        {item.product?.name || `Produto #${item.productId}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        SKU: {item.product?.sku || "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium" data-testid={`text-item-total-${item.id}`}>
                        R$ {(parseFloat(item.price) * item.quantity).toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity}x R$ {parseFloat(item.price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="flex justify-between items-center">
                <span className="font-medium">Total do Pedido</span>
                <span className="text-lg font-semibold" data-testid="text-order-total">
                  R$ {parseFloat(orderData.total).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {orderData.notes && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Observações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-order-notes">
                  {orderData.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {canEditStatus && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Atualizar Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={orderData.status}
                  onValueChange={(value) => updateStatusMutation.mutate(value)}
                  disabled={updateStatusMutation.isPending}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Selecionar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="processing">Processando</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium" data-testid="text-customer-name">
                      {customer.firstName} {customer.lastName}
                    </p>
                  </div>
                  {customer.company && (
                    <div>
                      <p className="text-sm text-muted-foreground">Empresa</p>
                      <p className="font-medium">{customer.company}</p>
                    </div>
                  )}
                  {customer.email && (
                    <div>
                      <p className="text-sm text-muted-foreground">E-mail</p>
                      <p className="font-medium">{customer.email}</p>
                    </div>
                  )}
                  {customer.phone && (
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{customer.phone}</p>
                    </div>
                  )}
                  {(customer.city || customer.state) && (
                    <div>
                      <p className="text-sm text-muted-foreground">Localização</p>
                      <p className="font-medium">
                        {[customer.city, customer.state].filter(Boolean).join(" - ")}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">ID do Cliente</p>
                  <p className="font-medium font-mono text-sm" data-testid="text-customer-id">
                    {orderData.userId}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Resumo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span data-testid="text-summary-total">R$ {parseFloat(orderData.total).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Número do Pedido</p>
                <p className="font-medium font-mono">{orderData.orderNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data de Criação</p>
                <p className="font-medium">
                  {format(new Date(orderData.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status Atual</p>
                <Badge variant={statusVariants[orderData.status]} className="mt-1">
                  {statusLabels[orderData.status] || orderData.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
