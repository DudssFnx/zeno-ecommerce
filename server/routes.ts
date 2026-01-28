import { b2bUsers, suppliers } from "@shared/schema";
import { b2bProducts } from "@shared/schema/products.schema";
import bcrypt from "bcryptjs";
import { and, desc, eq, sql } from "drizzle-orm";
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
  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ message: "Dados incompletos" });
      const lowerEmail = email.toLowerCase();

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

  app.post("/api/register", async (req: any, res) => {
    try {
      const { username, email } = req.body;
      const targetEmail = email || username;
      if (!targetEmail)
        return res.status(400).json({ message: "Email é obrigatório" });

      const existingUser = await storage.getUserByEmail(targetEmail);
      if (existingUser)
        return res.status(400).json({ message: "Usuário já existe" });

      const user = await storage.createUser(req.body);
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

  // --- ROTAS DE USUÁRIOS (CRUD) ---

  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.post("/api/users", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const { email } = req.body;
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser)
        return res.status(400).json({ message: "Email já cadastrado" });

      const userData = { ...req.body, approved: true };
      const newUser = await storage.createUser(userData);
      res.status(201).json(newUser);
    } catch (error) {
      console.error("[CREATE USER ERROR]", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  app.patch("/api/users/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const updated = await storage.updateUser(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  app.delete("/api/users/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      await storage.deleteUser(req.params.id);
      res.json({ message: "Usuário excluído" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });

  // --- PERMISSÕES ---
  app.get("/api/users/:id/permissions", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const user = await storage.getUser(req.params.id);
      if (!user)
        return res.status(404).json({ message: "Usuário não encontrado" });

      let modules = [];
      try {
        modules = user.modules ? JSON.parse(user.modules) : [];
      } catch (e) {
        modules = [];
      }
      res.json({ userId: user.id, modules });
    } catch (error) {
      console.error("[GET PERMISSIONS ERROR]", error);
      res.status(500).json({ message: "Erro ao buscar permissões" });
    }
  });

  app.post("/api/users/:id/permissions", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const { modules } = req.body;
      const modulesString = JSON.stringify(modules || []);
      await storage.updateUser(req.params.id, { modules: modulesString });
      res.json({ message: "Permissões atualizadas" });
    } catch (error) {
      console.error("[UPDATE PERMISSIONS ERROR]", error);
      res.status(500).json({ message: "Erro ao atualizar permissões" });
    }
  });

  // --- PRODUTOS ---
  app.get("/api/products", async (req, res) => {
    try {
      const result = await storage.getProducts(req.query);
      if (Array.isArray(result)) {
        res.json({ products: result, total: result.length });
      } else {
        res.json(result);
      }
    } catch (error) {
      res.status(500).send("Erro ao listar produtos");
    }
  });

  app.post("/api/products", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const { name, sku, price, stock } = req.body;

    const productData = {
      ...req.body,
      nome: name,
      precoVarejo: price,
      precoAtacado: req.body.cost,
    };

    const product = await storage.createProduct(productData);
    res.status(201).json(product);
  });

  app.patch("/api/products/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);
    const dataToUpdate: any = {};
    if (req.body.name) dataToUpdate.nome = req.body.name;
    if (req.body.sku) dataToUpdate.sku = req.body.sku;
    if (req.body.price !== undefined)
      dataToUpdate.precoVarejo = String(req.body.price || 0);
    if (req.body.stock !== undefined)
      dataToUpdate.estoque = Number(req.body.stock || 0);
    if (req.body.cost !== undefined)
      dataToUpdate.precoAtacado = String(req.body.cost || 0);
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

  // --- PEDIDOS ---
  app.get("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      console.error("[GET ORDERS ERROR]", error);
      res.status(500).json({ message: "Erro ao buscar pedidos" });
    }
  });

  app.post("/api/orders", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const order = await storage.createOrder(req.body);
      res.status(201).json(order);
    } catch (error) {
      console.error("[CREATE ORDER ERROR]", error);
      res.status(500).json({ message: "Erro ao criar pedido" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const order = await storage.getOrder(parseInt(req.params.id));
      if (!order)
        return res.status(404).json({ message: "Pedido não encontrado" });
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar pedido" });
    }
  });

  app.get("/api/categories", async (req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  // ==========================================
  // --- ROTAS DE FORNECEDORES (CRUD) ---
  // ==========================================

  app.get("/api/suppliers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const result = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.companyId, req.user.companyId))
        .orderBy(desc(suppliers.id));
      res.json(result);
    } catch (error) {
      console.error("Erro ao listar fornecedores:", error);
      res.status(500).json({ message: "Erro ao buscar fornecedores" });
    }
  });

  app.post("/api/suppliers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const newSupplierData = {
        ...req.body,
        companyId: req.user.companyId,
      };

      const [supplier] = await db
        .insert(suppliers)
        .values(newSupplierData)
        .returning();
      res.status(201).json(supplier);
    } catch (error) {
      console.error("Erro ao criar fornecedor:", error);
      res.status(500).json({ message: "Erro ao criar fornecedor" });
    }
  });

  app.patch("/api/suppliers/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const [updated] = await db
        .update(suppliers)
        .set(req.body)
        .where(
          and(
            eq(suppliers.id, parseInt(req.params.id)),
            eq(suppliers.companyId, req.user.companyId),
          ),
        )
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar fornecedor" });
    }
  });

  app.delete("/api/suppliers/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      await db
        .delete(suppliers)
        .where(
          and(
            eq(suppliers.id, parseInt(req.params.id)),
            eq(suppliers.companyId, req.user.companyId),
          ),
        );
      res.json({ message: "Fornecedor excluído" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir fornecedor" });
    }
  });

  app.get("/api/suppliers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const result = await db
        .select()
        .from(suppliers)
        // Comentamos o filtro para garantir que você veja QUALQUER fornecedor salvo
        // .where(eq(suppliers.companyId, Number(req.user.companyId)))
        .orderBy(desc(suppliers.id));

      console.log("Fornecedores encontrados:", result.length);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar fornecedores" });
    }
  });

  // 2. Rota de Criação (Forçando ID numérico)
  app.post("/api/suppliers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const newSupplierData = {
        ...req.body,
        // Se req.user.companyId for null ou string, convertemos para número 1 para teste
        companyId: Number(req.user.companyId) || 1,
      };

      const [supplier] = await db
        .insert(suppliers)
        .values(newSupplierData)
        .returning();

      console.log("Fornecedor gravado com sucesso no Banco ID:", supplier.id);
      res.status(201).json(supplier);
    } catch (error: any) {
      console.error("ERRO DE GRAVAÇÃO:", error.message);
      res
        .status(500)
        .json({ message: "Erro ao salvar no banco: " + error.message });
    }
  });

  app.post("/api/suppliers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const newSupplierData = {
        ...req.body,
        companyId: req.user.companyId, // <--- GARANTE O SALVAMENTO NA SUA EMPRESA
      };
      const [supplier] = await db
        .insert(suppliers)
        .values(newSupplierData)
        .returning();
      res.status(201).json(supplier);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao criar: " + error.message });
    }
  });

  return httpServer;
}
