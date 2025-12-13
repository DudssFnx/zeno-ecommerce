import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCategorySchema, insertProductSchema, insertOrderSchema, insertOrderItemSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { Client } from "@replit/object-storage";
import * as blingService from "./services/bling";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

let objectStorageClient: Client | null = null;

async function getObjectStorage(): Promise<Client> {
  if (!objectStorageClient) {
    objectStorageClient = new Client();
  }
  return objectStorageClient;
}

// Helper to generate order numbers
function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${year}${month}-${random}`;
}

// Middleware to check if user is admin or sales
function isAdminOrSales(req: any, res: any, next: any) {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  storage.getUser(userId).then(user => {
    if (!user || (user.role !== 'admin' && user.role !== 'sales')) {
      return res.status(403).json({ message: "Forbidden - Admin or Sales access required" });
    }
    next();
  }).catch(() => {
    res.status(500).json({ message: "Server error" });
  });
}

// Middleware to check if user is admin only
function isAdmin(req: any, res: any, next: any) {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  storage.getUser(userId).then(user => {
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }
    next();
  }).catch(() => {
    res.status(500).json({ message: "Server error" });
  });
}

// Middleware to check if user is approved
function isApproved(req: any, res: any, next: any) {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  storage.getUser(userId).then(user => {
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    if (!user.approved && user.role !== 'admin') {
      return res.status(403).json({ message: "Account pending approval" });
    }
    next();
  }).catch(() => {
    res.status(500).json({ message: "Server error" });
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ========== CATEGORIES ==========
  app.get('/api/categories', isAuthenticated, isApproved, async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get('/api/categories/:id', isAuthenticated, isApproved, async (req, res) => {
    try {
      const category = await storage.getCategory(parseInt(req.params.id));
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch category" });
    }
  });

  app.post('/api/categories', isAuthenticated, isAdminOrSales, async (req, res) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(data);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.patch('/api/categories/:id', isAuthenticated, isAdminOrSales, async (req, res) => {
    try {
      const category = await storage.updateCategory(parseInt(req.params.id), req.body);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete('/api/categories/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteCategory(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // ========== PRODUCTS ==========
  app.get('/api/products', isAuthenticated, isApproved, async (req, res) => {
    try {
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const search = req.query.search as string | undefined;
      const products = await storage.getProducts({ categoryId, search });
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get('/api/products/:id', isAuthenticated, isApproved, async (req, res) => {
    try {
      const product = await storage.getProduct(parseInt(req.params.id));
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post('/api/products', isAuthenticated, isAdminOrSales, async (req, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.patch('/api/products/:id', isAuthenticated, isAdminOrSales, async (req, res) => {
    try {
      const product = await storage.updateProduct(parseInt(req.params.id), req.body);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete('/api/products/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteProduct(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // ========== ORDERS ==========
  app.get('/api/orders', isAuthenticated, isApproved, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Customers can only see their own orders
      if (user?.role === 'customer') {
        const orders = await storage.getOrders(userId);
        res.json(orders);
      } else {
        // Admin and sales can see all orders
        const orders = await storage.getOrders();
        res.json(orders);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/orders/:id', isAuthenticated, isApproved, async (req: any, res) => {
    try {
      const order = await storage.getOrder(parseInt(req.params.id));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Customers can only see their own orders
      if (user?.role === 'customer' && order.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const items = await storage.getOrderItems(order.id);
      res.json({ ...order, items });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post('/api/orders', isAuthenticated, isApproved, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { items, notes } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Order must have at least one item" });
      }
      
      // Calculate total
      let total = 0;
      const productIds = items.map((item: any) => item.productId);
      
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Product ${item.productId} not found` });
        }
        total += parseFloat(product.price) * item.quantity;
      }
      
      // Create order
      const order = await storage.createOrder({
        userId,
        orderNumber: generateOrderNumber(),
        status: 'pending',
        total: total.toFixed(2),
        notes: notes || null,
      });
      
      // Create order items
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: product!.price,
        });
      }
      
      const orderItems = await storage.getOrderItems(order.id);
      res.status(201).json({ ...order, items: orderItems });
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.patch('/api/orders/:id', isAuthenticated, isAdminOrSales, async (req, res) => {
    try {
      const order = await storage.updateOrder(parseInt(req.params.id), req.body);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // ========== USERS (Admin Only) ==========
  app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // ========== CSV Export ==========
  app.get('/api/orders/export/csv', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const orders = await storage.getOrders();
      
      // Build CSV content
      const headers = ['Order Number', 'User ID', 'Status', 'Total', 'Notes', 'Created At'];
      let csv = headers.join(',') + '\n';
      
      for (const order of orders) {
        const row = [
          order.orderNumber,
          order.userId,
          order.status,
          order.total,
          `"${(order.notes || '').replace(/"/g, '""')}"`,
          order.createdAt.toISOString()
        ];
        csv += row.join(',') + '\n';
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting orders:", error);
      res.status(500).json({ message: "Failed to export orders" });
    }
  });

  // ========== FILE UPLOAD ==========
  app.post('/api/upload', isAuthenticated, isAdminOrSales, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const file = req.file;
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ message: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed." });
      }

      const ext = file.originalname.split('.').pop() || 'jpg';
      const filename = `products/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const objectStorage = await getObjectStorage();
      await objectStorage.uploadFromBytes(filename, file.buffer);

      const publicUrl = await objectStorage.getSignedDownloadUrl(filename);
      
      res.json({ 
        url: publicUrl,
        filename: filename
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // ========== BLING INTEGRATION ==========
  app.get("/api/bling/status", isAuthenticated, isAdmin, async (req, res) => {
    res.json(blingService.getStatus());
  });

  app.post("/api/bling/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers["x-bling-signature-256"] as string;
    const rawBody = req.body.toString("utf8");

    if (!signature || !blingService.verifyWebhookSignature(rawBody, signature)) {
      console.error("Invalid Bling webhook signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    try {
      const payload = JSON.parse(rawBody);
      const result = await blingService.handleWebhook(payload);
      res.status(200).json(result);
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(200).json({ success: false, message: "Processing error" });
    }
  });

  app.get("/api/bling/auth", isAuthenticated, isAdmin, (req, res) => {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const redirectUri = `${protocol}://${host}/api/bling/callback`;
    const authUrl = blingService.getAuthorizationUrl(redirectUri);
    res.redirect(authUrl);
  });

  app.get("/api/bling/callback", async (req, res) => {
    const { code } = req.query;
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const redirectUri = `${protocol}://${host}/api/bling/callback`;
    try {
      await blingService.exchangeCodeForTokens(code as string, redirectUri);
      res.redirect("/bling?success=true");
    } catch (error) {
      console.error("Bling callback error:", error);
      res.redirect("/bling?error=auth_failed");
    }
  });

  app.post("/api/bling/sync/categories", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await blingService.syncCategories();
      res.json(result);
    } catch (error: any) {
      console.error("Bling sync categories error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bling/sync/products", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await blingService.syncProducts();
      res.json(result);
    } catch (error: any) {
      console.error("Bling sync products error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
