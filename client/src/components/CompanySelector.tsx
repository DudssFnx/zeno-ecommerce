import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Building2, ChevronsUpDown, Loader2 } from "lucide-react";
import { Link } from "wouter";

export function CompanySelector() {
  const {
    data: company,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["/api/company/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company/me");
      if (!res.ok) {
        throw new Error("Falha ao buscar empresa");
      }
      return res.json();
    },
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground border rounded-md border-dashed h-12 w-full">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Carregando...</span>
      </div>
    );
  }

  if (isError || !company) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md h-12 w-full">
        <AlertCircle className="h-3 w-3" />
        <span>Empresa não vinculada</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between bg-background/50 hover:bg-accent hover:text-accent-foreground h-12 border-border/50 px-3"
        >
          <div className="flex items-center gap-3 text-left min-w-0">
            {/* LÓGICA DE ÍCONE: Placeholder Cinza ou Logo do Cliente */}
            <div className="flex items-center justify-center h-8 w-8 shrink-0 rounded-lg bg-muted border border-border/50 overflow-hidden">
              {company.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt={company.tradingName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2 className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
              <span className="truncate font-semibold">
                {company.tradingName || company.name || "Minha Empresa"}
              </span>
              <span className="truncate text-[10px] text-muted-foreground">
                {company.cnpj || "CNPJ não informado"}
              </span>
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        align="start"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Empresa Atual
        </DropdownMenuLabel>

        <DropdownMenuItem
          asChild
          className="gap-2 p-2 font-medium cursor-pointer"
        >
          <Link href="/settings/company">
            <div className="flex h-6 w-6 items-center justify-center rounded-md border bg-background">
              <SettingsIcon className="h-4 w-4" />
            </div>
            Editar Dados da Empresa
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SettingsIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
