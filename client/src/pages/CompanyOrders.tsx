import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanyResource } from "@/hooks/useCompanyResource";
import { Loader2 } from "lucide-react";

export default function CompanyOrders({ companyId }: { companyId: string }) {
  const { data: orders, isLoading } = useCompanyResource("orders", companyId);

  if (isLoading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
  }
  if (!orders) return <div>Nenhum pedido encontrado.</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos da Empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <ul>
          {orders.orders?.map((o: any) => (
            <li key={o.id}>Pedido #{o.id}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
