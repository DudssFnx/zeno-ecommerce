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
import { Slider } from "@/components/ui/slider";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Palette, Image, Layout, Store, Layers, Check, Plus, Trash2, Edit, GripVertical, 
  Building2, Sparkles, Moon, Sun, Monitor, Type, Circle, Square, 
  Sidebar, PaintBucket, Wand2
} from "lucide-react";
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
  { id: "slate", name: "Grafite", primary: "215 25% 35%", description: "Discreto e profissional" },
  { id: "cyan", name: "Ciano", primary: "190 95% 39%", description: "Tech e inovador" },
  { id: "rose", name: "Rose", primary: "350 89% 60%", description: "Suave e acolhedor" },
  { id: "indigo", name: "Indigo", primary: "239 84% 67%", description: "Misterioso e criativo" },
];

const completeThemes = [
  {
    id: "professional",
    name: "Profissional",
    description: "Clean e corporativo",
    preview: { primary: "217 91% 60%", sidebar: "220 14% 98%", accent: "220 14% 92%" },
    colors: {
      primary: "217 91% 60%",
      background: "220 14% 96%",
      sidebar: "220 14% 98%",
      card: "0 0% 100%",
    }
  },
  {
    id: "dark-elegance",
    name: "Elegancia Escura",
    description: "Sofisticado e moderno",
    preview: { primary: "262 83% 58%", sidebar: "222 47% 11%", accent: "262 83% 58%" },
    colors: {
      primary: "262 83% 58%",
      background: "222 47% 11%",
      sidebar: "222 47% 11%",
      card: "222 47% 13%",
    }
  },
  {
    id: "nature",
    name: "Natureza",
    description: "Fresco e organico",
    preview: { primary: "142 71% 45%", sidebar: "140 30% 96%", accent: "142 50% 90%" },
    colors: {
      primary: "142 71% 45%",
      background: "140 20% 97%",
      sidebar: "140 30% 96%",
      card: "0 0% 100%",
    }
  },
  {
    id: "sunset",
    name: "Por do Sol",
    description: "Quente e acolhedor",
    preview: { primary: "25 95% 53%", sidebar: "30 20% 97%", accent: "25 80% 90%" },
    colors: {
      primary: "25 95% 53%",
      background: "30 15% 96%",
      sidebar: "30 20% 97%",
      card: "0 0% 100%",
    }
  },
  {
    id: "ocean",
    name: "Oceano",
    description: "Calmo e sereno",
    preview: { primary: "190 95% 39%", sidebar: "195 30% 97%", accent: "190 50% 90%" },
    colors: {
      primary: "190 95% 39%",
      background: "195 20% 96%",
      sidebar: "195 30% 97%",
      card: "0 0% 100%",
    }
  },
  {
    id: "midnight",
    name: "Meia Noite",
    description: "Escuro e misterioso",
    preview: { primary: "217 91% 60%", sidebar: "222 47% 8%", accent: "217 50% 20%" },
    colors: {
      primary: "217 91% 60%",
      background: "222 47% 6%",
      sidebar: "222 47% 8%",
      card: "222 47% 10%",
    }
  },
];

const designTemplates = [
  { id: "modern", name: "Moderno", description: "Design limpo com bordas arredondadas", icon: Circle },
  { id: "classic", name: "Classico", description: "Estilo tradicional e profissional", icon: Square },
  { id: "minimal", name: "Minimalista", description: "Foco no conteudo, sem distrações", icon: Layout },
  { id: "bold", name: "Impactante", description: "Cores fortes e elementos grandes", icon: Sparkles },
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

const fontOptions = [
  { value: "inter", label: "Inter", style: "font-sans" },
  { value: "roboto", label: "Roboto", style: "font-sans" },
  { value: "poppins", label: "Poppins", style: "font-sans" },
  { value: "nunito", label: "Nunito", style: "font-sans" },
  { value: "montserrat", label: "Montserrat", style: "font-sans" },
];

const borderRadiusOptions = [
  { value: "none", label: "Sem bordas", radius: "0" },
  { value: "sm", label: "Pequeno", radius: "0.25rem" },
  { value: "md", label: "Medio", radius: "0.5rem" },
  { value: "lg", label: "Grande", radius: "0.75rem" },
  { value: "xl", label: "Extra Grande", radius: "1rem" },
  { value: "full", label: "Arredondado", radius: "9999px" },
];

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [selectedColor, setSelectedColor] = useState("orange");
  const [selectedCompleteTheme, setSelectedCompleteTheme] = useState("");
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
  
  const [selectedFont, setSelectedFont] = useState("inter");
  const [selectedRadius, setSelectedRadius] = useState("md");
  const [sidebarStyle, setSidebarStyle] = useState("default");
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

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
  
  const { data: fontSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/font_family'],
  });
  
  const { data: radiusSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/border_radius'],
  });
  
  const { data: sidebarStyleSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/sidebar_style'],
  });
  
  const { data: completeThemeSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/complete_theme'],
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
    if (fontSetting?.value) setSelectedFont(fontSetting.value);
    if (radiusSetting?.value) setSelectedRadius(radiusSetting.value);
    if (sidebarStyleSetting?.value) setSidebarStyle(sidebarStyleSetting.value);
    if (completeThemeSetting?.value) setSelectedCompleteTheme(completeThemeSetting.value);
  }, [colorSetting, templateSetting, productsPerRowSetting, categoryPositionSetting, storeNameSetting, storeCnpjSetting, storePhoneSetting, storeEmailSetting, storeAddressSetting, storeLogoSetting, fontSetting, radiusSetting, sidebarStyleSetting, completeThemeSetting]);

  useEffect(() => {
    if (completeThemeSetting?.value) {
      const themeConfig = completeThemes.find(t => t.id === completeThemeSetting.value);
      if (themeConfig) {
        document.documentElement.style.setProperty("--primary", themeConfig.colors.primary);
        document.documentElement.style.setProperty("--sidebar", themeConfig.colors.sidebar);
        document.documentElement.style.setProperty("--background", themeConfig.colors.background);
        document.documentElement.style.setProperty("--card", themeConfig.colors.card);
      }
    } else if (colorSetting?.value) {
      const colorConfig = colorThemes.find(t => t.id === colorSetting.value);
      if (colorConfig) {
        document.documentElement.style.setProperty("--primary", colorConfig.primary);
      }
    }
    if (radiusSetting?.value) {
      const radiusConfig = borderRadiusOptions.find(r => r.value === radiusSetting.value);
      if (radiusConfig) {
        document.documentElement.style.setProperty("--radius", radiusConfig.radius);
      }
    }
  }, [completeThemeSetting, colorSetting, radiusSetting]);

  const saveSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest('POST', `/api/settings/${key}`, { value });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/${variables.key}`] });
      toast({ title: "Salvo", description: "Configuracao atualizada com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Nao foi possivel salvar.", variant: "destructive" });
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
    setSelectedCompleteTheme("");
    const themeConfig = colorThemes.find(t => t.id === colorId);
    if (themeConfig) {
      document.documentElement.style.setProperty("--primary", themeConfig.primary);
      localStorage.setItem("sidebarTheme", colorId);
    }
    saveSetting.mutate({ key: 'primary_color', value: colorId });
    saveSetting.mutate({ key: 'complete_theme', value: '' });
  };

  const handleCompleteThemeChange = (themeId: string) => {
    setSelectedCompleteTheme(themeId);
    const themeConfig = completeThemes.find(t => t.id === themeId);
    if (themeConfig) {
      document.documentElement.style.setProperty("--primary", themeConfig.colors.primary);
      document.documentElement.style.setProperty("--sidebar", themeConfig.colors.sidebar);
      document.documentElement.style.setProperty("--background", themeConfig.colors.background);
      document.documentElement.style.setProperty("--card", themeConfig.colors.card);
    }
    saveSetting.mutate({ key: 'complete_theme', value: themeId });
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    saveSetting.mutate({ key: 'design_template', value: templateId });
  };
  
  const handleFontChange = (fontId: string) => {
    setSelectedFont(fontId);
    saveSetting.mutate({ key: 'font_family', value: fontId });
  };
  
  const handleRadiusChange = (radiusId: string) => {
    setSelectedRadius(radiusId);
    const radiusConfig = borderRadiusOptions.find(r => r.value === radiusId);
    if (radiusConfig) {
      document.documentElement.style.setProperty("--radius", radiusConfig.radius);
    }
    saveSetting.mutate({ key: 'border_radius', value: radiusId });
  };
  
  const handleSidebarStyleChange = (style: string) => {
    setSidebarStyle(style);
    saveSetting.mutate({ key: 'sidebar_style', value: style });
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
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Wand2 className="h-8 w-8 text-primary" />
          Personalizacao
        </h1>
        <p className="text-muted-foreground mt-1">Personalize completamente a aparencia do seu sistema</p>
      </div>

      <Tabs defaultValue="themes" className="space-y-6">
        <TabsList className="grid grid-cols-6 w-full max-w-3xl h-auto p-1">
          <TabsTrigger value="themes" className="flex flex-col items-center gap-1 py-2" data-testid="tab-themes">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs">Temas</span>
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex flex-col items-center gap-1 py-2" data-testid="tab-colors">
            <Palette className="w-4 h-4" />
            <span className="text-xs">Cores</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex flex-col items-center gap-1 py-2" data-testid="tab-branding">
            <Store className="w-4 h-4" />
            <span className="text-xs">Loja</span>
          </TabsTrigger>
          <TabsTrigger value="banners" className="flex flex-col items-center gap-1 py-2" data-testid="tab-banners">
            <Image className="w-4 h-4" />
            <span className="text-xs">Banners</span>
          </TabsTrigger>
          <TabsTrigger value="layout" className="flex flex-col items-center gap-1 py-2" data-testid="tab-layout">
            <Layout className="w-4 h-4" />
            <span className="text-xs">Layout</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex flex-col items-center gap-1 py-2" data-testid="tab-advanced">
            <Layers className="w-4 h-4" />
            <span className="text-xs">Avancado</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="themes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Temas Prontos
              </CardTitle>
              <CardDescription>Escolha um tema completo para aplicar instantaneamente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completeThemes.map((themeOption) => (
                  <button
                    key={themeOption.id}
                    onClick={() => handleCompleteThemeChange(themeOption.id)}
                    className={`relative text-left p-4 rounded-xl border-2 transition-all hover-elevate ${
                      selectedCompleteTheme === themeOption.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border"
                    }`}
                    data-testid={`button-theme-${themeOption.id}`}
                  >
                    <div className="flex gap-1.5 mb-3">
                      <div 
                        className="w-8 h-8 rounded-lg shadow-sm"
                        style={{ backgroundColor: `hsl(${themeOption.preview.primary})` }}
                      />
                      <div 
                        className="w-8 h-8 rounded-lg shadow-sm border"
                        style={{ backgroundColor: `hsl(${themeOption.preview.sidebar})` }}
                      />
                      <div 
                        className="w-8 h-8 rounded-lg shadow-sm"
                        style={{ backgroundColor: `hsl(${themeOption.preview.accent})` }}
                      />
                    </div>
                    <p className="font-semibold">{themeOption.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{themeOption.description}</p>
                    {selectedCompleteTheme === themeOption.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PaintBucket className="h-5 w-5" />
                Modo de Aparencia
              </CardTitle>
              <CardDescription>Escolha entre modo claro ou escuro</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover-elevate ${
                    theme === "light" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid="button-theme-light"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-amber-300 flex items-center justify-center">
                    <Sun className="w-6 h-6 text-amber-600" />
                  </div>
                  <span className="font-medium">Claro</span>
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover-elevate ${
                    theme === "dark" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid="button-theme-dark"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                    <Moon className="w-6 h-6 text-slate-300" />
                  </div>
                  <span className="font-medium">Escuro</span>
                </button>
              </div>
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
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {colorThemes.map((colorOption) => (
                  <button
                    key={colorOption.id}
                    onClick={() => handleColorChange(colorOption.id)}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover-elevate ${
                      selectedColor === colorOption.id && !selectedCompleteTheme
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border"
                    }`}
                    data-testid={`button-color-${colorOption.id}`}
                  >
                    <div
                      className="w-10 h-10 rounded-full shadow-md ring-2 ring-white/50"
                      style={{ backgroundColor: `hsl(${colorOption.primary})` }}
                    />
                    <span className="text-xs font-medium">{colorOption.name}</span>
                    {selectedColor === colorOption.id && !selectedCompleteTheme && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Template de Design
              </CardTitle>
              <CardDescription>Escolha o estilo visual do seu site</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {designTemplates.map((template) => {
                  const Icon = template.icon;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateChange(template.id)}
                      className={`relative text-left p-4 rounded-xl border-2 transition-all hover-elevate ${
                        selectedTemplate === template.id
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                      data-testid={`button-template-${template.id}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <p className="font-semibold">{template.name}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                      {selectedTemplate === template.id && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados da Loja
              </CardTitle>
              <CardDescription>Informacoes que aparecem no site e documentos</CardDescription>
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
                <Label>Endereco</Label>
                <Input 
                  placeholder="Rua, numero, bairro, cidade - UF" 
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
                  <div className="mt-2 p-4 border rounded-xl bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-2">Previa:</p>
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
              <CardTitle>Modos de Exibicao</CardTitle>
              <CardDescription>Configure como o catalogo e exibido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Modo Atacado</Label>
                  <p className="text-sm text-muted-foreground">Exibir precos e opcoes para atacado</p>
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
                      <Label>Titulo (opcional)</Label>
                      <Input 
                        placeholder="Promocao de verao" 
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
                      <div className="border rounded-xl overflow-hidden">
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
                      className="flex items-center gap-3 p-3 border rounded-xl bg-muted/30"
                      data-testid={`banner-item-${slide.id}`}
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      <div className="w-24 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                        <img src={slide.imageUrl} alt={slide.title || "Banner"} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{slide.title || "Sem titulo"}</p>
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

        <TabsContent value="layout" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Configuracoes de Layout
              </CardTitle>
              <CardDescription>Ajuste como os produtos sao exibidos</CardDescription>
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
                  <Label>Posicao das Categorias</Label>
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
                  <p className="text-xs text-muted-foreground">Onde as categorias aparecem no catalogo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Tipografia
              </CardTitle>
              <CardDescription>Escolha a fonte usada em todo o site</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {fontOptions.map((font) => (
                  <button
                    key={font.value}
                    onClick={() => handleFontChange(font.value)}
                    className={`p-4 rounded-xl border-2 transition-all hover-elevate text-center ${
                      selectedFont === font.value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    data-testid={`button-font-${font.value}`}
                  >
                    <span className="text-lg font-semibold">{font.label}</span>
                    <p className="text-xs text-muted-foreground mt-1">Aa Bb Cc</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Square className="h-5 w-5" />
                Arredondamento de Bordas
              </CardTitle>
              <CardDescription>Ajuste o arredondamento dos elementos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {borderRadiusOptions.map((radius) => (
                  <button
                    key={radius.value}
                    onClick={() => handleRadiusChange(radius.value)}
                    className={`p-4 rounded-xl border-2 transition-all hover-elevate ${
                      selectedRadius === radius.value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    data-testid={`button-radius-${radius.value}`}
                  >
                    <div 
                      className="w-10 h-10 bg-primary/20 mx-auto mb-2"
                      style={{ borderRadius: radius.radius }}
                    />
                    <span className="text-xs font-medium">{radius.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sidebar className="h-5 w-5" />
                Estilo do Menu
              </CardTitle>
              <CardDescription>Configure a aparencia do menu lateral</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <button
                  onClick={() => handleSidebarStyleChange("default")}
                  className={`p-4 rounded-xl border-2 transition-all hover-elevate text-left ${
                    sidebarStyle === "default"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                  data-testid="button-sidebar-default"
                >
                  <div className="flex gap-2 mb-2">
                    <div className="w-4 h-16 bg-muted rounded" />
                    <div className="flex-1 h-16 bg-muted/50 rounded" />
                  </div>
                  <p className="font-medium">Padrao</p>
                  <p className="text-xs text-muted-foreground">Menu lateral classico</p>
                </button>
                <button
                  onClick={() => handleSidebarStyleChange("compact")}
                  className={`p-4 rounded-xl border-2 transition-all hover-elevate text-left ${
                    sidebarStyle === "compact"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                  data-testid="button-sidebar-compact"
                >
                  <div className="flex gap-2 mb-2">
                    <div className="w-2 h-16 bg-muted rounded" />
                    <div className="flex-1 h-16 bg-muted/50 rounded" />
                  </div>
                  <p className="font-medium">Compacto</p>
                  <p className="text-xs text-muted-foreground">Menu recolhido por padrao</p>
                </button>
                <button
                  onClick={() => handleSidebarStyleChange("floating")}
                  className={`p-4 rounded-xl border-2 transition-all hover-elevate text-left ${
                    sidebarStyle === "floating"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                  data-testid="button-sidebar-floating"
                >
                  <div className="relative mb-2">
                    <div className="h-16 bg-muted/50 rounded" />
                    <div className="absolute left-1 top-1 bottom-1 w-3 bg-card border rounded shadow-sm" />
                  </div>
                  <p className="font-medium">Flutuante</p>
                  <p className="text-xs text-muted-foreground">Menu sobre o conteudo</p>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
