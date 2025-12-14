import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, Phone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoImage from "@assets/image_1765659931449.png";

const loginSchema = z.object({
  email: z.string().min(1, "Campo obrigatorio"),
  password: z.string().min(1, "Senha obrigatoria"),
});

type LoginData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
    onError: (err: Error) => {
      setError(err.message || "E-mail ou senha incorretos");
    },
  });

  const handleSubmit = (data: LoginData) => {
    setError(null);
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src={logoImage} 
              alt="Lojamadrugadao" 
              className="h-24 w-24 rounded-full border-4 border-white/10"
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            LOJAMADRUGADAO SAO PAULO
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2 text-zinc-400">
            <Phone className="h-4 w-4" />
            <span>11 99294-0168</span>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Email ou CPF/CNPJ"
                      className="h-12 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
                      {...field}
                      data-testid="input-login-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Senha"
                        className="h-12 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 pr-12 focus:border-orange-500"
                        {...field}
                        data-testid="input-login-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-zinc-400 hover:text-white hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-lg"
              disabled={loginMutation.isPending}
              data-testid="button-login-submit"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Acessando...
                </>
              ) : (
                "Acessar"
              )}
            </Button>
          </form>
        </Form>

        <div className="flex items-center justify-between mt-6">
          <Button
            variant="link"
            className="p-0 h-auto text-orange-500 hover:text-orange-400 font-normal"
            onClick={() => {}}
            data-testid="link-forgot-password"
          >
            Esqueci minha senha
          </Button>
          <Button
            variant="link"
            className="p-0 h-auto text-orange-500 hover:text-orange-400 font-normal"
            onClick={() => setLocation("/register")}
            data-testid="link-register"
          >
            Solicitar acesso
          </Button>
        </div>

        <div className="mt-12 text-center">
          <Button
            variant="link"
            className="text-zinc-400 hover:text-zinc-300"
            onClick={() => setLocation("/catalogo")}
            data-testid="link-public-catalog"
          >
            Continuar visualizando o catalogo sem precos
          </Button>
        </div>
      </div>
    </div>
  );
}
