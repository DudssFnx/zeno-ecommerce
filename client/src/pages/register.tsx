import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function generateMathCaptcha() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  return { num1, num2, answer: num1 + num2 };
}
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Store, ArrowRight, ArrowLeft, Loader2, CheckCircle, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const BRAZILIAN_STATES = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapa" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceara" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espirito Santo" },
  { value: "GO", label: "Goias" },
  { value: "MA", label: "Maranhao" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Para" },
  { value: "PB", label: "Paraiba" },
  { value: "PR", label: "Parana" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piaui" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondonia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "Sao Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

function validateCPF(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf[10])) return false;
  
  return true;
}

function validateCNPJ(cnpj: string): boolean {
  const cleanCnpj = cnpj.replace(/\D/g, "");
  if (cleanCnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCnpj)) return false;
  
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCnpj[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleanCnpj[12])) return false;
  
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCnpj[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleanCnpj[13])) return false;
  
  return true;
}

// Quick registration schema for retail (pessoa fisica) - simplified!
const retailQuickSchema = z.object({
  personType: z.literal("fisica"),
  cpf: z.string().refine((val) => validateCPF(val), { message: "CPF invalido" }),
  email: z.string().email("E-mail invalido"),
  firstName: z.string().min(2, "Nome obrigatorio"),
  phone: z.string().min(10, "Telefone com DDD obrigatorio"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirme a senha"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas nao coincidem",
  path: ["confirmPassword"],
});

type RetailQuickData = z.infer<typeof retailQuickSchema>;

// Full registration schema for wholesale (pessoa juridica)
const step1Schema = z.object({
  personType: z.enum(["juridica", "fisica"]),
  cnpj: z.string().optional(),
  cpf: z.string().optional(),
  email: z.string().email("E-mail invalido"),
}).superRefine((data, ctx) => {
  if (data.personType === "juridica") {
    const cleanCnpj = (data.cnpj || "").replace(/\D/g, "");
    if (!cleanCnpj || cleanCnpj.length < 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CNPJ obrigatorio",
        path: ["cnpj"],
      });
    } else if (!validateCNPJ(data.cnpj || "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CNPJ invalido",
        path: ["cnpj"],
      });
    }
  } else {
    const cleanCpf = (data.cpf || "").replace(/\D/g, "");
    if (!cleanCpf || cleanCpf.length < 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF obrigatorio",
        path: ["cpf"],
      });
    } else if (!validateCPF(data.cpf || "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF invalido",
        path: ["cpf"],
      });
    }
  }
});

const step2Schema = z.object({
  firstName: z.string().min(2, "Nome obrigatorio"),
  phone: z.string().min(10, "Telefone com DDD obrigatorio"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirme a senha"),
  cep: z.string().min(8, "CEP obrigatorio"),
  address: z.string().min(3, "Endereco obrigatorio"),
  addressNumber: z.string().min(1, "Numero obrigatorio"),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, "Bairro obrigatorio"),
  city: z.string().min(2, "Cidade obrigatoria"),
  state: z.string().min(2, "Estado obrigatorio"),
  company: z.string().optional(),
  tradingName: z.string().optional(),
  stateRegistration: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas nao coincidem",
  path: ["confirmPassword"],
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const [registrationType, setRegistrationType] = useState<"retail" | "wholesale" | null>(null);
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [success, setSuccess] = useState(false);
  const [isAutoApproved, setIsAutoApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [honeypot, setHoneypot] = useState("");
  
  const captcha = useMemo(() => generateMathCaptcha(), []);

  // Quick retail form
  const retailForm = useForm<RetailQuickData>({
    resolver: zodResolver(retailQuickSchema),
    defaultValues: {
      personType: "fisica",
      cpf: "",
      email: "",
      firstName: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const form1 = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      personType: "juridica",
      cnpj: "",
      cpf: "",
      email: "",
    },
  });

  const form2 = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      firstName: "",
      phone: "",
      password: "",
      confirmPassword: "",
      cep: "",
      address: "",
      addressNumber: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      company: "",
      tradingName: "",
      stateRegistration: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/register", data);
      return response.json();
    },
    onSuccess: (data: { message: string; userId: string; approved: boolean }) => {
      setSuccess(true);
      setIsAutoApproved(data.approved);
      
      if (data.approved) {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get('redirect');
        const stepParam = urlParams.get('step');
        
        if (redirectTo) {
          const loginUrl = stepParam 
            ? `/login?redirect=${encodeURIComponent(redirectTo)}&step=${stepParam}&registered=true`
            : `/login?redirect=${encodeURIComponent(redirectTo)}&registered=true`;
          setTimeout(() => setLocation(loginUrl), 2000);
        }
      }
    },
    onError: (err: Error) => {
      setError(err.message || "Erro ao criar cadastro");
    },
  });

  // Handle quick retail registration
  const handleRetailSubmit = (data: RetailQuickData) => {
    if (honeypot) {
      setError("Verificacao de seguranca falhou");
      return;
    }
    
    if (parseInt(captchaAnswer) !== captcha.answer) {
      setError("Resposta da verificacao incorreta. Tente novamente.");
      return;
    }
    
    setError(null);
    registerMutation.mutate(data);
  };

  const handleStep1Submit = (data: Step1Data) => {
    setStep1Data(data);
    setStep(2);
  };

  const handleStep2Submit = (data: Step2Data) => {
    if (!step1Data) return;
    
    if (honeypot) {
      setError("Verificacao de seguranca falhou");
      return;
    }
    
    if (parseInt(captchaAnswer) !== captcha.answer) {
      setError("Resposta da verificacao incorreta. Tente novamente.");
      return;
    }
    
    setError(null);
    registerMutation.mutate({ ...step1Data, ...data });
  };

  const fetchCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        form2.setValue("address", data.logradouro || "");
        form2.setValue("neighborhood", data.bairro || "");
        form2.setValue("city", data.localidade || "");
        form2.setValue("state", data.uf || "");
      }
    } catch {
      // Silently fail CEP lookup
    }
  };

  const personType = form1.watch("personType");

  if (success) {
    const urlParams = new URLSearchParams(window.location.search);
    const hasCheckoutRedirect = urlParams.get('redirect')?.includes('/checkout');
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 p-4 bg-green-100 dark:bg-green-900/30 rounded-full w-fit">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">
              {isAutoApproved ? "Cadastro Aprovado!" : "Cadastro Enviado!"}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {isAutoApproved ? (
                hasCheckoutRedirect ? (
                  "Seu cadastro foi aprovado automaticamente! Voce sera redirecionado para fazer login e finalizar sua compra..."
                ) : (
                  "Seu cadastro foi aprovado automaticamente! Voce ja pode fazer login."
                )
              ) : (
                "Sua solicitacao de acesso foi enviada com sucesso. Nossa equipe ira analisar seu cadastro e voce recebera uma confirmacao por e-mail em breve."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isAutoApproved ? (
              <Button 
                onClick={() => {
                  const redirect = urlParams.get('redirect');
                  const stepParam = urlParams.get('step');
                  if (redirect) {
                    const loginUrl = stepParam 
                      ? `/login?redirect=${encodeURIComponent(redirect)}&step=${stepParam}`
                      : `/login?redirect=${encodeURIComponent(redirect)}`;
                    setLocation(loginUrl);
                  } else {
                    setLocation("/login");
                  }
                }} 
                className="gap-2 bg-orange-500 hover:bg-orange-600" 
                data-testid="button-go-login"
              >
                <ArrowRight className="h-4 w-4" />
                Fazer Login
              </Button>
            ) : (
              <Button onClick={() => setLocation("/")} className="gap-2" data-testid="button-back-home">
                <ArrowLeft className="h-4 w-4" />
                Voltar para Inicio
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Selection screen - choose between retail and wholesale
  if (registrationType === null) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Store className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-xl font-bold mb-1">LOJAMADRUGADAO</h1>
              <p className="text-muted-foreground text-sm">11 99284-5596</p>
            </div>

            <Card>
              <CardHeader className="text-center">
                <CardTitle>Como voce quer comprar?</CardTitle>
                <CardDescription>
                  Escolha o tipo de cadastro
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card 
                  className="hover-elevate cursor-pointer border-orange-500/50"
                  onClick={() => setRegistrationType("retail")}
                  data-testid="card-retail"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-orange-500/10">
                        <Zap className="h-8 w-8 text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">Varejo (Pessoa Fisica)</h3>
                        <p className="text-sm text-muted-foreground">
                          Cadastro rapido - aprovacao automatica
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">
                            Compre ja!
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="hover-elevate cursor-pointer"
                  onClick={() => setRegistrationType("wholesale")}
                  data-testid="card-wholesale"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-primary/10">
                        <Store className="h-8 w-8 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">Atacado (Pessoa Juridica)</h3>
                        <p className="text-sm text-muted-foreground">
                          Cadastro completo com CNPJ
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                            Precos especiais
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <div className="text-center pt-4">
                  <Button variant="ghost" onClick={() => setLocation("/login")} data-testid="link-login">
                    Ja tenho cadastro? Entrar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Quick retail registration form
  if (registrationType === "retail") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-10 w-10 text-orange-500" />
              </div>
              <h1 className="text-xl font-bold mb-1">Cadastro Rapido</h1>
              <p className="text-muted-foreground text-sm">Pessoa Fisica - Varejo</p>
            </div>

            <Card>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  Cadastro Expresso
                </CardTitle>
                <CardDescription>
                  Preencha apenas o essencial e comece a comprar
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Form {...retailForm}>
                  <form onSubmit={retailForm.handleSubmit(handleRetailSubmit)} className="space-y-4">
                    <FormField
                      control={retailForm.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="000.000.000-00" 
                              {...field}
                              data-testid="input-cpf"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={retailForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail *</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="seu@email.com" 
                              {...field}
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={retailForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Seu nome *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={retailForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone/WhatsApp *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="(11) 99999-9999" 
                              {...field}
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={retailForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha *</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} data-testid="input-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={retailForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar *</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} data-testid="input-confirm-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Honeypot field - hidden from users */}
                    <div className="absolute -left-[9999px]" aria-hidden="true">
                      <input
                        type="text"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                      />
                    </div>

                    {/* Simple math captcha */}
                    <div className="p-3 rounded-lg bg-muted/50">
                      <label className="text-sm font-medium">
                        Verificacao: Quanto e {captcha.num1} + {captcha.num2}? *
                      </label>
                      <Input
                        type="number"
                        placeholder="Resposta"
                        value={captchaAnswer}
                        onChange={(e) => setCaptchaAnswer(e.target.value)}
                        className="mt-2"
                        data-testid="input-captcha"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full gap-2 bg-orange-500 hover:bg-orange-600" 
                      disabled={registerMutation.isPending}
                      data-testid="button-register"
                    >
                      {registerMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          Criar Conta e Comprar
                        </>
                      )}
                    </Button>

                    <Button 
                      type="button"
                      variant="ghost" 
                      className="w-full" 
                      onClick={() => setRegistrationType(null)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Full wholesale registration (existing flow)
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Store className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-xl font-bold mb-1">LOJAMADRUGADAO</h1>
            <p className="text-muted-foreground text-sm">11 99284-5596</p>
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle>Cadastro Atacado</CardTitle>
              <CardDescription>
                {step === 1 ? "Passo 1 de 2 - Identificacao" : "Passo 2 de 2 - Dados completos"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {step === 1 && (
                <Form {...form1}>
                  <form onSubmit={form1.handleSubmit(handleStep1Submit)} className="space-y-4">
                    <FormField
                      control={form1.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="00.000.000/0000-00" 
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                              data-testid="input-cnpj"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form1.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Seu e-mail para acessar *</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="seu@email.com" 
                              {...field}
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full gap-2" data-testid="button-continue">
                      Continuar o cadastro
                      <ArrowRight className="h-4 w-4" />
                    </Button>

                    <Button 
                      type="button"
                      variant="ghost" 
                      className="w-full" 
                      onClick={() => setRegistrationType(null)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                  </form>
                </Form>
              )}

              {step === 2 && (
                <Form {...form2}>
                  <form onSubmit={form2.handleSubmit(handleStep2Submit)} className="space-y-4">
                    <FormField
                      control={form2.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Seu nome *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form2.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Razao Social</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-company" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form2.control}
                      name="tradingName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Fantasia</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-trading-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form2.control}
                      name="stateRegistration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inscricao Estadual</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-state-registration" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form2.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone/WhatsApp *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="(11) 99999-9999" 
                              {...field}
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form2.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha *</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} data-testid="input-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form2.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar *</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} data-testid="input-confirm-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="pt-2">
                      <h3 className="text-sm font-medium mb-3">Endereco</h3>
                      
                      <div className="space-y-4">
                        <FormField
                          control={form2.control}
                          name="cep"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CEP *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="00000-000"
                                  {...field}
                                  onBlur={(e) => {
                                    field.onBlur();
                                    fetchCep(e.target.value);
                                  }}
                                  data-testid="input-cep"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form2.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Endereco *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-address" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form2.control}
                            name="addressNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Numero *</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-number" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form2.control}
                            name="complement"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Complemento</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-complement" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form2.control}
                          name="neighborhood"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bairro *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-neighborhood" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form2.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Cidade *</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-city" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form2.control}
                            name="state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Estado *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-state">
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {BRAZILIAN_STATES.map((state) => (
                                      <SelectItem key={state.value} value={state.value}>
                                        {state.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Honeypot field - hidden from users */}
                    <div className="absolute -left-[9999px]" aria-hidden="true">
                      <input
                        type="text"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                      />
                    </div>

                    {/* Simple math captcha */}
                    <div className="p-3 rounded-lg bg-muted/50">
                      <label className="text-sm font-medium">
                        Verificacao: Quanto e {captcha.num1} + {captcha.num2}? *
                      </label>
                      <Input
                        type="number"
                        placeholder="Resposta"
                        value={captchaAnswer}
                        onChange={(e) => setCaptchaAnswer(e.target.value)}
                        className="mt-2"
                        data-testid="input-captcha"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full gap-2" 
                      disabled={registerMutation.isPending}
                      data-testid="button-register"
                    >
                      {registerMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Solicitar Acesso
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <Button 
                      type="button"
                      variant="ghost" 
                      className="w-full" 
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
