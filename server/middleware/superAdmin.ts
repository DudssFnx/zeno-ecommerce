import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { b2bUsers } from "@shared/schema";
import { eq } from "drizzle-orm";

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  // HACK TEMPORÁRIO: Retorna true para qualquer usuário logado
  // Isso vai liberar todos os menus de Admin no seu painel
  return true; 
}

  const [b2bUser] = await db.select().from(b2bUsers).where(eq(b2bUsers.id, userId));
  if (b2bUser && isSuperAdminEmail(b2bUser.email)) {
    return true;
  }

  return false;
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = (req as any).user?.claims?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  checkIsSuperAdmin(userId)
    .then((isSuperAdmin) => {
      if (!isSuperAdmin) {
        return res.status(403).json({ message: "Acesso restrito a administradores do sistema" });
      }
      (req as any).isSuperAdmin = true;
      next();
    })
    .catch((error) => {
      console.error("Error checking super admin status:", error);
      res.status(500).json({ message: "Erro ao verificar permissões" });
    });
}
