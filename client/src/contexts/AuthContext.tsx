import { createContext, useContext, type ReactNode } from "react";
import { useAuth as useReplitAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
  isAdmin: boolean;
  isSales: boolean;
  isCustomer: boolean;
  isApproved: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated } = useReplitAuth();

  const logout = () => {
    window.location.href = "/api/logout";
  };

  const isAdmin = user?.role === "admin";
  const isSales = user?.role === "sales";
  const isCustomer = user?.role === "customer";
  const isApproved = user?.approved || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isAuthenticated,
        isLoading,
        logout,
        isAdmin,
        isSales,
        isCustomer,
        isApproved,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export type { User };
