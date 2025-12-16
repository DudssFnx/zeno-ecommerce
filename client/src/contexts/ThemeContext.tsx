import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as Theme;
      if (stored) return stored;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
    
    // Apply sidebar theme colors
    const sidebarTheme = localStorage.getItem("sidebarTheme");
    if (sidebarTheme) {
      applySidebarTheme(sidebarTheme, theme === "dark");
    }
  }, [theme]);
  
  const applySidebarTheme = (themeId: string, isDark: boolean) => {
    const themes: Record<string, { primary: string; accent: string; sidebar: string; sidebarDark: string }> = {
      default: { primary: "25 95% 53%", accent: "25 100% 95%", sidebar: "0 0% 98%", sidebarDark: "25 30% 10%" },
      blue: { primary: "217 91% 60%", accent: "217 100% 95%", sidebar: "217 30% 97%", sidebarDark: "217 30% 10%" },
      green: { primary: "142 71% 45%", accent: "142 100% 95%", sidebar: "142 30% 97%", sidebarDark: "142 30% 10%" },
      purple: { primary: "262 83% 58%", accent: "262 100% 95%", sidebar: "262 30% 97%", sidebarDark: "262 30% 10%" },
      red: { primary: "0 84% 60%", accent: "0 100% 95%", sidebar: "0 30% 97%", sidebarDark: "0 30% 10%" },
      teal: { primary: "173 80% 40%", accent: "173 100% 95%", sidebar: "173 30% 97%", sidebarDark: "173 30% 10%" },
      pink: { primary: "330 80% 60%", accent: "330 100% 95%", sidebar: "330 30% 97%", sidebarDark: "330 30% 10%" },
      amber: { primary: "45 93% 47%", accent: "45 100% 95%", sidebar: "45 30% 97%", sidebarDark: "45 30% 10%" },
    };
    const config = themes[themeId];
    if (!config) return;
    
    const root = document.documentElement;
    root.style.setProperty("--primary", config.primary);
    root.style.setProperty("--sidebar", isDark ? config.sidebarDark : config.sidebar);
    root.style.setProperty("--sidebar-accent", config.accent);
    root.style.setProperty("--ring", config.primary);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
