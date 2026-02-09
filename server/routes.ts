import {
  categories,
  companies,
  orderItems,
  orders,
  paymentTerms,
  paymentTypes,
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
import { db } from "./db";
import { registerFinancialRoutes } from "./financialRoutes";
import { createPayableFromPurchaseOrder } from "./services/payables.service";
import { createReceivableFromOrder } from "./services/receivables.service";

// ✅ 1. FUNÇÃO AUXILIAR
function cleanDocument(doc: string | undefined | null) {
  if (!doc) return "";
  return doc.replace(/\D/g, "");
}

// Middleware para checar se usuário é superadmin
function requireSuperAdmin(req, res, next) {
  if (!req.isAuthenticated() || req.user.role !== "superadmin") {
    return res.status(403).json({ message: "Acesso restrito ao superadmin" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Listar todas as empresas (superadmin)
  app.get("/api/superadmin/companies", requireSuperAdmin, async (req, res) => {
    const result = await db
      .select()
      .from(companies)
      .orderBy(desc(companies.createdAt));
    res.json(result);
  });

  // Cadastrar nova empresa e admin inicial (superadmin)
  app.post("/api/superadmin/companies", requireSuperAdmin, async (req, res) => {
    try {
      const { company, admin } = req.body;
      if (!company || !admin)
        return res.status(400).json({ message: "Dados incompletos" });
      // Criar empresa
      const [newCompany] = await db
        .insert(companies)
        .values({
          ...company,
          createdAt: new Date(),
          updatedAt: new Date(),
          active: true,
          approvalStatus: "APROVADO",
          slug: company.fantasyName
            ? generateSlug(company.fantasyName)
            : undefined,
        })
        .returning();
      // Criar admin inicial
      const hashedPassword = await bcrypt.hash(admin.password || "123456", 10);
      const [newAdmin] = await db
        .insert(users)
        .values({
          ...admin,
          password: hashedPassword,
          companyId: newCompany.id,
          role: "admin",
          approved: true,
          createdAt: new Date(),
        })
        .returning();
      res.status(201).json({ company: newCompany, admin: newAdmin });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bloquear/desbloquear empresa (superadmin)
  app.patch(
    "/api/superadmin/companies/:id/block",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const { block } = req.body;
        const [updated] = await db
          .update(companies)
          .set({ active: !block, updatedAt: new Date() })
          .where(eq(companies.id, req.params.id))
          .returning();
        if (!updated)
          return res.status(404).json({ message: "Empresa não encontrada" });
        res.json(updated);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // Métricas globais (superadmin)
  app.get("/api/superadmin/metrics", requireSuperAdmin, async (req, res) => {
    try {
      const [{ totalEmpresas }] = await db
        .select({ totalEmpresas: sql`COUNT(*)` })
        .from(companies);
      const [{ totalProdutos }] = await db
        .select({ totalProdutos: sql`COUNT(*)` })
        .from(products);
      const [{ totalUsuarios }] = await db
        .select({ totalUsuarios: sql`COUNT(*)` })
        .from(users);
      res.json({ totalEmpresas, totalProdutos, totalUsuarios });
    } catch (error) {
      res.status(500).json({ message: error.message });
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

  // Login local com email/senha
  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email e senha são obrigatórios" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      const isValidPassword = await bcrypt.compare(
        password,
        user.password || "",
      );
      if (!isValidPassword) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      // Login usando Passport
      req.login(user, (err: any) => {
        if (err) {
          return res.status(500).json({ message: "Erro ao fazer login" });
        }
        res.json({
          user: { ...user, isB2bUser: true, nome: user.firstName },
          message: "Login realizado com sucesso",
        });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.logout(() => res.json({ message: "Logout efetuado" }));
  });

  // ==========================================
  // 🏢 EMPRESA
  // ==========================================

  // Função auxiliar para gerar slug
  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

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
      // Map client fields to DB columns (support multiple naming variations)
      if (req.body.name) updateData.razaoSocial = req.body.name;
      if (req.body.tradingName) {
        updateData.fantasyName = req.body.tradingName;
        updateData.nomeFantasia = req.body.tradingName;
      }
      if (req.body.fantasyName) updateData.fantasyName = req.body.fantasyName;
      if (req.body.nomeFantasia)
        updateData.nomeFantasia = req.body.nomeFantasia;

      const [first] = await db.select().from(companies).limit(1);
      let updated;
      if (first) {
        // Gerar slug baseado em razaoSocial ou fantasyName
        if (
          req.body.tradingName ||
          req.body.fantasyName ||
          req.body.name ||
          req.body.razaoSocial
        ) {
          const nameForSlug =
            req.body.tradingName ||
            req.body.fantasyName ||
            req.body.name ||
            req.body.razaoSocial ||
            first.razaoSocial ||
            first.fantasyName;
          updateData.slug = generateSlug(nameForSlug);
        }

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

  // Rota para listar vendedores (users com role 'sales' ou 'admin')
  app.get("/api/sellers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const companyId = req.user.companyId || "1";
      const result = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.companyId, companyId),
            sql`${users.role} IN ('sales', 'admin')`,
          ),
        )
        .orderBy(users.firstName);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Rota para listar empresas do usuário logado
  app.get("/api/user/companies", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const userCompanyId = req.user.companyId;
      // Por enquanto retorna apenas a empresa do usuário
      // Futuramente pode ser expandido para multi-company
      if (userCompanyId) {
        const result = await db
          .select()
          .from(companies)
          .where(eq(companies.id, userCompanyId));
        res.json(result);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
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

      // 🎯 AUTO-CRIAR PAYABLE se o pagamento for PRAZO
      try {
        const companyId = req.user.company;
        await createPayableFromPurchaseOrder(orderId, companyId);
        console.log(
          `[Financial] Payable auto-created for purchase order #${orderId}`,
        );
      } catch (error: any) {
        // Se não conseguir criar payable (ex: não é prazo), apenas ignora
        console.log(
          `[Financial] Could not auto-create payable for purchase order #${orderId}:`,
          error.message,
        );
      }

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
            accountsPosted: !!order.accountsPosted,
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

  // ==========================================
  // ROTAS ESPECÍFICAS (devem vir ANTES de :id)
  // ==========================================

  // GET: Lista pedidos guest da empresa autenticada
  app.get("/api/orders/guest", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const companyId = req.user.companyId || "1";
      const result = await db
        .select()
        .from(orders)
        .where(
          and(eq(orders.companyId, companyId), eq(orders.isGuestOrder, true)),
        )
        .orderBy(desc(orders.createdAt));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET: Contar pedidos guest não visualizados
  app.get("/api/orders/guest/count", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const companyId = req.user.companyId || "1";
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(
          and(eq(orders.companyId, companyId), eq(orders.isGuestOrder, true)),
        );
      res.json({ guestOrderCount: result[0]?.count || 0 });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // DEBUG: endpoint que ecoa os IDs enviados (sem tocar no BD)
  app.post("/api/orders/bulk/echo", async (req: any, res) => {
    if (!req.isAuthenticated())
      return res.status(401).json({ message: "Unauthorized" });
    try {
      const raw = req.body?.ids;
      let rawIds: any[] = [];
      if (Array.isArray(raw)) {
        rawIds = raw;
      } else if (raw && typeof raw === "object") {
        rawIds = Object.values(raw).map((v: any) => {
          if (v == null) return v;
          if (typeof v === "object")
            return v.id ?? v.orderId ?? v.orderNumber ?? v;
          return v;
        });
      } else if (typeof raw === "string") {
        rawIds = raw.split(",").map((s: string) => s.trim());
      }
      const parsedIds = rawIds
        .map((v: any) => (typeof v === "number" ? v : parseInt(String(v))))
        .filter((n: number) => Number.isInteger(n) && !Number.isNaN(n));
      res.json({ raw, rawIds, parsedIds });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // DELETE: Excluir Pedidos em Massa (bulk)
  app.delete("/api/orders/bulk", async (req: any, res) => {
    if (!req.isAuthenticated())
      return res.status(401).json({ message: "Unauthorized" });
    try {
      console.log(`[BULK DELETE] incoming ids raw:`, req.body?.ids);
      const raw = req.body?.ids;
      let rawIds: any[] = [];
      if (Array.isArray(raw)) {
        rawIds = raw;
      } else if (raw && typeof raw === "object") {
        rawIds = Object.values(raw).map((v: any) => {
          if (v == null) return v;
          if (typeof v === "object")
            return v.id ?? v.orderId ?? v.orderNumber ?? v;
          return v;
        });
      } else if (typeof raw === "string") {
        rawIds = raw.split(",").map((s: string) => s.trim());
      }
      const parsedIds = rawIds
        .map((v: any) => (typeof v === "number" ? v : parseInt(String(v))))
        .filter((n: number) => Number.isInteger(n) && !Number.isNaN(n));
      console.log(`[BULK DELETE] parsedIds:`, parsedIds);

      if (!parsedIds.length)
        return res.status(400).json({ message: "Nenhum ID válido informado" });

      const companyId = req.user.companyId || "1";
      const processed: number[] = [];
      const ignored: number[] = [];

      await db.transaction(async (tx) => {
        for (const id of parsedIds) {
          const [order] = await tx
            .select()
            .from(orders)
            .where(and(eq(orders.id, id), eq(orders.companyId, companyId)))
            .limit(1);
          if (!order) {
            ignored.push(id);
            continue;
          }

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
              await tx
                .update(products)
                .set({
                  stock: sql`${products.stock} + ${Number(item.quantity)}`,
                })
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
          processed.push(id);
        }
      });

      res.json({ message: "Pedidos processados.", processed, ignored });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST: Excluir Pedidos em Massa (bulk) - alternativa
  app.post("/api/orders/bulk", async (req: any, res) => {
    if (!req.isAuthenticated())
      return res.status(401).json({ message: "Unauthorized" });
    try {
      const raw = req.body?.ids;
      const reverseStock = req.body?.reverseStock !== false; // default true se não informado
      let rawIds: any[] = [];
      if (Array.isArray(raw)) {
        rawIds = raw;
      } else if (raw && typeof raw === "object") {
        rawIds = Object.values(raw).map((v: any) => {
          if (v == null) return v;
          if (typeof v === "object")
            return v.id ?? v.orderId ?? v.orderNumber ?? v;
          return v;
        });
      } else if (typeof raw === "string") {
        rawIds = raw.split(",").map((s: string) => s.trim());
      }
      const parsedIds = rawIds
        .map((v: any) => (typeof v === "number" ? v : parseInt(String(v))))
        .filter((n: number) => Number.isInteger(n) && !Number.isNaN(n));

      console.log(`[BULK POST] incoming ids raw:`, raw);
      console.log(`[BULK POST] parsedIds:`, parsedIds);
      console.log(`[BULK POST] reverseStock:`, reverseStock);

      if (!parsedIds.length)
        return res.status(400).json({ message: "Nenhum ID válido informado" });

      const companyId = req.user.companyId || "1";
      const processed: number[] = [];
      const ignored: number[] = [];
      const stockReversed: number[] = [];

      await db.transaction(async (tx) => {
        for (const id of parsedIds) {
          const [order] = await tx
            .select()
            .from(orders)
            .where(and(eq(orders.id, id), eq(orders.companyId, companyId)))
            .limit(1);
          if (!order) {
            ignored.push(id);
            continue;
          }

          const stockLogs = await tx
            .select()
            .from(stockMovements)
            .where(
              sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id} AND ${stockMovements.type} = 'OUT'`,
            );

          // Só estorna estoque se reverseStock=true E houver movimentações
          if (stockLogs.length > 0 && reverseStock) {
            const items = await tx
              .select()
              .from(orderItems)
              .where(eq(orderItems.orderId, id));
            for (const item of items) {
              await tx
                .update(products)
                .set({
                  stock: sql`${products.stock} + ${Number(item.quantity)}`,
                })
                .where(eq(products.id, item.productId));
            }
            await tx
              .delete(stockMovements)
              .where(
                sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id}`,
              );
            stockReversed.push(id);
          } else if (stockLogs.length > 0 && !reverseStock) {
            // Apenas remove os registros de movimento sem devolver estoque
            await tx
              .delete(stockMovements)
              .where(
                sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id}`,
              );
          }

          await tx.delete(orderItems).where(eq(orderItems.orderId, id));
          await tx.delete(orders).where(eq(orders.id, id));
          processed.push(id);
        }
      });

      res.json({
        message: "Pedidos processados.",
        processed,
        ignored,
        stockReversed,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // ROTAS PARAMETRIZADAS (devem vir DEPOIS)
  // ==========================================

  // 3. GET ID
  app.get("/api/orders/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const companyId = req.user.companyId || "1";
      // Busca primeiro sem filtro de company para debug
      let [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, parseInt(req.params.id)))
        .limit(1);

      // Se encontrou, verifica se pertence à company (ou não tem company definida)
      if (order && order.companyId && order.companyId !== companyId) {
        return res.status(404).json({ message: "Pedido não encontrado" });
      }

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

      // Verificar se o estoque foi lançado
      const [stockLog] = await db
        .select()
        .from(stockMovements)
        .where(
          sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${order.id} AND ${stockMovements.type} = 'OUT'`,
        )
        .limit(1);

      // Buscar vendedor se existir
      let seller = null;
      if (order.invoicedBy) {
        const [sellerUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, order.invoicedBy))
          .limit(1);
        seller = sellerUser || null;
      }

      res.json({
        ...order,
        items,
        customer,
        seller,
        stockPosted: !!stockLog,
        accountsPosted: !!order.accountsPosted,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 4. POST MANUAL STOCK (AÇÃO MANUAL)
  app.post("/api/orders/:id/stock", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);
    const { action } = req.body; // 'post' ou 'reverse'
    const companyId = req.user.companyId || "1";

    try {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, id),
              eq(orders.companyId, companyId), // ✅ VALIDAÇÃO ADICIONADA
            ),
          )
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
    const companyId = req.user.companyId || "1";
    try {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, id),
              eq(orders.companyId, companyId), // ✅ VALIDAÇÃO ADICIONADA
            ),
          )
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

      // 🎯 AUTO-CRIAR RECEIVABLE se o pagamento for PRAZO
      try {
        const companyId = req.user.companyId || "1";
        const userName = req.user.firstName || req.user.email || "Sistema";

        // Buscar o pedido para verificar forma de pagamento
        const [orderForReceivable] = await db
          .select()
          .from(orders)
          .where(eq(orders.id, id))
          .limit(1);

        console.log(
          `[Financial] Verificando receivable para pedido #${id}, paymentTypeId: ${orderForReceivable?.paymentTypeId}`,
        );

        if (!orderForReceivable?.paymentTypeId) {
          console.log(
            `[Financial] Pedido #${id} não tem forma de pagamento - receivable não criado`,
          );
        } else {
          const receivable = await createReceivableFromOrder(id, companyId);

          if (receivable) {
            // Marcar pedido como contas lançadas
            await db
              .update(orders)
              .set({
                accountsPosted: true,
                accountsPostedAt: new Date(),
                accountsPostedBy: userName,
              })
              .where(eq(orders.id, id));
            console.log(`[Financial] Receivable auto-created for order #${id}`);
          } else {
            console.log(
              `[Financial] Receivable não criado para pedido #${id} - provavelmente pagamento não é PRAZO`,
            );
          }
        }
      } catch (error: any) {
        // Se não conseguir criar receivable (ex: não é prazo), apenas ignora
        console.log(
          `[Financial] Could not auto-create receivable for order #${id}:`,
          error.message,
        );
      }

      res.json({ message: "Pedido faturado e estoque baixado." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 4.e POST: Unfaturar - retornar pedido faturado para pedido gerado (estorna estoque)
  app.post("/api/orders/:id/unfaturar", async (req: any, res) => {
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

        if (order.status !== "FATURADO") {
          throw new Error("Apenas pedidos faturados podem ser retornados.");
        }

        // Verificar se há movimentações de estoque para estornar
        const existingLogs = await tx
          .select()
          .from(stockMovements)
          .where(
            sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id} AND ${stockMovements.type} = 'OUT'`,
          );

        // Se houver movimentações, estorna o estoque
        if (existingLogs.length > 0) {
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

          // Remove as movimentações de estoque
          await tx
            .delete(stockMovements)
            .where(
              sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id}`,
            );
        }

        // Atualiza status para PEDIDO_GERADO
        await tx
          .update(orders)
          .set({ status: "PEDIDO_GERADO", updatedAt: new Date() })
          .where(eq(orders.id, id));
      });

      res.json({
        message: "Pedido retornado para Pedido Gerado e estoque estornado.",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 4.f POST: Lançar Contas - gera contas a receber manualmente
  app.post("/api/orders/:id/post-accounts", async (req: any, res) => {
    if (!req.isAuthenticated())
      return res.status(401).json({ message: "Não autenticado" });
    const id = parseInt(req.params.id);
    const companyId = req.user.companyId || "1";
    const userName = req.user.firstName || req.user.email || "Sistema";

    console.log(
      `[POST-ACCOUNTS] Iniciando lançamento de contas para pedido #${id}`,
    );

    try {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

      if (!order) {
        console.log(`[POST-ACCOUNTS] Pedido #${id} não encontrado`);
        return res.status(404).json({ message: "Pedido não encontrado" });
      }

      if (order.accountsPosted) {
        console.log(`[POST-ACCOUNTS] Pedido #${id} já tem contas lançadas`);
        return res.status(400).json({
          message: "Contas já foram lançadas para este pedido",
        });
      }

      // Verificar se tem forma de pagamento definida
      if (!order.paymentTypeId) {
        console.log(
          `[POST-ACCOUNTS] Pedido #${id} não tem forma de pagamento definida`,
        );
        return res.status(400).json({
          message:
            "O pedido não possui forma de pagamento definida. Edite o pedido e selecione uma forma de pagamento do tipo A PRAZO.",
        });
      }

      // Buscar forma de pagamento para verificar o tipo
      const [paymentType] = await db
        .select()
        .from(paymentTypes)
        .where(eq(paymentTypes.id, order.paymentTypeId))
        .limit(1);

      if (!paymentType) {
        console.log(
          `[POST-ACCOUNTS] Forma de pagamento ID ${order.paymentTypeId} não encontrada`,
        );
        return res.status(400).json({
          message:
            "A forma de pagamento selecionada não foi encontrada. Verifique as configurações.",
        });
      }

      if (paymentType.paymentTermType !== "PRAZO") {
        console.log(
          `[POST-ACCOUNTS] Forma de pagamento "${paymentType.name}" é ${paymentType.paymentTermType}, não é PRAZO`,
        );
        return res.status(400).json({
          message: `A forma de pagamento "${paymentType.name}" é do tipo À VISTA e não gera contas a receber. Selecione uma forma de pagamento do tipo A PRAZO.`,
        });
      }

      // Criar receivable
      const receivable = await createReceivableFromOrder(id, companyId);

      if (!receivable) {
        console.log(
          `[POST-ACCOUNTS] Falha ao criar receivable para pedido #${id}`,
        );
        return res.status(500).json({
          message:
            "Erro ao criar contas a receber. Verifique se a condição de pagamento está configurada corretamente.",
        });
      }

      // Marcar pedido como contas lançadas
      await db
        .update(orders)
        .set({
          accountsPosted: true,
          accountsPostedAt: new Date(),
          accountsPostedBy: userName,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, id));

      console.log(
        `[POST-ACCOUNTS] Contas lançadas com sucesso para pedido #${id}`,
      );

      res.json({
        message: "Contas a receber lançadas com sucesso",
        receivable,
      });
    } catch (error: any) {
      console.error(`[POST-ACCOUNTS] Erro para pedido #${id}:`, error);
      res.status(500).json({ message: error.message });
    }
  });

  // 4.g POST: Estornar Contas - cancela receivables do pedido
  app.post("/api/orders/:id/reverse-accounts", async (req: any, res) => {
    if (!req.isAuthenticated())
      return res.status(401).json({ message: "Não autenticado" });
    const id = parseInt(req.params.id);
    const userName = req.user.firstName || req.user.email || "Sistema";

    try {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

      if (!order) throw new Error("Pedido não encontrado");

      if (!order.accountsPosted) {
        throw new Error("Contas não foram lançadas para este pedido");
      }

      // Importar e usar a função de cancelamento
      const { cancelReceivablesByOrderId } =
        await import("./services/receivables.service");

      // Cancelar receivables do pedido
      const cancelled = await cancelReceivablesByOrderId(
        id,
        "Estorno de contas do pedido",
        userName,
      );

      // Marcar pedido como contas estornadas
      await db
        .update(orders)
        .set({
          accountsPosted: false,
          accountsReversedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, id));

      res.json({
        message: "Contas a receber estornadas com sucesso",
        cancelled,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 5. DELETE: Excluir Pedido (Proteção de Estoque)
  app.delete("/api/orders/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);
    const companyId = req.user.companyId || "1";
    try {
      await db.transaction(async (tx) => {
        // ✅ VALIDAÇÃO ADICIONADA
        const [order] = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, id), eq(orders.companyId, companyId)))
          .limit(1);

        if (!order) throw new Error("Pedido não encontrado");

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

  // 5.b PUT: Atualizar itens do pedido
  app.put("/api/orders/:id/items", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);
    const companyId = req.user.companyId || "1";
    const { items } = req.body;

    try {
      await db.transaction(async (tx) => {
        // Verificar se o pedido existe e pertence à empresa
        const [order] = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, id), eq(orders.companyId, companyId)))
          .limit(1);

        if (!order) throw new Error("Pedido não encontrado");

        // Verificar se tem estoque reservado - se tiver, não pode editar itens
        const stockLogs = await tx
          .select()
          .from(stockMovements)
          .where(
            sql`${stockMovements.refType} = 'SALES_ORDER' AND ${stockMovements.refId} = ${id} AND ${stockMovements.type} = 'OUT'`,
          );

        if (stockLogs.length > 0) {
          throw new Error(
            "Não é possível editar itens com estoque reservado. Retorne para Orçamento primeiro.",
          );
        }

        // Remover itens antigos
        await tx.delete(orderItems).where(eq(orderItems.orderId, id));

        // Inserir novos itens e calcular total
        let total = 0;
        for (const item of items) {
          const lineTotal = parseFloat(item.price) * item.quantity;
          total += lineTotal;
          await tx.insert(orderItems).values({
            orderId: id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            lineTotal: lineTotal.toFixed(2),
          });
        }

        // Atualizar total do pedido
        await tx
          .update(orders)
          .set({
            subtotal: total.toFixed(2),
            total: (total + parseFloat(order.shippingCost || "0")).toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, id));
      });

      res.json({ message: "Itens atualizados com sucesso." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 6. PATCH: Status Automático (Híbrido) - COM DEPURADOR
  app.patch("/api/orders/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const id = parseInt(req.params.id);
      const {
        status,
        printed,
        notes,
        shippingCost,
        discount,
        sellerId,
        saleDate,
        paymentMethod,
        paymentTypeId,
        paymentNotes,
      } = req.body;
      const companyId = req.user.companyId || "1";

      console.log(`[DEBUG] --- Iniciando atualização do Pedido #${id} ---`);
      console.log(`[DEBUG] Novo Status recebido: ${status}`);
      console.log(`[DEBUG] sellerId recebido: ${sellerId}`);
      console.log(
        `[DEBUG] req.body completo:`,
        JSON.stringify(req.body, null, 2),
      );

      await db.transaction(async (tx) => {
        // 1. Pega pedido atual
        const [currentOrder] = await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, id),
              eq(orders.companyId, companyId), // ✅ VALIDAÇÃO ADICIONADA
            ),
          )
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

        // 3. Atualiza status final e outros campos
        const updateData: any = { updatedAt: new Date() };
        if (status) updateData.status = status;
        if (printed !== undefined) updateData.printed = printed;
        if (notes !== undefined) updateData.notes = notes;
        if (shippingCost !== undefined) updateData.shippingCost = shippingCost;
        // paymentMethod - salvar mesmo se for string vazia
        if (paymentMethod !== undefined)
          updateData.paymentMethod = paymentMethod || null;
        // paymentTypeId - salvar ID da forma de pagamento
        if (paymentTypeId !== undefined)
          updateData.paymentTypeId = paymentTypeId || null;
        // paymentNotes - salvar condição de pagamento (ex: "30 60 90")
        if (paymentNotes !== undefined)
          updateData.paymentNotes = paymentNotes || null;
        // sellerId - salvar como invoicedBy (vendedor que faturou)
        if (sellerId !== undefined) {
          updateData.invoicedBy =
            sellerId && typeof sellerId === "string" && sellerId.trim() !== ""
              ? sellerId
              : null;
        }

        console.log(
          `[DEBUG] updateData sendo salvo:`,
          JSON.stringify(updateData, null, 2),
        );

        await tx.update(orders).set(updateData).where(eq(orders.id, id));
      });

      // ====================================================
      // LÓGICA DE CONTAS A RECEBER (Fora da transação de estoque)
      // ====================================================
      if (status === "FATURADO") {
        // Verificar se já tem contas a receber
        const hasReceivables = await hasReceivablesForOrder(id);
        if (!hasReceivables) {
          console.log(
            `[DEBUG] >> CRIANDO CONTAS A RECEBER para pedido #${id}...`,
          );
          try {
            const receivable = await createReceivableFromOrder(id, companyId);
            if (receivable) {
              console.log(
                `[DEBUG] >> Conta a receber criada: #${receivable.receivableNumber}`,
              );
            } else {
              console.log(
                `[DEBUG] >> Não foi criada conta a receber (provavelmente pagamento à vista)`,
              );
            }
          } catch (recError: any) {
            console.error(
              `[DEBUG] Erro ao criar conta a receber: ${recError.message}`,
            );
            // Não falha a operação principal, apenas loga o erro
          }
        } else {
          // Se já tem receivables canceladas, reabrir
          console.log(
            `[DEBUG] >> Pedido já tem contas a receber, verificando se precisa reabrir...`,
          );
          const reopened = await reopenReceivablesByOrderId(id);
          if (reopened.length > 0) {
            console.log(
              `[DEBUG] >> ${reopened.length} conta(s) a receber reaberta(s)`,
            );
          }
        }
      }

      // Estornar contas quando cancelar ou voltar para orçamento
      if (status === "CANCELADO" || status === "ORCAMENTO") {
        const hasReceivables = await hasReceivablesForOrder(id);
        if (hasReceivables) {
          console.log(
            `[DEBUG] >> ESTORNANDO CONTAS A RECEBER do pedido #${id}...`,
          );
          try {
            const cancelled = await cancelReceivablesByOrderId(
              id,
              `Pedido ${status === "CANCELADO" ? "cancelado" : "voltou para orçamento"}`,
              req.user.id,
            );
            console.log(
              `[DEBUG] >> ${cancelled.length} conta(s) a receber cancelada(s)`,
            );
          } catch (recError: any) {
            console.error(
              `[DEBUG] Erro ao cancelar contas a receber: ${recError.message}`,
            );
          }
        }
      }

      const [updated] = await db.select().from(orders).where(eq(orders.id, id));
      res.json(updated);
    } catch (error: any) {
      console.error("[DEBUG] ERRO CRÍTICO NA ROTA:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // 🔗 CATÁLOGO COMPARTILHÁVEL POR SLUG
  // ==========================================

  // GET: Informações da empresa por slug
  app.get("/api/catalogs/:slug/info", async (req, res) => {
    try {
      const { slug } = req.params;
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.slug, slug))
        .limit(1);

      if (!company) {
        return res.status(404).json({ message: "Catálogo não encontrado" });
      }

      res.json({
        id: company.id,
        name: company.razaoSocial || company.fantasyName,
        fantasyName: company.fantasyName,
        slug: company.slug,
        phone: company.phone || company.telefone,
        email: company.email,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET: Categorias por slug da empresa (público)
  app.get("/api/catalogs/:slug/categories", async (req, res) => {
    try {
      const { slug } = req.params;
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.slug, slug))
        .limit(1);

      if (!company) {
        return res.status(404).json({ message: "Catálogo não encontrado" });
      }

      const result = await db
        .select()
        .from(categories)
        .where(eq(categories.companyId, company.id));

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET: Produtos por slug da empresa (público)
  app.get("/api/catalogs/:slug/products", async (req, res) => {
    try {
      const { slug } = req.params;
      const { page = "1", limit = "24", categoryId, search } = req.query;

      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.slug, slug))
        .limit(1);

      if (!company) {
        return res.status(404).json({ message: "Catálogo não encontrado" });
      }

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, parseInt(limit as string) || 24);
      const offset = (pageNum - 1) * limitNum;

      let query = db
        .select()
        .from(products)
        .where(eq(products.companyId, company.id));

      // Filtro por categoria
      if (categoryId) {
        query = query.where(
          eq(products.categoryId, parseInt(categoryId as string)),
        );
      }

      // Filtro por busca
      if (search && typeof search === "string") {
        query = query.where(
          sql`(${products.name} ILIKE '%' || ${search} || '%' OR ${products.sku} ILIKE '%' || ${search} || '%')`,
        );
      }

      const total = await db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(eq(products.companyId, company.id));

      const countQuery = await query;
      const totalCount = countQuery.length;

      const result = await query
        .orderBy(desc(products.featured), desc(products.createdAt))
        .limit(limitNum)
        .offset(offset);

      const totalPages = Math.ceil(totalCount / limitNum);

      res.json({
        products: result,
        total: totalCount,
        page: pageNum,
        totalPages,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // 📋 CATÁLOGO PÚBLICO (SEM AUTENTICAÇÃO)
  // ==========================================

  // POST: Criar pedido guest (sem autenticação)
  app.post("/api/orders/guest/create", async (req, res) => {
    try {
      const {
        companySlug,
        items,
        guestName,
        guestEmail,
        guestPhone,
        guestCpf,
        shippingMethod,
        paymentMethod,
        notes,
        order_channel,
      } = req.body;

      if (!companySlug || !items || items.length === 0) {
        return res.status(400).json({
          message: "Slug da empresa e itens são obrigatórios",
        });
      }

      // Buscar empresa pelo slug
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.slug, companySlug))
        .limit(1);

      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }

      let subtotal = 0;
      const validatedItems = [];

      // Validar e calcular subtotal
      for (const item of items) {
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);

        if (!product || product.companyId !== company.id) {
          return res.status(400).json({
            message: `Produto ${item.productId} não encontrado neste catálogo`,
          });
        }

        const qty = parseInt(item.quantity) || 0;
        const price = parseFloat(product.price);
        subtotal += qty * price;

        validatedItems.push({
          productId: item.productId,
          quantity: qty,
          price: String(price),
          descriptionSnapshot: product.name,
          skuSnapshot: product.sku,
          lineTotal: String(qty * price),
        });
      }

      // Criar pedido no banco de dados
      const orderResult = await db.transaction(async (tx) => {
        const [newOrder] = await tx
          .insert(orders)
          .values({
            companyId: company.id,
            orderNumber: `GUEST-${Date.now()}`,
            status: "ORCAMENTO",
            isGuestOrder: true,
            guestName: guestName || "",
            guestEmail: guestEmail || "",
            guestPhone: guestPhone || "",
            guestCpf: guestCpf || "",
            subtotal: String(subtotal),
            shippingCost: "0",
            total: String(subtotal),
            shippingMethod: shippingMethod || "",
            paymentMethod: paymentMethod || "",
            notes: notes || "",
            createdAt: new Date(),
            updatedAt: new Date(),
            order_channel: order_channel || null,
          })
          .returning();

        // Inserir itens do pedido
        for (const item of validatedItems) {
          await tx.insert(orderItems).values({
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            descriptionSnapshot: item.descriptionSnapshot,
            skuSnapshot: item.skuSnapshot,
            lineTotal: item.lineTotal,
          });
        }

        return newOrder;
      });

      res.status(201).json({
        success: true,
        orderNumber: orderResult.orderNumber,
        message: "Orçamento criado com sucesso!",
      });
    } catch (error: any) {
      console.error("[GUEST ORDER]", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // 🌐 ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
  // ==========================================

  // GET: Categorias públicas
  app.get("/api/public/categories", async (_req, res) => {
    try {
      const result = await db
        .select()
        .from(categories)
        .orderBy(categories.name);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET: Produtos públicos
  app.get("/api/public/products", async (req, res) => {
    try {
      const { limit = "12", categoryId, search } = req.query;
      const limitNum = Math.min(100, parseInt(limit as string) || 12);

      let query = db.select().from(products);

      if (categoryId) {
        query = query.where(
          eq(products.categoryId, parseInt(categoryId as string)),
        );
      }

      if (search && typeof search === "string") {
        query = query.where(
          sql`(${products.name} ILIKE '%' || ${search} || '%' OR ${products.sku} ILIKE '%' || ${search} || '%')`,
        );
      }

      const result = await query
        .orderBy(desc(products.featured), desc(products.createdAt))
        .limit(limitNum);

      res.json({ products: result, total: result.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET: Configurações públicas (age verification popup, etc.)
  app.get("/api/settings/age_verification_popup", async (_req, res) => {
    try {
      // Retorna configuração padrão - pode ser customizado para ler do banco
      res.json({ enabled: false, minAge: 18 });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // 💳 TIPOS DE PAGAMENTO (PaymentTypes)
  // ==========================================

  // GET: Listar todos os tipos de pagamento
  app.get("/api/payment-types", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const companyId = req.user.companyId || "1";
      const result = await db
        .select()
        .from(paymentTypes)
        .where(eq(paymentTypes.companyId, companyId))
        .orderBy(paymentTypes.sortOrder, paymentTypes.name);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET: Listar tipos de pagamento ativos
  app.get("/api/payment-types/active", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const companyId = req.user.companyId || "1";
      const result = await db
        .select()
        .from(paymentTypes)
        .where(
          and(
            eq(paymentTypes.companyId, companyId),
            eq(paymentTypes.active, true),
          ),
        )
        .orderBy(paymentTypes.sortOrder, paymentTypes.name);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST: Criar tipo de pagamento
  app.post("/api/payment-types", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const companyId = req.user.companyId || "1";
      const [created] = await db
        .insert(paymentTypes)
        .values({
          companyId,
          name: req.body.name,
          type: req.body.type,
          description: req.body.description,
          active: req.body.active ?? true,
          feeType: req.body.feeType,
          feeValue: req.body.feeValue,
          compensationDays: req.body.compensationDays,
          isStoreCredit: req.body.isStoreCredit ?? false,
          paymentTermType: req.body.paymentTermType || "VISTA",
          paymentTermId: req.body.paymentTermId,
          sortOrder: req.body.sortOrder,
          createdAt: new Date(),
        })
        .returning();
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PATCH: Atualizar tipo de pagamento
  app.patch("/api/payment-types/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const id = parseInt(req.params.id);
      const companyId = req.user.companyId || "1";

      const updateData: any = { updatedAt: new Date() };
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.type !== undefined) updateData.type = req.body.type;
      if (req.body.description !== undefined)
        updateData.description = req.body.description;
      if (req.body.active !== undefined) updateData.active = req.body.active;
      if (req.body.feeType !== undefined) updateData.feeType = req.body.feeType;
      if (req.body.feeValue !== undefined)
        updateData.feeValue = req.body.feeValue;
      if (req.body.compensationDays !== undefined)
        updateData.compensationDays = req.body.compensationDays;
      if (req.body.isStoreCredit !== undefined)
        updateData.isStoreCredit = req.body.isStoreCredit;
      if (req.body.paymentTermType !== undefined)
        updateData.paymentTermType = req.body.paymentTermType;
      if (req.body.paymentTermId !== undefined)
        updateData.paymentTermId = req.body.paymentTermId;
      if (req.body.sortOrder !== undefined)
        updateData.sortOrder = req.body.sortOrder;

      const [updated] = await db
        .update(paymentTypes)
        .set(updateData)
        .where(
          and(eq(paymentTypes.id, id), eq(paymentTypes.companyId, companyId)),
        )
        .returning();

      if (!updated)
        return res
          .status(404)
          .json({ message: "Tipo de pagamento não encontrado" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // DELETE: Remover tipo de pagamento
  app.delete("/api/payment-types/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const id = parseInt(req.params.id);
      const companyId = req.user.companyId || "1";

      const [deleted] = await db
        .delete(paymentTypes)
        .where(
          and(eq(paymentTypes.id, id), eq(paymentTypes.companyId, companyId)),
        )
        .returning();

      if (!deleted)
        return res
          .status(404)
          .json({ message: "Tipo de pagamento não encontrado" });
      res.json({ message: "Tipo de pagamento removido com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ PAYMENT TERMS (Condições de Prazo) ============
  // GET: Listar condições de prazo
  app.get("/api/payment-terms", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const companyId = req.user.companyId || "1";
      const terms = await db
        .select()
        .from(paymentTerms)
        .where(eq(paymentTerms.companyId, companyId))
        .orderBy(paymentTerms.sortOrder);
      res.json(terms);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST: Criar tipos de pagamento padrão para a empresa
  app.post("/api/payment-types/seed-defaults", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const companyId = req.user.companyId || "1";

      // Verificar se já existem tipos para esta empresa
      const existing = await db
        .select()
        .from(paymentTypes)
        .where(eq(paymentTypes.companyId, companyId))
        .limit(1);

      if (existing.length > 0) {
        return res
          .status(400)
          .json({ message: "Já existem tipos de pagamento cadastrados" });
      }

      // 1. Criar condições de prazo padrão primeiro
      const defaultTerms = [
        {
          name: "30 dias (1x)",
          installmentCount: 1,
          firstPaymentDays: 30,
          intervalDays: 30,
        },
        {
          name: "30/60 dias (2x)",
          installmentCount: 2,
          firstPaymentDays: 30,
          intervalDays: 30,
        },
        {
          name: "30/60/90 dias (3x)",
          installmentCount: 3,
          firstPaymentDays: 30,
          intervalDays: 30,
        },
      ];

      const createdTerms = await db
        .insert(paymentTerms)
        .values(
          defaultTerms.map((t) => ({
            companyId,
            name: t.name,
            installmentCount: t.installmentCount,
            firstPaymentDays: t.firstPaymentDays,
            intervalDays: t.intervalDays,
            active: true,
            createdAt: new Date(),
          })),
        )
        .returning();

      // Pegar o ID da condição "30 dias (1x)" para vincular ao Boleto 30 dias
      const term30days = createdTerms.find((t) => t.name === "30 dias (1x)");

      // 2. Criar tipos padrão
      const defaults = [
        { name: "Dinheiro", paymentTermType: "VISTA", sortOrder: 1 },
        { name: "Pix", paymentTermType: "VISTA", sortOrder: 2 },
        { name: "Cartão de Débito", paymentTermType: "VISTA", sortOrder: 3 },
        { name: "Cartão de Crédito", paymentTermType: "VISTA", sortOrder: 4 },
        { name: "Boleto à Vista", paymentTermType: "VISTA", sortOrder: 5 },
        {
          name: "Boleto 30 dias",
          paymentTermType: "PRAZO",
          sortOrder: 6,
          paymentTermId: term30days?.id,
        },
        {
          name: "Fiado",
          paymentTermType: "PRAZO",
          sortOrder: 7,
          isStoreCredit: true,
        },
      ];

      const created = await db
        .insert(paymentTypes)
        .values(
          defaults.map((d) => ({
            companyId,
            name: d.name,
            paymentTermType: d.paymentTermType,
            sortOrder: d.sortOrder,
            paymentTermId: (d as any).paymentTermId || null,
            isStoreCredit: (d as any).isStoreCredit || false,
            active: true,
            createdAt: new Date(),
          })),
        )
        .returning();

      res
        .status(201)
        .json({ paymentTypes: created, paymentTerms: createdTerms });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // Registrar rotas financeiras
  registerFinancialRoutes(app);

  return httpServer;
}
