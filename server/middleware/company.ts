import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "../db";

declare global {
  namespace Express {
    interface Request {
      companyId?: string;
    }
  }
}

export async function extractCompanyContext(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const companyIdHeader = req.headers["x-company-id"] as string | undefined;

  if (companyIdHeader) {
    req.companyId = companyIdHeader;
  }

  next();
}

export async function requireCompany(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const companyId = req.headers["x-company-id"] as string | undefined;

  if (!companyId) {
    return res
      .status(400)
      .json({ message: "Company ID is required. Set X-Company-Id header." });
  }

  const userId = user.claims?.sub || user.id;

  // Buscar usuário no banco
  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));

  if (!userRecord) {
    return res.status(404).json({ message: "User not found" });
  }

  // Validar se o usuário tem acesso a essa empresa
  if (userRecord.companyId !== companyId && userRecord.role !== "super_admin") {
    return res
      .status(403)
      .json({ message: "You do not have access to this company" });
  }

  req.companyId = companyId;
  next();
}

export function optionalCompany(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const companyId = req.headers["x-company-id"] as string | undefined;

  if (companyId) {
    req.companyId = companyId;
  }

  next();
}
