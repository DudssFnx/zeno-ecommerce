import { b2bUsers, categories, siteSettings } from "@shared/schema";
import { type B2bProduct, b2bProducts } from "@shared/schema/products.schema";
import bcrypt from "bcryptjs";
// CORREÇÃO 1: Adicionado 'desc' na lista de imports
import { and, count, desc, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "./db";

async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

export interface IStorage {
  getUser(id: string): Promise<any | undefined>;
  getUserByEmail(email: string): Promise<any | undefined>;
  getProducts(f?: any): Promise<any>;
  createProduct(insert: any): Promise<B2bProduct>;
  getCategories(): Promise<any[]>;
  getSiteSetting(key: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // --- USUÁRIOS ---
  async getUser(id: string): Promise<any | undefined> {
    const [user] = await db.select().from(b2bUsers).where(eq(b2bUsers.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<any | undefined> {
    const [user] = await db
      .select()
      .from(b2bUsers)
      .where(eq(b2bUsers.email, email.toLowerCase()));
    return user;
  }

  // --- PRODUTOS (MAPEAMENTO RESILIENTE PARA FRONTEND) ---
  async getProducts(f?: any): Promise<any> {
    try {
      const page = f?.page || 1;
      const limit = f?.limit || 100;
      const offset = (page - 1) * limit;

      // FILTRO NATIVO: Muito mais seguro que SQL manual
      // Traz produtos se: Status não existe (null) OU Status não é "excluído"
      const activeFilter = or(
        isNull(b2bProducts.status),
        and(
          ne(b2bProducts.status, "DELETED" as any),
          ne(b2bProducts.status, "EXCLUIDO" as any),
          ne(b2bProducts.status, "INATIVO"), // <--- Importante: filtra os inativos
        ),
      );

      // CORREÇÃO 2: Restaurada paginação e ordenação que faltavam
      const list = await db
        .select()
        .from(b2bProducts)
        .where(activeFilter)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(b2bProducts.id));

      const totalResult = await db
        .select({ count: count() })
        .from(b2bProducts)
        .where(activeFilter);

      // MAPEAMENTO CRÍTICO
      const formattedProducts = list.map((p) => ({
        ...p,
        name: p.nome,
        price: p.precoVarejo,
        image: p.imagem,
        description: p.descricao,
      }));

      console.log(
        `[STORAGE] Sucesso: ${formattedProducts.length} produtos ativos recuperados.`,
      );

      return Object.assign(formattedProducts, {
        products: formattedProducts,
        total: totalResult[0].count,
        page,
        totalPages: Math.ceil(totalResult[0].count / limit),
      });
    } catch (error) {
      console.error("[STORAGE ERROR] Falha ao listar b2b_products:", error);
      return [];
    }
  }

  async createProduct(insert: any): Promise<B2bProduct> {
    try {
      const dataToInsert = {
        nome: insert.nome || insert.name || "Sem Nome",
        sku: insert.sku || `SKU-${Date.now()}`,
        unidadeMedida: insert.unidadeMedida || "UN",
        precoVarejo: String(insert.precoVarejo || insert.price || "0.00"),
        precoAtacado: String(
          insert.precoAtacado || insert.wholesalePrice || "0.00",
        ),
        descricao: insert.descricao || insert.description || "",
        imagem: insert.imagem || insert.image || insert.imageUrl || null,
        status: "ATIVO",
        disponibilidade: "DISPONIVEL",
        companyId: insert.companyId || "comp-tec-01",
      };

      const [p] = await db
        .insert(b2bProducts)
        .values(dataToInsert as any)
        .returning();

      console.log(`[STORAGE] Produto gravado com sucesso! ID: ${p.id}`);
      return p;
    } catch (error) {
      console.error("[STORAGE ERROR] Falha no insert:", error);
      throw error;
    }
  }

  // --- MÉTODOS ADICIONAIS ---
  async getCategories() {
    return db.select().from(categories);
  }

  async getSiteSetting(key: string) {
    const [s] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, key));
    return s;
  }
}

export const storage = new DatabaseStorage();
