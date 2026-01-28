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
import { Building2, Camera, Loader2, MapPin, Upload } from "lucide-react"; // Adicionei MapPin
import { useEffect, useState } from "react";
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

export default function CompanySettings() {
  const { toast } = useToast();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoadingCep, setIsLoadingCep] = useState(false); // Loading específico para o CEP

  // 1. Busca os dados atuais
  const { data: company, isLoading } = useQuery({
    queryKey: ["/api/company/me"],
  });

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

  // 2. Preenche o formulário quando os dados chegam do banco
  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name || "",
        tradingName: company.tradingName || "",
        cnpj: company.cnpj || "",
        email: company.email || "",
        phone: company.phone || "",
        address: company.address || "",
        number: company.number || "",
        complement: company.complement || "",
        neighborhood: company.neighborhood || "",
        city: company.city || "",
        state: company.state || "",
        cep: company.cep || "",
        logoUrl: company.logoUrl || "",
      });
      if (company.logoUrl) {
        setLogoPreview(company.logoUrl);
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
      queryClient.invalidateQueries({ queryKey: ["/api/company/me"] });
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
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "A logo deve ter no máximo 2MB.",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
        form.setValue("logoUrl", base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  // ✅ NOVA FUNÇÃO: BUSCAR CEP
  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número

    if (cep.length === 8) {
      setIsLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (!data.erro) {
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
