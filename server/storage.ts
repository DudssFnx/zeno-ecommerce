import { b2bUsers, categories, siteSettings } from "@shared/schema";
import { type B2bProduct, b2bProducts } from "@shared/schema/products.schema";
import bcrypt from "bcryptjs";
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
  // NOVO: Método para verificar duplicidade
  checkDuplicate(
    sku: string,
    name: string,
    excludeId?: number,
  ): Promise<boolean>;
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

  // --- PRODUTOS ---
  async getProducts(f?: any): Promise<any> {
    try {
      const page = f?.page || 1;
      const limit = f?.limit || 100;
      const offset = (page - 1) * limit;

      const activeFilter = or(
        isNull(b2bProducts.status),
        ne(b2bProducts.status, "INATIVO"),
      );

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

      const formattedProducts = list.map((p) => ({
        ...p,
        name: p.nome,
        price: p.precoVarejo,
        image: p.imagem,
        description: p.descricao,
      }));

      console.log(
        `[STORAGE] Sucesso: ${formattedProducts.length} produtos recuperados.`,
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

  // NOVO: Implementação da verificação de duplicidade
  async checkDuplicate(
    sku: string,
    name: string,
    excludeId?: number,
  ): Promise<boolean> {
    // Procura por produto onde:
    // (SKU é igual OU Nome é igual) E (Status não é INATIVO)
    let condition = and(
      or(eq(b2bProducts.sku, sku), eq(b2bProducts.nome, name)),
      ne(b2bProducts.status, "INATIVO"),
    );

    // Se estiver editando (excludeId existe), ignora o próprio produto na busca
    if (excludeId) {
      condition = and(condition, ne(b2bProducts.id, excludeId));
    }

    const [existing] = await db
      .select()
      .from(b2bProducts)
      .where(condition)
      .limit(1);

    // Retorna true se achou duplicata, false se não achou
    return !!existing;
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
