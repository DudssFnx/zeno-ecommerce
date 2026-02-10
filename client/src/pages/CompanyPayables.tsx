import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanyResource } from "@/hooks/useCompanyResource";
import { Loader2 } from "lucide-react";

export default function CompanyPayables({ companyId }: { companyId: string }) {
  const { data: payables, isLoading } = useCompanyResource(
    "payables",
    companyId,
  );

  if (isLoading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
  }
  if (!payables) return <div>Nenhuma conta a pagar encontrada.</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contas a Pagar da Empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <ul>
          {payables.map((p: any) => (
            <li key={p.id}>{p.description || p.id}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
