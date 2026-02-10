import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanyResource } from "@/hooks/useCompanyResource";
import { Loader2 } from "lucide-react";

export default function CompanySuppliers({ companyId }: { companyId: string }) {
  const { data: suppliers, isLoading } = useCompanyResource(
    "suppliers",
    companyId,
  );

  if (isLoading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
  }
  if (!suppliers) return <div>Nenhum fornecedor encontrado.</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fornecedores da Empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <ul>
          {suppliers.map((s: any) => (
            <li key={s.id}>{s.name || s.id}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
