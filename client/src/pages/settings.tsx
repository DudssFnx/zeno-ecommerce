import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Database, Link2, Bell, Shield, Palette, Check, UserCheck } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

const sidebarThemes = [
  { 
    id: "default", 
    name: "Padrao (Laranja)", 
    primary: "25 95% 53%", 
    accent: "25 100% 95%",
    sidebar: "0 0% 98%",
    sidebarDark: "25 30% 10%"
  },
  { 
    id: "blue", 
    name: "Azul Corporativo", 
    primary: "217 91% 60%", 
    accent: "217 100% 95%",
    sidebar: "217 30% 97%",
    sidebarDark: "217 30% 10%"
  },
  { 
    id: "green", 
    name: "Verde Natureza", 
    primary: "142 71% 45%", 
    accent: "142 100% 95%",
    sidebar: "142 30% 97%",
    sidebarDark: "142 30% 10%"
  },
  { 
    id: "purple", 
    name: "Roxo Elegante", 
    primary: "262 83% 58%", 
    accent: "262 100% 95%",
    sidebar: "262 30% 97%",
    sidebarDark: "262 30% 10%"
  },
  { 
    id: "red", 
    name: "Vermelho Vibrante", 
    primary: "0 84% 60%", 
    accent: "0 100% 95%",
    sidebar: "0 30% 97%",
    sidebarDark: "0 30% 10%"
  },
  { 
    id: "teal", 
    name: "Verde Agua", 
    primary: "173 80% 40%", 
    accent: "173 100% 95%",
    sidebar: "173 30% 97%",
    sidebarDark: "173 30% 10%"
  },
  { 
    id: "pink", 
    name: "Rosa Moderno", 
    primary: "330 80% 60%", 
    accent: "330 100% 95%",
    sidebar: "330 30% 97%",
    sidebarDark: "330 30% 10%"
  },
  { 
    id: "amber", 
    name: "Amarelo Dourado", 
    primary: "45 93% 47%", 
    accent: "45 100% 95%",
    sidebar: "45 30% 97%",
    sidebarDark: "45 30% 10%"
  },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const [erpEndpoint, setErpEndpoint] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("default");

  const { data: agePopupSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/age_verification_popup'],
  });

  const agePopupMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest('POST', '/api/settings/age_verification_popup', { value: enabled ? 'true' : 'false' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/age_verification_popup'] });
      toast({ title: "Configuração salva", description: "Popup de verificação de idade atualizado." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar a configuração.", variant: "destructive" });
    },
  });

  const isAgePopupEnabled = agePopupSetting?.value === 'true';

  useEffect(() => {
    const savedTheme = localStorage.getItem("sidebarTheme");
    if (savedTheme) {
      setSelectedTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  const applyTheme = (themeId: string) => {
    const themeConfig = sidebarThemes.find(t => t.id === themeId);
    if (!themeConfig) return;

    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    
    root.style.setProperty("--primary", themeConfig.primary);
    root.style.setProperty("--sidebar", isDark ? themeConfig.sidebarDark : themeConfig.sidebar);
    root.style.setProperty("--sidebar-accent", themeConfig.accent);
    root.style.setProperty("--ring", themeConfig.primary);
  };

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    applyTheme(themeId);
    localStorage.setItem("sidebarTheme", themeId);
    toast({ title: "Tema aplicado", description: "As cores do menu foram atualizadas." });
  };

  const handleSaveERP = () => {
    toast({ title: "Configurações Salvas", description: "Configurações de integração ERP atualizadas." });
    console.log("ERP Endpoint:", erpEndpoint);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie as preferências do seu aplicativo</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Aparência
            </CardTitle>
            <CardDescription>Personalize a aparência do aplicativo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Modo Escuro</Label>
                <p className="text-sm text-muted-foreground">Ativar tema escuro na interface</p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => {
                  setTheme(checked ? "dark" : "light");
                  setTimeout(() => applyTheme(selectedTheme), 100);
                }}
                data-testid="switch-dark-mode"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Cores do Menu
            </CardTitle>
            <CardDescription>Escolha o esquema de cores para o menu lateral</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sidebarThemes.map((themeOption) => (
                <button
                  key={themeOption.id}
                  onClick={() => handleThemeChange(themeOption.id)}
                  className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover-elevate ${
                    selectedTheme === themeOption.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                  data-testid={`button-theme-${themeOption.id}`}
                >
                  <div
                    className="w-10 h-10 rounded-full shadow-sm"
                    style={{ backgroundColor: `hsl(${themeOption.primary})` }}
                  />
                  <span className="text-xs font-medium text-center">{themeOption.name}</span>
                  {selectedTheme === themeOption.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              As cores sao aplicadas ao menu lateral e elementos de destaque da interface.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>Configure as preferências de notificação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificações de Pedidos</Label>
                <p className="text-sm text-muted-foreground">Receber alertas para novos pedidos</p>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={setNotifications}
                data-testid="switch-notifications"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Verificação de Idade
            </CardTitle>
            <CardDescription>Configure o popup de verificação 18+ para o site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Popup de Verificação 18+</Label>
                <p className="text-sm text-muted-foreground">
                  Exibir janela de verificação de idade antes de acessar o site
                </p>
              </div>
              <Switch
                checked={isAgePopupEnabled}
                onCheckedChange={(checked) => agePopupMutation.mutate(checked)}
                disabled={agePopupMutation.isPending}
                data-testid="switch-age-verification"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Quando ativado, visitantes precisarão confirmar que têm mais de 18 anos para acessar o catálogo.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Integração ERP
            </CardTitle>
            <CardDescription>Configure conexões com sistemas ERP externos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="erp-endpoint">Endpoint da API Bling ERP</Label>
              <Input
                id="erp-endpoint"
                placeholder="https://api.bling.com.br/v3"
                value={erpEndpoint}
                onChange={(e) => setErpEndpoint(e.target.value)}
                data-testid="input-erp-endpoint"
              />
              <p className="text-xs text-muted-foreground">
                Insira o endpoint da API Bling para sincronização de produtos e pedidos
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Status da Conexão</p>
                <p className="text-sm text-muted-foreground">Não conectado</p>
              </div>
              <Button variant="outline" onClick={handleSaveERP} data-testid="button-test-connection">
                Testar Conexão
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Gerenciamento de Dados
            </CardTitle>
            <CardDescription>Gerencie os dados do seu aplicativo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Exportar Todos os Dados</p>
                <p className="text-sm text-muted-foreground">Baixar produtos, pedidos e usuários como CSV</p>
              </div>
              <Button variant="outline" data-testid="button-export-data">
                Exportar
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Backup do Banco de Dados</p>
                <p className="text-sm text-muted-foreground">Criar um backup completo do banco de dados</p>
              </div>
              <Button variant="outline" data-testid="button-backup">
                Backup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
