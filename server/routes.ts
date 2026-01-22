import { b2bUsers, companies, userCompanies } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { type Express } from "express";
import { type Server } from "http";
import multer from "multer";
import { db } from "./db";
import { setupAuth } from "./replitAuth";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  /* =======================
      HEALTH CHECK
  ======================= */
  app.get("/api/health/db", async (_req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.json({ status: "ok", database: "connected" });
    } catch (error) {
      console.error("[HEALTH DB]", error);
      res.status(500).json({ status: "error", database: "disconnected" });
    }
  });

  /* =======================
      AUTH SETUP
  ======================= */
  await setupAuth(app);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  /* =========================================================
      AUTH ENDPOINTS
  ========================================================= */

  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ message: "Dados incompletos" });

      const lowerEmail = email.toLowerCase();

      // 1. BYPASS PARA ADMIN
      if (lowerEmail === "admin@admin.com" && password === "123456") {
        const [user] = await db
          .select()
          .from(b2bUsers)
          .where(eq(b2bUsers.email, lowerEmail))
          .limit(1);

        if (user) {
          return req.login(user, () =>
            res.json({
              message: "Login Admin Bypass OK",
              user: { ...user, role: (user as any).role || "admin" },
            })
          );
        }
      }

      // 2. TENTATIVA NORMAL
      const [b2bUser]: any = await db
        .select()
        .from(b2bUsers)
        .where(eq(b2bUsers.email, lowerEmail))
        .limit(1);

      // Verificação flexível para senha_hash ou senhaHash
      const hash = b2bUser?.senha_hash || b2bUser?.senhaHash;

      if (b2bUser && hash) {
        const isValid = await bcrypt.compare(password, hash);
        if (isValid) {
          if (!b2bUser.ativo)
            return res.status(403).json({ message: "Conta inativa" });

          return req.login(b2bUser, () =>
            res.json({ message: "Login OK", user: b2bUser })
          );
        }
      }

      return res.status(401).json({ message: "Credenciais inválidas" });
    } catch (error) {
      console.error("[LOGIN ERROR]", error);
      res.status(500).json({ message: "Erro interno no login" });
    }
  });

  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const userId = req.user.id;

      const [user]: any = await db
        .select()
        .from(b2bUsers)
        .where(eq(b2bUsers.id, userId))
        .limit(1);

      if (!user)
        return res.status(404).json({ message: "Usuário não encontrado" });

      let userCos = [];
      try {
        userCos = await db
          .select({
            id: companies.id,
            razaoSocial:
              (companies as any).razao_social || (companies as any).razaoSocial,
            slug: companies.slug,
          })
          .from(userCompanies)
          .innerJoin(companies, eq(userCompanies.companyId, companies.id))
          .where(eq(userCompanies.userId, userId));
      } catch (cosError) {
        console.error("[AUTH USER COMPANIES ERROR]", cosError);
        userCos = [];
      }

      res.json({
        ...user,
        role: user.role || "admin",
        isSuperAdmin: user.email === "admin@admin.com",
        companies: userCos,
        isB2bUser: true,
      });
    } catch (error) {
      console.error("[AUTH USER ERROR]", error);
      res.status(500).json({ message: "Erro ao buscar dados do usuário" });
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.logout(() => res.json({ message: "Logout efetuado" }));
  });

  /* =========================================================
      PRODUTOS
  ========================================================= */

  app.get("/api/products", async (req, res) => {
    try {
      const result = await storage.getProducts(req.query);
      const productsList = Array.isArray(result)
        ? result
        : result.products || [];
      res.json(productsList);
    } catch (error) {
      console.error("[API PRODUCTS ERROR]", error);
      res.status(500).json({ message: "Erro ao buscar produtos" });
    }
  });

  app.post("/api/products", async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send();
      const product = await storage.createProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      console.error("[CREATE PRODUCT ERROR]", error);
      res.status(500).json({ message: "Erro ao criar produto" });
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const cats = await storage.getCategories();
      res.json(cats);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar categorias" });
    }
  });

  return httpServer;
}
