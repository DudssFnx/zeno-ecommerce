import { Client } from "@replit/object-storage";
import { b2bUsers } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { type Express } from "express";
import { type Server } from "http";
import multer from "multer";
import { db } from "./db";
import { checkIsSuperAdmin } from "./middleware/superAdmin";
import { isAuthenticated, setupAuth } from "./replitAuth";
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

  /* =========================================================
      UTILITIES
  ========================================================= */
  const RETAIL_MARKUP = 0.4;

  async function fetchImageBuffer(url: string): Promise<Buffer | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  let objectStorageClient: Client | null = null;
  async function getObjectStorage(): Promise<Client> {
    if (!objectStorageClient) {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId)
        throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID missing");
      objectStorageClient = new Client({ bucketId });
    }
    return objectStorageClient;
  }

  async function generateOrderNumber(): Promise<string> {
    const next = await storage.getNextOrderNumber();
    return next.toString();
  }

  /* =========================================================
      AUTH HELPERS / MIDDLEWARES
  ========================================================= */
  async function isAdmin(req: any, res: any, next: any) {
    const user = await storage.getUser(req.user?.claims?.sub);
    if (user?.role !== "admin") {
      return res.status(403).json({ message: "Apenas administradores" });
    }
    next();
  }

  async function isAdminOrSales(req: any, res: any, next: any) {
    const user = await storage.getUser(req.user?.claims?.sub);
    if (!user || !["admin", "sales"].includes(user.role)) {
      return res.status(403).json({ message: "Apenas admin ou vendas" });
    }
    next();
  }

  async function isApproved(req: any, res: any, next: any) {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Não autorizado" });

      const isSuperAdmin = await checkIsSuperAdmin(userId);
      if (isSuperAdmin) return next();

      if (req.user?.isB2bUser) {
        const [b2bUser] = await db
          .select()
          .from(b2bUsers)
          .where(eq(b2bUsers.id, userId));
        if (!b2bUser || !b2bUser.ativo)
          return res.status(403).json({ message: "Conta pendente ou inativa" });
        return next();
      }

      const user = await storage.getUser(userId);
      if (!user || (!user.approved && user.role !== "admin")) {
        return res.status(403).json({ message: "Conta aguardando aprovação" });
      }
      next();
    } catch (error) {
      res.status(500).json({ message: "Erro interno de validação" });
    }
  }

  /* =========================================================
      AUTH ENDPOINTS
  ========================================================= */
  app.post("/api/register", async (req, res) => {
    try {
      const data = req.body;
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser)
        return res.status(400).json({ message: "E-mail já cadastrado" });

      let hashedPassword = data.password
        ? await bcrypt.hash(data.password, 10)
        : null;
      const isRetailCustomer = data.personType === "fisica";

      const newUser = await storage.upsertUser({
        id: crypto.randomUUID(),
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: null,
        profileImageUrl: null,
        role: "customer",
        company: data.company || null,
        approved: isRetailCustomer,
        phone: data.phone || null,
        personType: data.personType || null,
        cnpj: data.cnpj || null,
        cpf: data.cpf || null,
        tradingName: data.tradingName || null,
        stateRegistration: data.stateRegistration || null,
        cep: data.cep || null,
        address: data.address || null,
        addressNumber: data.addressNumber || null,
        complement: data.complement || null,
        neighborhood: data.neighborhood || null,
        city: data.city || null,
        state: data.state || null,
      });

      res.status(201).json({
        message: isRetailCustomer
          ? "Sucesso! Faça login."
          : "Sucesso! Aguarde aprovação.",
        userId: newUser.id,
        approved: newUser.approved,
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao criar cadastro" });
    }
  });

  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ message: "Dados incompletos" });

      // 1. Tentar Usuário Legado
      const user = await storage.getUserByEmail(email);
      if (user && user.password) {
        const isValid = await bcrypt.compare(password, user.password);
        if (isValid) {
          const sessionUser = {
            claims: { sub: user.id },
            expires_at: Math.floor(Date.now() / 1000) + 604800,
            isLocalAuth: true,
            isB2bUser: false,
          };
          return req.login(sessionUser, () =>
            res.json({ message: "Login OK", user })
          );
        }
      }

      // 2. Tentar Usuário B2B
      const [b2bUser] = await db
        .select()
        .from(b2bUsers)
        .where(eq(b2bUsers.email, email));
      if (b2bUser && b2bUser.senhaHash) {
        const isValid = await bcrypt.compare(password, b2bUser.senhaHash);
        if (isValid && b2bUser.ativo) {
          const sessionUser = {
            claims: { sub: b2bUser.id },
            expires_at: Math.floor(Date.now() / 1000) + 604800,
            isLocalAuth: true,
            isB2bUser: true,
          };
          return req.login(sessionUser, () =>
            res.json({ message: "Login B2B OK", user: b2bUser })
          );
        }
      }

      return res
        .status(401)
        .json({ message: "Credenciais inválidas ou conta inativa" });
    } catch (error) {
      res.status(500).json({ message: "Erro no servidor durante login" });
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.logout(() => res.json({ message: "Logout efetuado" }));
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const isB2bUser = req.user.isB2bUser;
    const isSuperAdmin = await checkIsSuperAdmin(userId);

    if (isB2bUser) {
      const [user] = await db
        .select()
        .from(b2bUsers)
        .where(eq(b2bUsers.id, userId));
      return user
        ? res.json({ ...user, isSuperAdmin, isB2bUser: true })
        : res.status(404).end();
    }
    const user = await storage.getUser(userId);
    return user
      ? res.json({ ...user, isSuperAdmin, isB2bUser: false })
      : res.status(404).end();
  });

  /* =========================================================
      PRODUCT & CATEGORY ROUTES
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

      const allCats = await storage.getCategories();
      const hiddenIds = new Set(
        allCats.filter((c) => c.hideFromVarejo).map((c) => c.id)
      );

      const filtered = result.products
        .filter((p) => !p.categoryId || !hiddenIds.has(p.categoryId))
        .map((p) => ({
          ...p,
          price: (parseFloat(p.price) * (1 + RETAIL_MARKUP)).toFixed(2),
        }));

      res.json({ ...result, products: filtered, total: filtered.length });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar produtos" });
    }
  });

  app.get("/api/categories", isAuthenticated, isApproved, async (req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  });

  /* =========================================================
      ORDER ROUTES (INCLUDING GUEST)
  ========================================================= */
  app.post(
    "/api/orders",
    isAuthenticated,
    isApproved,
    async (req: any, res) => {
      try {
        const loggedUserId = req.user.claims.sub;
        const loggedUser = await storage.getUser(loggedUserId);
        const { items, userId: targetUserId, notes, shippingCost } = req.body;

        const userId =
          (loggedUser?.role === "admin" || loggedUser?.role === "sales") &&
          targetUserId
            ? targetUserId
            : loggedUserId;

        const order = await storage.createOrder({
          userId,
          orderNumber: await generateOrderNumber(),
          status: "ORCAMENTO",
          subtotal: req.body.subtotal.toFixed(2),
          total: (req.body.subtotal + (shippingCost || 0)).toFixed(2),
          isGuestOrder: false,
          ...req.body,
        });

        for (const item of items) {
          await storage.createOrderItem({ orderId: order.id, ...item });
        }

        res.status(201).json(order);
      } catch (error) {
        res.status(500).json({ message: "Erro ao criar pedido" });
      }
    }
  );

  app.post("/api/orders/guest", async (req, res) => {
    try {
      const { items, guestCpf, guestName, subtotal, shippingCost } = req.body;

      if (!guestCpf || guestCpf.replace(/\D/g, "").length !== 11) {
        return res.status(400).json({ message: "CPF válido é obrigatório" });
      }

      const order = await storage.createOrder({
        userId: null,
        orderNumber: await generateOrderNumber(),
        status: "ORCAMENTO",
        isGuestOrder: true,
        guestCpf: guestCpf.replace(/\D/g, ""),
        subtotal: subtotal.toFixed(2),
        total: (subtotal + (shippingCost || 0)).toFixed(2),
        ...req.body,
      });

      for (const item of items) {
        await storage.createOrderItem({ orderId: order.id, ...item });
      }

      res.status(201).json(order);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao processar pedido convidado" });
    }
  });

  return httpServer;
}
