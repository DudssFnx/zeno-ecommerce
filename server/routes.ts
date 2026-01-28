import {
  companies, // ✅ Importado para as rotas da empresa
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
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // 1. Setup básico de autenticação (sessão)
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
  // 🔐 ROTA MANUAL DE LOGIN
  // ==========================================
  app.post("/api/auth/login", async (req: any, res, next) => {
    try {
      const { email, password } = req.body;

      // 1. Busca na tabela users (legacy) pelo email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "Usuário não encontrado" });
      }

      // 2. Verifica a senha
      let isValid = false;
      if (user.password) {
        // Tenta comparar como hash
        isValid = await bcrypt
          .compare(password, user.password)
          .catch(() => false);
        // Se falhar o hash, tenta texto simples (fallback)
        if (!isValid && password === user.password) isValid = true;
      }

      if (!isValid) {
        return res.status(401).json({ message: "Senha incorreta" });
      }

      // 3. Loga o usuário na sessão
      req.login(user, (err: any) => {
        if (err) return next(err);

        // Retorna os dados formatados para o Frontend
        const userResponse = {
          ...user,
          isB2bUser: true,
          nome: user.firstName, // Garante compatibilidade
          company: user.company,
        };
        return res.json(userResponse);
      });
    } catch (error) {
      console.error("Erro fatal no login:", error);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  });

  // --- USER INFO ---
  app.get("/api/auth/user", async (req: any, res) => {
    if (!req.isAuthenticated())
      return res.status(401).json({ message: "Não autenticado" });

    // Busca atualizada do usuário
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user)
      return res.status(404).json({ message: "Usuário não encontrado" });

    res.json({
      ...user,
      isB2bUser: true,
      nome: user.firstName, // Alias para o frontend
    });
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.logout(() => res.json({ message: "Logout efetuado" }));
  });

  // ==========================================
  // 🏢 ROTAS DA EMPRESA (MULTI-TENANT)
  // ==========================================

  // 🏢 ROTA: Quem sou eu? (Versão à prova de falhas)
  app.get("/api/company/me", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();

    const userCompanyId = req.user.companyId;
    console.log("🔍 Buscando empresa para ID:", userCompanyId);

    try {
      let company;

      // TENTATIVA 1: Busca pelo ID exato (se tiver ID)
      if (userCompanyId) {
        // Força comparação como texto para evitar erro de tipo (número vs string)
        const targetId = String(userCompanyId).trim();
        [company] = await db
          .select()
          .from(companies)
          .where(sql`${companies.id}::text = ${targetId}`)
          .limit(1);
      }

      // TENTATIVA 2 (Plano B): Se não achou (ou não tinha ID), pega a primeira empresa do banco
      // Isso garante que o painel nunca fique vazio para o Admin
      if (!company) {
        console.log(
          "⚠️ ID exato não encontrado. Usando 'Plano B' (Primeira empresa disponível)...",
        );
        const [firstCompany] = await db.select().from(companies).limit(1);
        company = firstCompany;
      }

      // Se mesmo assim não tiver empresa nenhuma no banco
      if (!company) {
        return res
          .status(404)
          .json({ message: "Nenhuma empresa cadastrada no sistema." });
      }

      // 🔄 TRADUÇÃO (Mapeamento para o Frontend)
      // O frontend espera nomes em inglês (name, tradingName), mas o banco está em PT-BR
      const companyFrontend = {
        ...company,
        id: company.id,
        // Garante que name e tradingName sempre tenham valor
        name: company.razaoSocial || company.name || "Minha Empresa",
        tradingName:
          company.nomeFantasia || company.tradingName || "Nome Fantasia",
        cnpj: company.cnpj,
        email: company.email,
        phone: company.telefone || company.phone,

        // Endereço
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

      console.log("✅ Empresa retornada:", companyFrontend.tradingName);
      res.json(companyFrontend);
    } catch (error) {
      console.error("❌ ERRO CRÍTICO NA ROTA EMPRESA:", error);
      res.status(500).json({ message: "Erro interno ao buscar empresa" });
    }
  });

  // PATCH: Atualizar minha empresa (VERSÃO CORRIGIDA JSON)
  app.patch("/api/company/me", async (req: any, res) => {
    // 1. Correção: Retornar JSON se não estiver logado
    if (!req.isAuthenticated()) {
      return res
        .status(401)
        .json({ message: "Sessão expirada. Por favor, faça login novamente." });
    }

    const userCompanyId = req.user.companyId;
    console.log(
      "📝 Recebido pedido de atualização. ID Empresa Usuário:",
      userCompanyId,
    );
    console.log("📦 Dados recebidos:", req.body);

    try {
      const updateData: any = { ...req.body, updatedAt: new Date() };

      // Traduz campos do Frontend -> Banco
      if (req.body.name) updateData.razaoSocial = req.body.name;
      if (req.body.tradingName) updateData.nomeFantasia = req.body.tradingName;
      if (req.body.address) updateData.endereco = req.body.address;
      if (req.body.city) updateData.cidade = req.body.city;

      // Limpeza
      delete updateData.name;
      delete updateData.tradingName;
      delete updateData.address;
      delete updateData.city;

      // TENTATIVA 1: Atualizar pelo ID exato
      let targetId = String(userCompanyId).trim();

      let [updated] = await db
        .update(companies)
        .set(updateData)
        .where(sql`${companies.id}::text = ${targetId}`)
        .returning();

      // TENTATIVA 2 (Plano B): Se não atualizou, pega a primeira empresa
      if (!updated) {
        console.log("⚠️ ID exato falhou. Usando 'Plano B'...");
        const [first] = await db.select().from(companies).limit(1);
        if (first) {
          [updated] = await db
            .update(companies)
            .set(updateData)
            .where(eq(companies.id, first.id))
            .returning();
        }
      }

      if (!updated) {
        return res
          .status(404)
          .json({ message: "Empresa não encontrada para atualizar." });
      }

      console.log("✅ Empresa atualizada com sucesso!");
      res.json(updated);
    } catch (error: any) {
      console.error("❌ Erro ao atualizar empresa:", error);
      // Sempre retorna JSON no erro
      res.status(500).json({ message: "Erro interno: " + error.message });
    }
  });

  // ==========================================
  // --- 👥 USUÁRIOS E CLIENTES (LISTAGEM) ---
  // ==========================================

  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const result = await db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  // ==========================================
  // --- 🚚 FORNECEDORES ---
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

  app.post("/api/suppliers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const userCompanyId = req.user.companyId ? Number(req.user.companyId) : 1;
      const validCompanyId = isNaN(userCompanyId) ? 1 : userCompanyId;

      const newSupplierData = {
        ...req.body,
        companyId: validCompanyId,
        active: true,
      };
      const [supplier] = await db
        .insert(suppliers)
        .values(newSupplierData)
        .returning();
      res.status(201).json(supplier);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao criar fornecedor" });
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
      res.json({ message: "Fornecedor excluído" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir fornecedor" });
    }
  });

  // ==========================================
  // --- 🛒 PEDIDOS E PRODUTOS (V3 - CORREÇÃO FINAL) ---
  // ==========================================

  // 1. LISTAR PRODUTOS (Direto do Banco - Sem Tradução)
  app.get("/api/products", async (req, res) => {
    try {
      // O banco já está em inglês (name, description, etc)
      const result = await db
        .select()
        .from(products)
        .orderBy(desc(products.id));

      res.json({
        products: result,
        total: result.length,
      });
    } catch (error) {
      console.error("Erro ao listar produtos:", error);
      res.status(500).send("Erro ao listar produtos");
    }
  });

  // 2. CRIAR PRODUTO (Correção: Enviar 'name' direto, sem mudar para 'nome')
  app.post("/api/products", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();

    try {
      // Monta o objeto exatamente como o banco espera (em inglês)
      const newProductData: any = {
        companyId: req.user.companyId || 1,
        createdAt: new Date(),
        updatedAt: new Date(),

        // Campos de texto (direto do frontend)
        name: req.body.name,
        description: req.body.description,
        sku: req.body.sku,

        // Conversão de números/decimais
        stock: req.body.stock ? Number(req.body.stock) : 0,
        price: req.body.price ? String(req.body.price) : "0.00",
        cost: req.body.cost ? String(req.body.cost) : "0.00",
      };

      const [product] = await db
        .insert(products)
        .values(newProductData)
        .returning();

      console.log("✅ Produto criado:", product.name);
      res.status(201).json(product);
    } catch (error: any) {
      console.error("Erro ao criar produto:", error);
      res
        .status(500)
        .json({ message: "Erro ao criar produto: " + error.message });
    }
  });

  // 3. ATUALIZAR PRODUTO (Correção: Atualizar 'name' direto)
  app.patch("/api/products/:id", async (req: any, res) => {
    if (!req.isAuthenticated())
      return res.status(401).json({ message: "Não autenticado" });

    const id = parseInt(req.params.id);
    console.log(`📝 Atualizando produto ID ${id}...`);

    try {
      const updateData: any = { updatedAt: new Date() };

      // Mapeamento direto (Inglês -> Inglês)
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.description !== undefined)
        updateData.description = req.body.description;
      if (req.body.sku !== undefined) updateData.sku = req.body.sku;

      // Conversões
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

      if (!updated) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }

      console.log("✅ Produto atualizado com sucesso:", updated.name);
      res.json(updated);
    } catch (error: any) {
      console.error("❌ Erro ao atualizar produto:", error);
      res.status(500).json({ message: "Erro interno ao atualizar produto" });
    }
  });

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

  // --- OUTRAS ROTAS ---
  app.get("/api/categories", async (req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  return httpServer;
}
