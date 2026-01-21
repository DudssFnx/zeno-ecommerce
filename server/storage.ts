import {
  categories,
  type Category,
  type Coupon,
  coupons,
  customerCredits,
  type InsertCategory,
  type InsertOrder,
  type InsertOrderItem,
  type Order,
  type OrderItem,
  orderItems,
  orders,
  siteSettings,
} from "@shared/schema";
// IMPORTANTE: Importando o schema correto do arquivo modular e a tabela b2bUsers
import { b2bUsers } from "@shared/schema";
import { type B2bProduct, b2bProducts } from "@shared/schema/products.schema";
import bcrypt from "bcryptjs";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "./db";

async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

export interface IStorage {
  getUser(id: string): Promise<any | undefined>;
  getUserByEmail(email: string): Promise<any | undefined>;
  getUsers(): Promise<any[]>;
  upsertUser(userData: any): Promise<any>;
  updateUser(id: string, userData: any): Promise<any | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getProducts(f?: any): Promise<any>;
  getProduct(id: number): Promise<B2bProduct | undefined>;
  createProduct(insert: any): Promise<B2bProduct>;
}

export class DatabaseStorage implements IStorage {
  // --- USER METHODS (Sincronizados com b2b_users) ---
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

  async getUsers(): Promise<any[]> {
    return db.select().from(b2bUsers).orderBy(desc(b2bUsers.id));
  }

  async upsertUser(userData: any): Promise<any> {
    if (userData.password && !userData.password.startsWith("$2")) {
      userData.password = await hashPassword(userData.password);
    }
    const [user] = await db
      .insert(b2bUsers)
      .values(userData)
      .onConflictDoUpdate({
        target: b2bUsers.id,
        set: { ...userData, updatedAt: new Date() },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, userData: any): Promise<any | undefined> {
    const { createdAt, updatedAt, ...safeData } = userData as any;
    if (safeData.password && !safeData.password.startsWith("$2")) {
      safeData.password = await hashPassword(safeData.password);
    }
    const [user] = await db
      .update(b2bUsers)
      .set({ ...safeData, updatedAt: new Date() })
      .where(eq(b2bUsers.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    await db.delete(b2bUsers).where(eq(b2bUsers.id, id));
    return true;
  }

  // --- CATEGORIES ---
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }
  async getCategory(id: number): Promise<Category | undefined> {
    const [c] = await db.select().from(categories).where(eq(categories.id, id));
    return c;
  }
  async createCategory(insert: InsertCategory): Promise<Category> {
    const [c] = await db.insert(categories).values(insert).returning();
    return c;
  }
  async updateCategory(
    id: number,
    data: Partial<InsertCategory>
  ): Promise<Category | undefined> {
    const [c] = await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();
    return c;
  }
  async deleteCategory(id: number): Promise<boolean> {
    await db.delete(categories).where(eq(categories.id, id));
    return true;
  }

  // --- PRODUCTS (CORRIGIDO PARA B2B_PRODUCTS E BUSCA GLOBAL) ---
  async getProducts(f?: any): Promise<any> {
    try {
      const page = f?.page || 1;
      const limit = f?.limit || 100;
      const offset = (page - 1) * limit;
      const cond = [];

      if (f?.search) {
        cond.push(
          or(
            ilike(b2bProducts.nome, `%${f.search}%`),
            ilike(b2bProducts.sku, `%${f.search}%`)
          )
        );
      }

      // Busca sem filtros de empresa/categoria para garantir que os testes apareçam
      const list = await db
        .select()
        .from(b2bProducts)
        .where(cond.length > 0 ? and(...cond) : undefined)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(b2bProducts.id));

      const totalResult = await db
        .select({ count: count() })
        .from(b2bProducts)
        .where(cond.length > 0 ? and(...cond) : undefined);

      console.log(
        `[STORAGE] Sucesso: ${list.length} produtos carregados da b2b_products. Total no banco: ${totalResult[0].count}`
      );

      return {
        products: list,
        total: totalResult[0].count,
        page,
        totalPages: Math.ceil(totalResult[0].count / limit),
      };
    } catch (error) {
      console.error("[STORAGE ERROR] Falha ao listar b2b_products:", error);
      return { products: [], total: 0, page: 1, totalPages: 0 };
    }
  }

  async getProduct(id: number): Promise<B2bProduct | undefined> {
    const [p] = await db
      .select()
      .from(b2bProducts)
      .where(eq(b2bProducts.id, id));
    return p;
  }

  async createProduct(insert: any): Promise<B2bProduct> {
    try {
      // Mapeamento rigoroso para as colunas do PostgreSQL (snake_case)
      const dataToInsert = {
        nome: insert.nome || insert.name || "Produto Sem Nome",
        sku: insert.sku || `SKU-${Date.now()}`,
        unidadeMedida: insert.unidadeMedida || insert.unit || "UN",
        precoVarejo: String(insert.precoVarejo || insert.price || "0.00"),
        precoAtacado: String(
          insert.precoAtacado || insert.wholesalePrice || "0.00"
        ),
        descricao: insert.descricao || insert.description || "",
        imagem: insert.imagem || insert.image || insert.imageUrl || null,
        status: "ATIVO",
        disponibilidade: "DISPONIVEL",
      };

      console.log(
        "[STORAGE] Tentando gravar produto na b2b_products:",
        dataToInsert
      );

      const [p] = await db
        .insert(b2bProducts)
        .values(dataToInsert as any)
        .returning();

      console.log(`[STORAGE] Produto gravado com sucesso! ID: ${p.id}`);
      return p;
    } catch (error) {
      console.error(
        "[STORAGE ERROR] Falha crítica ao gravar na b2b_products:",
        error
      );
      throw error;
    }
  }

  // --- ORDERS & DETAILS ---
  async getOrders(uId?: string): Promise<Order[]> {
    const query = db.select().from(orders).orderBy(desc(orders.createdAt));
    return uId ? query.where(eq(orders.userId, uId)) : query;
  }

  async getOrderWithDetails(id: number): Promise<any | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const items = await this.getOrderItems(id);
    const customer = order.userId ? await this.getUser(order.userId) : null;

    return { order, items, customer };
  }

  async getNextOrderNumber(): Promise<number> {
    try {
      const res = await db.execute(
        sql`SELECT nextval('order_number_seq') as num`
      );
      return Number((res.rows[0] as any).num);
    } catch {
      const [lastOrder] = await db
        .select()
        .from(orders)
        .orderBy(desc(orders.id))
        .limit(1);
      return (lastOrder?.id || 0) + 1000;
    }
  }

  async createOrder(data: InsertOrder): Promise<Order> {
    const [o] = await db.insert(orders).values(data).returning();
    return o;
  }

  async getOrderItems(oId: number): Promise<OrderItem[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, oId));
  }

  async createOrderItem(data: InsertOrderItem): Promise<OrderItem> {
    const [i] = await db.insert(orderItems).values(data).returning();
    return i;
  }

  // --- CREDITS & BALANCE ---
  async getCustomerCreditBalance(uId: string): Promise<any> {
    const credits = await db
      .select()
      .from(customerCredits)
      .where(eq(customerCredits.userId, uId));

    return credits.reduce(
      (acc, curr) => {
        const val = parseFloat(curr.amount || "0");
        acc.total += val;
        if (curr.status === "pago") acc.paid += val;
        else acc.pending += val;
        return acc;
      },
      { total: 0, pending: 0, paid: 0 }
    );
  }

  // --- SETTINGS ---
  async getSiteSetting(key: string): Promise<any> {
    const [s] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, key));
    return s;
  }

  async setSiteSetting(key: string, value: string): Promise<any> {
    const [s] = await db
      .insert(siteSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value } })
      .returning();
    return s;
  }

  async getCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons);
  }
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [c] = await db.select().from(coupons).where(eq(coupons.code, code));
    return c;
  }
}

export const storage = new DatabaseStorage();
