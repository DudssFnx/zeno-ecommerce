import { useQuery } from "@tanstack/react-query";
import axios from "axios";

/**
 * Hook genérico para buscar recursos multi-tenant por companyId
 * Exemplo de uso: useCompanyResource('products', companyId)
 * Agora envia o header X-Company-Id para que as rotas do servidor possam usar req.companyId
 */
export function useCompanyResource(resource: string, companyId?: string) {
  return useQuery({
    queryKey: [resource, companyId],
    queryFn: () =>
      axios
        .get(`/api/${resource}`, { headers: { "X-Company-Id": companyId } })
        .then((r) => r.data),
    enabled: !!companyId,
  });
}
