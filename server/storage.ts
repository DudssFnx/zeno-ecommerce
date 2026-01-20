import {
  type AgendaEvent,
  agendaEvents,
  type CatalogBanner,
  catalogBanners,
  type CatalogConfig,
  catalogConfig,
  type CatalogSlide,
  catalogSlides,
  categories,
  type Category,
  type Coupon,
  coupons,
  type CreditPayment,
  creditPayments,
  type CustomerCredit,
  customerCredits,
  type CustomerPrice,
  customerPrices,
  type InsertAgendaEvent,
  type InsertCatalogBanner,
  type InsertCatalogSlide,
  type InsertCategory,
  type InsertCoupon,
  type InsertCreditPayment,
  type InsertCustomerCredit,
  type InsertCustomerPrice,
  type InsertModule,
  type InsertOrder,
  type InsertOrderItem,
  type InsertPaymentIntegration,
  type InsertPaymentType,
  type InsertPriceTable,
  type InsertProduct,
  type InsertPurchaseOrder,
  type InsertPurchaseOrderItem,
  type InsertSupplier,
  type InsertUser,
  type Module,
  modules,
  type Order,
  type OrderItem,
  orderItems,
  orders,
  type PaymentIntegration,
  paymentIntegrations,
  type PaymentType,
  paymentTypes,
  type PriceTable,
  priceTables,
  type Product,
  products,
  type PurchaseOrder,
  type PurchaseOrderItem,
  purchaseOrderItems,
  purchaseOrders,
  type SiteSetting,
  siteSettings,
  type StockMovement,
  stockMovements,
  type Supplier,
  suppliers,
  type UpsertUser,
  type User,
  type UserModulePermission,
  userModulePermissions,
  users,
} from "@shared/schema";
import { randomBytes, scrypt } from "crypto";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { promisify } from "util";
import { db } from "./db";

const scryptAsync = promisify(scrypt);

// Função para garantir que a senha seja salva como Hash
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // ... (restante da interface permanece igual)
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  getCategoryByBlingId(blingId: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(
    id: number,
    category: Partial<InsertCategory>
  ): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(
    id: number,
    supplier: Partial<InsertSupplier>
  ): Promise<Supplier | undefined>;
  deleteSupplier(id: number): Promise<boolean>;
  getProducts(filters?: {
    categoryId?: number;
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }): Promise<{
    products: Product[];
    total: number;
    page: number;
    totalPages: number;
  }>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(
    id: number,
    product: Partial<InsertProduct>
  ): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  getOrders(userId?: string): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderWithDetails(id: number): Promise<any | undefined>;
  getNextOrderNumber(): Promise<number>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(
    id: number,
    order: Partial<InsertOrder>
  ): Promise<Order | undefined>;
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getPriceTables(): Promise<PriceTable[]>;
  getPriceTable(id: number): Promise<PriceTable | undefined>;
  createPriceTable(table: InsertPriceTable): Promise<PriceTable>;
  updatePriceTable(
    id: number,
    table: Partial<InsertPriceTable>
  ): Promise<PriceTable | undefined>;
  deletePriceTable(id: number): Promise<boolean>;
  getCustomerPrices(userId: string): Promise<CustomerPrice[]>;
  setCustomerPrice(price: InsertCustomerPrice): Promise<CustomerPrice>;
  deleteCustomerPrice(id: number): Promise<boolean>;
  getCoupons(): Promise<Coupon[]>;
  getCoupon(id: number): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(
    id: number,
    coupon: Partial<InsertCoupon>
  ): Promise<Coupon | undefined>;
  deleteCoupon(id: number): Promise<boolean>;
  incrementCouponUsage(id: number): Promise<void>;
  getAgendaEvents(filters?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<AgendaEvent[]>;
  getAgendaEvent(id: number): Promise<AgendaEvent | undefined>;
  createAgendaEvent(event: InsertAgendaEvent): Promise<AgendaEvent>;
  updateAgendaEvent(
    id: number,
    event: Partial<InsertAgendaEvent>
  ): Promise<AgendaEvent | undefined>;
  deleteAgendaEvent(id: number): Promise<boolean>;
  getSiteSetting(key: string): Promise<SiteSetting | undefined>;
  setSiteSetting(key: string, value: string): Promise<SiteSetting>;
  getCatalogBanners(position?: string): Promise<CatalogBanner[]>;
  getCatalogBanner(id: number): Promise<CatalogBanner | undefined>;
  createCatalogBanner(banner: InsertCatalogBanner): Promise<CatalogBanner>;
  updateCatalogBanner(
    id: number,
    banner: Partial<InsertCatalogBanner>
  ): Promise<CatalogBanner | undefined>;
  deleteCatalogBanner(id: number): Promise<boolean>;
  getCatalogSlides(): Promise<CatalogSlide[]>;
  getCatalogSlide(id: number): Promise<CatalogSlide | undefined>;
  createCatalogSlide(slide: InsertCatalogSlide): Promise<CatalogSlide>;
  updateCatalogSlide(
    id: number,
    slide: Partial<InsertCatalogSlide>
  ): Promise<CatalogSlide | undefined>;
  deleteCatalogSlide(id: number): Promise<boolean>;
  getCatalogConfig(key: string): Promise<CatalogConfig | undefined>;
  setCatalogConfig(key: string, value: string): Promise<CatalogConfig>;
  getCustomerCredits(userId: string): Promise<CustomerCredit[]>;
  getAllCredits(): Promise<CustomerCredit[]>;
  getCustomerCredit(id: number): Promise<CustomerCredit | undefined>;
  createCustomerCredit(credit: InsertCustomerCredit): Promise<CustomerCredit>;
  updateCustomerCredit(
    id: number,
    credit: Partial<InsertCustomerCredit>
  ): Promise<CustomerCredit | undefined>;
  deleteCustomerCredit(id: number): Promise<boolean>;
  getCustomerCreditBalance(
    userId: string
  ): Promise<{ total: number; pending: number; paid: number }>;
  getCreditPayments(creditId: number): Promise<CreditPayment[]>;
  createCreditPayment(payment: InsertCreditPayment): Promise<CreditPayment>;
  getModules(): Promise<Module[]>;
  getModule(key: string): Promise<Module | undefined>;
  createModule(module: InsertModule): Promise<Module>;
  getUserPermissions(userId: string): Promise<UserModulePermission[]>;
  getUserPermissionKeys(userId: string): Promise<string[]>;
  setUserPermissions(userId: string, moduleKeys: string[]): Promise<void>;
  hasModuleAccess(userId: string, moduleKey: string): Promise<boolean>;
  getPaymentTypes(): Promise<PaymentType[]>;
  getPaymentType(id: number): Promise<PaymentType | undefined>;
  createPaymentType(paymentType: InsertPaymentType): Promise<PaymentType>;
  updatePaymentType(
    id: number,
    paymentType: Partial<InsertPaymentType>
  ): Promise<PaymentType | undefined>;
  deletePaymentType(id: number): Promise<boolean>;
  getPaymentIntegrations(): Promise<PaymentIntegration[]>;
  getPaymentIntegration(id: number): Promise<PaymentIntegration | undefined>;
  createPaymentIntegration(
    integration: InsertPaymentIntegration
  ): Promise<PaymentIntegration>;
  updatePaymentIntegration(
    id: number,
    integration: Partial<InsertPaymentIntegration>
  ): Promise<PaymentIntegration | undefined>;
  deletePaymentIntegration(id: number): Promise<boolean>;
  getPurchaseOrders(filters?: {
    status?: string;
    search?: string;
  }): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: number): Promise<PurchaseOrder | undefined>;
  getPurchaseOrderWithDetails(id: number): Promise<any | undefined>;
  getNextPurchaseOrderNumber(): Promise<string>;
  createPurchaseOrder(order: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(
    id: number,
    order: Partial<InsertPurchaseOrder>
  ): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(id: number): Promise<boolean>;
  getPurchaseOrderItems(orderId: number): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(
    item: InsertPurchaseOrderItem
  ): Promise<PurchaseOrderItem>;
  updatePurchaseOrderItem(
    id: number,
    item: Partial<InsertPurchaseOrderItem>
  ): Promise<PurchaseOrderItem | undefined>;
  deletePurchaseOrderItem(id: number): Promise<boolean>;
  getStockMovements(productId?: number): Promise<StockMovement[]>;
  getStockMovementsByRef(
    refType: string,
    refId: number
  ): Promise<StockMovement[]>;
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
    // CRÍTICO: Criptografa a senha se ela for enviada em texto puro (ex: "123")
    if (userData.password && !userData.password.includes(".")) {
      userData.password = await hashPassword(userData.password);
    }

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

  async updateUser(
    id: string,
    userData: Partial<InsertUser>
  ): Promise<User | undefined> {
    const { createdAt, updatedAt, ...safeData } = userData as any;

    // Criptografa a senha se estiver sendo atualizada
    if (safeData.password && !safeData.password.includes(".")) {
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

  // --- O RESTANTE DOS MÉTODOS (CATEGORIES, PRODUCTS, ETC) CONTINUA ABAIXO ---
  // (Mantenha o código original para Categories, Products, Orders, etc)
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }
  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    return category;
  }
  async getCategoryByBlingId(blingId: number): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.blingId, blingId));
    return category;
  }
  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }
  async updateCategory(
    id: number,
    categoryData: Partial<InsertCategory>
  ): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();
    return category;
  }
  async deleteCategory(id: number): Promise<boolean> {
    await db.delete(categories).where(eq(categories.id, id));
    return true;
  }
  async getSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).orderBy(suppliers.name);
  }
  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id));
    return supplier;
  }
  async createSupplier(insertSupplier: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db
      .insert(suppliers)
      .values(insertSupplier)
      .returning();
    return supplier;
  }
  async updateSupplier(
    id: number,
    supplierData: Partial<InsertSupplier>
  ): Promise<Supplier | undefined> {
    const [supplier] = await db
      .update(suppliers)
      .set(supplierData)
      .where(eq(suppliers.id, id))
      .returning();
    return supplier;
  }
  async deleteSupplier(id: number): Promise<boolean> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
    return true;
  }
  async getProducts(filters?: any): Promise<any> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;
    const conditions = [];
    if (filters?.categoryId)
      conditions.push(eq(products.categoryId, filters.categoryId));
    if (filters?.search)
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.sku, `%${filters.search}%`)
        )
      );
    const productList = await db
      .select()
      .from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(limit)
      .offset(offset);
    const totalResult = await db
      .select({ count: count() })
      .from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return {
      products: productList,
      total: totalResult[0].count,
      page,
      totalPages: Math.ceil(totalResult[0].count / limit),
    };
  }
  async getProduct(id: number): Promise<Product | undefined> {
    const [p] = await db.select().from(products).where(eq(products.id, id));
    return p;
  }
  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [p] = await db.select().from(products).where(eq(products.sku, sku));
    return p;
  }
  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [p] = await db.insert(products).values(insertProduct).returning();
    return p;
  }
  async updateProduct(id: number, data: any): Promise<any> {
    const [p] = await db
      .update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning();
    return p;
  }
  async deleteProduct(id: number): Promise<boolean> {
    await db.delete(products).where(eq(products.id, id));
    return true;
  }
  async getOrders(userId?: string): Promise<Order[]> {
    return userId
      ? db.select().from(orders).where(eq(orders.userId, userId))
      : db.select().from(orders);
  }
  async getOrder(id: number): Promise<Order | undefined> {
    const [o] = await db.select().from(orders).where(eq(orders.id, id));
    return o;
  }
  async getNextOrderNumber(): Promise<number> {
    const res = await db.execute(
      sql`SELECT nextval('order_number_seq') as num`
    );
    return Number((res.rows[0] as any).num);
  }
  async createOrder(data: InsertOrder): Promise<Order> {
    const [o] = await db.insert(orders).values(data).returning();
    return o;
  }
  async updateOrder(id: number, data: any): Promise<any> {
    const [o] = await db
      .update(orders)
      .set(data)
      .where(eq(orders.id, id))
      .returning();
    return o;
  }
  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }
  async createOrderItem(data: InsertOrderItem): Promise<OrderItem> {
    const [i] = await db.insert(orderItems).values(data).returning();
    return i;
  }
  async getPriceTables(): Promise<PriceTable[]> {
    return db.select().from(priceTables);
  }
  async getPriceTable(id: number): Promise<PriceTable | undefined> {
    const [t] = await db
      .select()
      .from(priceTables)
      .where(eq(priceTables.id, id));
    return t;
  }
  async createPriceTable(data: any): Promise<any> {
    const [t] = await db.insert(priceTables).values(data).returning();
    return t;
  }
  async updatePriceTable(id: number, data: any): Promise<any> {
    const [t] = await db
      .update(priceTables)
      .set(data)
      .where(eq(priceTables.id, id))
      .returning();
    return t;
  }
  async deletePriceTable(id: number): Promise<boolean> {
    await db.delete(priceTables).where(eq(priceTables.id, id));
    return true;
  }
  async getCustomerPrices(userId: string): Promise<CustomerPrice[]> {
    return db
      .select()
      .from(customerPrices)
      .where(eq(customerPrices.userId, userId));
  }
  async setCustomerPrice(data: any): Promise<any> {
    const [p] = await db.insert(customerPrices).values(data).returning();
    return p;
  }
  async deleteCustomerPrice(id: number): Promise<boolean> {
    await db.delete(customerPrices).where(eq(customerPrices.id, id));
    return true;
  }
  async getCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons);
  }
  async getCoupon(id: number): Promise<Coupon | undefined> {
    const [c] = await db.select().from(coupons).where(eq(coupons.id, id));
    return c;
  }
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [c] = await db.select().from(coupons).where(eq(coupons.code, code));
    return c;
  }
  async createCoupon(data: any): Promise<any> {
    const [c] = await db.insert(coupons).values(data).returning();
    return c;
  }
  async updateCoupon(id: number, data: any): Promise<any> {
    const [c] = await db
      .update(coupons)
      .set(data)
      .where(eq(coupons.id, id))
      .returning();
    return c;
  }
  async deleteCoupon(id: number): Promise<boolean> {
    await db.delete(coupons).where(eq(coupons.id, id));
    return true;
  }
  async incrementCouponUsage(id: number): Promise<void> {
    await db
      .update(coupons)
      .set({ usageCount: sql`usage_count + 1` })
      .where(eq(coupons.id, id));
  }
  async getAgendaEvents(f?: any): Promise<any> {
    return db.select().from(agendaEvents);
  }
  async getAgendaEvent(id: number): Promise<any> {
    const [e] = await db
      .select()
      .from(agendaEvents)
      .where(eq(agendaEvents.id, id));
    return e;
  }
  async createAgendaEvent(data: any): Promise<any> {
    const [e] = await db.insert(agendaEvents).values(data).returning();
    return e;
  }
  async updateAgendaEvent(id: number, data: any): Promise<any> {
    const [e] = await db
      .update(agendaEvents)
      .set(data)
      .where(eq(agendaEvents.id, id))
      .returning();
    return e;
  }
  async deleteAgendaEvent(id: number): Promise<boolean> {
    await db.delete(agendaEvents).where(eq(agendaEvents.id, id));
    return true;
  }
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
  async getCatalogBanners(pos?: any): Promise<any> {
    return db.select().from(catalogBanners);
  }
  async getCatalogBanner(id: number): Promise<any> {
    const [b] = await db
      .select()
      .from(catalogBanners)
      .where(eq(catalogBanners.id, id));
    return b;
  }
  async createCatalogBanner(data: any): Promise<any> {
    const [b] = await db.insert(catalogBanners).values(data).returning();
    return b;
  }
  async updateCatalogBanner(id: number, data: any): Promise<any> {
    const [b] = await db
      .update(catalogBanners)
      .set(data)
      .where(eq(catalogBanners.id, id))
      .returning();
    return b;
  }
  async deleteCatalogBanner(id: number): Promise<boolean> {
    await db.delete(catalogBanners).where(eq(catalogBanners.id, id));
    return true;
  }
  async getCatalogSlides(): Promise<any> {
    return db.select().from(catalogSlides);
  }
  async getCatalogSlide(id: number): Promise<any> {
    const [s] = await db
      .select()
      .from(catalogSlides)
      .where(eq(catalogSlides.id, id));
    return s;
  }
  async createCatalogSlide(data: any): Promise<any> {
    const [s] = await db.insert(catalogSlides).values(data).returning();
    return s;
  }
  async updateCatalogSlide(id: number, data: any): Promise<any> {
    const [s] = await db
      .update(catalogSlides)
      .set(data)
      .where(eq(catalogSlides.id, id))
      .returning();
    return s;
  }
  async deleteCatalogSlide(id: number): Promise<boolean> {
    await db.delete(catalogSlides).where(eq(catalogSlides.id, id));
    return true;
  }
  async getCatalogConfig(key: string): Promise<any> {
    const [c] = await db
      .select()
      .from(catalogConfig)
      .where(eq(catalogConfig.key, key));
    return c;
  }
  async setCatalogConfig(key: string, value: string): Promise<any> {
    const [c] = await db
      .insert(catalogConfig)
      .values({ key, value })
      .onConflictDoUpdate({ target: catalogConfig.key, set: { value } })
      .returning();
    return c;
  }
  async getCustomerCredits(userId: string): Promise<any> {
    return db
      .select()
      .from(customerCredits)
      .where(eq(customerCredits.userId, userId));
  }
  async getAllCredits(): Promise<any> {
    return db.select().from(customerCredits);
  }
  async getCustomerCredit(id: number): Promise<any> {
    const [c] = await db
      .select()
      .from(customerCredits)
      .where(eq(customerCredits.id, id));
    return c;
  }
  async createCustomerCredit(data: any): Promise<any> {
    const [c] = await db.insert(customerCredits).values(data).returning();
    return c;
  }
  async updateCustomerCredit(id: number, data: any): Promise<any> {
    const [c] = await db
      .update(customerCredits)
      .set(data)
      .where(eq(customerCredits.id, id))
      .returning();
    return c;
  }
  async deleteCustomerCredit(id: number): Promise<boolean> {
    await db.delete(customerCredits).where(eq(customerCredits.id, id));
    return true;
  }
  async getCustomerCreditBalance(userId: string): Promise<any> {
    return { total: 0, pending: 0, paid: 0 };
  }
  async getCreditPayments(creditId: number): Promise<any> {
    return db
      .select()
      .from(creditPayments)
      .where(eq(creditPayments.creditId, creditId));
  }
  async createCreditPayment(data: any): Promise<any> {
    const [p] = await db.insert(creditPayments).values(data).returning();
    return p;
  }
  async getModules(): Promise<any> {
    return db.select().from(modules);
  }
  async getModule(key: string): Promise<any> {
    const [m] = await db.select().from(modules).where(eq(modules.key, key));
    return m;
  }
  async createModule(data: any): Promise<any> {
    const [m] = await db.insert(modules).values(data).returning();
    return m;
  }
  async getUserPermissions(userId: string): Promise<any> {
    return db
      .select()
      .from(userModulePermissions)
      .where(eq(userModulePermissions.userId, userId));
  }
  async getUserPermissionKeys(userId: string): Promise<any> {
    const p = await this.getUserPermissions(userId);
    return p.map((x: any) => x.moduleKey);
  }
  async setUserPermissions(userId: string, keys: string[]): Promise<void> {
    await db
      .delete(userModulePermissions)
      .where(eq(userModulePermissions.userId, userId));
    if (keys.length)
      await db
        .insert(userModulePermissions)
        .values(keys.map((k) => ({ userId, moduleKey: k })));
  }
  async hasModuleAccess(userId: string, key: string): Promise<boolean> {
    const p = await this.getUserPermissionKeys(userId);
    return p.includes(key);
  }
  async getPaymentTypes(): Promise<any> {
    return db.select().from(paymentTypes);
  }
  async getPaymentType(id: number): Promise<any> {
    const [p] = await db
      .select()
      .from(paymentTypes)
      .where(eq(paymentTypes.id, id));
    return p;
  }
  async createPaymentType(data: any): Promise<any> {
    const [p] = await db.insert(paymentTypes).values(data).returning();
    return p;
  }
  async updatePaymentType(id: number, data: any): Promise<any> {
    const [p] = await db
      .update(paymentTypes)
      .set(data)
      .where(eq(paymentTypes.id, id))
      .returning();
    return p;
  }
  async deletePaymentType(id: number): Promise<boolean> {
    await db.delete(paymentTypes).where(eq(paymentTypes.id, id));
    return true;
  }
  async getPaymentIntegrations(): Promise<any> {
    return db.select().from(paymentIntegrations);
  }
  async getPaymentIntegration(id: number): Promise<any> {
    const [i] = await db
      .select()
      .from(paymentIntegrations)
      .where(eq(paymentIntegrations.id, id));
    return i;
  }
  async createPaymentIntegration(data: any): Promise<any> {
    const [i] = await db.insert(paymentIntegrations).values(data).returning();
    return i;
  }
  async updatePaymentIntegration(id: number, data: any): Promise<any> {
    const [i] = await db
      .update(paymentIntegrations)
      .set(data)
      .where(eq(paymentIntegrations.id, id))
      .returning();
    return i;
  }
  async deletePaymentIntegration(id: number): Promise<boolean> {
    await db.delete(paymentIntegrations).where(eq(paymentIntegrations.id, id));
    return true;
  }
  async getPurchaseOrders(f?: any): Promise<any> {
    return db.select().from(purchaseOrders);
  }
  async getPurchaseOrder(id: number): Promise<any> {
    const [o] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id));
    return o;
  }
  async getPurchaseOrderWithDetails(id: number): Promise<any> {
    return undefined;
  }
  async getNextPurchaseOrderNumber(): Promise<string> {
    return "PO-1";
  }
  async createPurchaseOrder(data: any): Promise<any> {
    const [o] = await db.insert(purchaseOrders).values(data).returning();
    return o;
  }
  async updatePurchaseOrder(id: number, data: any): Promise<any> {
    const [o] = await db
      .update(purchaseOrders)
      .set(data)
      .where(eq(purchaseOrders.id, id))
      .returning();
    return o;
  }
  async deletePurchaseOrder(id: number): Promise<boolean> {
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
    return true;
  }
  async getPurchaseOrderItems(orderId: number): Promise<any> {
    return db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, orderId));
  }
  async createPurchaseOrderItem(data: any): Promise<any> {
    const [i] = await db.insert(purchaseOrderItems).values(data).returning();
    return i;
  }
  async updatePurchaseOrderItem(id: number, data: any): Promise<any> {
    const [i] = await db
      .update(purchaseOrderItems)
      .set(data)
      .where(eq(purchaseOrderItems.id, id))
      .returning();
    return i;
  }
  async deletePurchaseOrderItem(id: number): Promise<boolean> {
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
    return true;
  }
  async getStockMovements(pId?: number): Promise<any> {
    return db.select().from(stockMovements);
  }
  async getStockMovementsByRef(type: string, id: number): Promise<any> {
    return db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.referenceType, type),
          eq(stockMovements.referenceId, id)
        )
      );
  }
  async getOrderWithDetails(id: number): Promise<any> {
    return undefined;
  }
}

export const storage = new DatabaseStorage();
