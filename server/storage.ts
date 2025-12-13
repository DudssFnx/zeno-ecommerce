import { 
  type User, type InsertUser, type UpsertUser,
  type Category, type InsertCategory,
  type Product, type InsertProduct,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type PriceTable, type InsertPriceTable,
  type CustomerPrice, type InsertCustomerPrice,
  type Coupon, type InsertCoupon,
  users, categories, products, orders, orderItems, priceTables, customerPrices, coupons
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, ilike, and, or, sql, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;

  // Products
  getProducts(filters?: { categoryId?: number; search?: string; page?: number; limit?: number }): Promise<{ products: Product[]; total: number; page: number; totalPages: number }>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Orders
  getOrders(userId?: string): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderWithDetails(id: number): Promise<{
    order: Order;
    items: Array<OrderItem & { product: { id: number; name: string; sku: string; image: string | null; price: string } }>;
    customer: { id: string; firstName: string | null; lastName: string | null; company: string | null; email: string | null; phone: string | null; city: string | null; state: string | null };
  } | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>;

  // Order Items
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;

  // Price Tables
  getPriceTables(): Promise<PriceTable[]>;
  getPriceTable(id: number): Promise<PriceTable | undefined>;
  createPriceTable(table: InsertPriceTable): Promise<PriceTable>;
  updatePriceTable(id: number, table: Partial<InsertPriceTable>): Promise<PriceTable | undefined>;
  deletePriceTable(id: number): Promise<boolean>;

  // Customer Prices
  getCustomerPrices(userId: string): Promise<CustomerPrice[]>;
  setCustomerPrice(price: InsertCustomerPrice): Promise<CustomerPrice>;
  deleteCustomerPrice(id: number): Promise<boolean>;

  // Coupons
  getCoupons(): Promise<Coupon[]>;
  getCoupon(id: number): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: number): Promise<boolean>;
  incrementCouponUsage(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
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
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set({ ...userData, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    await db.delete(users).where(eq(users.id, id));
    return true;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(insertCategory).returning();
    return category;
  }

  async updateCategory(id: number, categoryData: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db.update(categories).set(categoryData).where(eq(categories.id, id)).returning();
    return category;
  }

  async deleteCategory(id: number): Promise<boolean> {
    await db.delete(categories).where(eq(categories.id, id));
    return true;
  }

  // Products
  async getProducts(filters?: { categoryId?: number; search?: string; page?: number; limit?: number }): Promise<{ products: Product[]; total: number; page: number; totalPages: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;
    
    const conditions = [];
    if (filters?.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.sku, `%${filters.search}%`),
          ilike(products.brand, `%${filters.search}%`)
        )
      );
    }

    let productList: Product[];
    let totalResult: { count: number }[];
    
    if (conditions.length > 0) {
      const whereClause = and(...conditions);
      productList = await db.select().from(products).where(whereClause).orderBy(products.name).limit(limit).offset(offset);
      totalResult = await db.select({ count: count() }).from(products).where(whereClause);
    } else {
      productList = await db.select().from(products).orderBy(products.name).limit(limit).offset(offset);
      totalResult = await db.select({ count: count() }).from(products);
    }
    
    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);
    
    return { products: productList, total, page, totalPages };
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: number, productData: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products).set(productData).where(eq(products.id, id)).returning();
    return product;
  }

  async deleteProduct(id: number): Promise<boolean> {
    await db.delete(products).where(eq(products.id, id));
    return true;
  }

  // Orders
  async getOrders(userId?: string): Promise<Order[]> {
    if (userId) {
      return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
    }
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderWithDetails(id: number): Promise<{
    order: Order;
    items: Array<OrderItem & { product: { id: number; name: string; sku: string; image: string | null; price: string } }>;
    customer: { id: string; firstName: string | null; lastName: string | null; company: string | null; email: string | null; phone: string | null; city: string | null; state: string | null };
  } | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const [customer] = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      company: users.company,
      email: users.email,
      phone: users.phone,
      city: users.city,
      state: users.state,
    }).from(users).where(eq(users.id, order.userId));

    const itemsWithProducts = await db.select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      price: orderItems.price,
      product: {
        id: products.id,
        name: products.name,
        sku: products.sku,
        image: products.image,
        price: products.price,
      },
    }).from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, id));

    const items = itemsWithProducts.map(item => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      product: item.product || { id: item.productId, name: 'Produto não encontrado', sku: '', image: null, price: item.price },
    }));

    return {
      order,
      items,
      customer: customer || { id: order.userId, firstName: null, lastName: null, company: null, email: null, phone: null, city: null, state: null },
    };
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values(insertOrder).returning();
    return order;
  }

  async updateOrder(id: number, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    const [order] = await db.update(orders).set(orderData).where(eq(orders.id, id)).returning();
    return order;
  }

  // Order Items
  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(insertItem: InsertOrderItem): Promise<OrderItem> {
    const [item] = await db.insert(orderItems).values(insertItem).returning();
    return item;
  }

  // Price Tables
  async getPriceTables(): Promise<PriceTable[]> {
    return db.select().from(priceTables).orderBy(priceTables.name);
  }

  async getPriceTable(id: number): Promise<PriceTable | undefined> {
    const [table] = await db.select().from(priceTables).where(eq(priceTables.id, id));
    return table;
  }

  async createPriceTable(table: InsertPriceTable): Promise<PriceTable> {
    const [created] = await db.insert(priceTables).values(table).returning();
    return created;
  }

  async updatePriceTable(id: number, tableData: Partial<InsertPriceTable>): Promise<PriceTable | undefined> {
    const [updated] = await db.update(priceTables).set(tableData).where(eq(priceTables.id, id)).returning();
    return updated;
  }

  async deletePriceTable(id: number): Promise<boolean> {
    await db.delete(priceTables).where(eq(priceTables.id, id));
    return true;
  }

  // Customer Prices
  async getCustomerPrices(userId: string): Promise<CustomerPrice[]> {
    return db.select().from(customerPrices).where(eq(customerPrices.userId, userId));
  }

  async setCustomerPrice(priceData: InsertCustomerPrice): Promise<CustomerPrice> {
    const existing = await db.select().from(customerPrices)
      .where(and(eq(customerPrices.userId, priceData.userId), eq(customerPrices.productId, priceData.productId)));
    
    if (existing.length > 0) {
      const [updated] = await db.update(customerPrices)
        .set({ customPrice: priceData.customPrice })
        .where(eq(customerPrices.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(customerPrices).values(priceData).returning();
    return created;
  }

  async deleteCustomerPrice(id: number): Promise<boolean> {
    await db.delete(customerPrices).where(eq(customerPrices.id, id));
    return true;
  }

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  async getCoupon(id: number): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id));
    return coupon;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    return coupon;
  }

  async createCoupon(couponData: InsertCoupon): Promise<Coupon> {
    const [created] = await db.insert(coupons).values({ ...couponData, code: couponData.code.toUpperCase() }).returning();
    return created;
  }

  async updateCoupon(id: number, couponData: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const updateData = couponData.code ? { ...couponData, code: couponData.code.toUpperCase() } : couponData;
    const [updated] = await db.update(coupons).set(updateData).where(eq(coupons.id, id)).returning();
    return updated;
  }

  async deleteCoupon(id: number): Promise<boolean> {
    await db.delete(coupons).where(eq(coupons.id, id));
    return true;
  }

  async incrementCouponUsage(id: number): Promise<void> {
    await db.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.id, id));
  }
}

export const storage = new DatabaseStorage();
