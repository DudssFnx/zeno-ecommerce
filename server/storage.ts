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

  // Customer Analytics
  getCustomerAnalytics(): Promise<CustomerAnalyticsData>;
}

// Customer Analytics Types
export interface CustomerRanking {
  userId: string;
  name: string;
  company: string | null;
  email: string | null;
  totalRevenue: number;
  orderCount: number;
  avgTicket: number;
  lastOrderDate: Date | null;
  daysSinceLastOrder: number;
  firstOrderDate: Date | null;
}

export interface RFMSegment {
  userId: string;
  name: string;
  company: string | null;
  recency: number;
  frequency: number;
  monetary: number;
  rfmScore: string;
  segment: string;
}

export interface InactiveCustomer {
  userId: string;
  name: string;
  company: string | null;
  email: string | null;
  lastOrderDate: Date;
  daysSinceLastOrder: number;
  avgDaysBetweenOrders: number;
  churnRisk: 'low' | 'medium' | 'high';
  totalSpent: number;
  orderCount: number;
}

export interface CustomerAnalyticsData {
  topCustomersByRevenue: {
    month: CustomerRanking[];
    quarter: CustomerRanking[];
    year: CustomerRanking[];
  };
  topCustomersByFrequency: CustomerRanking[];
  abcAnalysis: {
    a: CustomerRanking[];
    b: CustomerRanking[];
    c: CustomerRanking[];
  };
  inactiveCustomers: {
    days7: InactiveCustomer[];
    days15: InactiveCustomer[];
    days30: InactiveCustomer[];
    days60: InactiveCustomer[];
    days90: InactiveCustomer[];
  };
  reactivatedThisMonth: CustomerRanking[];
  newCustomersThisMonth: CustomerRanking[];
  rfmSegments: RFMSegment[];
  avgDaysBetweenOrders: number;
  cohortRetention: {
    days30: number;
    days60: number;
    days90: number;
  };
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

  async getCustomerPurchaseStats(userId: string): Promise<{
    totalSpent: number;
    totalOrders: number;
    completedOrders: number;
    monthlyStats: Array<{ month: string; total: number; count: number }>;
    topProducts: Array<{ productId: number; name: string; totalQuantity: number; totalValue: number }>;
  }> {
    const userOrders = await db.select().from(orders).where(eq(orders.userId, userId));
    
    const totalSpent = userOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const totalOrders = userOrders.length;
    const completedStatuses = ['PEDIDO_FATURADO', 'completed'];
    const completedOrders = userOrders.filter(o => completedStatuses.includes(o.status)).length;

    const monthlyMap = new Map<string, { total: number; count: number }>();
    for (const o of userOrders) {
      const date = new Date(o.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const curr = monthlyMap.get(key) || { total: 0, count: 0 };
      curr.total += parseFloat(o.total);
      curr.count += 1;
      monthlyMap.set(key, curr);
    }
    const monthlyStats = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 6);

    const orderIds = userOrders.map(o => o.id);
    let topProducts: Array<{ productId: number; name: string; totalQuantity: number; totalValue: number }> = [];
    
    if (orderIds.length > 0) {
      const items = await db.select({
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        name: products.name,
      }).from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(sql`${orderItems.orderId} = ANY(${orderIds})`);

      const productMap = new Map<number, { name: string; totalQuantity: number; totalValue: number }>();
      for (const item of items) {
        const curr = productMap.get(item.productId) || { name: item.name || 'Produto', totalQuantity: 0, totalValue: 0 };
        curr.totalQuantity += item.quantity;
        curr.totalValue += item.quantity * parseFloat(item.price);
        productMap.set(item.productId, curr);
      }
      topProducts = Array.from(productMap.entries())
        .map(([productId, data]) => ({ productId, ...data }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 5);
    }

    return { totalSpent, totalOrders, completedOrders, monthlyStats, topProducts };
  }

  async getAdminSalesStats(): Promise<{
    totalRevenue: number;
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    averageOrderValue: number;
    monthlyRevenue: Array<{ month: string; revenue: number; orders: number }>;
    topProducts: Array<{ productId: number; name: string; totalQuantity: number; totalValue: number }>;
    ordersByStatus: Array<{ status: string; count: number }>;
  }> {
    const allOrders = await db.select().from(orders);
    
    const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const totalOrders = allOrders.length;
    const completedStatuses = ['PEDIDO_FATURADO', 'completed'];
    const pendingStatuses = ['ORCAMENTO_ABERTO', 'ORCAMENTO_CONCLUIDO', 'pending'];
    const completedOrders = allOrders.filter(o => completedStatuses.includes(o.status)).length;
    const pendingOrders = allOrders.filter(o => pendingStatuses.includes(o.status)).length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const monthlyMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of allOrders) {
      const date = new Date(o.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const curr = monthlyMap.get(key) || { revenue: 0, orders: 0 };
      curr.revenue += parseFloat(o.total);
      curr.orders += 1;
      monthlyMap.set(key, curr);
    }
    const monthlyRevenue = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    const statusMap = new Map<string, number>();
    for (const o of allOrders) {
      statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1);
    }
    const ordersByStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }));

    const orderIds = allOrders.map(o => o.id);
    let topProducts: Array<{ productId: number; name: string; totalQuantity: number; totalValue: number }> = [];
    
    if (orderIds.length > 0) {
      const items = await db.select({
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        name: products.name,
      }).from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(sql`${orderItems.orderId} = ANY(${orderIds})`);

      const productMap = new Map<number, { name: string; totalQuantity: number; totalValue: number }>();
      for (const item of items) {
        const curr = productMap.get(item.productId) || { name: item.name || 'Produto', totalQuantity: 0, totalValue: 0 };
        curr.totalQuantity += item.quantity;
        curr.totalValue += item.quantity * parseFloat(item.price);
        productMap.set(item.productId, curr);
      }
      topProducts = Array.from(productMap.entries())
        .map(([productId, data]) => ({ productId, ...data }))
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 10);
    }

    return { totalRevenue, totalOrders, completedOrders, pendingOrders, averageOrderValue, monthlyRevenue, topProducts, ordersByStatus };
  }

  async getCustomerAnalytics(): Promise<CustomerAnalyticsData> {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allCustomers = await db.select().from(users).where(eq(users.role, 'customer'));
    const allOrders = await db.select().from(orders);

    const customerOrdersMap = new Map<string, Order[]>();
    for (const order of allOrders) {
      const existing = customerOrdersMap.get(order.userId) || [];
      existing.push(order);
      customerOrdersMap.set(order.userId, existing);
    }

    const buildRanking = (customerOrders: Order[], user: User): CustomerRanking => {
      const totalRevenue = customerOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
      const orderCount = customerOrders.length;
      const avgTicket = orderCount > 0 ? totalRevenue / orderCount : 0;
      const sortedOrders = [...customerOrders].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const lastOrderDate = sortedOrders.length > 0 ? new Date(sortedOrders[0].createdAt) : null;
      const firstOrderDate = sortedOrders.length > 0 ? new Date(sortedOrders[sortedOrders.length - 1].createdAt) : null;
      const daysSinceLastOrder = lastOrderDate ? Math.floor((now.getTime() - lastOrderDate.getTime()) / (24 * 60 * 60 * 1000)) : 9999;

      return {
        userId: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Cliente',
        company: user.company,
        email: user.email,
        totalRevenue,
        orderCount,
        avgTicket,
        lastOrderDate,
        daysSinceLastOrder,
        firstOrderDate,
      };
    };

    const customerRankings: CustomerRanking[] = [];
    for (const user of allCustomers) {
      const customerOrders = customerOrdersMap.get(user.id) || [];
      if (customerOrders.length > 0) {
        customerRankings.push(buildRanking(customerOrders, user));
      }
    }

    const filterByDate = (rankings: CustomerRanking[], since: Date) => {
      return allCustomers.map(user => {
        const customerOrders = (customerOrdersMap.get(user.id) || [])
          .filter(o => new Date(o.createdAt) >= since);
        if (customerOrders.length === 0) return null;
        return buildRanking(customerOrders, user);
      }).filter((r): r is CustomerRanking => r !== null)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 20);
    };

    const topCustomersByRevenue = {
      month: filterByDate(customerRankings, oneMonthAgo),
      quarter: filterByDate(customerRankings, threeMonthsAgo),
      year: filterByDate(customerRankings, oneYearAgo),
    };

    const topCustomersByFrequency = [...customerRankings]
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 20);

    const sortedByRevenue = [...customerRankings].sort((a, b) => b.totalRevenue - a.totalRevenue);
    const totalRevenue = sortedByRevenue.reduce((sum, c) => sum + c.totalRevenue, 0);
    let cumulative = 0;
    const abcAnalysis = { a: [] as CustomerRanking[], b: [] as CustomerRanking[], c: [] as CustomerRanking[] };
    for (const customer of sortedByRevenue) {
      cumulative += customer.totalRevenue;
      const percent = (cumulative / totalRevenue) * 100;
      if (percent <= 80) abcAnalysis.a.push(customer);
      else if (percent <= 95) abcAnalysis.b.push(customer);
      else abcAnalysis.c.push(customer);
    }

    const calculateAvgDaysBetween = (customerOrders: Order[]): number => {
      if (customerOrders.length < 2) return 0;
      const sorted = [...customerOrders].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      let totalDays = 0;
      for (let i = 1; i < sorted.length; i++) {
        totalDays += (new Date(sorted[i].createdAt).getTime() - new Date(sorted[i-1].createdAt).getTime()) / (24 * 60 * 60 * 1000);
      }
      return totalDays / (sorted.length - 1);
    };

    const buildInactiveCustomer = (ranking: CustomerRanking, avgDays: number): InactiveCustomer => {
      let churnRisk: 'low' | 'medium' | 'high' = 'low';
      if (avgDays > 0 && ranking.daysSinceLastOrder > avgDays * 1.5) churnRisk = 'high';
      else if (avgDays > 0 && ranking.daysSinceLastOrder > avgDays) churnRisk = 'medium';
      else if (ranking.daysSinceLastOrder > 60) churnRisk = 'high';
      else if (ranking.daysSinceLastOrder > 30) churnRisk = 'medium';

      return {
        userId: ranking.userId,
        name: ranking.name,
        company: ranking.company,
        email: ranking.email,
        lastOrderDate: ranking.lastOrderDate!,
        daysSinceLastOrder: ranking.daysSinceLastOrder,
        avgDaysBetweenOrders: avgDays,
        churnRisk,
        totalSpent: ranking.totalRevenue,
        orderCount: ranking.orderCount,
      };
    };

    const inactiveCustomers = { days7: [] as InactiveCustomer[], days15: [] as InactiveCustomer[], days30: [] as InactiveCustomer[], days60: [] as InactiveCustomer[], days90: [] as InactiveCustomer[] };
    for (const ranking of customerRankings) {
      if (ranking.lastOrderDate) {
        const avgDays = calculateAvgDaysBetween(customerOrdersMap.get(ranking.userId) || []);
        const inactive = buildInactiveCustomer(ranking, avgDays);
        if (ranking.daysSinceLastOrder >= 7) inactiveCustomers.days7.push(inactive);
        if (ranking.daysSinceLastOrder >= 15) inactiveCustomers.days15.push(inactive);
        if (ranking.daysSinceLastOrder >= 30) inactiveCustomers.days30.push(inactive);
        if (ranking.daysSinceLastOrder >= 60) inactiveCustomers.days60.push(inactive);
        if (ranking.daysSinceLastOrder >= 90) inactiveCustomers.days90.push(inactive);
      }
    }
    Object.values(inactiveCustomers).forEach(list => list.sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder));

    const newCustomersThisMonth = allCustomers
      .filter(u => new Date(u.createdAt) >= startOfMonth)
      .map(user => {
        const customerOrders = customerOrdersMap.get(user.id) || [];
        return buildRanking(customerOrders, user);
      })
      .filter(r => r.orderCount > 0);

    const reactivatedThisMonth: CustomerRanking[] = [];
    for (const user of allCustomers) {
      const customerOrders = customerOrdersMap.get(user.id) || [];
      if (customerOrders.length < 2) continue;
      const sorted = [...customerOrders].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const lastOrder = new Date(sorted[0].createdAt);
      const previousOrder = new Date(sorted[1].createdAt);
      if (lastOrder >= startOfMonth && (lastOrder.getTime() - previousOrder.getTime()) > 60 * 24 * 60 * 60 * 1000) {
        reactivatedThisMonth.push(buildRanking(customerOrders, user));
      }
    }

    const maxRecency = Math.max(...customerRankings.map(c => c.daysSinceLastOrder).filter(d => d < 9999), 1);
    const maxFrequency = Math.max(...customerRankings.map(c => c.orderCount), 1);
    const maxMonetary = Math.max(...customerRankings.map(c => c.totalRevenue), 1);

    const rfmSegments: RFMSegment[] = customerRankings.map(c => {
      const rScore = Math.ceil(5 - (c.daysSinceLastOrder / maxRecency) * 4);
      const fScore = Math.ceil((c.orderCount / maxFrequency) * 5);
      const mScore = Math.ceil((c.totalRevenue / maxMonetary) * 5);
      const rfmScore = `${Math.max(1, Math.min(5, rScore))}${Math.max(1, Math.min(5, fScore))}${Math.max(1, Math.min(5, mScore))}`;
      
      let segment = 'Regular';
      const r = Math.max(1, Math.min(5, rScore));
      const f = Math.max(1, Math.min(5, fScore));
      const m = Math.max(1, Math.min(5, mScore));
      
      if (r >= 4 && f >= 4 && m >= 4) segment = 'VIP';
      else if (r >= 4 && f >= 3) segment = 'Recente e Frequente';
      else if (r <= 2 && m >= 4) segment = 'Alto Valor Sumido';
      else if (r <= 2 && f <= 2 && m <= 2) segment = 'Baixo Engajamento';
      else if (r >= 4) segment = 'Novo/Recente';
      else if (m >= 4) segment = 'Alto Valor';
      else if (f >= 4) segment = 'Frequente';

      return {
        userId: c.userId,
        name: c.name,
        company: c.company,
        recency: c.daysSinceLastOrder,
        frequency: c.orderCount,
        monetary: c.totalRevenue,
        rfmScore,
        segment,
      };
    });

    let totalAvgDays = 0;
    let countWithMultiple = 0;
    for (const [, customerOrders] of customerOrdersMap) {
      if (customerOrders.length >= 2) {
        totalAvgDays += calculateAvgDaysBetween(customerOrders);
        countWithMultiple++;
      }
    }
    const avgDaysBetweenOrders = countWithMultiple > 0 ? totalAvgDays / countWithMultiple : 0;

    const firstTimeCustomers = allCustomers.filter(u => {
      const customerOrders = customerOrdersMap.get(u.id) || [];
      return customerOrders.length === 1;
    });
    
    const cohortRetention = { days30: 0, days60: 0, days90: 0 };
    for (const user of allCustomers) {
      const customerOrders = customerOrdersMap.get(user.id) || [];
      if (customerOrders.length < 1) continue;
      const sorted = [...customerOrders].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const firstOrder = new Date(sorted[0].createdAt);
      if (customerOrders.length >= 2) {
        const secondOrder = new Date(sorted[1].createdAt);
        const daysBetween = (secondOrder.getTime() - firstOrder.getTime()) / (24 * 60 * 60 * 1000);
        if (daysBetween <= 30) cohortRetention.days30++;
        if (daysBetween <= 60) cohortRetention.days60++;
        if (daysBetween <= 90) cohortRetention.days90++;
      }
    }
    const totalWithOrders = customerRankings.length;
    if (totalWithOrders > 0) {
      cohortRetention.days30 = Math.round((cohortRetention.days30 / totalWithOrders) * 100);
      cohortRetention.days60 = Math.round((cohortRetention.days60 / totalWithOrders) * 100);
      cohortRetention.days90 = Math.round((cohortRetention.days90 / totalWithOrders) * 100);
    }

    return {
      topCustomersByRevenue,
      topCustomersByFrequency,
      abcAnalysis,
      inactiveCustomers,
      reactivatedThisMonth,
      newCustomersThisMonth,
      rfmSegments,
      avgDaysBetweenOrders,
      cohortRetention,
    };
  }
}

export const storage = new DatabaseStorage();
