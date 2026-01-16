import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";

export function CompanySelector() {
  const [open, setOpen] = useState(false);
  const { companies, activeCompany, setActiveCompany, isLoading, hasMultipleCompanies } = useCompany();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 animate-pulse" />
        <span>Carregando...</span>
      </div>
    );
  }

  if (companies.length === 0) {
    return null;
  }

  if (!hasMultipleCompanies && activeCompany) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50">
        <Building2 className="h-4 w-4 text-primary" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">
            {activeCompany.nomeFantasia || activeCompany.razaoSocial}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto py-2.5"
          data-testid="button-company-selector"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-medium">
              {activeCompany?.nomeFantasia || activeCompany?.razaoSocial || "Selecionar empresa"}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar empresa..." />
          <CommandList>
            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
            <CommandGroup>
              {companies.map((company) => (
                <CommandItem
                  key={company.id}
                  value={company.nomeFantasia || company.razaoSocial}
                  onSelect={() => {
                    setActiveCompany(company);
                    setOpen(false);
                  }}
                  data-testid={`company-option-${company.id}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      activeCompany?.id === company.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">
                      {company.nomeFantasia || company.razaoSocial}
                    </span>
                    {company.cnpj && (
                      <span className="text-xs text-muted-foreground truncate">
                        {company.cnpj}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
