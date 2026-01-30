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
    const userCompanyId = req.user.companyId;

    try {
      let company;
      if (userCompanyId) {
        const targetId = String(userCompanyId).trim();
        [company] = await db
          .select()
          .from(companies)
          .where(sql`${companies.id}::text = ${targetId}`)
          .limit(1);
      }
      if (!company) {
        const [firstCompany] = await db.select().from(companies).limit(1);
        company = firstCompany;
      }
      if (!company) {
        return res
          .status(404)
          .json({ message: "Nenhuma empresa cadastrada no sistema." });
      }

      const companyFrontend = {
        ...company,
        id: company.id,
        name: company.razaoSocial || company.name || "Minha Empresa",
        tradingName:
          company.nomeFantasia || company.tradingName || "Nome Fantasia",
        cnpj: company.cnpj,
        email: company.email,
        phone: company.telefone || company.phone,
        address: company.endereco || company.address,
        number: company.numero || company.number,
        complement: company.complemento || company.complement,
        neighborhood: company.bairro || company.neighborhood,
        city: company.cidade || company.city,
        state: company.estado || company.state,
        cep: company.cep,
        isActive: company.ativo,
        logoUrl: company.logoUrl || "",
        primaryColor: company.primaryColor || "#000000",
      };
      res.json(companyFrontend);
    } catch (error) {
      res.status(500).json({ message: "Erro interno ao buscar empresa" });
    }
  });

  app.patch("/api/company/me", async (req: any, res) => {
    if (!req.isAuthenticated())
      return res.status(401).json({ message: "Sessão expirada." });
    const userCompanyId = req.user.companyId;

    try {
      const updateData: any = { ...req.body, updatedAt: new Date() };
      if (req.body.name) updateData.razaoSocial = req.body.name;
      if (req.body.tradingName) updateData.nomeFantasia = req.body.tradingName;
      if (req.body.address) updateData.endereco = req.body.address;
      if (req.body.city) updateData.cidade = req.body.city;

      delete updateData.name;
      delete updateData.tradingName;
      delete updateData.address;
      delete updateData.city;

      let targetId = String(userCompanyId).trim();
      let [updated] = await db
        .update(companies)
        .set(updateData)
        .where(sql`${companies.id}::text = ${targetId}`)
        .returning();

      if (!updated) {
        const [first] = await db.select().from(companies).limit(1);
        if (first) {
          [updated] = await db
            .update(companies)
            .set(updateData)
            .where(eq(companies.id, first.id))
            .returning();
        }
      }

      if (!updated)
        return res.status(404).json({ message: "Empresa não encontrada." });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Erro interno: " + error.message });
    }
  });

  // ==========================================
  // --- 👥 USUÁRIOS E CLIENTES ---
  // ==========================================
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const result = await db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt));
      // Tradução
      const mapped = result.map((u) => ({
        ...u,
        nome: u.firstName,
        razaoSocial: u.company,
      }));
      res.json(mapped);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  // ✅ POST REGISTER: COM TRATAMENTO DE ERRO AMIGÁVEL
  app.post("/api/register", async (req: any, res) => {
    if (!req.isAuthenticated())
      return res.status(401).json({ message: "Não autorizado" });
    try {
      const { email, password } = req.body;
      const userCompanyId = String(req.user.companyId || "1");
      const hashedPassword = await bcrypt.hash(password || "123456", 10);

      // Limpeza
      const cleanData = { ...req.body };
      if (cleanData.cnpj) cleanData.cnpj = cleanDocument(cleanData.cnpj);
      if (cleanData.cpf) cleanData.cpf = cleanDocument(cleanData.cpf);

      const [newUser] = await db
        .insert(users)
        .values({
          ...cleanData,
          password: hashedPassword,
          role: "customer",
          companyId: userCompanyId,
          approved: true,
          createdAt: new Date(),
        })
        .returning();

      res.status(201).json(newUser);
    } catch (error: any) {
      // 🛑 Captura erro de duplicidade e devolve 409
      if (error.code === "23505") {
        let msg = "Este registro já existe.";
        if (error.detail?.includes("email"))
          msg = "Este e-mail já está em uso.";
        else if (error.detail?.includes("cnpj"))
          msg = "Este CNPJ já está cadastrado.";
        else if (error.detail?.includes("cpf"))
          msg = "Este CPF já está cadastrado.";

        return res.status(409).json({ message: msg });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // ✅ PATCH USER: COM TRATAMENTO DE ERRO AMIGÁVEL
  app.patch("/api/users/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = req.params.id;
    try {
      const body = req.body;
      const updateData: any = { updatedAt: new Date() };

      if (body.firstName) updateData.firstName = body.firstName;
      if (body.lastName) updateData.lastName = body.lastName;
      if (body.email) updateData.email = body.email;
      if (body.phone) updateData.phone = body.phone;
      if (body.company) updateData.company = body.company;
      if (body.tradingName) updateData.tradingName = body.tradingName;
      if (body.customerType) updateData.customerType = body.customerType;

      if (body.cep) updateData.cep = body.cep;
      if (body.address) updateData.address = body.address;
      if (body.addressNumber) updateData.addressNumber = body.addressNumber;
      if (body.complement) updateData.complement = body.complement;
      if (body.neighborhood) updateData.neighborhood = body.neighborhood;
      if (body.city) updateData.city = body.city;
      if (body.state) updateData.state = body.state;

      if (body.approved !== undefined) updateData.approved = body.approved;
      if (body.ativo !== undefined) updateData.ativo = body.ativo;

      if (body.cnpj) updateData.cnpj = cleanDocument(body.cnpj);
      if (body.cpf) updateData.cpf = cleanDocument(body.cpf);
      if (body.stateRegistration)
        updateData.stateRegistration = body.stateRegistration;

      if (body.password && body.password.trim() !== "") {
        updateData.password = await bcrypt.hash(body.password, 10);
      }

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();

      if (!updated)
        return res.status(404).json({ message: "Usuário não encontrado" });

      res.json(updated);
    } catch (error: any) {
      // 🛑 Captura erro de duplicidade na edição
      if (error.code === "23505") {
        let msg = "Conflito de dados.";
        if (error.detail?.includes("email"))
          msg = "Este e-mail já pertence a outro usuário.";
        else if (error.detail?.includes("cnpj"))
          msg = "Este CNPJ já pertence a outro usuário.";
        else if (error.detail?.includes("cpf"))
          msg = "Este CPF já pertence a outro usuário.";

        return res.status(409).json({ message: msg });
      }
      res.status(500).json({ message: "Erro interno: " + error.message });
    }
  });

  app.delete("/api/users/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      await db.delete(users).where(eq(users.id, req.params.id));
      res.json({ message: "Excluído" });
    } catch (error) {
      res.status(500).send();
    }
  });

  // ==========================================
  // --- 🚚 FORNECEDORES (BLINDADO) ---
  // ==========================================
  app.get("/api/suppliers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const userCompanyId = req.user.companyId ? Number(req.user.companyId) : 1;
    const safeCompanyId = isNaN(userCompanyId) ? 1 : userCompanyId;

    try {
      const result = await db
        .select()
        .from(suppliers)
        .where(
          sql`${suppliers.companyId} = ${safeCompanyId} OR ${suppliers.companyId} IS NULL`,
        )
        .orderBy(desc(suppliers.id));
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar fornecedores" });
    }
  });

  // ✅ POST FORNECEDORES
  app.post("/api/suppliers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();

    const docInput = cleanDocument(req.body.cnpj || req.body.cpf);
    const userCompanyId = req.user.companyId || "1";

    const { id, ...supplierData } = req.body;

    try {
      const allSuppliers = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.companyId, Number(userCompanyId)));

      if (docInput) {
        const existing = allSuppliers.find((s) => {
          const sDoc = cleanDocument(s.cnpj || s.cpf || "");
          return sDoc === docInput;
        });

        if (existing) {
          return res.status(409).json({
            message: `Este CNPJ já está cadastrado para o fornecedor "${existing.name}".`,
          });
        }
      }

      const [supplier] = await db
        .insert(suppliers)
        .values({
          ...supplierData,
          companyId: Number(userCompanyId),
        })
        .returning();

      res.status(201).json(supplier);
    } catch (error: any) {
      if (error.code === "23505") {
        return res
          .status(409)
          .json({ message: "Este CNPJ já está cadastrado no sistema." });
      }
      res.status(500).json({ message: "Erro interno no servidor." });
    }
  });

  app.patch("/api/suppliers/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const [updated] = await db
        .update(suppliers)
        .set(req.body)
        .where(eq(suppliers.id, parseInt(req.params.id)))
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
        .where(eq(suppliers.id, parseInt(req.params.id)));
      res.json({ message: "Excluído" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir" });
    }
  });

  // ==========================================
  // --- 🛒 PRODUTOS (COM TRADUÇÃO) ---
  // ==========================================
  app.get("/api/products", async (req, res) => {
    try {
      const result = await db
        .select()
        .from(products)
        .orderBy(desc(products.id));

      const mappedProducts = result.map((p) => ({
        ...p,
        nome: p.name,
        estoque: p.stock,
        precoVarejo: p.price,
        precoAtacado: p.cost,
        descricao: p.description,
        imagem: p.image,
      }));

      res.json({ products: mappedProducts, total: result.length });
    } catch (error) {
      res.status(500).send("Erro ao listar produtos");
    }
  });

  app.post("/api/products", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();

    try {
      const name = req.body.name || req.body.nome;
      const newProductData: any = {
        companyId: req.user.companyId || 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        name: name,
        description: req.body.description || req.body.descricao,
        sku: req.body.sku,
        stock: Number(req.body.stock || req.body.estoque || 0),
        price: String(req.body.price || req.body.precoVarejo || "0.00"),
        cost: String(req.body.cost || req.body.precoAtacado || "0.00"),
        brand: req.body.brand,
        categoryId: req.body.categoryId,
        image: req.body.image || req.body.imagem,
        images: req.body.images,
        featured: req.body.featured,
        weight: req.body.weight ? String(req.body.weight) : null,
        width: req.body.width ? String(req.body.width) : null,
        height: req.body.height ? String(req.body.height) : null,
        depth: req.body.depth ? String(req.body.depth) : null,
        ncm: req.body.ncm,
        cest: req.body.cest,
        origem: req.body.taxOrigin,
      };

      const [product] = await db
        .insert(products)
        .values(newProductData)
        .returning();

      res.status(201).json(product);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Erro ao criar produto: " + error.message });
    }
  });

  app.patch("/api/products/:id", async (req: any, res) => {
    if (!req.isAuthenticated())
      return res.status(401).json({ message: "Não autenticado" });
    const id = parseInt(req.params.id);
    try {
      const updateData: any = { updatedAt: new Date() };

      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.nome !== undefined) updateData.name = req.body.nome;
      if (req.body.description !== undefined)
        updateData.description = req.body.description;
      if (req.body.sku !== undefined) updateData.sku = req.body.sku;
      if (req.body.stock !== undefined)
        updateData.stock = Number(req.body.stock);
      if (req.body.price !== undefined)
        updateData.price = String(req.body.price);
      if (req.body.cost !== undefined) updateData.cost = String(req.body.cost);

      const [updated] = await db
        .update(products)
        .set(updateData)
        .where(eq(products.id, id))
        .returning();

      if (!updated)
        return res.status(404).json({ message: "Produto não encontrado" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Erro interno ao atualizar produto" });
    }
  });

  app.delete("/api/products/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      await db.delete(products).where(eq(products.id, parseInt(req.params.id)));
      res.json({ message: "Produto excluído" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir produto" });
    }
  });

  // ==========================================
  // --- 📦 PEDIDOS ---
  // ==========================================
  app.get("/api/purchases", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const orders = await db
      .select()
      .from(purchaseOrders)
      .orderBy(desc(purchaseOrders.createdAt));
    res.json(orders);
  });

  app.post("/api/purchases", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const { items, ...orderData } = req.body;
      const result = await db.transaction(async (tx) => {
        const [newOrder] = await tx
          .insert(purchaseOrders)
          .values({
            ...orderData,
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
          throw new Error("Pedido inválido");

        const items = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

        for (const item of items) {
          const qty = parseFloat(item.qty);
          const updateData: any = {
            stock: sql`${products.stock} + ${qty}`,
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
            notes: `Entrada via Pedido ${order.number}`,
          });
        }
        await tx
          .update(purchaseOrders)
          .set({ status: "STOCK_POSTED", postedAt: new Date() })
          .where(eq(purchaseOrders.id, orderId));
      });
      res.json({ message: "Estoque atualizado!" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
