import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, RefreshCw, Link as LinkIcon, FolderSync, Package, Unlink } from "lucide-react";

interface BlingStatus {
  authenticated: boolean;
  hasCredentials: boolean;
}

interface SyncResult {
  created: number;
  updated: number;
  errors?: string[];
}

export default function BlingPage() {
  const { toast } = useToast();
  const [location] = useLocation();

  const { data: status, isLoading } = useQuery<BlingStatus>({
    queryKey: ["/api/bling/status"],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast({
        title: "Conectado ao Bling",
        description: "Sua conta Bling foi conectada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bling/status"] });
      window.history.replaceState({}, "", "/bling");
    } else if (params.get("error") === "auth_failed") {
      toast({
        title: "Falha na Conexão",
        description: "Falha ao conectar ao Bling. Por favor, tente novamente.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/bling");
    }
  }, [location, toast]);

  const syncCategoriesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/bling/sync/categories");
      return response.json();
    },
    onSuccess: (data: SyncResult) => {
      toast({
        title: "Categorias Sincronizadas",
        description: `Criadas: ${data.created}, Atualizadas: ${data.updated}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    },
    onError: (error: any) => {
      toast({
        title: "Falha na Sincronização",
        description: error.message || "Falha ao sincronizar categorias",
        variant: "destructive",
      });
    },
  });

  const syncProductsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/bling/sync/products");
      return response.json();
    },
    onSuccess: (data: SyncResult) => {
      const message = `Criados: ${data.created}, Atualizados: ${data.updated}`;
      const errorCount = data.errors?.length || 0;
      toast({
        title: "Produtos Sincronizados",
        description: errorCount > 0 ? `${message}. Erros: ${errorCount}` : message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: any) => {
      toast({
        title: "Falha na Sincronização",
        description: error.message || "Falha ao sincronizar produtos",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/bling/disconnect");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Desconectado",
        description: "Sua conta Bling foi desconectada.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bling/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar",
        variant: "destructive",
      });
    },
  });

  const handleConnect = () => {
    window.location.href = "/api/bling/auth";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-bling-title">Integração Bling</h1>
        <p className="text-muted-foreground">
          Conecte sua conta Bling para sincronizar produtos e categorias.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Status da Conexão
          </CardTitle>
          <CardDescription>
            Status da sua conexão com a API Bling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Credenciais:</span>
              {status?.hasCredentials ? (
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Configuradas
                </Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Ausentes
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Autenticação:</span>
              {status?.authenticated ? (
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Não Conectado
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {status?.hasCredentials && !status?.authenticated && (
              <Button onClick={handleConnect} data-testid="button-bling-connect">
                <LinkIcon className="h-4 w-4 mr-2" />
                Conectar ao Bling
              </Button>
            )}

            {status?.authenticated && (
              <Button 
                variant="destructive" 
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                data-testid="button-bling-disconnect"
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4 mr-2" />
                )}
                Desconectar
              </Button>
            )}
          </div>

          {!status?.hasCredentials && (
            <p className="text-sm text-muted-foreground">
              Por favor, configure BLING_CLIENT_ID e BLING_CLIENT_SECRET no seu ambiente.
            </p>
          )}
        </CardContent>
      </Card>

      {status?.authenticated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Sincronização
            </CardTitle>
            <CardDescription>
              Sincronize dados do Bling para seu catálogo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => syncCategoriesMutation.mutate()}
                disabled={syncCategoriesMutation.isPending}
                variant="outline"
                data-testid="button-sync-categories"
              >
                {syncCategoriesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FolderSync className="h-4 w-4 mr-2" />
                )}
                Sincronizar Categorias
              </Button>

              <Button
                onClick={() => syncProductsMutation.mutate()}
                disabled={syncProductsMutation.isPending}
                data-testid="button-sync-products"
              >
                {syncProductsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Package className="h-4 w-4 mr-2" />
                )}
                Sincronizar Produtos
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              A sincronização irá importar ou atualizar categorias e produtos da sua conta Bling.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
