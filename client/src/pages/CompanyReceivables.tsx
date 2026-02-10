import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanyResource } from "@/hooks/useCompanyResource";
import { Loader2 } from "lucide-react";

export default function CompanyReceivables({
  companyId,
}: {
  companyId: string;
}) {
  const { data: receivables, isLoading } = useCompanyResource(
    "receivables",
    companyId,
  );

  if (isLoading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
  }
  if (!receivables) return <div>Nenhuma conta a receber encontrada.</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contas a Receber da Empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <ul>
          {receivables.map((r: any) => (
            <li key={r.id}>{r.description || r.id}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
