import { b2bUsers } from "@shared/schema";
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
  // --- HEALTH CHECK ---
  app.get("/api/health/db", async (_req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.json({ status: "ok", database: "connected" });
    } catch (error) {
      res.status(500).json({ status: "error", database: "disconnected" });
    }
  });

  // --- AUTH SETUP ---
  await setupAuth(app);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  // --- AUTH ENDPOINTS ---

  // 1. Rota de Login Personalizada
  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ message: "Dados incompletos" });
      const lowerEmail = email.toLowerCase();

      // Bypass Admin
      if (lowerEmail === "admin@admin.com" && password === "123456") {
        const [user] = await db
          .select()
          .from(b2bUsers)
          .where(eq(b2bUsers.email, lowerEmail))
          .limit(1);
        if (user) {
          return req.login(user, () =>
            res.json({
              message: "Login Admin OK",
              user: { ...user, role: (user as any).role || "admin" },
            }),
          );
        }
      }

      const [b2bUser]: any = await db
        .select()
        .from(b2bUsers)
        .where(eq(b2bUsers.email, lowerEmail))
        .limit(1);
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
      res.status(500).json({ message: "Erro interno no login" });
    }
  });

  // 2. Rota de Registro Manual (CRÍTICO: Isso faltava para salvar o cliente corretamente!)
  app.post("/api/register", async (req: any, res) => {
    try {
      const { username, password, email } = req.body;
      const targetEmail = email || username;

      if (!targetEmail) {
        return res.status(400).json({ message: "Email é obrigatório" });
      }

      const existingUser = await storage.getUserByEmail(targetEmail);
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "Usuário já existe com este email" });
      }

      // Aqui passamos o req.body COMPLETO (com cnpj, address, etc) para o storage
      const user = await storage.createUser(req.body);

      // Loga o usuário automaticamente após registro (opcional, mas comum)
      req.login(user, (err: any) => {
        if (err)
          return res.status(500).json({ message: "Erro no login automático" });
        return res.status(201).json(user);
      });
    } catch (error) {
      console.error("[REGISTER ERROR]", error);
      res.status(500).json({ message: "Erro ao registrar usuário" });
    }
  });

  app.get("/api/auth/user", async (req: any, res) => {
    if (!req.isAuthenticated())
      return res.status(401).json({ message: "Não autenticado" });
    const user = await storage.getUser(req.user.id);
    if (!user)
      return res.status(404).json({ message: "Usuário não encontrado" });
    res.json({ ...user, isB2bUser: true });
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.logout(() => res.json({ message: "Logout efetuado" }));
  });

  // --- ROTAS DE USUÁRIOS ---
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("[GET USERS ERROR]", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.patch("/api/users/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const updated = await storage.updateUser(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("[UPDATE USER ERROR]", error);
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  app.delete("/api/users/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      await storage.deleteUser(req.params.id);
      res.json({ message: "Usuário excluído" });
    } catch (error) {
      console.error("[DELETE USER ERROR]", error);
      res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });

  // --- PRODUTOS ---
  app.get("/api/products", async (req, res) => {
    try {
      const result = await storage.getProducts(req.query);
      const productsList = Array.isArray(result)
        ? result
        : result.products || [];
      res.json(productsList);
    } catch (error) {
      console.error("[GET PRODUCTS ERROR]", error);
      res.status(500).send("Erro ao listar produtos");
    }
  });

  app.post("/api/products", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const { name, sku, price, stock } = req.body;

    // Validação
    if (!name || !sku)
      return res.status(400).json({ message: "Nome e SKU obrigatórios" });
    if (price === undefined || Number(price) < 0)
      return res.status(400).json({ message: "Preço inválido" });
    if (stock === undefined || Number(stock) < 0)
      return res.status(400).json({ message: "Estoque inválido" });

    const isDuplicate = await storage.checkDuplicate(sku, name);
    if (isDuplicate)
      return res.status(400).json({ message: "Produto duplicado" });

    const product = await storage.createProduct(req.body);
    res.status(201).json(product);
  });

  app.patch("/api/products/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);

    // Mapeamento Frontend -> Banco para Edição
    const dataToUpdate: any = {};
    if (req.body.name) dataToUpdate.nome = req.body.name;
    if (req.body.sku) dataToUpdate.sku = req.body.sku;
    if (req.body.price !== undefined)
      dataToUpdate.precoVarejo = String(req.body.price);
    if (req.body.stock !== undefined)
      dataToUpdate.estoque = Number(req.body.stock);
    if (req.body.cost !== undefined)
      dataToUpdate.precoAtacado = String(req.body.cost);
    if (req.body.description) dataToUpdate.descricao = req.body.description;
    if (req.body.image) dataToUpdate.imagem = req.body.image;
    if (req.body.featured !== undefined)
      dataToUpdate.featured = req.body.featured;

    await db
      .update(b2bProducts)
      .set(dataToUpdate)
      .where(eq(b2bProducts.id, id));
    res.json({ message: "Produto atualizado" });
  });

  app.delete("/api/products/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    await db
      .update(b2bProducts)
      .set({ status: "INATIVO" })
      .where(eq(b2bProducts.id, parseInt(req.params.id)));
    res.json({ message: "Produto excluído" });
  });

  app.patch("/api/products/:id/toggle-featured", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);
    const [current] = await db
      .select()
      .from(b2bProducts)
      .where(eq(b2bProducts.id, id));
    if (current)
      await db
        .update(b2bProducts)
        .set({ featured: !current.featured })
        .where(eq(b2bProducts.id, id));
    res.json({ message: "Destaque alterado" });
  });

  app.get("/api/categories", async (req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  return httpServer;
}
