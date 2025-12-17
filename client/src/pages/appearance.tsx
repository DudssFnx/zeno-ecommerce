import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Palette, Image, Layout, Store, Layers, Check, Plus, Trash2, Edit, GripVertical, Upload, Building2 } from "lucide-react";
import type { CatalogSlide } from "@shared/schema";

const colorThemes = [
  { id: "orange", name: "Laranja", primary: "25 95% 53%", description: "Vibrante e energico" },
  { id: "blue", name: "Azul", primary: "217 91% 60%", description: "Corporativo e confiavel" },
  { id: "green", name: "Verde", primary: "142 71% 45%", description: "Natural e fresco" },
  { id: "purple", name: "Roxo", primary: "262 83% 58%", description: "Elegante e moderno" },
  { id: "red", name: "Vermelho", primary: "0 84% 60%", description: "Intenso e marcante" },
  { id: "teal", name: "Verde Agua", primary: "173 80% 40%", description: "Calmo e sofisticado" },
  { id: "pink", name: "Rosa", primary: "330 80% 60%", description: "Moderno e jovem" },
  { id: "amber", name: "Dourado", primary: "45 93% 47%", description: "Premium e luxuoso" },
];

const designTemplates = [
  { id: "modern", name: "Moderno", description: "Design limpo com bordas arredondadas" },
  { id: "classic", name: "Classico", description: "Estilo tradicional e profissional" },
  { id: "minimal", name: "Minimalista", description: "Foco no conteudo, sem distrações" },
  { id: "bold", name: "Impactante", description: "Cores fortes e elementos grandes" },
];

const productsPerRowOptions = [
  { value: "2", label: "2 produtos" },
  { value: "3", label: "3 produtos" },
  { value: "4", label: "4 produtos" },
  { value: "5", label: "5 produtos" },
  { value: "6", label: "6 produtos" },
];

const categoryPositionOptions = [
  { value: "top", label: "Topo (Horizontal)" },
  { value: "left", label: "Lateral Esquerda" },
  { value: "hidden", label: "Oculto" },
];

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [selectedColor, setSelectedColor] = useState("orange");
  const [selectedTemplate, setSelectedTemplate] = useState("modern");
  const [productsPerRow, setProductsPerRow] = useState("4");
  const [categoryPosition, setCategoryPosition] = useState("top");
  const [isSlideDialogOpen, setIsSlideDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<CatalogSlide | null>(null);
  const [slideForm, setSlideForm] = useState({ title: "", imageUrl: "", buttonLink: "", active: true, order: 0 });

  const [storeName, setStoreName] = useState("");
  const [storeCnpj, setStoreCnpj] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeLogo, setStoreLogo] = useState("");

  const { data: slides = [], isLoading: slidesLoading } = useQuery<CatalogSlide[]>({
    queryKey: ['/api/catalog/slides'],
  });

  const { data: wholesaleSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/wholesale_mode'],
  });

  const { data: deliveryModeSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/delivery_catalog_mode'],
  });

  const { data: storeNameSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/store_name'],
  });

  const { data: storeCnpjSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/store_cnpj'],
  });

  const { data: storePhoneSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/store_phone'],
  });

  const { data: storeEmailSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/store_email'],
  });

  const { data: storeAddressSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/store_address'],
  });

  const { data: storeLogoSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/store_logo'],
  });

  const { data: colorSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/primary_color'],
  });

  const { data: templateSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/design_template'],
  });

  const { data: productsPerRowSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/products_per_row'],
  });

  const { data: categoryPositionSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/category_position'],
  });

  useEffect(() => {
    if (colorSetting?.value) setSelectedColor(colorSetting.value);
    if (templateSetting?.value) setSelectedTemplate(templateSetting.value);
    if (productsPerRowSetting?.value) setProductsPerRow(productsPerRowSetting.value);
    if (categoryPositionSetting?.value) setCategoryPosition(categoryPositionSetting.value);
    if (storeNameSetting?.value) setStoreName(storeNameSetting.value);
    if (storeCnpjSetting?.value) setStoreCnpj(storeCnpjSetting.value);
    if (storePhoneSetting?.value) setStorePhone(storePhoneSetting.value);
    if (storeEmailSetting?.value) setStoreEmail(storeEmailSetting.value);
    if (storeAddressSetting?.value) setStoreAddress(storeAddressSetting.value);
    if (storeLogoSetting?.value) setStoreLogo(storeLogoSetting.value);
  }, [colorSetting, templateSetting, productsPerRowSetting, categoryPositionSetting, storeNameSetting, storeCnpjSetting, storePhoneSetting, storeEmailSetting, storeAddressSetting, storeLogoSetting]);

  const saveSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest('POST', `/api/settings/${key}`, { value });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/${variables.key}`] });
      toast({ title: "Salvo", description: "Configuração atualizada com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    },
  });

  const createSlide = useMutation({
    mutationFn: async (data: { title: string; imageUrl: string; buttonLink: string; active: boolean; order: number }) => {
      return apiRequest('POST', '/api/catalog/slides', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/catalog/slides'] });
      setIsSlideDialogOpen(false);
      setSlideForm({ title: "", imageUrl: "", buttonLink: "", active: true, order: 0 });
      toast({ title: "Banner criado", description: "O banner foi adicionado ao carrossel." });
    },
  });

  const updateSlide = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CatalogSlide> }) => {
      return apiRequest('PATCH', `/api/catalog/slides/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/catalog/slides'] });
      setIsSlideDialogOpen(false);
      setEditingSlide(null);
      setSlideForm({ title: "", imageUrl: "", buttonLink: "", active: true, order: 0 });
      toast({ title: "Banner atualizado" });
    },
  });

  const deleteSlide = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/catalog/slides/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/catalog/slides'] });
      toast({ title: "Banner removido" });
    },
  });

  const isWholesaleEnabled = wholesaleSetting?.value === 'true';
  const isDeliveryModeEnabled = deliveryModeSetting?.value === 'true';

  const handleColorChange = (colorId: string) => {
    setSelectedColor(colorId);
    const themeConfig = colorThemes.find(t => t.id === colorId);
    if (themeConfig) {
      document.documentElement.style.setProperty("--primary", themeConfig.primary);
      localStorage.setItem("sidebarTheme", colorId);
    }
    saveSetting.mutate({ key: 'primary_color', value: colorId });
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    saveSetting.mutate({ key: 'design_template', value: templateId });
  };

  const handleOpenSlideDialog = (slide?: CatalogSlide) => {
    if (slide) {
      setEditingSlide(slide);
      setSlideForm({
        title: slide.title || "",
        imageUrl: slide.imageUrl,
        buttonLink: slide.buttonLink || "",
        active: slide.active,
        order: slide.order,
      });
    } else {
      setEditingSlide(null);
      setSlideForm({ title: "", imageUrl: "", buttonLink: "", active: true, order: 0 });
    }
    setIsSlideDialogOpen(true);
  };

  const handleSaveSlide = () => {
    if (!slideForm.imageUrl) {
      toast({ title: "Erro", description: "Informe a URL da imagem.", variant: "destructive" });
      return;
    }
    if (editingSlide) {
      updateSlide.mutate({ id: editingSlide.id, data: slideForm });
    } else {
      createSlide.mutate(slideForm);
    }
  };

  const handleSaveStoreInfo = () => {
    saveSetting.mutate({ key: 'store_name', value: storeName });
    saveSetting.mutate({ key: 'store_cnpj', value: storeCnpj });
    saveSetting.mutate({ key: 'store_phone', value: storePhone });
    saveSetting.mutate({ key: 'store_email', value: storeEmail });
    saveSetting.mutate({ key: 'store_address', value: storeAddress });
    if (storeLogo) {
      saveSetting.mutate({ key: 'store_logo', value: storeLogo });
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-semibold">Aparência</h1>
        <p className="text-muted-foreground mt-1">Personalize a aparência do seu site como um white-label</p>
      </div>

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="branding" className="flex items-center gap-1.5" data-testid="tab-branding">
            <Store className="w-4 h-4" />
            <span className="hidden sm:inline">Loja</span>
          </TabsTrigger>
          <TabsTrigger value="banners" className="flex items-center gap-1.5" data-testid="tab-banners">
            <Image className="w-4 h-4" />
            <span className="hidden sm:inline">Banners</span>
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex items-center gap-1.5" data-testid="tab-colors">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Cores</span>
          </TabsTrigger>
          <TabsTrigger value="layout" className="flex items-center gap-1.5" data-testid="tab-layout">
            <Layout className="w-4 h-4" />
            <span className="hidden sm:inline">Layout</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1.5" data-testid="tab-templates">
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados da Loja
              </CardTitle>
              <CardDescription>Informações que aparecem no site e documentos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome da Loja</Label>
                  <Input 
                    placeholder="Minha Loja" 
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    data-testid="input-store-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input 
                    placeholder="00.000.000/0000-00" 
                    value={storeCnpj}
                    onChange={(e) => setStoreCnpj(e.target.value)}
                    data-testid="input-store-cnpj"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input 
                    placeholder="(00) 00000-0000" 
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    data-testid="input-store-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input 
                    placeholder="contato@loja.com" 
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    data-testid="input-store-email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input 
                  placeholder="Rua, número, bairro, cidade - UF" 
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  data-testid="input-store-address"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Logo da Loja (URL)</Label>
                <Input 
                  placeholder="https://exemplo.com/logo.png" 
                  value={storeLogo}
                  onChange={(e) => setStoreLogo(e.target.value)}
                  data-testid="input-store-logo"
                />
                {storeLogo && (
                  <div className="mt-2 p-4 border rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-2">Prévia:</p>
                    <img src={storeLogo} alt="Logo" className="max-h-16 object-contain" />
                  </div>
                )}
              </div>
              <Button onClick={handleSaveStoreInfo} disabled={saveSetting.isPending} data-testid="button-save-store">
                Salvar Dados da Loja
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modos de Exibição</CardTitle>
              <CardDescription>Configure como o catálogo é exibido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Modo Atacado</Label>
                  <p className="text-sm text-muted-foreground">Exibir preços e opções para atacado</p>
                </div>
                <Switch
                  checked={isWholesaleEnabled}
                  onCheckedChange={(checked) => saveSetting.mutate({ key: 'wholesale_mode', value: checked ? 'true' : 'false' })}
                  data-testid="switch-wholesale-mode"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Modo Delivery (iFood)</Label>
                  <p className="text-sm text-muted-foreground">Layout estilo aplicativo de delivery</p>
                </div>
                <Switch
                  checked={isDeliveryModeEnabled}
                  onCheckedChange={(checked) => saveSetting.mutate({ key: 'delivery_catalog_mode', value: checked ? 'true' : 'false' })}
                  data-testid="switch-delivery-mode"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Modo Escuro</Label>
                  <p className="text-sm text-muted-foreground">Tema escuro para a interface</p>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  data-testid="switch-dark-mode"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banners" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Banners do Carrossel
                </CardTitle>
                <CardDescription>Gerencie as imagens do carrossel principal</CardDescription>
              </div>
              <Dialog open={isSlideDialogOpen} onOpenChange={setIsSlideDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => handleOpenSlideDialog()} data-testid="button-add-banner">
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingSlide ? "Editar Banner" : "Novo Banner"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Título (opcional)</Label>
                      <Input 
                        placeholder="Promoção de verão" 
                        value={slideForm.title}
                        onChange={(e) => setSlideForm({ ...slideForm, title: e.target.value })}
                        data-testid="input-banner-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL da Imagem *</Label>
                      <Input 
                        placeholder="https://exemplo.com/banner.jpg" 
                        value={slideForm.imageUrl}
                        onChange={(e) => setSlideForm({ ...slideForm, imageUrl: e.target.value })}
                        data-testid="input-banner-image"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Link ao clicar (opcional)</Label>
                      <Input 
                        placeholder="https://loja.com/promocao" 
                        value={slideForm.buttonLink}
                        onChange={(e) => setSlideForm({ ...slideForm, buttonLink: e.target.value })}
                        data-testid="input-banner-link"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={slideForm.active}
                        onCheckedChange={(checked) => setSlideForm({ ...slideForm, active: checked })}
                        data-testid="switch-banner-active"
                      />
                      <Label>Banner ativo</Label>
                    </div>
                    {slideForm.imageUrl && (
                      <div className="border rounded-lg overflow-hidden">
                        <img src={slideForm.imageUrl} alt="Preview" className="w-full h-32 object-cover" />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSlideDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSaveSlide} disabled={createSlide.isPending || updateSlide.isPending} data-testid="button-save-banner">
                      {editingSlide ? "Salvar" : "Adicionar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {slidesLoading ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : slides.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Image className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhum banner cadastrado</p>
                  <p className="text-sm">Clique em "Adicionar" para criar o primeiro</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {slides.map((slide) => (
                    <div 
                      key={slide.id} 
                      className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                      data-testid={`banner-item-${slide.id}`}
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      <div className="w-24 h-14 rounded overflow-hidden bg-muted shrink-0">
                        <img src={slide.imageUrl} alt={slide.title || "Banner"} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{slide.title || "Sem título"}</p>
                        <p className="text-xs text-muted-foreground truncate">{slide.imageUrl}</p>
                      </div>
                      <Badge variant={slide.active ? "default" : "secondary"}>
                        {slide.active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => handleOpenSlideDialog(slide)} data-testid={`button-edit-banner-${slide.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteSlide.mutate(slide.id)} data-testid={`button-delete-banner-${slide.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Cor Principal
              </CardTitle>
              <CardDescription>Escolha a cor que define a identidade visual do site</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {colorThemes.map((colorOption) => (
                  <button
                    key={colorOption.id}
                    onClick={() => handleColorChange(colorOption.id)}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover-elevate ${
                      selectedColor === colorOption.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    data-testid={`button-color-${colorOption.id}`}
                  >
                    <div
                      className="w-12 h-12 rounded-full shadow-sm"
                      style={{ backgroundColor: `hsl(${colorOption.primary})` }}
                    />
                    <span className="text-sm font-medium">{colorOption.name}</span>
                    <span className="text-xs text-muted-foreground text-center">{colorOption.description}</span>
                    {selectedColor === colorOption.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layout" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Configurações de Layout
              </CardTitle>
              <CardDescription>Ajuste como os produtos são exibidos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Produtos por Linha (Desktop)</Label>
                  <Select value={productsPerRow} onValueChange={(v) => {
                    setProductsPerRow(v);
                    saveSetting.mutate({ key: 'products_per_row', value: v });
                  }}>
                    <SelectTrigger data-testid="select-products-per-row">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {productsPerRowOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Quantos produtos aparecem em cada linha no desktop</p>
                </div>
                <div className="space-y-2">
                  <Label>Posição das Categorias</Label>
                  <Select value={categoryPosition} onValueChange={(v) => {
                    setCategoryPosition(v);
                    saveSetting.mutate({ key: 'category_position', value: v });
                  }}>
                    <SelectTrigger data-testid="select-category-position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryPositionOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Onde as categorias aparecem no catálogo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Template de Design
              </CardTitle>
              <CardDescription>Escolha o estilo visual do seu site</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                {designTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateChange(template.id)}
                    className={`relative text-left p-4 rounded-lg border-2 transition-all hover-elevate ${
                      selectedTemplate === template.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    data-testid={`button-template-${template.id}`}
                  >
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                    {selectedTemplate === template.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
