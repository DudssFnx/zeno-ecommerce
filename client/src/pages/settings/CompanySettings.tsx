import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  Camera,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Upload,
} from "lucide-react"; // Adicionei MapPin
import { useEffect, useState, type SVGProps } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Schema de validação
const companySchema = z.object({
  name: z.string().min(1, "Razão Social é obrigatória"),
  tradingName: z.string().optional(),
  cnpj: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  cep: z.string().optional(),
  logoUrl: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;
// Função para gerar slug a partir da razão social
function generateSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Pequeno ícone do WhatsApp (inline SVG) para evitar nova dependência
function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      {...props}
    >
      <path d="M12.041 2C6.489 2 2 6.486 2 12.041c0 2.03.575 3.998 1.656 5.687L4 22l4.46-1.473A9.962 9.962 0 0012.041 22C17.593 22 22.08 17.514 22.08 12.041 22.08 6.486 17.593 2 12.041 2zM12.04 20.12c-1.794 0-3.486-.476-4.958-1.352l-.356-.206-2.602.855.872-2.52-.229-.402A7.96 7.96 0 013.98 12.04c0-4.418 3.586-8.004 8.06-8.004 4.474 0 8.06 3.586 8.06 8.004 0 4.418-3.586 8.076-8.06 8.076z" />
      <path d="M17.36 14.9c-.29-.15-1.71-.84-1.98-.93-.27-.09-.47-.15-.67.15-.2.29-.77.93-.95 1.12-.18.19-.35.22-.64.07-.29-.15-1.23-.45-2.34-1.44-.87-.78-1.46-1.74-1.63-2.03-.17-.29-.02-.44.13-.59.13-.13.29-.35.43-.52.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.67-1.61-.92-2.23-.24-.58-.49-.5-.67-.51l-.57-.01c-.19 0-.5.07-.77.36-.27.29-1.02.99-1.02 2.42 0 1.43 1.05 2.82 1.2 3.02.15.2 2.08 3.2 5.05 4.49 2.97 1.29 2.97.86 3.51.81.54-.05 1.71-.64 1.95-1.26.24-.62.24-1.15.17-1.26-.07-.11-.26-.18-.55-.33z" />
    </svg>
  );
}

export default function CompanySettings() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoadingCep, setIsLoadingCep] = useState(false); // Loading específico para o CEP

  // 1. Busca os dados atuais
  const { data: company, isLoading } = useQuery({
    queryKey: ["/api/company/me"],
  });

  // Slug dinâmico baseado no campo Razão Social do formulário
  const [dynamicSlug, setDynamicSlug] = useState("");
  const [sharedLink, setSharedLink] = useState("");

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      tradingName: "",
      cnpj: "",
      email: "",
      phone: "",
      address: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      cep: "",
      logoUrl: "",
    },
  });

  useEffect(() => {
    const unsubscribe = form.watch((value) => {
      // Prioriza nome fantasia / tradingName quando disponível
      const preferred = value.tradingName?.trim() || value.name?.trim() || "";
      const companyPreferred =
        (company as any)?.fantasyName ||
        (company as any)?.nomeFantasia ||
        (company as any)?.razaoSocial ||
        (company as any)?.name ||
        "";
      const nameForSlug = preferred || companyPreferred;
      const slug = nameForSlug
        ? generateSlug(nameForSlug)
        : (company as any)?.slug || "";
      setDynamicSlug(slug);
      setSharedLink(slug ? `${window.location.origin}/loja/${slug}` : "");
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [form, company]);

  const handleCopyLink = () => {
    if (sharedLink) {
      navigator.clipboard.writeText(sharedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleViewCatalog = () => {
    if (sharedLink) {
      window.open(sharedLink, "_blank");
    }
  };

  const handleShareWhatsApp = () => {
    const catalogUrl =
      sharedLink ||
      (company?.slug
        ? `${window.location.origin}/loja/${company.slug}`
        : window.location.origin);
    const storeName =
      (company as any)?.fantasyName ||
      (company as any)?.nomeFantasia ||
      (company as any)?.razaoSocial ||
      (company as any)?.name ||
      "nossa loja";
    const text = encodeURIComponent(
      `Confira o catálogo de ${storeName}: ${catalogUrl}`,
    );
    if (company?.phone) {
      const phone = company.phone.replace(/\D/g, "");
      window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${text}`, "_blank");
    }
  };

  // Preenche o formulário quando os dados da empresa chegam
  useEffect(() => {
    if (company) {
      // Alguns endpoints retornam campos em português (razaoSocial / nomeFantasia)
      const resolvedName =
        (company as any).name ||
        (company as any).razaoSocial ||
        (company as any).nomeFantasia ||
        "";
      const resolvedTrading =
        (company as any).tradingName ||
        (company as any).fantasyName ||
        (company as any).nomeFantasia ||
        "";

      form.reset({
        name: resolvedName,
        tradingName: resolvedTrading,
        cnpj: (company as any).cnpj || "",
        email: (company as any).email || "",
        phone: (company as any).phone || (company as any).telefone || "",
        address: (company as any).address || (company as any).endereco || "",
        number: (company as any).number || (company as any).numero || "",
        complement:
          (company as any).complement || (company as any).complemento || "",
        neighborhood:
          (company as any).neighborhood || (company as any).bairro || "",
        city: (company as any).city || (company as any).cidade || "",
        state: (company as any).state || (company as any).estado || "",
        cep: (company as any).cep || "",
        logoUrl: (company as any).logoUrl || (company as any).logo || "",
      });
      if ((company as any).logoUrl) {
        setLogoPreview((company as any).logoUrl);
      }
    }
  }, [company, form]);

  // 3. Função para salvar
  const mutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const res = await apiRequest("PATCH", "/api/company/me", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Falha ao atualizar empresa");
      }
      return res.json();
    },
    onSuccess: () => {
      // Atualiza cache tanto para `/api/company/me` quanto para `/api/user/companies`
      queryClient.invalidateQueries({ queryKey: ["/api/company/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/companies"] });
      toast({
        title: "Sucesso!",
        description: "Dados da empresa atualizados.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // ... lógica de upload do logo ...
  };

  // Função para buscar CEP
  const handleBuscarCep = async (cep: string) => {
    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data && !data.erro) {
        form.setValue("address", data.logradouro);
        form.setValue("neighborhood", data.bairro);
        form.setValue("city", data.localidade);
        form.setValue("state", data.uf);
        // Opcional: focar no campo número após preencher
        document.getElementById("number")?.focus();
        toast({
          title: "Endereço encontrado!",
          description: `${data.logradouro} - ${data.localidade}/${data.uf}`,
        });
      } else {
        toast({
          title: "CEP não encontrado",
          description: "Verifique se o número está correto.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast({
        title: "Erro na busca",
        description: "Não foi possível conectar ao serviço de CEP.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCep(false);
    }
  };

  // Dispara busca de CEP ao sair do campo
  const handleCepBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length === 8) {
      handleBuscarCep(value);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Minha Empresa</h2>
        <p className="text-muted-foreground">
          Gerencie os dados da sua organização. Essas informações aparecerão nos
          pedidos e notas.
        </p>
      </div>

      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        {/* Painel de link compartilhável (reconstruído) */}
        {(dynamicSlug || company?.slug) && (
          <Card className="mb-6 shadow-sm rounded-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle className="text-lg">Link compartilhável</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Link público para acessar o catálogo da sua loja.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* ícone / domínio */}
                <div className="col-span-1 flex items-center justify-center">
                  <div className="h-10 w-10 rounded-md bg-muted/10 flex items-center justify-center">
                    <ExternalLink className="h-5 w-5 text-primary" />
                  </div>
                </div>

                {/* link central com copiar embutido */}
                <div className="col-span-7 md:col-span-7">
                  <label className="text-xs text-muted-foreground">
                    Link público
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={sharedLink}
                      readOnly
                      onClick={handleCopyLink}
                      className="flex-1 font-mono"
                    />
                    <Button
                      type="button"
                      onClick={handleCopyLink}
                      variant="ghost"
                      className="px-3 py-2"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Clique no link ou no ícone para copiar.
                  </div>
                </div>

                {/* ações à direita */}
                <div className="col-span-4 md:col-span-4 flex flex-col gap-2">
                  <Button
                    type="button"
                    onClick={handleViewCatalog}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Ver catálogo</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleShareWhatsApp}
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2 border-green-400 text-green-600"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                    <span>WhatsApp</span>
                  </Button>
                </div>
              </div>

              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                <span>Slug:</span>
                <span className="font-mono bg-muted/10 px-2 py-1 rounded">
                  {dynamicSlug || company?.slug}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* === BLOCO DO LOGOTIPO === */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Logotipo da Empresa
            </CardTitle>
            <CardDescription>
              Essa imagem aparecerá no menu lateral e nos documentos impressos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-primary/30 bg-background flex items-center justify-center">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo Preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1">
                <Label htmlFor="logo-upload" className="cursor-pointer">
                  <div className="flex items-center justify-center w-full sm:w-auto px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors gap-2 font-medium text-sm shadow-sm">
                    <Upload className="h-4 w-4" />
                    Escolher Imagem
                  </div>
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </Label>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Recomendado: Imagem quadrada (PNG ou JPG) de até 2MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* === DADOS CADASTRAIS === */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Dados Cadastrais</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Razão Social *</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Ex: Zeno Tecnologia Ltda"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tradingName">
                  Nome Fantasia (Exibido no sistema)
                </Label>
                <Input
                  id="tradingName"
                  {...form.register("tradingName")}
                  placeholder="Ex: Zeno"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  {...form.register("cnpj")}
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Oficial</Label>
                <Input
                  id="email"
                  {...form.register("email")}
                  placeholder="contato@empresa.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone / WhatsApp</Label>
                <Input
                  id="phone"
                  {...form.register("phone")}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Endereço
              </h3>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <div className="relative">
                    <Input
                      id="cep"
                      {...form.register("cep")}
                      placeholder="00000-000"
                      onBlur={handleCepBlur} // ✅ Dispara a busca ao sair do campo
                      maxLength={9}
                    />
                    {isLoadingCep && (
                      <div className="absolute right-3 top-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="address">Logradouro</Label>
                  <Input
                    id="address"
                    {...form.register("address")}
                    placeholder="Rua..."
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="number">Número</Label>
                  <Input id="number" {...form.register("number")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complement">Complemento</Label>
                  <Input id="complement" {...form.register("complement")} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input id="neighborhood" {...form.register("neighborhood")} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" {...form.register("city")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado (UF)</Label>
                  <Input id="state" {...form.register("state")} maxLength={2} />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="w-full md:w-auto"
              >
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar Alterações
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
