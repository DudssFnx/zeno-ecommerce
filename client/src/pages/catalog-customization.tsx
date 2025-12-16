import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, Image, GripVertical, Eye, EyeOff, Upload, Link, Layers, Settings, Palette } from "lucide-react";
import type { CatalogSlide, CatalogBanner } from "@shared/schema";

export default function CatalogCustomizationPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("slides");

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Palette className="h-7 w-7" />
            Personalizar Catálogo
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Customize banners, slides e aparência da sua loja
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="slides" className="flex items-center gap-2" data-testid="tab-slides">
            <Layers className="h-4 w-4" />
            Carrossel
          </TabsTrigger>
          <TabsTrigger value="banners" className="flex items-center gap-2" data-testid="tab-banners">
            <Image className="h-4 w-4" />
            Banners
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2" data-testid="tab-settings">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="slides" className="space-y-4">
          <SlidesManager />
        </TabsContent>

        <TabsContent value="banners" className="space-y-4">
          <BannersManager />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <CatalogSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SlidesManager() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<CatalogSlide | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    buttonText: "",
    buttonLink: "",
    imageUrl: "",
    mobileImageUrl: "",
    order: 0,
    active: true,
  });

  const { data: slides = [], isLoading } = useQuery<CatalogSlide[]>({
    queryKey: ['/api/catalog/slides'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/catalog/slides', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/catalog/slides'] });
      toast({ title: "Sucesso", description: "Slide criado com sucesso" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar slide", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      return apiRequest('PATCH', `/api/catalog/slides/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/catalog/slides'] });
      toast({ title: "Sucesso", description: "Slide atualizado com sucesso" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar slide", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/catalog/slides/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/catalog/slides'] });
      toast({ title: "Sucesso", description: "Slide removido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao remover slide", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      subtitle: "",
      buttonText: "",
      buttonLink: "",
      imageUrl: "",
      mobileImageUrl: "",
      order: slides.length,
      active: true,
    });
    setEditingSlide(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (slide: CatalogSlide) => {
    setEditingSlide(slide);
    setFormData({
      title: slide.title || "",
      subtitle: slide.subtitle || "",
      buttonText: slide.buttonText || "",
      buttonLink: slide.buttonLink || "",
      imageUrl: slide.imageUrl,
      mobileImageUrl: slide.mobileImageUrl || "",
      order: slide.order,
      active: slide.active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.imageUrl) {
      toast({ title: "Erro", description: "URL da imagem é obrigatória", variant: "destructive" });
      return;
    }
    if (editingSlide) {
      updateMutation.mutate({ id: editingSlide.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'imageUrl' | 'mobileImageUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const res = await fetch('/api/upload/catalog', {
        method: 'POST',
        body: formDataUpload,
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, [field]: data.url }));
        toast({ title: "Sucesso", description: "Imagem enviada com sucesso" });
      } else {
        toast({ title: "Erro", description: "Falha ao enviar imagem", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao enviar imagem", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg">Slides do Carrossel</CardTitle>
          <CardDescription>
            Gerencie os slides que aparecem no carrossel principal da página inicial
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-slide">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Slide
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSlide ? "Editar Slide" : "Novo Slide"}</DialogTitle>
              <DialogDescription>
                Configure o conteúdo e aparência do slide
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    placeholder="Título do slide"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    data-testid="input-slide-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subtitle">Subtítulo</Label>
                  <Input
                    id="subtitle"
                    placeholder="Subtítulo do slide"
                    value={formData.subtitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                    data-testid="input-slide-subtitle"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buttonText">Texto do Botão</Label>
                  <Input
                    id="buttonText"
                    placeholder="Ex: Ver Produtos"
                    value={formData.buttonText}
                    onChange={(e) => setFormData(prev => ({ ...prev, buttonText: e.target.value }))}
                    data-testid="input-slide-button-text"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buttonLink">Link do Botão</Label>
                  <Input
                    id="buttonLink"
                    placeholder="Ex: /catalog"
                    value={formData.buttonLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, buttonLink: e.target.value }))}
                    data-testid="input-slide-button-link"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Imagem Desktop (1920x600px recomendado)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="URL da imagem ou faça upload"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                    data-testid="input-slide-image"
                  />
                  <Label htmlFor="image-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center h-9 px-3 rounded-md bg-secondary text-secondary-foreground">
                      <Upload className="h-4 w-4" />
                    </div>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'imageUrl')}
                    />
                  </Label>
                </div>
                {formData.imageUrl && (
                  <div className="mt-2 rounded-md overflow-hidden border">
                    <img src={formData.imageUrl} alt="Preview" className="w-full h-32 object-cover" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Imagem Mobile (800x800px recomendado)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="URL da imagem mobile (opcional)"
                    value={formData.mobileImageUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, mobileImageUrl: e.target.value }))}
                    data-testid="input-slide-mobile-image"
                  />
                  <Label htmlFor="mobile-image-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center h-9 px-3 rounded-md bg-secondary text-secondary-foreground">
                      <Upload className="h-4 w-4" />
                    </div>
                    <input
                      id="mobile-image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'mobileImageUrl')}
                    />
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="order">Ordem</Label>
                  <Input
                    id="order"
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                    data-testid="input-slide-order"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                    data-testid="switch-slide-active"
                  />
                  <Label htmlFor="active">Ativo</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-slide">
                {editingSlide ? "Salvar Alterações" : "Criar Slide"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : slides.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum slide cadastrado</p>
            <p className="text-sm">Adicione slides para personalizar seu carrossel</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slides.map((slide) => (
              <div
                key={slide.id}
                className="flex items-center gap-4 p-3 rounded-md border bg-card"
                data-testid={`slide-item-${slide.id}`}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                <div className="w-24 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                  {slide.imageUrl ? (
                    <img src={slide.imageUrl} alt={slide.title || "Slide"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{slide.title || "Sem título"}</p>
                  <p className="text-sm text-muted-foreground truncate">{slide.subtitle || "Sem subtítulo"}</p>
                </div>
                <Badge variant={slide.active ? "default" : "secondary"}>
                  {slide.active ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                  {slide.active ? "Ativo" : "Inativo"}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(slide)} data-testid={`button-edit-slide-${slide.id}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(slide.id)}
                    data-testid={`button-delete-slide-${slide.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BannersManager() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<CatalogBanner | null>(null);
  const [formData, setFormData] = useState({
    position: "promo1",
    title: "",
    subtitle: "",
    buttonText: "",
    buttonLink: "",
    imageUrl: "",
    mobileImageUrl: "",
    backgroundColor: "",
    textColor: "",
    order: 0,
    active: true,
  });

  const { data: banners = [], isLoading } = useQuery<CatalogBanner[]>({
    queryKey: ['/api/catalog/banners'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/catalog/banners', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/catalog/banners'] });
      toast({ title: "Sucesso", description: "Banner criado com sucesso" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar banner", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      return apiRequest('PATCH', `/api/catalog/banners/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/catalog/banners'] });
      toast({ title: "Sucesso", description: "Banner atualizado com sucesso" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar banner", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/catalog/banners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/catalog/banners'] });
      toast({ title: "Sucesso", description: "Banner removido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao remover banner", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      position: "promo1",
      title: "",
      subtitle: "",
      buttonText: "",
      buttonLink: "",
      imageUrl: "",
      mobileImageUrl: "",
      backgroundColor: "",
      textColor: "",
      order: banners.length,
      active: true,
    });
    setEditingBanner(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (banner: CatalogBanner) => {
    setEditingBanner(banner);
    setFormData({
      position: banner.position,
      title: banner.title || "",
      subtitle: banner.subtitle || "",
      buttonText: banner.buttonText || "",
      buttonLink: banner.buttonLink || "",
      imageUrl: banner.imageUrl || "",
      mobileImageUrl: banner.mobileImageUrl || "",
      backgroundColor: banner.backgroundColor || "",
      textColor: banner.textColor || "",
      order: banner.order,
      active: banner.active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingBanner) {
      updateMutation.mutate({ id: editingBanner.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'imageUrl' | 'mobileImageUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const res = await fetch('/api/upload/catalog', {
        method: 'POST',
        body: formDataUpload,
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, [field]: data.url }));
        toast({ title: "Sucesso", description: "Imagem enviada com sucesso" });
      } else {
        toast({ title: "Erro", description: "Falha ao enviar imagem", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao enviar imagem", variant: "destructive" });
    }
  };

  const positionLabels: Record<string, string> = {
    hero: "Hero Principal",
    promo1: "Promoção 1",
    promo2: "Promoção 2",
    promo3: "Promoção 3",
    footer: "Rodapé",
    sidebar: "Barra Lateral",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg">Banners Promocionais</CardTitle>
          <CardDescription>
            Gerencie banners para diferentes seções da loja
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-banner">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Banner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBanner ? "Editar Banner" : "Novo Banner"}</DialogTitle>
              <DialogDescription>
                Configure o conteúdo e posição do banner
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Posição do Banner</Label>
                <Select
                  value={formData.position}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, position: value }))}
                >
                  <SelectTrigger data-testid="select-banner-position">
                    <SelectValue placeholder="Selecione a posição" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hero">Hero Principal</SelectItem>
                    <SelectItem value="promo1">Promoção 1</SelectItem>
                    <SelectItem value="promo2">Promoção 2</SelectItem>
                    <SelectItem value="promo3">Promoção 3</SelectItem>
                    <SelectItem value="sidebar">Barra Lateral</SelectItem>
                    <SelectItem value="footer">Rodapé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="banner-title">Título</Label>
                  <Input
                    id="banner-title"
                    placeholder="Título do banner"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    data-testid="input-banner-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner-subtitle">Subtítulo</Label>
                  <Input
                    id="banner-subtitle"
                    placeholder="Subtítulo do banner"
                    value={formData.subtitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                    data-testid="input-banner-subtitle"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="banner-buttonText">Texto do Botão</Label>
                  <Input
                    id="banner-buttonText"
                    placeholder="Ex: Saiba Mais"
                    value={formData.buttonText}
                    onChange={(e) => setFormData(prev => ({ ...prev, buttonText: e.target.value }))}
                    data-testid="input-banner-button-text"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner-buttonLink">Link do Botão</Label>
                  <Input
                    id="banner-buttonLink"
                    placeholder="Ex: /promocao"
                    value={formData.buttonLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, buttonLink: e.target.value }))}
                    data-testid="input-banner-button-link"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Imagem do Banner</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="URL da imagem ou faça upload"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                    data-testid="input-banner-image"
                  />
                  <Label htmlFor="banner-image-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center h-9 px-3 rounded-md bg-secondary text-secondary-foreground">
                      <Upload className="h-4 w-4" />
                    </div>
                    <input
                      id="banner-image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'imageUrl')}
                    />
                  </Label>
                </div>
                {formData.imageUrl && (
                  <div className="mt-2 rounded-md overflow-hidden border">
                    <img src={formData.imageUrl} alt="Preview" className="w-full h-32 object-cover" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="backgroundColor">Cor de Fundo</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="backgroundColor"
                      placeholder="#000000"
                      value={formData.backgroundColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, backgroundColor: e.target.value }))}
                      data-testid="input-banner-bg-color"
                    />
                    <input
                      type="color"
                      value={formData.backgroundColor || "#000000"}
                      onChange={(e) => setFormData(prev => ({ ...prev, backgroundColor: e.target.value }))}
                      className="h-9 w-9 rounded border cursor-pointer"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="textColor">Cor do Texto</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="textColor"
                      placeholder="#FFFFFF"
                      value={formData.textColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, textColor: e.target.value }))}
                      data-testid="input-banner-text-color"
                    />
                    <input
                      type="color"
                      value={formData.textColor || "#FFFFFF"}
                      onChange={(e) => setFormData(prev => ({ ...prev, textColor: e.target.value }))}
                      className="h-9 w-9 rounded border cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="banner-order">Ordem</Label>
                  <Input
                    id="banner-order"
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                    data-testid="input-banner-order"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="banner-active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                    data-testid="switch-banner-active"
                  />
                  <Label htmlFor="banner-active">Ativo</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-banner">
                {editingBanner ? "Salvar Alterações" : "Criar Banner"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : banners.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum banner cadastrado</p>
            <p className="text-sm">Adicione banners para diferentes seções da loja</p>
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((banner) => (
              <div
                key={banner.id}
                className="flex items-center gap-4 p-3 rounded-md border bg-card"
                data-testid={`banner-item-${banner.id}`}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                <div className="w-24 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                  {banner.imageUrl ? (
                    <img src={banner.imageUrl} alt={banner.title || "Banner"} className="w-full h-full object-cover" />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: banner.backgroundColor || undefined }}
                    >
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{banner.title || "Sem título"}</p>
                  <p className="text-sm text-muted-foreground">{positionLabels[banner.position] || banner.position}</p>
                </div>
                <Badge variant={banner.active ? "default" : "secondary"}>
                  {banner.active ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                  {banner.active ? "Ativo" : "Inativo"}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(banner)} data-testid={`button-edit-banner-${banner.id}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(banner.id)}
                    data-testid={`button-delete-banner-${banner.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CatalogSettings() {
  const { toast } = useToast();

  const { data: showCategories } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/catalog/config/show_categories_section'],
  });

  const { data: showBenefits } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/catalog/config/show_benefits_section'],
  });

  const { data: showFeatured } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/catalog/config/show_featured_section'],
  });

  const updateConfig = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest('POST', `/api/catalog/config/${key}`, { value });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/catalog/config', variables.key] });
      toast({ title: "Sucesso", description: "Configuração atualizada" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar configuração", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Configurações da Página</CardTitle>
        <CardDescription>
          Configure quais seções aparecem na página inicial
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-md border">
          <div>
            <p className="font-medium">Seção de Categorias</p>
            <p className="text-sm text-muted-foreground">Exibir categorias de produtos na página inicial</p>
          </div>
          <Switch
            checked={showCategories?.value === 'true'}
            onCheckedChange={(checked) => updateConfig.mutate({ key: 'show_categories_section', value: checked ? 'true' : 'false' })}
            data-testid="switch-show-categories"
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-md border">
          <div>
            <p className="font-medium">Seção de Benefícios</p>
            <p className="text-sm text-muted-foreground">Exibir benefícios (frete grátis, parcelamento, etc)</p>
          </div>
          <Switch
            checked={showBenefits?.value !== 'false'}
            onCheckedChange={(checked) => updateConfig.mutate({ key: 'show_benefits_section', value: checked ? 'true' : 'false' })}
            data-testid="switch-show-benefits"
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-md border">
          <div>
            <p className="font-medium">Produtos em Destaque</p>
            <p className="text-sm text-muted-foreground">Exibir seção de produtos em destaque</p>
          </div>
          <Switch
            checked={showFeatured?.value !== 'false'}
            onCheckedChange={(checked) => updateConfig.mutate({ key: 'show_featured_section', value: checked ? 'true' : 'false' })}
            data-testid="switch-show-featured"
          />
        </div>
      </CardContent>
    </Card>
  );
}
