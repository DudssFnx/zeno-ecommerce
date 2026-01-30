import {
  companies,
  products,
  purchaseOrderItems,
  purchaseOrders,
  stockMovements,
  suppliers,
  users,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { desc, eq, sql } from "drizzle-orm";
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
  // 🔐 AUTENTICAÇÃO
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
  // 🏢 EMPRESA
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
  // --- 👥 USUÁRIOS ---
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
  // --- 🚚 FORNECEDORES ---
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
          companyId: Number(req.user.companyId || 1),
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
  // --- 🛒 PRODUTOS ---
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
          companyId: req.user.companyId || 1,
          stock: Number(req.body.stock || 0),
          price: String(req.body.price || "0"),
          cost: String(req.body.cost || "0"),
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
      const [updated] = await db
        .update(products)
        .set({ ...req.body, updatedAt: new Date() })
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
  // --- 📦 PEDIDOS DE COMPRA (COMPLETO) ---
  // ==========================================

  // 1. GET: Com JOIN para trazer nome do fornecedor e contagem
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

  // 2. GET ID: Detalhes
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

  // 3. POST: CRIAÇÃO DE PEDIDO
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

  // 4. POST STOCK: LANÇAR ESTOQUE (COM COALESCE PARA NÃO FALHAR)
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

        for (const item of items) {
          const qty = parseFloat(item.qty);
          // COALESCE garante soma correta mesmo se estoque for null
          const updateData: any = {
            stock: sql`COALESCE(${products.stock}, 0) + ${qty}`,
            updatedAt: new Date(),
          };
          if (parseFloat(item.unitCost) > 0)
            updateData.cost = String(item.unitCost);
          if (parseFloat(item.sellPrice) > 0)
            updateData.price = String(item.sellPrice);

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
            qty: String(item.qty),
            unitCost: String(item.unitCost),
            notes: `Entrada Pedido ${order.number}`,
          });
        }
        await tx
          .update(purchaseOrders)
          .set({ status: "STOCK_POSTED", postedAt: new Date() })
          .where(eq(purchaseOrders.id, orderId));
      });
      res.json({ message: "Estoque lançado com sucesso!" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ✅ 4.1. REVERSE STOCK: ESTORNO SEM EXCLUIR (VOLTAR P/ RASCUNHO)
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
          const qty = parseFloat(item.qty);
          // Subtrai do estoque
          await tx
            .update(products)
            .set({
              stock: sql`COALESCE(${products.stock}, 0) - ${qty}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId));

          // Registra saída
          await tx.insert(stockMovements).values({
            type: "OUT",
            reason: "PURCHASE_REVERSE",
            refType: "PURCHASE_ORDER",
            refId: orderId,
            productId: item.productId,
            qty: String(item.qty),
            unitCost: String(item.unitCost),
            notes: `Estorno manual do pedido ${order.number}`,
          });
        }

        // Volta status para DRAFT e limpa data
        await tx
          .update(purchaseOrders)
          .set({ status: "DRAFT", postedAt: null })
          .where(eq(purchaseOrders.id, orderId));
      });

      res.json({ message: "Estoque estornado e pedido voltou para Rascunho." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ✅ 5. DELETE PURCHASE: CORRIGIDO (LIMPA VÍNCULOS ANTES)
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

        // Se o estoque já foi lançado, ESTORNAR
        if (order.status === "STOCK_POSTED") {
          const items = await tx
            .select()
            .from(purchaseOrderItems)
            .where(eq(purchaseOrderItems.purchaseOrderId, orderId));
          for (const item of items) {
            const qty = parseFloat(item.qty);
            // Subtrai do estoque
            await tx
              .update(products)
              .set({
                stock: sql`COALESCE(${products.stock}, 0) - ${qty}`,
                updatedAt: new Date(),
              })
              .where(eq(products.id, item.productId));
          }
        }

        // 🛑 LIMPEZA IMPORTANTE: Apaga os movimentos de estoque ANTES de apagar o pedido
        await tx
          .delete(stockMovements)
          .where(
            sql`${stockMovements.refType} = 'PURCHASE_ORDER' AND ${stockMovements.refId} = ${orderId}`,
          );

        // Apaga os itens
        await tx
          .delete(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

        // Apaga o pedido
        await tx.delete(purchaseOrders).where(eq(purchaseOrders.id, orderId));
      });

      res.json({ message: "Pedido excluído e estoque ajustado com sucesso." });
    } catch (error: any) {
      console.error("Erro Delete:", error);
      res.status(500).json({ message: "Erro ao excluir: " + error.message });
    }
  });

  return httpServer;
}
