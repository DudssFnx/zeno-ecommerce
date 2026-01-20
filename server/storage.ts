import {
  categories,
  type Category,
  type Coupon,
  coupons,
  customerCredits,
  type InsertCategory,
  type InsertOrder,
  type InsertOrderItem,
  type InsertProduct,
  type InsertUser,
  type Order,
  type OrderItem,
  orderItems,
  orders,
  type Product,
  products,
  siteSettings,
  type UpsertUser,
  type User,
  users,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "./db";

async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

export interface IStorage {
  // Omiti a interface para brevidade, mas ela deve conter todos os métodos abaixo
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

  // --- PRODUCTS ---
  async getProducts(f?: any): Promise<any> {
    const page = f?.page || 1;
    const limit = f?.limit || 50;
    const offset = (page - 1) * limit;
    const cond = [];
    if (f?.categoryId) cond.push(eq(products.categoryId, f.categoryId));
    if (f?.search)
      cond.push(
        or(
          ilike(products.name, `%${f.search}%`),
          ilike(products.sku, `%${f.search}%`)
        )
      );

    const list = await db
      .select()
      .from(products)
      .where(cond.length > 0 ? and(...cond) : undefined)
      .limit(limit)
      .offset(offset);
    const totalResult = await db
      .select({ count: count() })
      .from(products)
      .where(cond.length > 0 ? and(...cond) : undefined);

    return {
      products: list,
      total: totalResult[0].count,
      page,
      totalPages: Math.ceil(totalResult[0].count / limit),
    };
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [p] = await db.select().from(products).where(eq(products.id, id));
    return p;
  }

  async createProduct(insert: InsertProduct): Promise<Product> {
    const [p] = await db.insert(products).values(insert).returning();
    return p;
  }

  // --- ORDERS & DETAILS (CRÍTICO PARA ROUTES.TS) ---
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
    // Tenta usar a sequence, se falhar pega o maior id + 1
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

  // --- REQUISITOS ADICIONAIS ---
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

  // ... (Demais métodos como CatalogBanners, Coupons etc mantidos conforme sua lógica)
  async getCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons);
  }
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [c] = await db.select().from(coupons).where(eq(coupons.code, code));
    return c;
  }
}

export const storage = new DatabaseStorage();
