import { b2bUsers, companies, userCompanies } from "@shared/schema";
// ADICIONADO: Importamos a tabela de produtos aqui
import { b2bProducts } from "@shared/schema/products.schema";
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
            }),
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
      PRODUTOS (GET, POST, PATCH, DELETE)
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

      // VALIDAÇÃO DE DUPLICIDADE (NOVO)
      // Se já existe SKU ou Nome, bloqueia a criação
      if (req.body.sku || req.body.name) {
        const isDuplicate = await storage.checkDuplicate(
          req.body.sku,
          req.body.name,
        );
        if (isDuplicate) {
          return res
            .status(400)
            .json({ message: "Já existe um produto com este Nome ou SKU." });
        }
      }

      const product = await storage.createProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      console.error("[CREATE PRODUCT ERROR]", error);
      res.status(500).json({ message: "Erro ao criar produto" });
    }
  });

  // NOVO: Rota para deletar (Soft Delete)
  app.delete("/api/products/:id", async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send();
      const id = parseInt(req.params.id);

      // Executa o Soft Delete no banco
      await db
        .update(b2bProducts)
        .set({ status: "INATIVO" })
        .where(eq(b2bProducts.id, id));

      console.log(`[DELETE] Produto ${id} inativado com sucesso.`);
      res.json({ message: "Produto excluído (inativado)" });
    } catch (error) {
      console.error("[DELETE PRODUCT ERROR]", error);
      res.status(500).json({ message: "Erro ao excluir produto" });
    }
  });

  // NOVO: Rota para editar produto
  app.patch("/api/products/:id", async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send();
      const id = parseInt(req.params.id);

      // VALIDAÇÃO DE DUPLICIDADE NA EDIÇÃO (NOVO)
      if (req.body.name || req.body.sku) {
        // Busca o produto atual para comparar
        const [current] = await db
          .select()
          .from(b2bProducts)
          .where(eq(b2bProducts.id, id));

        if (current) {
          const newName = req.body.name || current.nome;
          const newSku = req.body.sku || current.sku;

          // Verificamos duplicidade EXCLUINDO o próprio ID da busca
          const isDuplicate = await storage.checkDuplicate(newSku, newName, id);

          if (isDuplicate) {
            return res
              .status(400)
              .json({
                message: "Já existe outro produto com este Nome ou SKU.",
              });
          }
        }
      }

      await db.update(b2bProducts).set(req.body).where(eq(b2bProducts.id, id));

      res.json({ message: "Produto atualizado" });
    } catch (error) {
      console.error("[UPDATE PRODUCT ERROR]", error);
      res.status(500).json({ message: "Erro ao atualizar" });
    }
  });

  // NOVO: Rota para alternar destaque
  app.patch("/api/products/:id/toggle-featured", async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send();
      const id = parseInt(req.params.id);

      const [current] = await db
        .select()
        .from(b2bProducts)
        .where(eq(b2bProducts.id, id));
      if (current) {
        await db
          .update(b2bProducts)
          .set({ featured: !current.featured })
          .where(eq(b2bProducts.id, id));
      }
      res.json({ message: "Destaque alterado" });
    } catch (error) {
      res.status(500).json({ message: "Erro" });
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
