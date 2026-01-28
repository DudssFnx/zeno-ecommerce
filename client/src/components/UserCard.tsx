import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Ban,
  Building2,
  Check,
  Edit,
  Instagram,
  MoreHorizontal,
  Pencil,
  Power,
  Settings,
  StickyNote,
  Tag,
  X,
} from "lucide-react";
import { StatusBadge, type UserStatus } from "./StatusBadge";

export type UserRole = "admin" | "sales" | "supplier" | "customer" | "employee";
export type CustomerType = "atacado" | "varejo";

export interface UserData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  role: UserRole;
  customerType: CustomerType;
  status: UserStatus;
  active: boolean; // NOVO CAMPO
  tag?: string;
  instagram?: string;
  notes?: string;
  avatarUrl?: string;
}

interface UserCardProps {
  user: UserData;
  onApprove?: (user: UserData) => void;
  onReject?: (user: UserData) => void;
  onChangeRole?: (user: UserData, role: UserRole) => void;
  onChangeCustomerType?: (user: UserData, customerType: CustomerType) => void;
  onEditExtras?: (user: UserData) => void;
  onEditProfile?: (user: UserData) => void;
  onOpenPermissions?: (user: UserData) => void;
  onToggleActive?: (user: UserData) => void; // NOVA PROP
}

export function UserCard({
  user,
  onApprove,
  onReject,
  onChangeRole,
  onChangeCustomerType,
  onEditExtras,
  onEditProfile,
  onOpenPermissions,
  onToggleActive, // Recebendo aqui
}: UserCardProps) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      admin: "Admin",
      sales: "Vendedor",
      supplier: "Fornecedor",
      customer: "Cliente",
      employee: "Funcionário",
    };
    return labels[role] || role;
  };

  return (
    <Card
      className={`transition-all duration-200 border-l-4 ${!user.active ? "opacity-75 bg-muted/30 border-l-gray-400" : "hover:shadow-lg border-l-transparent hover:border-l-primary"}`}
      data-testid={`card-user-${user.id}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <Avatar
              className={`h-14 w-14 border-2 ${!user.active ? "grayscale" : "border-muted"}`}
            >
              <AvatarImage src={user.avatarUrl} />
              <AvatarFallback className="bg-primary/5 text-primary text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between">
                <h3
                  className="font-bold text-base truncate pr-2 flex items-center gap-2"
                  title={user.name}
                >
                  {user.name}
                  {/* Badge de INATIVO */}
                  {!user.active && (
                    <Badge
                      variant="destructive"
                      className="h-5 px-1.5 text-[10px] uppercase"
                    >
                      Inativo
                    </Badge>
                  )}
                </h3>
                <StatusBadge status={user.status} />
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="truncate">{user.email}</p>
                {user.company && (
                  <p className="flex items-center gap-1.5 text-xs mt-1 font-medium text-foreground/80">
                    <Building2 className="h-3 w-3" /> {user.company}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center text-xs">
            <Badge variant="secondary" className="font-normal">
              {getRoleLabel(user.role)}
            </Badge>

            {user.role === "customer" && (
              <Badge variant="outline" className="font-normal">
                {user.customerType === "atacado" ? "Atacado" : "Varejo"}
              </Badge>
            )}

            {user.tag && (
              <Badge
                variant="outline"
                className="font-normal border-dashed text-muted-foreground"
              >
                <Tag className="h-3 w-3 mr-1" />
                {user.tag}
              </Badge>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-3 text-muted-foreground">
              {user.instagram && (
                <a
                  href={`https://instagram.com/${user.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-pink-600 transition-colors"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {user.notes && (
                <div title={user.notes} className="cursor-help">
                  <StickyNote className="h-4 w-4" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {user.status === "pending" && (
                <div className="flex items-center gap-1 mr-2 pr-2 border-r">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => onApprove?.(user)}
                    title="Aprovar"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onReject?.(user)}
                    title="Rejeitar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {onEditProfile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => onEditProfile(user)}
                  title="Editar Dados"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}

              {onOpenPermissions && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => onOpenPermissions(user)}
                  title="Permissões"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Ações</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Opção de Ativar/Inativar */}
                  <DropdownMenuItem onClick={() => onToggleActive?.(user)}>
                    {user.active ? (
                      <>
                        <Ban className="h-4 w-4 mr-2 text-orange-500" />
                        <span>Inativar Acesso</span>
                      </>
                    ) : (
                      <>
                        <Power className="h-4 w-4 mr-2 text-green-500" />
                        <span>Reativar Acesso</span>
                      </>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => onEditExtras?.(user)}>
                    <Edit className="h-4 w-4 mr-2" /> Editar Extras
                  </DropdownMenuItem>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      Alterar Função
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={user.role}
                        onValueChange={(v) =>
                          onChangeRole?.(user, v as UserRole)
                        }
                      >
                        <DropdownMenuRadioItem value="customer">
                          Cliente
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="employee">
                          Funcionário
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sales">
                          Vendedor
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="supplier">
                          Fornecedor
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="admin">
                          Administrador
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator />

                  {user.status === "pending" ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => onApprove?.(user)}
                        className="text-green-600"
                      >
                        Aprovar Cadastro
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onReject?.(user)}
                        className="text-red-600"
                      >
                        Rejeitar Cadastro
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => onReject?.(user)}
                      className="text-red-600"
                    >
                      Excluir Usuário
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
