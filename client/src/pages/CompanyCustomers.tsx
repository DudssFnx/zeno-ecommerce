import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanyResource } from "@/hooks/useCompanyResource";
import { Loader2 } from "lucide-react";

export default function CompanyCustomers({ companyId }: { companyId: string }) {
  const { data: customers, isLoading } = useCompanyResource("users", companyId);

  if (isLoading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
  }
  if (!customers) return <div>Nenhum cliente encontrado.</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes da Empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <ul>
          {customers
            .filter((u: any) => u.role === "customer")
            .map((u: any) => (
              <li key={u.id}>{u.email}</li>
            ))}
        </ul>
      </CardContent>
    </Card>
  );
}
