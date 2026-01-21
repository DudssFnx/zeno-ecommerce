import {
  categories,
  type Category,
  type Coupon,
  coupons,
  customerCredits,
  type InsertCategory,
  type InsertOrder,
  type InsertOrderItem,
  type InsertUser,
  type Order,
  type OrderItem,
  orderItems,
  orders,
  siteSettings,
  type UpsertUser,
  type User,
  users,
} from "@shared/schema";
// IMPORTANTE: Importando o schema correto do arquivo modular
import { type B2bProduct, b2bProducts } from "@shared/schema/products.schema";
import bcrypt from "bcryptjs";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "./db";

async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

export interface IStorage {
  // Métodos definidos na classe abaixo
}

export class DatabaseStorage implements IStorage {
  // --- USER METHODS ---
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (userData.password && !userData.password.startsWith("$2")) {
      userData.password = await hashPassword(userData.password);
    }
    const [user] = await db
      .insert(users)
      .values(userData as any)
      .onConflictDoUpdate({
        target: users.id,
        set: { ...userData, updatedAt: new Date() },
      })
      .returning();
    return user;
  }

  async updateUser(
    id: string,
    userData: Partial<InsertUser>
  ): Promise<User | undefined> {
    const { createdAt, updatedAt, ...safeData } = userData as any;
    if (safeData.password && !safeData.password.startsWith("$2")) {
      safeData.password = await hashPassword(safeData.password);
    }
    const [user] = await db
      .update(users)
      .set({ ...safeData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    await db.delete(users).where(eq(users.id, id));
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

  // --- PRODUCTS (CORRIGIDO PARA B2B_PRODUCTS) ---
  async getProducts(f?: any): Promise<any> {
    try {
      const page = f?.page || 1;
      const limit = f?.limit || 100;
      const offset = (page - 1) * limit;
      const cond = [];

      // Mapeamento para as colunas em português do b2b_products
      if (f?.search) {
        cond.push(
          or(
            ilike(b2bProducts.nome, `%${f.search}%`),
            ilike(b2bProducts.sku, `%${f.search}%`)
          )
        );
      }

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
        `[STORAGE] Sucesso: ${list.length} produtos carregados da b2b_products.`
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
      // Mapeamento de campos do Frontend para o Banco (Português)
      const dataToInsert = {
        nome: insert.nome || insert.name,
        sku: insert.sku,
        unidadeMedida: insert.unidadeMedida || "UN",
        precoVarejo: insert.precoVarejo || insert.price || "0.00",
        precoAtacado: insert.precoAtacado || insert.wholesalePrice || "0.00",
        descricao: insert.descricao || insert.description,
        // GARANTIA PARA IMAGEM: Aceita múltiplos nomes de campo do Front
        imagem:
          insert.imagem || insert.image || insert.imageUrl || insert.photo,
        status: "ATIVO",
        disponibilidade: "DISPONIVEL",
      };

      const [p] = await db
        .insert(b2bProducts)
        .values(dataToInsert as any)
        .returning();
      console.log(`[STORAGE] Produto gravado na b2b_products: ${p.nome}`);
      return p;
    } catch (error) {
      console.error("[STORAGE ERROR] Falha ao gravar na b2b_products:", error);
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
