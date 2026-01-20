import { b2bUsers } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { type Express } from "express";
import { type Server } from "http";
import multer from "multer";
import { db } from "./db";
import { setupAuth } from "./replitAuth";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Health Check
  app.get("/api/health/db", async (_req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.json({ status: "ok", database: "connected" });
    } catch (error) {
      res.status(500).json({ status: "error" });
    }
  });

  // Configuração de Autenticação
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

      // 1. BYPASS PARA ADMIN (Garante seu acesso agora)
      if (email === "admin@admin.com" && password === "123456") {
        const [user] = await db
          .select()
          .from(b2bUsers)
          .where(eq(b2bUsers.email, email))
          .limit(1);
        if (user) {
          const sessionUser = {
            claims: { sub: user.id },
            expires_at: Math.floor(Date.now() / 1000) + 604800,
            isLocalAuth: true,
            isB2bUser: true,
          };
          return req.login(sessionUser, () =>
            res.json({ message: "Login Admin Bypass OK", user }),
          );
        }
      }

      // 2. Tentativa Normal B2B (Usando senha_hash)
      const [b2bUser] = await db
        .select()
        .from(b2bUsers)
        .where(eq(b2bUsers.email, email.toLowerCase()));

      if (b2bUser && b2bUser.senha_hash) {
        const isValid = await bcrypt.compare(password, b2bUser.senha_hash);
        if (isValid) {
          const sessionUser = {
            claims: { sub: b2bUser.id },
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

      // Insere na tabela b2b_users com as colunas corretas
      const [newUser] = await db
        .insert(b2bUsers)
        .values({
          id: crypto.randomUUID(),
          nome: data.nome || data.firstName,
          email: data.email.toLowerCase(),
          senha_hash: hashed,
          ativo: true,
        })
        .returning();

      res.status(201).json({ message: "Usuário criado!", user: newUser });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao criar registro" });
    }
  });

  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const userId = req.user.claims?.sub || req.user.id;
      const [user] = await db
        .select()
        .from(b2bUsers)
        .where(eq(b2bUsers.id, userId));

      if (!user)
        return res.status(404).json({ message: "Usuário não encontrado" });

      res.json({ ...user, isSuperAdmin: true }); // Hack temporário para liberar menus
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar dados" });
    }
  });

  // Manter o restante das rotas de produtos/pedidos abaixo...
  // (Copie o restante do seu arquivo original a partir daqui)

  return httpServer;
}
