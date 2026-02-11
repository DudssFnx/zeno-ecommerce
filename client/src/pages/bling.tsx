import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Eye,
  EyeOff,
  FolderSync,
  Link as LinkIcon,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Unlink,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

interface BlingStatus {
  authenticated: boolean;
  hasCredentials: boolean;
}

interface SyncResult {
  created: number;
  updated: number;
  errors?: string[];
}

// Helper to render pagination controls based on cached pages
function renderPaginationControls(
  pagesCache: Record<number, BlingProduct[]>,
  pageSize: number,
  currentPage: number,
  hasMore: boolean,
  loadPage: (p: number) => void,
  onSelect: (p: number) => void,
) {
  const fetchedPages = Object.keys(pagesCache)
    .map((v) => Number(v))
    .sort((a, b) => a - b);
  const totalFetched = fetchedPages.reduce(
    (sum, p) => sum + (pagesCache[p]?.length || 0),
    0,
  );
  const totalPages = Math.max(1, Math.ceil(totalFetched / pageSize));

  const pageButtons: React.ReactNode[] = [];

  // generate pages list with truncation for large number
  function pushPage(n: number) {
    pageButtons.push(
      <Button
        key={`p-${n}`}
        size="sm"
        variant={n === currentPage ? "default" : "ghost"}
        onClick={() => onSelect(n)}
      >
        {n}
      </Button>,
    );
  }

  if (totalPages <= 12) {
    for (let i = 1; i <= totalPages; i++) pushPage(i);
  } else {
    // show first 3, ellipsis, 2 around current, ellipsis, last 3
    pushPage(1);
    pushPage(2);
    pushPage(3);
    pageButtons.push(
      <span key="sep1" className="px-2 text-sm text-muted-foreground">
        ...
      </span>,
    );

    const start = Math.max(4, currentPage - 1);
    const end = Math.min(totalPages - 3, currentPage + 1);
    for (let i = start; i <= end; i++) pushPage(i);

    pageButtons.push(
      <span key="sep2" className="px-2 text-sm text-muted-foreground">
        ...
      </span>,
    );

    for (let i = totalPages - 2; i <= totalPages; i++) pushPage(i);
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={currentPage === 1}
        onClick={() => onSelect(Math.max(1, currentPage - 1))}
      >
        Prev
      </Button>
      {pageButtons}
      <Button
        size="sm"
        variant="outline"
        disabled={!hasMore && currentPage === Math.max(1, totalPages)}
        onClick={() => {
          const next = currentPage + 1;
          // if we haven't fetched next, trigger load
          if (!pagesCache[next]) {
            loadPage(next);
          }
          onSelect(next);
        }}
      >
        Next
      </Button>
    </div>
  );
}

interface SyncProgress {
  status: "idle" | "running" | "completed" | "error";
  phase: string;
  currentStep: number;
  totalSteps: number;
  message: string;
  created: number;
  updated: number;
  errors: number;
  startTime: number | null;
  estimatedRemaining: string | null;
}

interface BlingCategory {
  id: number;
  descricao: string;
  categoriaPai?: { id: number };
}

interface BlingProduct {
  id: number;
  nome: string;
  codigo: string;
  preco: number;
  situacao: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export default function BlingPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [activeTab, setActiveTab] = useState("categories");
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [blingCategories, setBlingCategories] = useState<BlingCategory[]>([]);
  const [blingProducts, setBlingProducts] = useState<BlingProduct[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // pagination for manual product preview
  const [productsPage, setProductsPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(100);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);

  // pagination cache: stores fetched pages by page number
  const [pagesCache, setPagesCache] = useState<Record<number, BlingProduct[]>>({});
  const [currentPreviewPage, setCurrentPreviewPage] = useState(1);

  // credentials masking
  const [clientSecretMasked, setClientSecretMasked] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);

  const { data: status, isLoading } = useQuery<BlingStatus>({
    queryKey: ["/api/bling/status"],
  });

  // --- Credentials stored per company ---
  const { data: credentials, refetch: refetchCredentials } = useQuery({
    queryKey: ["/api/bling/credentials"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/bling/credentials");
      return r.json();
    },
  });

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState<string | null>(null);
  const [redirectUri, setRedirectUri] = useState<string | null>(null);
  const [savingCreds, setSavingCreds] = useState(false);
  const [testingCreds, setTestingCreds] = useState(false);

  useEffect(() => {
    if (credentials?.hasCredentials) {
      setClientId(credentials.clientId || "");
      setClientSecret(""); // don't auto-populate raw secret
      setClientSecretMasked(credentials.clientSecretMasked || "");
      setApiEndpoint(
        credentials.apiEndpoint || "https://api.bling.com.br/Api/v3",
      );
      setRedirectUri(
        credentials.redirectUri ||
          `${window.location.origin}/api/bling/callback`,
      );
      setProductsPage(1);
      setHasMoreProducts(false);
      setBlingProducts([]);
    }
  }, [credentials]);

  const saveCredentials = async () => {
    setSavingCreds(true);
    try {
      const payload: any = { clientId, apiEndpoint, redirectUri };
      // include clientSecret only if user typed a value (prevents accidental overwrite with empty)
      if (clientSecret && clientSecret.length > 0)
        payload.clientSecret = clientSecret;

      const resp = await apiRequest("POST", "/api/bling/credentials", payload);
      const data = await resp.json();
      if (!resp.ok)
        throw new Error(data.message || "Failed to save credentials");

      if (data.normalized) {
        toast({
          title: "API Endpoint normalizado",
          description:
            data.message ||
            "O endpoint informado foi ajustado para o endpoint padrão do Bling",
          variant: "warning",
        });
      } else {
        toast({
          title: "Credenciais salvas",
          description: "Credenciais Bling atualizadas para a empresa.",
        });
      }

      // reset clientSecret input after save to avoid keeping raw secret in memory
      setClientSecret("");
      refetchCredentials();
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Falha ao salvar credenciais",
        variant: "destructive",
      });
    } finally {
      setSavingCreds(false);
    }
  };

  const testCredentials = async () => {
    setTestingCreds(true);
    try {
      const resp = await apiRequest("POST", "/api/bling/test-credentials", {
        clientId,
        clientSecret,
        apiEndpoint,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Falha ao testar");
      toast({ title: "Teste OK", description: data.message || "Endpoint OK" });
    } catch (err: any) {
      toast({
        title: "Erro no Teste",
        description: err.message || "Falha ao testar conexão",
        variant: "destructive",
      });
    } finally {
      setTestingCreds(false);
    }
  };

  // --- Webhook endpoints (per company) ---
  const { data: webhookEndpoints, refetch: refetchWebhookEndpoints } = useQuery(
    {
      queryKey: ["/api/bling/webhook-endpoints"],
      queryFn: async () => {
        const r = await apiRequest("GET", "/api/bling/webhook-endpoints");
        if (!r.ok) throw new Error("Failed to load webhook endpoints");
        return r.json();
      },
      enabled: !!status?.authenticated,
    },
  );

  const addWebhookMutation = useMutation({
    mutationFn: async (url: string) => {
      const resp = await apiRequest("POST", "/api/bling/webhook-endpoints", {
        url,
      });
      return resp.json();
    },
    onSuccess: () => {
      toast({
        title: "Endpoint salvo",
        description: "Endpoint de webhook salvo com sucesso",
      });
      refetchWebhookEndpoints();
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: err.message || "Falha ao salvar endpoint",
        variant: "destructive",
      });
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: number) => {
      const resp = await apiRequest(
        "DELETE",
        `/api/bling/webhook-endpoints/${id}`,
      );
      return resp.json();
    },
    onSuccess: () => {
      toast({ title: "Removido", description: "Endpoint removido" });
      refetchWebhookEndpoints();
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: async (id: number) => {
      const resp = await apiRequest(
        "POST",
        `/api/bling/webhook-endpoints/${id}/test`,
      );
      return resp.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Teste executado", description: `Status ${data.status}` });
      refetchWebhookEndpoints();
    },
    onError: (err: any) => {
      toast({
        title: "Erro no Teste",
        description: err.message || "Falha ao testar endpoint",
        variant: "destructive",
      });
    },
  });

  const [newEndpointUrl, setNewEndpointUrl] = useState("");
  const handleAddEndpoint = () => {
    if (!newEndpointUrl.trim())
      return toast({
        title: "URL necessária",
        description: "Informe a URL do endpoint",
        variant: "destructive",
      });
    addWebhookMutation.mutate(newEndpointUrl.trim());
  };

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

  useEffect(() => {
    if (status?.authenticated) {
      const eventSource = new EventSource("/api/bling/sync/progress", {
        withCredentials: true,
      });
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const progress: SyncProgress = JSON.parse(event.data);
          setSyncProgress(progress);

          if (progress.status === "completed") {
            queryClient.invalidateQueries({ queryKey: ["/api/products"] });
            toast({
              title: "Sincronização Concluída",
              description: `${progress.created} criados, ${progress.updated} atualizados${progress.errors > 0 ? `, ${progress.errors} erros` : ""}`,
            });
          }
        } catch (e) {
          console.error("Error parsing SSE data:", e);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    }
  }, [status?.authenticated, toast]);

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

  const loadBlingCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await apiRequest("GET", "/api/bling/categories/preview");
      const data = await response.json();
      setBlingCategories(data.categories || []);
      setSelectedCategories([]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar categorias",
        description: error.message || "Falha ao buscar categorias do Bling",
        variant: "destructive",
      });
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadBlingProducts = async (page: number = 1): Promise<BlingProduct[]> => {
    setLoadingProducts(true);
    try {
      const response = await apiRequest(
        "GET",
        `/api/bling/products/preview?page=${page}&limit=${pageSize}`,
      );
      const data = await response.json();
      const products = data.products || [];

      // cache fetched page
      setPagesCache((prev) => ({ ...prev, [page]: products }));

      // If requesting the current preview page or first page, show it
      if (page === currentPreviewPage || page === 1) {
        setBlingProducts(products);
        setSelectedProducts([]);
        setCurrentPreviewPage(page);
      }

      setProductsPage(page);
      setHasMoreProducts(products.length === pageSize);
      return products;
    } catch (error: any) {
      toast({
        title: "Erro ao carregar produtos",
        description: error.message || "Falha ao buscar produtos do Bling",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoadingProducts(false);
    }
  };

  const importCategoriesMutation = useMutation({
    mutationFn: async (categoryIds: number[]) => {
      const response = await apiRequest(
        "POST",
        "/api/bling/categories/import",
        { categoryIds },
      );
      return response.json();
    },
    onSuccess: (data: ImportResult) => {
      toast({
        title: "Categorias importadas",
        description: `${data.imported} importadas, ${data.skipped} já existentes`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setSelectedCategories([]);
      loadBlingCategories();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao importar categorias",
        description:
          error.message || "Falha ao importar categorias selecionadas",
        variant: "destructive",
      });
    },
  });

  const importProductsMutation = useMutation({
    mutationFn: async (productIds: number[]) => {
      const response = await apiRequest("POST", "/api/bling/products/import", {
        productIds,
      });
      return response.json();
    },
    onSuccess: (data: ImportResult) => {
      toast({
        title: "Produtos importados",
        description: `${data.imported} importados, ${data.skipped} já existentes`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedProducts([]);
      loadBlingProducts();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao importar produtos",
        description: error.message || "Falha ao importar produtos selecionados",
        variant: "destructive",
      });
    },
  });

  const importSingleProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      const response = await apiRequest(
        "POST",
        `/api/bling/products/${productId}/import`,
      );
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Produto importado",
        description: data.message || "Produto importado",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      loadBlingProducts();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao importar produto",
        description: error.message || "Falha ao importar produto",
        variant: "destructive",
      });
    },
  });

  const syncSingleProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      const response = await apiRequest(
        "POST",
        `/api/bling/products/${productId}/sync`,
      );
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Produto atualizado",
        description: data.message || "Produto atualizado",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      loadBlingProducts();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar produto",
        description: error.message || "Falha ao atualizar produto",
        variant: "destructive",
      });
    },
  });

  const toggleCategorySelection = (id: number) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const toggleProductSelection = (id: number) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const selectAllCategories = () => {
    if (selectedCategories.length === blingCategories.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(blingCategories.map((c) => c.id));
    }
  };

  const selectAllProducts = () => {
    if (selectedProducts.length === blingProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(blingProducts.map((p) => p.id));
    }
  };

  const isSyncing = syncProgress?.status === "running";
  const progressPercent =
    syncProgress && syncProgress.totalSteps > 0
      ? Math.round((syncProgress.currentStep / syncProgress.totalSteps) * 100)
      : 0;

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
        <h1 className="text-2xl font-bold" data-testid="text-bling-title">
          Integração Bling
        </h1>
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
              {status?.hasCredentials || credentials?.hasCredentials ? (
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Configuradas
                </Badge>
              ) : (
                <Badge
                  variant="destructive"
                  className="flex items-center gap-1"
                >
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
            <div className="flex items-center gap-2">
              {!status?.authenticated && (
                <Button
                  onClick={handleConnect}
                  data-testid="button-bling-connect"
                >
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

            {/* Bling credentials form - centralizar configuração aqui */}
            <div className="w-full mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="client-id">Client ID</Label>
                  <Input
                    id="client-id"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Client ID"
                  />
                </div>
                <div>
                  <Label htmlFor="client-secret">Client Secret</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="client-secret"
                      value={showSecret ? clientSecret : clientSecretMasked}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="Client Secret"
                      type={showSecret ? "text" : "password"}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (showSecret) {
                          // hide secret
                          setShowSecret(false);
                          setClientSecret("");
                        } else {
                          // reveal secret from server
                          setRevealLoading(true);
                          try {
                            const r = await apiRequest(
                              "GET",
                              "/api/bling/credentials/secret",
                            );
                            if (!r.ok)
                              throw new Error("Failed to fetch secret");
                            const d = await r.json();
                            setClientSecret(d.clientSecret || "");
                            setShowSecret(true);
                          } catch (e: any) {
                            toast({
                              title: "Erro",
                              description:
                                e.message || "Falha ao revelar secret",
                              variant: "destructive",
                            });
                          } finally {
                            setRevealLoading(false);
                          }
                        }
                      }}
                    >
                      {revealLoading ? (
                        <Loader2 className="h-4 w-4" />
                      ) : showSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="api-endpoint">API Endpoint</Label>
                  <Input
                    id="api-endpoint"
                    value={apiEndpoint || ""}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    placeholder="https://api.bling.com.br/Api/v3"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="redirect-uri">Redirect URI</Label>
                  <Input
                    id="redirect-uri"
                    value={redirectUri || ""}
                    onChange={(e) => setRedirectUri(e.target.value)}
                    placeholder={`${window.location.origin}/api/bling/callback`}
                  />
                  <CardDescription>
                    Deve ser idêntico ao Redirect URI registrado no app do Bling
                    (match exato).
                  </CardDescription>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <Button
                  onClick={saveCredentials}
                  disabled={savingCreds}
                  data-testid="button-save-bling-credentials"
                >
                  {savingCreds ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Salvar Credenciais
                </Button>
                <Button
                  variant="outline"
                  onClick={testCredentials}
                  disabled={testingCreds}
                  data-testid="button-test-bling-credentials"
                >
                  {testingCreds ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Testar Conexão
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => (window.location.href = "/api/bling/auth")}
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Autorizar (OAuth)
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook endpoints management */}
      {status?.authenticated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Webhook Endpoints
            </CardTitle>
            <CardDescription>
              Configure URLs que receberão webhooks do Bling (por empresa)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2">
                <Label htmlFor="new-endpoint">Add endpoint</Label>
                <Input
                  id="new-endpoint"
                  placeholder="https://example.com/webhook"
                  value={newEndpointUrl}
                  onChange={(e) => setNewEndpointUrl(e.target.value)}
                />
              </div>
              <div>
                <Button
                  onClick={handleAddEndpoint}
                  disabled={addWebhookMutation.isPending}
                  className="w-full"
                >
                  {addWebhookMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <LinkIcon className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>

            <div className="mt-4">
              {webhookEndpoints && webhookEndpoints.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum endpoint configurado.
                </p>
              )}

              {webhookEndpoints && webhookEndpoints.length > 0 && (
                <div className="space-y-2">
                  {webhookEndpoints.map((ep: any) => (
                    <div
                      key={ep.id}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium truncate">
                          {ep.url}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Último status: {ep.lastStatusCode ?? "N/A"}{" "}
                          {ep.lastCalledAt
                            ? `- ${new Date(ep.lastCalledAt).toLocaleString()}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testWebhookMutation.mutate(ep.id)}
                          disabled={testWebhookMutation.isPending}
                        >
                          Testar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteWebhookMutation.mutate(ep.id)}
                          disabled={deleteWebhookMutation.isPending}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                disabled={syncCategoriesMutation.isPending || isSyncing}
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
                disabled={syncProductsMutation.isPending || isSyncing}
                data-testid="button-sync-products"
              >
                {syncProductsMutation.isPending || isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Package className="h-4 w-4 mr-2" />
                )}
                Sincronizar Produtos
              </Button>
            </div>

            {isSyncing && syncProgress && (
              <div
                className="space-y-3 p-4 bg-muted/50 rounded-md"
                data-testid="sync-progress-container"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="font-medium text-sm">
                      {syncProgress.phase}
                    </span>
                  </div>
                  {syncProgress.estimatedRemaining && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>~{syncProgress.estimatedRemaining}</span>
                    </div>
                  )}
                </div>

                <Progress
                  value={progressPercent}
                  className="h-2"
                  data-testid="sync-progress-bar"
                />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {syncProgress.message}
                  </span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>

                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>{syncProgress.created} novos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 text-blue-500" />
                    <span>{syncProgress.updated} atualizados</span>
                  </div>
                  {syncProgress.errors > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      <span>{syncProgress.errors} erros</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {syncProgress?.status === "completed" && (
              <div
                className="p-4 bg-green-500/10 border border-green-500/20 rounded-md"
                data-testid="sync-completed"
              >
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">{syncProgress.message}</span>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {syncProgress.created} produtos criados,{" "}
                  {syncProgress.updated} atualizados
                  {syncProgress.errors > 0 && `, ${syncProgress.errors} erros`}
                </div>
              </div>
            )}

            {syncProgress?.status === "error" && (
              <div
                className="p-4 bg-destructive/10 border border-destructive/20 rounded-md"
                data-testid="sync-error"
              >
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">{syncProgress.message}</span>
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              A sincronização irá importar ou atualizar categorias e produtos da
              sua conta Bling.
            </p>
          </CardContent>
        </Card>
      )}

      {status?.authenticated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Importação Manual
            </CardTitle>
            <CardDescription>
              Selecione categorias e produtos específicos para importar do Bling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="categories" data-testid="tab-categories">
                  <FolderSync className="h-4 w-4 mr-2" />
                  Categorias
                </TabsTrigger>
                <TabsTrigger value="products" data-testid="tab-products">
                  <Package className="h-4 w-4 mr-2" />
                  Produtos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="categories" className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={loadBlingCategories}
                    disabled={loadingCategories}
                    data-testid="button-load-categories"
                  >
                    {loadingCategories ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    Carregar Categorias
                  </Button>
                  {blingCategories.length > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAllCategories}
                        data-testid="button-select-all-categories"
                      >
                        {selectedCategories.length === blingCategories.length
                          ? "Desmarcar Tudo"
                          : "Selecionar Tudo"}
                      </Button>
                      <Badge variant="secondary">
                        {selectedCategories.length} de {blingCategories.length}{" "}
                        selecionadas
                      </Badge>
                    </>
                  )}
                </div>

                {blingCategories.length > 0 && (
                  <ScrollArea className="h-80 border rounded-md p-3">
                    <div className="space-y-1">
                      {/* Show parent categories first, then their subcategories */}
                      {blingCategories
                        .filter((cat) => !cat.categoriaPai)
                        .map((parentCat) => {
                          const subcategories = blingCategories.filter(
                            (sub) => sub.categoriaPai?.id === parentCat.id,
                          );
                          return (
                            <div key={parentCat.id} className="space-y-1">
                              <label
                                className="flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer bg-muted/30"
                                data-testid={`category-item-${parentCat.id}`}
                              >
                                <Checkbox
                                  checked={selectedCategories.includes(
                                    parentCat.id,
                                  )}
                                  onCheckedChange={() =>
                                    toggleCategorySelection(parentCat.id)
                                  }
                                  data-testid={`checkbox-category-${parentCat.id}`}
                                />
                                <div className="flex-1">
                                  <span className="text-sm font-semibold">
                                    {parentCat.descricao}
                                  </span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    (Categoria)
                                  </span>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  ID: {parentCat.id}
                                </Badge>
                              </label>
                              {subcategories.map((subCat) => (
                                <label
                                  key={subCat.id}
                                  className="flex items-center gap-3 p-2 pl-8 rounded-md hover-elevate cursor-pointer"
                                  data-testid={`category-item-${subCat.id}`}
                                >
                                  <Checkbox
                                    checked={selectedCategories.includes(
                                      subCat.id,
                                    )}
                                    onCheckedChange={() =>
                                      toggleCategorySelection(subCat.id)
                                    }
                                    data-testid={`checkbox-category-${subCat.id}`}
                                  />
                                  <div className="flex-1">
                                    <span className="text-sm">
                                      {subCat.descricao}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      (Subcategoria)
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    ID: {subCat.id}
                                  </Badge>
                                </label>
                              ))}
                            </div>
                          );
                        })}
                      {/* Show orphan subcategories (parent not in list) */}
                      {blingCategories
                        .filter(
                          (cat) =>
                            cat.categoriaPai &&
                            !blingCategories.find(
                              (p) => p.id === cat.categoriaPai?.id,
                            ),
                        )
                        .map((orphanCat) => (
                          <label
                            key={orphanCat.id}
                            className="flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                            data-testid={`category-item-${orphanCat.id}`}
                          >
                            <Checkbox
                              checked={selectedCategories.includes(
                                orphanCat.id,
                              )}
                              onCheckedChange={() =>
                                toggleCategorySelection(orphanCat.id)
                              }
                              data-testid={`checkbox-category-${orphanCat.id}`}
                            />
                            <div className="flex-1">
                              <span className="text-sm">
                                {orphanCat.descricao}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                (Subcategoria órfã)
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              ID: {orphanCat.id}
                            </Badge>
                          </label>
                        ))}
                    </div>
                  </ScrollArea>
                )}

                {blingCategories.length > 0 && (
                  <Button
                    onClick={() =>
                      importCategoriesMutation.mutate(selectedCategories)
                    }
                    disabled={
                      selectedCategories.length === 0 ||
                      importCategoriesMutation.isPending
                    }
                    data-testid="button-import-categories"
                  >
                    {importCategoriesMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Importar {selectedCategories.length} Categoria
                    {selectedCategories.length !== 1 ? "s" : ""}
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="products" className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => loadBlingProducts(1)}
                      disabled={loadingProducts}
                      data-testid="button-load-products"
                    >
                      {loadingProducts ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Carregar Produtos
                    </Button>

                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setProductsPage(1);
                        setBlingProducts([]);
                        setPagesCache({});
                        setCurrentPreviewPage(1);
                      }}
                      className="bg-muted rounded-md px-2 py-1 text-sm"
                      aria-label="Tamanho da página"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>

                    {blingProducts.length > 0 && hasMoreProducts && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          const next = productsPage + 1;
                          const fetched = await loadBlingProducts(next);
                          // ensure preview navigates to newly fetched page
                          setCurrentPreviewPage(next);
                          setBlingProducts(fetched);
                        }}
                        disabled={loadingProducts}
                        size="sm"
                      >
                        Carregar mais
                      </Button>
                    )}
                  </div>
                  {blingProducts.length > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAllProducts}
                        data-testid="button-select-all-products"
                      >
                        {selectedProducts.length === blingProducts.length
                          ? "Desmarcar Tudo"
                          : "Selecionar Tudo"}
                      </Button>
                      <Badge variant="secondary">
                        {selectedProducts.length} de {blingProducts.length}{" "}
                        selecionados
                      </Badge>
                    </>
                  )}
                </div>

                {blingProducts.length > 0 && (
                  <>
                    <ScrollArea className="h-64 border rounded-md p-3">
                      <div className="space-y-2">
                        {blingProducts.map((product) => (
                          <label
                            key={product.id}
                            className="flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                            data-testid={`product-item-${product.id}`}
                          >
                            <Checkbox
                              checked={selectedProducts.includes(product.id)}
                              onCheckedChange={() => toggleProductSelection(product.id)}
                              data-testid={`checkbox-product-${product.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {product.nome}
                              </div>
                              <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                                <span>SKU: {product.codigo}</span>
                                <span>R$ {product.preco?.toFixed(2) || "0.00"}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={product.situacao === "A" ? "secondary" : "destructive"}
                              >
                                {product.situacao === "A" ? "Ativo" : "Inativo"}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => importSingleProductMutation.mutate(product.id)}
                              >
                                Importar
                              </Button>
                            </div>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>

                    {/* Pagination controls based on fetched pages */}
                    <div className="mt-3 flex items-center justify-center gap-2">
                      {renderPaginationControls(pagesCache, pageSize, currentPreviewPage, hasMoreProducts, loadBlingProducts, (p:number)=>{
                        setCurrentPreviewPage(p);
                        // show cached page if available
                        const cached = pagesCache[p];
                        if (cached) {
                          setBlingProducts(cached);
                          setSelectedProducts([]);
                        } else {
                          loadBlingProducts(p);
                        }
                      })}
                    </div>
                  </>
                )}

                {blingProducts.length > 0 && (
                  <Button
                    onClick={() =>
                      importProductsMutation.mutate(selectedProducts)
                    }
                    disabled={
                      selectedProducts.length === 0 ||
                      importProductsMutation.isPending
                    }
                    data-testid="button-import-products"
                  >
                    {importProductsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Importar {selectedProducts.length} Produto
                    {selectedProducts.length !== 1 ? "s" : ""}
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
