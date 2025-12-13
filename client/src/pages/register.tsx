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
import { Store, ArrowRight, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const BRAZILIAN_STATES = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
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

const step1Schema = z.object({
  personType: z.enum(["juridica", "fisica"]),
  cnpj: z.string().optional(),
  cpf: z.string().optional(),
  email: z.string().email("E-mail inválido"),
}).superRefine((data, ctx) => {
  if (data.personType === "juridica") {
    const cleanCnpj = (data.cnpj || "").replace(/\D/g, "");
    if (!cleanCnpj || cleanCnpj.length < 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CNPJ obrigatório",
        path: ["cnpj"],
      });
    } else if (!validateCNPJ(data.cnpj || "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CNPJ inválido",
        path: ["cnpj"],
      });
    }
  } else {
    const cleanCpf = (data.cpf || "").replace(/\D/g, "");
    if (!cleanCpf || cleanCpf.length < 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF obrigatório",
        path: ["cpf"],
      });
    } else if (!validateCPF(data.cpf || "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF inválido",
        path: ["cpf"],
      });
    }
  }
});

const step2Schema = z.object({
  firstName: z.string().min(2, "Nome obrigatório"),
  phone: z.string().min(10, "Telefone com DDD obrigatório"),
  cep: z.string().min(8, "CEP obrigatório"),
  address: z.string().min(3, "Endereço obrigatório"),
  addressNumber: z.string().min(1, "Número obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, "Bairro obrigatório"),
  city: z.string().min(2, "Cidade obrigatória"),
  state: z.string().min(2, "Estado obrigatório"),
  company: z.string().optional(),
  tradingName: z.string().optional(),
  stateRegistration: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [honeypot, setHoneypot] = useState("");
  
  const captcha = useMemo(() => generateMathCaptcha(), []);

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
    mutationFn: async (data: Step1Data & Step2Data) => {
      return apiRequest("POST", "/api/register", data);
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (err: Error) => {
      setError(err.message || "Erro ao criar cadastro");
    },
  });

  const handleStep1Submit = (data: Step1Data) => {
    setStep1Data(data);
    setStep(2);
  };

  const handleStep2Submit = (data: Step2Data) => {
    if (!step1Data) return;
    
    // Honeypot check - if filled, it's a bot
    if (honeypot) {
      setError("Verificação de segurança falhou");
      return;
    }
    
    // Captcha validation
    if (parseInt(captchaAnswer) !== captcha.answer) {
      setError("Resposta da verificação incorreta. Tente novamente.");
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 p-4 bg-green-100 dark:bg-green-900/30 rounded-full w-fit">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Cadastro Enviado!</CardTitle>
            <CardDescription className="text-base mt-2">
              Sua solicitação de acesso foi enviada com sucesso. Nossa equipe irá analisar 
              seu cadastro e você receberá uma confirmação por e-mail em breve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} className="gap-2" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
              Voltar para Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              <CardTitle>Solicitar acesso</CardTitle>
              <CardDescription>
                {step === 1 ? "Passo 1 de 2 - Identificação" : "Passo 2 de 2 - Dados completos"}
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
                      name="personType"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex justify-center gap-6"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="juridica" id="juridica" data-testid="radio-juridica" />
                                <label htmlFor="juridica" className="text-sm font-medium cursor-pointer">
                                  Pessoa jurídica
                                </label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="fisica" id="fisica" data-testid="radio-fisica" />
                                <label htmlFor="fisica" className="text-sm font-medium cursor-pointer">
                                  Pessoa física
                                </label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {personType === "juridica" ? (
                      <FormField
                        key="cnpj-field"
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
                    ) : (
                      <FormField
                        key="cpf-field"
                        control={form1.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="000.000.000-00" 
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                data-testid="input-cpf"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

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

                    {personType === "juridica" && (
                      <>
                        <FormField
                          control={form2.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Razão Social</FormLabel>
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
                              <FormLabel>Inscrição Estadual</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-state-registration" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    <FormField
                      control={form2.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone com DDD *</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 99999-9999" {...field} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2">
                      <FormField
                        control={form2.control}
                        name="cep"
                        render={({ field }) => (
                          <FormItem className="flex-1">
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
                      <div className="flex items-end">
                        <Button 
                          type="button" 
                          variant="link" 
                          className="text-primary"
                          onClick={() => window.open("https://buscacepinter.correios.com.br/", "_blank")}
                        >
                          Não sei o CEP
                        </Button>
                      </div>
                    </div>

                    <FormField
                      control={form2.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Endereço *</FormLabel>
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
                            <FormLabel>Número *</FormLabel>
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
                                <SelectValue placeholder="Selecione um item" />
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

                    {/* Honeypot - hidden field to catch bots */}
                    <div className="absolute -left-[9999px]" aria-hidden="true">
                      <Input
                        type="text"
                        name="website"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                      />
                    </div>

                    {/* Math Captcha */}
                    <div className="space-y-2">
                      <FormLabel>Verificação de segurança *</FormLabel>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium bg-muted px-3 py-2 rounded-md">
                          {captcha.num1} + {captcha.num2} = ?
                        </span>
                        <Input
                          type="number"
                          value={captchaAnswer}
                          onChange={(e) => setCaptchaAnswer(e.target.value)}
                          placeholder="Resposta"
                          className="w-24"
                          data-testid="input-captcha"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setStep(1)}
                        data-testid="button-back"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1 gap-2"
                        disabled={registerMutation.isPending || !captchaAnswer}
                        data-testid="button-submit"
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          "Solicitar acesso"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          <div className="text-center mt-6">
            <Button 
              variant="link" 
              onClick={() => setLocation("/")}
              className="text-primary"
              data-testid="link-catalog"
            >
              Continuar visualizando o catálogo sem preços
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
