import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Search, 
  RefreshCw, 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2,
  Ticket,
  Percent,
  DollarSign,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Coupon } from "@shared/schema";
import { format } from "date-fns";

const couponSchema = z.object({
  code: z.string().min(3, "Código deve ter pelo menos 3 caracteres"),
  name: z.string().min(1, "Nome é obrigatório"),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().min(0.01, "Valor deve ser maior que 0"),
  minOrderValue: z.coerce.number().optional(),
  maxUses: z.coerce.number().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  active: z.boolean().default(true),
});

type CouponFormValues = z.infer<typeof couponSchema>;

export default function CouponsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const { data: couponsData = [], isLoading, refetch } = useQuery<Coupon[]>({
    queryKey: ['/api/coupons'],
  });

  const form = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: "",
      name: "",
      discountType: "percent",
      discountValue: 10,
      minOrderValue: undefined,
      maxUses: undefined,
      validFrom: "",
      validUntil: "",
      active: true,
    },
  });

  const filteredCoupons = couponsData.filter((coupon) =>
    coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coupon.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async (data: CouponFormValues) => {
      await apiRequest("POST", "/api/coupons", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coupons'] });
      toast({ title: "Cupom criado", description: "O cupom foi criado com sucesso." });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar cupom", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CouponFormValues> }) => {
      await apiRequest("PATCH", `/api/coupons/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coupons'] });
      toast({ title: "Cupom atualizado", description: "O cupom foi atualizado com sucesso." });
      setIsDialogOpen(false);
      setEditingCoupon(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar cupom", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/coupons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coupons'] });
      toast({ title: "Cupom excluído", description: "O cupom foi excluído com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir cupom", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      await apiRequest("PATCH", `/api/coupons/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coupons'] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar status", variant: "destructive" });
    },
  });

  const handleOpenDialog = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      form.reset({
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discountType as "percent" | "fixed",
        discountValue: parseFloat(coupon.discountValue),
        minOrderValue: coupon.minOrderValue ? parseFloat(coupon.minOrderValue) : undefined,
        maxUses: coupon.maxUses || undefined,
        validFrom: coupon.validFrom ? format(new Date(coupon.validFrom), "yyyy-MM-dd") : "",
        validUntil: coupon.validUntil ? format(new Date(coupon.validUntil), "yyyy-MM-dd") : "",
        active: coupon.active,
      });
    } else {
      setEditingCoupon(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: CouponFormValues) => {
    const payload = {
      ...data,
      minOrderValue: data.minOrderValue || null,
      maxUses: data.maxUses || null,
      validFrom: data.validFrom ? new Date(data.validFrom).toISOString() : null,
      validUntil: data.validUntil ? new Date(data.validUntil).toISOString() : null,
    };

    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon.id, data: payload });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy");
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Cupons de Desconto</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie cupons e promoções para seus clientes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-coupons">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={() => handleOpenDialog()} data-testid="button-add-coupon">
            <Plus className="h-4 w-4 mr-2" />
            Novo Cupom
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Ticket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-total-coupons">{couponsData.length}</p>
                <p className="text-xs text-muted-foreground">Total de Cupons</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Ticket className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-active-coupons">
                  {couponsData.filter(c => c.active).length}
                </p>
                <p className="text-xs text-muted-foreground">Cupons Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Percent className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-percent-coupons">
                  {couponsData.filter(c => c.discountType === "percent").length}
                </p>
                <p className="text-xs text-muted-foreground">Desconto %</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <DollarSign className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600" data-testid="stat-fixed-coupons">
                  {couponsData.filter(c => c.discountType === "fixed").length}
                </p>
                <p className="text-xs text-muted-foreground">Desconto Fixo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cupons..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-coupons"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCoupons.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum cupom encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Pedido Mínimo</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCoupons.map((coupon) => (
                  <TableRow key={coupon.id} data-testid={`row-coupon-${coupon.id}`}>
                    <TableCell className="font-mono font-bold">{coupon.code}</TableCell>
                    <TableCell>{coupon.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {coupon.discountType === "percent" 
                          ? `${coupon.discountValue}%` 
                          : `R$ ${parseFloat(coupon.discountValue).toFixed(2)}`
                        }
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {coupon.minOrderValue 
                        ? `R$ ${parseFloat(coupon.minOrderValue).toFixed(2)}` 
                        : "-"
                      }
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {coupon.validFrom || coupon.validUntil ? (
                          <>
                            {formatDate(coupon.validFrom)} - {formatDate(coupon.validUntil)}
                          </>
                        ) : (
                          "Sem limite"
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {coupon.maxUses 
                        ? `${coupon.usedCount}/${coupon.maxUses}` 
                        : coupon.usedCount
                      }
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={coupon.active}
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ id: coupon.id, active: checked })
                        }
                        data-testid={`switch-active-${coupon.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(coupon)}
                          data-testid={`button-edit-${coupon.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(coupon.id)}
                          data-testid={`button-delete-${coupon.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCoupon ? "Editar Cupom" : "Novo Cupom"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código do Cupom</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="EX: DESCONTO10" 
                        className="uppercase"
                        data-testid="input-coupon-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Promoção</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: Promoção de Natal"
                        data-testid="input-coupon-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Desconto</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-discount-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percent">Porcentagem (%)</SelectItem>
                          <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discountValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do Desconto</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01"
                          data-testid="input-discount-value"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minOrderValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pedido Mínimo (R$)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01"
                          placeholder="Opcional"
                          data-testid="input-min-order"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxUses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite de Usos</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number"
                          placeholder="Ilimitado"
                          data-testid="input-max-uses"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="validFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Válido a partir de</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="date"
                          data-testid="input-valid-from"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Válido até</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="date"
                          data-testid="input-valid-until"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-coupon-active"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Cupom ativo</FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-coupon"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingCoupon ? "Salvar" : "Criar Cupom"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
