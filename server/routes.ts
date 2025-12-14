import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { products, orderItems, orders } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCategorySchema, insertProductSchema, insertOrderSchema, insertOrderItemSchema, insertCouponSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { Client } from "@replit/object-storage";
import * as blingService from "./services/bling";
import bcrypt from "bcryptjs";
import PDFDocument from "pdfkit";

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
}

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

// Helper to generate sequential order numbers starting from 8000
async function generateOrderNumber(): Promise<string> {
  const nextNumber = await storage.getNextOrderNumber();
  return nextNumber.toString();
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

  // Public registration endpoint
  app.post('/api/register', async (req, res) => {
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
      const isRetailCustomer = data.personType === 'fisica';
      
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
        approved: newUser.approved 
      });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Erro ao criar cadastro" });
    }
  });

  // Local login endpoint (email/password)
  app.post('/api/auth/login', async (req: any, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "E-mail e senha são obrigatórios" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "E-mail ou senha incorretos" });
      }

      if (!user.password) {
        return res.status(401).json({ message: "Esta conta não possui senha cadastrada" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "E-mail ou senha incorretos" });
      }

      // Create session for local user with expires_at for compatibility with isAuthenticated
      const sessionExpiry = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 1 week
      const sessionUser = {
        claims: { sub: user.id },
        expires_at: sessionExpiry,
        isLocalAuth: true,
      };
      
      req.login(sessionUser, (err: any) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Erro ao fazer login" });
        }
        res.json({ message: "Login realizado com sucesso", user });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Erro ao fazer login" });
    }
  });

  // Local logout endpoint
  app.post('/api/auth/logout', (req: any, res) => {
    req.logout((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

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

  // ========== PUBLIC CATALOG (no auth required) ==========
  // Retail markup: 40% on top of base price
  const RETAIL_MARKUP = 0.40;
  
  app.get('/api/public/products', async (req, res) => {
    try {
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const sort = req.query.sort as string | undefined;
      const result = await storage.getProducts({ categoryId, search, page, limit, sort });
      
      // Get categories hidden from varejo
      const allCategories = await storage.getCategories();
      const hiddenCategoryIds = new Set(
        allCategories.filter(c => c.hideFromVarejo).map(c => c.id)
      );
      
      // Filter out products from hidden categories
      const visibleProducts = result.products.filter(p => 
        !p.categoryId || !hiddenCategoryIds.has(p.categoryId)
      );
      
      // Apply retail markup (40%) to all prices for public view
      const productsWithRetailPrice = visibleProducts.map(p => ({
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

  app.get('/api/public/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      // Filter out categories hidden from varejo
      const publicCategories = categories.filter(c => !c.hideFromVarejo);
      res.json(publicCategories);
    } catch (error) {
      console.error("Error fetching public categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // ========== PRODUCTS ==========
  app.get('/api/products', isAuthenticated, isApproved, async (req: any, res) => {
    try {
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const result = await storage.getProducts({ categoryId, search, page, limit });
      
      // Get user to check customer type
      const userId = req.user?.claims?.sub;
      const user = userId ? await storage.getUser(userId) : null;
      
      // Atacado customers see base price, varejo customers see price + 40%
      const isAtacado = user?.customerType === 'atacado' || user?.role === 'admin' || user?.role === 'sales';
      
      if (isAtacado) {
        // Atacado: show base price (no markup)
        res.json(result);
      } else {
        // Varejo: apply 40% markup
        const productsWithRetailPrice = result.products.map(p => ({
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
      
      let ordersData;
      // Customers can only see their own orders
      if (user?.role === 'customer') {
        ordersData = await storage.getOrders(userId);
      } else {
        // Admin and sales can see all orders
        ordersData = await storage.getOrders();
      }
      
      // Fetch customer info for each order
      const ordersWithCustomers = await Promise.all(
        ordersData.map(async (order) => {
          const customer = await storage.getUser(order.userId);
          return {
            ...order,
            customerName: customer ? 
              (customer.tradingName || customer.company || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email) 
              : order.userId.substring(0, 8) + "...",
          };
        })
      );
      
      res.json(ordersWithCustomers);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/orders/:id', isAuthenticated, isApproved, async (req: any, res) => {
    try {
      const orderDetails = await storage.getOrderWithDetails(parseInt(req.params.id));
      if (!orderDetails) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Customers can only see their own orders
      if (user?.role === 'customer' && orderDetails.order.userId !== userId) {
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
  });

  app.post('/api/orders', isAuthenticated, isApproved, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { items, notes, subtotal, shippingCost, shippingAddress, shippingMethod, paymentMethod, paymentNotes } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Order must have at least one item" });
      }
      
      // Calculate total from items
      let calculatedSubtotal = 0;
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Product ${item.productId} not found` });
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
        if (typeof shippingAddress === 'object' && shippingAddress.fullAddress) {
          shippingAddressStr = shippingAddress.fullAddress;
        } else if (typeof shippingAddress === 'string') {
          shippingAddressStr = shippingAddress;
        }
      }
      
      // Create order with ORCAMENTO status
      const order = await storage.createOrder({
        userId,
        orderNumber: await generateOrderNumber(),
        status: 'ORCAMENTO',
        subtotal: finalSubtotal.toFixed(2),
        shippingCost: finalShippingCost.toFixed(2),
        total: total.toFixed(2),
        shippingAddress: shippingAddressStr,
        shippingMethod: shippingMethod || null,
        paymentMethod: paymentMethod || null,
        paymentNotes: paymentNotes || null,
        notes: notes || null,
        isGuestOrder: false,
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

  // Guest checkout - no authentication required
  app.post('/api/orders/guest', async (req: any, res) => {
    try {
      const { items, notes, subtotal, shippingCost, shippingAddress, shippingMethod, paymentMethod, paymentNotes, guestCpf, guestName, guestEmail, guestPhone } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Order must have at least one item" });
      }
      
      // Validate guest CPF (required)
      if (!guestCpf || guestCpf.replace(/\D/g, '').length !== 11) {
        return res.status(400).json({ message: "CPF valido e obrigatorio" });
      }
      
      // Calculate total from items
      let calculatedSubtotal = 0;
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Product ${item.productId} not found` });
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
        if (typeof shippingAddress === 'object' && shippingAddress.fullAddress) {
          shippingAddressStr = shippingAddress.fullAddress;
        } else if (typeof shippingAddress === 'string') {
          shippingAddressStr = shippingAddress;
        }
      }
      
      // Create guest order with ORCAMENTO status
      const order = await storage.createOrder({
        userId: null, // No user for guest orders
        orderNumber: await generateOrderNumber(),
        status: 'ORCAMENTO',
        subtotal: finalSubtotal.toFixed(2),
        shippingCost: finalShippingCost.toFixed(2),
        total: total.toFixed(2),
        shippingAddress: shippingAddressStr,
        shippingMethod: shippingMethod || null,
        paymentMethod: paymentMethod || null,
        paymentNotes: paymentNotes || null,
        notes: notes || null,
        isGuestOrder: true,
        guestCpf: guestCpf.replace(/\D/g, ''),
        guestName: guestName || null,
        guestEmail: guestEmail || null,
        guestPhone: guestPhone || null,
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
      console.error("Error creating guest order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.patch('/api/orders/:id', isAuthenticated, isAdminOrSales, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { status } = req.body;
      
      // Check if order exists and prevent changes from FATURADO
      const existingOrder = await storage.getOrder(orderId);
      if (!existingOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // FATURADO orders cannot change to any other status
      if (existingOrder.status === 'FATURADO' && status) {
        return res.status(400).json({ message: "Pedidos faturados não podem ter o status alterado" });
      }
      
      // Handle cancellation with stock return (only from PEDIDO_GERADO or ORCAMENTO)
      if (status === 'CANCELADO') {
        const items = await storage.getOrderItems(orderId);
        
        // If order was in PEDIDO_GERADO (stock reserved), release reserved stock
        if (existingOrder.status === 'PEDIDO_GERADO') {
          for (const item of items) {
            await db.update(products)
              .set({ reservedStock: sql`GREATEST(reserved_stock - ${item.quantity}, 0)` })
              .where(eq(products.id, item.productId));
          }
        }
        
        // Update order to cancelled
        const order = await storage.updateOrder(orderId, { 
          status: 'CANCELADO',
          reservedAt: null,
          reservedBy: null
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
  });

  app.patch('/api/orders/:id/print', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const order = await storage.updateOrder(parseInt(req.params.id), {
        printed: true,
        printedAt: new Date(),
        printedBy: userId,
      });
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark order as printed" });
    }
  });

  app.post('/api/orders/:id/reserve', isAuthenticated, isAdminOrSales, async (req: any, res) => {
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
  });

  app.post('/api/orders/:id/release', isAuthenticated, isAdminOrSales, async (req: any, res) => {
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
  });

  app.post('/api/orders/:id/invoice', isAuthenticated, isAdminOrSales, async (req: any, res) => {
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
  });

  // Admin-only: Delete order with stock return if applicable
  app.delete('/api/orders/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const existingOrder = await storage.getOrder(orderId);
      
      if (!existingOrder) {
        return res.status(404).json({ message: "Pedido não encontrado" });
      }
      
      // FATURADO orders cannot be deleted
      if (existingOrder.status === 'FATURADO') {
        return res.status(400).json({ message: "Pedidos faturados não podem ser excluídos" });
      }
      
      const items = await storage.getOrderItems(orderId);
      
      // If order has reserved stock (PEDIDO_GERADO), release it back
      if (existingOrder.status === 'PEDIDO_GERADO') {
        for (const item of items) {
          await db.update(products)
            .set({ reservedStock: sql`GREATEST(reserved_stock - ${item.quantity}, 0)` })
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
  });

  app.get('/api/me/purchase-stats', isAuthenticated, isApproved, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getCustomerPurchaseStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching purchase stats:", error);
      res.status(500).json({ message: "Failed to fetch purchase statistics" });
    }
  });

  app.get('/api/admin/sales-stats', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const stats = await storage.getAdminSalesStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin sales stats:", error);
      res.status(500).json({ message: "Failed to fetch sales statistics" });
    }
  });

  app.get('/api/admin/customer-analytics', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const analytics = await storage.getCustomerAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching customer analytics:", error);
      res.status(500).json({ message: "Failed to fetch customer analytics" });
    }
  });

  app.get('/api/admin/product-analytics', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const analytics = await storage.getProductAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching product analytics:", error);
      res.status(500).json({ message: "Failed to fetch product analytics" });
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

  // Create user with email/password (admin only)
  app.post('/api/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { firstName, email, password, role } = req.body;
      
      if (!firstName || !email || !password) {
        return res.status(400).json({ message: "Nome, email e senha são obrigatórios" });
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

      res.status(201).json({ message: "Usuário criado com sucesso", userId: newUser.id });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
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
      const coupon = await storage.updateCoupon(parseInt(req.params.id), req.body);
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

  app.post("/api/coupons/validate", isAuthenticated, isApproved, async (req, res) => {
    try {
      const { code, orderTotal } = req.body;
      const coupon = await storage.getCouponByCode(code);
      
      if (!coupon) {
        return res.status(404).json({ valid: false, message: "Cupom não encontrado" });
      }
      
      if (!coupon.active) {
        return res.status(400).json({ valid: false, message: "Cupom inativo" });
      }
      
      const now = new Date();
      if (coupon.validFrom && new Date(coupon.validFrom) > now) {
        return res.status(400).json({ valid: false, message: "Cupom ainda não está válido" });
      }
      if (coupon.validUntil && new Date(coupon.validUntil) < now) {
        return res.status(400).json({ valid: false, message: "Cupom expirado" });
      }
      
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return res.status(400).json({ valid: false, message: "Cupom esgotado" });
      }
      
      if (coupon.minOrderValue && parseFloat(coupon.minOrderValue) > orderTotal) {
        return res.status(400).json({ 
          valid: false, 
          message: `Pedido mínimo de R$ ${parseFloat(coupon.minOrderValue).toFixed(2)}` 
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
      res.status(500).json({ valid: false, message: "Erro ao validar cupom" });
    }
  });

  // ========== BLING INTEGRATION ==========
  app.get("/api/bling/status", isAuthenticated, isAdmin, async (req, res) => {
    res.json(blingService.getStatus());
  });

  app.post("/api/bling/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers["x-bling-signature-256"] as string;
    const rawBody = req.body.toString("utf8");

    console.log("Bling webhook received:");
    console.log("- Signature header:", signature ? `${signature.substring(0, 20)}...` : "MISSING");
    console.log("- Payload preview:", rawBody.substring(0, 200));

    // Verify signature if present, but log and continue for debugging
    if (signature) {
      const isValid = blingService.verifyWebhookSignature(rawBody, signature);
      console.log("- Signature valid:", isValid);
      if (!isValid) {
        console.warn("Signature verification failed but processing anyway for debugging");
      }
    }

    try {
      const payload = JSON.parse(rawBody);
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
    const redirectUri = process.env.BLING_REDIRECT_URI || `https://${req.get("host")}/api/bling/callback`;
    console.log("Bling OAuth redirect_uri:", redirectUri);
    const authUrl = blingService.getAuthorizationUrl(redirectUri);
    res.redirect(authUrl);
  });

  app.get("/api/bling/callback", async (req, res) => {
    const { code } = req.query;
    const redirectUri = process.env.BLING_REDIRECT_URI || `https://${req.get("host")}/api/bling/callback`;
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

  app.post("/api/bling/disconnect", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Clear the access token to disconnect
      delete process.env.BLING_ACCESS_TOKEN;
      delete process.env.BLING_REFRESH_TOKEN;
      res.json({ success: true, message: "Desconectado do Bling" });
    } catch (error: any) {
      console.error("Bling disconnect error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========== PDF GENERATION ==========
  
  // Batch PDF - generates a single PDF with multiple orders
  app.post('/api/orders/pdf/batch', isAuthenticated, isApproved, async (req: any, res) => {
    try {
      const { orderIds, type } = req.body;
      
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: "orderIds array is required" });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      const pdfType = type || 'cobranca';
      const showPrices = pdfType === 'cobranca';
      const showCustomerDetails = pdfType !== 'conferencia';
      
      const pdfTitles: Record<string, string> = {
        separacao: 'SEPARACAO',
        cobranca: 'ORCAMENTO',
        conferencia: 'CONFERENCIA'
      };

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      
      const fileName = `${pdfTitles[pdfType] || 'PDF'}_Lote_${new Date().toISOString().slice(0,10)}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      doc.pipe(res);

      for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i];
        const orderDetails = await storage.getOrderWithDetails(parseInt(orderId));
        
        if (!orderDetails) continue;
        
        // Customers can only see their own orders
        if (user?.role === 'customer' && orderDetails.order.userId !== userId) {
          continue;
        }

        const { order, items, customer } = orderDetails;

        // Add new page for orders after the first
        if (i > 0) {
          doc.addPage();
        }

        // Header
        doc.fontSize(16).font('Helvetica-Bold').text('LOJAMADRUGADAO SAO PAULO', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text('11 99284-5596', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(14).font('Helvetica-Bold').text(`${pdfTitles[pdfType] || 'ORCAMENTO'} N. ${order.orderNumber}`, { align: 'center' });
        doc.moveDown();

        // Customer Info
        if (showCustomerDetails && customer) {
          doc.fontSize(10).font('Helvetica-Bold').text('DADOS DO CLIENTE');
          doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown(0.3);

          doc.font('Helvetica');
          const col1X = 40;
          const col2X = 300;

          let y = doc.y;
          doc.text(`Cliente: ${customer.firstName || ''} ${customer.lastName || ''}`, col1X, y);
          if (customer.company) {
            doc.text(`Razao Social: ${customer.company}`, col2X, y);
          }

          y = doc.y + 5;
          if (customer.tradingName) {
            doc.text(`Nome Fantasia: ${customer.tradingName}`, col1X, y);
          }
          
          y = doc.y + 5;
          if (customer.personType === 'juridica' && customer.cnpj) {
            doc.text(`CNPJ: ${customer.cnpj}`, col1X, y);
          } else if (customer.cpf) {
            doc.text(`CPF: ${customer.cpf}`, col1X, y);
          }
          if (customer.stateRegistration) {
            doc.text(`Inscricao Estadual: ${customer.stateRegistration}`, col2X, y);
          }

          y = doc.y + 5;
          let addressLine = '';
          if (customer.address) {
            addressLine = customer.address;
            if (customer.addressNumber) addressLine += `, ${customer.addressNumber}`;
            if (customer.complement) addressLine += ` - ${customer.complement}`;
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

          doc.moveDown(1.5);
        }

        // Items Table Header
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('ITENS DO PEDIDO');
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.3);

        const tableTop = doc.y;
        const colImg = 40;
        const colCode = 90;
        const colProduct = 140;
        const colQty = showPrices ? 350 : 450;
        const colPrice = 410;
        const colSubtotal = 480;
        const imgSize = 40;

        doc.text('Img', colImg, tableTop);
        doc.text('#', colCode, tableTop);
        doc.text('Produto', colProduct, tableTop);
        doc.text('Qtde.', colQty, tableTop);
        if (showPrices) {
          doc.text('Preco', colPrice, tableTop);
          doc.text('Subtotal', colSubtotal, tableTop);
        }

        doc.moveTo(40, doc.y + 3).lineTo(555, doc.y + 3).stroke();
        doc.moveDown(0.5);

        // Items
        doc.font('Helvetica').fontSize(9);
        let totalQty = 0;

        for (const item of items) {
          const itemSubtotal = parseFloat(item.price) * item.quantity;
          totalQty += item.quantity;

          if (doc.y > 700) {
            doc.addPage();
          }

          const rowY = doc.y;

          if (item.product?.image) {
            try {
              const imageBuffer = await fetchImageBuffer(item.product.image);
              if (imageBuffer) {
                doc.image(imageBuffer, colImg, rowY, { width: imgSize, height: imgSize, fit: [imgSize, imgSize] });
              }
            } catch (imgErr) {}
          }

          doc.text(item.product?.sku || '-', colCode, rowY + 15, { width: 45 });
          doc.text(item.product?.name || `Produto #${item.productId}`, colProduct, rowY + 15, { width: showPrices ? 205 : 305 });
          doc.text(item.quantity.toString(), colQty, rowY + 15);
          if (showPrices) {
            doc.text(`R$ ${parseFloat(item.price).toFixed(2)}`, colPrice, rowY + 15);
            doc.text(`R$ ${itemSubtotal.toFixed(2)}`, colSubtotal, rowY + 15);
          }

          doc.y = rowY + imgSize + 5;
        }

        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown();

        // Totals
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text(`Qtde. Total: ${totalQty}`, 40, doc.y);
        
        if (showPrices) {
          const totalsX = 380;
          doc.moveDown(0.3);
          doc.text(`Total de Descontos: R$ 0,00`, totalsX);
          doc.moveDown(0.3);
          doc.text(`Valor do frete: R$ 0,00`, totalsX);
          doc.moveDown(0.3);
          doc.fontSize(12).text(`Valor Total: R$ ${parseFloat(order.total).toFixed(2)}`, totalsX);
        }

        doc.moveDown(2);

        // Footer
        doc.fontSize(9).font('Helvetica');
        const footerY = doc.y;
        doc.text(`Data de Emissao: ${new Date(order.createdAt).toLocaleDateString('pt-BR')}`, 40, footerY);
        doc.text(`Status: ${order.status}`, 300, footerY);

        if (order.notes) {
          doc.moveDown();
          doc.font('Helvetica-Bold').text('Observacoes:');
          doc.font('Helvetica').text(order.notes);
        }
      }

      doc.end();
    } catch (error) {
      console.error("Error generating batch PDF:", error);
      res.status(500).json({ message: "Failed to generate batch PDF" });
    }
  });

  app.get('/api/orders/:id/pdf', isAuthenticated, isApproved, async (req: any, res) => {
    try {
      const orderDetails = await storage.getOrderWithDetails(parseInt(req.params.id));
      if (!orderDetails) {
        return res.status(404).json({ message: "Order not found" });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      // Customers can only see their own orders
      if (user?.role === 'customer' && orderDetails.order.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { order, items, customer } = orderDetails;
      
      // PDF type: separacao, cobranca (default), conferencia
      const pdfType = (req.query.type as string) || 'cobranca';
      const showPrices = pdfType === 'cobranca';
      const showCustomerDetails = pdfType !== 'conferencia';
      
      const pdfTitles: Record<string, string> = {
        separacao: 'SEPARACAO',
        cobranca: 'ORCAMENTO',
        conferencia: 'CONFERENCIA'
      };

      // Create PDF document
      const doc = new PDFDocument({ margin: 40, size: 'A4' });

      const fileName = pdfType === 'cobranca' 
        ? `Orcamento_${order.orderNumber}.pdf`
        : `${pdfTitles[pdfType] || 'PDF'}_${order.orderNumber}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      doc.pipe(res);

      // Header
      doc.fontSize(16).font('Helvetica-Bold').text('LOJAMADRUGADAO SAO PAULO', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('11 99284-5596', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica-Bold').text(`${pdfTitles[pdfType] || 'ORCAMENTO'} N. ${order.orderNumber}`, { align: 'center' });
      doc.moveDown();

      // Customer Info (only for separacao and cobranca)
      if (showCustomerDetails) {
        doc.fontSize(10).font('Helvetica-Bold').text('DADOS DO CLIENTE');
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.3);

        doc.font('Helvetica');
        if (customer) {
          const col1X = 40;
          const col2X = 300;

          let y = doc.y;
          doc.text(`Cliente: ${customer.firstName || ''} ${customer.lastName || ''}`, col1X, y);
          if (customer.company) {
            doc.text(`Razao Social: ${customer.company}`, col2X, y);
          }

          y = doc.y + 5;
          if (customer.tradingName) {
            doc.text(`Nome Fantasia: ${customer.tradingName}`, col1X, y);
          }
          
          y = doc.y + 5;
          if (customer.personType === 'juridica' && customer.cnpj) {
            doc.text(`CNPJ: ${customer.cnpj}`, col1X, y);
          } else if (customer.cpf) {
            doc.text(`CPF: ${customer.cpf}`, col1X, y);
          }
          if (customer.stateRegistration) {
            doc.text(`Inscricao Estadual: ${customer.stateRegistration}`, col2X, y);
          }

          y = doc.y + 5;
          let addressLine = '';
          if (customer.address) {
            addressLine = customer.address;
            if (customer.addressNumber) addressLine += `, ${customer.addressNumber}`;
            if (customer.complement) addressLine += ` - ${customer.complement}`;
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
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('ITENS DO PEDIDO');
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

      doc.text('Img', colImg, tableTop);
      doc.text('#', colCode, tableTop);
      doc.text('Produto', colProduct, tableTop);
      doc.text('Qtde.', colQty, tableTop);
      if (showPrices) {
        doc.text('Preco', colPrice, tableTop);
        doc.text('Subtotal', colSubtotal, tableTop);
      }

      doc.moveTo(40, doc.y + 3).lineTo(555, doc.y + 3).stroke();
      doc.moveDown(0.5);

      // Items
      doc.font('Helvetica').fontSize(9);
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
              doc.image(imageBuffer, colImg, rowY, { width: imgSize, height: imgSize, fit: [imgSize, imgSize] });
            }
          } catch (imgErr) {
            // If image fails, just skip it
          }
        }

        doc.text(item.product?.sku || '-', colCode, rowY + 15, { width: 45 });
        doc.text(item.product?.name || `Produto #${item.productId}`, colProduct, rowY + 15, { width: showPrices ? 205 : 305 });
        doc.text(item.quantity.toString(), colQty, rowY + 15);
        if (showPrices) {
          doc.text(`R$ ${parseFloat(item.price).toFixed(2)}`, colPrice, rowY + 15);
          doc.text(`R$ ${itemSubtotal.toFixed(2)}`, colSubtotal, rowY + 15);
        }

        // Move down based on image size
        doc.y = rowY + imgSize + 5;
      }

      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown();

      // Totals (only for cobranca)
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text(`Qtde. Total: ${totalQty}`, 40, doc.y);
      
      if (showPrices) {
        const totalsX = 380;
        doc.moveDown(0.3);
        doc.text(`Total de Descontos: R$ 0,00`, totalsX);
        doc.moveDown(0.3);
        doc.text(`Valor do frete: R$ 0,00`, totalsX);
        doc.moveDown(0.3);
        doc.fontSize(12).text(`Valor Total: R$ ${parseFloat(order.total).toFixed(2)}`, totalsX);
      }

      doc.moveDown(2);

      // Footer
      doc.fontSize(9).font('Helvetica');
      const footerY = doc.y;
      doc.text(`Data de Emissao: ${new Date(order.createdAt).toLocaleDateString('pt-BR')}`, 40, footerY);
      doc.text(`Status: ${order.status}`, 300, footerY);

      if (order.notes) {
        doc.moveDown();
        doc.font('Helvetica-Bold').text('Observacoes:');
        doc.font('Helvetica').text(order.notes);
      }

      doc.end();
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  return httpServer;
}
