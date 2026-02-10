import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanyResource } from "@/hooks/useCompanyResource";
import { Loader2 } from "lucide-react";

export default function CompanyProducts({ companyId }: { companyId: string }) {
  const { data: products, isLoading } = useCompanyResource(
    "products",
    companyId,
  );

  if (isLoading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
  }
  if (!products) return <div>Nenhum produto encontrado.</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtos da Empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <ul>
          {products.products?.map((p: any) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
