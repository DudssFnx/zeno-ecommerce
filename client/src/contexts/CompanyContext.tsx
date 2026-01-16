import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Company } from "@shared/schema";

interface CompanyContextType {
  companies: Company[];
  activeCompany: Company | null;
  setActiveCompany: (company: Company | null) => void;
  isLoading: boolean;
  hasMultipleCompanies: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const ACTIVE_COMPANY_KEY = "zeno_active_company_id";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(ACTIVE_COMPANY_KEY);
    }
    return null;
  });

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/user/companies"],
    retry: 1,
  });

  const activeCompany = activeCompanyId
    ? companies.find((c) => c.id === activeCompanyId) || companies[0] || null
    : companies[0] || null;

  useEffect(() => {
    if (activeCompany && activeCompany.id !== activeCompanyId) {
      setActiveCompanyId(activeCompany.id);
      localStorage.setItem(ACTIVE_COMPANY_KEY, activeCompany.id);
    }
  }, [activeCompany, activeCompanyId]);

  const setActiveCompany = (company: Company | null) => {
    if (company) {
      setActiveCompanyId(company.id);
      localStorage.setItem(ACTIVE_COMPANY_KEY, company.id);
      queryClient.invalidateQueries();
    } else {
      setActiveCompanyId(null);
      localStorage.removeItem(ACTIVE_COMPANY_KEY);
    }
  };

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompany,
        setActiveCompany,
        isLoading,
        hasMultipleCompanies: companies.length > 1,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompany must be used within CompanyProvider");
  }
  return context;
}
