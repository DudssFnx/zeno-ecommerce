import { type Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { products, orderItems, orders, b2bUsers } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertCategorySchema,
  insertProductSchema,
  insertCouponSchema,
  insertCatalogBannerSchema,
  insertCatalogSlideSchema,
  insertSupplierSchema,
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { Client } from "@replit/object-storage";
import * as blingService from "./services/bling";
import bcrypt from "bcryptjs";
import PDFDocument from "pdfkit";
import { requireSuperAdmin, checkIsSuperAdmin } from "./middleware/superAdmin";
import * as companiesService from "./services/companies.service";

/* =========================================================
   SINGLE AND CORRECT registerRoutes
========================================================= */
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

  /* =========================================================
     UTILITIES
  ========================================================= */

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
      if (!bucketId) {
        throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID missing");
      }
      objectStorageClient = new Client({ bucketId });
    }
    return objectStorageClient;
  }

  async function generateOrderNumber(): Promise<string> {
    const next = await storage.getNextOrderNumber();
    return next.toString();
  }

  /* =========================================================
     AUTH HELPERS
  ========================================================= */

  function isAdmin(req: any, res: any, next: any) {
    storage.getUser(req.user?.claims?.sub).then((user) => {
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin only" });
      }
      next();
    });
  }

  function isAdminOrSales(req: any, res: any, next: any) {
    storage.getUser(req.user?.claims?.sub).then((user) => {
      if (!user || !["admin", "sales"].includes(user.role)) {
        return res.status(403).json({ message: "Admin or Sales only" });
      }
      next();
    });
  }

  async function isApproved(req: any, res: any, next: any) {
    try {
      const userId = req.user?.claims?.sub;
      const isB2bUser = req.user?.isB2bUser;
      
      // Guard: if no userId, return 401
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if SUPER_ADMIN (always approved)
      const isSuperAdmin = await checkIsSuperAdmin(userId);
      if (isSuperAdmin) {
        return next();
      }
      
      // For B2B users, check if they exist and are active
      if (isB2bUser) {
        const [b2bUser] = await db.select().from(b2bUsers).where(eq(b2bUsers.id, userId));
        if (!b2bUser || !b2bUser.ativo) {
          return res.status(403).json({ message: "Account pending approval" });
        }
        return next();
      }
      
      // For legacy users
      const user = await storage.getUser(userId);
      if (!user || (!user.approved && user.role !== "admin")) {
        return res.status(403).json({ message: "Account pending approval" });
      }
      next();
    } catch (error) {
      console.error("[isApproved] Error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  // Public registration endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const data = req.body;

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "E-mail já cadastrado" });
      }

      // Hash password if provided
      let hashedPassword = null;
      if (data.password) {
        hashedPassword = await bcrypt.hash(data.password, 10);
      }

      // Auto-approve retail customers (personType = fisica)
      const isRetailCustomer = data.personType === "fisica";

      // Create new user with pending approval (auto-approved for retail)
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

      const message = isRetailCustomer
        ? "Cadastro realizado com sucesso! Voce ja pode fazer login."
        : "Cadastro realizado com sucesso! Aguarde aprovacao do administrador.";

      res.status(201).json({
        message,
        userId: newUser.id,
        approved: newUser.approved,
      });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Erro ao criar cadastro" });
    }
  });

  // Local login endpoint (email/password) - supports both legacy users and B2B users
  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;
      console.log("[Login] Attempt for email:", email);

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "E-mail e senha são obrigatórios" });
      }

      // Try legacy users first
      const user = await storage.getUserByEmail(email);
      if (user) {
        console.log("[Login] Found legacy user:", user.id);
        if (!user.password) {
          return res
            .status(401)
            .json({ message: "Esta conta não possui senha cadastrada" });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          console.log("[Login] Invalid password for legacy user");
          return res.status(401).json({ message: "E-mail ou senha incorretos" });
        }

        const sessionExpiry = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        const sessionUser = {
          claims: { sub: user.id },
          expires_at: sessionExpiry,
          isLocalAuth: true,
          isB2bUser: false,
        };

        return req.login(sessionUser, (err: any) => {
          if (err) {
            console.error("[Login] Session creation error for legacy user:", err);
            return res.status(500).json({ message: "Erro ao fazer login" });
          }
          console.log("[Login] Success for legacy user:", user.id);
          res.json({ message: "Login realizado com sucesso", user });
        });
      }

      // Try B2B users
      console.log("[Login] Checking B2B users...");
      const [b2bUser] = await db.select().from(b2bUsers).where(eq(b2bUsers.email, email));
      if (b2bUser) {
        console.log("[Login] Found B2B user:", b2bUser.id);
        if (!b2bUser.senhaHash) {
          return res
            .status(401)
            .json({ message: "Esta conta não possui senha cadastrada" });
        }

        if (!b2bUser.ativo) {
          console.log("[Login] B2B user inactive");
          return res.status(401).json({ message: "Conta desativada" });
        }

        const isValidPassword = await bcrypt.compare(password, b2bUser.senhaHash);
        if (!isValidPassword) {
          console.log("[Login] Invalid password for B2B user");
          return res.status(401).json({ message: "E-mail ou senha incorretos" });
        }

        const sessionExpiry = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        const sessionUser = {
          claims: { sub: b2bUser.id },
          expires_at: sessionExpiry,
          isLocalAuth: true,
          isB2bUser: true,
        };

        return req.login(sessionUser, (err: any) => {
          if (err) {
            console.error("[Login] Session creation error for B2B user:", err);
            return res.status(500).json({ message: "Erro ao fazer login" });
          }
          console.log("[Login] Success for B2B user:", b2bUser.id);
          res.json({ message: "Login realizado com sucesso", user: b2bUser });
        });
      }

      console.log("[Login] User not found:", email);
      return res.status(401).json({ message: "E-mail ou senha incorretos" });
    } catch (error) {
      console.error("[Login] Exception:", error);
      res.status(500).json({ message: "Erro ao fazer login" });
    }
  });

  // Local logout endpoint
  app.post("/api/auth/logout", (req: any, res) => {
    req.logout((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  // Auth routes - supports both legacy users and B2B users
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isB2bUser = req.user.isB2bUser;

      if (isB2bUser) {
        const [b2bUser] = await db.select().from(b2bUsers).where(eq(b2bUsers.id, userId));
        if (!b2bUser) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const isSuperAdmin = await checkIsSuperAdmin(userId);
        res.json({ ...b2bUser, isSuperAdmin, isB2bUser: true });
      } else {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const isSuperAdmin = await checkIsSuperAdmin(userId);
        res.json({ ...user, isSuperAdmin, isB2bUser: false });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ========== CATEGORIES ==========
  app.get("/api/categories", isAuthenticated, isApproved, async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get(
    "/api/categories/:id",
    isAuthenticated,
    isApproved,
    async (req, res) => {
      try {
        const category = await storage.getCategory(parseInt(req.params.id));
        if (!category) {
          return res.status(404).json({ message: "Category not found" });
        }
        res.json(category);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch category" });
      }
    },
  );

  app.post(
    "/api/categories",
    isAuthenticated,
    isAdminOrSales,
    async (req, res) => {
      try {
        const data = insertCategorySchema.parse(req.body);
        const category = await storage.createCategory(data);
        res.status(201).json(category);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create category" });
      }
    },
  );

  app.patch(
    "/api/categories/:id",
    isAuthenticated,
    isAdminOrSales,
    async (req, res) => {
      try {
        const category = await storage.updateCategory(
          parseInt(req.params.id),
          req.body,
        );
        if (!category) {
          return res.status(404).json({ message: "Category not found" });
        }
        res.json(category);
      } catch (error) {
        res.status(500).json({ message: "Failed to update category" });
      }
    },
  );

  app.delete(
    "/api/categories/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        await storage.deleteCategory(parseInt(req.params.id));
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete category" });
      }
    },
  );

  // ========== PUBLIC CATALOG (no auth required) ==========
  // Retail markup: 40% on top of base price
  const RETAIL_MARKUP = 0.4;

  app.get("/api/public/products", async (req, res) => {
    try {
      const categoryId = req.query.categoryId
        ? parseInt(req.query.categoryId as string)
        : undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const sort = req.query.sort as string | undefined;
      const result = await storage.getProducts({
        categoryId,
        search,
        page,
        limit,
        sort,
      });

      // Get categories hidden from varejo
      const allCategories = await storage.getCategories();
      const hiddenCategoryIds = new Set(
        allCategories.filter((c) => c.hideFromVarejo).map((c) => c.id),
      );

      // Filter out products from hidden categories
      const visibleProducts = result.products.filter(
        (p) => !p.categoryId || !hiddenCategoryIds.has(p.categoryId),
      );

      // Apply retail markup (40%) to all prices for public view
      const productsWithRetailPrice = visibleProducts.map((p) => ({
        ...p,
        price: (parseFloat(p.price) * (1 + RETAIL_MARKUP)).toFixed(2),
      }));

      res.json({
        ...result,
        products: productsWithRetailPrice,
        total: visibleProducts.length,
      });
    } catch (error) {
      console.error("Error fetching public products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/public/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      // Filter out categories hidden from varejo
      const publicCategories = categories.filter((c) => !c.hideFromVarejo);
      res.json(publicCategories);
    } catch (error) {
      console.error("Error fetching public categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // ========== PRODUCTS ==========
  app.get(
    "/api/products",
    isAuthenticated,
    isApproved,
    async (req: any, res) => {
      try {
        const categoryId = req.query.categoryId
          ? parseInt(req.query.categoryId as string)
          : undefined;
        const search = req.query.search as string | undefined;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const limit = req.query.limit
          ? parseInt(req.query.limit as string)
          : 50;
        const result = await storage.getProducts({
          categoryId,
          search,
          page,
          limit,
        });

        // Get user to check customer type
        const userId = req.user?.claims?.sub;
        const user = userId ? await storage.getUser(userId) : null;

        // Atacado customers see base price, varejo customers see price + 40%
        const isAtacado =
          user?.customerType === "atacado" ||
          user?.role === "admin" ||
          user?.role === "sales";

        if (isAtacado) {
          // Atacado: show base price (no markup)
          res.json(result);
        } else {
          // Varejo: apply 40% markup
          const productsWithRetailPrice = result.products.map((p) => ({
            ...p,
            price: (parseFloat(p.price) * (1 + RETAIL_MARKUP)).toFixed(2),
          }));
          res.json({
            ...result,
            products: productsWithRetailPrice,
          });
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: "Failed to fetch products" });
      }
    },
  );

  app.get(
    "/api/products/:id",
    isAuthenticated,
    isApproved,
    async (req, res) => {
      try {
        const product = await storage.getProduct(parseInt(req.params.id));
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }
        res.json(product);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch product" });
      }
    },
  );

  app.post(
    "/api/products",
    isAuthenticated,
    isAdminOrSales,
    async (req, res) => {
      try {
        const data = insertProductSchema.parse(req.body);
        const product = await storage.createProduct(data);
        res.status(201).json(product);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Error creating product:", error);
        res.status(500).json({ message: "Failed to create product" });
      }
    },
  );

  app.patch(
    "/api/products/:id",
    isAuthenticated,
    isAdminOrSales,
    async (req, res) => {
      try {
        const product = await storage.updateProduct(
          parseInt(req.params.id),
          req.body,
        );
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }
        res.json(product);
      } catch (error) {
        res.status(500).json({ message: "Failed to update product" });
      }
    },
  );

  app.delete(
    "/api/products/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        await storage.deleteProduct(parseInt(req.params.id));
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete product" });
      }
    },
  );

  app.patch(
    "/api/products/:id/toggle-featured",
    isAuthenticated,
    isAdminOrSales,
    async (req, res) => {
      try {
        const productId = parseInt(req.params.id);
        const product = await storage.getProduct(productId);
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }
        const updated = await storage.updateProduct(productId, {
          featured: !product.featured,
        });
        res.json(updated);
      } catch (error) {
        res.status(500).json({ message: "Failed to toggle featured status" });
      }
    },
  );

  // ========== ORDERS ==========
  app.get("/api/orders", isAuthenticated, isApproved, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      let ordersData;
      // Customers can only see their own orders
      if (user?.role === "customer") {
        ordersData = await storage.getOrders(userId);
      } else {
        // Admin and sales can see all orders
        ordersData = await storage.getOrders();
      }

      // Fetch customer info and item count for each order
      const ordersWithCustomers = await Promise.all(
        ordersData.map(async (order) => {
          const customer = order.userId
            ? await storage.getUser(order.userId)
            : null;
          const orderItems = await storage.getOrderItems(order.id);
          return {
            ...order,
            customerName: customer
              ? customer.tradingName ||
                customer.company ||
                `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
                customer.email
              : (order.userId?.substring(0, 8) || "Guest") + "...",
            items: orderItems,
          };
        }),
      );

      res.json(ordersWithCustomers);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get(
    "/api/orders/:id",
    isAuthenticated,
    isApproved,
    async (req: any, res) => {
      try {
        const orderDetails = await storage.getOrderWithDetails(
          parseInt(req.params.id),
        );
        if (!orderDetails) {
          return res.status(404).json({ message: "Order not found" });
        }

        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);

        // Customers can only see their own orders
        if (user?.role === "customer" && orderDetails.order.userId !== userId) {
          return res.status(403).json({ message: "Forbidden" });
        }

        res.json({
          ...orderDetails.order,
          items: orderDetails.items,
          customer: orderDetails.customer,
          printedByUser: orderDetails.printedByUser,
        });
      } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).json({ message: "Failed to fetch order" });
      }
    },
  );

  app.post(
    "/api/orders",
    isAuthenticated,
    isApproved,
    async (req: any, res) => {
      try {
        const loggedUserId = req.user.claims.sub;
        const loggedUser = await storage.getUser(loggedUserId);
        const {
          items,
          notes,
          subtotal,
          shippingCost,
          shippingAddress,
          shippingMethod,
          paymentMethod,
          paymentTypeId,
          paymentNotes,
          userId: targetUserId,
        } = req.body;

        // Admin/Sales can create orders for other customers
        const userId =
          (loggedUser?.role === "admin" || loggedUser?.role === "sales") &&
          targetUserId
            ? targetUserId
            : loggedUserId;

        if (!items || !Array.isArray(items) || items.length === 0) {
          return res
            .status(400)
            .json({ message: "Order must have at least one item" });
        }

        // Calculate total from items
        let calculatedSubtotal = 0;
        for (const item of items) {
          const product = await storage.getProduct(item.productId);
          if (!product) {
            return res
              .status(400)
              .json({ message: `Product ${item.productId} not found` });
          }
          calculatedSubtotal += parseFloat(product.price) * item.quantity;
        }

        // Use calculated subtotal or provided subtotal
        const finalSubtotal = subtotal || calculatedSubtotal;
        const finalShippingCost = shippingCost || 0;
        const total = finalSubtotal + finalShippingCost;

        // Format shipping address as string if it's an object
        let shippingAddressStr = null;
        if (shippingAddress) {
          if (
            typeof shippingAddress === "object" &&
            shippingAddress.fullAddress
          ) {
            shippingAddressStr = shippingAddress.fullAddress;
          } else if (typeof shippingAddress === "string") {
            shippingAddressStr = shippingAddress;
          }
        }

        // Create order with ORCAMENTO status
        const order = await storage.createOrder({
          userId,
          orderNumber: await generateOrderNumber(),
          status: "ORCAMENTO",
          subtotal: finalSubtotal.toFixed(2),
          shippingCost: finalShippingCost.toFixed(2),
          total: total.toFixed(2),
          shippingAddress: shippingAddressStr,
          shippingMethod: shippingMethod || null,
          paymentMethod: paymentMethod || null,
          paymentTypeId: paymentTypeId || null,
          paymentNotes: paymentNotes || null,
          notes: notes || null,
          isGuestOrder: false,
        });

        // Create order items and collect for Bling
        const blingItems: blingService.BlingOrderItem[] = [];
        for (const item of items) {
          const product = await storage.getProduct(item.productId);
          await storage.createOrderItem({
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: product!.price,
          });
          blingItems.push({
            codigo: product!.sku,
            descricao: product!.name,
            quantidade: item.quantity,
            valorUnidade: parseFloat(product!.price),
          });
        }

        // Send order to Bling (async, don't block response)
        const user = await storage.getUser(userId);
        blingService
          .createBlingOrder({
            orderNumber: order.orderNumber,
            customerCpfCnpj: user?.cnpj || user?.cpf || undefined,
            customerName:
              user?.tradingName ||
              user?.company ||
              `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
              undefined,
            items: blingItems,
            frete: finalShippingCost,
            observacoes: notes || undefined,
          })
          .then((result) => {
            if (result.success) {
              console.log(
                `Order ${order.orderNumber} synced to Bling: ID ${result.blingId}`,
              );
            } else {
              console.log(
                `Order ${order.orderNumber} Bling sync failed: ${result.error}`,
              );
            }
          })
          .catch((err) => console.error("Bling sync error:", err));

        const orderItems = await storage.getOrderItems(order.id);
        res.status(201).json({ ...order, items: orderItems });
      } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: "Failed to create order" });
      }
    },
  );

  // Guest checkout - no authentication required
  app.post("/api/orders/guest", async (req: any, res) => {
    try {
      const {
        items,
        notes,
        subtotal,
        shippingCost,
        shippingAddress,
        shippingMethod,
        paymentMethod,
        paymentTypeId,
        paymentNotes,
        guestCpf,
        guestName,
        guestEmail,
        guestPhone,
      } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "Order must have at least one item" });
      }

      // Validate guest CPF (required)
      if (!guestCpf || guestCpf.replace(/\D/g, "").length !== 11) {
        return res.status(400).json({ message: "CPF valido e obrigatorio" });
      }

      // Calculate total from items
      let calculatedSubtotal = 0;
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res
            .status(400)
            .json({ message: `Product ${item.productId} not found` });
        }
        calculatedSubtotal += parseFloat(product.price) * item.quantity;
      }

      // Use calculated subtotal or provided subtotal
      const finalSubtotal = subtotal || calculatedSubtotal;
      const finalShippingCost = shippingCost || 0;
      const total = finalSubtotal + finalShippingCost;

      // Format shipping address as string if it's an object
      let shippingAddressStr = null;
      if (shippingAddress) {
        if (
          typeof shippingAddress === "object" &&
          shippingAddress.fullAddress
        ) {
          shippingAddressStr = shippingAddress.fullAddress;
        } else if (typeof shippingAddress === "string") {
          shippingAddressStr = shippingAddress;
        }
      }

      // Create guest order with ORCAMENTO status
      const order = await storage.createOrder({
        userId: null, // No user for guest orders
        orderNumber: await generateOrderNumber(),
        status: "ORCAMENTO",
        subtotal: finalSubtotal.toFixed(2),
        shippingCost: finalShippingCost.toFixed(2),
        total: total.toFixed(2),
        shippingAddress: shippingAddressStr,
        shippingMethod: shippingMethod || null,
        paymentMethod: paymentMethod || null,
        paymentTypeId: paymentTypeId || null,
        paymentNotes: paymentNotes || null,
        notes: notes || null,
        isGuestOrder: true,
        guestCpf: guestCpf.replace(/\D/g, ""),
        guestName: guestName || null,
        guestEmail: guestEmail || null,
        guestPhone: guestPhone || null,
      });

      // Create order items and collect for Bling
      const blingItems: blingService.BlingOrderItem[] = [];
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: product!.price,
        });
        blingItems.push({
          codigo: product!.sku,
          descricao: product!.name,
          quantidade: item.quantity,
          valorUnidade: parseFloat(product!.price),
        });
      }

      // Send order to Bling (async, don't block response)
      blingService
        .createBlingOrder({
          orderNumber: order.orderNumber,
          customerCpfCnpj: guestCpf?.replace(/\D/g, ""),
          customerName: guestName || undefined,
          items: blingItems,
          frete: finalShippingCost,
          observacoes: notes || undefined,
        })
        .then((result) => {
          if (result.success) {
            console.log(
              `Guest Order ${order.orderNumber} synced to Bling: ID ${result.blingId}`,
            );
          } else {
            console.log(
              `Guest Order ${order.orderNumber} Bling sync failed: ${result.error}`,
            );
          }
        })
        .catch((err) => console.error("Bling sync error:", err));

      const orderItems = await storage.getOrderItems(order.id);
      res.status(201).json({ ...order, items: orderItems });
    } catch (error) {
      console.error("Error creating guest order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.patch(
    "/api/orders/:id",
    isAuthenticated,
    isAdminOrSales,
    async (req, res) => {
      try {
        const orderId = parseInt(req.params.id);
        const { status } = req.body;

        // Check if order exists and prevent changes from FATURADO
        const existingOrder = await storage.getOrder(orderId);
        if (!existingOrder) {
          return res.status(404).json({ message: "Order not found" });
        }

        // FATURADO orders cannot change to any other status
        if (existingOrder.status === "FATURADO" && status) {
          return res
            .status(400)
            .json({
              message: "Pedidos faturados não podem ter o status alterado",
            });
        }

        // Handle cancellation with stock return (only from PEDIDO_GERADO or ORCAMENTO)
        if (status === "CANCELADO") {
          const items = await storage.getOrderItems(orderId);

          // If order was in PEDIDO_GERADO (stock reserved), release reserved stock
          if (existingOrder.status === "PEDIDO_GERADO") {
            for (const item of items) {
              await db
                .update(products)
                .set({
                  reservedStock: sql`GREATEST(reserved_stock - ${item.quantity}, 0)`,
                })
                .where(eq(products.id, item.productId));
            }
          }

          // Update order to cancelled
          const order = await storage.updateOrder(orderId, {
            status: "CANCELADO",
            reservedAt: null,
            reservedBy: null,
          });
          return res.json(order);
        }

        const order = await storage.updateOrder(orderId, req.body);
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }
        res.json(order);
      } catch (error) {
        res.status(500).json({ message: "Failed to update order" });
      }
    },
  );

  app.patch(
    "/api/orders/:id/print",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const order = await storage.updateOrder(parseInt(req.params.id), {
          printed: true,
          printedAt: new Date(),
          printedBy: userId,
          stage: "IMPRESSO",
        });
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }
        res.json(order);
      } catch (error) {
        res.status(500).json({ message: "Failed to mark order as printed" });
      }
    },
  );

  // Update order stage (etapa operacional)
  app.patch(
    "/api/orders/:id/stage",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const orderId = parseInt(req.params.id);
        const { stage } = req.body;

        if (!stage) {
          return res.status(400).json({ message: "Stage is required" });
        }

        const result = await storage.updateOrderStage(orderId, stage);
        if (!result.success) {
          return res.status(400).json({ message: result.error });
        }

        const order = await storage.getOrder(orderId);
        res.json(order);
      } catch (error) {
        res.status(500).json({ message: "Failed to update order stage" });
      }
    },
  );

  app.post(
    "/api/orders/:id/reserve",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const orderId = parseInt(req.params.id);
        const result = await storage.reserveStockForOrder(orderId, userId);
        if (!result.success) {
          return res.status(400).json({ message: result.error });
        }
        const order = await storage.getOrder(orderId);
        res.json(order);
      } catch (error) {
        res.status(500).json({ message: "Erro ao reservar estoque" });
      }
    },
  );

  app.post(
    "/api/orders/:id/release",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const orderId = parseInt(req.params.id);
        const result = await storage.releaseStockForOrder(orderId);
        if (!result.success) {
          return res.status(400).json({ message: result.error });
        }
        const order = await storage.getOrder(orderId);
        res.json(order);
      } catch (error) {
        res.status(500).json({ message: "Erro ao liberar estoque" });
      }
    },
  );

  app.post(
    "/api/orders/:id/unreserve",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const orderId = parseInt(req.params.id);
        const order = await storage.getOrder(orderId);

        if (!order) {
          return res.status(404).json({ message: "Pedido não encontrado" });
        }

        if (order.status !== "PEDIDO_GERADO") {
          return res
            .status(400)
            .json({
              message:
                "Apenas pedidos com status 'Pedido Gerado' podem retornar para Orçamento",
            });
        }

        const releaseResult = await storage.releaseStockForOrder(orderId);
        if (!releaseResult.success) {
          return res.status(400).json({ message: releaseResult.error });
        }

        const updatedOrder = await storage.updateOrder(orderId, {
          status: "ORCAMENTO",
          reservedAt: null,
          reservedBy: null,
        });

        res.json(updatedOrder);
      } catch (error) {
        console.error("Error unreserving order:", error);
        res
          .status(500)
          .json({ message: "Erro ao retornar pedido para orçamento" });
      }
    },
  );

  app.put(
    "/api/orders/:id/items",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const orderId = parseInt(req.params.id);
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
          return res
            .status(400)
            .json({ message: "O pedido deve ter pelo menos um item" });
        }

        const existingOrder = await storage.getOrder(orderId);
        if (!existingOrder) {
          return res.status(404).json({ message: "Pedido não encontrado" });
        }

        if (existingOrder.status === "PEDIDO_FATURADO") {
          return res
            .status(400)
            .json({ message: "Pedidos faturados não podem ser modificados" });
        }

        if (existingOrder.status === "PEDIDO_GERADO") {
          return res
            .status(400)
            .json({
              message:
                "Pedidos com estoque reservado não podem ser editados. Retorne para Orçamento Enviado primeiro.",
            });
        }

        if (
          existingOrder.status !== "ORCAMENTO_CONCLUIDO" &&
          existingOrder.status !== "ORCAMENTO_ABERTO"
        ) {
          return res
            .status(400)
            .json({ message: "Apenas orçamentos podem ser editados" });
        }

        const validatedItems: {
          productId: number;
          quantity: number;
          price: string;
        }[] = [];
        let newTotal = 0;

        for (const item of items) {
          if (!item.productId || typeof item.productId !== "number") {
            return res.status(400).json({ message: "ID do produto inválido" });
          }
          if (
            !item.quantity ||
            typeof item.quantity !== "number" ||
            item.quantity < 1 ||
            !Number.isInteger(item.quantity)
          ) {
            return res
              .status(400)
              .json({
                message: "Quantidade deve ser um número inteiro positivo",
              });
          }

          const product = await storage.getProduct(item.productId);
          if (!product) {
            return res
              .status(400)
              .json({ message: `Produto ${item.productId} não encontrado` });
          }

          const price = product.price;
          validatedItems.push({
            productId: item.productId,
            quantity: item.quantity,
            price,
          });
          newTotal += parseFloat(price) * item.quantity;
        }

        await db.delete(orderItems).where(eq(orderItems.orderId, orderId));

        for (const item of validatedItems) {
          await db.insert(orderItems).values({
            orderId,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          });
        }

        await storage.updateOrder(orderId, { total: newTotal.toFixed(2) });

        const updatedOrder = await storage.getOrder(orderId);
        const updatedItems = await storage.getOrderItems(orderId);
        res.json({ ...updatedOrder, items: updatedItems });
      } catch (error) {
        console.error("Error updating order items:", error);
        res.status(500).json({ message: "Falha ao atualizar itens do pedido" });
      }
    },
  );

  app.post(
    "/api/orders/:id/invoice",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const orderId = parseInt(req.params.id);
        const result = await storage.deductStockForOrder(orderId, userId);
        if (!result.success) {
          return res.status(400).json({ message: result.error });
        }
        const order = await storage.getOrder(orderId);
        res.json(order);
      } catch (error) {
        res.status(500).json({ message: "Erro ao faturar pedido" });
      }
    },
  );

  // Admin-only: Delete order with stock return if applicable
  app.delete(
    "/api/orders/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const orderId = parseInt(req.params.id);
        const existingOrder = await storage.getOrder(orderId);

        if (!existingOrder) {
          return res.status(404).json({ message: "Pedido não encontrado" });
        }

        // FATURADO orders cannot be deleted
        if (existingOrder.status === "FATURADO") {
          return res
            .status(400)
            .json({ message: "Pedidos faturados não podem ser excluídos" });
        }

        const items = await storage.getOrderItems(orderId);

        // If order has reserved stock (PEDIDO_GERADO), release it back
        if (existingOrder.status === "PEDIDO_GERADO") {
          for (const item of items) {
            await db
              .update(products)
              .set({
                reservedStock: sql`GREATEST(reserved_stock - ${item.quantity}, 0)`,
              })
              .where(eq(products.id, item.productId));
          }
        }

        // Delete order items first
        await db.delete(orderItems).where(eq(orderItems.orderId, orderId));

        // Delete the order
        await db.delete(orders).where(eq(orders.id, orderId));

        res.json({ success: true, message: "Pedido excluído com sucesso" });
      } catch (error) {
        console.error("Error deleting order:", error);
        res.status(500).json({ message: "Erro ao excluir pedido" });
      }
    },
  );

  app.get(
    "/api/me/purchase-stats",
    isAuthenticated,
    isApproved,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const stats = await storage.getCustomerPurchaseStats(userId);
        res.json(stats);
      } catch (error) {
        console.error("Error fetching purchase stats:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch purchase statistics" });
      }
    },
  );

  app.get(
    "/api/admin/sales-stats",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const period = req.query.period as
          | "day"
          | "week"
          | "month"
          | "year"
          | "all"
          | undefined;
        const stats = await storage.getAdminSalesStats(period);
        res.json(stats);
      } catch (error) {
        console.error("Error fetching admin sales stats:", error);
        res.status(500).json({ message: "Failed to fetch sales statistics" });
      }
    },
  );

  app.get(
    "/api/admin/customer-analytics",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const analytics = await storage.getCustomerAnalytics();
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching customer analytics:", error);
        res.status(500).json({ message: "Failed to fetch customer analytics" });
      }
    },
  );

  app.get(
    "/api/admin/employee-analytics",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const analytics = await storage.getEmployeeAnalytics();
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching employee analytics:", error);
        res.status(500).json({ message: "Failed to fetch employee analytics" });
      }
    },
  );

  app.get(
    "/api/admin/customers-by-location",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const allUsers = await storage.getUsers();
        const customers = allUsers.filter((u) => u.role === "customer");

        const byState: Record<
          string,
          {
            count: number;
            customers: { id: string; name: string; city: string | null }[];
          }
        > = {};
        const cityMap: Map<
          string,
          { city: string; state: string | null; count: number }
        > = new Map();

        for (const customer of customers) {
          const state = customer.state || "Não informado";
          const city = customer.city || "Não informado";
          const name =
            customer.tradingName ||
            customer.company ||
            `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
            customer.email ||
            "Cliente";

          if (!byState[state]) {
            byState[state] = { count: 0, customers: [] };
          }
          byState[state].count++;
          byState[state].customers.push({
            id: customer.id,
            name,
            city: customer.city,
          });

          const cityKey = JSON.stringify({ city, state });
          const existing = cityMap.get(cityKey);
          if (existing) {
            existing.count++;
          } else {
            cityMap.set(cityKey, { city, state: customer.state, count: 1 });
          }
        }

        const statesSorted = Object.entries(byState)
          .map(([state, data]) => ({ state, ...data }))
          .sort((a, b) => b.count - a.count);

        const citiesSorted = Array.from(cityMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 20);

        res.json({
          totalCustomers: customers.length,
          customersWithLocation: customers.filter((c) => c.state || c.city)
            .length,
          byState: statesSorted,
          byCity: citiesSorted,
        });
      } catch (error) {
        console.error("Error fetching customers by location:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch customers by location" });
      }
    },
  );

  app.get(
    "/api/admin/product-analytics",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const analytics = await storage.getProductAnalytics();
        console.log(
          "Product analytics overview:",
          JSON.stringify(analytics.overview),
        );
        console.log(
          "Product analytics ranking30d:",
          JSON.stringify(analytics.rankingByRevenue.days30),
        );
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching product analytics:", error);
        res.status(500).json({ message: "Failed to fetch product analytics" });
      }
    },
  );

  app.get(
    "/api/admin/purchases-analytics",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const analytics = await storage.getPurchasesAnalytics();
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching purchases analytics:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch purchases analytics" });
      }
    },
  );

  // Brand Analytics - for admin/sales and supplier users
  app.get(
    "/api/admin/brand-analytics",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Admin and sales can see all brands (with optional filter)
        if (user.role === "admin" || user.role === "sales") {
          const brandsFilter = req.query.brands
            ? (req.query.brands as string).split(",")
            : undefined;
          const analytics = await storage.getBrandAnalytics(brandsFilter);
          return res.json(analytics);
        }

        // Supplier can ONLY see their allowed brands - ignore any query params
        if (user.role === "supplier") {
          const allowedBrands = user.allowedBrands || [];
          if (allowedBrands.length === 0) {
            return res.json({
              brands: [],
              productsByBrand: {},
              overview: {
                totalBrands: 0,
                totalProducts: 0,
                totalLowStock: 0,
                totalOutOfStock: 0,
                topSellingBrand: null,
                topSellingBrandRevenue: 0,
              },
            });
          }
          // Force supplier to only see their assigned brands - never trust client input
          const analytics = await storage.getBrandAnalytics(allowedBrands);
          return res.json(analytics);
        }

        return res.status(403).json({ message: "Access denied" });
      } catch (error) {
        console.error("Error fetching brand analytics:", error);
        res.status(500).json({ message: "Failed to fetch brand analytics" });
      }
    },
  );

  // Get all unique brands (for filter selection) - filtered by role
  app.get("/api/brands", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const productsResult = await storage.getProducts();
      const allProducts = productsResult.products;
      const brandsSet = new Set<string>();
      allProducts.forEach((p: { brand: string | null }) => {
        if (p.brand) brandsSet.add(p.brand);
      });

      let brands = Array.from(brandsSet).sort();

      // Supplier can only see their allowed brands
      if (user.role === "supplier") {
        const allowedBrands = user.allowedBrands || [];
        brands = brands.filter((b) => allowedBrands.includes(b));
      }

      res.json(brands);
    } catch (error) {
      console.error("Error fetching brands:", error);
      res.status(500).json({ message: "Failed to fetch brands" });
    }
  });

  // Get all brands (admin only - for user management)
  app.get(
    "/api/admin/all-brands",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const productsResult = await storage.getProducts();
        const allProducts = productsResult.products;
        const brandsSet = new Set<string>();
        allProducts.forEach((p: { brand: string | null }) => {
          if (p.brand) brandsSet.add(p.brand);
        });

        const brands = Array.from(brandsSet).sort();
        res.json(brands);
      } catch (error) {
        console.error("Error fetching all brands:", error);
        res.status(500).json({ message: "Failed to fetch brands" });
      }
    },
  );

  // ========== USERS (Admin Only) ==========
  app.get("/api/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Create user with email/password (admin only)
  app.post("/api/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { firstName, email, password, role } = req.body;

      if (!firstName || !email || !password) {
        return res
          .status(400)
          .json({ message: "Nome, email e senha são obrigatórios" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res
          .status(400)
          .json({
            message: "E-mail inválido. Use o formato: usuario@empresa.com",
          });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "E-mail já cadastrado" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await storage.upsertUser({
        id: crypto.randomUUID(),
        email,
        password: hashedPassword,
        firstName,
        lastName: null,
        profileImageUrl: null,
        role: role || "customer",
        company: null,
        approved: true,
        phone: null,
        personType: null,
        cnpj: null,
        cpf: null,
        cep: null,
        address: null,
        addressNumber: null,
        complement: null,
        neighborhood: null,
        city: null,
        state: null,
      });

      res
        .status(201)
        .json({ message: "Usuário criado com sucesso", userId: newUser.id });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // ========== AGENDA EVENTS ==========
  app.get(
    "/api/agenda",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const startDate = req.query.startDate
          ? new Date(req.query.startDate)
          : undefined;
        const endDate = req.query.endDate
          ? new Date(req.query.endDate)
          : undefined;
        const events = await storage.getAgendaEvents({ startDate, endDate });
        res.json(events);
      } catch (error) {
        console.error("Error fetching agenda events:", error);
        res.status(500).json({ message: "Failed to fetch agenda events" });
      }
    },
  );

  app.get(
    "/api/agenda/:id",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const event = await storage.getAgendaEvent(parseInt(req.params.id));
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }
        res.json(event);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch event" });
      }
    },
  );

  const agendaEventSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().nullable(),
    date: z.string().min(1, "Date is required"),
    time: z.string().optional().nullable(),
    type: z.enum(["note", "meeting", "task", "reminder"]).default("note"),
    completed: z.boolean().optional(),
  });

  app.post(
    "/api/agenda",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const validation = agendaEventSchema.safeParse(req.body);
        if (!validation.success) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: validation.error.errors });
        }
        const eventData = {
          title: validation.data.title,
          description: validation.data.description || null,
          date: new Date(validation.data.date),
          time: validation.data.time || null,
          type: validation.data.type,
          completed: validation.data.completed || false,
          createdBy: req.user?.id,
        };
        const event = await storage.createAgendaEvent(eventData);
        res.status(201).json(event);
      } catch (error) {
        console.error("Error creating agenda event:", error);
        res.status(500).json({ message: "Failed to create event" });
      }
    },
  );

  app.patch(
    "/api/agenda/:id",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const partialSchema = agendaEventSchema.partial();
        const validation = partialSchema.safeParse(req.body);
        if (!validation.success) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: validation.error.errors });
        }
        const updateData: any = { ...validation.data };
        if (updateData.date) {
          updateData.date = new Date(updateData.date);
        }
        const event = await storage.updateAgendaEvent(
          parseInt(req.params.id),
          updateData,
        );
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }
        res.json(event);
      } catch (error) {
        console.error("Error updating agenda event:", error);
        res.status(500).json({ message: "Failed to update event" });
      }
    },
  );

  app.delete(
    "/api/agenda/:id",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const success = await storage.deleteAgendaEvent(
          parseInt(req.params.id),
        );
        if (!success) {
          return res.status(404).json({ message: "Event not found" });
        }
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete event" });
      }
    },
  );

  // ========== CUSTOMER CREDITS (FIADO) ==========

  // Get credits dashboard (admin/sales only)
  app.get(
    "/api/credits/dashboard",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const dashboard = await storage.getCreditsDashboard();
        res.json(dashboard);
      } catch (error) {
        console.error("Error fetching credits dashboard:", error);
        res.status(500).json({ message: "Failed to fetch credits dashboard" });
      }
    },
  );

  // Get all credits (admin/sales only)
  app.get(
    "/api/credits",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const credits = await storage.getAllCredits();
        res.json(credits);
      } catch (error) {
        console.error("Error fetching credits:", error);
        res.status(500).json({ message: "Failed to fetch credits" });
      }
    },
  );

  // Get credits for a specific customer
  app.get(
    "/api/credits/customer/:userId",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const credits = await storage.getCustomerCredits(req.params.userId);
        const balance = await storage.getCustomerCreditBalance(
          req.params.userId,
        );
        res.json({ credits, balance });
      } catch (error) {
        console.error("Error fetching customer credits:", error);
        res.status(500).json({ message: "Failed to fetch customer credits" });
      }
    },
  );

  // Get single credit with payments
  app.get(
    "/api/credits/:id",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const credit = await storage.getCustomerCredit(parseInt(req.params.id));
        if (!credit) {
          return res.status(404).json({ message: "Credit not found" });
        }
        const payments = await storage.getCreditPayments(credit.id);
        res.json({ credit, payments });
      } catch (error) {
        console.error("Error fetching credit:", error);
        res.status(500).json({ message: "Failed to fetch credit" });
      }
    },
  );

  // Create a new credit entry (debt or credit)
  app.post(
    "/api/credits",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const { userId, type, amount, description, dueDate, orderId } =
          req.body;

        if (!userId || !type || !amount) {
          return res
            .status(400)
            .json({ message: "userId, type and amount are required" });
        }

        if (!["DEBITO", "CREDITO"].includes(type)) {
          return res
            .status(400)
            .json({ message: "type must be DEBITO or CREDITO" });
        }

        const credit = await storage.createCustomerCredit({
          userId,
          type,
          amount: parseFloat(amount).toFixed(2),
          paidAmount: "0",
          description: description || null,
          status: "PENDENTE",
          dueDate: dueDate ? new Date(dueDate) : null,
          orderId: orderId || null,
          createdBy: req.user.id,
        });

        res.status(201).json(credit);
      } catch (error) {
        console.error("Error creating credit:", error);
        res.status(500).json({ message: "Failed to create credit" });
      }
    },
  );

  // Update credit entry
  app.patch(
    "/api/credits/:id",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const { description, dueDate, status } = req.body;

        const updateData: any = {};
        if (description !== undefined) updateData.description = description;
        if (dueDate !== undefined)
          updateData.dueDate = dueDate ? new Date(dueDate) : null;
        if (status !== undefined) updateData.status = status;

        const credit = await storage.updateCustomerCredit(
          parseInt(req.params.id),
          updateData,
        );
        if (!credit) {
          return res.status(404).json({ message: "Credit not found" });
        }

        res.json(credit);
      } catch (error) {
        console.error("Error updating credit:", error);
        res.status(500).json({ message: "Failed to update credit" });
      }
    },
  );

  // Delete credit entry
  app.delete(
    "/api/credits/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const success = await storage.deleteCustomerCredit(
          parseInt(req.params.id),
        );
        if (!success) {
          return res.status(404).json({ message: "Credit not found" });
        }
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting credit:", error);
        res.status(500).json({ message: "Failed to delete credit" });
      }
    },
  );

  // Register a payment for a credit
  app.post(
    "/api/credits/:id/payments",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const creditId = parseInt(req.params.id);
        const { amount, paymentMethod, notes } = req.body;

        if (!amount || parseFloat(amount) <= 0) {
          return res.status(400).json({ message: "Valid amount is required" });
        }

        const credit = await storage.getCustomerCredit(creditId);
        if (!credit) {
          return res.status(404).json({ message: "Credit not found" });
        }

        const payment = await storage.createCreditPayment({
          creditId,
          amount: parseFloat(amount).toFixed(2),
          paymentMethod: paymentMethod || null,
          notes: notes || null,
          receivedBy: req.user.id,
        });

        // Fetch updated credit
        const updatedCredit = await storage.getCustomerCredit(creditId);

        res.status(201).json({ payment, credit: updatedCredit });
      } catch (error) {
        console.error("Error registering payment:", error);
        res.status(500).json({ message: "Failed to register payment" });
      }
    },
  );

  // Get payments for a credit
  app.get(
    "/api/credits/:id/payments",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const payments = await storage.getCreditPayments(
          parseInt(req.params.id),
        );
        res.json(payments);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).json({ message: "Failed to fetch payments" });
      }
    },
  );

  // ========== ACCOUNTS PAYABLE (CONTAS A PAGAR) ==========
  // All endpoints require admin role for full access control

  // Get all payables
  app.get("/api/payables", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const payables = await storage.getAccountsPayable();
      res.json(payables);
    } catch (error) {
      console.error("Error fetching payables:", error);
      res.status(500).json({ message: "Failed to fetch payables" });
    }
  });

  // Get payables dashboard
  app.get(
    "/api/payables/dashboard",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const dashboard = await storage.getPayablesDashboard();
        res.json(dashboard);
      } catch (error) {
        console.error("Error fetching payables dashboard:", error);
        res.status(500).json({ message: "Failed to fetch payables dashboard" });
      }
    },
  );

  // Get single payable
  app.get(
    "/api/payables/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const payable = await storage.getAccountPayable(
          parseInt(req.params.id),
        );
        if (!payable) {
          return res.status(404).json({ message: "Payable not found" });
        }
        res.json(payable);
      } catch (error) {
        console.error("Error fetching payable:", error);
        res.status(500).json({ message: "Failed to fetch payable" });
      }
    },
  );

  // Create new payable with validation
  const createPayableSchema = z.object({
    supplierName: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    description: z.string().min(1, "Descrição é obrigatória"),
    amount: z.union([z.string(), z.number()]).transform((v) => {
      const num = typeof v === "string" ? parseFloat(v) : v;
      if (isNaN(num) || num <= 0) throw new Error("Valor inválido");
      return num.toFixed(2);
    }),
    dueDate: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? new Date(v) : null)),
    documentNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });

  app.post("/api/payables", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validation = createPayableSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: validation.error.errors,
        });
      }

      const data = validation.data;
      const payable = await storage.createAccountPayable({
        supplierName: data.supplierName || null,
        category: data.category || null,
        description: data.description,
        amount: data.amount,
        paidAmount: "0",
        status: "PENDENTE",
        dueDate: data.dueDate,
        documentNumber: data.documentNumber || null,
        notes: data.notes || null,
        createdBy: req.user.id,
      });

      res.status(201).json(payable);
    } catch (error) {
      console.error("Error creating payable:", error);
      res.status(500).json({ message: "Failed to create payable" });
    }
  });

  // Update payable
  app.patch(
    "/api/payables/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const updates: any = {};
        if (req.body.description !== undefined)
          updates.description = req.body.description;
        if (req.body.supplierName !== undefined)
          updates.supplierName = req.body.supplierName;
        if (req.body.category !== undefined)
          updates.category = req.body.category;
        if (req.body.status !== undefined) updates.status = req.body.status;
        if (req.body.notes !== undefined) updates.notes = req.body.notes;
        if (req.body.dueDate !== undefined) {
          updates.dueDate = req.body.dueDate
            ? new Date(req.body.dueDate)
            : null;
        }

        const payable = await storage.updateAccountPayable(
          parseInt(req.params.id),
          updates,
        );
        if (!payable) {
          return res.status(404).json({ message: "Payable not found" });
        }
        res.json(payable);
      } catch (error) {
        console.error("Error updating payable:", error);
        res.status(500).json({ message: "Failed to update payable" });
      }
    },
  );

  // Delete payable
  app.delete(
    "/api/payables/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        await storage.deleteAccountPayable(parseInt(req.params.id));
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting payable:", error);
        res.status(500).json({ message: "Failed to delete payable" });
      }
    },
  );

  // Register payment for payable with validation
  const createPayablePaymentSchema = z.object({
    amount: z.union([z.string(), z.number()]).transform((v) => {
      const num = typeof v === "string" ? parseFloat(v) : v;
      if (isNaN(num) || num <= 0) throw new Error("Valor inválido");
      return num.toFixed(2);
    }),
    paymentMethod: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });

  app.post(
    "/api/payables/:id/payments",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const payableId = parseInt(req.params.id);

        const validation = createPayablePaymentSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            message: "Dados inválidos",
            errors: validation.error.errors,
          });
        }

        const data = validation.data;
        const payable = await storage.getAccountPayable(payableId);
        if (!payable) {
          return res.status(404).json({ message: "Payable not found" });
        }

        const payment = await storage.createPayablePayment({
          payableId,
          amount: data.amount,
          paymentMethod: data.paymentMethod || null,
          notes: data.notes || null,
          paidBy: req.user.id,
        });

        const updatedPayable = await storage.getAccountPayable(payableId);

        res.status(201).json({ payment, payable: updatedPayable });
      } catch (error) {
        console.error("Error registering payable payment:", error);
        res.status(500).json({ message: "Failed to register payment" });
      }
    },
  );

  // Get payments for payable
  app.get(
    "/api/payables/:id/payments",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const payments = await storage.getPayablePayments(
          parseInt(req.params.id),
        );
        res.json(payments);
      } catch (error) {
        console.error("Error fetching payable payments:", error);
        res.status(500).json({ message: "Failed to fetch payments" });
      }
    },
  );

  // ========== SITE SETTINGS ==========

  // Public endpoint for specific settings (for catalog)
  app.get("/api/public/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSiteSetting(req.params.key);
      res.json({ key: req.params.key, value: setting?.value || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSiteSetting(req.params.key);
      res.json({ key: req.params.key, value: setting?.value || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.post(
    "/api/settings/:key",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        console.log(
          "[SETTINGS] Saving key:",
          req.params.key,
          "value:",
          req.body.value,
        );
        const { value } = req.body;
        const setting = await storage.setSiteSetting(req.params.key, value);
        console.log("[SETTINGS] Saved:", setting);
        res.json(setting);
      } catch (error) {
        console.error("[SETTINGS] Error saving setting:", error);
        res.status(500).json({ message: "Failed to save setting" });
      }
    },
  );

  // ========== CATALOG BANNERS ==========
  app.get("/api/catalog/banners", async (req, res) => {
    try {
      const position = req.query.position as string | undefined;
      const banners = await storage.getCatalogBanners(position);
      res.json(banners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch banners" });
    }
  });

  app.get("/api/catalog/banners/:id", async (req, res) => {
    try {
      const banner = await storage.getCatalogBanner(parseInt(req.params.id));
      if (!banner) {
        return res.status(404).json({ message: "Banner not found" });
      }
      res.json(banner);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch banner" });
    }
  });

  app.post(
    "/api/catalog/banners",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const banner = await storage.createCatalogBanner(req.body);
        res.status(201).json(banner);
      } catch (error) {
        console.error("Error creating banner:", error);
        res.status(500).json({ message: "Failed to create banner" });
      }
    },
  );

  app.patch(
    "/api/catalog/banners/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const banner = await storage.updateCatalogBanner(
          parseInt(req.params.id),
          req.body,
        );
        if (!banner) {
          return res.status(404).json({ message: "Banner not found" });
        }
        res.json(banner);
      } catch (error) {
        console.error("Error updating banner:", error);
        res.status(500).json({ message: "Failed to update banner" });
      }
    },
  );

  app.delete(
    "/api/catalog/banners/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const success = await storage.deleteCatalogBanner(
          parseInt(req.params.id),
        );
        if (!success) {
          return res.status(404).json({ message: "Banner not found" });
        }
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete banner" });
      }
    },
  );

  // ========== CATALOG SLIDES ==========
  app.get("/api/catalog/slides", async (req, res) => {
    try {
      const slides = await storage.getCatalogSlides();
      res.json(slides);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch slides" });
    }
  });

  app.get("/api/catalog/slides/:id", async (req, res) => {
    try {
      const slide = await storage.getCatalogSlide(parseInt(req.params.id));
      if (!slide) {
        return res.status(404).json({ message: "Slide not found" });
      }
      res.json(slide);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch slide" });
    }
  });

  app.post(
    "/api/catalog/slides",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const slide = await storage.createCatalogSlide(req.body);
        res.status(201).json(slide);
      } catch (error) {
        console.error("Error creating slide:", error);
        res.status(500).json({ message: "Failed to create slide" });
      }
    },
  );

  app.patch(
    "/api/catalog/slides/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const slide = await storage.updateCatalogSlide(
          parseInt(req.params.id),
          req.body,
        );
        if (!slide) {
          return res.status(404).json({ message: "Slide not found" });
        }
        res.json(slide);
      } catch (error) {
        console.error("Error updating slide:", error);
        res.status(500).json({ message: "Failed to update slide" });
      }
    },
  );

  app.delete(
    "/api/catalog/slides/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const success = await storage.deleteCatalogSlide(
          parseInt(req.params.id),
        );
        if (!success) {
          return res.status(404).json({ message: "Slide not found" });
        }
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete slide" });
      }
    },
  );

  // ========== CATALOG CONFIG ==========
  app.get("/api/catalog/config/:key", async (req, res) => {
    try {
      const config = await storage.getCatalogConfig(req.params.key);
      res.json({ key: req.params.key, value: config?.value || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch config" });
    }
  });

  app.post(
    "/api/catalog/config/:key",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const { value } = req.body;
        const config = await storage.setCatalogConfig(req.params.key, value);
        res.json(config);
      } catch (error) {
        res.status(500).json({ message: "Failed to save config" });
      }
    },
  );

  // ========== CSV Export ==========
  app.get(
    "/api/orders/export/csv",
    isAuthenticated,
    isAdminOrSales,
    async (req: any, res) => {
      try {
        const orders = await storage.getOrders();

        // Build CSV content
        const headers = [
          "Order Number",
          "User ID",
          "Status",
          "Total",
          "Notes",
          "Created At",
        ];
        let csv = headers.join(",") + "\n";

        for (const order of orders) {
          const row = [
            order.orderNumber,
            order.userId,
            order.status,
            order.total,
            `"${(order.notes || "").replace(/"/g, '""')}"`,
            order.createdAt.toISOString(),
          ];
          csv += row.join(",") + "\n";
        }

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="orders.csv"',
        );
        res.send(csv);
      } catch (error) {
        console.error("Error exporting orders:", error);
        res.status(500).json({ message: "Failed to export orders" });
      }
    },
  );

  // ========== FILE SERVING (public endpoint to serve object storage files) ==========
  app.get("/api/files/*", async (req: any, res) => {
    try {
      const filePath = req.params[0] as string;
      console.log("[FILE SERVE] Requested:", filePath);
      if (!filePath) {
        return res.status(400).json({ message: "File path required" });
      }

      const objectStorage = await getObjectStorage();
      const result = await objectStorage.downloadAsBytes(filePath);

      if (!result || !result.ok || !result.value) {
        console.log(
          "[FILE SERVE] File not found or error:",
          filePath,
          "result:",
          result,
        );
        return res.status(404).json({ message: "File not found" });
      }

      const rawBytes = result.value;
      let buffer: Buffer;

      if (Buffer.isBuffer(rawBytes)) {
        buffer = rawBytes;
      } else if (rawBytes instanceof Uint8Array) {
        buffer = Buffer.from(rawBytes);
      } else if (ArrayBuffer.isView(rawBytes)) {
        buffer = Buffer.from(
          (rawBytes as any).buffer,
          (rawBytes as any).byteOffset,
          (rawBytes as any).byteLength,
        );
      } else if (rawBytes instanceof ArrayBuffer) {
        buffer = Buffer.from(rawBytes);
      } else if (Array.isArray(rawBytes)) {
        if (rawBytes.length === 1 && Buffer.isBuffer(rawBytes[0])) {
          buffer = rawBytes[0];
        } else if (rawBytes.length > 0 && typeof rawBytes[0] === "number") {
          buffer = Buffer.from(new Uint8Array(rawBytes as unknown as number[]));
        } else {
          buffer = Buffer.concat(rawBytes.filter(Buffer.isBuffer));
        }
      } else if (typeof rawBytes === "object" && rawBytes !== null) {
        if (
          "buffer" in rawBytes &&
          "byteOffset" in rawBytes &&
          "byteLength" in rawBytes
        ) {
          const typed = rawBytes as {
            buffer: ArrayBuffer;
            byteOffset: number;
            byteLength: number;
          };
          buffer = Buffer.from(
            typed.buffer,
            typed.byteOffset,
            typed.byteLength,
          );
        } else if ("data" in rawBytes) {
          const data = (rawBytes as any).data;
          if (Buffer.isBuffer(data)) {
            buffer = data;
          } else if (Array.isArray(data)) {
            buffer = Buffer.from(new Uint8Array(data));
          } else {
            buffer = Buffer.from(new Uint8Array(Object.values(data)));
          }
        } else {
          const keys = Object.keys(rawBytes);
          if (keys.length > 0 && keys.every((k) => !isNaN(Number(k)))) {
            const values = Object.values(
              rawBytes as unknown as Record<string, number>,
            );
            buffer = Buffer.from(new Uint8Array(values));
          } else {
            console.log(
              "[FILE SERVE] Unknown object structure:",
              Object.keys(rawBytes).slice(0, 10),
            );
            return res
              .status(500)
              .json({ message: "Invalid file data format" });
          }
        }
      } else {
        console.log("[FILE SERVE] Unknown bytes type:", typeof rawBytes);
        return res.status(500).json({ message: "Invalid file data format" });
      }

      console.log(
        "[FILE SERVE] Success - path:",
        filePath,
        "bytes:",
        buffer.length,
      );

      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      const mimeTypes: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
        bmp: "image/bmp",
        tiff: "image/tiff",
        tif: "image/tiff",
        heic: "image/heic",
        heif: "image/heif",
        avif: "image/avif",
        svg: "image/svg+xml",
      };

      const contentType = mimeTypes[ext] || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.end(buffer);
    } catch (error: any) {
      console.error("[FILE SERVE] Error:", error);
      if (
        error.message?.includes("not found") ||
        error.message?.includes("NotFound")
      ) {
        return res.status(404).json({ message: "File not found" });
      }
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // ========== FILE UPLOAD ==========
  app.post(
    "/api/upload",
    isAuthenticated,
    isAdminOrSales,
    upload.single("file"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const file = req.file;
        const allowedTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/bmp",
          "image/tiff",
          "image/heic",
          "image/heif",
          "image/avif",
          "image/svg+xml",
          "application/octet-stream",
        ];

        const fileExt = (
          file.originalname.split(".").pop() || ""
        ).toLowerCase();
        const allowedExtensions = [
          "jpg",
          "jpeg",
          "png",
          "webp",
          "gif",
          "bmp",
          "tiff",
          "tif",
          "heic",
          "heif",
          "avif",
          "svg",
        ];

        const isValidMime =
          allowedTypes.includes(file.mimetype) ||
          file.mimetype.startsWith("image/");
        const isValidExt = allowedExtensions.includes(fileExt);

        if (!isValidMime && !isValidExt) {
          return res.status(400).json({
            message: `Tipo de arquivo invalido (${file.mimetype}). Formatos aceitos: JPG, PNG, WebP, GIF, BMP, TIFF, HEIC, AVIF.`,
          });
        }

        const ext = file.originalname.split(".").pop() || "jpg";
        const filename = `public/products/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

        const objectStorage = await getObjectStorage();

        // Convert Node.js Buffer to Uint8Array for object storage compatibility
        console.log("[UPLOAD] File size:", file.buffer.length, "bytes");
        const uint8Array = new Uint8Array(
          file.buffer.buffer,
          file.buffer.byteOffset,
          file.buffer.length,
        );
        await objectStorage.uploadFromBytes(filename, uint8Array as any);
        console.log("[UPLOAD] File uploaded successfully:", filename);

        const publicUrl = `/api/files/${filename}`;

        res.json({
          url: publicUrl,
          filename: filename,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        res.status(500).json({ message: "Failed to upload file" });
      }
    },
  );

  // ========== CATALOG IMAGE UPLOAD ==========
  app.post(
    "/api/upload/catalog",
    isAuthenticated,
    isAdmin,
    upload.single("file"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const file = req.file;
        const allowedTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
          "image/gif",
        ];
        const fileExt = (
          file.originalname.split(".").pop() || ""
        ).toLowerCase();
        const allowedExtensions = ["jpg", "jpeg", "png", "webp", "gif"];

        const isValidMime =
          allowedTypes.includes(file.mimetype) ||
          file.mimetype.startsWith("image/");
        const isValidExt = allowedExtensions.includes(fileExt);

        if (!isValidMime && !isValidExt) {
          return res
            .status(400)
            .json({
              message:
                "Tipo de arquivo invalido. Formatos aceitos: JPG, PNG, WebP, GIF.",
            });
        }

        const ext = file.originalname.split(".").pop() || "jpg";
        const filename = `public/catalog/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

        const objectStorage = await getObjectStorage();
        const uint8Array = new Uint8Array(
          file.buffer.buffer,
          file.buffer.byteOffset,
          file.buffer.length,
        );
        await objectStorage.uploadFromBytes(filename, uint8Array as any);

        const publicUrl = `/api/files/${filename}`;
        res.json({ url: publicUrl, filename: filename });
      } catch (error) {
        console.error("Error uploading catalog image:", error);
        res.status(500).json({ message: "Failed to upload file" });
      }
    },
  );

  // ========== COUPONS ==========
  app.get("/api/coupons", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const couponsList = await storage.getCoupons();
      res.json(couponsList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  app.get("/api/coupons/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const coupon = await storage.getCoupon(parseInt(req.params.id));
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch coupon" });
    }
  });

  app.post("/api/coupons", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const data = insertCouponSchema.parse(req.body);
      const coupon = await storage.createCoupon(data);
      res.status(201).json(coupon);
    } catch (error) {
      res.status(400).json({ message: "Invalid coupon data" });
    }
  });

  app.patch("/api/coupons/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const coupon = await storage.updateCoupon(
        parseInt(req.params.id),
        req.body,
      );
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      res.status(400).json({ message: "Failed to update coupon" });
    }
  });

  app.delete("/api/coupons/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteCoupon(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });

  app.post(
    "/api/coupons/validate",
    isAuthenticated,
    isApproved,
    async (req, res) => {
      try {
        const { code, orderTotal } = req.body;
        const coupon = await storage.getCouponByCode(code);

        if (!coupon) {
          return res
            .status(404)
            .json({ valid: false, message: "Cupom não encontrado" });
        }

        if (!coupon.active) {
          return res
            .status(400)
            .json({ valid: false, message: "Cupom inativo" });
        }

        const now = new Date();
        if (coupon.validFrom && new Date(coupon.validFrom) > now) {
          return res
            .status(400)
            .json({ valid: false, message: "Cupom ainda não está válido" });
        }
        if (coupon.validUntil && new Date(coupon.validUntil) < now) {
          return res
            .status(400)
            .json({ valid: false, message: "Cupom expirado" });
        }

        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
          return res
            .status(400)
            .json({ valid: false, message: "Cupom esgotado" });
        }

        if (
          coupon.minOrderValue &&
          parseFloat(coupon.minOrderValue) > orderTotal
        ) {
          return res.status(400).json({
            valid: false,
            message: `Pedido mínimo de R$ ${parseFloat(coupon.minOrderValue).toFixed(2)}`,
          });
        }

        let discount = 0;
        if (coupon.discountType === "percent") {
          discount = orderTotal * (parseFloat(coupon.discountValue) / 100);
        } else {
          discount = Math.min(parseFloat(coupon.discountValue), orderTotal);
        }

        res.json({
          valid: true,
          coupon: {
            id: coupon.id,
            code: coupon.code,
            name: coupon.name,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
          },
          discount: discount.toFixed(2),
        });
      } catch (error) {
        res
          .status(500)
          .json({ valid: false, message: "Erro ao validar cupom" });
      }
    },
  );

  // ========== BLING INTEGRATION ==========
  app.get("/api/bling/status", isAuthenticated, isAdmin, async (req, res) => {
    res.json(blingService.getStatus());
  });

  app.post("/api/bling/webhook", async (req: any, res) => {
    // TEMPORARILY DISABLED - Remove this block to re-enable webhooks
    console.log("[WEBHOOK] Bling webhooks temporarily disabled");
    return res.status(200).json({ success: true, message: "Webhooks temporarily disabled" });
    // END DISABLED BLOCK

    const signature = req.headers["x-bling-signature-256"] as string;
    // Use rawBody captured by express.json() middleware in index.ts
    const rawBody = req.rawBody
      ? req.rawBody.toString("utf8")
      : JSON.stringify(req.body);

    console.log("Bling webhook received:");
    console.log(
      "- Signature header:",
      signature ? `${signature.substring(0, 20)}...` : "MISSING",
    );
    console.log("- Payload preview:", rawBody.substring(0, 300));

    // Verify signature
    if (signature) {
      const isValid = blingService.verifyWebhookSignature(rawBody, signature);
      console.log("- Signature valid:", isValid);
    }

    try {
      const payload = req.rawBody ? JSON.parse(rawBody) : req.body;
      console.log("- Event:", payload.event, "- EventId:", payload.eventId);
      const result = await blingService.handleWebhook(payload);
      console.log("- Result:", result);
      res.status(200).json(result);
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(200).json({ success: false, message: "Processing error" });
    }
  });

  app.get("/api/bling/auth", isAuthenticated, isAdmin, (req, res) => {
    const redirectUri =
      process.env.BLING_REDIRECT_URI ||
      `https://${req.get("host")}/api/bling/callback`;
    console.log("Bling OAuth redirect_uri:", redirectUri);
    const authUrl = blingService.getAuthorizationUrl(redirectUri);
    res.redirect(authUrl);
  });

  app.get("/api/bling/callback", async (req, res) => {
    const { code } = req.query;
    const redirectUri =
      process.env.BLING_REDIRECT_URI ||
      `https://${req.get("host")}/api/bling/callback`;
    try {
      await blingService.exchangeCodeForTokens(code as string, redirectUri);
      res.redirect("/bling?success=true");
    } catch (error) {
      console.error("Bling callback error:", error);
      res.redirect("/bling?error=auth_failed");
    }
  });

  app.post(
    "/api/bling/sync/categories",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const result = await blingService.syncCategories();
        res.json(result);
      } catch (error: any) {
        console.error("Bling sync categories error:", error);
        res.status(500).json({ error: error.message });
      }
    },
  );

  app.post(
    "/api/bling/sync/products",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const result = await blingService.syncProducts();
        res.json(result);
      } catch (error: any) {
        console.error("Bling sync products error:", error);
        res.status(500).json({ error: error.message });
      }
    },
  );

  app.get("/api/bling/sync/progress", isAuthenticated, isAdmin, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendProgress = (progress: blingService.SyncProgress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    };

    const unsubscribe = blingService.subscribeSyncProgress(sendProgress);

    req.on("close", () => {
      unsubscribe();
    });
  });

  app.post(
    "/api/bling/disconnect",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        // Clear the access token to disconnect
        delete process.env.BLING_ACCESS_TOKEN;
        delete process.env.BLING_REFRESH_TOKEN;
        res.json({ success: true, message: "Desconectado do Bling" });
      } catch (error: any) {
        console.error("Bling disconnect error:", error);
        res.status(500).json({ error: error.message });
      }
    },
  );

  // ========== BLING MANUAL IMPORT ==========

  // Preview Bling categories (without importing)
  app.get(
    "/api/bling/categories/preview",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const categories = await blingService.fetchBlingCategories();
        res.json({ categories });
      } catch (error: any) {
        console.error("Bling fetch categories error:", error);
        res.status(500).json({ error: "Falha ao buscar categorias do Bling" });
      }
    },
  );

  // Import selected Bling categories
  app.post(
    "/api/bling/categories/import",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { categoryIds } = req.body;
        if (
          !categoryIds ||
          !Array.isArray(categoryIds) ||
          categoryIds.length === 0
        ) {
          return res.status(400).json({ error: "categoryIds é obrigatório" });
        }

        const allCategories = await blingService.fetchBlingCategories();
        const selectedCategories = allCategories.filter((c) =>
          categoryIds.includes(c.id),
        );

        let created = 0;
        let updated = 0;

        // Build map for parent resolution
        const blingCatMap = new Map<number, (typeof allCategories)[0]>();
        allCategories.forEach((c) => blingCatMap.set(c.id, c));
        const blingIdToLocalId: Record<number, number> = {};

        // Load existing categories
        const existingCategories = await storage.getCategories();
        existingCategories.forEach((c) => {
          if (c.blingId) {
            blingIdToLocalId[c.blingId] = c.id;
          }
        });

        // Topological sort to process parents first
        const topologicalSort = (
          cats: typeof selectedCategories,
        ): typeof selectedCategories => {
          const sorted: typeof selectedCategories = [];
          const visited = new Set<number>();

          function visit(cat: (typeof cats)[0]) {
            if (visited.has(cat.id)) return;
            visited.add(cat.id);

            const parentBlingId = cat.categoriaPai?.id;
            if (parentBlingId && blingCatMap.has(parentBlingId)) {
              const parent = blingCatMap.get(parentBlingId)!;
              if (categoryIds.includes(parent.id)) {
                visit(parent);
              }
            }

            sorted.push(cat);
          }

          cats.forEach((c) => visit(c));
          return sorted;
        };

        const sortedCategories = topologicalSort(selectedCategories);

        for (const cat of sortedCategories) {
          const slug =
            cat.descricao
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "") || `cat-${cat.id}`;

          const parentBlingId = cat.categoriaPai?.id;
          const parentLocalId = parentBlingId
            ? blingIdToLocalId[parentBlingId] || null
            : null;

          const existing = await storage.getCategoryByBlingId(cat.id);

          if (!existing) {
            const newCat = await storage.createCategory({
              name: cat.descricao,
              slug,
              parentId: parentLocalId,
              blingId: cat.id,
            });
            blingIdToLocalId[cat.id] = newCat.id;
            created++;
          } else {
            await storage.updateCategory(existing.id, {
              name: cat.descricao,
              slug,
              parentId: parentLocalId,
              blingId: cat.id,
            });
            blingIdToLocalId[cat.id] = existing.id;
            updated++;
          }
        }

        res.json({ created, updated });
      } catch (error: any) {
        console.error("Bling import categories error:", error);
        res.status(500).json({ error: "Falha ao importar categorias" });
      }
    },
  );

  // Preview products from Bling (optionally filtered by category)
  app.get(
    "/api/bling/products/preview",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const allProducts: any[] = [];
        let page = 1;
        const limit = 100;

        // Fetch all product pages
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          const pageProducts = await blingService.fetchBlingProductsList(
            page,
            limit,
          );
          if (pageProducts.length === 0) break;

          // Only include active products
          for (const p of pageProducts) {
            if (p.situacao === "A") {
              allProducts.push(p);
            }
          }

          if (pageProducts.length < limit) break;
          page++;
        }

        res.json({ products: allProducts });
      } catch (error: any) {
        console.error("Bling fetch products error:", error);
        res.status(500).json({ error: "Falha ao buscar produtos do Bling" });
      }
    },
  );

  // Import selected Bling products
  app.post(
    "/api/bling/products/import",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { productIds } = req.body;
        if (
          !productIds ||
          !Array.isArray(productIds) ||
          productIds.length === 0
        ) {
          return res.status(400).json({ error: "productIds é obrigatório" });
        }

        // Load category mappings
        const existingCategories = await storage.getCategories();
        const blingIdToCategoryId: Record<number, number> = {};
        const categoryMap: Record<string, number> = {};
        existingCategories.forEach((c) => {
          categoryMap[c.name.toLowerCase()] = c.id;
          if (c.blingId) {
            blingIdToCategoryId[c.blingId] = c.id;
          }
        });

        let created = 0;
        let updated = 0;
        const errors: string[] = [];

        // Fetch stock from dedicated endpoint (more reliable)
        console.log(
          `[import] Fetching stock for ${productIds.length} products...`,
        );
        const stockMap = await blingService.fetchBlingStock(productIds);
        console.log(
          `[import] Got stock for ${stockMap.size} products. Non-zero: ${Array.from(stockMap.values()).filter((v) => v > 0).length}`,
        );

        for (const productId of productIds) {
          await new Promise((resolve) => setTimeout(resolve, 600));

          try {
            const blingProduct =
              await blingService.fetchBlingProductDetails(productId);
            if (!blingProduct) {
              errors.push(`Produto ${productId}: Falha ao buscar detalhes`);
              continue;
            }

            let categoryId: number | null = null;
            const blingCat = blingProduct.categoria;
            if (blingCat && blingCat.id) {
              categoryId = blingIdToCategoryId[blingCat.id] || null;
              if (!categoryId && blingCat.descricao) {
                categoryId =
                  categoryMap[blingCat.descricao.toLowerCase()] || null;
              }
            }

            let imageUrl: string | null = null;
            if (blingProduct.imagens && blingProduct.imagens.length > 0) {
              const sortedImages = [...blingProduct.imagens].sort(
                (a: any, b: any) => (a.ordem || 0) - (b.ordem || 0),
              );
              imageUrl =
                sortedImages[0]?.linkExterno || sortedImages[0]?.link || null;
            }
            if (!imageUrl && blingProduct.midia?.imagens?.externas?.[0]?.link) {
              imageUrl = blingProduct.midia.imagens.externas[0].link;
            }
            if (!imageUrl && blingProduct.midia?.imagens?.internas?.[0]?.link) {
              imageUrl = blingProduct.midia.imagens.internas[0].link;
            }

            const description =
              blingProduct.descricaoComplementar ||
              blingProduct.descricaoCurta ||
              null;
            // Get stock from dedicated endpoint first, fallback to product details
            const stock =
              stockMap.get(productId) ??
              blingProduct.estoque?.saldoVirtual ??
              blingProduct.estoque?.saldoFisico ??
              0;

            const productData = {
              name: blingProduct.nome,
              sku: blingProduct.codigo || `BLING-${blingProduct.id}`,
              categoryId,
              brand: blingProduct.marca || null,
              description,
              price: String(blingProduct.preco || 0),
              stock,
              image: imageUrl,
            };

            const existing = await storage.getProductBySku(productData.sku);

            if (!existing) {
              await storage.createProduct(productData);
              created++;
            } else {
              await storage.updateProduct(existing.id, productData);
              updated++;
            }
          } catch (err: any) {
            errors.push(`Produto ${productId}: ${err.message}`);
          }
        }

        res.json({ created, updated, errors });
      } catch (error: any) {
        console.error("Bling import products error:", error);
        res.status(500).json({ error: "Falha ao importar produtos" });
      }
    },
  );

  // ========== PDF GENERATION ==========

  // Helper function to draw standard PDF header
  function drawPdfHeader(
    doc: typeof PDFDocument.prototype,
    pdfType: string,
    orderNumber: string,
  ) {
    const titles: Record<string, string> = {
      separacao: "PEDIDO - SEPARACAO",
      cobranca: "PEDIDO - COBRANCA",
      conferencia: "PEDIDO - CONFERENCIA",
    };

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("LOJAMADRUGADAO SAO PAULO", { align: "center" });
    doc
      .fontSize(10)
      .font("Helvetica")
      .text("CNPJ: 00.000.000/0001-00 | WhatsApp: (11) 99284-5596", {
        align: "center",
      });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(`${titles[pdfType] || "PEDIDO"}`, { align: "center" });
    doc.fontSize(12).text(`N. ${orderNumber}`, { align: "center" });
    doc.moveDown();
  }

  // Batch PDF - generates a single PDF with multiple orders
  app.post(
    "/api/orders/pdf/batch",
    isAuthenticated,
    isApproved,
    async (req: any, res) => {
      try {
        const { orderIds, type } = req.body;

        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
          return res
            .status(400)
            .json({ message: "orderIds array is required" });
        }

        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);

        const pdfType = type || "cobranca";

        const pdfFileNames: Record<string, string> = {
          separacao: "SEPARACAO",
          cobranca: "COBRANCA",
          conferencia: "CONFERENCIA",
        };

        const doc = new PDFDocument({ margin: 40, size: "A4" });

        const fileName = `${pdfFileNames[pdfType] || "PDF"}_Lote_${new Date().toISOString().slice(0, 10)}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}"`,
        );
        doc.pipe(res);

        for (let i = 0; i < orderIds.length; i++) {
          const orderId = orderIds[i];
          const orderDetails = await storage.getOrderWithDetails(
            parseInt(orderId),
          );

          if (!orderDetails) continue;

          if (
            user?.role === "customer" &&
            orderDetails.order.userId !== userId
          ) {
            continue;
          }

          const { order, items, customer } = orderDetails;

          if (i > 0) {
            doc.addPage();
          }

          // ========== PDF DE SEPARACAO ==========
          if (pdfType === "separacao") {
            drawPdfHeader(doc, pdfType, order.orderNumber);

            // Info basica
            doc.fontSize(10).font("Helvetica");
            doc.text(
              `Cliente: ${customer?.tradingName || customer?.company || `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() || "-"}`,
              40,
            );
            doc.text(
              `Data do Pedido: ${new Date(order.createdAt).toLocaleDateString("pt-BR")}`,
            );
            if (order.notes) {
              doc.moveDown(0.3);
              doc.font("Helvetica-Bold").text("Obs: ", { continued: true });
              doc.font("Helvetica").text(order.notes);
            }
            doc.moveDown();

            // Tabela de itens
            doc.font("Helvetica-Bold").fontSize(10);
            doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
            doc.moveDown(0.3);

            const tableTop = doc.y;
            const colCheck = 40;
            const colImg = 65;
            const colCode = 115;
            const colProduct = 165;
            const colQty = 480;

            doc.text("OK", colCheck, tableTop);
            doc.text("Foto", colImg, tableTop);
            doc.text("SKU", colCode, tableTop);
            doc.text("Produto", colProduct, tableTop);
            doc.text("QTD", colQty, tableTop);

            doc
              .moveTo(40, doc.y + 3)
              .lineTo(555, doc.y + 3)
              .stroke();
            doc.moveDown(0.5);

            doc.font("Helvetica").fontSize(9);
            let totalQty = 0;
            const imgHeight = 22;

            for (const item of items) {
              totalQty += item.quantity;

              if (doc.y > 700) {
                doc.addPage();
              }

              const rowY = doc.y;

              // Checkbox grande
              doc.rect(colCheck, rowY, 12, 12).stroke();

              // Foto do produto
              if (item.product?.image) {
                try {
                  const imgBuffer = await fetchImageBuffer(item.product.image);
                  if (imgBuffer) {
                    doc.image(imgBuffer, colImg, rowY, {
                      width: 22,
                      height: imgHeight,
                      fit: [22, imgHeight],
                    });
                  }
                } catch (e) {
                  doc.rect(colImg, rowY, 22, imgHeight).stroke();
                }
              } else {
                doc.rect(colImg, rowY, 22, imgHeight).stroke();
              }

              doc.text(item.product?.sku || "-", colCode, rowY + 6, {
                width: 45,
              });
              doc.text(
                item.product?.name || `Produto #${item.productId}`,
                colProduct,
                rowY + 6,
                { width: 305 },
              );

              // Quantidade em fonte grande e destacada
              doc.font("Helvetica-Bold").fontSize(12);
              doc.text(item.quantity.toString(), colQty, rowY + 4);
              doc.font("Helvetica").fontSize(9);

              doc.y = rowY + imgHeight + 3;
            }

            doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
            doc.moveDown();

            doc.font("Helvetica-Bold").fontSize(11);
            doc.text(`TOTAL DE ITENS: ${totalQty}`);

            // Rodape de separacao
            doc.moveDown(3);
            doc.fontSize(10).font("Helvetica");
            doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
            doc.moveDown(0.5);
            doc.text(
              "Separado por: ________________________________     Data: ____/____/________",
            );
          }

          // ========== PDF DE COBRANCA ==========
          else if (pdfType === "cobranca") {
            drawPdfHeader(doc, pdfType, order.orderNumber);

            // Dados do cliente completos
            if (customer) {
              doc.fontSize(10).font("Helvetica-Bold").text("DADOS DO CLIENTE");
              doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
              doc.moveDown(0.3);

              doc.font("Helvetica");
              const col1X = 40;
              const col2X = 300;

              let y = doc.y;
              const clientName =
                customer.tradingName ||
                customer.company ||
                `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
              doc.text(`Cliente: ${clientName}`, col1X, y);

              y = doc.y + 3;
              if (customer.personType === "juridica" && customer.cnpj) {
                doc.text(`CNPJ: ${customer.cnpj}`, col1X, y);
              } else if (customer.cpf) {
                doc.text(`CPF: ${customer.cpf}`, col1X, y);
              }
              if (customer.stateRegistration) {
                doc.text(`IE: ${customer.stateRegistration}`, col2X, y);
              }

              y = doc.y + 3;
              let addressLine = "";
              if (customer.address) {
                addressLine = customer.address;
                if (customer.addressNumber)
                  addressLine += `, ${customer.addressNumber}`;
                if (customer.complement)
                  addressLine += ` - ${customer.complement}`;
                if (customer.neighborhood)
                  addressLine += ` - ${customer.neighborhood}`;
              }
              if (addressLine) {
                doc.text(`Endereco: ${addressLine}`, col1X, y);
              }

              y = doc.y + 3;
              if (customer.city || customer.state) {
                doc.text(
                  `${customer.city || ""} - ${customer.state || ""}`,
                  col1X,
                  y,
                );
              }
              if (customer.cep) {
                doc.text(`CEP: ${customer.cep}`, col2X, y);
              }

              y = doc.y + 3;
              if (customer.phone) {
                doc.text(`Tel: ${customer.phone}`, col1X, y);
              }
              if (customer.email) {
                doc.text(`Email: ${customer.email}`, col2X, y);
              }

              doc.moveDown();
            }

            // Tabela de itens com precos
            doc.font("Helvetica-Bold").fontSize(10);
            doc.text("ITENS DO PEDIDO");
            doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
            doc.moveDown(0.3);

            const tableTop = doc.y;
            const colCode = 40;
            const colProduct = 90;
            const colQty = 350;
            const colPrice = 410;
            const colSubtotal = 490;

            doc.text("SKU", colCode, tableTop);
            doc.text("Produto", colProduct, tableTop);
            doc.text("Qtd", colQty, tableTop);
            doc.text("Preco", colPrice, tableTop);
            doc.text("Subtotal", colSubtotal, tableTop);

            doc
              .moveTo(40, doc.y + 3)
              .lineTo(555, doc.y + 3)
              .stroke();
            doc.moveDown(0.5);

            doc.font("Helvetica").fontSize(9);
            let totalQty = 0;

            for (const item of items) {
              const itemSubtotal = parseFloat(item.price) * item.quantity;
              totalQty += item.quantity;

              if (doc.y > 680) {
                doc.addPage();
              }

              const rowY = doc.y;

              doc.text(item.product?.sku || "-", colCode, rowY, { width: 45 });
              doc.text(
                item.product?.name || `Produto #${item.productId}`,
                colProduct,
                rowY,
                { width: 255 },
              );
              doc.text(item.quantity.toString(), colQty, rowY);
              doc.text(
                `R$ ${parseFloat(item.price).toFixed(2)}`,
                colPrice,
                rowY,
              );
              doc.text(`R$ ${itemSubtotal.toFixed(2)}`, colSubtotal, rowY);

              doc.y = rowY + 15;
            }

            doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
            doc.moveDown();

            // Box de totais destacado
            doc.font("Helvetica").fontSize(10);
            doc.text(`Quantidade Total: ${totalQty} itens`, 40);
            doc.moveDown(0.5);

            const boxX = 350;
            const boxY = doc.y;
            const boxWidth = 205;
            const boxHeight = 70;

            doc.rect(boxX, boxY, boxWidth, boxHeight).stroke();

            doc.text(`Subtotal:`, boxX + 10, boxY + 8);
            doc.text(
              `R$ ${parseFloat(order.subtotal || "0").toFixed(2)}`,
              boxX + 120,
              boxY + 8,
            );

            doc.text(`Frete:`, boxX + 10, boxY + 23);
            doc.text(
              `R$ ${parseFloat(order.shippingCost || "0").toFixed(2)}`,
              boxX + 120,
              boxY + 23,
            );

            doc
              .moveTo(boxX + 5, boxY + 40)
              .lineTo(boxX + boxWidth - 5, boxY + 40)
              .stroke();

            doc.font("Helvetica-Bold").fontSize(12);
            doc.text(`TOTAL:`, boxX + 10, boxY + 48);
            doc.text(
              `R$ ${parseFloat(order.total).toFixed(2)}`,
              boxX + 100,
              boxY + 48,
            );

            doc.y = boxY + boxHeight + 15;

            // Forma de pagamento
            if (order.paymentMethod || order.paymentNotes) {
              doc
                .font("Helvetica-Bold")
                .fontSize(10)
                .text("FORMA DE PAGAMENTO");
              doc.font("Helvetica").fontSize(9);
              if (order.paymentMethod) doc.text(order.paymentMethod);
              if (order.paymentNotes) doc.text(order.paymentNotes);
              doc.moveDown();
            }

            // Observacoes
            if (order.notes) {
              doc.font("Helvetica-Bold").fontSize(10).text("OBSERVACOES");
              doc.font("Helvetica").fontSize(9).text(order.notes);
              doc.moveDown();
            }

            // Rodape
            doc.moveDown();
            doc.fontSize(8).font("Helvetica");
            doc.text(
              `Emissao: ${new Date(order.createdAt).toLocaleDateString("pt-BR")} | Este documento nao e fiscal.`,
              { align: "center" },
            );
          }

          // ========== PDF DE CONFERENCIA ==========
          else if (pdfType === "conferencia") {
            drawPdfHeader(doc, pdfType, order.orderNumber);

            // Info basica
            doc.fontSize(10).font("Helvetica");
            doc.text(
              `Cliente: ${customer?.tradingName || customer?.company || `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() || "-"}`,
            );
            doc.text(
              `Data do Pedido: ${new Date(order.createdAt).toLocaleDateString("pt-BR")}`,
            );
            doc.moveDown();

            // Tabela com 3 colunas
            doc.font("Helvetica-Bold").fontSize(10);
            doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
            doc.moveDown(0.3);

            const tableTop = doc.y;
            const colImg = 40;
            const colCode = 90;
            const colProduct = 140;
            const colQtyPedido = 400;
            const colQtyConferido = 490;

            doc.text("Foto", colImg, tableTop);
            doc.text("SKU", colCode, tableTop);
            doc.text("Produto", colProduct, tableTop);
            doc.text("Qtd", colQtyPedido, tableTop);
            doc.text("Conferido", colQtyConferido, tableTop);

            doc
              .moveTo(40, doc.y + 3)
              .lineTo(555, doc.y + 3)
              .stroke();
            doc.moveDown(0.5);

            doc.font("Helvetica").fontSize(9);
            let totalQty = 0;
            const imgHeight = 22;

            for (const item of items) {
              totalQty += item.quantity;

              if (doc.y > 700) {
                doc.addPage();
              }

              const rowY = doc.y;

              // Foto do produto
              if (item.product?.image) {
                try {
                  const imgBuffer = await fetchImageBuffer(item.product.image);
                  if (imgBuffer) {
                    doc.image(imgBuffer, colImg, rowY, {
                      width: 22,
                      height: imgHeight,
                      fit: [22, imgHeight],
                    });
                  }
                } catch (e) {
                  doc.rect(colImg, rowY, 22, imgHeight).stroke();
                }
              } else {
                doc.rect(colImg, rowY, 22, imgHeight).stroke();
              }

              doc.text(item.product?.sku || "-", colCode, rowY + 6, {
                width: 45,
              });
              doc.text(
                item.product?.name || `Produto #${item.productId}`,
                colProduct,
                rowY + 6,
                { width: 250 },
              );

              doc.font("Helvetica-Bold").fontSize(10);
              doc.text(item.quantity.toString(), colQtyPedido + 10, rowY + 6);
              doc.font("Helvetica").fontSize(9);

              // Campo vazio para preencher manualmente
              doc.rect(colQtyConferido, rowY + 2, 35, 16).stroke();

              doc.y = rowY + imgHeight + 3;
            }

            doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
            doc.moveDown();

            doc.font("Helvetica-Bold").fontSize(10);
            doc.text(`TOTAL DE ITENS: ${totalQty}`);

            // Observacoes do pedido
            if (order.notes) {
              doc.moveDown();
              doc.font("Helvetica-Bold").text("Observacoes do Pedido:");
              doc.font("Helvetica").fontSize(9).text(order.notes);
            }

            // Area de conferencia
            doc.moveDown(2);
            doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
            doc.moveDown(0.5);

            // Checkbox de conferencia
            doc.rect(40, doc.y, 15, 15).stroke();
            doc
              .font("Helvetica")
              .fontSize(10)
              .text("  Pedido conferido sem divergencias", 60, doc.y + 2);

            doc.moveDown(1.5);
            doc.text("Conferido por: ________________________________");
            doc.moveDown(0.5);
            doc.text("Data/Hora: ____/____/________ - ____:____");

            doc.moveDown(1.5);
            doc.fontSize(8).font("Helvetica-Bold");
            doc.text(
              "ATENCAO: Somente apos a conferencia o pedido pode ser enviado.",
              { align: "center" },
            );
          }
        }

        doc.end();
      } catch (error) {
        console.error("Error generating batch PDF:", error);
        res.status(500).json({ message: "Failed to generate batch PDF" });
      }
    },
  );

  app.get(
    "/api/orders/:id/pdf",
    isAuthenticated,
    isApproved,
    async (req: any, res) => {
      try {
        const orderDetails = await storage.getOrderWithDetails(
          parseInt(req.params.id),
        );
        if (!orderDetails) {
          return res.status(404).json({ message: "Order not found" });
        }

        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);

        // Customers can only see their own orders
        if (user?.role === "customer" && orderDetails.order.userId !== userId) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const { order, items, customer } = orderDetails;

        // PDF type: separacao, cobranca (default), conferencia
        const pdfType = (req.query.type as string) || "cobranca";
        const showPrices = pdfType === "cobranca";
        const showCustomerDetails = pdfType !== "conferencia";

        const pdfTitles: Record<string, string> = {
          separacao: "SEPARACAO",
          cobranca: "ORCAMENTO",
          conferencia: "CONFERENCIA",
        };

        // Create PDF document
        const doc = new PDFDocument({ margin: 40, size: "A4" });

        const fileName =
          pdfType === "cobranca"
            ? `Orcamento_${order.orderNumber}.pdf`
            : `${pdfTitles[pdfType] || "PDF"}_${order.orderNumber}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}"`,
        );

        doc.pipe(res);

        // Header
        doc
          .fontSize(16)
          .font("Helvetica-Bold")
          .text("LOJAMADRUGADAO SAO PAULO", { align: "center" });
        doc
          .fontSize(12)
          .font("Helvetica")
          .text("11 99284-5596", { align: "center" });
        doc.moveDown(0.5);
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .text(
            `${pdfTitles[pdfType] || "ORCAMENTO"} N. ${order.orderNumber}`,
            { align: "center" },
          );
        doc.moveDown();

        // Customer Info (only for separacao and cobranca)
        if (showCustomerDetails) {
          doc.fontSize(10).font("Helvetica-Bold").text("DADOS DO CLIENTE");
          doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown(0.3);

          doc.font("Helvetica");
          if (customer) {
            const col1X = 40;
            const col2X = 300;

            let y = doc.y;
            doc.text(
              `Cliente: ${customer.firstName || ""} ${customer.lastName || ""}`,
              col1X,
              y,
            );
            if (customer.company) {
              doc.text(`Razao Social: ${customer.company}`, col2X, y);
            }

            y = doc.y + 5;
            if (customer.tradingName) {
              doc.text(`Nome Fantasia: ${customer.tradingName}`, col1X, y);
            }

            y = doc.y + 5;
            if (customer.personType === "juridica" && customer.cnpj) {
              doc.text(`CNPJ: ${customer.cnpj}`, col1X, y);
            } else if (customer.cpf) {
              doc.text(`CPF: ${customer.cpf}`, col1X, y);
            }
            if (customer.stateRegistration) {
              doc.text(
                `Inscricao Estadual: ${customer.stateRegistration}`,
                col2X,
                y,
              );
            }

            y = doc.y + 5;
            let addressLine = "";
            if (customer.address) {
              addressLine = customer.address;
              if (customer.addressNumber)
                addressLine += `, ${customer.addressNumber}`;
              if (customer.complement)
                addressLine += ` - ${customer.complement}`;
            }
            if (addressLine) {
              doc.text(`Endereco: ${addressLine}`, col1X, y);
            }

            y = doc.y + 5;
            if (customer.neighborhood) {
              doc.text(`Bairro: ${customer.neighborhood}`, col1X, y);
            }
            if (customer.cep) {
              doc.text(`CEP: ${customer.cep}`, col2X, y);
            }

            y = doc.y + 5;
            if (customer.city) {
              doc.text(`Cidade: ${customer.city}`, col1X, y);
            }
            if (customer.state) {
              doc.text(`Estado: ${customer.state}`, col2X, y);
            }

            y = doc.y + 5;
            if (customer.phone) {
              doc.text(`Telefone: ${customer.phone}`, col1X, y);
            }
            if (customer.email) {
              doc.text(`E-mail: ${customer.email}`, col2X, y);
            }
          }

          doc.moveDown(1.5);
        }

        // Items Table Header
        doc.font("Helvetica-Bold").fontSize(10);
        doc.text("ITENS DO PEDIDO");
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.3);

        // Table header - adjusted columns for image
        const tableTop = doc.y;
        const colImg = 40;
        const colCode = 90;
        const colProduct = 140;
        const colQty = showPrices ? 350 : 450;
        const colPrice = 410;
        const colSubtotal = 480;
        const imgSize = 40;

        doc.text("Img", colImg, tableTop);
        doc.text("#", colCode, tableTop);
        doc.text("Produto", colProduct, tableTop);
        doc.text("Qtde.", colQty, tableTop);
        if (showPrices) {
          doc.text("Preco", colPrice, tableTop);
          doc.text("Subtotal", colSubtotal, tableTop);
        }

        doc
          .moveTo(40, doc.y + 3)
          .lineTo(555, doc.y + 3)
          .stroke();
        doc.moveDown(0.5);

        // Items
        doc.font("Helvetica").fontSize(9);
        let totalQty = 0;

        for (const item of items) {
          const y = doc.y;
          const itemSubtotal = parseFloat(item.price) * item.quantity;
          totalQty += item.quantity;

          // Check if we need a new page
          if (y > 700) {
            doc.addPage();
          }

          const rowY = doc.y;

          // Try to add product image
          if (item.product?.image) {
            try {
              const imageBuffer = await fetchImageBuffer(item.product.image);
              if (imageBuffer) {
                doc.image(imageBuffer, colImg, rowY, {
                  width: imgSize,
                  height: imgSize,
                  fit: [imgSize, imgSize],
                });
              }
            } catch (imgErr) {
              // If image fails, just skip it
            }
          }

          doc.text(item.product?.sku || "-", colCode, rowY + 15, { width: 45 });
          doc.text(
            item.product?.name || `Produto #${item.productId}`,
            colProduct,
            rowY + 15,
            { width: showPrices ? 205 : 305 },
          );
          doc.text(item.quantity.toString(), colQty, rowY + 15);
          if (showPrices) {
            doc.text(
              `R$ ${parseFloat(item.price).toFixed(2)}`,
              colPrice,
              rowY + 15,
            );
            doc.text(`R$ ${itemSubtotal.toFixed(2)}`, colSubtotal, rowY + 15);
          }

          // Move down based on image size
          doc.y = rowY + imgSize + 5;
        }

        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown();

        // Totals (only for cobranca)
        doc.font("Helvetica-Bold").fontSize(10);
        doc.text(`Qtde. Total: ${totalQty}`, 40, doc.y);

        if (showPrices) {
          const totalsX = 380;
          doc.moveDown(0.3);
          doc.text(`Total de Descontos: R$ 0,00`, totalsX);
          doc.moveDown(0.3);
          doc.text(`Valor do frete: R$ 0,00`, totalsX);
          doc.moveDown(0.3);
          doc
            .fontSize(12)
            .text(
              `Valor Total: R$ ${parseFloat(order.total).toFixed(2)}`,
              totalsX,
            );
        }

        doc.moveDown(2);

        // Footer
        doc.fontSize(9).font("Helvetica");
        const footerY = doc.y;
        doc.text(
          `Data de Emissao: ${new Date(order.createdAt).toLocaleDateString("pt-BR")}`,
          40,
          footerY,
        );
        doc.text(`Status: ${order.status}`, 300, footerY);

        if (order.notes) {
          doc.moveDown();
          doc.font("Helvetica-Bold").text("Observacoes:");
          doc.font("Helvetica").text(order.notes);
        }

        doc.end();
      } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({ message: "Failed to generate PDF" });
      }
    },
  );

  // ========== CATALOG BANNERS ==========
  app.get("/api/catalog/banners", async (req, res) => {
    try {
      const position = req.query.position as string | undefined;
      const banners = await storage.getCatalogBanners(position);
      res.json(banners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch banners" });
    }
  });

  app.get(
    "/api/catalog/banners/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const banner = await storage.getCatalogBanner(parseInt(req.params.id));
        if (!banner) {
          return res.status(404).json({ message: "Banner not found" });
        }
        res.json(banner);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch banner" });
      }
    },
  );

  app.post(
    "/api/catalog/banners",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const data = insertCatalogBannerSchema.parse(req.body);
        const banner = await storage.createCatalogBanner(data);
        res.status(201).json(banner);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid banner data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create banner" });
      }
    },
  );

  app.patch(
    "/api/catalog/banners/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const banner = await storage.updateCatalogBanner(
          parseInt(req.params.id),
          req.body,
        );
        if (!banner) {
          return res.status(404).json({ message: "Banner not found" });
        }
        res.json(banner);
      } catch (error) {
        res.status(400).json({ message: "Failed to update banner" });
      }
    },
  );

  app.delete(
    "/api/catalog/banners/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        await storage.deleteCatalogBanner(parseInt(req.params.id));
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete banner" });
      }
    },
  );

  // ========== CATALOG SLIDES ==========
  app.get("/api/catalog/slides", async (req, res) => {
    try {
      const slides = await storage.getCatalogSlides();
      res.json(slides);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch slides" });
    }
  });

  app.get(
    "/api/catalog/slides/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const slide = await storage.getCatalogSlide(parseInt(req.params.id));
        if (!slide) {
          return res.status(404).json({ message: "Slide not found" });
        }
        res.json(slide);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch slide" });
      }
    },
  );

  app.post(
    "/api/catalog/slides",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const data = insertCatalogSlideSchema.parse(req.body);
        const slide = await storage.createCatalogSlide(data);
        res.status(201).json(slide);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid slide data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create slide" });
      }
    },
  );

  app.patch(
    "/api/catalog/slides/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const slide = await storage.updateCatalogSlide(
          parseInt(req.params.id),
          req.body,
        );
        if (!slide) {
          return res.status(404).json({ message: "Slide not found" });
        }
        res.json(slide);
      } catch (error) {
        res.status(400).json({ message: "Failed to update slide" });
      }
    },
  );

  app.delete(
    "/api/catalog/slides/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        await storage.deleteCatalogSlide(parseInt(req.params.id));
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete slide" });
      }
    },
  );

  // ========== SUPPLIERS ==========

  app.get(
    "/api/suppliers",
    isAuthenticated,
    isAdminOrSales,
    async (req, res) => {
      try {
        const allSuppliers = await storage.getSuppliers();
        res.json(allSuppliers);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch suppliers" });
      }
    },
  );

  app.get(
    "/api/suppliers/:id",
    isAuthenticated,
    isAdminOrSales,
    async (req, res) => {
      try {
        const supplier = await storage.getSupplier(parseInt(req.params.id));
        if (!supplier) {
          return res.status(404).json({ message: "Supplier not found" });
        }
        res.json(supplier);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch supplier" });
      }
    },
  );

  app.post("/api/suppliers", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const data = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(data);
      res.status(201).json(supplier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid supplier data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create supplier" });
    }
  });

  app.patch(
    "/api/suppliers/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const supplier = await storage.updateSupplier(
          parseInt(req.params.id),
          req.body,
        );
        if (!supplier) {
          return res.status(404).json({ message: "Supplier not found" });
        }
        res.json(supplier);
      } catch (error) {
        res.status(400).json({ message: "Failed to update supplier" });
      }
    },
  );

  app.delete(
    "/api/suppliers/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        await storage.deleteSupplier(parseInt(req.params.id));
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete supplier" });
      }
    },
  );

  // ========== MODULES (PERMISSION SYSTEM) ==========

  // Seed modules on server startup (internal function, not exposed to API)
  async function seedModulesOnStartup() {
    try {
      const existingModules = await storage.getModules();
      if (existingModules.length > 0) {
        console.log("[MODULES] Modules already seeded, skipping...");
        return;
      }

      const defaultModules = [
        {
          key: "catalog",
          label: "Catalogo",
          description: "Visualizar catalogo de produtos",
          icon: "ShoppingBag",
          defaultRoles: ["admin", "sales", "customer"],
          sortOrder: 1,
        },
        {
          key: "orders",
          label: "Pedidos",
          description: "Gerenciar pedidos",
          icon: "ShoppingCart",
          defaultRoles: ["admin", "sales", "customer"],
          sortOrder: 2,
        },
        {
          key: "products",
          label: "Produtos",
          description: "Gerenciar produtos do catalogo",
          icon: "Package",
          defaultRoles: ["admin", "sales"],
          sortOrder: 3,
        },
        {
          key: "customers",
          label: "Clientes",
          description: "Gerenciar clientes e usuarios",
          icon: "Users",
          defaultRoles: ["admin", "sales"],
          sortOrder: 4,
        },
        {
          key: "financial_receivables",
          label: "Contas a Receber",
          description: "Gerenciar creditos e fiados",
          icon: "TrendingUp",
          defaultRoles: ["admin", "sales"],
          sortOrder: 5,
        },
        {
          key: "financial_payables",
          label: "Contas a Pagar",
          description: "Gerenciar despesas e dividas",
          icon: "TrendingDown",
          defaultRoles: ["admin"],
          sortOrder: 6,
        },
        {
          key: "reports",
          label: "Relatorios",
          description: "Visualizar relatorios e dashboards",
          icon: "BarChart3",
          defaultRoles: ["admin"],
          sortOrder: 7,
        },
        {
          key: "settings",
          label: "Configuracoes",
          description: "Configuracoes do sistema",
          icon: "Settings",
          defaultRoles: ["admin"],
          sortOrder: 8,
        },
        {
          key: "appearance",
          label: "Aparencia",
          description: "Personalizar aparencia do sistema",
          icon: "Palette",
          defaultRoles: ["admin"],
          sortOrder: 9,
        },
        {
          key: "pdv",
          label: "PDV",
          description: "Ponto de Venda / Orcamento rapido",
          icon: "Monitor",
          defaultRoles: ["admin", "sales"],
          sortOrder: 10,
        },
        {
          key: "agenda",
          label: "Agenda",
          description: "Calendario de eventos",
          icon: "Calendar",
          defaultRoles: ["admin", "sales"],
          sortOrder: 11,
        },
        {
          key: "brands",
          label: "Marcas",
          description: "Visualizar analytics de marcas",
          icon: "Tag",
          defaultRoles: ["admin", "supplier"],
          sortOrder: 12,
        },
        {
          key: "payments",
          label: "Pagamentos",
          description: "Gerenciar tipos de pagamento e integracoes",
          icon: "CreditCard",
          defaultRoles: ["admin"],
          sortOrder: 13,
        },
      ];

      for (const mod of defaultModules) {
        await storage.createModule(mod);
      }
      console.log("[MODULES] Default modules seeded successfully");
    } catch (error) {
      console.error("[MODULES] Error seeding modules:", error);
    }
  }

  // Run module seeding on startup
  seedModulesOnStartup();

  // Get all available modules
  app.get("/api/modules", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allModules = await storage.getModules();
      res.json(allModules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch modules" });
    }
  });

  // Get user's module permissions
  app.get(
    "/api/users/:id/permissions",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const userId = req.params.id;
        const permissionKeys = await storage.getUserPermissionKeys(userId);
        res.json({ userId, modules: permissionKeys });
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch user permissions" });
      }
    },
  );

  // Set user's module permissions
  app.post(
    "/api/users/:id/permissions",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const userId = req.params.id;
        const { modules: moduleKeys } = req.body;

        if (!Array.isArray(moduleKeys)) {
          return res
            .status(400)
            .json({ message: "modules must be an array of module keys" });
        }

        await storage.setUserPermissions(userId, moduleKeys);
        const updatedPermissions = await storage.getUserPermissionKeys(userId);
        res.json({ userId, modules: updatedPermissions });
      } catch (error) {
        console.error("Error setting user permissions:", error);
        res.status(500).json({ message: "Failed to set user permissions" });
      }
    },
  );

  // Get current user's permissions (for frontend menu filtering)
  app.get("/api/auth/permissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Admin has access to everything
      if (user?.role === "admin") {
        const allModules = await storage.getModules();
        return res.json({
          modules: allModules.map((m) => m.key),
          role: "admin",
        });
      }

      // Check if user has specific permissions set
      const permissionKeys = await storage.getUserPermissionKeys(userId);

      // If user has specific permissions, use them
      if (permissionKeys.length > 0) {
        return res.json({
          modules: permissionKeys,
          role: user?.role || "customer",
        });
      }

      // Otherwise, use default roles from modules
      const userRole = user?.role || "customer";
      const allModules = await storage.getModules();
      const defaultModules = allModules
        .filter((m) => m.defaultRoles?.includes(userRole))
        .map((m) => m.key);

      res.json({ modules: defaultModules, role: userRole });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // ========== PAYMENT TYPES ==========

  // Public endpoint for active payment types (for checkout)
  app.get("/api/public/payment-types", async (req, res) => {
    try {
      const paymentTypes = await storage.getPaymentTypes();
      const activePaymentTypes = paymentTypes.filter((pt) => pt.active);
      res.json(activePaymentTypes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment types" });
    }
  });

  app.get("/api/payment-types", isAuthenticated, async (req, res) => {
    try {
      const paymentTypes = await storage.getPaymentTypes();
      res.json(paymentTypes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment types" });
    }
  });

  app.get(
    "/api/payment-types/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const paymentType = await storage.getPaymentType(
          parseInt(req.params.id),
        );
        if (!paymentType) {
          return res.status(404).json({ message: "Payment type not found" });
        }
        res.json(paymentType);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch payment type" });
      }
    },
  );

  app.post("/api/payment-types", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const paymentType = await storage.createPaymentType(req.body);
      res.status(201).json(paymentType);
    } catch (error) {
      res.status(500).json({ message: "Failed to create payment type" });
    }
  });

  app.patch(
    "/api/payment-types/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const paymentType = await storage.updatePaymentType(
          parseInt(req.params.id),
          req.body,
        );
        if (!paymentType) {
          return res.status(404).json({ message: "Payment type not found" });
        }
        res.json(paymentType);
      } catch (error) {
        res.status(500).json({ message: "Failed to update payment type" });
      }
    },
  );

  app.delete(
    "/api/payment-types/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        await storage.deletePaymentType(parseInt(req.params.id));
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete payment type" });
      }
    },
  );

  // ========== PAYMENT INTEGRATIONS ==========

  app.get(
    "/api/payment-integrations",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const integrations = await storage.getPaymentIntegrations();
        res.json(integrations);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to fetch payment integrations" });
      }
    },
  );

  app.get(
    "/api/payment-integrations/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const integration = await storage.getPaymentIntegration(
          parseInt(req.params.id),
        );
        if (!integration) {
          return res.status(404).json({ message: "Integration not found" });
        }
        res.json(integration);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch integration" });
      }
    },
  );

  app.post(
    "/api/payment-integrations",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const integration = await storage.createPaymentIntegration(req.body);
        res.status(201).json(integration);
      } catch (error) {
        res.status(500).json({ message: "Failed to create integration" });
      }
    },
  );

  app.patch(
    "/api/payment-integrations/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const integration = await storage.updatePaymentIntegration(
          parseInt(req.params.id),
          req.body,
        );
        if (!integration) {
          return res.status(404).json({ message: "Integration not found" });
        }
        res.json(integration);
      } catch (error) {
        res.status(500).json({ message: "Failed to update integration" });
      }
    },
  );

  app.delete(
    "/api/payment-integrations/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        await storage.deletePaymentIntegration(parseInt(req.params.id));
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete integration" });
      }
    },
  );

  // ========== PURCHASE ORDERS (COMPRAS) ==========
  
  // List purchase orders with optional filters
  app.get("/api/purchases", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { status, search } = req.query;
      const orders = await storage.getPurchaseOrders({
        status: status as string | undefined,
        search: search as string | undefined,
      });
      res.json(orders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ message: "Erro ao buscar pedidos de compra" });
    }
  });

  // Get single purchase order with details
  app.get("/api/purchases/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const details = await storage.getPurchaseOrderWithDetails(parseInt(req.params.id));
      if (!details) {
        return res.status(404).json({ message: "Pedido nao encontrado" });
      }
      res.json(details);
    } catch (error) {
      console.error("Error fetching purchase order:", error);
      res.status(500).json({ message: "Erro ao buscar pedido" });
    }
  });

  // Create new purchase order (DRAFT)
  app.post("/api/purchases", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const order = await storage.createPurchaseOrder(req.body);
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(500).json({ message: "Erro ao criar pedido de compra" });
    }
  });

  // Update purchase order (only DRAFT)
  app.put("/api/purchases/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const order = await storage.getPurchaseOrder(parseInt(req.params.id));
      if (!order) {
        return res.status(404).json({ message: "Pedido nao encontrado" });
      }
      if (order.status !== "DRAFT") {
        return res.status(400).json({ message: "Apenas rascunhos podem ser editados" });
      }
      const updated = await storage.updatePurchaseOrder(parseInt(req.params.id), req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating purchase order:", error);
      res.status(500).json({ message: "Erro ao atualizar pedido" });
    }
  });

  // Delete purchase order (only DRAFT or STOCK_REVERSED, never STOCK_POSTED)
  app.delete("/api/purchases/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const order = await storage.getPurchaseOrder(parseInt(req.params.id));
      if (!order) {
        return res.status(404).json({ message: "Pedido nao encontrado" });
      }
      if (order.status === "STOCK_POSTED") {
        return res.status(400).json({ message: "Nao e possivel excluir pedidos com estoque lancado. Estorne o estoque primeiro." });
      }
      if (order.status !== "DRAFT" && order.status !== "STOCK_REVERSED") {
        return res.status(400).json({ message: "Apenas rascunhos ou pedidos com estoque estornado podem ser excluidos" });
      }
      const deleted = await storage.deletePurchaseOrder(parseInt(req.params.id));
      if (!deleted) {
        return res.status(400).json({ message: "Erro ao excluir pedido" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting purchase order:", error);
      res.status(500).json({ message: "Erro ao excluir pedido" });
    }
  });

  // Finalize purchase order
  app.post("/api/purchases/:id/finalize", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await storage.finalizePurchaseOrder(parseInt(req.params.id));
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      const updated = await storage.getPurchaseOrder(parseInt(req.params.id));
      res.json(updated);
    } catch (error) {
      console.error("Error finalizing purchase order:", error);
      res.status(500).json({ message: "Erro ao finalizar pedido" });
    }
  });

  // Post stock (lancar estoque)
  app.post("/api/purchases/:id/post-stock", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await storage.postPurchaseOrderStock(parseInt(req.params.id));
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      const updated = await storage.getPurchaseOrder(parseInt(req.params.id));
      res.json(updated);
    } catch (error) {
      console.error("Error posting stock:", error);
      res.status(500).json({ message: "Erro ao lancar estoque" });
    }
  });

  // Reverse stock (devolver estoque)
  app.post("/api/purchases/:id/reverse-stock", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await storage.reversePurchaseOrderStock(parseInt(req.params.id));
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      const updated = await storage.getPurchaseOrder(parseInt(req.params.id));
      res.json(updated);
    } catch (error) {
      console.error("Error reversing stock:", error);
      res.status(500).json({ message: "Erro ao devolver estoque" });
    }
  });

  // ========== PURCHASE ORDER ITEMS ==========
  
  // Add item to purchase order
  app.post("/api/purchases/:id/items", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const order = await storage.getPurchaseOrder(parseInt(req.params.id));
      if (!order) {
        return res.status(404).json({ message: "Pedido nao encontrado" });
      }
      if (order.status !== "DRAFT") {
        return res.status(400).json({ message: "Apenas rascunhos podem ser editados" });
      }
      const item = await storage.createPurchaseOrderItem({
        ...req.body,
        purchaseOrderId: parseInt(req.params.id),
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding item:", error);
      res.status(500).json({ message: "Erro ao adicionar item" });
    }
  });

  // Update item
  app.patch("/api/purchases/:orderId/items/:itemId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const order = await storage.getPurchaseOrder(parseInt(req.params.orderId));
      if (!order || order.status !== "DRAFT") {
        return res.status(400).json({ message: "Apenas rascunhos podem ser editados" });
      }
      const updated = await storage.updatePurchaseOrderItem(parseInt(req.params.itemId), req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating item:", error);
      res.status(500).json({ message: "Erro ao atualizar item" });
    }
  });

  // Delete item
  app.delete("/api/purchases/:orderId/items/:itemId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const order = await storage.getPurchaseOrder(parseInt(req.params.orderId));
      if (!order || order.status !== "DRAFT") {
        return res.status(400).json({ message: "Apenas rascunhos podem ser editados" });
      }
      await storage.deletePurchaseOrderItem(parseInt(req.params.itemId));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting item:", error);
      res.status(500).json({ message: "Erro ao remover item" });
    }
  });

  // ========== STOCK MOVEMENTS ==========
  
  app.get("/api/stock-movements", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { productId } = req.query;
      const movements = await storage.getStockMovements(productId ? parseInt(productId as string) : undefined);
      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      res.status(500).json({ message: "Erro ao buscar movimentacoes" });
    }
  });

  /* =========================================================
     SUPER ADMIN ROUTES - Global System Management
     Apenas usuários com isSuperAdmin = true podem acessar
  ========================================================= */

  app.get(
    "/api/superadmin/companies",
    isAuthenticated,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const companies = await companiesService.getAllCompanies();
        res.json(companies);
      } catch (error) {
        console.error("Error fetching all companies:", error);
        res.status(500).json({ message: "Erro ao buscar empresas" });
      }
    },
  );

  app.get(
    "/api/superadmin/companies/:id",
    isAuthenticated,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const company = await companiesService.getCompanyById(req.params.id);
        if (!company) {
          return res.status(404).json({ message: "Empresa não encontrada" });
        }
        res.json(company);
      } catch (error) {
        console.error("Error fetching company:", error);
        res.status(500).json({ message: "Erro ao buscar empresa" });
      }
    },
  );

  app.patch(
    "/api/superadmin/companies/:id/approval",
    isAuthenticated,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const { approvalStatus } = req.body;
        if (!approvalStatus) {
          return res.status(400).json({ message: "Status de aprovação é obrigatório" });
        }
        const updated = await companiesService.updateCompanyApprovalStatus(
          req.params.id,
          approvalStatus
        );
        if (!updated) {
          return res.status(404).json({ message: "Empresa não encontrada" });
        }
        res.json(updated);
      } catch (error) {
        console.error("Error updating company approval:", error);
        res.status(500).json({ message: "Erro ao atualizar status" });
      }
    },
  );

  app.get(
    "/api/superadmin/b2b-users",
    isAuthenticated,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const users = await db.select().from(b2bUsers);
        res.json(users);
      } catch (error) {
        console.error("Error fetching b2b users:", error);
        res.status(500).json({ message: "Erro ao buscar usuários B2B" });
      }
    },
  );

  return httpServer;
}
