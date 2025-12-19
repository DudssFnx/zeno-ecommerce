import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, serial, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table - stores all users with role-based access
// Includes Replit Auth fields plus custom B2B fields
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  role: text("role").notNull().default("customer"), // admin, sales, customer, supplier
  allowedBrands: text("allowed_brands").array(),
  customerType: text("customer_type").notNull().default("varejo"), // atacado, varejo
  company: text("company"),
  approved: boolean("approved").notNull().default(false),
  phone: text("phone"),
  personType: text("person_type"), // juridica, fisica
  cnpj: text("cnpj"),
  cpf: text("cpf"),
  tradingName: text("trading_name"), // Nome Fantasia
  stateRegistration: text("state_registration"), // Inscrição Estadual
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

// Categories table with hierarchy support (parent/child)
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
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

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tradingName: text("trading_name"),
  cnpj: text("cnpj"),
  email: text("email"),
  phone: text("phone"),
  contact: text("contact"),
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

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
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
  percentualTributos: decimal("percentual_tributos", { precision: 5, scale: 2 }),
  icmsCst: text("icms_cst"),
  icmsAliquota: decimal("icms_aliquota", { precision: 5, scale: 2 }),
  ipiCst: text("ipi_cst"),
  ipiAliquota: decimal("ipi_aliquota", { precision: 5, scale: 2 }),
  pisCst: text("pis_cst"),
  pisAliquota: decimal("pis_aliquota", { precision: 5, scale: 2 }),
  cofinsCst: text("cofins_cst"),
  cofinsAliquota: decimal("cofins_aliquota", { precision: 5, scale: 2 }),
  valorBaseIcmsStRetencao: decimal("valor_base_icms_st_retencao", { precision: 10, scale: 2 }),
  valorIcmsStRetencao: decimal("valor_icms_st_retencao", { precision: 10, scale: 2 }),
  valorIcmsProprioSubstituto: decimal("valor_icms_proprio_substituto", { precision: 10, scale: 2 }),
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

// Orders table
// STATUS (affects stock - situação do pedido):
// - ORCAMENTO: no stock impact
// - PEDIDO_GERADO: stock RESERVED
// - FATURADO: stock DEDUCTED + sent to ERP
//
// STAGE (organizational - Kanban interno, NÃO afeta estoque):
// 1. AGUARDANDO_IMPRESSAO - Inicial
// 2. PEDIDO_IMPRESSO - Após impressão
// 3. PEDIDO_SEPARADO - Após separação física  
// 4. COBRADO - Após cobrança
// 5. CONFERIR_COMPROVANTE - Aguardando validação
// 6. EM_CONFERENCIA - Em conferência
// 7. AGUARDANDO_ENVIO - Pronto para despacho
// 8. PEDIDO_ENVIADO - Finalizado
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id), // nullable for guest orders
  orderNumber: text("order_number").notNull().unique(),
  status: text("status").notNull().default("ORCAMENTO"),
  stage: text("stage").notNull().default("AGUARDANDO_IMPRESSAO"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  // Guest checkout info (when no userId)
  isGuestOrder: boolean("is_guest_order").notNull().default(false),
  guestCpf: text("guest_cpf"),
  guestName: text("guest_name"),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  // Shipping info
  shippingAddress: text("shipping_address"),
  shippingMethod: text("shipping_method"),
  // Payment info
  paymentMethod: text("payment_method"),
  paymentNotes: text("payment_notes"),
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

// Order Items table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// Customer Price Tables - Personalized pricing per customer (like Mercos)
export const priceTables = pgTable("price_tables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPriceTableSchema = createInsertSchema(priceTables).omit({
  id: true,
  createdAt: true,
});

export type InsertPriceTable = z.infer<typeof insertPriceTableSchema>;
export type PriceTable = typeof priceTables.$inferSelect;

// Customer-specific product prices
export const customerPrices = pgTable("customer_prices", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  customPrice: decimal("custom_price", { precision: 10, scale: 2 }).notNull(),
});

export const insertCustomerPriceSchema = createInsertSchema(customerPrices).omit({
  id: true,
});

export type InsertCustomerPrice = z.infer<typeof insertCustomerPriceSchema>;
export type CustomerPrice = typeof customerPrices.$inferSelect;

// Coupons and promotions (like Mercos)
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  discountType: text("discount_type").notNull().default("percent"), // percent, fixed
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
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

// Agenda/Calendar events for admin panel
export const agendaEvents = pgTable("agenda_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  time: text("time"),
  type: text("type").notNull().default("note"), // note, meeting, task, reminder
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

// Site settings for global configurations
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;

// Catalog banners for customization
export const catalogBanners = pgTable("catalog_banners", {
  id: serial("id").primaryKey(),
  position: text("position").notNull(), // hero, promo1, promo2, promo3, footer
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

export const insertCatalogBannerSchema = createInsertSchema(catalogBanners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCatalogBanner = z.infer<typeof insertCatalogBannerSchema>;
export type CatalogBanner = typeof catalogBanners.$inferSelect;

// Catalog carousel slides (hero slider)
export const catalogSlides = pgTable("catalog_slides", {
  id: serial("id").primaryKey(),
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

// Catalog customization settings
export const catalogConfig = pgTable("catalog_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type CatalogConfig = typeof catalogConfig.$inferSelect;

// Customer Credit (Fiado) - Store credit transactions
// TYPE:
// - DEBITO: Amount added to customer debt (purchase on credit)
// - CREDITO: Payment received (reduces debt)
// STATUS:
// - PENDENTE: Pending payment
// - PARCIAL: Partially paid
// - PAGO: Fully paid
// - VENCIDO: Overdue
// - CANCELADO: Cancelled
export const customerCredits = pgTable("customer_credits", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  orderId: integer("order_id").references(() => orders.id), // Optional link to order
  type: text("type").notNull(), // DEBITO, CREDITO
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  description: text("description"),
  status: text("status").notNull().default("PENDENTE"), // PENDENTE, PARCIAL, PAGO, VENCIDO, CANCELADO
  dueDate: timestamp("due_date"), // Data de vencimento
  paidAt: timestamp("paid_at"), // Data do pagamento
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerCreditSchema = createInsertSchema(customerCredits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomerCredit = z.infer<typeof insertCustomerCreditSchema>;
export type CustomerCredit = typeof customerCredits.$inferSelect;

// Customer credit payments - individual payments for a credit entry
export const creditPayments = pgTable("credit_payments", {
  id: serial("id").primaryKey(),
  creditId: integer("credit_id").notNull().references(() => customerCredits.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"), // PIX, DINHEIRO, CARTAO, BOLETO, TRANSFERENCIA
  notes: text("notes"),
  receivedBy: varchar("received_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCreditPaymentSchema = createInsertSchema(creditPayments).omit({
  id: true,
  createdAt: true,
});

export type InsertCreditPayment = z.infer<typeof insertCreditPaymentSchema>;
export type CreditPayment = typeof creditPayments.$inferSelect;

// Accounts Payable (Contas a Pagar) - Expenses and supplier debts
// STATUS:
// - PENDENTE: Pending payment
// - PAGO: Paid
// - VENCIDO: Overdue
// - CANCELADO: Cancelled
export const accountsPayable = pgTable("accounts_payable", {
  id: serial("id").primaryKey(),
  supplierId: varchar("supplier_id").references(() => users.id), // Optional link to supplier
  supplierName: text("supplier_name"), // Or manual supplier name
  category: text("category"), // Tipo: fornecedor, aluguel, salario, imposto, etc.
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("PENDENTE"), // PENDENTE, PAGO, VENCIDO, CANCELADO
  dueDate: timestamp("due_date"), // Data de vencimento
  paidAt: timestamp("paid_at"), // Data do pagamento
  paymentMethod: text("payment_method"), // PIX, BOLETO, TRANSFERENCIA, etc.
  documentNumber: text("document_number"), // Número do documento/NF
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAccountPayableSchema = createInsertSchema(accountsPayable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAccountPayable = z.infer<typeof insertAccountPayableSchema>;
export type AccountPayable = typeof accountsPayable.$inferSelect;

// Accounts Payable payments - individual payments
export const payablePayments = pgTable("payable_payments", {
  id: serial("id").primaryKey(),
  payableId: integer("payable_id").notNull().references(() => accountsPayable.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"), // PIX, BOLETO, TRANSFERENCIA, DINHEIRO
  notes: text("notes"),
  paidBy: varchar("paid_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPayablePaymentSchema = createInsertSchema(payablePayments).omit({
  id: true,
  createdAt: true,
});

export type InsertPayablePayment = z.infer<typeof insertPayablePaymentSchema>;
export type PayablePayment = typeof payablePayments.$inferSelect;

// Banners for carousel
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

// System modules for permission management
export const modules = pgTable("modules", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // catalog, orders, products, customers, etc.
  label: text("label").notNull(), // Display name in Portuguese
  description: text("description"),
  icon: text("icon"), // lucide icon name
  defaultRoles: text("default_roles").array(), // roles that have access by default
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertModuleSchema = createInsertSchema(modules).omit({
  id: true,
});

export type InsertModule = z.infer<typeof insertModuleSchema>;
export type Module = typeof modules.$inferSelect;

// User module permissions - which modules each user can access
export const userModulePermissions = pgTable("user_module_permissions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  moduleKey: text("module_key").notNull(),
  allowed: boolean("allowed").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserModulePermissionSchema = createInsertSchema(userModulePermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserModulePermission = z.infer<typeof insertUserModulePermissionSchema>;
export type UserModulePermission = typeof userModulePermissions.$inferSelect;

// Bling OAuth tokens - persisted storage for API tokens
export const blingTokens = pgTable("bling_tokens", {
  id: serial("id").primaryKey(),
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
