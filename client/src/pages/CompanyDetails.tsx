import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Loader2 } from "lucide-react";

interface CompanyDetailsProps {
  companyId: string;
}

export default function CompanyDetails({ companyId }: CompanyDetailsProps) {
  const { data: company, isLoading } = useQuery({
    queryKey: ["/api/companies", companyId],
    queryFn: () => axios.get(`/api/companies/${companyId}`).then((r) => r.data),
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) {
    return <div>Empresa não encontrada.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <Card>
        <CardHeader>
          <CardTitle>Dados da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>Razão Social: {company.razaoSocial || company.name}</div>
          <div>
            Nome Fantasia: {company.fantasyName || company.nomeFantasia}
          </div>
          <div>CNPJ: {company.cnpj}</div>
          <div>Email: {company.email}</div>
          <div>Telefone: {company.phone || company.telefone}</div>
          <div>Endereço: {company.address || company.endereco}</div>
          <div>Cidade: {company.city || company.cidade}</div>
          <div>Estado: {company.state || company.estado}</div>
        </CardContent>
      </Card>
    </div>
  );
}
