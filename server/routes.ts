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
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      throw new Error("Object storage not configured. DEFAULT_OBJECT_STORAGE_BUCKET_ID is missing.");
    }
    objectStorageClient = new Client({ bucketId });
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

  app.patch('/api/products/:id/toggle-featured', isAuthenticated, isAdminOrSales, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      const updated = await storage.updateProduct(productId, { featured: !product.featured });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle featured status" });
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
      
      // Fetch customer info and item count for each order
      const ordersWithCustomers = await Promise.all(
        ordersData.map(async (order) => {
          const customer = order.userId ? await storage.getUser(order.userId) : null;
          const orderItems = await storage.getOrderItems(order.id);
          return {
            ...order,
            customerName: customer ? 
              (customer.tradingName || customer.company || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email) 
              : (order.userId?.substring(0, 8) || 'Guest') + "...",
            items: orderItems,
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
      const loggedUserId = req.user.claims.sub;
      const loggedUser = await storage.getUser(loggedUserId);
      const { items, notes, subtotal, shippingCost, shippingAddress, shippingMethod, paymentMethod, paymentNotes, userId: targetUserId } = req.body;
      
      // Admin/Sales can create orders for other customers
      const userId = (loggedUser?.role === 'admin' || loggedUser?.role === 'sales') && targetUserId 
        ? targetUserId 
        : loggedUserId;
      
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
      blingService.createBlingOrder({
        orderNumber: order.orderNumber,
        customerCpfCnpj: user?.cnpj || user?.cpf || undefined,
        customerName: user?.tradingName || user?.company || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || undefined,
        items: blingItems,
        frete: finalShippingCost,
        observacoes: notes || undefined,
      }).then(result => {
        if (result.success) {
          console.log(`Order ${order.orderNumber} synced to Bling: ID ${result.blingId}`);
        } else {
          console.log(`Order ${order.orderNumber} Bling sync failed: ${result.error}`);
        }
      }).catch(err => console.error("Bling sync error:", err));
      
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
      blingService.createBlingOrder({
        orderNumber: order.orderNumber,
        customerCpfCnpj: guestCpf?.replace(/\D/g, ''),
        customerName: guestName || undefined,
        items: blingItems,
        frete: finalShippingCost,
        observacoes: notes || undefined,
      }).then(result => {
        if (result.success) {
          console.log(`Guest Order ${order.orderNumber} synced to Bling: ID ${result.blingId}`);
        } else {
          console.log(`Guest Order ${order.orderNumber} Bling sync failed: ${result.error}`);
        }
      }).catch(err => console.error("Bling sync error:", err));
      
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
        stage: 'IMPRESSO',
      });
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark order as printed" });
    }
  });

  // Update order stage (etapa operacional)
  app.patch('/api/orders/:id/stage', isAuthenticated, isAdminOrSales, async (req: any, res) => {
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

  app.post('/api/orders/:id/unreserve', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Pedido não encontrado" });
      }
      
      if (order.status !== 'PEDIDO_GERADO') {
        return res.status(400).json({ message: "Apenas pedidos com status 'Pedido Gerado' podem retornar para Orçamento" });
      }
      
      const releaseResult = await storage.releaseStockForOrder(orderId);
      if (!releaseResult.success) {
        return res.status(400).json({ message: releaseResult.error });
      }
      
      const updatedOrder = await storage.updateOrder(orderId, { 
        status: 'ORCAMENTO',
        reservedAt: null,
        reservedBy: null,
      });
      
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error unreserving order:", error);
      res.status(500).json({ message: "Erro ao retornar pedido para orçamento" });
    }
  });

  app.put('/api/orders/:id/items', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { items } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "O pedido deve ter pelo menos um item" });
      }
      
      const existingOrder = await storage.getOrder(orderId);
      if (!existingOrder) {
        return res.status(404).json({ message: "Pedido não encontrado" });
      }
      
      if (existingOrder.status === 'PEDIDO_FATURADO') {
        return res.status(400).json({ message: "Pedidos faturados não podem ser modificados" });
      }
      
      if (existingOrder.status === 'PEDIDO_GERADO') {
        return res.status(400).json({ message: "Pedidos com estoque reservado não podem ser editados. Retorne para Orçamento Enviado primeiro." });
      }
      
      if (existingOrder.status !== 'ORCAMENTO_CONCLUIDO' && existingOrder.status !== 'ORCAMENTO_ABERTO') {
        return res.status(400).json({ message: "Apenas orçamentos podem ser editados" });
      }
      
      const validatedItems: { productId: number; quantity: number; price: string }[] = [];
      let newTotal = 0;
      
      for (const item of items) {
        if (!item.productId || typeof item.productId !== 'number') {
          return res.status(400).json({ message: "ID do produto inválido" });
        }
        if (!item.quantity || typeof item.quantity !== 'number' || item.quantity < 1 || !Number.isInteger(item.quantity)) {
          return res.status(400).json({ message: "Quantidade deve ser um número inteiro positivo" });
        }
        
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Produto ${item.productId} não encontrado` });
        }
        
        const price = product.price;
        validatedItems.push({ productId: item.productId, quantity: item.quantity, price });
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
      const period = req.query.period as 'day' | 'week' | 'month' | 'year' | 'all' | undefined;
      const stats = await storage.getAdminSalesStats(period);
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

  app.get('/api/admin/employee-analytics', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const analytics = await storage.getEmployeeAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching employee analytics:", error);
      res.status(500).json({ message: "Failed to fetch employee analytics" });
    }
  });

  app.get('/api/admin/customers-by-location', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const allUsers = await storage.getUsers();
      const customers = allUsers.filter(u => u.role === 'customer');
      
      const byState: Record<string, { count: number; customers: { id: string; name: string; city: string | null }[] }> = {};
      const cityMap: Map<string, { city: string; state: string | null; count: number }> = new Map();
      
      for (const customer of customers) {
        const state = customer.state || 'Não informado';
        const city = customer.city || 'Não informado';
        const name = customer.tradingName || customer.company || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email || 'Cliente';
        
        if (!byState[state]) {
          byState[state] = { count: 0, customers: [] };
        }
        byState[state].count++;
        byState[state].customers.push({ id: customer.id, name, city: customer.city });
        
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
        customersWithLocation: customers.filter(c => c.state || c.city).length,
        byState: statesSorted,
        byCity: citiesSorted,
      });
    } catch (error) {
      console.error("Error fetching customers by location:", error);
      res.status(500).json({ message: "Failed to fetch customers by location" });
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

  app.get('/api/admin/purchases-analytics', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const analytics = await storage.getPurchasesAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching purchases analytics:", error);
      res.status(500).json({ message: "Failed to fetch purchases analytics" });
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

  // ========== AGENDA EVENTS ==========
  app.get('/api/agenda', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
      const events = await storage.getAgendaEvents({ startDate, endDate });
      res.json(events);
    } catch (error) {
      console.error("Error fetching agenda events:", error);
      res.status(500).json({ message: "Failed to fetch agenda events" });
    }
  });

  app.get('/api/agenda/:id', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const event = await storage.getAgendaEvent(parseInt(req.params.id));
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  const agendaEventSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().nullable(),
    date: z.string().min(1, "Date is required"),
    time: z.string().optional().nullable(),
    type: z.enum(["note", "meeting", "task", "reminder"]).default("note"),
    completed: z.boolean().optional(),
  });

  app.post('/api/agenda', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const validation = agendaEventSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.errors });
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
  });

  app.patch('/api/agenda/:id', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const partialSchema = agendaEventSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.errors });
      }
      const updateData: any = { ...validation.data };
      if (updateData.date) {
        updateData.date = new Date(updateData.date);
      }
      const event = await storage.updateAgendaEvent(parseInt(req.params.id), updateData);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error updating agenda event:", error);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete('/api/agenda/:id', isAuthenticated, isAdminOrSales, async (req: any, res) => {
    try {
      const success = await storage.deleteAgendaEvent(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // ========== SITE SETTINGS ==========
  app.get('/api/settings/:key', async (req, res) => {
    try {
      const setting = await storage.getSiteSetting(req.params.key);
      res.json({ key: req.params.key, value: setting?.value || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.post('/api/settings/:key', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log('[SETTINGS] Saving key:', req.params.key, 'value:', req.body.value);
      const { value } = req.body;
      const setting = await storage.setSiteSetting(req.params.key, value);
      console.log('[SETTINGS] Saved:', setting);
      res.json(setting);
    } catch (error) {
      console.error('[SETTINGS] Error saving setting:', error);
      res.status(500).json({ message: "Failed to save setting" });
    }
  });

  // ========== CATALOG BANNERS ==========
  app.get('/api/catalog/banners', async (req, res) => {
    try {
      const position = req.query.position as string | undefined;
      const banners = await storage.getCatalogBanners(position);
      res.json(banners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch banners" });
    }
  });

  app.get('/api/catalog/banners/:id', async (req, res) => {
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

  app.post('/api/catalog/banners', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const banner = await storage.createCatalogBanner(req.body);
      res.status(201).json(banner);
    } catch (error) {
      console.error("Error creating banner:", error);
      res.status(500).json({ message: "Failed to create banner" });
    }
  });

  app.patch('/api/catalog/banners/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const banner = await storage.updateCatalogBanner(parseInt(req.params.id), req.body);
      if (!banner) {
        return res.status(404).json({ message: "Banner not found" });
      }
      res.json(banner);
    } catch (error) {
      console.error("Error updating banner:", error);
      res.status(500).json({ message: "Failed to update banner" });
    }
  });

  app.delete('/api/catalog/banners/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const success = await storage.deleteCatalogBanner(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Banner not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete banner" });
    }
  });

  // ========== CATALOG SLIDES ==========
  app.get('/api/catalog/slides', async (req, res) => {
    try {
      const slides = await storage.getCatalogSlides();
      res.json(slides);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch slides" });
    }
  });

  app.get('/api/catalog/slides/:id', async (req, res) => {
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

  app.post('/api/catalog/slides', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const slide = await storage.createCatalogSlide(req.body);
      res.status(201).json(slide);
    } catch (error) {
      console.error("Error creating slide:", error);
      res.status(500).json({ message: "Failed to create slide" });
    }
  });

  app.patch('/api/catalog/slides/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const slide = await storage.updateCatalogSlide(parseInt(req.params.id), req.body);
      if (!slide) {
        return res.status(404).json({ message: "Slide not found" });
      }
      res.json(slide);
    } catch (error) {
      console.error("Error updating slide:", error);
      res.status(500).json({ message: "Failed to update slide" });
    }
  });

  app.delete('/api/catalog/slides/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const success = await storage.deleteCatalogSlide(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Slide not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete slide" });
    }
  });

  // ========== CATALOG CONFIG ==========
  app.get('/api/catalog/config/:key', async (req, res) => {
    try {
      const config = await storage.getCatalogConfig(req.params.key);
      res.json({ key: req.params.key, value: config?.value || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch config" });
    }
  });

  app.post('/api/catalog/config/:key', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { value } = req.body;
      const config = await storage.setCatalogConfig(req.params.key, value);
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to save config" });
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

  // ========== FILE SERVING (public endpoint to serve object storage files) ==========
  app.get('/api/files/*', async (req, res) => {
    try {
      const filePath = req.params[0];
      console.log('[FILE SERVE] Requested:', filePath);
      if (!filePath) {
        return res.status(400).json({ message: "File path required" });
      }

      const objectStorage = await getObjectStorage();
      const result = await objectStorage.downloadAsBytes(filePath);
      console.log('[FILE SERVE] Result ok:', result?.ok, 'valueLength:', result?.value?.length);
      
      if (!result || !result.ok) {
        console.log('[FILE SERVE] File not found or error:', filePath);
        return res.status(404).json({ message: "File not found" });
      }

      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'tiff': 'image/tiff',
        'tif': 'image/tiff',
        'heic': 'image/heic',
        'heif': 'image/heif',
        'avif': 'image/avif',
        'svg': 'image/svg+xml',
      };
      
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      const buffer = Buffer.from(result.value);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.end(buffer);
    } catch (error: any) {
      console.error("Error serving file:", error);
      if (error.message?.includes('not found') || error.message?.includes('NotFound')) {
        return res.status(404).json({ message: "File not found" });
      }
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // ========== FILE UPLOAD ==========
  app.post('/api/upload', isAuthenticated, isAdminOrSales, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const file = req.file;
      const allowedTypes = [
        'image/jpeg', 
        'image/jpg',
        'image/png', 
        'image/webp', 
        'image/gif',
        'image/bmp',
        'image/tiff',
        'image/heic',
        'image/heif',
        'image/avif',
        'image/svg+xml',
        'application/octet-stream',
      ];
      
      const fileExt = (file.originalname.split('.').pop() || '').toLowerCase();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'heic', 'heif', 'avif', 'svg'];
      
      const isValidMime = allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('image/');
      const isValidExt = allowedExtensions.includes(fileExt);
      
      if (!isValidMime && !isValidExt) {
        return res.status(400).json({ 
          message: `Tipo de arquivo invalido (${file.mimetype}). Formatos aceitos: JPG, PNG, WebP, GIF, BMP, TIFF, HEIC, AVIF.` 
        });
      }

      const ext = file.originalname.split('.').pop() || 'jpg';
      const filename = `public/products/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const objectStorage = await getObjectStorage();
      
      // Convert Node.js Buffer to Uint8Array for object storage compatibility
      console.log('[UPLOAD] File size:', file.buffer.length, 'bytes');
      const uint8Array = new Uint8Array(file.buffer.buffer, file.buffer.byteOffset, file.buffer.length);
      await objectStorage.uploadFromBytes(filename, uint8Array);
      console.log('[UPLOAD] File uploaded successfully:', filename);

      const publicUrl = `/api/files/${filename}`;
      
      res.json({ 
        url: publicUrl,
        filename: filename
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // ========== CATALOG IMAGE UPLOAD ==========
  app.post('/api/upload/catalog', isAuthenticated, isAdmin, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const file = req.file;
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      const fileExt = (file.originalname.split('.').pop() || '').toLowerCase();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      
      const isValidMime = allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('image/');
      const isValidExt = allowedExtensions.includes(fileExt);
      
      if (!isValidMime && !isValidExt) {
        return res.status(400).json({ message: "Tipo de arquivo invalido. Formatos aceitos: JPG, PNG, WebP, GIF." });
      }

      const ext = file.originalname.split('.').pop() || 'jpg';
      const filename = `public/catalog/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const objectStorage = await getObjectStorage();
      const uint8Array = new Uint8Array(file.buffer.buffer, file.buffer.byteOffset, file.buffer.length);
      await objectStorage.uploadFromBytes(filename, uint8Array);

      const publicUrl = `/api/files/${filename}`;
      res.json({ url: publicUrl, filename: filename });
    } catch (error) {
      console.error("Error uploading catalog image:", error);
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

  app.post("/api/bling/webhook", async (req: any, res) => {
    const signature = req.headers["x-bling-signature-256"] as string;
    // Use rawBody captured by express.json() middleware in index.ts
    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);

    console.log("Bling webhook received:");
    console.log("- Signature header:", signature ? `${signature.substring(0, 20)}...` : "MISSING");
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

  // ========== BLING MANUAL IMPORT ==========
  
  // Preview Bling categories (without importing)
  app.get("/api/bling/categories/preview", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const categories = await blingService.fetchBlingCategories();
      res.json({ categories });
    } catch (error: any) {
      console.error("Bling fetch categories error:", error);
      res.status(500).json({ error: "Falha ao buscar categorias do Bling" });
    }
  });

  // Import selected Bling categories
  app.post("/api/bling/categories/import", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { categoryIds } = req.body;
      if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
        return res.status(400).json({ error: "categoryIds é obrigatório" });
      }
      
      const allCategories = await blingService.fetchBlingCategories();
      const selectedCategories = allCategories.filter(c => categoryIds.includes(c.id));
      
      let created = 0;
      let updated = 0;
      
      // Build map for parent resolution
      const blingCatMap = new Map<number, typeof allCategories[0]>();
      allCategories.forEach(c => blingCatMap.set(c.id, c));
      const blingIdToLocalId: Record<number, number> = {};
      
      // Load existing categories
      const existingCategories = await storage.getCategories();
      existingCategories.forEach(c => {
        if (c.blingId) {
          blingIdToLocalId[c.blingId] = c.id;
        }
      });
      
      // Topological sort to process parents first
      const topologicalSort = (cats: typeof selectedCategories): typeof selectedCategories => {
        const sorted: typeof selectedCategories = [];
        const visited = new Set<number>();
        
        function visit(cat: typeof cats[0]) {
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
        
        cats.forEach(c => visit(c));
        return sorted;
      }
      
      const sortedCategories = topologicalSort(selectedCategories);
      
      for (const cat of sortedCategories) {
        const slug = cat.descricao
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || `cat-${cat.id}`;
        
        const parentBlingId = cat.categoriaPai?.id;
        const parentLocalId = parentBlingId ? blingIdToLocalId[parentBlingId] || null : null;
        
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
  });

  // Preview products from Bling (optionally filtered by category)
  app.get("/api/bling/products/preview", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allProducts: any[] = [];
      let page = 1;
      const limit = 100;
      
      // Fetch all product pages
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 600));
        const pageProducts = await blingService.fetchBlingProductsList(page, limit);
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
  });

  // Import selected Bling products
  app.post("/api/bling/products/import", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { productIds } = req.body;
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: "productIds é obrigatório" });
      }
      
      // Load category mappings
      const existingCategories = await storage.getCategories();
      const blingIdToCategoryId: Record<number, number> = {};
      const categoryMap: Record<string, number> = {};
      existingCategories.forEach(c => {
        categoryMap[c.name.toLowerCase()] = c.id;
        if (c.blingId) {
          blingIdToCategoryId[c.blingId] = c.id;
        }
      });
      
      let created = 0;
      let updated = 0;
      const errors: string[] = [];
      
      for (const productId of productIds) {
        await new Promise(resolve => setTimeout(resolve, 600));
        
        try {
          const blingProduct = await blingService.fetchBlingProductDetails(productId);
          if (!blingProduct) {
            errors.push(`Produto ${productId}: Falha ao buscar detalhes`);
            continue;
          }
          
          let categoryId: number | null = null;
          const blingCat = blingProduct.categoria;
          if (blingCat && blingCat.id) {
            categoryId = blingIdToCategoryId[blingCat.id] || null;
            if (!categoryId && blingCat.descricao) {
              categoryId = categoryMap[blingCat.descricao.toLowerCase()] || null;
            }
          }
          
          let imageUrl: string | null = null;
          if (blingProduct.imagens && blingProduct.imagens.length > 0) {
            const sortedImages = [...blingProduct.imagens].sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0));
            imageUrl = sortedImages[0]?.linkExterno || sortedImages[0]?.link || null;
          }
          if (!imageUrl && blingProduct.midia?.imagens?.externas?.[0]?.link) {
            imageUrl = blingProduct.midia.imagens.externas[0].link;
          }
          if (!imageUrl && blingProduct.midia?.imagens?.internas?.[0]?.link) {
            imageUrl = blingProduct.midia.imagens.internas[0].link;
          }
          
          const description = blingProduct.descricaoComplementar || blingProduct.descricaoCurta || null;
          const stock = blingProduct.estoque?.saldoVirtual ?? blingProduct.estoque?.saldoFisico ?? 0;
          
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
  });

  // ========== PDF GENERATION ==========
  
  // Helper function to draw standard PDF header
  function drawPdfHeader(doc: typeof PDFDocument.prototype, pdfType: string, orderNumber: string) {
    const titles: Record<string, string> = {
      separacao: 'PEDIDO - SEPARACAO',
      cobranca: 'PEDIDO - COBRANCA',
      conferencia: 'PEDIDO - CONFERENCIA'
    };
    
    doc.fontSize(14).font('Helvetica-Bold').text('LOJAMADRUGADAO SAO PAULO', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('CNPJ: 00.000.000/0001-00 | WhatsApp: (11) 99284-5596', { align: 'center' });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(16).font('Helvetica-Bold').text(`${titles[pdfType] || 'PEDIDO'}`, { align: 'center' });
    doc.fontSize(12).text(`N. ${orderNumber}`, { align: 'center' });
    doc.moveDown();
  }

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
      
      const pdfFileNames: Record<string, string> = {
        separacao: 'SEPARACAO',
        cobranca: 'COBRANCA',
        conferencia: 'CONFERENCIA'
      };

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      
      const fileName = `${pdfFileNames[pdfType] || 'PDF'}_Lote_${new Date().toISOString().slice(0,10)}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      doc.pipe(res);

      for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i];
        const orderDetails = await storage.getOrderWithDetails(parseInt(orderId));
        
        if (!orderDetails) continue;
        
        if (user?.role === 'customer' && orderDetails.order.userId !== userId) {
          continue;
        }

        const { order, items, customer } = orderDetails;

        if (i > 0) {
          doc.addPage();
        }

        // ========== PDF DE SEPARACAO ==========
        if (pdfType === 'separacao') {
          drawPdfHeader(doc, pdfType, order.orderNumber);
          
          // Info basica
          doc.fontSize(10).font('Helvetica');
          doc.text(`Cliente: ${customer?.tradingName || customer?.company || `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || '-'}`, 40);
          doc.text(`Data do Pedido: ${new Date(order.createdAt).toLocaleDateString('pt-BR')}`);
          if (order.notes) {
            doc.moveDown(0.3);
            doc.font('Helvetica-Bold').text('Obs: ', { continued: true });
            doc.font('Helvetica').text(order.notes);
          }
          doc.moveDown();

          // Tabela de itens
          doc.font('Helvetica-Bold').fontSize(10);
          doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown(0.3);

          const tableTop = doc.y;
          const colCheck = 40;
          const colImg = 65;
          const colCode = 115;
          const colProduct = 165;
          const colQty = 480;

          doc.text('OK', colCheck, tableTop);
          doc.text('Foto', colImg, tableTop);
          doc.text('SKU', colCode, tableTop);
          doc.text('Produto', colProduct, tableTop);
          doc.text('QTD', colQty, tableTop);

          doc.moveTo(40, doc.y + 3).lineTo(555, doc.y + 3).stroke();
          doc.moveDown(0.5);

          doc.font('Helvetica').fontSize(9);
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
                  doc.image(imgBuffer, colImg, rowY, { width: 22, height: imgHeight, fit: [22, imgHeight] });
                }
              } catch (e) {
                doc.rect(colImg, rowY, 22, imgHeight).stroke();
              }
            } else {
              doc.rect(colImg, rowY, 22, imgHeight).stroke();
            }
            
            doc.text(item.product?.sku || '-', colCode, rowY + 6, { width: 45 });
            doc.text(item.product?.name || `Produto #${item.productId}`, colProduct, rowY + 6, { width: 305 });
            
            // Quantidade em fonte grande e destacada
            doc.font('Helvetica-Bold').fontSize(12);
            doc.text(item.quantity.toString(), colQty, rowY + 4);
            doc.font('Helvetica').fontSize(9);

            doc.y = rowY + imgHeight + 3;
          }

          doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown();

          doc.font('Helvetica-Bold').fontSize(11);
          doc.text(`TOTAL DE ITENS: ${totalQty}`);
          
          // Rodape de separacao
          doc.moveDown(3);
          doc.fontSize(10).font('Helvetica');
          doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown(0.5);
          doc.text('Separado por: ________________________________     Data: ____/____/________');
        }

        // ========== PDF DE COBRANCA ==========
        else if (pdfType === 'cobranca') {
          drawPdfHeader(doc, pdfType, order.orderNumber);

          // Dados do cliente completos
          if (customer) {
            doc.fontSize(10).font('Helvetica-Bold').text('DADOS DO CLIENTE');
            doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
            doc.moveDown(0.3);

            doc.font('Helvetica');
            const col1X = 40;
            const col2X = 300;

            let y = doc.y;
            const clientName = customer.tradingName || customer.company || `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
            doc.text(`Cliente: ${clientName}`, col1X, y);
            
            y = doc.y + 3;
            if (customer.personType === 'juridica' && customer.cnpj) {
              doc.text(`CNPJ: ${customer.cnpj}`, col1X, y);
            } else if (customer.cpf) {
              doc.text(`CPF: ${customer.cpf}`, col1X, y);
            }
            if (customer.stateRegistration) {
              doc.text(`IE: ${customer.stateRegistration}`, col2X, y);
            }

            y = doc.y + 3;
            let addressLine = '';
            if (customer.address) {
              addressLine = customer.address;
              if (customer.addressNumber) addressLine += `, ${customer.addressNumber}`;
              if (customer.complement) addressLine += ` - ${customer.complement}`;
              if (customer.neighborhood) addressLine += ` - ${customer.neighborhood}`;
            }
            if (addressLine) {
              doc.text(`Endereco: ${addressLine}`, col1X, y);
            }

            y = doc.y + 3;
            if (customer.city || customer.state) {
              doc.text(`${customer.city || ''} - ${customer.state || ''}`, col1X, y);
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
          doc.font('Helvetica-Bold').fontSize(10);
          doc.text('ITENS DO PEDIDO');
          doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown(0.3);

          const tableTop = doc.y;
          const colCode = 40;
          const colProduct = 90;
          const colQty = 350;
          const colPrice = 410;
          const colSubtotal = 490;

          doc.text('SKU', colCode, tableTop);
          doc.text('Produto', colProduct, tableTop);
          doc.text('Qtd', colQty, tableTop);
          doc.text('Preco', colPrice, tableTop);
          doc.text('Subtotal', colSubtotal, tableTop);

          doc.moveTo(40, doc.y + 3).lineTo(555, doc.y + 3).stroke();
          doc.moveDown(0.5);

          doc.font('Helvetica').fontSize(9);
          let totalQty = 0;

          for (const item of items) {
            const itemSubtotal = parseFloat(item.price) * item.quantity;
            totalQty += item.quantity;

            if (doc.y > 680) {
              doc.addPage();
            }

            const rowY = doc.y;

            doc.text(item.product?.sku || '-', colCode, rowY, { width: 45 });
            doc.text(item.product?.name || `Produto #${item.productId}`, colProduct, rowY, { width: 255 });
            doc.text(item.quantity.toString(), colQty, rowY);
            doc.text(`R$ ${parseFloat(item.price).toFixed(2)}`, colPrice, rowY);
            doc.text(`R$ ${itemSubtotal.toFixed(2)}`, colSubtotal, rowY);

            doc.y = rowY + 15;
          }

          doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown();

          // Box de totais destacado
          doc.font('Helvetica').fontSize(10);
          doc.text(`Quantidade Total: ${totalQty} itens`, 40);
          doc.moveDown(0.5);

          const boxX = 350;
          const boxY = doc.y;
          const boxWidth = 205;
          const boxHeight = 70;
          
          doc.rect(boxX, boxY, boxWidth, boxHeight).stroke();
          
          doc.text(`Subtotal:`, boxX + 10, boxY + 8);
          doc.text(`R$ ${parseFloat(order.subtotal || '0').toFixed(2)}`, boxX + 120, boxY + 8);
          
          doc.text(`Frete:`, boxX + 10, boxY + 23);
          doc.text(`R$ ${parseFloat(order.shippingCost || '0').toFixed(2)}`, boxX + 120, boxY + 23);
          
          doc.moveTo(boxX + 5, boxY + 40).lineTo(boxX + boxWidth - 5, boxY + 40).stroke();
          
          doc.font('Helvetica-Bold').fontSize(12);
          doc.text(`TOTAL:`, boxX + 10, boxY + 48);
          doc.text(`R$ ${parseFloat(order.total).toFixed(2)}`, boxX + 100, boxY + 48);

          doc.y = boxY + boxHeight + 15;

          // Forma de pagamento
          if (order.paymentMethod || order.paymentNotes) {
            doc.font('Helvetica-Bold').fontSize(10).text('FORMA DE PAGAMENTO');
            doc.font('Helvetica').fontSize(9);
            if (order.paymentMethod) doc.text(order.paymentMethod);
            if (order.paymentNotes) doc.text(order.paymentNotes);
            doc.moveDown();
          }

          // Observacoes
          if (order.notes) {
            doc.font('Helvetica-Bold').fontSize(10).text('OBSERVACOES');
            doc.font('Helvetica').fontSize(9).text(order.notes);
            doc.moveDown();
          }

          // Rodape
          doc.moveDown();
          doc.fontSize(8).font('Helvetica');
          doc.text(`Emissao: ${new Date(order.createdAt).toLocaleDateString('pt-BR')} | Este documento nao e fiscal.`, { align: 'center' });
        }

        // ========== PDF DE CONFERENCIA ==========
        else if (pdfType === 'conferencia') {
          drawPdfHeader(doc, pdfType, order.orderNumber);
          
          // Info basica
          doc.fontSize(10).font('Helvetica');
          doc.text(`Cliente: ${customer?.tradingName || customer?.company || `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || '-'}`);
          doc.text(`Data do Pedido: ${new Date(order.createdAt).toLocaleDateString('pt-BR')}`);
          doc.moveDown();

          // Tabela com 3 colunas
          doc.font('Helvetica-Bold').fontSize(10);
          doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown(0.3);

          const tableTop = doc.y;
          const colImg = 40;
          const colCode = 90;
          const colProduct = 140;
          const colQtyPedido = 400;
          const colQtyConferido = 490;

          doc.text('Foto', colImg, tableTop);
          doc.text('SKU', colCode, tableTop);
          doc.text('Produto', colProduct, tableTop);
          doc.text('Qtd', colQtyPedido, tableTop);
          doc.text('Conferido', colQtyConferido, tableTop);

          doc.moveTo(40, doc.y + 3).lineTo(555, doc.y + 3).stroke();
          doc.moveDown(0.5);

          doc.font('Helvetica').fontSize(9);
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
                  doc.image(imgBuffer, colImg, rowY, { width: 22, height: imgHeight, fit: [22, imgHeight] });
                }
              } catch (e) {
                doc.rect(colImg, rowY, 22, imgHeight).stroke();
              }
            } else {
              doc.rect(colImg, rowY, 22, imgHeight).stroke();
            }

            doc.text(item.product?.sku || '-', colCode, rowY + 6, { width: 45 });
            doc.text(item.product?.name || `Produto #${item.productId}`, colProduct, rowY + 6, { width: 250 });
            
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text(item.quantity.toString(), colQtyPedido + 10, rowY + 6);
            doc.font('Helvetica').fontSize(9);
            
            // Campo vazio para preencher manualmente
            doc.rect(colQtyConferido, rowY + 2, 35, 16).stroke();

            doc.y = rowY + imgHeight + 3;
          }

          doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown();

          doc.font('Helvetica-Bold').fontSize(10);
          doc.text(`TOTAL DE ITENS: ${totalQty}`);

          // Observacoes do pedido
          if (order.notes) {
            doc.moveDown();
            doc.font('Helvetica-Bold').text('Observacoes do Pedido:');
            doc.font('Helvetica').fontSize(9).text(order.notes);
          }

          // Area de conferencia
          doc.moveDown(2);
          doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown(0.5);

          // Checkbox de conferencia
          doc.rect(40, doc.y, 15, 15).stroke();
          doc.font('Helvetica').fontSize(10).text('  Pedido conferido sem divergencias', 60, doc.y + 2);
          
          doc.moveDown(1.5);
          doc.text('Conferido por: ________________________________');
          doc.moveDown(0.5);
          doc.text('Data/Hora: ____/____/________ - ____:____');
          
          doc.moveDown(1.5);
          doc.fontSize(8).font('Helvetica-Bold');
          doc.text('ATENCAO: Somente apos a conferencia o pedido pode ser enviado.', { align: 'center' });
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
