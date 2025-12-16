import { 
  type User, type InsertUser, type UpsertUser,
  type Category, type InsertCategory,
  type Product, type InsertProduct,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type PriceTable, type InsertPriceTable,
  type CustomerPrice, type InsertCustomerPrice,
  type Coupon, type InsertCoupon,
  type AgendaEvent, type InsertAgendaEvent,
  users, categories, products, orders, orderItems, priceTables, customerPrices, coupons, agendaEvents
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
  getCategoryByBlingId(blingId: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;

  // Products
  getProducts(filters?: { categoryId?: number; search?: string; page?: number; limit?: number; sort?: string }): Promise<{ products: Product[]; total: number; page: number; totalPages: number }>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Orders
  getOrders(userId?: string): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderWithDetails(id: number): Promise<{
    order: Order;
    items: Array<OrderItem & { product: { id: number; name: string; sku: string; image: string | null; price: string } }>;
    customer: { 
      id: string; 
      firstName: string | null; 
      lastName: string | null; 
      company: string | null; 
      tradingName: string | null;
      stateRegistration: string | null;
      email: string | null; 
      phone: string | null; 
      personType: string | null;
      cnpj: string | null;
      cpf: string | null;
      cep: string | null;
      address: string | null;
      addressNumber: string | null;
      complement: string | null;
      neighborhood: string | null;
      city: string | null; 
      state: string | null;
    };
  } | undefined>;
  getNextOrderNumber(): Promise<number>;
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

  // Product Analytics
  getProductAnalytics(): Promise<ProductAnalyticsData>;

  // Purchases Analytics (for purchasing/restocking decisions)
  getPurchasesAnalytics(): Promise<PurchasesAnalyticsData>;

  // Employee Analytics
  getEmployeeAnalytics(): Promise<EmployeeAnalyticsData>;

  // Stock Management
  reserveStockForOrder(orderId: number, userId: string): Promise<{ success: boolean; error?: string }>;
  releaseStockForOrder(orderId: number): Promise<{ success: boolean; error?: string }>;
  deductStockForOrder(orderId: number, userId: string): Promise<{ success: boolean; error?: string }>;
  
  // Stage Management
  updateOrderStage(orderId: number, stage: string): Promise<{ success: boolean; error?: string }>;

  // Agenda Events
  getAgendaEvents(filters?: { startDate?: Date; endDate?: Date }): Promise<AgendaEvent[]>;
  getAgendaEvent(id: number): Promise<AgendaEvent | undefined>;
  createAgendaEvent(event: InsertAgendaEvent): Promise<AgendaEvent>;
  updateAgendaEvent(id: number, event: Partial<InsertAgendaEvent>): Promise<AgendaEvent | undefined>;
  deleteAgendaEvent(id: number): Promise<boolean>;
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

export interface ConversionMetric {
  userId: string;
  name: string;
  company: string | null;
  email: string | null;
  totalQuotes: number;
  convertedOrders: number;
  conversionRate: number;
  totalRevenue: number;
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
  conversionMetrics: ConversionMetric[];
}

// Product Analytics Types
export interface ProductRanking {
  productId: number;
  name: string;
  sku: string;
  brand: string | null;
  categoryId: number | null;
  categoryName: string | null;
  totalRevenue: number;
  totalQuantity: number;
  orderCount: number;
  avgPrice: number;
  revenueShare: number;
  growthPercent: number;
}

export interface ProductABC {
  productId: number;
  name: string;
  sku: string;
  categoryName: string | null;
  totalRevenue: number;
  revenueShare: number;
  cumulativeShare: number;
  abcClass: 'A' | 'B' | 'C';
}

export interface ProductVelocity {
  productId: number;
  name: string;
  sku: string;
  avgSalesPerDay: number;
  totalQuantity: number;
  daysSinceLastSale: number;
  status: 'fast' | 'normal' | 'slow' | 'stopped';
}

export interface ProductRepurchase {
  productId: number;
  name: string;
  sku: string;
  uniqueCustomers: number;
  repeatCustomers: number;
  repurchaseRate: number;
  avgDaysBetweenPurchases: number;
  singlePurchaseCustomers: number;
}

export interface ProductCrossSell {
  productId: number;
  name: string;
  pairedProducts: Array<{
    productId: number;
    name: string;
    coOccurrence: number;
  }>;
  isLeader: boolean;
}

export interface CategoryPerformance {
  categoryId: number;
  categoryName: string;
  totalRevenue: number;
  totalQuantity: number;
  productCount: number;
  topProducts: Array<{
    productId: number;
    name: string;
    revenue: number;
  }>;
}

export interface ProblematicProduct {
  productId: number;
  name: string;
  sku: string;
  issue: 'low_turnover' | 'declining' | 'no_sales';
  metric: number;
  description: string;
}

export interface ProductAnalyticsData {
  overview: {
    totalRevenue: number;
    totalQuantitySold: number;
    avgTicketPerProduct: number;
    uniqueProductsSold: number;
  };
  rankingByRevenue: {
    days7: ProductRanking[];
    days30: ProductRanking[];
    days60: ProductRanking[];
    days90: ProductRanking[];
  };
  rankingByVolume: {
    days7: ProductRanking[];
    days30: ProductRanking[];
    days60: ProductRanking[];
    days90: ProductRanking[];
  };
  topGrowing: ProductRanking[];
  topDeclining: ProductRanking[];
  abcAnalysis: {
    a: ProductABC[];
    b: ProductABC[];
    c: ProductABC[];
  };
  velocity: ProductVelocity[];
  repurchase: ProductRepurchase[];
  crossSell: ProductCrossSell[];
  categoryPerformance: CategoryPerformance[];
  problematicProducts: ProblematicProduct[];
}

// Purchases Analytics Types (for purchasing/restocking decisions)
export interface LowStockProduct {
  productId: number;
  name: string;
  sku: string;
  categoryName: string | null;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  avgDailySales: number;
  daysOfStock: number;
  suggestedPurchaseQty: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

export interface SlowMovingProduct {
  productId: number;
  name: string;
  sku: string;
  categoryName: string | null;
  currentStock: number;
  stockValue: number;
  daysSinceLastSale: number;
  totalSalesLast90Days: number;
  avgDailySales: number;
  recommendation: string;
}

export interface FastMovingProduct {
  productId: number;
  name: string;
  sku: string;
  categoryName: string | null;
  currentStock: number;
  avgDailySales: number;
  daysOfStock: number;
  salesLast30Days: number;
  growthPercent: number;
  suggestedPurchaseQty: number;
}

export interface PurchaseSuggestion {
  productId: number;
  name: string;
  sku: string;
  categoryName: string | null;
  currentStock: number;
  suggestedQty: number;
  estimatedCost: number;
  reason: string;
  priority: 'urgent' | 'high' | 'normal';
}

export interface PurchasesAnalyticsData {
  overview: {
    totalLowStockProducts: number;
    totalSlowMovingProducts: number;
    totalFastMovingProducts: number;
    estimatedPurchaseValue: number;
    criticalItems: number;
  };
  lowStock: LowStockProduct[];
  slowMoving: SlowMovingProduct[];
  fastMoving: FastMovingProduct[];
  suggestions: PurchaseSuggestion[];
}

// Employee Analytics Types
export interface EmployeeMetrics {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  totalOrders: number;
  totalRevenue: number;
  avgTicket: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
  ordersThisQuarter: number;
  revenueThisQuarter: number;
  lastActivity: Date | null;
}

export interface EmployeeAnalyticsData {
  employees: EmployeeMetrics[];
  overview: {
    totalEmployees: number;
    totalOrdersThisMonth: number;
    totalRevenueThisMonth: number;
    avgOrdersPerEmployee: number;
    topPerformer: string | null;
  };
  periodComparison: {
    thisMonth: { orders: number; revenue: number };
    lastMonth: { orders: number; revenue: number };
    thisQuarter: { orders: number; revenue: number };
    lastQuarter: { orders: number; revenue: number };
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

  async getCategoryByBlingId(blingId: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.blingId, blingId));
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
  async getProducts(filters?: { categoryId?: number; search?: string; page?: number; limit?: number; sort?: string }): Promise<{ products: Product[]; total: number; page: number; totalPages: number }> {
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

    const orderByClause = filters?.sort === 'newest' ? desc(products.createdAt) : products.name;

    let productList: Product[];
    let totalResult: { count: number }[];
    
    if (conditions.length > 0) {
      const whereClause = and(...conditions);
      productList = await db.select().from(products).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset);
      totalResult = await db.select({ count: count() }).from(products).where(whereClause);
    } else {
      productList = await db.select().from(products).orderBy(orderByClause).limit(limit).offset(offset);
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

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
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

  async getNextOrderNumber(): Promise<number> {
    // Get the maximum order number from existing orders
    const maxResult = await db.execute(sql`SELECT MAX(CAST(order_number AS INTEGER)) as max_num FROM orders WHERE order_number ~ '^[0-9]+$'`);
    const maxNum = Number((maxResult.rows[0] as any)?.max_num) || 7999;
    
    // Create sequence if not exists
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 8000`);
    
    // Get current sequence value
    const seqResult = await db.execute(sql`SELECT last_value FROM order_number_seq`);
    const seqVal = Number((seqResult.rows[0] as any).last_value);
    
    // If max order number is >= sequence value, reset sequence to max+1
    if (maxNum >= seqVal) {
      await db.execute(sql`SELECT setval('order_number_seq', ${maxNum + 1}, false)`);
    }
    
    const result = await db.execute(sql`SELECT nextval('order_number_seq') as num`);
    return Number((result.rows[0] as any).num);
  }

  async getOrderWithDetails(id: number): Promise<{
    order: Order;
    items: Array<OrderItem & { product: { id: number; name: string; sku: string; image: string | null; price: string } }>;
    customer: { 
      id: string; 
      firstName: string | null; 
      lastName: string | null; 
      company: string | null; 
      tradingName: string | null;
      stateRegistration: string | null;
      email: string | null; 
      phone: string | null; 
      personType: string | null;
      cnpj: string | null;
      cpf: string | null;
      cep: string | null;
      address: string | null;
      addressNumber: string | null;
      complement: string | null;
      neighborhood: string | null;
      city: string | null; 
      state: string | null;
    };
    printedByUser: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
  } | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const [customer] = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      company: users.company,
      tradingName: users.tradingName,
      stateRegistration: users.stateRegistration,
      email: users.email,
      phone: users.phone,
      personType: users.personType,
      cnpj: users.cnpj,
      cpf: users.cpf,
      cep: users.cep,
      address: users.address,
      addressNumber: users.addressNumber,
      complement: users.complement,
      neighborhood: users.neighborhood,
      city: users.city,
      state: users.state,
    }).from(users).where(eq(users.id, order.userId));

    let printedByUser = null;
    if (order.printedBy) {
      const [pUser] = await db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      }).from(users).where(eq(users.id, order.printedBy));
      printedByUser = pUser || null;
    }

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
      customer: customer || { 
        id: order.userId, 
        firstName: null, 
        lastName: null, 
        company: null, 
        email: null, 
        phone: null, 
        personType: null,
        cnpj: null,
        cpf: null,
        cep: null,
        address: null,
        addressNumber: null,
        complement: null,
        neighborhood: null,
        city: null, 
        state: null 
      },
      printedByUser,
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
    lastMonthProducts: Array<{ productId: number; name: string; quantity: number; totalValue: number }>;
  }> {
    const userOrders = await db.select().from(orders).where(eq(orders.userId, userId));
    
    const totalSpent = userOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const totalOrders = userOrders.length;
    const completedStatuses = ['FATURADO', 'completed'];
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
    let lastMonthProducts: Array<{ productId: number; name: string; quantity: number; totalValue: number }> = [];
    
    if (orderIds.length > 0) {
      const items = await db.select({
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        name: products.name,
        orderId: orderItems.orderId,
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

      // Get last month's orders for prediction
      const now = new Date();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const lastMonthOrders = userOrders.filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= lastMonthStart && orderDate < currentMonthStart;
      });
      
      if (lastMonthOrders.length > 0) {
        const lastMonthOrderIds = lastMonthOrders.map(o => o.id);
        const lastMonthItems = items.filter(item => lastMonthOrderIds.includes(item.orderId));
        
        const lastMonthMap = new Map<number, { name: string; quantity: number; totalValue: number }>();
        for (const item of lastMonthItems) {
          const itemValue = item.quantity * parseFloat(item.price);
          const curr = lastMonthMap.get(item.productId);
          if (curr) {
            curr.quantity += item.quantity;
            curr.totalValue += itemValue;
          } else {
            lastMonthMap.set(item.productId, { 
              name: item.name || 'Produto', 
              quantity: item.quantity, 
              totalValue: itemValue
            });
          }
        }
        lastMonthProducts = Array.from(lastMonthMap.entries())
          .map(([productId, data]) => ({ productId, ...data }))
          .sort((a, b) => b.quantity - a.quantity);
      }
    }

    return { totalSpent, totalOrders, completedOrders, monthlyStats, topProducts, lastMonthProducts };
  }

  async getAdminSalesStats(period?: 'day' | 'week' | 'month' | 'year' | 'all'): Promise<{
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    averageOrderValue: number;
    monthlyRevenue: Array<{ month: string; revenue: number; orders: number }>;
    topProducts: Array<{ productId: number; name: string; totalQuantity: number; totalValue: number }>;
    ordersByStatus: Array<{ status: string; count: number }>;
    dailySales: Array<{ day: string; revenue: number; orders: number }>;
    salesByCategory: Array<{ categoryId: number; categoryName: string; totalValue: number; totalQuantity: number }>;
    customerPositivation: { totalCustomers: number; activeThisPeriod: number; newThisPeriod: number };
    salesEvolution: Array<{ month: string; revenue: number; orders: number; avgTicket: number }>;
    periodLabel: string;
  }> {
    // Calculate period start date
    const now = new Date();
    let periodStart: Date;
    let periodLabel: string;
    
    switch (period) {
      case 'day':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodLabel = 'Hoje';
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        periodLabel = 'Esta Semana';
        break;
      case 'month':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodLabel = 'Este Mes';
        break;
      case 'year':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodLabel = 'Este Ano';
        break;
      default:
        periodStart = new Date(0); // All time
        periodLabel = 'Todo Periodo';
    }
    
    // Considerar apenas pedidos faturados para todas as métricas de análise
    const allFaturadoOrders = await db.select().from(orders).where(eq(orders.status, 'FATURADO'));
    
    // Filter orders by period
    const faturadoOrders = allFaturadoOrders.filter(o => new Date(o.createdAt) >= periodStart);
    
    const totalRevenue = faturadoOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const totalOrders = faturadoOrders.length;
    const completedOrders = faturadoOrders.length;
    const pendingOrders = 0; // Não há pedidos pendentes na análise (apenas faturados)
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const monthlyMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of faturadoOrders) {
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

    // Apenas pedidos faturados - status único
    const ordersByStatus = [{ status: 'FATURADO', count: faturadoOrders.length }];

    const faturadoOrderIds = faturadoOrders.map(o => o.id);
    let topProducts: Array<{ productId: number; name: string; totalQuantity: number; totalValue: number }> = [];
    let totalCost = 0;
    
    if (faturadoOrderIds.length > 0) {
      const items = await db.select({
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        name: products.name,
        cost: products.cost,
      }).from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(sql`${orderItems.orderId} IN (${sql.join(faturadoOrderIds.map(id => sql`${id}`), sql`, `)})`);

      const productMap = new Map<number, { name: string; totalQuantity: number; totalValue: number }>();
      for (const item of items) {
        const curr = productMap.get(item.productId) || { name: item.name || 'Produto', totalQuantity: 0, totalValue: 0 };
        curr.totalQuantity += item.quantity;
        curr.totalValue += item.quantity * parseFloat(item.price);
        productMap.set(item.productId, curr);
        
        // Calculate total cost
        const itemCost = item.cost ? parseFloat(item.cost) : 0;
        totalCost += item.quantity * itemCost;
      }
      topProducts = Array.from(productMap.entries())
        .map(([productId, data]) => ({ productId, ...data }))
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 10);
    }
    
    const totalProfit = totalRevenue - totalCost;

    // Daily sales (within period)
    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of faturadoOrders) {
      const date = new Date(o.createdAt);
      const key = `${date.getDate()}`;
      const curr = dailyMap.get(key) || { revenue: 0, orders: 0 };
      curr.revenue += parseFloat(o.total);
      curr.orders += 1;
      dailyMap.set(key, curr);
    }
    const dailySales = Array.from(dailyMap.entries())
      .map(([day, data]) => ({ day, ...data }))
      .sort((a, b) => parseInt(a.day) - parseInt(b.day));

    // Sales by category
    const allCategories = await db.select().from(categories);
    const categoryNameMap = new Map<number, string>();
    allCategories.forEach(c => categoryNameMap.set(c.id, c.name));
    
    let salesByCategory: Array<{ categoryId: number; categoryName: string; totalValue: number; totalQuantity: number }> = [];
    if (faturadoOrderIds.length > 0) {
      const itemsWithCategory = await db.select({
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        categoryId: products.categoryId,
      }).from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(sql`${orderItems.orderId} IN (${sql.join(faturadoOrderIds.map(id => sql`${id}`), sql`, `)})`);

      const catMap = new Map<number, { totalValue: number; totalQuantity: number }>();
      for (const item of itemsWithCategory) {
        const catId = item.categoryId || 0;
        const curr = catMap.get(catId) || { totalValue: 0, totalQuantity: 0 };
        curr.totalQuantity += item.quantity;
        curr.totalValue += item.quantity * parseFloat(item.price);
        catMap.set(catId, curr);
      }
      salesByCategory = Array.from(catMap.entries())
        .map(([categoryId, data]) => ({ 
          categoryId, 
          categoryName: categoryNameMap.get(categoryId) || 'Sem Categoria',
          ...data 
        }))
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 10);
    }

    // Customer positivation (customers who made orders in the period) - apenas pedidos faturados
    const allUsers = await db.select().from(users).where(eq(users.role, 'customer'));
    const totalCustomers = allUsers.length;
    
    const periodFaturadoOrders = faturadoOrders.filter(o => {
      const date = new Date(o.createdAt);
      return date >= periodStart && o.userId;
    });
    const activeCustomersPeriod = new Set(periodFaturadoOrders.map(o => o.userId));
    const activeThisPeriod = activeCustomersPeriod.size;
    
    const newCustomersPeriod = allUsers.filter(u => {
      const created = new Date(u.createdAt);
      return created >= periodStart;
    });
    const newThisPeriod = newCustomersPeriod.length;
    
    const customerPositivation = { totalCustomers, activeThisPeriod, newThisPeriod };

    // Sales evolution (last 12 months for comparison)
    const salesEvolutionMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of faturadoOrders) {
      const date = new Date(o.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const curr = salesEvolutionMap.get(key) || { revenue: 0, orders: 0 };
      curr.revenue += parseFloat(o.total);
      curr.orders += 1;
      salesEvolutionMap.set(key, curr);
    }
    const salesEvolution = Array.from(salesEvolutionMap.entries())
      .map(([month, data]) => ({ 
        month, 
        revenue: data.revenue, 
        orders: data.orders,
        avgTicket: data.orders > 0 ? data.revenue / data.orders : 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    return { 
      totalRevenue, totalCost, totalProfit, totalOrders, completedOrders, pendingOrders, averageOrderValue, 
      monthlyRevenue, topProducts, ordersByStatus,
      dailySales, salesByCategory, customerPositivation, salesEvolution, periodLabel
    };
  }

  async getCustomerAnalytics(): Promise<CustomerAnalyticsData> {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allOrders = await db.select().from(orders).where(eq(orders.status, 'FATURADO'));
    
    // Get all users who have made orders, not just role='customer'
    const userIdsWithOrders = [...new Set(allOrders.map(o => o.userId))];
    const allUsers = await db.select().from(users);
    const allCustomers = allUsers.filter(u => userIdsWithOrders.includes(u.id) || u.role === 'customer');

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

    // Calculate conversion metrics (ORCAMENTO -> FATURADO)
    const allOrdersIncludingQuotes = await db.select().from(orders);
    const customerAllOrdersMap = new Map<string, Order[]>();
    for (const order of allOrdersIncludingQuotes) {
      const existing = customerAllOrdersMap.get(order.userId) || [];
      existing.push(order);
      customerAllOrdersMap.set(order.userId, existing);
    }

    const conversionMetrics: ConversionMetric[] = [];
    for (const user of allCustomers) {
      const customerOrders = customerAllOrdersMap.get(user.id) || [];
      if (customerOrders.length === 0) continue;
      
      const quotes = customerOrders.filter(o => o.status === 'ORCAMENTO' || o.status === 'ORCAMENTO_ABERTO' || o.status === 'ORCAMENTO_CONCLUIDO');
      const converted = customerOrders.filter(o => o.status === 'FATURADO' || o.status === 'PEDIDO_FATURADO');
      const totalRevenue = converted.reduce((sum, o) => sum + parseFloat(o.total), 0);
      
      // Only include customers who have activity (either quotes or converted orders)
      const totalActivity = quotes.length + converted.length;
      if (totalActivity === 0) continue;
      
      // Conversion rate: If customer has only faturado orders (no quotes), they converted 100%
      // If they have quotes, rate = converted / (quotes + converted) * 100
      const conversionRate = totalActivity > 0 ? (converted.length / totalActivity) * 100 : 0;
      
      conversionMetrics.push({
        userId: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Cliente',
        company: user.company,
        email: user.email,
        totalQuotes: quotes.length,
        convertedOrders: converted.length,
        conversionRate,
        totalRevenue,
      });
    }
    
    // Sort by conversion rate (descending), then by converted orders count
    conversionMetrics.sort((a, b) => {
      if (b.conversionRate !== a.conversionRate) return b.conversionRate - a.conversionRate;
      return b.convertedOrders - a.convertedOrders;
    });

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
      conversionMetrics,
    };
  }

  async getProductAnalytics(): Promise<ProductAnalyticsData> {
    const now = new Date();
    const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days60Ago = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const allProducts = await db.select().from(products);
    const allCategories = await db.select().from(categories);
    const allOrders = await db.select().from(orders).where(eq(orders.status, 'FATURADO'));
    const faturadoOrderIds = new Set(allOrders.map(o => o.id));
    const allOrderItems = (await db.select().from(orderItems)).filter(item => faturadoOrderIds.has(item.orderId));

    const categoryMap = new Map<number, string>();
    for (const cat of allCategories) {
      categoryMap.set(cat.id, cat.name);
    }

    const productMap = new Map<number, typeof allProducts[0]>();
    for (const prod of allProducts) {
      productMap.set(prod.id, prod);
    }

    const orderDateMap = new Map<number, Date>();
    for (const order of allOrders) {
      orderDateMap.set(order.id, new Date(order.createdAt));
    }

    const orderUserMap = new Map<number, string>();
    for (const order of allOrders) {
      orderUserMap.set(order.id, order.userId);
    }

    interface ProductStats {
      productId: number;
      name: string;
      sku: string;
      brand: string | null;
      categoryId: number | null;
      categoryName: string | null;
      totalRevenue: number;
      totalQuantity: number;
      orderCount: number;
      orderIds: Set<number>;
      customerIds: Set<string>;
      salesDates: Date[];
    }

    const buildStats = (items: typeof allOrderItems, sinceDate?: Date): Map<number, ProductStats> => {
      const stats = new Map<number, ProductStats>();
      for (const item of items) {
        const orderDate = orderDateMap.get(item.orderId);
        if (!orderDate) continue;
        if (sinceDate && orderDate < sinceDate) continue;

        const product = productMap.get(item.productId);
        if (!product) continue;

        const existing = stats.get(item.productId) || {
          productId: item.productId,
          name: product.name,
          sku: product.sku,
          brand: product.brand,
          categoryId: product.categoryId,
          categoryName: product.categoryId ? categoryMap.get(product.categoryId) || null : null,
          totalRevenue: 0,
          totalQuantity: 0,
          orderCount: 0,
          orderIds: new Set<number>(),
          customerIds: new Set<string>(),
          salesDates: [],
        };

        existing.totalRevenue += item.quantity * parseFloat(item.price);
        existing.totalQuantity += item.quantity;
        existing.orderIds.add(item.orderId);
        existing.salesDates.push(orderDate);
        const userId = orderUserMap.get(item.orderId);
        if (userId) existing.customerIds.add(userId);

        stats.set(item.productId, existing);
      }

      for (const [, s] of stats) {
        s.orderCount = s.orderIds.size;
      }

      return stats;
    };

    const allTimeStats = buildStats(allOrderItems);
    const stats7d = buildStats(allOrderItems, days7Ago);
    const stats30d = buildStats(allOrderItems, days30Ago);
    const stats60d = buildStats(allOrderItems, days60Ago);
    const stats90d = buildStats(allOrderItems, days90Ago);

    const totalRevenue = Array.from(allTimeStats.values()).reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalQuantitySold = Array.from(allTimeStats.values()).reduce((sum, s) => sum + s.totalQuantity, 0);
    const uniqueProductsSold = allTimeStats.size;
    const avgTicketPerProduct = uniqueProductsSold > 0 ? totalRevenue / uniqueProductsSold : 0;

    const overview = { totalRevenue, totalQuantitySold, avgTicketPerProduct, uniqueProductsSold };

    const toRanking = (stats: Map<number, ProductStats>, totalRev: number): ProductRanking[] => {
      return Array.from(stats.values()).map(s => ({
        productId: s.productId,
        name: s.name,
        sku: s.sku,
        brand: s.brand,
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        totalRevenue: s.totalRevenue,
        totalQuantity: s.totalQuantity,
        orderCount: s.orderCount,
        avgPrice: s.totalQuantity > 0 ? s.totalRevenue / s.totalQuantity : 0,
        revenueShare: totalRev > 0 ? (s.totalRevenue / totalRev) * 100 : 0,
        growthPercent: 0,
      }));
    };

    const sortByRevenue = (arr: ProductRanking[]) => [...arr].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 20);
    const sortByVolume = (arr: ProductRanking[]) => [...arr].sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 20);

    const total7d = Array.from(stats7d.values()).reduce((sum, s) => sum + s.totalRevenue, 0);
    const total30d = Array.from(stats30d.values()).reduce((sum, s) => sum + s.totalRevenue, 0);
    const total60d = Array.from(stats60d.values()).reduce((sum, s) => sum + s.totalRevenue, 0);
    const total90d = Array.from(stats90d.values()).reduce((sum, s) => sum + s.totalRevenue, 0);

    const rankingByRevenue = {
      days7: sortByRevenue(toRanking(stats7d, total7d)),
      days30: sortByRevenue(toRanking(stats30d, total30d)),
      days60: sortByRevenue(toRanking(stats60d, total60d)),
      days90: sortByRevenue(toRanking(stats90d, total90d)),
    };

    const rankingByVolume = {
      days7: sortByVolume(toRanking(stats7d, total7d)),
      days30: sortByVolume(toRanking(stats30d, total30d)),
      days60: sortByVolume(toRanking(stats60d, total60d)),
      days90: sortByVolume(toRanking(stats90d, total90d)),
    };

    const prev30to60Stats = buildStats(allOrderItems.filter(item => {
      const d = orderDateMap.get(item.orderId);
      return d && d >= days60Ago && d < days30Ago;
    }));

    const growthData: ProductRanking[] = [];
    for (const [productId, current] of stats30d) {
      const prev = prev30to60Stats.get(productId);
      const prevRev = prev?.totalRevenue || 0;
      const growthPercent = prevRev > 0 ? ((current.totalRevenue - prevRev) / prevRev) * 100 : (current.totalRevenue > 0 ? 100 : 0);
      const product = productMap.get(productId);
      if (product) {
        growthData.push({
          productId,
          name: product.name,
          sku: product.sku,
          brand: product.brand,
          categoryId: product.categoryId,
          categoryName: product.categoryId ? categoryMap.get(product.categoryId) || null : null,
          totalRevenue: current.totalRevenue,
          totalQuantity: current.totalQuantity,
          orderCount: current.orderCount,
          avgPrice: current.totalQuantity > 0 ? current.totalRevenue / current.totalQuantity : 0,
          revenueShare: total30d > 0 ? (current.totalRevenue / total30d) * 100 : 0,
          growthPercent,
        });
      }
    }

    const topGrowing = [...growthData].filter(p => p.growthPercent > 0).sort((a, b) => b.growthPercent - a.growthPercent).slice(0, 10);
    const topDeclining = [...growthData].filter(p => p.growthPercent < 0).sort((a, b) => a.growthPercent - b.growthPercent).slice(0, 10);

    const abcSorted = [...toRanking(allTimeStats, totalRevenue)].sort((a, b) => b.totalRevenue - a.totalRevenue);
    let cumulative = 0;
    const abcProducts: ProductABC[] = abcSorted.map(p => {
      cumulative += p.revenueShare;
      return {
        productId: p.productId,
        name: p.name,
        sku: p.sku,
        categoryName: p.categoryName,
        totalRevenue: p.totalRevenue,
        revenueShare: p.revenueShare,
        cumulativeShare: cumulative,
        abcClass: cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C',
      };
    });

    const abcAnalysis = {
      a: abcProducts.filter(p => p.abcClass === 'A'),
      b: abcProducts.filter(p => p.abcClass === 'B'),
      c: abcProducts.filter(p => p.abcClass === 'C'),
    };

    const daysSinceStart = allOrders.length > 0 
      ? Math.max(1, Math.ceil((now.getTime() - Math.min(...allOrders.map(o => new Date(o.createdAt).getTime()))) / (24 * 60 * 60 * 1000)))
      : 1;

    const velocity: ProductVelocity[] = Array.from(allTimeStats.values()).map(s => {
      const avgSalesPerDay = s.totalQuantity / daysSinceStart;
      const lastSaleDate = s.salesDates.length > 0 ? Math.max(...s.salesDates.map(d => d.getTime())) : 0;
      const daysSinceLastSale = lastSaleDate > 0 ? Math.ceil((now.getTime() - lastSaleDate) / (24 * 60 * 60 * 1000)) : 9999;
      
      let status: 'fast' | 'normal' | 'slow' | 'stopped' = 'normal';
      if (daysSinceLastSale > 60) status = 'stopped';
      else if (daysSinceLastSale > 30) status = 'slow';
      else if (avgSalesPerDay >= 1) status = 'fast';

      return {
        productId: s.productId,
        name: s.name,
        sku: s.sku,
        avgSalesPerDay,
        totalQuantity: s.totalQuantity,
        daysSinceLastSale,
        status,
      };
    }).sort((a, b) => b.avgSalesPerDay - a.avgSalesPerDay);

    const productCustomerOrders = new Map<number, Map<string, Date[]>>();
    for (const item of allOrderItems) {
      const orderDate = orderDateMap.get(item.orderId);
      const userId = orderUserMap.get(item.orderId);
      if (!orderDate || !userId) continue;

      if (!productCustomerOrders.has(item.productId)) {
        productCustomerOrders.set(item.productId, new Map());
      }
      const customerMap = productCustomerOrders.get(item.productId)!;
      if (!customerMap.has(userId)) {
        customerMap.set(userId, []);
      }
      customerMap.get(userId)!.push(orderDate);
    }

    const repurchase: ProductRepurchase[] = Array.from(allTimeStats.values()).map(s => {
      const customerOrders = productCustomerOrders.get(s.productId) || new Map();
      const uniqueCustomers = customerOrders.size;
      let repeatCustomers = 0;
      let totalDaysBetween = 0;
      let countWithRepeat = 0;

      for (const [, dates] of customerOrders) {
        if (dates.length > 1) {
          repeatCustomers++;
          const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
          for (let i = 1; i < sorted.length; i++) {
            totalDaysBetween += (sorted[i].getTime() - sorted[i - 1].getTime()) / (24 * 60 * 60 * 1000);
            countWithRepeat++;
          }
        }
      }

      return {
        productId: s.productId,
        name: s.name,
        sku: s.sku,
        uniqueCustomers,
        repeatCustomers,
        repurchaseRate: uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0,
        avgDaysBetweenPurchases: countWithRepeat > 0 ? totalDaysBetween / countWithRepeat : 0,
        singlePurchaseCustomers: uniqueCustomers - repeatCustomers,
      };
    }).sort((a, b) => b.repurchaseRate - a.repurchaseRate);

    const orderProductsMap = new Map<number, number[]>();
    for (const item of allOrderItems) {
      if (!orderProductsMap.has(item.orderId)) {
        orderProductsMap.set(item.orderId, []);
      }
      orderProductsMap.get(item.orderId)!.push(item.productId);
    }

    const coOccurrence = new Map<string, number>();
    for (const [, prods] of orderProductsMap) {
      if (prods.length < 2) continue;
      for (let i = 0; i < prods.length; i++) {
        for (let j = i + 1; j < prods.length; j++) {
          const key = [prods[i], prods[j]].sort((a, b) => a - b).join('-');
          coOccurrence.set(key, (coOccurrence.get(key) || 0) + 1);
        }
      }
    }

    const productCoOccurrence = new Map<number, Map<number, number>>();
    for (const [key, count] of coOccurrence) {
      const [a, b] = key.split('-').map(Number);
      if (!productCoOccurrence.has(a)) productCoOccurrence.set(a, new Map());
      if (!productCoOccurrence.has(b)) productCoOccurrence.set(b, new Map());
      productCoOccurrence.get(a)!.set(b, count);
      productCoOccurrence.get(b)!.set(a, count);
    }

    const crossSell: ProductCrossSell[] = Array.from(allTimeStats.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 20)
      .map(s => {
        const pairs = productCoOccurrence.get(s.productId) || new Map();
        const pairedProducts = Array.from(pairs.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([pid, count]) => ({
            productId: pid,
            name: productMap.get(pid)?.name || 'Produto',
            coOccurrence: count,
          }));

        return {
          productId: s.productId,
          name: s.name,
          pairedProducts,
          isLeader: s.totalRevenue === Math.max(...Array.from(allTimeStats.values()).map(x => x.totalRevenue)),
        };
      });

    const categoryStats = new Map<number, { revenue: number; quantity: number; products: Map<number, number> }>();
    for (const [productId, stats] of allTimeStats) {
      const product = productMap.get(productId);
      if (!product?.categoryId) continue;
      
      const existing = categoryStats.get(product.categoryId) || { revenue: 0, quantity: 0, products: new Map() };
      existing.revenue += stats.totalRevenue;
      existing.quantity += stats.totalQuantity;
      existing.products.set(productId, stats.totalRevenue);
      categoryStats.set(product.categoryId, existing);
    }

    const categoryPerformance: CategoryPerformance[] = Array.from(categoryStats.entries())
      .map(([categoryId, stats]) => ({
        categoryId,
        categoryName: categoryMap.get(categoryId) || 'Sem Categoria',
        totalRevenue: stats.revenue,
        totalQuantity: stats.quantity,
        productCount: stats.products.size,
        topProducts: Array.from(stats.products.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([pid, rev]) => ({
            productId: pid,
            name: productMap.get(pid)?.name || 'Produto',
            revenue: rev,
          })),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const problematicProducts: ProblematicProduct[] = [];
    
    for (const v of velocity) {
      if (v.status === 'stopped') {
        const product = productMap.get(v.productId);
        if (product) {
          problematicProducts.push({
            productId: v.productId,
            name: v.name,
            sku: v.sku,
            issue: 'no_sales',
            metric: v.daysSinceLastSale,
            description: `Sem vendas há ${v.daysSinceLastSale} dias`,
          });
        }
      } else if (v.status === 'slow') {
        const product = productMap.get(v.productId);
        if (product) {
          problematicProducts.push({
            productId: v.productId,
            name: v.name,
            sku: v.sku,
            issue: 'low_turnover',
            metric: v.avgSalesPerDay,
            description: `Giro lento: ${v.avgSalesPerDay.toFixed(2)} un/dia`,
          });
        }
      }
    }

    for (const p of topDeclining.slice(0, 5)) {
      if (p.growthPercent < -30) {
        problematicProducts.push({
          productId: p.productId,
          name: p.name,
          sku: p.sku,
          issue: 'declining',
          metric: p.growthPercent,
          description: `Queda de ${Math.abs(p.growthPercent).toFixed(0)}% vs período anterior`,
        });
      }
    }

    return {
      overview,
      rankingByRevenue,
      rankingByVolume,
      topGrowing,
      topDeclining,
      abcAnalysis,
      velocity,
      repurchase,
      crossSell,
      categoryPerformance,
      problematicProducts,
    };
  }

  async reserveStockForOrder(orderId: number, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const orderItems = await this.getOrderItems(orderId);
      const order = await this.getOrder(orderId);
      if (!order) return { success: false, error: 'Pedido não encontrado' };
      if (order.status === 'PEDIDO_GERADO' || order.status === 'PEDIDO_FATURADO') {
        return { success: false, error: 'Estoque já reservado para este pedido' };
      }
      
      for (const item of orderItems) {
        const product = await this.getProduct(item.productId);
        if (!product) return { success: false, error: `Produto ${item.productId} não encontrado` };
        const available = product.stock - (product.reservedStock || 0);
        if (available < item.quantity) {
          return { success: false, error: `Estoque insuficiente para ${product.name}. Disponível: ${available}, Necessário: ${item.quantity}` };
        }
      }
      
      for (const item of orderItems) {
        await db.update(products)
          .set({ reservedStock: sql`reserved_stock + ${item.quantity}` })
          .where(eq(products.id, item.productId));
      }
      
      await db.update(orders)
        .set({ status: 'PEDIDO_GERADO', stage: 'SEPARADO', reservedAt: new Date(), reservedBy: userId })
        .where(eq(orders.id, orderId));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao reservar estoque' };
    }
  }

  async releaseStockForOrder(orderId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const order = await this.getOrder(orderId);
      if (!order) return { success: false, error: 'Pedido não encontrado' };
      if (order.status !== 'PEDIDO_GERADO') {
        return { success: false, error: 'Pedido não está com estoque reservado' };
      }
      
      const orderItems = await this.getOrderItems(orderId);
      for (const item of orderItems) {
        await db.update(products)
          .set({ reservedStock: sql`GREATEST(reserved_stock - ${item.quantity}, 0)` })
          .where(eq(products.id, item.productId));
      }
      
      await db.update(orders)
        .set({ status: 'ORCAMENTO', reservedAt: null, reservedBy: null })
        .where(eq(orders.id, orderId));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao liberar estoque' };
    }
  }

  async deductStockForOrder(orderId: number, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const order = await this.getOrder(orderId);
      if (!order) return { success: false, error: 'Pedido não encontrado' };
      if (order.status !== 'PEDIDO_GERADO') {
        return { success: false, error: 'Pedido precisa estar com estoque reservado (PEDIDO_GERADO) antes de faturar' };
      }
      
      const orderItems = await this.getOrderItems(orderId);
      for (const item of orderItems) {
        await db.update(products)
          .set({ 
            stock: sql`stock - ${item.quantity}`,
            reservedStock: sql`GREATEST(reserved_stock - ${item.quantity}, 0)`
          })
          .where(eq(products.id, item.productId));
      }
      
      await db.update(orders)
        .set({ status: 'FATURADO', stage: 'FINALIZADO', invoicedAt: new Date(), invoicedBy: userId })
        .where(eq(orders.id, orderId));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao faturar pedido' };
    }
  }

  async updateOrderStage(orderId: number, stage: string): Promise<{ success: boolean; error?: string }> {
    const validStages = ['PENDENTE_IMPRESSAO', 'IMPRESSO', 'SEPARADO', 'COBRADO', 'FINALIZADO'];
    if (!validStages.includes(stage)) {
      return { success: false, error: 'Etapa inválida' };
    }
    
    try {
      const order = await this.getOrder(orderId);
      if (!order) return { success: false, error: 'Pedido não encontrado' };
      
      await db.update(orders)
        .set({ stage })
        .where(eq(orders.id, orderId));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao atualizar etapa' };
    }
  }

  async getPurchasesAnalytics(): Promise<PurchasesAnalyticsData> {
    const now = new Date();
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days60Ago = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const allProducts = await db.select().from(products);
    const allCategories = await db.select().from(categories);
    const faturadoOrders = await db.select().from(orders).where(eq(orders.status, 'FATURADO'));
    const faturadoOrderIds = new Set(faturadoOrders.map(o => o.id));
    const allOrderItems = (await db.select().from(orderItems)).filter(item => faturadoOrderIds.has(item.orderId));

    const categoryMap = new Map<number, string>();
    for (const cat of allCategories) {
      categoryMap.set(cat.id, cat.name);
    }

    const orderDateMap = new Map<number, Date>();
    for (const order of faturadoOrders) {
      orderDateMap.set(order.id, new Date(order.createdAt));
    }

    interface ProductSalesData {
      productId: number;
      totalQuantity30d: number;
      totalQuantity60d: number;
      totalQuantity90d: number;
      lastSaleDate: Date | null;
      salesDates: Date[];
    }

    const salesDataMap = new Map<number, ProductSalesData>();

    for (const item of allOrderItems) {
      const orderDate = orderDateMap.get(item.orderId);
      if (!orderDate) continue;

      const existing = salesDataMap.get(item.productId) || {
        productId: item.productId,
        totalQuantity30d: 0,
        totalQuantity60d: 0,
        totalQuantity90d: 0,
        lastSaleDate: null,
        salesDates: [],
      };

      if (orderDate >= days30Ago) {
        existing.totalQuantity30d += item.quantity;
      }
      if (orderDate >= days60Ago) {
        existing.totalQuantity60d += item.quantity;
      }
      if (orderDate >= days90Ago) {
        existing.totalQuantity90d += item.quantity;
      }
      existing.salesDates.push(orderDate);
      if (!existing.lastSaleDate || orderDate > existing.lastSaleDate) {
        existing.lastSaleDate = orderDate;
      }

      salesDataMap.set(item.productId, existing);
    }

    const lowStock: LowStockProduct[] = [];
    const slowMoving: SlowMovingProduct[] = [];
    const fastMoving: FastMovingProduct[] = [];
    const suggestions: PurchaseSuggestion[] = [];

    for (const product of allProducts) {
      const salesData = salesDataMap.get(product.id);
      const categoryName = product.categoryId ? categoryMap.get(product.categoryId) || null : null;
      
      const avgDailySales30d = salesData ? salesData.totalQuantity30d / 30 : 0;
      const avgDailySales60d = salesData ? salesData.totalQuantity60d / 60 : 0;
      const avgDailySales90d = salesData ? salesData.totalQuantity90d / 90 : 0;
      const avgDailySales = Math.max(avgDailySales30d, avgDailySales60d, avgDailySales90d);
      
      const availableStock = product.stock - (product.reservedStock || 0);
      const daysOfStock = avgDailySales > 0 ? Math.floor(availableStock / avgDailySales) : availableStock > 0 ? 999 : 0;
      
      const daysSinceLastSale = salesData?.lastSaleDate 
        ? Math.floor((now.getTime() - salesData.lastSaleDate.getTime()) / (24 * 60 * 60 * 1000))
        : 999;

      // Low stock logic - products that need replenishment
      if (avgDailySales > 0 && daysOfStock <= 30) {
        let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
        if (daysOfStock <= 3) urgency = 'critical';
        else if (daysOfStock <= 7) urgency = 'high';
        else if (daysOfStock <= 14) urgency = 'medium';

        const suggestedPurchaseQty = Math.ceil(avgDailySales * 30) - availableStock;

        lowStock.push({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          categoryName,
          currentStock: product.stock,
          reservedStock: product.reservedStock || 0,
          availableStock,
          avgDailySales: Math.round(avgDailySales * 100) / 100,
          daysOfStock,
          suggestedPurchaseQty: Math.max(0, suggestedPurchaseQty),
          urgency,
        });

        if (urgency === 'critical' || urgency === 'high') {
          suggestions.push({
            productId: product.id,
            name: product.name,
            sku: product.sku,
            categoryName,
            currentStock: product.stock,
            suggestedQty: Math.max(0, suggestedPurchaseQty),
            estimatedCost: Math.max(0, suggestedPurchaseQty) * parseFloat(product.wholesalePrice),
            reason: urgency === 'critical' 
              ? `Estoque critico - apenas ${daysOfStock} dias de estoque` 
              : `Estoque baixo - ${daysOfStock} dias de estoque`,
            priority: urgency === 'critical' ? 'urgent' : 'high',
          });
        }
      }

      // Slow moving logic - products with stock but low sales
      const stockValue = product.stock * parseFloat(product.wholesalePrice);
      if (product.stock > 0 && (daysSinceLastSale > 30 || avgDailySales90d < 0.1)) {
        let recommendation = '';
        if (daysSinceLastSale > 60) {
          recommendation = 'Considerar promocao ou liquidacao';
        } else if (daysSinceLastSale > 30) {
          recommendation = 'Revisar estrategia de vendas';
        } else if (avgDailySales90d < 0.1) {
          recommendation = 'Produto com giro muito lento';
        }

        slowMoving.push({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          categoryName,
          currentStock: product.stock,
          stockValue: Math.round(stockValue * 100) / 100,
          daysSinceLastSale,
          totalSalesLast90Days: salesData?.totalQuantity90d || 0,
          avgDailySales: Math.round(avgDailySales90d * 100) / 100,
          recommendation,
        });
      }

      // Fast moving logic - products selling well that need restocking
      const prev30to60Sales = salesData ? salesData.totalQuantity60d - salesData.totalQuantity30d : 0;
      const growthPercent = prev30to60Sales > 0 
        ? ((salesData?.totalQuantity30d || 0) - prev30to60Sales) / prev30to60Sales * 100 
        : salesData?.totalQuantity30d ? 100 : 0;

      if (avgDailySales30d >= 1 || (avgDailySales30d >= 0.5 && growthPercent > 20)) {
        const suggestedPurchaseQty = Math.ceil(avgDailySales30d * 45) - availableStock;
        
        fastMoving.push({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          categoryName,
          currentStock: product.stock,
          avgDailySales: Math.round(avgDailySales30d * 100) / 100,
          daysOfStock,
          salesLast30Days: salesData?.totalQuantity30d || 0,
          growthPercent: Math.round(growthPercent * 10) / 10,
          suggestedPurchaseQty: Math.max(0, suggestedPurchaseQty),
        });

        if (daysOfStock <= 14 && suggestedPurchaseQty > 0) {
          suggestions.push({
            productId: product.id,
            name: product.name,
            sku: product.sku,
            categoryName,
            currentStock: product.stock,
            suggestedQty: suggestedPurchaseQty,
            estimatedCost: suggestedPurchaseQty * parseFloat(product.wholesalePrice),
            reason: `Produto com alta demanda - ${salesData?.totalQuantity30d || 0} vendas nos ultimos 30 dias`,
            priority: daysOfStock <= 7 ? 'urgent' : 'normal',
          });
        }
      }
    }

    // Sort arrays
    lowStock.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    slowMoving.sort((a, b) => b.stockValue - a.stockValue);
    fastMoving.sort((a, b) => b.avgDailySales - a.avgDailySales);
    suggestions.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const estimatedPurchaseValue = suggestions.reduce((sum, s) => sum + s.estimatedCost, 0);
    const criticalItems = lowStock.filter(p => p.urgency === 'critical').length;

    return {
      overview: {
        totalLowStockProducts: lowStock.length,
        totalSlowMovingProducts: slowMoving.length,
        totalFastMovingProducts: fastMoving.length,
        estimatedPurchaseValue: Math.round(estimatedPurchaseValue * 100) / 100,
        criticalItems,
      },
      lowStock: lowStock.slice(0, 50),
      slowMoving: slowMoving.slice(0, 50),
      fastMoving: fastMoving.slice(0, 50),
      suggestions: suggestions.slice(0, 30),
    };
  }

  async getEmployeeAnalytics(): Promise<EmployeeAnalyticsData> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfLastQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1);
    const endOfLastQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 0);

    const allUsers = await db.select().from(users);
    const employees = allUsers.filter(u => u.role === 'admin' || u.role === 'sales');
    
    const allOrders = await db.select().from(orders).where(eq(orders.status, 'FATURADO'));

    const employeeMetrics: EmployeeMetrics[] = [];

    for (const emp of employees) {
      // Attribution: orders where employee is listed as invoicedBy OR reservedBy (they processed the order)
      const empOrders = allOrders.filter(o => o.invoicedBy === emp.id || o.reservedBy === emp.id);
      
      // Use invoicedAt for period comparisons (when employee actually processed the order)
      // Fall back to createdAt if invoicedAt is not available
      const getOrderDate = (o: typeof allOrders[0]) => o.invoicedAt ? new Date(o.invoicedAt) : new Date(o.createdAt);
      
      const ordersThisMonth = empOrders.filter(o => getOrderDate(o) >= startOfMonth);
      const ordersLastMonth = empOrders.filter(o => {
        const orderDate = getOrderDate(o);
        return orderDate >= startOfLastMonth && orderDate <= endOfLastMonth;
      });
      const ordersThisQuarter = empOrders.filter(o => getOrderDate(o) >= startOfQuarter);
      const ordersLastQuarter = empOrders.filter(o => {
        const orderDate = getOrderDate(o);
        return orderDate >= startOfLastQuarter && orderDate <= endOfLastQuarter;
      });

      const totalRevenue = empOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
      const revenueThisMonth = ordersThisMonth.reduce((sum, o) => sum + parseFloat(o.total), 0);
      const revenueThisQuarter = ordersThisQuarter.reduce((sum, o) => sum + parseFloat(o.total), 0);
      
      // Sort by invoicedAt for last activity
      const sortedOrders = [...empOrders].sort((a, b) => 
        getOrderDate(b).getTime() - getOrderDate(a).getTime()
      );

      employeeMetrics.push({
        userId: emp.id,
        name: [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email || 'Funcionario',
        email: emp.email,
        role: emp.role,
        totalOrders: empOrders.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgTicket: empOrders.length > 0 ? Math.round((totalRevenue / empOrders.length) * 100) / 100 : 0,
        ordersThisMonth: ordersThisMonth.length,
        revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
        ordersThisQuarter: ordersThisQuarter.length,
        revenueThisQuarter: Math.round(revenueThisQuarter * 100) / 100,
        lastActivity: sortedOrders.length > 0 ? getOrderDate(sortedOrders[0]) : null,
      });
    }

    employeeMetrics.sort((a, b) => b.revenueThisMonth - a.revenueThisMonth);

    // Use invoicedAt for period comparisons (fallback to createdAt)
    const getOrderDateGlobal = (o: typeof allOrders[0]) => o.invoicedAt ? new Date(o.invoicedAt) : new Date(o.createdAt);
    
    const totalOrdersThisMonth = employeeMetrics.reduce((sum, e) => sum + e.ordersThisMonth, 0);
    const totalRevenueThisMonth = employeeMetrics.reduce((sum, e) => sum + e.revenueThisMonth, 0);
    const totalOrdersLastMonth = allOrders.filter(o => {
      const orderDate = getOrderDateGlobal(o);
      return orderDate >= startOfLastMonth && orderDate <= endOfLastMonth;
    }).length;
    const totalRevenueLastMonth = allOrders.filter(o => {
      const orderDate = getOrderDateGlobal(o);
      return orderDate >= startOfLastMonth && orderDate <= endOfLastMonth;
    }).reduce((sum, o) => sum + parseFloat(o.total), 0);
    const totalOrdersThisQuarter = employeeMetrics.reduce((sum, e) => sum + e.ordersThisQuarter, 0);
    const totalRevenueThisQuarter = employeeMetrics.reduce((sum, e) => sum + e.revenueThisQuarter, 0);
    const totalOrdersLastQuarter = allOrders.filter(o => {
      const orderDate = getOrderDateGlobal(o);
      return orderDate >= startOfLastQuarter && orderDate <= endOfLastQuarter;
    }).length;
    const totalRevenueLastQuarter = allOrders.filter(o => {
      const orderDate = getOrderDateGlobal(o);
      return orderDate >= startOfLastQuarter && orderDate <= endOfLastQuarter;
    }).reduce((sum, o) => sum + parseFloat(o.total), 0);

    return {
      employees: employeeMetrics,
      overview: {
        totalEmployees: employees.length,
        totalOrdersThisMonth,
        totalRevenueThisMonth: Math.round(totalRevenueThisMonth * 100) / 100,
        avgOrdersPerEmployee: employees.length > 0 ? Math.round((totalOrdersThisMonth / employees.length) * 10) / 10 : 0,
        topPerformer: employeeMetrics.length > 0 ? employeeMetrics[0].name : null,
      },
      periodComparison: {
        thisMonth: { orders: totalOrdersThisMonth, revenue: Math.round(totalRevenueThisMonth * 100) / 100 },
        lastMonth: { orders: totalOrdersLastMonth, revenue: Math.round(totalRevenueLastMonth * 100) / 100 },
        thisQuarter: { orders: totalOrdersThisQuarter, revenue: Math.round(totalRevenueThisQuarter * 100) / 100 },
        lastQuarter: { orders: totalOrdersLastQuarter, revenue: Math.round(totalRevenueLastQuarter * 100) / 100 },
      },
    };
  }

  // ========== AGENDA EVENTS ==========
  async getAgendaEvents(filters?: { startDate?: Date; endDate?: Date }): Promise<AgendaEvent[]> {
    const conditions = [];
    
    if (filters?.startDate) {
      conditions.push(sql`${agendaEvents.date} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${agendaEvents.date} <= ${filters.endDate}`);
    }
    
    if (conditions.length > 0) {
      return db.select().from(agendaEvents)
        .where(and(...conditions))
        .orderBy(agendaEvents.date);
    }
    
    return db.select().from(agendaEvents).orderBy(agendaEvents.date);
  }

  async getAgendaEvent(id: number): Promise<AgendaEvent | undefined> {
    const [event] = await db.select().from(agendaEvents).where(eq(agendaEvents.id, id));
    return event;
  }

  async createAgendaEvent(event: InsertAgendaEvent): Promise<AgendaEvent> {
    const [newEvent] = await db.insert(agendaEvents).values(event).returning();
    return newEvent;
  }

  async updateAgendaEvent(id: number, event: Partial<InsertAgendaEvent>): Promise<AgendaEvent | undefined> {
    const [updated] = await db.update(agendaEvents).set(event).where(eq(agendaEvents.id, id)).returning();
    return updated;
  }

  async deleteAgendaEvent(id: number): Promise<boolean> {
    const result = await db.delete(agendaEvents).where(eq(agendaEvents.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
