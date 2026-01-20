import { NextFunction, Request, Response } from "express";

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function checkIsSuperAdmin(
  userId: string | number,
): Promise<boolean> {
  // HACK TEMPORÁRIO: Retorna true para qualquer usuário logado
  // Isso libera os menus de Admin conforme conversamos
  return true;

  /* // Código original para quando quiser voltar ao normal:
  const [b2bUser] = await db.select().from(b2bUsers).where(eq(b2bUsers.id, Number(userId)));
  if (b2bUser && isSuperAdminEmail(b2bUser.email)) {
    return true;
  }
  return false;
  */
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Ajustado para capturar o ID tanto de claims quanto do user direto (depende do seu Auth)
  const userId = (req as any).user?.claims?.sub || (req as any).user?.id;

  if (!userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  checkIsSuperAdmin(userId)
    .then((isSuperAdmin) => {
      if (!isSuperAdmin) {
        return res
          .status(403)
          .json({ message: "Acesso restrito a administradores do sistema" });
      }
      (req as any).isSuperAdmin = true;
      next();
    })
    .catch((error) => {
      console.error("Error checking super admin status:", error);
      res.status(500).json({ message: "Erro ao verificar permissões" });
    });
}
