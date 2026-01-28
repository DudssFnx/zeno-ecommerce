import { sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// --- USERS (Inglês) ---
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  email: text("email").unique(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  role: text("role").notNull().default("customer"),
  allowedBrands: text("allowed_brands").array(),
  customerType: text("customer_type").notNull().default("varejo"),
  company: text("company"),
  approved: boolean("approved").notNull().default(false),
  phone: text("phone"),
  personType: text("person_type"),
  cnpj: text("cnpj"),
  cpf: text("cpf"),
  tradingName: text("trading_name"),
  stateRegistration: text("state_registration"),
  cep: text("cep"),
  address: text("address"),
  addressNumber: text("address_number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  tag: text("tag"),
  instagram: text("instagram"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;

// Categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: integer("parent_id"),
  hideFromVarejo: boolean("hide_from_varejo").notNull().default(false),
  blingId: integer("bling_id"),
});
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  tradingName: text("trading_name"),
  cnpj: text("cnpj"),
  email: text("email"),
  phone: text("phone"),
  contact: text("contact"),
  paymentTerms: text("payment_terms"),
  minOrderValue: decimal("min_order_value", {
    precision: 10,
    scale: 2,
  }).default("0"),
  leadTime: integer("lead_time"),
  bankInfo: text("bank_info"),
  cep: text("cep"),
  address: text("address"),
  addressNumber: text("address_number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
});
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

// Products
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  categoryId: integer("category_id").references(() => categories.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  brand: text("brand"),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  stock: integer("stock").notNull().default(0),
  reservedStock: integer("reserved_stock").notNull().default(0),
  image: text("image"),
  images: text("images").array(),
  featured: boolean("featured").notNull().default(false),
  weight: decimal("weight", { precision: 10, scale: 3 }),
  width: decimal("width", { precision: 10, scale: 2 }),
  height: decimal("height", { precision: 10, scale: 2 }),
  depth: decimal("depth", { precision: 10, scale: 2 }),
  gtin: text("gtin"),
  gtinTributario: text("gtin_tributario"),
  origem: text("origem"),
  ncm: text("ncm"),
  cest: text("cest"),
  tipoItem: text("tipo_item"),
  percentualTributos: decimal("percentual_tributos", {
    precision: 5,
    scale: 2,
  }),
  icmsCst: text("icms_cst"),
  icmsAliquota: decimal("icms_aliquota", { precision: 5, scale: 2 }),
  ipiCst: text("ipi_cst"),
  ipiAliquota: decimal("ipi_aliquota", { precision: 5, scale: 2 }),
  pisCst: text("pis_cst"),
  pisAliquota: decimal("pis_aliquota", { precision: 5, scale: 2 }),
  cofinsCst: text("cofins_cst"),
  cofinsAliquota: decimal("cofins_aliquota", { precision: 5, scale: 2 }),
  valorBaseIcmsStRetencao: decimal("valor_base_icms_st_retencao", {
    precision: 10,
    scale: 2,
  }),
  valorIcmsStRetencao: decimal("valor_icms_st_retencao", {
    precision: 10,
    scale: 2,
  }),
  valorIcmsProprioSubstituto: decimal("valor_icms_proprio_substituto", {
    precision: 10,
    scale: 2,
  }),
  codigoExcecaoTipi: text("codigo_excecao_tipi"),
  valorPisFixo: decimal("valor_pis_fixo", { precision: 10, scale: 4 }),
  valorCofinsFixo: decimal("valor_cofins_fixo", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Orders
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  userId: varchar("user_id").references(() => users.id),
  orderNumber: text("order_number").notNull().unique(),
  status: text("status").notNull().default("ORCAMENTO"),
  stage: text("stage").notNull().default("AGUARDANDO_IMPRESSAO"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  isGuestOrder: boolean("is_guest_order").notNull().default(false),
  guestCpf: text("guest_cpf"),
  guestName: text("guest_name"),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  shippingAddress: text("shipping_address"),
  shippingMethod: text("shipping_method"),
  paymentMethod: text("payment_method"),
  paymentTypeId: integer("payment_type_id"),
  paymentNotes: text("payment_notes"),
  fiadoInstallments: jsonb("fiado_installments"),
  notes: text("notes"),
  printed: boolean("printed").notNull().default(false),
  printedAt: timestamp("printed_at"),
  printedBy: varchar("printed_by").references(() => users.id),
  reservedAt: timestamp("reserved_at"),
  reservedBy: varchar("reserved_by").references(() => users.id),
  invoicedAt: timestamp("invoiced_at"),
  invoicedBy: varchar("invoiced_by").references(() => users.id),
  blingOrderId: text("bling_order_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Order Items
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
});
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// Stock Movements
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  reason: text("reason").notNull(),
  refType: text("ref_type"),
  refId: integer("ref_id"),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  qty: decimal("qty", { precision: 10, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertStockMovementSchema = createInsertSchema(
  stockMovements,
).omit({ id: true, createdAt: true });
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;

// Purchase Orders
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  status: text("status").notNull().default("DRAFT"),
  number: text("number"),
  issueDate: timestamp("issue_date"),
  deliveryDate: timestamp("delivery_date"),
  totalValue: decimal("total_value", { precision: 10, scale: 2 }),
  notes: text("notes"),
  postedAt: timestamp("posted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertPurchaseOrderSchema = createInsertSchema(
  purchaseOrders,
).omit({ id: true, createdAt: true });
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

// Purchase Order Items
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  qty: decimal("qty", { precision: 10, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  sellPrice: decimal("sell_price", { precision: 10, scale: 2 }),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }),
  descriptionSnapshot: text("description_snapshot"),
  skuSnapshot: text("sku_snapshot"),
});
export const insertPurchaseOrderItemSchema = createInsertSchema(
  purchaseOrderItems,
).omit({ id: true });
export type InsertPurchaseOrderItem = z.infer<
  typeof insertPurchaseOrderItemSchema
>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

// Bling
export const blingCredentials = pgTable("bling_credentials", {
  id: serial("id").primaryKey(),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  code: text("code"),
  companyId: varchar("company_id"),
  redirectUri: text("redirect_uri"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const blingTokens = pgTable("bling_tokens", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  tokenType: text("token_type").notNull().default("Bearer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertBlingTokensSchema = createInsertSchema(blingTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBlingTokens = z.infer<typeof insertBlingTokensSchema>;
export type BlingTokens = typeof blingTokens.$inferSelect;

// ✅ TABELAS CRÍTICAS QUE FALTAVAM
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type SiteSetting = typeof siteSettings.$inferSelect;

export const banners = pgTable("banners", {
  id: serial("id").primaryKey(),
  title: text("title"),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertBannerSchema = createInsertSchema(banners).omit({
  id: true,
  createdAt: true,
});
export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof banners.$inferSelect;

export const modules = pgTable("modules", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  icon: text("icon"),
  defaultRoles: text("default_roles").array(),
  sortOrder: integer("sort_order").notNull().default(0),
});
export const insertModuleSchema = createInsertSchema(modules).omit({
  id: true,
});
export type InsertModule = z.infer<typeof insertModuleSchema>;
export type Module = typeof modules.$inferSelect;

export const userModulePermissions = pgTable("user_module_permissions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  moduleKey: text("module_key").notNull(),
  allowed: boolean("allowed").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertUserModulePermissionSchema = createInsertSchema(
  userModulePermissions,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserModulePermission = z.infer<
  typeof insertUserModulePermissionSchema
>;
export type UserModulePermission = typeof userModulePermissions.$inferSelect;

// Price Tables e Customer Prices
export const priceTables = pgTable("price_tables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  discountPercent: decimal("discount_percent", {
    precision: 5,
    scale: 2,
  }).default("0"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertPriceTableSchema = createInsertSchema(priceTables).omit({
  id: true,
  createdAt: true,
});
export type InsertPriceTable = z.infer<typeof insertPriceTableSchema>;
export type PriceTable = typeof priceTables.$inferSelect;

export const customerPrices = pgTable("customer_prices", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  customPrice: decimal("custom_price", { precision: 10, scale: 2 }).notNull(),
});
export const insertCustomerPriceSchema = createInsertSchema(
  customerPrices,
).omit({ id: true });
export type InsertCustomerPrice = z.infer<typeof insertCustomerPriceSchema>;
export type CustomerPrice = typeof customerPrices.$inferSelect;

// Coupons
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  discountType: text("discount_type").notNull().default("percent"),
  discountValue: decimal("discount_value", {
    precision: 10,
    scale: 2,
  }).notNull(),
  minOrderValue: decimal("min_order_value", { precision: 10, scale: 2 }),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  usedCount: true,
  createdAt: true,
});
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;

// Agenda Events
export const agendaEvents = pgTable("agenda_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  time: text("time"),
  type: text("type").notNull().default("note"),
  completed: boolean("completed").notNull().default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertAgendaEventSchema = createInsertSchema(agendaEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertAgendaEvent = z.infer<typeof insertAgendaEventSchema>;
export type AgendaEvent = typeof agendaEvents.$inferSelect;

// Catalog Banners
export const catalogBanners = pgTable("catalog_banners", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  position: text("position").notNull(),
  title: text("title"),
  subtitle: text("subtitle"),
  buttonText: text("button_text"),
  buttonLink: text("button_link"),
  imageUrl: text("image_url"),
  mobileImageUrl: text("mobile_image_url"),
  backgroundColor: text("background_color"),
  textColor: text("text_color"),
  order: integer("order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertCatalogBannerSchema = createInsertSchema(
  catalogBanners,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCatalogBanner = z.infer<typeof insertCatalogBannerSchema>;
export type CatalogBanner = typeof catalogBanners.$inferSelect;

// Catalog Slides
export const catalogSlides = pgTable("catalog_slides", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  title: text("title"),
  subtitle: text("subtitle"),
  buttonText: text("button_text"),
  buttonLink: text("button_link"),
  imageUrl: text("image_url").notNull(),
  mobileImageUrl: text("mobile_image_url"),
  order: integer("order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertCatalogSlideSchema = createInsertSchema(catalogSlides).omit({
  id: true,
  createdAt: true,
});
export type InsertCatalogSlide = z.infer<typeof insertCatalogSlideSchema>;
export type CatalogSlide = typeof catalogSlides.$inferSelect;

// Catalog Config
export const catalogConfig = pgTable("catalog_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type CatalogConfig = typeof catalogConfig.$inferSelect;

// Customer Credits
export const customerCredits = pgTable("customer_credits", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  orderId: integer("order_id").references(() => orders.id),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  description: text("description"),
  status: text("status").notNull().default("PENDENTE"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertCustomerCreditSchema = createInsertSchema(
  customerCredits,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomerCredit = z.infer<typeof insertCustomerCreditSchema>;
export type CustomerCredit = typeof customerCredits.$inferSelect;

// Credit Payments
export const creditPayments = pgTable("credit_payments", {
  id: serial("id").primaryKey(),
  creditId: integer("credit_id")
    .notNull()
    .references(() => customerCredits.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  receivedBy: varchar("received_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertCreditPaymentSchema = createInsertSchema(
  creditPayments,
).omit({ id: true });
export type InsertCreditPayment = z.infer<typeof insertCreditPaymentSchema>;
export type CreditPayment = typeof creditPayments.$inferSelect;

// Accounts Payable
export const accountsPayable = pgTable("accounts_payable", {
  id: serial("id").primaryKey(),
  supplierId: varchar("supplier_id").references(() => users.id),
  supplierName: text("supplier_name"),
  category: text("category"),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  status: text("status").notNull().default("PENDENTE"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"),
  documentNumber: text("document_number"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertAccountPayableSchema = createInsertSchema(
  accountsPayable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAccountPayable = z.infer<typeof insertAccountPayableSchema>;
export type AccountPayable = typeof accountsPayable.$inferSelect;

// Payable Payments
export const payablePayments = pgTable("payable_payments", {
  id: serial("id").primaryKey(),
  payableId: integer("payable_id")
    .notNull()
    .references(() => accountsPayable.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  paidBy: varchar("paid_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertPayablePaymentSchema = createInsertSchema(
  payablePayments,
).omit({ id: true });
export type InsertPayablePayment = z.infer<typeof insertPayablePaymentSchema>;
export type PayablePayment = typeof payablePayments.$inferSelect;
