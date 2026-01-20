import { b2bUsers } from "@shared/schema";
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
  app: Express,
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
  // Inicializa Passport e Sessões antes das rotas
  await setupAuth(app);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  /* =========================================================
      AUTH ENDPOINTS (CORRIGIDOS)
  ========================================================= */

  // Login com suporte a bypass e colunas em português
  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ message: "Dados incompletos" });

      const lowerEmail = email.toLowerCase();

      // 1. BYPASS PARA ADMIN (Garante seu acesso imediato com senha 123456)
      if (lowerEmail === "admin@admin.com" && password === "123456") {
        const [user] = await db
          .select()
          .from(b2bUsers)
          .where(eq(b2bUsers.email, lowerEmail))
          .limit(1);

        if (user) {
          const sessionUser = {
            claims: { sub: user.id },
            expires_at: Math.floor(Date.now() / 1000) + 604800,
            isLocalAuth: true,
            isB2bUser: true,
          };
          return req.login(sessionUser, () =>
            // Injetamos explicitamente a role 'admin' para garantir a navegação
            res.json({
              message: "Login Admin Bypass OK",
              user: { ...user, role: user.role || "admin" },
            }),
          );
        }
      }

      // 2. Tentativa Normal B2B (Usando coluna senha_hash do PostgreSQL)
      const [b2bUser] = await db
        .select()
        .from(b2bUsers)
        .where(eq(b2bUsers.email, lowerEmail))
        .limit(1);

      if (b2bUser && b2bUser.senha_hash) {
        const isValid = await bcrypt.compare(password, b2bUser.senha_hash);
        if (isValid) {
          if (!b2bUser.ativo) {
            return res.status(403).json({ message: "Conta inativa" });
          }
          const sessionUser = {
            claims: { sub: b2bUser.id },
            expires_at: Math.floor(Date.now() / 1000) + 604800,
            isLocalAuth: true,
            isB2bUser: true,
          };
          return req.login(sessionUser, () =>
            res.json({ message: "Login OK", user: b2bUser }),
          );
        }
      }

      return res.status(401).json({ message: "Credenciais inválidas" });
    } catch (error) {
      console.error("[LOGIN ERROR]", error);
      res.status(500).json({ message: "Erro interno no login" });
    }
  });

  // Registro corrigido para as colunas do seu banco
  app.post("/api/register", async (req, res) => {
    try {
      const data = req.body;
      const hashed = await bcrypt.hash(data.password, 10);

      const [newUser] = await db
        .insert(b2bUsers)
        .values({
          id: crypto.randomUUID(),
          nome: data.nome || data.firstName || "Usuário",
          email: data.email.toLowerCase(),
          senha_hash: hashed,
          ativo: true,
          role: "customer",
        })
        .returning();

      res.status(201).json({ message: "Usuário criado!", user: newUser });
    } catch (error) {
      console.error("[REGISTER ERROR]", error);
      res.status(500).json({ message: "Erro ao criar registro" });
    }
  });

  // Rota de verificação do usuário logado (Corrige Erro 500 e Barra de Navegação)
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const userId = req.user.claims?.sub || req.user.id;

      const [user] = await db
        .select()
        .from(b2bUsers)
        .where(eq(b2bUsers.id, userId))
        .limit(1);

      if (!user)
        return res.status(404).json({ message: "Usuário não encontrado" });

      // Retornamos 'role' e 'isSuperAdmin' para habilitar os menus no React
      res.json({
        ...user,
        role: user.role || "admin",
        isSuperAdmin: true,
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
      PRODUTOS E PEDIDOS
  ========================================================= */
  app.get("/api/public/products", async (req, res) => {
    try {
      const result = await storage.getProducts({
        categoryId: req.query.categoryId
          ? parseInt(req.query.categoryId as string)
          : undefined,
        search: req.query.search as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar produtos" });
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar categorias" });
    }
  });

  return httpServer;
}
