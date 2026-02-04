import {
  companies,
  orderItems,
  orders,
  products,
  purchaseOrderItems,
  purchaseOrders,
  stockMovements,
  suppliers,
  users,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { and, desc, eq, sql } from "drizzle-orm";
import { type Express } from "express";
import { type Server } from "http";
import multer from "multer";
import { db } from "./db";
import { setupAuth } from "./replitAuth";

// ✅ 1. FUNÇÃO AUXILIAR
function cleanDocument(doc: string | undefined | null) {
  if (!doc) return "";
  return doc.replace(/\D/g, "");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  await setupAuth(app);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  // --- HEALTH CHECK ---
  app.get("/api/health/db", async (_req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.json({ status: "ok", database: "connected" });
    } catch (error) {
      res.status(500).json({ status: "error" });
    }
  });

  // ==========================================
  // 🔐 AUTENTICAÇÃO (MANTIDO IGUAL)
  // ==========================================
  app.post("/api/auth/login", async (req: any, res, next) => {
    try {
      const { email, password } = req.body;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "Usuário não encontrado" });
      }

      let isValid = false;
      if (user.password) {
        isValid = await bcrypt
          .compare(password, user.password)
          .catch(() => false);
        if (!isValid && password === user.password) isValid = true;
      }

      if (!isValid) {
        return res.status(401).json({ message: "Senha incorreta" });
      }

      req.login(user, (err: any) => {
        if (err) return next(err);
        const userResponse = {
          ...user,
          isB2bUser: true,
          nome: user.firstName,
          company: user.company,
        };
        return res.json(userResponse);
      });
    } catch (error) {
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  });

  app.get("/api/auth/user", async (req: any, res) => {
    if (!req.isAuthenticated())
      return res.status(401).json({ message: "Não autenticado" });
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);
    if (!user)
      return res.status(404).json({ message: "Usuário não encontrado" });
    res.json({ ...user, isB2bUser: true, nome: user.firstName });
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.logout(() => res.json({ message: "Logout efetuado" }));
  });

  // ==========================================
  // 🏢 EMPRESA (MANTIDO IGUAL)
  // ==========================================
  app.get("/api/company/me", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const [company] = await db.select().from(companies).limit(1);
      if (!company)
        return res.status(404).json({ message: "Empresa não encontrada" });
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar empresa" });
    }
  });

  app.patch("/api/company/me", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const updateData = { ...req.body, updatedAt: new Date() };
      if (req.body.name) updateData.razaoSocial = req.body.name;

      const [first] = await db.select().from(companies).limit(1);
      let updated;
      if (first) {
        [updated] = await db
          .update(companies)
          .set(updateData)
          .where(eq(companies.id, first.id))
          .returning();
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Erro: " + error.message });
    }
  });

  // ==========================================
  // --- 👥 USUÁRIOS (MANTIDO IGUAL) ---
  // ==========================================
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const result = await db.select().from(users).orderBy(desc(users.createdAt));
    res.json(result);
  });

  app.post("/api/register", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const { password, ...body } = req.body;
      const hashedPassword = await bcrypt.hash(password || "123456", 10);

      const cleanData = { ...body };
      if (cleanData.cnpj) cleanData.cnpj = cleanDocument(cleanData.cnpj);
      if (cleanData.cpf) cleanData.cpf = cleanDocument(cleanData.cpf);

      const [newUser] = await db
        .insert(users)
        .values({
          ...cleanData,
          password: hashedPassword,
          companyId: req.user.companyId || "1",
          createdAt: new Date(),
        })
        .returning();

      res.status(201).json(newUser);
    } catch (error: any) {
      if (error.code === "23505") {
        return res
          .status(409)
          .json({ message: "Registro duplicado (Email, CPF ou CNPJ)." });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const { password, ...body } = req.body;
      const updateData: any = { ...body, updatedAt: new Date() };

      if (password && password.trim() !== "") {
        updateData.password = await bcrypt.hash(password, 10);
      }

      if (updateData.cnpj) updateData.cnpj = cleanDocument(updateData.cnpj);
      if (updateData.cpf) updateData.cpf = cleanDocument(updateData.cpf);

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, req.params.id))
        .returning();

      if (!updated)
        return res.status(404).json({ message: "Usuário não encontrado" });
      res.json(updated);
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(409).json({ message: "Conflito: Dado duplicado." });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/users/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    await db.delete(users).where(eq(users.id, req.params.id));
    res.json({ message: "Excluído" });
  });

  // ==========================================
  // --- 🚚 FORNECEDORES (MANTIDO IGUAL) ---
  // ==========================================
  app.get("/api/suppliers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const result = await db
      .select()
      .from(suppliers)
      .orderBy(desc(suppliers.id));
    res.json(result);
  });

  app.post("/api/suppliers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const doc = cleanDocument(req.body.cnpj || req.body.cpf);
      if (doc) {
        const existing = await db
          .select()
          .from(suppliers)
          .where(eq(suppliers.cnpj, doc))
          .limit(1);
        if (existing.length > 0)
          return res.status(409).json({ message: "Fornecedor já cadastrado." });
      }

      const [supplier] = await db
        .insert(suppliers)
        .values({
          ...req.body,
          companyId: req.user.companyId || "1",
        })
        .returning();
      res.status(201).json(supplier);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/suppliers/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const [updated] = await db
      .update(suppliers)
      .set(req.body)
      .where(eq(suppliers.id, parseInt(req.params.id)))
      .returning();
    res.json(updated);
  });

  app.delete("/api/suppliers/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    await db.delete(suppliers).where(eq(suppliers.id, parseInt(req.params.id)));
    res.json({ message: "Excluído" });
  });

  // ==========================================
  // --- 🛒 PRODUTOS (MANTIDO IGUAL) ---
  // ==========================================
  app.get("/api/products", async (req, res) => {
    const result = await db.select().from(products).orderBy(desc(products.id));
    const mapped = result.map((p) => ({
      ...p,
      nome: p.name,
      estoque: p.stock,
      precoVarejo: p.price,
      precoAtacado: p.cost,
    }));
    res.json({ products: mapped, total: result.length });
  });

  app.post("/api/products", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const [product] = await db
        .insert(products)
        .values({
          ...req.body,
          companyId: req.user.companyId || "1",
          stock: Number(req.body.stock || 0),
          price: String(req.body.price || "0"),
          cost: String(req.body.cost || "0"),
          // 🛡️ BLINDAGEM: Converte strings vazias para null ou número correto
          categoryId: req.body.categoryId ? Number(req.body.categoryId) : null,
          supplierId: req.body.supplierId ? Number(req.body.supplierId) : null,
          createdAt: new Date(),
        })
        .returning();
      res.status(201).json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/products/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const updateData = { ...req.body, updatedAt: new Date() };

      if (req.body.categoryId !== undefined) {
        updateData.categoryId = req.body.categoryId
          ? Number(req.body.categoryId)
          : null;
      }
      if (req.body.supplierId !== undefined) {
        updateData.supplierId = req.body.supplierId
          ? Number(req.body.supplierId)
          : null;
      }

      const [updated] = await db
        .update(products)
        .set(updateData)
        .where(eq(products.id, parseInt(req.params.id)))
        .returning();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/products/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    await db.delete(products).where(eq(products.id, parseInt(req.params.id)));
    res.json({ message: "Excluído" });
  });

  // ==========================================
  // --- 📦 PEDIDOS DE COMPRA (MANTIDO IGUAL) ---
  // ==========================================
  app.get("/api/purchases", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const result = await db
        .select({
          ...purchaseOrders,
          supplierName: suppliers.name,
          itemCount: sql<number>`count(${purchaseOrderItems.id})`.mapWith(
            Number,
          ),
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .leftJoin(
          purchaseOrderItems,
          eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId),
        )
        .groupBy(purchaseOrders.id, suppliers.name)
        .orderBy(desc(purchaseOrders.createdAt));

      res.json(result);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Erro ao listar pedidos: " + error.message });
    }
  });

  app.get("/api/purchases/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);
    try {
      const [order] = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, id))
        .limit(1);
      if (!order) return res.status(404).send();

      const items = await db
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, id));

      let supplier = null;
      if (order.supplierId) {
        [supplier] = await db
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, order.supplierId))
          .limit(1);
      }

      const movements = await db
        .select()
        .from(stockMovements)
        .where(
          sql`${stockMovements.refType} = 'PURCHASE_ORDER' AND ${stockMovements.refId} = ${id}`,
        )
        .orderBy(desc(stockMovements.createdAt));

      res.json({ order, items, supplier, movements });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/purchases", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const { items, supplierId, ...orderData } = req.body;

      const result = await db.transaction(async (tx) => {
        const [newOrder] = await tx
          .insert(purchaseOrders)
          .values({
            ...orderData,
            supplierId: supplierId ? Number(supplierId) : null,
            status: "DRAFT",
            number: orderData.number || `PC-${Date.now()}`,
            totalValue: String(orderData.totalValue || "0.00"),
          })
          .returning();

        if (items && items.length > 0) {
          const orderItemsData = items.map((item: any) => ({
            purchaseOrderId: newOrder.id,
            productId: Number(item.productId),
            qty: String(item.qty || "0"),
            unitCost: String(item.unitCost || "0.00"),
            sellPrice: String(item.sellPrice || "0.00"),
            lineTotal: String(
              (parseFloat(item.qty) || 0) * (parseFloat(item.unitCost) || 0),
            ),
            descriptionSnapshot: String(item.descriptionSnapshot || "Produto"),
            skuSnapshot: String(item.skuSnapshot || "N/A"),
          }));
          await tx.insert(purchaseOrderItems).values(orderItemsData);
        }
        return newOrder;
      });
      res.status(201).json(result);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Erro ao criar pedido: " + error.message });
    }
  });

  app.post("/api/purchases/:id/post-stock", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const orderId = parseInt(req.params.id);
    try {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.id, orderId))
          .limit(1);
        if (!order || order.status === "STOCK_POSTED")
          throw new Error("Pedido inválido ou já processado");

        const items = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

        if (items.length === 0) {
          throw new Error("Pedido não contém itens");
        }

        for (const item of items) {
          // Usar 'qty' se disponível, caso contrário 'quantity'
          const qtyStr = String(item.qty || item.quantity || "0");
          const qty = parseFloat(qtyStr);

          if (isNaN(qty) || qty <= 0) {
            console.warn(
              `[PURCHASE] Quantidade inválida para item ${item.id}: ${qtyStr}`,
            );
            throw new Error(
              `Quantidade inválida para produto ${item.productId}`,
            );
          }

          console.log(
            `[PURCHASE] Adicionando ${qty} unidades ao produto ${item.productId}`,
          );

          const unitCostStr = String(item.unitCost || "0");
          const unitCost = parseFloat(unitCostStr);

          const updateData: any = {
            stock: sql`COALESCE(${products.stock}, 0) + ${qty}`,
            updatedAt: new Date(),
          };

          if (unitCost > 0) {
            updateData.cost = unitCostStr;
          }

          await tx
            .update(products)
            .set(updateData)
            .where(eq(products.id, item.productId));

          await tx.insert(stockMovements).values({
            type: "IN",
            reason: "PURCHASE_POST",
            refType: "PURCHASE_ORDER",
            refId: orderId,
            productId: item.productId,
            qty: qtyStr,
            unitCost: unitCostStr,
            notes: `Entrada Pedido ${order.number}`,
          });
        }

        await tx
          .update(purchaseOrders)
          .set({ status: "STOCK_POSTED", postedAt: new Date() })
          .where(eq(purchaseOrders.id, orderId));

        console.log(
          `[PURCHASE] Estoque lançado com sucesso para pedido ${orderId}`,
        );
      });
      res.json({ message: "Estoque lançado com sucesso!" });
    } catch (error: any) {
      console.error(
        `[PURCHASE ERROR] Erro ao lançar estoque: ${error.message}`,
      );
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/purchases/:id/reverse-stock", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const orderId = parseInt(req.params.id);

    try {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.id, orderId))
          .limit(1);
        if (!order || order.status !== "STOCK_POSTED")
          throw new Error(
            "Apenas pedidos com estoque lançado podem ser estornados.",
          );

        const items = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

        for (const item of items) {
          // Usar 'qty' se disponível, caso contrário 'quantity'
          const qtyStr = String(item.qty || item.quantity || "0");
          const qty = parseFloat(qtyStr);

          if (isNaN(qty) || qty <= 0) {
            console.warn(
              `[PURCHASE REVERSE] Quantidade inválida para item ${item.id}: ${qtyStr}`,
            );
            throw new Error(
              `Quantidade inválida para produto ${item.productId}`,
            );
          }

          console.log(
            `[PURCHASE REVERSE] Removendo ${qty} unidades do produto ${item.productId}`,
          );

          await tx
            .update(products)
            .set({
              stock: sql`COALESCE(${products.stock}, 0) - ${qty}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId));

          await tx.insert(stockMovements).values({
            type: "OUT",
            reason: "PURCHASE_REVERSE",
            refType: "PURCHASE_ORDER",
            refId: orderId,
            productId: item.productId,
            qty: qtyStr,
            unitCost: String(item.unitCost || "0"),
            notes: `Estorno manual do pedido ${order.number}`,
          });
        }

        await tx
          .update(purchaseOrders)
          .set({ status: "DRAFT", postedAt: null })
          .where(eq(purchaseOrders.id, orderId));

        console.log(
          `[PURCHASE REVERSE] Estoque estornado com sucesso para pedido ${orderId}`,
        );
      });

      res.json({
        message: "Estoque estornado e pedido voltou para Rascunho.",
      });
    } catch (error: any) {
      console.error(
        `[PURCHASE REVERSE ERROR] Erro ao estornar estoque: ${error.message}`,
      );
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/purchases/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const orderId = parseInt(req.params.id);

    try {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.id, orderId))
          .limit(1);
        if (!order) throw new Error("Pedido não encontrado");

        if (order.status === "STOCK_POSTED") {
          const items = await tx
            .select()
            .from(purchaseOrderItems)
            .where(eq(purchaseOrderItems.purchaseOrderId, orderId));
          for (const item of items) {
            const qty = parseFloat(item.qty);
            await tx
              .update(products)
              .set({
                stock: sql`COALESCE(${products.stock}, 0) - ${qty}`,
                updatedAt: new Date(),
              })
              .where(eq(products.id, item.productId));
          }
        }

        await tx
          .delete(stockMovements)
          .where(
            sql`${stockMovements.refType} = 'PURCHASE_ORDER' AND ${stockMovements.refId} = ${orderId}`,
          );

        await tx
          .delete(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

        await tx.delete(purchaseOrders).where(eq(purchaseOrders.id, orderId));
      });

      res.json({ message: "Pedido excluído e estoque ajustado com sucesso." });
    } catch (error: any) {
      console.error("Erro Delete:", error);
      res.status(500).json({ message: "Erro ao excluir: " + error.message });
    }
  });

  // ==========================================
  // --- 🛍️ PEDIDOS DE VENDA (API REVISADA) ---
  // ==========================================

  // 1. GET: Listar Pedidos
  app.get("/api/orders", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const conditions = [eq(orders.companyId, req.user.companyId || "1")];
      if (req.user.role !== "admin" && req.user.role !== "sales") {
        conditions.push(eq(orders.userId, req.user.id));
      }
      const ordersList = await db
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(desc(orders.createdAt));

      const ordersWithDetails = await Promise.all(
        ordersList.map(async (order) => {
          const items = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, order.id));
          let customerName = "Cliente";
          if (order.userId) {
            const [customer] = await db
              .select()
              .from(users)
              .where(eq(users.id, order.userId));
            if (customer)
              customerName = customer.nome || customer.firstName || "Cliente";
          }

          // VERIFICA SE O ESTOQUE JÁ FOI BAIXADO (IMPORTANTE PARA OS BOTÕES)
          const [stockLog] = await db
            .select()
            .from(stockMovements)
            .where(
              sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${order.id} AND ${stockMovements.type} = 'OUT'`,
            )
            .limit(1);

          return {
            ...order,
            items,
            customerName,
            total: order.total || "0",
            stockPosted: !!stockLog,
          }; // Flag para o front
        }),
      );
      res.json(ordersWithDetails);
    } catch (error: any) {
      res.status(500).json({ message: "Erro: " + error.message });
    }
  });

  // 2. POST: Criar Pedido
  app.post("/api/orders", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const { items, ...orderData } = req.body;
      const result = await db.transaction(async (tx) => {
        const [newOrder] = await tx
          .insert(orders)
          .values({
            ...orderData,
            companyId: req.user.companyId || "1",
            orderNumber: String(Date.now()).slice(-6),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        if (items && items.length > 0) {
          const itemsToInsert = items.map((item: any) => ({
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            lineTotal: String(Number(item.price) * Number(item.quantity)),
          }));
          await tx.insert(orderItems).values(itemsToInsert);
        }
        return newOrder;
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Erro: " + error.message });
    }
  });

  // 3. GET ID
  app.get("/api/orders/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, parseInt(req.params.id)))
        .limit(1);
      if (!order)
        return res.status(404).json({ message: "Pedido não encontrado" });
      const items = await db
        .select({
          id: orderItems.id,
          productId: orderItems.productId,
          quantity: orderItems.quantity,
          price: orderItems.price,
          product: products,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, order.id));
      const [customer] = await db
        .select()
        .from(users)
        .where(eq(users.id, order.userId));
      res.json({ ...order, items, customer });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 4. POST MANUAL STOCK (AÇÃO MANUAL)
  app.post("/api/orders/:id/stock", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);
    const { action } = req.body; // 'post' ou 'reverse'

    try {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, id))
          .limit(1);
        if (!order) throw new Error("Pedido não encontrado");
        const items = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, id));

        const existingLogs = await tx
          .select()
          .from(stockMovements)
          .where(
            sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id} AND ${stockMovements.type} = 'OUT'`,
          );
        const alreadyPosted = existingLogs.length > 0;

        if (action === "post") {
          if (alreadyPosted) throw new Error("Estoque já baixado.");
          for (const item of items) {
            const qty = Number(item.quantity);
            await tx
              .update(products)
              .set({ stock: sql`${products.stock} - ${qty}` })
              .where(eq(products.id, item.productId));
            await tx.insert(stockMovements).values({
              type: "OUT",
              reason: "SALE_MANUAL",
              refType: "SALES_ORDER",
              refId: id,
              productId: item.productId,
              qty: String(qty),
              unitCost: "0",
              notes: `Baixa Manual Pedido #${order.orderNumber}`,
            });
          }
        } else if (action === "reverse") {
          if (!alreadyPosted) throw new Error("Não há estoque para estornar.");
          for (const item of items) {
            const qty = Number(item.quantity);
            await tx
              .update(products)
              .set({ stock: sql`${products.stock} + ${qty}` })
              .where(eq(products.id, item.productId));
          }
          await tx
            .delete(stockMovements)
            .where(
              sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id}`,
            );
        }
      });
      res.json({ message: "Movimentação realizada." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 4.b POST: Reserve (Endpoint esperado pelo cliente)
  app.post("/api/orders/:id/reserve", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);
    try {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, id))
          .limit(1);
        if (!order) throw new Error("Pedido não encontrado");

        const existingLogs = await tx
          .select()
          .from(stockMovements)
          .where(
            sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id} AND ${stockMovements.type} = 'OUT'`,
          );
        if (existingLogs.length > 0) throw new Error("Estoque já baixado.");

        const items = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, id));

        for (const item of items) {
          const qty = Number(item.quantity);
          await tx
            .update(products)
            .set({
              stock: sql`${products.stock} - ${qty}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId));

          await tx.insert(stockMovements).values({
            type: "OUT",
            reason: "SALE",
            refType: "SALES_ORDER",
            refId: id,
            productId: item.productId,
            qty: String(qty),
            unitCost: "0",
            notes: `Venda Pedido #${order.orderNumber}`,
          });
        }

        await tx
          .update(orders)
          .set({ status: "PEDIDO_GERADO", updatedAt: new Date() })
          .where(eq(orders.id, id));
      });
      res.json({ message: "Estoque reservado e pedido gerado." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 4.c POST: Unreserve (endpoint esperado pelo cliente)
  app.post("/api/orders/:id/unreserve", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);
    try {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, id))
          .limit(1);
        if (!order) throw new Error("Pedido não encontrado");

        const existingLogs = await tx
          .select()
          .from(stockMovements)
          .where(
            sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id} AND ${stockMovements.type} = 'OUT'`,
          );
        if (existingLogs.length === 0)
          throw new Error("Não há estoque para estornar.");

        const items = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, id));

        for (const item of items) {
          const qty = Number(item.quantity);
          await tx
            .update(products)
            .set({
              stock: sql`${products.stock} + ${qty}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId));
        }

        await tx
          .delete(stockMovements)
          .where(
            sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id}`,
          );

        await tx
          .update(orders)
          .set({ status: "ORCAMENTO", updatedAt: new Date() })
          .where(eq(orders.id, id));
      });
      res.json({
        message: "Pedido retornado para Orçamento e estoque liberado.",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 4.d POST: Invoice - faturar pedido (faz a baixa caso ainda não tenha sido feita)
  app.post("/api/orders/:id/invoice", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);
    try {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, id))
          .limit(1);
        if (!order) throw new Error("Pedido não encontrado");

        const existingLogs = await tx
          .select()
          .from(stockMovements)
          .where(
            sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id} AND ${stockMovements.type} = 'OUT'`,
          );
        const alreadyPosted = existingLogs.length > 0;

        if (!alreadyPosted) {
          const items = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, id));

          for (const item of items) {
            const qty = Number(item.quantity);
            await tx
              .update(products)
              .set({
                stock: sql`${products.stock} - ${qty}`,
                updatedAt: new Date(),
              })
              .where(eq(products.id, item.productId));

            await tx.insert(stockMovements).values({
              type: "OUT",
              reason: "SALE",
              refType: "SALES_ORDER",
              refId: id,
              productId: item.productId,
              qty: String(qty),
              unitCost: "0",
              notes: `Venda/Fatura Pedido #${order.orderNumber}`,
            });
          }
        }

        await tx
          .update(orders)
          .set({ status: "FATURADO", updatedAt: new Date() })
          .where(eq(orders.id, id));
      });
      res.json({ message: "Pedido faturado e estoque baixado." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 5. DELETE: Excluir Pedido (Proteção de Estoque)
  app.delete("/api/orders/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);
    try {
      await db.transaction(async (tx) => {
        const stockLogs = await tx
          .select()
          .from(stockMovements)
          .where(
            sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id} AND ${stockMovements.type} = 'OUT'`,
          );

        if (stockLogs.length > 0) {
          const items = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, id));
          for (const item of items) {
            const qty = Number(item.quantity);
            await tx
              .update(products)
              .set({ stock: sql`${products.stock} + ${qty}` })
              .where(eq(products.id, item.productId));
          }
          await tx
            .delete(stockMovements)
            .where(
              sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id}`,
            );
        }
        await tx.delete(orderItems).where(eq(orderItems.orderId, id));
        await tx.delete(orders).where(eq(orders.id, id));
      });
      res.json({ message: "Pedido excluído." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 6. PATCH: Status Automático (Híbrido) - COM DEPURADOR
  app.patch("/api/orders/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const id = parseInt(req.params.id);
      const { status, printed } = req.body;

      console.log(`[DEBUG] --- Iniciando atualização do Pedido #${id} ---`);
      console.log(`[DEBUG] Novo Status recebido: ${status}`);

      await db.transaction(async (tx) => {
        // 1. Pega pedido atual
        const [currentOrder] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, id))
          .limit(1);
        if (!currentOrder) throw new Error("Pedido não encontrado");

        console.log(`[DEBUG] Status Antigo: ${currentOrder.status}`);

        // 2. Verifica histórico de estoque
        const stockLogs = await tx
          .select()
          .from(stockMovements)
          .where(
            sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id} AND ${stockMovements.type} = 'OUT'`,
          );

        const isStockPosted = stockLogs.length > 0;
        console.log(
          `[DEBUG] Estoque já foi baixado antes? ${isStockPosted ? "SIM" : "NÃO"}`,
        );

        // ====================================================
        // LÓGICA DE VENDA (Baixar Estoque)
        // ====================================================
        const targetStatusVenda = ["PEDIDO_GERADO", "FATURADO"];

        if (targetStatusVenda.includes(status) && !isStockPosted) {
          console.log(`[DEBUG] >> ENTRANDO NO MODO BAIXA DE ESTOQUE...`);

          const items = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, id));
          console.log(
            `[DEBUG] Itens encontrados neste pedido: ${items.length}`,
          );

          if (items.length === 0) {
            console.log(
              `[DEBUG] ERRO: Pedido não tem itens vinculados na tabela order_items!`,
            );
          }

          for (const item of items) {
            const qty = Number(item.quantity);
            console.log(
              `[DEBUG] Baixando Produto ID ${item.productId}: -${qty}`,
            );

            // ATUALIZAÇÃO DO PRODUTO
            await tx
              .update(products)
              .set({
                stock: sql`${products.stock} - ${qty}`,
                updatedAt: new Date(),
              })
              .where(eq(products.id, item.productId));

            // LOG DO MOVIMENTO
            await tx.insert(stockMovements).values({
              type: "OUT",
              reason: "SALE",
              refType: "SALES_ORDER",
              refId: id,
              productId: item.productId,
              qty: String(qty),
              unitCost: "0",
              notes: `Venda Automática Pedido #${currentOrder.orderNumber}`,
            });
          }
          console.log(`[DEBUG] >> Baixa concluída.`);
        } else if (targetStatusVenda.includes(status) && isStockPosted) {
          console.log(
            `[DEBUG] IGNORADO: O status mudou para venda, mas o estoque JÁ ESTAVA baixado.`,
          );
        }

        // ====================================================
        // LÓGICA DE ESTORNO (Devolver Estoque)
        // ====================================================
        const targetStatusEstorno = ["CANCELADO", "ORCAMENTO"];

        if (targetStatusEstorno.includes(status) && isStockPosted) {
          console.log(`[DEBUG] >> ENTRANDO NO MODO ESTORNO...`);

          const items = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, id));
          for (const item of items) {
            const qty = Number(item.quantity);
            console.log(
              `[DEBUG] Devolvendo Produto ID ${item.productId}: +${qty}`,
            );

            await tx
              .update(products)
              .set({
                stock: sql`${products.stock} + ${qty}`,
                updatedAt: new Date(),
              })
              .where(eq(products.id, item.productId));
          }
          // Limpa o log para permitir baixar de novo depois
          await tx
            .delete(stockMovements)
            .where(
              sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id}`,
            );
          console.log(`[DEBUG] >> Estorno concluído.`);
        }

        // 3. Atualiza status final
        const updateData: any = { updatedAt: new Date() };
        if (status) updateData.status = status;
        if (printed !== undefined) updateData.printed = printed;
        await tx.update(orders).set(updateData).where(eq(orders.id, id));
      });

      const [updated] = await db.select().from(orders).where(eq(orders.id, id));
      res.json(updated);
    } catch (error: any) {
      console.error("[DEBUG] ERRO CRÍTICO NA ROTA:", error);
      res.status(500).json({ message: error.message });
    }
  });
  return httpServer;
}
