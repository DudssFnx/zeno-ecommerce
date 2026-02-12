import {
  blingCredentials,
  blingTokens,
  blingWebhookEndpoints,
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
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import express, { type Express } from "express";
import { type Server } from "http";
import { db } from "./db";
import { registerFinancialRoutes } from "./financialRoutes";
import { requireCompany } from "./middleware/company";
import { saveTokensToDb, verifyWebhookSignature } from "./services/bling";
import { createPayableFromPurchaseOrder } from "./services/payables.service";
import {
  cancelReceivablesByOrderId,
  createAndSettleReceivableFromOrder,
  createReceivableFromOrder,
  hasReceivablesForOrder,
  reopenReceivablesByOrderId,
} from "./services/receivables.service";

// Tipagem leve para reduzir warnings: Request.user e Request.session usados no arquivo
declare global {
  namespace Express {
    interface Request {
      user?: {
        id?: string;
        companyId?: string;
        role?: string;
        firstName?: string;
        email?: string;
      };
      session?: any;
    }
  }
}

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
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
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
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
      const { email, password, razaoSocial } = req.body;
      // Normalize razaoSocial: trim + collapse spaces to avoid mismatch caused by extra whitespace
      const sanitizedRazao =
        typeof razaoSocial === "string"
          ? razaoSocial.replace(/\s+/g, " ").trim()
          : undefined;
      console.log("[LOGIN] Razão social recebida:", sanitizedRazao);
      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email e senha são obrigatórios" });
      }

      // Buscar empresa pela razão social (case insensitive, ignorando acentos se disponível)
      let company: any = null;

      if (sanitizedRazao) {
        // Primeiro tente por slug (mais tolerante a espaços e acentos)
        const inputSlug = generateSlug(sanitizedRazao);
        const [bySlug] = await db
          .select()
          .from(companies)
          .where(eq(companies.slug, inputSlug))
          .limit(1);
        if (bySlug) {
          company = bySlug;
        } else {
          try {
            const [found] = await db
              .select()
              .from(companies)
              .where(
                sql`unaccent(lower(${companies.razaoSocial})) = unaccent(lower(${sanitizedRazao}))`,
              )
              .limit(1);
            company = found;
          } catch (err: any) {
            // Postgres pode não ter a extensão unaccent em ambientes locais; fallback sem unaccent
            console.warn(
              "[LOGIN] unaccent not available, falling back to lower comparison:",
              err?.message || err,
            );
            const [found] = await db
              .select()
              .from(companies)
              .where(
                sql`lower(${companies.razaoSocial}) = lower(${sanitizedRazao})`,
              )
              .limit(1);
            company = found;
          }
        }
      } else {
        // Sem razaoSocial: tentar inferir pela existência de usuário único com esse email
        const usersFound = await db
          .select()
          .from(users)
          .where(eq(users.email, email));
        if (usersFound.length === 1) {
          const companyId = usersFound[0].companyId;
          const [foundCompany] = await db
            .select()
            .from(companies)
            .where(eq(companies.id, companyId))
            .limit(1);
          company = foundCompany;
          console.log(
            "[LOGIN] Empresa inferida por email:",
            company?.razaoSocial || company?.id,
          );
        } else if (usersFound.length > 1) {
          console.warn(
            "[LOGIN] Multiple companies found for email; razaoSocial required",
          );
          return res.status(400).json({
            message:
              "Múltiplas empresas encontradas para este e-mail. Informe 'razaoSocial'.",
          });
        } else {
          // se nenhum usuário com esse email, e houver apenas 1 empresa no sistema, usamos ela
          const companiesList = await db.select().from(companies).limit(2);
          if (companiesList.length === 1) {
            company = companiesList[0];
            console.log(
              "[LOGIN] Empresa única no sistema, usando:",
              company.razaoSocial,
            );
          } else {
            console.log(
              "[LOGIN] Nenhuma empresa encontrada por email ou há múltiplas; exigindo razaoSocial",
            );
            return res.status(401).json({
              message: "Empresa não encontrada; informe 'razaoSocial'.",
            });
          }
        }
      }

      console.log("[LOGIN] Empresa encontrada:", company);

      if (!company) {
        console.log("[LOGIN] Empresa não encontrada!");
        return res.status(401).json({ message: "Empresa não encontrada" });
      }

      // Buscar usuário pelo e-mail e companyId
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email), eq(users.companyId, company.id)))
        .limit(1);
      console.log("[LOGIN] Usuário encontrado:", user);

      if (!user) {
        console.log(
          "[LOGIN] Usuário não encontrado para este e-mail e empresa!",
        );
        return res
          .status(401)
          .json({ message: "E-mail não encontrado para esta empresa" });
      }

      const isValidPassword = await bcrypt.compare(
        password,
        user.password || "",
      );
      if (!isValidPassword) {
        console.log("[LOGIN] Senha incorreta!");
        return res.status(401).json({ message: "Senha incorreta" });
      }

      // Login usando Passport
      req.login(user, (err: any) => {
        if (err) {
          console.log("[LOGIN] Erro ao fazer login:", err);
          return res.status(500).json({ message: "Erro ao fazer login" });
        }
        // Persist active company in session and ensure req.user has companyId
        try {
          if (req.session) {
            req.session.activeCompanyId = company.id;
            // Ensure session is saved before responding to avoid race conditions
            req.session.save((saveErr: any) => {
              if (saveErr) {
                console.warn(
                  "[LOGIN] Erro ao salvar sessão com activeCompanyId:",
                  saveErr,
                );
              }
              // Force companyId on req.user as well
              req.user.companyId = company.id;

              console.log(
                "[LOGIN] Login realizado com sucesso para usuário:",
                user.email,
                "na empresa:",
                company.razaoSocial,
              );
              res.json({
                user: { ...user, isB2bUser: true, nome: user.firstName },
                message: "Login realizado com sucesso",
              });
            });
            return; // response will be sent in save callback
          } else {
            req.user.companyId = company.id;
          }
        } catch (e) {
          console.warn(
            "[LOGIN] Não foi possível salvar companyId na sessão:",
            e,
          );
        }

        console.log(
          "[LOGIN] Login realizado com sucesso para usuário:",
          user.email,
          "na empresa:",
          company.razaoSocial,
        );
        res.json({
          user: { ...user, isB2bUser: true, nome: user.firstName },
          message: "Login realizado com sucesso",
        });
      });
    } catch (error) {
      console.log("[LOGIN] Erro inesperado:", error);
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.logout(() => res.json({ message: "Logout efetuado" }));
  });

  // ==========================================
  // --- 🗂️ CATEGORIAS (AUTENTICADO) ---
  // ==========================================
  app.get("/api/categories", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const companyId = getCompanyId(req);
      const result = await db
        .select()
        .from(categories)
        .where(eq(categories.companyId, companyId))
        .orderBy(categories.name);
      res.json(result);
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });
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

  // Helper to resolve effective companyId: prefer header (req.companyId) then session (req.user.companyId)
  function getCompanyId(req: any): string {
    return req.companyId || req.user?.companyId || "1";
  }

  app.get("/api/company/me", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, req.companyId || req.user.companyId))
        .limit(1);
      if (!company)
        return res.status(404).json({ message: "Empresa não encontrada" });
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar empresa" });
    }
  });

  // Busca de empresas para autocomplete no login (público)
  app.get("/api/companies/search", async (req: any, res) => {
    try {
      const q = (req.query.query || req.query.q || "").toString().trim();
      if (!q || q.length < 2) return res.json([]);

      // Tenta por slug gerado a partir da query primeiro
      const inputSlug = generateSlug(q);
      const bySlug = await db
        .select({
          id: companies.id,
          razaoSocial: companies.razaoSocial,
          slug: companies.slug,
          email: companies.email,
        })
        .from(companies)
        .where(eq(companies.slug, inputSlug))
        .limit(10);
      if (bySlug && bySlug.length > 0) return res.json(bySlug);

      // Senão, faz busca por prefixo (tenta unaccent quando disponível)
      try {
        const rows = await db
          .select({
            id: companies.id,
            razaoSocial: companies.razaoSocial,
            slug: companies.slug,
            email: companies.email,
          })
          .from(companies)
          .where(
            sql`unaccent(lower(${companies.razaoSocial})) LIKE unaccent(lower(${q} || '%'))`,
          )
          .limit(10);
        return res.json(rows);
      } catch (err: any) {
        // Fallback sem unaccent
        const rows = await db
          .select({
            id: companies.id,
            razaoSocial: companies.razaoSocial,
            slug: companies.slug,
            email: companies.email,
          })
          .from(companies)
          .where(sql`lower(${companies.razaoSocial}) LIKE lower(${q} || '%')`)
          .limit(10);
        return res.json(rows);
      }
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res.status(500).json({ message: "Erro: " + error.message });
    }
  });

  // ==========================================
  // --- 👥 USUÁRIOS (MANTIDO IGUAL) ---
  // ==========================================
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const { role } = req.query;

    // Debug: mostrar usuário da sessão
    console.log("[API/users] req.user:", {
      id: req.user?.id,
      role: req.user?.role,
      companyId: req.user?.companyId,
    });
    console.log(
      "[API/users] session.activeCompanyId:",
      req.session?.activeCompanyId,
    );

    // Validar presença de companyId para não vazar dados
    const isSuperUser =
      req.user?.role === "superadmin" || req.user?.role === "super_admin";
    const sessionCompanyId = req.session?.activeCompanyId;
    const headerCompanyId = req.companyId as string | undefined;

    // Se não for superuser, garantimos que existe um companyId (header | session | user)
    if (
      !isSuperUser &&
      !headerCompanyId &&
      !sessionCompanyId &&
      !req.user?.companyId
    ) {
      console.log(
        "[API/users] Requisição sem companyId (header/session/user) - bloqueando",
      );
      return res
        .status(401)
        .json({ message: "Sessão inválida: companyId ausente" });
    }

    // Se for superuser, retorna todos
    if (isSuperUser) {
      let query = db.select().from(users);
      if (role) {
        const roles = String(role).split(",");
        query = query.where(inArray(users.role, roles));
        console.log("[API/users] Filtro de role aplicado (superuser):", roles);
      }
      const result = await query.orderBy(desc(users.createdAt));
      console.log(
        "[API/users] Resultado da query (superuser):",
        result.map((r) => ({
          id: r.id,
          companyId: r.companyId,
          email: r.email,
          role: r.role,
        })),
      );
      return res.json(result);
    }

    // Usuário normal: garantir que companyId existe e filtrar explicitamente pelo companyId
    const companyId = String(
      headerCompanyId || sessionCompanyId || req.user.companyId,
    );
    console.log(
      "[API/users] Executando query filtrada por companyId:",
      companyId,
    );

    if (role) {
      const roles = String(role)
        .split(",")
        .map((r) => r.toLowerCase())
        .filter((r) => r !== "super_admin" && r !== "superadmin");
      const result = await db
        .select()
        .from(users)
        .where(and(eq(users.companyId, companyId), inArray(users.role, roles)))
        .orderBy(desc(users.createdAt));
      console.log(
        "[API/users] Resultado da query (filtrado + role):",
        result.map((r) => ({
          id: r.id,
          companyId: r.companyId,
          email: r.email,
          role: r.role,
        })),
      );
      return res.json(result);
    }

    const result = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.companyId, companyId),
          sql`${users.role} != 'super_admin'`,
        ),
      )
      .orderBy(desc(users.createdAt));

    console.log(
      "[API/users] Resultado da query (filtrado):",
      result.map((r) => ({
        id: r.id,
        companyId: r.companyId,
        email: r.email,
        role: r.role,
      })),
    );
    res.json(result);
  });

  // Rota para listar vendedores (users com role 'sales' ou 'admin')
  app.get("/api/sellers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const companyId = getCompanyId(req);
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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

      const companyIdToUse = req.companyId || req.user.companyId || "1";
      const [newUser] = await db
        .insert(users)
        .values({
          ...cleanData,
          password: hashedPassword,
          companyId: companyIdToUse,
          createdAt: new Date(),
        })
        .returning();

      res.status(201).json(newUser);
    } catch (error) {
      if (error.code === "23505") {
        return res
          .status(409)
          .json({ message: "Registro duplicado (Email, CPF ou CNPJ)." });
      }
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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

      // Multi-tenancy seguro: só superadmin pode editar qualquer usuário
      let whereClause = eq(users.id, req.params.id);
      if (req.user.role !== "superadmin") {
        whereClause = and(
          whereClause,
          eq(users.companyId, String(req.companyId || req.user.companyId)),
        );
      }

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(whereClause)
        .returning();

      if (!updated)
        return res.status(404).json({ message: "Usuário não encontrado" });
      res.json(updated);
    } catch (error) {
      const err = error as any;
      if (err && err.code === "23505") {
        return res.status(409).json({ message: "Conflito: Dado duplicado." });
      }
      res.status(500).json({ message: err?.message || String(err) });
    }
  });

  app.delete("/api/users/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    // Multi-tenancy seguro: só superadmin pode excluir qualquer usuário
    let whereClause = eq(users.id, req.params.id);
    if (req.user.role !== "superadmin") {
      whereClause = and(
        whereClause,
        eq(users.companyId, String(req.user.companyId)),
      );
    }
    const [deleted] = await db.delete(users).where(whereClause).returning();
    if (!deleted)
      return res.status(404).json({ message: "Usuário não encontrado" });
    res.json({ message: "Excluído" });
  });

  // ==========================================
  // --- 🚚 FORNECEDORES (MANTIDO IGUAL) ---
  // ==========================================
  app.get("/api/suppliers", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    let query = db.select().from(suppliers);
    // Multi-tenancy seguro: só superadmin pode ver todos
    if (req.user.role !== "superadmin") {
      query = query.where(
        eq(suppliers.companyId, String(req.companyId || req.user.companyId)),
      );
    }
    const result = await query.orderBy(desc(suppliers.id));
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  app.patch("/api/suppliers/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    // Multi-tenancy seguro: só superadmin pode editar qualquer fornecedor
    let whereClause = eq(suppliers.id, parseInt(req.params.id));
    if (req.user.role !== "superadmin") {
      whereClause = and(
        whereClause,
        eq(suppliers.companyId, String(req.user.companyId)),
      );
    }
    const [updated] = await db
      .update(suppliers)
      .set(req.body)
      .where(whereClause)
      .returning();
    if (!updated)
      return res.status(404).json({ message: "Fornecedor não encontrado" });
    res.json(updated);
  });

  app.delete("/api/suppliers/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    // Multi-tenancy seguro: só superadmin pode excluir qualquer fornecedor
    let whereClause = eq(suppliers.id, parseInt(req.params.id));
    if (req.user.role !== "superadmin") {
      whereClause = and(
        whereClause,
        eq(suppliers.companyId, String(req.user.companyId)),
      );
    }
    const [deleted] = await db.delete(suppliers).where(whereClause).returning();
    if (!deleted)
      return res.status(404).json({ message: "Fornecedor não encontrado" });
    res.json({ message: "Excluído" });
  });

  // ==========================================
  // --- 🛒 PRODUTOS (MANTIDO IGUAL) ---
  // ==========================================
  app.get("/api/products", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const { categoryId } = req.query;
    let query = db.select().from(products);

    // Multi-tenancy seguro: só superadmin pode ver todos, demais só veem produtos da própria empresa
    let whereClause = undefined;
    if (req.user.role !== "superadmin") {
      whereClause = eq(
        products.companyId,
        String(req.companyId || req.user.companyId),
      );
    }
    if (categoryId) {
      const categoryClause = eq(products.categoryId, Number(categoryId));
      whereClause = whereClause
        ? and(whereClause, categoryClause)
        : categoryClause;
    }
    if (whereClause) {
      query = query.where(whereClause);
    }

    const result = await query.orderBy(desc(products.createdAt));
    res.json(result);
  });

  app.post("/api/products", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const body = { ...req.body };
      if (body.categoryId !== undefined) {
        body.categoryId = body.categoryId ? Number(body.categoryId) : null;
      }
      if (body.supplierId !== undefined) {
        body.supplierId = body.supplierId ? Number(body.supplierId) : null;
      }
      const companyIdToUse = req.companyId || req.user.companyId || "1";
      const [newProduct] = await db
        .insert(products)
        .values({
          ...body,
          companyId: companyIdToUse,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      res.status(201).json(newProduct);
    } catch (error) {
      if (error.code === "23505") {
        return res
          .status(409)
          .json({ message: "Conflito: Produto já existe." });
      }
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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

      // Multi-tenancy seguro: só superadmin pode editar qualquer produto
      let whereClause = eq(products.id, parseInt(req.params.id));
      if (req.user.role !== "superadmin") {
        whereClause = and(
          whereClause,
          eq(products.companyId, String(req.user.companyId)),
        );
      }

      const [updated] = await db
        .update(products)
        .set(updateData)
        .where(whereClause)
        .returning();
      if (!updated)
        return res.status(404).json({ message: "Produto não encontrado" });
      res.json(updated);
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  app.delete("/api/products/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    // Multi-tenancy seguro: só superadmin pode excluir qualquer produto
    let whereClause = eq(products.id, parseInt(req.params.id));
    if (req.user.role !== "superadmin") {
      whereClause = and(
        whereClause,
        eq(products.companyId, String(req.user.companyId)),
      );
    }
    const [deleted] = await db.delete(products).where(whereClause).returning();
    if (!deleted)
      return res.status(404).json({ message: "Produto não encontrado" });
    res.json({ message: "Excluído" });
  });

  // ==========================================
  // --- 📦 PEDIDOS DE COMPRA (MANTIDO IGUAL) ---
  // ==========================================
  app.get("/api/purchases", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      let query = db
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
        );
      // Multi-tenancy seguro: só superadmin pode ver todos
      if (req.user.role !== "superadmin") {
        query = query.where(
          eq(purchaseOrders.companyId, String(req.user.companyId)),
        );
      }
      const result = await query
        .groupBy(purchaseOrders.id, suppliers.name)
        .orderBy(desc(purchaseOrders.createdAt));
      res.json(result);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Erro ao listar pedidos: " + error.message });
    }
  });

  app.get("/api/purchases/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const id = parseInt(req.params.id);
    try {
      // Multi-tenancy seguro: só superadmin pode ver qualquer pedido
      let whereClause = eq(purchaseOrders.id, id);
      if (req.user.role !== "superadmin") {
        whereClause = and(
          whereClause,
          eq(purchaseOrders.companyId, String(req.user.companyId)),
        );
      }
      const [order] = await db
        .select()
        .from(purchaseOrders)
        .where(whereClause)
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
            companyId: req.user.companyId || "1",
            supplierId: supplierId ? Number(supplierId) : null,
            status: "DRAFT",
            number: orderData.number || `PC-${Date.now()}`,
            totalValue: String(orderData.totalValue || "0.00"),
          })
          .returning();

        if (items && items.length > 0) {
          const orderItemsData: any[] = [];
          for (const item of items) {
            const productId = Number(item.productId);
            const qty = parseFloat(String(item.qty || "0"));

            // Validações básicas
            if (isNaN(qty) || qty <= 0) {
              throw new Error(
                `Quantidade inválida para o produto ${productId}`,
              );
            }

            // Busca produto para pegar valores originais se necessário
            const [product] = await tx
              .select()
              .from(products)
              .where(eq(products.id, productId))
              .limit(1);

            if (!product) {
              throw new Error(`Produto não encontrado: ${productId}`);
            }

            // Unit cost
            const unitCostProvided =
              item.unitCost !== null &&
              item.unitCost !== undefined &&
              item.unitCost !== "";
            if (unitCostProvided && parseFloat(String(item.unitCost)) < 0) {
              throw new Error(
                `Valor de custo inválido para o produto ${productId}`,
              );
            }
            const unitCostStr = unitCostProvided ? String(item.unitCost) : null;

            // Sell price
            const sellPriceProvided =
              item.sellPrice !== null &&
              item.sellPrice !== undefined &&
              item.sellPrice !== "";
            if (sellPriceProvided && parseFloat(String(item.sellPrice)) < 0) {
              throw new Error(
                `Valor de venda inválido para o produto ${productId}`,
              );
            }
            const sellPriceStr = sellPriceProvided
              ? String(item.sellPrice)
              : null;

            // Linha total: usa unitCost fornecido ou o custo atual do produto
            const effectiveUnitCost = unitCostProvided
              ? parseFloat(String(item.unitCost)) || 0
              : parseFloat(String(product.cost || 0)) || 0;

            orderItemsData.push({
              purchaseOrderId: newOrder.id,
              productId,
              qty: String(qty),
              unitCost: unitCostStr,
              sellPrice: sellPriceStr,
              lineTotal: String(effectiveUnitCost * qty),
              descriptionSnapshot: String(
                item.descriptionSnapshot || product.name || "Produto",
              ),
              skuSnapshot: String(item.skuSnapshot || product.sku || "N/A"),
            });
          }

          await tx.insert(purchaseOrderItems).values(orderItemsData);
        }
        return newOrder;
      });
      res.status(201).json(result);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Erro ao criar pedido: " + error.message });
    }
  });

  app.post("/api/purchases/:id/post-stock", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const orderId = parseInt(req.params.id);
    try {
      const updatedProducts: Array<any> = [];
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

          // Busca produto para obter valores atuais (se necessários)
          const [productRow] = await tx
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);

          const unitCostProvided =
            item.unitCost !== null &&
            item.unitCost !== undefined &&
            item.unitCost !== "";
          const sellPriceProvided =
            item.sellPrice !== null &&
            item.sellPrice !== undefined &&
            item.sellPrice !== "";

          let unitCostStr: string | null = null;
          let sellPriceStr: string | null = null;

          if (unitCostProvided) {
            unitCostStr = String(item.unitCost);
            const unitCost = parseFloat(unitCostStr);
            if (isNaN(unitCost) || unitCost < 0) {
              throw new Error(
                `Valor de custo inválido para produto ${item.productId}`,
              );
            }
          }

          if (sellPriceProvided) {
            sellPriceStr = String(item.sellPrice);
            const sellPrice = parseFloat(sellPriceStr);
            if (isNaN(sellPrice) || sellPrice < 0) {
              throw new Error(
                `Valor de venda inválido para produto ${item.productId}`,
              );
            }
          }

          const updateData: any = {
            stock: sql`COALESCE(${products.stock}, 0) + ${qty}`,
            updatedAt: new Date(),
          };

          // Atualiza custo se informado e >= 1
          if (unitCostStr !== null) {
            const unitCost = parseFloat(unitCostStr);
            if (unitCost >= 1) updateData.cost = unitCostStr;
          }

          // Atualiza preço de venda se informado e >= 1
          let updatedCost = false;
          let updatedPrice = false;

          if (sellPriceStr !== null) {
            const sellPrice = parseFloat(sellPriceStr);
            if (sellPrice >= 1) {
              updateData.price = sellPriceStr;
              updatedPrice = true;
            }
          }

          if (unitCostStr !== null) {
            const unitCost = parseFloat(unitCostStr);
            if (unitCost >= 1) {
              updateData.cost = unitCostStr;
              updatedCost = true;
            }
          }

          await tx
            .update(products)
            .set(updateData)
            .where(eq(products.id, item.productId));

          // Registrar quais produtos tiveram custo/preço atualizados e calcular novo estoque
          const newStock =
            (productRow?.stock ? parseFloat(String(productRow.stock)) : 0) +
            qty;
          if (updatedCost || updatedPrice) {
            updatedProducts.push({
              productId: item.productId,
              name: productRow?.name || productRow?.nome || null,
              updatedCost,
              updatedPrice,
              cost: updatedCost ? unitCostStr : null,
              price: updatedPrice ? sellPriceStr : null,
              newStock,
            });
          }

          await tx.insert(stockMovements).values({
            type: "IN",
            reason: "PURCHASE_POST",
            refType: "PURCHASE_ORDER",
            refId: orderId,
            productId: item.productId,
            qty: qtyStr,
            unitCost:
              unitCostStr !== null
                ? unitCostStr
                : String(productRow?.cost || 0),
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
        const companyId = getCompanyId(req);
        await createPayableFromPurchaseOrder(orderId, companyId);
        console.log(
          `[Financial] Payable auto-created for purchase order #${orderId}`,
        );
      } catch (error) {
        // Se não conseguir criar payable (ex: não é prazo), apenas ignora
        console.log(
          `[Financial] Could not auto-create payable for purchase order #${orderId}:`,
          error.message,
        );
      }

      res.json({ message: "Estoque lançado com sucesso!", updatedProducts });
    } catch (error) {
      console.error(
        `[PURCHASE ERROR] Erro ao lançar estoque: ${error.message}`,
      );
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      console.error(
        `[PURCHASE REVERSE ERROR] Erro ao estornar estoque: ${error.message}`,
      );
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  app.delete("/api/purchases/:id", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const orderId = parseInt(req.params.id);

    try {
      await db.transaction(async (tx) => {
        // Multi-tenancy seguro: só superadmin pode excluir qualquer pedido
        let whereClause = eq(purchaseOrders.id, orderId);
        if (req.user.role !== "superadmin") {
          whereClause = and(
            whereClause,
            eq(purchaseOrders.companyId, String(req.user.companyId)),
          );
        }
        const [order] = await tx
          .select()
          .from(purchaseOrders)
          .where(whereClause)
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

        await tx.delete(purchaseOrders).where(whereClause);
      });

      res.json({ message: "Pedido excluído e estoque ajustado com sucesso." });
    } catch (error) {
      console.error("Erro Delete:", error);
      res.status(500).json({ message: "Erro ao excluir: " + error.message });
    }
  });

  // ==========================================
  // --- 🛍️ PEDIDOS DE VENDA (API REVISADA) ---
  // ==========================================

  // 1. GET: Listar Pedidos
  app.get("/api/products", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const { categoryId } = req.query;
    let query = db.select().from(products);
    let whereClause = eq(products.companyId, String(req.user.companyId));
    if (categoryId) {
      const categoryClause = eq(products.categoryId, Number(categoryId));
      whereClause = and(whereClause, categoryClause);
    }
    query = query.where(whereClause);
    const result = await query.orderBy(desc(products.createdAt));
    res.json(result);
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
    } catch (error) {
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
      const companyId = getCompanyId(req);
      const result = await db
        .select()
        .from(orders)
        .where(
          and(eq(orders.companyId, companyId), eq(orders.isGuestOrder, true)),
        )
        .orderBy(desc(orders.createdAt));
      res.json(result);
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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

      const companyId = getCompanyId(req);
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
          // Tenta criar receivable normal (PRAZO)
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
            // Se não criou receivable, verificar se é à vista e criar+quitar automaticamente
            const [paymentType] = await db
              .select()
              .from(paymentTypes)
              .where(eq(paymentTypes.id, orderForReceivable.paymentTypeId))
              .limit(1);

            if (paymentType && paymentType.paymentTermType === "VISTA") {
              const settled = await createAndSettleReceivableFromOrder(
                id,
                companyId,
                userName,
              );

              if (settled) {
                await db
                  .update(orders)
                  .set({
                    accountsPosted: true,
                    accountsPostedAt: new Date(),
                    accountsPostedBy: userName,
                  })
                  .where(eq(orders.id, id));
                console.log(
                  `[Financial] Receivable (à vista) auto-created and settled for order #${id}`,
                );
              } else {
                console.log(
                  `[Financial] Receivable (à vista) não criado para pedido #${id}`,
                );
              }
            } else {
              console.log(
                `[Financial] Receivable não criado para pedido #${id} - provavelmente pagamento não é PRAZO`,
              );
            }
          }
        }
      } catch (error) {
        // Se não conseguir criar receivable (ex: não é prazo), apenas ignora
        console.log(
          `[Financial] Could not auto-create receivable for order #${id}:`,
          error.message,
        );
      }

      res.json({ message: "Pedido faturado e estoque baixado." });
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      console.error(`[POST-ACCOUNTS] Erro para pedido #${id}:`, error);
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
        req.user.companyId || "1",
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
              req.user.companyId || "1",
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
    } catch (error) {
      console.error("[DEBUG] ERRO CRÍTICO NA ROTA:", error);
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      console.error("[GUEST ORDER]", error);
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  // GET: Configurações públicas (age verification popup, etc.)
  app.get("/api/settings/age_verification_popup", async (_req, res) => {
    try {
      // Retorna configuração padrão - pode ser customizado para ler do banco
      res.json({ enabled: false, minAge: 18 });
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  // ------------------------------------------
  // Bling credentials management (per company)
  // ------------------------------------------
  app.get("/api/bling/credentials", requireCompany, async (req: any, res) => {
    try {
      const companyId = String(req.companyId || req.user.companyId);
      const rows = await db
        .select()
        .from(blingCredentials)
        .where(eq(blingCredentials.companyId, companyId))
        .orderBy(desc(blingCredentials.id))
        .limit(1);
      if (!rows || rows.length === 0) {
        return res.json({ hasCredentials: false });
      }
      const row = rows[0];
      const masked = row.clientSecret
        ? row.clientSecret.replace(/.(?=.{4})/g, "*")
        : null;
      res.json({
        hasCredentials: true,
        clientId: row.clientId || null,
        clientSecretMasked: masked,
        apiEndpoint: row.apiEndpoint || null,
        redirectUri: row.redirectUri || null,
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  // GET: Bling connection status for current company
  app.get("/api/bling/status", requireCompany, async (req: any, res) => {
    try {
      const companyId = String(req.companyId || req.user.companyId);
      console.log("[Bling] status requested for company:", companyId);

      const [cred] = await db
        .select()
        .from(blingCredentials)
        .where(eq(blingCredentials.companyId, companyId))
        .orderBy(desc(blingCredentials.id))
        .limit(1);

      const [tokenRow] = await db
        .select()
        .from(blingTokens)
        .where(eq(blingTokens.companyId, companyId))
        .orderBy(desc(blingTokens.id))
        .limit(1);

      const hasCredentials = !!cred;
      // Consider token valid only if present and not yet expired in DB
      let authenticated = false;
      if (tokenRow) {
        try {
          const expiresAt = tokenRow.expiresAt;
          const expiresAtMs =
            typeof expiresAt === "number"
              ? expiresAt > 1e12
                ? expiresAt
                : expiresAt * 1000
              : expiresAt instanceof Date
              ? expiresAt.getTime()
              : Number(expiresAt) > 1e12
              ? Number(expiresAt)
              : Number(expiresAt) * 1000;
          authenticated = !isNaN(expiresAtMs) && expiresAtMs > Date.now();
        } catch (e) {
          authenticated = true; // fallback: token exists
        }
      }

      const m = await import("./services/bling");
      const importInProgress = !!m.importProductsInProgress;

      res.json({ hasCredentials, authenticated, importInProgress });
    } catch (error) {
      console.error("[Bling] Error in /api/bling/status:", error);
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  // Trigger a full products sync (imports/updates all products) - uses SSE progress
  app.post(
    "/api/bling/sync/products",
    requireCompany,
    async (req: any, res) => {
      try {
        // Kick off sync in background and immediately return a starting response
        import("./services/bling").then((m) => m.syncProducts());
        res.json({ ok: true, message: "Sync started" });
      } catch (error) {
        console.error("[Bling] Error starting product sync:", error);
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
      }
    },
  );

  // SSE endpoint for sync progress (EventSource)
  app.get("/api/bling/sync/progress", requireCompany, async (req: any, res) => {
    try {
      const m = await import("./services/bling");
      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders && res.flushHeaders();

      const send = (payload: any) => {
        try {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch (e) {
          /* ignore write errors */
        }
      };

      // Send initial snapshot
      send(m.getSyncProgress());

      const unsubscribe = m.subscribeSyncProgress((p) => send(p));

      req.on("close", () => {
        try {
          unsubscribe();
        } catch (e) {}
        try {
          res.end();
        } catch (e) {}
      });
    } catch (error) {
      console.error("[Bling] SSE /sync/progress error:", error);
      if (!res.headersSent)
        res
          .status(500)
          .json({ message: "Failed to establish progress stream" });
    }
  });

  // Disconnect Bling for current company (clear persisted tokens)
  app.post("/api/bling/disconnect", requireCompany, async (req: any, res) => {
    try {
      const m = await import("./services/bling");
      await m.clearBlingTokens();
      res.json({ ok: true, message: "Disconnected" });
    } catch (error) {
      console.error("[Bling] Failed to disconnect:", error);
      res.status(500).json({ message: "Failed to disconnect Bling" });
    }
  });

  // DEBUG: public status endpoint (no auth) - use only in local/dev for debugging
  app.get("/api/bling/status/public", async (req: any, res) => {
    try {
      const companyId = String(req.query.companyId || "1");
      console.log("[Bling] public status requested for company:", companyId);

      const [cred] = await db
        .select()
        .from(blingCredentials)
        .where(eq(blingCredentials.companyId, companyId))
        .orderBy(desc(blingCredentials.id))
        .limit(1);

      const [tokenRow] = await db
        .select()
        .from(blingTokens)
        .where(eq(blingTokens.companyId, companyId))
        .orderBy(desc(blingTokens.id))
        .limit(1);

      const hasCredentials = !!cred;
      const authenticated = !!tokenRow;

      res.json({ hasCredentials, authenticated });
    } catch (error) {
      console.error("[Bling] Error in /api/bling/status/public:", error);
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  // DEBUG: public test-credentials (no auth) - use only in local/dev for debugging
  app.post("/api/bling/test-credentials/public", async (req: any, res) => {
    try {
      const { clientId, clientSecret, apiEndpoint } = req.body;
      console.log(
        "[Bling] public test-credentials called:",
        !!clientId,
        apiEndpoint,
      );
      if (!clientId || !clientSecret)
        return res.status(400).json({
          ok: false,
          message: "clientId and clientSecret are required",
        });

      const testEndpoint = apiEndpoint || "https://api.bling.com.br/Api/v3";
      try {
        const resp = await fetch(testEndpoint, { method: "GET" });
        if (resp.ok || resp.status === 401) {
          return res.json({
            ok: true,
            message:
              "Endpoint reachable. Note: OAuth authorization still required.",
          });
        }
        return res
          .status(400)
          .json({ ok: false, message: `Unexpected status ${resp.status}` });
      } catch (fetchErr: any) {
        return res.status(500).json({
          ok: false,
          message: "Failed to reach API endpoint: " + fetchErr.message,
        });
      }
    } catch (error) {
      console.error(
        "[Bling] Error in /api/bling/test-credentials/public:",
        error,
      );
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  app.post("/api/bling/credentials", requireCompany, async (req: any, res) => {
    try {
      let { clientId, clientSecret, apiEndpoint, redirectUri } = req.body;
      const companyId = String(req.companyId || req.user.companyId);

      // Allow updating credentials without resending the secret: reuse existing secret if none provided
      if (!clientId) {
        return res.status(400).json({ message: "clientId is required" });
      }

      if (!clientSecret) {
        // try to reuse existing secret for company
        const rows = await db
          .select()
          .from(blingCredentials)
          .where(eq(blingCredentials.companyId, companyId))
          .orderBy(desc(blingCredentials.id))
          .limit(1);
        const prev = rows?.[0];
        if (prev && prev.clientSecret) {
          clientSecret = prev.clientSecret;
          console.log(
            "[Bling] Reusing existing clientSecret for company:",
            companyId,
          );
        } else {
          return res.status(400).json({
            message: "clientSecret is required (no existing secret to reuse)",
          });
        }
      }
      // Validate and normalize apiEndpoint: it must be a base API URL, not an OAuth/authorize URL or contain query params
      let normalizedApiEndpoint: string | null = apiEndpoint || null;
      let normalized = false;
      if (normalizedApiEndpoint) {
        try {
          const parsed = new URL(String(normalizedApiEndpoint));
          // Reject if it contains query string or looks like an OAuth authorize URL
          if (parsed.search && parsed.search !== "") {
            normalizedApiEndpoint = "https://api.bling.com.br/Api/v3";
            normalized = true;
          }
          if (/\/oauth\b|authorize/i.test(parsed.pathname)) {
            normalizedApiEndpoint = "https://api.bling.com.br/Api/v3";
            normalized = true;
          }
        } catch (e) {
          // If invalid URL, fallback to default
          normalizedApiEndpoint = "https://api.bling.com.br/Api/v3";
          normalized = true;
        }
      }

      // Remove credenciais antigas da empresa e insere as novas
      await db
        .delete(blingCredentials)
        .where(eq(blingCredentials.companyId, companyId));
      const [inserted] = await db
        .insert(blingCredentials)
        .values({
          companyId,
          clientId,
          clientSecret,
          apiEndpoint: normalizedApiEndpoint,
          redirectUri,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const responsePayload: any = {
        ok: true,
        credentials: {
          id: inserted.id,
          clientId: inserted.clientId,
          apiEndpoint: inserted.apiEndpoint,
        },
      };
      if (normalized) {
        responsePayload.normalized = true;
        responsePayload.message =
          "The provided API Endpoint looked like an authorization URL or contained query params and was normalized to https://api.bling.com.br/Api/v3";
      }

      res.json(responsePayload);
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  app.post(
    "/api/bling/test-credentials",
    requireCompany,
    async (req: any, res) => {
      try {
        const { clientId, clientSecret, apiEndpoint } = req.body;
        console.log(
          "[Bling] test-credentials called for company:",
          req.companyId,
          "body clientId:",
          !!clientId,
          "apiEndpoint:",
          apiEndpoint,
        );
        if (!clientId || !clientSecret)
          return res.status(400).json({
            ok: false,
            message: "clientId and clientSecret are required",
          });

        const testEndpoint = apiEndpoint || "https://api.bling.com.br/Api/v3";

        // Try a simple GET to the base endpoint (we expect 200 or 401; network errors will be caught)
        try {
          const resp = await fetch(testEndpoint, { method: "GET" });
          // If we get a response, consider it reachable. Bling API will often require auth and return 401,
          // which is still a sign that the endpoint is reachable.
          if (resp.ok || resp.status === 401) {
            return res.json({
              ok: true,
              message:
                "Endpoint reachable. Note: OAuth authorization still required.",
            });
          }
          return res
            .status(400)
            .json({ ok: false, message: `Unexpected status ${resp.status}` });
        } catch (fetchErr: any) {
          return res.status(500).json({
            ok: false,
            message: "Failed to reach API endpoint: " + fetchErr.message,
          });
        }
      } catch (error) {
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
      }
    },
  );

  // START: OAuth flow endpoints
  app.get("/api/bling/auth", async (req: any, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const companyId = String(req.companyId || req.user?.companyId);
      if (!companyId) {
        return res.status(400).json({
          message:
            "Company ID is required. Set X-Company-Id header or ensure your session has a companyId.",
        });
      }

      // Prefer credentials stored in DB
      const rows = await db
        .select()
        .from(blingCredentials)
        .where(eq(blingCredentials.companyId, companyId))
        .orderBy(desc(blingCredentials.id))
        .limit(1);
      const row = rows?.[0];
      const clientId = row?.clientId || process.env.BLING_CLIENT_ID;
      const clientSecret = row?.clientSecret || process.env.BLING_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.status(400).json({
          message:
            "Bling clientId and clientSecret are required. Please set them in the Bling panel.",
        });
      }

      const redirectUri =
        row.redirectUri ||
        `${req.protocol}://${req.get("host")}/api/bling/callback`;
      const state = Buffer.from(
        JSON.stringify({
          companyId,
          nonce: Math.random().toString(36).slice(2),
        }),
      ).toString("base64");
      const authUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
      // DEBUG: Log the full auth URL (including redirect_uri) so we can verify it matches the redirect registered on Bling
      console.log("[Bling] Redirecting to auth URL for company:", companyId);
      console.log("[Bling] Using redirectUri:", redirectUri);
      console.log("[Bling] authUrl:", authUrl);
      // store last auth url for debug retrieval
      try {
        lastBlingAuthUrl = authUrl;
      } catch (e) {
        /* ignore */
      }
      res.redirect(authUrl);
    } catch (error) {
      console.error("[Bling] Error in /api/bling/auth:", error);
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  app.get("/api/bling/callback", async (req: any, res) => {
    try {
      const { code, state } = req.query;
      console.log(
        "[Bling] /api/bling/callback invoked. code?",
        !!code,
        "state?",
        !!state,
      );
      if (!code || !state) return res.status(400).send("Missing code or state");
      let parsed: any;
      try {
        parsed = JSON.parse(
          Buffer.from(state as string, "base64").toString("utf8"),
        );
      } catch (e) {
        console.error("[Bling] Invalid state value:", e);
        return res.status(400).send("Invalid state value");
      }
      const companyId = parsed.companyId;
      console.log("[Bling] callback state parsed, companyId:", companyId);

      // Fetch company credentials
      const rows = await db
        .select()
        .from(blingCredentials)
        .where(eq(blingCredentials.companyId, companyId))
        .orderBy(desc(blingCredentials.id))
        .limit(1);
      const row = rows?.[0];
      if (!row) {
        console.error(
          "[Bling] No Bling credentials saved for company:",
          companyId,
        );
        return res
          .status(400)
          .send("No Bling credentials saved for this company");
      }

      // Exchange code for tokens using company credentials
      const redirectUri =
        row.redirectUri ||
        `${req.protocol}://${req.get("host")}/api/bling/callback`;
      console.log("[Bling] Using redirectUri for token exchange:", redirectUri);

      const tokenResp = await fetch(
        `https://www.bling.com.br/Api/v3/oauth/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:
              "Basic " +
              Buffer.from(`${row.clientId}:${row.clientSecret}`).toString(
                "base64",
              ),
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code as string,
            redirect_uri: redirectUri,
          }),
        },
      );

      console.log("[Bling] Token exchange resp status:", tokenResp.status);
      const respText = await tokenResp.text();
      let tokens: any = null;
      try {
        tokens = JSON.parse(respText);
      } catch (e) {
        // not a JSON response
      }
      if (!tokenResp.ok) {
        console.error(
          "[Bling] Token exchange failed:",
          tokenResp.status,
          respText,
        );
        return res.status(500).send("Token exchange failed: " + respText);
      }

      // Reset tokens variable properly
      if (!tokens) tokens = JSON.parse(respText);

      // Save tokens for the company
      await saveTokensToDb(tokens as any, companyId);
      console.log(
        "[Bling] Token exchange and save complete for company:",
        companyId,
      );

      // Ensure in-memory cache/environment are updated immediately so the running
      // process uses the newly saved tokens (avoids "still unauthenticated" errors)
      try {
        const m = await import("./services/bling");
        await m.initializeBlingTokens();
        console.log("[Bling] In-memory tokens reloaded after callback for company:", companyId);
      } catch (e) {
        console.error("[Bling] Failed to reload in-memory tokens after callback:", e);
      }

      // Redirect back to UI with success
      return res.redirect("/bling?success=true");
    } catch (error) {
      console.error("[Bling] Error in /api/bling/callback:", error);
      if (!res.headersSent)
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
    }
  });

  // In-memory debug: store last auth URL generated (company-scoped). Useful for quick checks during authorization.
  let lastBlingAuthUrl: string | null = null;

  app.get(
    "/api/bling/debug/last-auth-url",
    requireCompany,
    async (req: any, res) => {
      try {
        res.json({ lastAuthUrl: lastBlingAuthUrl });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  // GET: reveal client secret (protected) - use only if user needs to view stored secret
  app.get(
    "/api/bling/credentials/secret",
    requireCompany,
    async (req: any, res) => {
      try {
        const companyId = String(req.companyId || req.user.companyId);
        const rows = await db
          .select()
          .from(blingCredentials)
          .where(eq(blingCredentials.companyId, companyId))
          .orderBy(desc(blingCredentials.id))
          .limit(1);
        if (!rows || rows.length === 0)
          return res.status(404).json({ message: "not found" });
        const row = rows[0];
        res.json({ clientSecret: row.clientSecret });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    },
  );

  // Product import & preview endpoints
  app.get(
    "/api/bling/products/preview",
    requireCompany,
    async (req: any, res) => {
      try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 100);
        const products = await import("./services/bling").then((m) =>
          m.fetchBlingProductsList(page, limit),
        );
        res.json({ products });
      } catch (error) {
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
      }
    },
  );

  // Remote search across Bling product pages (name or sku)
  app.get(
    "/api/bling/products/search",
    requireCompany,
    async (req: any, res) => {
      try {
        const q = String(req.query.q || "").trim();
        const limit = Number(req.query.limit || 100);
        const maxPages = Number(req.query.maxPages || 20);

        if (!q) return res.status(400).json({ message: "query required" });

        const matches: any[] = [];

        for (let page = 1; page <= maxPages; page++) {
          try {
            const products = await import("./services/bling").then((m) =>
              m.fetchBlingProductsList(page, limit),
            );

            if (!products || products.length === 0) break;

            for (const p of products) {
              const name = String(p.nome || "").toLowerCase();
              const code = String(p.codigo || "").toLowerCase();
              if (
                name.includes(q.toLowerCase()) ||
                code.includes(q.toLowerCase())
              ) {
                matches.push(p);
              }
            }

            // defensive cap to avoid returning huge payloads
            if (matches.length >= limit * 5) break;

            // if we fetched less than a full page, no more pages
            if (products.length < limit) break;
          } catch (err: any) {
            console.error(`[bling search] error fetching page ${page}:`, err);
            return res.status(500).json({
              message: `Error fetching page ${page}: ${err?.message || String(err)}`,
            });
          }
        }

        res.json({ products: matches });
      } catch (error) {
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
      }
    },
  );

  app.get("/api/bling/products/:id", requireCompany, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const product = await import("./services/bling").then((m) =>
        m.fetchBlingProductDetails(id),
      );
      res.json({ product });
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  app.post(
    "/api/bling/products/:id/import",
    requireCompany,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const companyId = String(req.companyId || req.user.companyId);
        const result = await import("./services/bling").then((m) =>
          m.importBlingProductById(id, companyId),
        );
        res.json(result);
      } catch (error) {
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
      }
    },
  );

  app.post(
    "/api/bling/products/import",
    requireCompany,
    async (req: any, res) => {
      try {
        const { productIds } = req.body;
        if (!Array.isArray(productIds) || productIds.length === 0)
          return res
            .status(400)
            .json({ message: "productIds must be a non-empty array" });
        const companyId = String(req.companyId || req.user.companyId);

        // Start import in background so the HTTP request returns quickly
        // (prevents Railway / other platforms from timing out on long imports)
        const m = await import("./services/bling");
        if (m.importProductsInProgress) {
          return res
            .status(409)
            .json({ ok: false, message: "An import is already in progress" });
        }

        console.log(
          `[Bling] Starting background import for ${productIds.length} products for company ${companyId}`,
        );
        m.importBlingProductsByIds(productIds, companyId)
          .then((result) =>
            console.log("[Bling] Background import finished:", result),
          )
          .catch((err) =>
            console.error("[Bling] Background import failed:", err),
          );

        res.status(202).json({ ok: true, message: "Import started" });
      } catch (error) {
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
      }
    },
  );

  app.post(
    "/api/bling/products/:id/sync",
    requireCompany,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        // Re-import will update existing product
        const companyId = String(req.companyId || req.user.companyId);
        const result = await import("./services/bling").then((m) =>
          m.importBlingProductById(id, companyId),
        );
        res.json(result);
      } catch (error) {
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
      }
    },
  );

  // END: OAuth flow endpoints

  // =========================
  // Webhook endpoints management
  // =========================

  // List webhook endpoints for the authenticated company
  app.get(
    "/api/bling/webhook-endpoints",
    requireCompany,
    async (req: any, res) => {
      try {
        const companyId = String(req.companyId || req.user.companyId);
        const rows = await db
          .select()
          .from(blingWebhookEndpoints)
          .where(eq(blingWebhookEndpoints.companyId, companyId))
          .orderBy(desc(blingWebhookEndpoints.id));
        res.json(rows);
      } catch (error) {
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
      }
    },
  );

  // Create a new endpoint
  app.post(
    "/api/bling/webhook-endpoints",
    requireCompany,
    async (req: any, res) => {
      try {
        const { url, active } = req.body;
        const companyId = String(req.companyId || req.user.companyId);
        if (!url) return res.status(400).json({ message: "url is required" });
        const [inserted] = await db
          .insert(blingWebhookEndpoints)
          .values({
            companyId,
            url,
            active: active === undefined ? true : !!active,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        res.json({ ok: true, endpoint: inserted });
      } catch (error) {
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
      }
    },
  );

  // Delete an endpoint
  app.delete(
    "/api/bling/webhook-endpoints/:id",
    requireCompany,
    async (req: any, res) => {
      try {
        const companyId = String(req.companyId || req.user.companyId);
        const id = parseInt(req.params.id);
        await db
          .delete(blingWebhookEndpoints)
          .where(
            and(
              eq(blingWebhookEndpoints.id, id),
              eq(blingWebhookEndpoints.companyId, companyId),
            ),
          );
        res.json({ ok: true });
      } catch (error) {
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
      }
    },
  );

  // Test an endpoint (sends a test payload and records last status)
  app.post(
    "/api/bling/webhook-endpoints/:id/test",
    requireCompany,
    async (req: any, res) => {
      try {
        const companyId = String(req.companyId || req.user.companyId);
        const id = parseInt(req.params.id);
        const [endpoint] = await db
          .select()
          .from(blingWebhookEndpoints)
          .where(
            and(
              eq(blingWebhookEndpoints.id, id),
              eq(blingWebhookEndpoints.companyId, companyId),
            ),
          )
          .limit(1);
        if (!endpoint) return res.status(404).json({ message: "not found" });
        const testPayload = {
          event: "test.ping",
          timestamp: new Date().toISOString(),
        };
        const resp = await fetch(endpoint.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testPayload),
        });
        const body = await resp.text();
        await db
          .update(blingWebhookEndpoints)
          .set({
            lastStatusCode: resp.status,
            lastResponseBody: body,
            lastCalledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(blingWebhookEndpoints.id, id));
        res.json({ ok: true, status: resp.status, body: body });
      } catch (error) {
        res
          .status(500)
          .json({ message: (error as any).message || String(error) });
      }
    },
  );

  // Webhook receiver - validate signature and fan-out to company endpoints
  app.post(
    "/api/bling/webhook",
    express.raw({ type: "*/*" }),
    async (req: any, res) => {
      try {
        const signature = (req.headers["x-bling-signature-256"] ||
          req.headers["x-blingsignature"] ||
          "") as string;
        const payloadBuf =
          (req.rawBody as Buffer | undefined) || Buffer.from("");
        console.log(
          "[Bling] webhook incoming. signature len:",
          (signature || "").length,
          "payload len:",
          payloadBuf.length,
        );

        // Find company by validating signature against stored client secrets
        const creds = await db.select().from(blingCredentials);
        let matchedCompanyId: string | null = null;
        for (const c of creds) {
          const secret = c.clientSecret;
          if (!secret || !signature) continue;
          try {
            if (verifyWebhookSignature(payloadBuf, signature, secret)) {
              matchedCompanyId = c.companyId;
              console.log(
                "[Bling] signature matched for company:",
                matchedCompanyId,
              );
              break;
            }
          } catch (sigErr) {
            console.warn(
              "[Bling] signature check error for company",
              c.companyId,
              (sigErr as any).message,
            );
          }
        }

        if (!matchedCompanyId) {
          console.warn(
            "[Bling] Webhook received but no matching company by signature",
          );
          return res.status(403).send("Invalid signature");
        }

        // respond immediately
        res.status(200).send("OK");

        // Fan-out to configured endpoints (background) — handle errors locally so we don't try to modify response
        (async () => {
          try {
            const endpoints = await db
              .select()
              .from(blingWebhookEndpoints)
              .where(
                and(
                  eq(blingWebhookEndpoints.companyId, matchedCompanyId),
                  eq(blingWebhookEndpoints.active, true),
                ),
              );
            const payloadBody = payloadBuf.toString("utf8");
            await Promise.allSettled(
              endpoints.map(async (ep: any) => {
                try {
                  const r = await fetch(ep.url, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "X-Bling-Forwarded-Company": matchedCompanyId,
                    },
                    body: payloadBody,
                  });
                  const b = await r.text();
                  await db
                    .update(blingWebhookEndpoints)
                    .set({
                      lastStatusCode: r.status,
                      lastResponseBody: b,
                      lastCalledAt: new Date(),
                      updatedAt: new Date(),
                    })
                    .where(eq(blingWebhookEndpoints.id, ep.id));
                } catch (err: any) {
                  console.error(
                    "[Bling] Failed forwarding webhook to",
                    ep.url,
                    err && err.message ? err.message : err,
                  );
                  try {
                    await db
                      .update(blingWebhookEndpoints)
                      .set({
                        lastStatusCode: 0,
                        lastResponseBody: String(
                          err && err.message ? err.message : err,
                        ),
                        lastCalledAt: new Date(),
                        updatedAt: new Date(),
                      })
                      .where(eq(blingWebhookEndpoints.id, ep.id));
                  } catch (dbErr) {
                    console.error(
                      "[Bling] Failed updating endpoint status:",
                      dbErr,
                    );
                  }
                }
              }),
            );
          } catch (fanErr) {
            console.error("[Bling] Error during webhook fan-out:", fanErr);
          }
        })();
      } catch (error) {
        console.error("[Bling] Error handling webhook:", error);
        if (!res.headersSent) {
          res.status(500).send("Server error");
        } else {
          // response already sent; just log
          console.warn(
            "[Bling] Error occurred after response was sent; check logs for details.",
          );
        }
      }
    },
  );

  // ==========================================

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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  // GET: Listar tipos de pagamento ativos
  app.get("/api/orders", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
      const conditions = [
        eq(orders.companyId, String(req.companyId || req.user.companyId)),
      ];
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
          };
        }),
      );
      res.json(ordersWithDetails);
    } catch (error) {
      res.status(500).json({ message: "Erro: " + error.message });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
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
    } catch (error) {
      res
        .status(500)
        .json({ message: (error as any).message || String(error) });
    }
  });

  // ==========================================
  // Registrar rotas financeiras
  registerFinancialRoutes(app);

  return httpServer;
}
