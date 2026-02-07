import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ZenoLogo } from "@/components/ZenoLogo";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  Package,
  ShoppingCart,
  Truck,
  User,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

const STORE_WHATSAPP = "5511992845596";

type CheckoutStep = "resumo" | "cadastro" | "frete" | "pagamento" | "orcamento";

const steps: { key: CheckoutStep; label: string; icon: typeof ShoppingCart }[] =
  [
    { key: "resumo", label: "Resumo", icon: ShoppingCart },
    { key: "cadastro", label: "Cadastro", icon: User },
    { key: "frete", label: "Frete", icon: Truck },
    { key: "pagamento", label: "Pagamento", icon: CreditCard },
    { key: "orcamento", label: "Orcamento", icon: FileText },
  ];

interface ShippingAddress {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export default function CheckoutPage() {
  // ...existing code...

  // Success screen after order creation
  if (orderSuccess) {
    const whatsappMessage = `Olá! Acabei de gerar o orçamento #${createdOrderNumber} e gostaria de mais informações.`;
    const whatsappLink = `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(whatsappMessage)}`;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 bg-zinc-900 text-white">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <ZenoLogo
                size="md"
                showText={true}
                variant="light"
                onClick={() => setLocation("/")}
              />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Orcamento Gerado!</h2>
              {createdOrderNumber && (
                <p className="text-2xl font-bold text-primary mb-2">
                  #{createdOrderNumber}
                </p>
              )}
              <p className="text-muted-foreground mb-6">
                Seu orcamento foi gerado com sucesso. Entre em contato conosco
                pelo WhatsApp para finalizar seu pedido.
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-whatsapp-order"
                  >
                    <SiWhatsapp className="h-5 w-5 mr-2" />
                    Falar no WhatsApp
                  </Button>
                </a>
                <Button
                  variant="outline"
                  onClick={() =>
                    setLocation(isGuestCheckout ? "/catalogo" : "/minha-conta")
                  }
                  data-testid="button-continue-shopping"
                >
                  {isGuestCheckout ? "Voltar ao Catalogo" : "Ver Meus Pedidos"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (items.length === 0 && currentStep !== "orcamento") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 bg-zinc-900 text-white">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <ZenoLogo
                size="md"
                showText={true}
                variant="light"
                onClick={() => setLocation("/")}
              />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <Package className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Carrinho Vazio</h2>
              <p className="text-muted-foreground mb-6">
                Adicione produtos ao carrinho para continuar com a compra.
              </p>
              <Button
                onClick={() => setLocation("/catalogo")}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Ver Catalogo
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-zinc-900 text-white">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <ZenoLogo
              size="md"
              showText={true}
              variant="light"
              onClick={() => setLocation("/")}
            />
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm">
                <ShoppingCart className="h-4 w-4" />
                <span>{itemCount} itens</span>
                <span className="font-bold text-emerald-400">
                  {formatPrice(total)}
                </span>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/catalogo")}
            data-testid="button-back-catalog"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar ao catalogo
          </Button>
        </div>

        <div className="flex items-center justify-center mb-8 overflow-x-auto">
          <div className="flex items-center gap-2">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = step.key === currentStep;
              const isPast = index < getCurrentStepIndex();
              const isSkipped =
                step.key === "cadastro" && isAuthenticated && user;

              if (isSkipped) return null;

              return (
                <div key={step.key} className="flex items-center">
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-orange-500 text-white"
                        : isPast
                          ? "bg-green-500/20 text-green-600 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <StepIcon className="h-4 w-4" />
                    <span className="text-sm font-medium hidden sm:inline">
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && !isSkipped && (
                    <div
                      className={`w-8 h-0.5 mx-1 ${isPast ? "bg-green-500" : "bg-muted"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {currentStep === "resumo" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Resumo do Pedido
                  </CardTitle>
                  <CardDescription>
                    Confira os itens do seu carrinho antes de continuar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 p-3 rounded-lg bg-muted/50"
                      data-testid={`checkout-item-${item.id}`}
                    >
                      <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-md"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.sku}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            Qtd: {item.quantity}
                          </Badge>
                          <span className="text-sm font-semibold">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Separator />

                  <div className="flex items-center justify-between text-lg font-bold">
                    <span>Subtotal</span>
                    <span className="text-orange-600 dark:text-orange-500">
                      {formatPrice(total)}
                    </span>
                  </div>

                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600"
                    onClick={goToNextStep}
                    data-testid="button-continue-to-cadastro"
                  >
                    Continuar
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {currentStep === "cadastro" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Identificacao
                  </CardTitle>
                  <CardDescription>
                    {showGuestForm
                      ? "Preencha seus dados para continuar"
                      : "Escolha como deseja continuar"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!showGuestForm ? (
                    <>
                      {!canUseGuestCheckout && (
                        <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 mb-4">
                          <p className="text-sm text-orange-600 dark:text-orange-500 font-medium">
                            Para compras acima de R$ 400,00 e necessario criar
                            uma conta ou fazer login.
                          </p>
                        </div>
                      )}
                      <div
                        className={`grid gap-4 ${canUseGuestCheckout ? "md:grid-cols-3" : "md:grid-cols-2"}`}
                      >
                        <Card
                          className="hover-elevate cursor-pointer"
                          onClick={handleLoginRedirect}
                        >
                          <CardContent className="pt-6 text-center">
                            <User className="h-12 w-12 mx-auto mb-4 text-orange-500" />
                            <h3 className="font-semibold mb-2">
                              Ja tenho conta
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              Faca login para continuar
                            </p>
                            <Button
                              variant="outline"
                              className="w-full"
                              data-testid="button-login-checkout"
                            >
                              Entrar
                            </Button>
                          </CardContent>
                        </Card>

                        <Card
                          className="hover-elevate cursor-pointer"
                          onClick={handleContinueToRegister}
                        >
                          <CardContent className="pt-6 text-center">
                            <User className="h-12 w-12 mx-auto mb-4 text-orange-500" />
                            <h3 className="font-semibold mb-2">Criar conta</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              Cadastre-se para comprar
                            </p>
                            <Button
                              variant="outline"
                              className="w-full"
                              data-testid="button-register-checkout"
                            >
                              Cadastrar
                            </Button>
                          </CardContent>
                        </Card>

                        {canUseGuestCheckout && (
                          <Card
                            className="hover-elevate cursor-pointer border-orange-500/50"
                            onClick={() => {
                              setShowGuestForm(true);
                              setIsGuestCheckout(true);
                            }}
                            data-testid="card-guest-checkout"
                          >
                            <CardContent className="pt-6 text-center">
                              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-orange-500" />
                              <h3 className="font-semibold mb-2">
                                Comprar sem cadastro
                              </h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                Informe apenas seus dados
                              </p>
                              <Button
                                className="w-full bg-orange-500 hover:bg-orange-600"
                                data-testid="button-guest-checkout"
                              >
                                Continuar
                              </Button>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 mb-4">
                        <p className="text-sm text-orange-600 dark:text-orange-500 font-medium">
                          Compra como visitante - preencha seus dados abaixo
                        </p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="guestName">Nome completo *</Label>
                          <Input
                            id="guestName"
                            placeholder="Seu nome"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            data-testid="input-guest-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="guestCpf">CPF *</Label>
                          <Input
                            id="guestCpf"
                            placeholder="000.000.000-00"
                            value={guestCpf}
                            onChange={(e) => setGuestCpf(e.target.value)}
                            data-testid="input-guest-cpf"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="guestPhone">Telefone *</Label>
                          <Input
                            id="guestPhone"
                            placeholder="(11) 99999-9999"
                            value={guestPhone}
                            onChange={(e) => setGuestPhone(e.target.value)}
                            data-testid="input-guest-phone"
                          />
                        </div>
                        <div>
                          <Label htmlFor="guestEmail">E-mail (opcional)</Label>
                          <Input
                            id="guestEmail"
                            type="email"
                            placeholder="seu@email.com"
                            value={guestEmail}
                            onChange={(e) => setGuestEmail(e.target.value)}
                            data-testid="input-guest-email"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-4">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setShowGuestForm(false);
                            setIsGuestCheckout(false);
                          }}
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Voltar
                        </Button>
                        <Button
                          className="bg-orange-500 hover:bg-orange-600"
                          onClick={() => {
                            if (!guestName.trim()) {
                              toast({
                                title: "Informe seu nome",
                                variant: "destructive",
                              });
                              return;
                            }
                            if (
                              !guestCpf ||
                              guestCpf.replace(/\D/g, "").length !== 11
                            ) {
                              toast({
                                title: "CPF invalido",
                                description:
                                  "Informe um CPF valido com 11 digitos",
                                variant: "destructive",
                              });
                              return;
                            }
                            if (!guestPhone.trim()) {
                              toast({
                                title: "Informe seu telefone",
                                variant: "destructive",
                              });
                              return;
                            }
                            setCurrentStep("frete");
                          }}
                          data-testid="button-guest-continue"
                        >
                          Continuar
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {!showGuestForm && (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" onClick={goToPreviousStep}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === "frete" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Cotacao de Frete
                  </CardTitle>
                  <CardDescription>
                    Informe seu endereco para calcular o frete
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isGuestCheckout && (
                    <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 mb-2">
                      <p className="text-sm text-orange-600 dark:text-orange-500 font-medium">
                        Compra como visitante: {guestName} - CPF: {guestCpf}
                      </p>
                    </div>
                  )}

                  <div className="grid gap-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor="cep">CEP *</Label>
                        <div className="flex gap-2">
                          <Input
                            id="cep"
                            placeholder="00000-000"
                            value={shippingAddress.cep}
                            onChange={(e) =>
                              setShippingAddress((prev) => ({
                                ...prev,
                                cep: e.target.value,
                              }))
                            }
                            data-testid="input-cep"
                          />
                          <Button
                            variant="outline"
                            onClick={handleCepLookup}
                            disabled={isLoadingCep}
                            data-testid="button-search-cep"
                          >
                            {isLoadingCep ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MapPin className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="street">Rua/Avenida *</Label>
                      <Input
                        id="street"
                        placeholder="Nome da rua"
                        value={shippingAddress.street}
                        onChange={(e) =>
                          setShippingAddress((prev) => ({
                            ...prev,
                            street: e.target.value,
                          }))
                        }
                        data-testid="input-street"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="number">Numero *</Label>
                        <Input
                          id="number"
                          placeholder="123"
                          value={shippingAddress.number}
                          onChange={(e) =>
                            setShippingAddress((prev) => ({
                              ...prev,
                              number: e.target.value,
                            }))
                          }
                          data-testid="input-number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="complement">Complemento</Label>
                        <Input
                          id="complement"
                          placeholder="Apto, Sala..."
                          value={shippingAddress.complement}
                          onChange={(e) =>
                            setShippingAddress((prev) => ({
                              ...prev,
                              complement: e.target.value,
                            }))
                          }
                          data-testid="input-complement"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="neighborhood">Bairro *</Label>
                      <Input
                        id="neighborhood"
                        placeholder="Bairro"
                        value={shippingAddress.neighborhood}
                        onChange={(e) =>
                          setShippingAddress((prev) => ({
                            ...prev,
                            neighborhood: e.target.value,
                          }))
                        }
                        data-testid="input-neighborhood"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">Cidade *</Label>
                        <Input
                          id="city"
                          placeholder="Cidade"
                          value={shippingAddress.city}
                          onChange={(e) =>
                            setShippingAddress((prev) => ({
                              ...prev,
                              city: e.target.value,
                            }))
                          }
                          data-testid="input-city"
                        />
                      </div>
                      <div>
                        <Label htmlFor="state">Estado *</Label>
                        <Input
                          id="state"
                          placeholder="UF"
                          value={shippingAddress.state}
                          onChange={(e) =>
                            setShippingAddress((prev) => ({
                              ...prev,
                              state: e.target.value,
                            }))
                          }
                          maxLength={2}
                          data-testid="input-state"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600"
                    onClick={handleCalculateFreight}
                    data-testid="button-calculate-freight"
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Calcular Frete
                  </Button>

                  {freightCalculated && freightQuotes.length > 0 && (
                    <div className="space-y-3">
                      <Label>Selecione a opcao de entrega *</Label>
                      <RadioGroup
                        value={selectedFreight}
                        onValueChange={setSelectedFreight}
                      >
                        {freightQuotes.map((quote) => (
                          <div
                            key={quote.type}
                            className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                              selectedFreight === quote.type
                                ? "border-orange-500 bg-orange-500/10"
                                : "border-border hover:border-orange-500/50"
                            }`}
                            onClick={() => setSelectedFreight(quote.type)}
                            data-testid={`freight-option-${quote.type}`}
                          >
                            <RadioGroupItem
                              value={quote.type}
                              id={quote.type}
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor={quote.type}
                                className="font-medium cursor-pointer capitalize"
                              >
                                {quote.type === "combinar"
                                  ? "A combinar com vendedor"
                                  : `Entrega ${quote.type}`}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {quote.deadline}
                              </p>
                            </div>
                            <span className="font-bold text-orange-600 dark:text-orange-500">
                              {quote.price === 0
                                ? "Sob consulta"
                                : formatPrice(quote.price)}
                            </span>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <Button variant="ghost" onClick={goToPreviousStep}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                    <Button
                      className="bg-orange-500 hover:bg-orange-600"
                      onClick={goToNextStep}
                      disabled={!selectedFreight}
                      data-testid="button-confirm-frete"
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === "pagamento" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Forma de Pagamento
                  </CardTitle>
                  <CardDescription>Selecione como deseja pagar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label>Selecione o metodo de pagamento *</Label>
                    {loadingPaymentTypes ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : activePaymentTypes.length === 0 ? (
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-muted-foreground">
                          Nenhuma forma de pagamento disponivel
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Entre em contato com a loja
                        </p>
                      </div>
                    ) : (
                      <RadioGroup
                        value={paymentTypeId?.toString() || ""}
                        onValueChange={(value) => {
                          const id = parseInt(value);
                          const selectedType = activePaymentTypes.find(
                            (pt) => pt.id === id,
                          );
                          setPaymentTypeId(id);
                          setPaymentMethod(selectedType?.name || "");
                        }}
                      >
                        {activePaymentTypes.map((pt) => (
                          <div
                            key={pt.id}
                            className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                              paymentTypeId === pt.id
                                ? "border-orange-500 bg-orange-500/10"
                                : "border-border hover:border-orange-500/50"
                            }`}
                            onClick={() => {
                              setPaymentTypeId(pt.id);
                              setPaymentMethod(pt.name);
                            }}
                            data-testid={`payment-option-${pt.id}`}
                          >
                            <RadioGroupItem
                              value={pt.id.toString()}
                              id={`payment-${pt.id}`}
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor={`payment-${pt.id}`}
                                className="font-medium cursor-pointer"
                              >
                                {pt.name}
                              </Label>
                              {pt.description && (
                                <p className="text-sm text-muted-foreground">
                                  {pt.description}
                                </p>
                              )}
                              {pt.feeValue && parseFloat(pt.feeValue) > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Taxa:{" "}
                                  {pt.feeType === "PERCENTUAL"
                                    ? `${pt.feeValue}%`
                                    : `R$ ${pt.feeValue}`}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="paymentNotes">
                      Observacoes sobre pagamento
                    </Label>
                    <Textarea
                      id="paymentNotes"
                      placeholder="Alguma observacao sobre o pagamento? (opcional)"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="resize-none"
                      data-testid="textarea-payment-notes"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Button variant="ghost" onClick={goToPreviousStep}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                    <Button
                      className="bg-orange-500 hover:bg-orange-600"
                      onClick={goToNextStep}
                      disabled={!paymentTypeId}
                      data-testid="button-confirm-pagamento"
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === "orcamento" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Gerar Orcamento
                  </CardTitle>
                  <CardDescription>
                    Revise as informacoes e gere seu orcamento
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Address Summary */}
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center gap-2 font-medium">
                      <MapPin className="h-4 w-4 text-orange-500" />
                      Endereco de Entrega
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {shippingAddress.street}, {shippingAddress.number}
                      {shippingAddress.complement &&
                        ` - ${shippingAddress.complement}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {shippingAddress.neighborhood}, {shippingAddress.city} -{" "}
                      {shippingAddress.state}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      CEP: {shippingAddress.cep}
                    </p>
                  </div>

                  {/* Freight Summary */}
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center gap-2 font-medium">
                      <Truck className="h-4 w-4 text-orange-500" />
                      Frete Selecionado
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground capitalize">
                        {selectedFreight === "combinar"
                          ? "A combinar com vendedor"
                          : `Entrega ${selectedFreight}`}
                      </span>
                      <span className="font-bold text-orange-600 dark:text-orange-500">
                        {getSelectedFreightPrice() === 0
                          ? "Sob consulta"
                          : formatPrice(getSelectedFreightPrice())}
                      </span>
                    </div>
                  </div>

                  {/* Payment Summary */}
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center gap-2 font-medium">
                      <CreditCard className="h-4 w-4 text-orange-500" />
                      Forma de Pagamento
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">
                      {paymentMethod === "combinar"
                        ? "A combinar com vendedor"
                        : paymentMethod}
                    </p>
                    {paymentNotes && (
                      <p className="text-xs text-muted-foreground">
                        Obs: {paymentNotes}
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Items Summary */}
                  <div className="space-y-3">
                    <div className="font-medium">Itens do Pedido</div>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {item.name} x {item.quantity}
                        </span>
                        <span>{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete</span>
                      <span>
                        {getSelectedFreightPrice() === 0
                          ? "Sob consulta"
                          : formatPrice(getSelectedFreightPrice())}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-orange-600 dark:text-orange-500">
                        {getSelectedFreightPrice() === 0
                          ? `${formatPrice(total)} + frete`
                          : formatPrice(total + getSelectedFreightPrice())}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Button variant="ghost" onClick={goToPreviousStep}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleGenerateOrder}
                      disabled={isSubmitting}
                      data-testid="button-gerar-orcamento"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      Gerar Orcamento
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-base">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Itens ({itemCount})
                  </span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Frete</span>
                  <span className="text-muted-foreground">
                    {selectedFreight
                      ? getSelectedFreightPrice() === 0
                        ? "Sob consulta"
                        : formatPrice(getSelectedFreightPrice())
                      : "A calcular"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-bold">
                  <span>Total</span>
                  <span className="text-xl text-orange-600 dark:text-orange-500">
                    {selectedFreight && getSelectedFreightPrice() > 0
                      ? formatPrice(total + getSelectedFreightPrice())
                      : formatPrice(total)}
                  </span>
                </div>
                {selectedFreight && getSelectedFreightPrice() === 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    + frete a combinar
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
