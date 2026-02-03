import { sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- ENUMS ---
export const orderChannelEnum = pgEnum("order_channel", [
  "SITE",
  "ADMIN",
  "REPRESENTANTE",
  "API",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "ORCAMENTO",
  "GERADO",
  "FATURADO",
  "CANCELADO",
]);
export const productStatusEnum = pgEnum("product_status", [
  "ATIVO",
  "INATIVO",
  "RASCUNHO",
]);
export const approvalStatusEnum = pgEnum("approval_status", [
  "PENDENTE",
  "APROVADO",
  "REJEITADO",
  "BLOQUEADO",
]);
export const tipoClienteEnum = pgEnum("tipo_cliente", [
  "VAREJO",
  "ATACADO",
  "DISTRIBUIDOR",
]);

// --- COMPANIES ---
export const companies = pgTable("companies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  razaoSocial: text("razao_social"),
  fantasyName: text("fantasy_name"),
  nomeFantasia: text("nome_fantasia"),
  cnpj: text("cnpj"),
  email: text("email"),
  phone: text("phone"),
  telefone: text("telefone"),
  address: text("address"),
  cep: text("cep"),
  endereco: text("endereco"),
  numero: text("numero"),
  complemento: text("complemento"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  estado: text("estado"),
  inscricaoEstadual: text("inscricao_estadual"),

  tipoCliente: tipoClienteEnum("tipo_cliente").default("VAREJO"),
  approvalStatus: approvalStatusEnum("approval_status").default("APROVADO"),

  active: boolean("active").default(true),
  ativo: boolean("ativo").default(true),
  slug: text("slug"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- USERS ---
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"), // Corrigido para VARCHAR
  email: text("email").unique(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  role: text("role").default("customer"),

  allowedBrands: text("allowed_brands").array(),
  customerType: text("customer_type"),
  company: text("company"),
  approved: boolean("approved").default(false),
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

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// --- CATEGORIES ---
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"), // Corrigido
  name: text("name").notNull(),
  slug: text("slug"),
  parentId: integer("parent_id"),
  hideFromVarejo: boolean("hide_from_varejo"),
  blingId: integer("bling_id"),
});
export type Category = typeof categories.$inferSelect;

// --- SUPPLIERS ---
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"), // Corrigido
  name: text("name").notNull(),
  tradingName: text("trading_name"),
  cnpj: text("cnpj"),
  email: text("email"),
  phone: text("phone"),
  contact: text("contact"),
  active: boolean("active").default(true),

  cep: text("cep"),
  address: text("address"),
  addressNumber: text("address_number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  minOrderValue: decimal("min_order_value"),
  leadTime: integer("lead_time"),
  bankInfo: text("bank_info"),

  createdAt: timestamp("created_at").defaultNow(),
});

// --- PRODUCTS ---
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"), // Corrigido
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  brand: text("brand"),
  description: text("description"),
  unit: text("unit").default("UN"),

  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }),

  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock"),
  maxStock: integer("max_stock"),
  reservedStock: integer("reserved_stock").default(0),

  image: text("image"),
  images: text("images").array(),

  featured: boolean("featured").default(false),
  status: text("status").default("ATIVO"),

  format: text("format").default("simple"),
  variationsConfig: jsonb("variations_config"),

  weight: decimal("weight", { precision: 10, scale: 3 }),
  grossWeight: decimal("gross_weight", { precision: 10, scale: 3 }),
  width: decimal("width", { precision: 10, scale: 2 }),
  height: decimal("height", { precision: 10, scale: 2 }),
  depth: decimal("depth", { precision: 10, scale: 2 }),

  ncm: text("ncm"),
  cest: text("cest"),
  origem: text("origem"),
  taxOrigin: text("tax_origin"),
  gtin: text("gtin"),
  gtinTributario: text("gtin_tributario"),
  tipoItem: text("tipo_item"),
  percentualTributos: decimal("percentual_tributos"),

  icmsCst: text("icms_cst"),
  icmsAliquota: decimal("icms_aliquota"),
  ipiCst: text("ipi_cst"),
  ipiAliquota: decimal("ipi_aliquota"),
  pisCst: text("pis_cst"),
  pisAliquota: decimal("pis_aliquota"),
  cofinsCst: text("cofins_cst"),
  cofinsAliquota: decimal("cofins_aliquota"),
  valorBaseIcmsStRetencao: decimal("valor_base_icms_st_retencao"),
  valorIcmsStRetencao: decimal("valor_icms_st_retencao"),
  valorIcmsProprioSubstituto: decimal("valor_icms_proprio_substituto"),
  codigoExcecaoTipi: text("codigo_excecao_tipi"),
  valorPisFixo: decimal("valor_pis_fixo"),
  valorCofinsFixo: decimal("valor_cofins_fixo"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});
export type Product = typeof products.$inferSelect;

// --- ORDERS ---
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"), // Corrigido
  userId: varchar("user_id").references(() => users.id),
  orderNumber: text("order_number"),
  status: text("status").default("ORCAMENTO"),
  stage: text("stage"),
  subtotal: decimal("subtotal"),
  shippingCost: decimal("shipping_cost"),
  total: decimal("total", { precision: 10, scale: 2 }),

  isGuestOrder: boolean("is_guest_order"),
  guestName: text("guest_name"),
  guestCpf: text("guest_cpf"),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),

  shippingAddress: text("shipping_address"),
  shippingMethod: text("shipping_method"),
  paymentMethod: text("payment_method"),
  paymentTypeId: integer("payment_type_id"),
  paymentNotes: text("payment_notes"),
  notes: text("notes"),

  printed: boolean("printed"),
  printedAt: timestamp("printed_at"),
  printedBy: text("printed_by"),
  reservedAt: timestamp("reserved_at"),
  reservedBy: text("reserved_by"),
  invoicedAt: timestamp("invoiced_at"),
  invoicedBy: text("invoiced_by"),
  blingOrderId: text("bling_order_id"),
  fiadoInstallments: integer("fiado_installments"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertOrderSchema = createInsertSchema(orders);
export type Order = typeof orders.$inferSelect;

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),

  descriptionSnapshot: text("description_snapshot"),
  skuSnapshot: text("sku_snapshot"),
  lineTotal: decimal("line_total"),
});

// --- TABELAS LEGADO (Mantidas para compatibilidade) ---

export const paymentTypes = pgTable("payment_types", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"), // Corrigido
  name: text("name").notNull(),
  type: text("type"),
  description: text("description"),
  active: boolean("active").default(true),
  isIntegration: boolean("is_integration"),
  integrationId: integer("integration_id"),
  sortOrder: integer("sort_order"),

  feeType: text("fee_type"),
  feeValue: decimal("fee_value"),
  compensationDays: integer("compensation_days"),
  isStoreCredit: boolean("is_store_credit"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"), // Corrigido
  supplierId: integer("supplier_id"),
  number: text("number"),
  status: text("status"),
  notes: text("notes"),
  totalValue: decimal("total_value"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  finalizedAt: timestamp("finalized_at"),
  postedAt: timestamp("posted_at"),
  reversedAt: timestamp("reversed_at"),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id"),
  productId: integer("product_id"),
  quantity: decimal("quantity"),
  qty: decimal("qty"),
  unitCost: decimal("unit_cost"),
  lineTotal: decimal("line_total"),
  descriptionSnapshot: text("description_snapshot"),
  skuSnapshot: text("sku_snapshot"),
});

export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id"),
  type: text("type"),
  quantity: decimal("quantity"),
  qty: decimal("qty"),
  reason: text("reason"),
  unitCost: decimal("unit_cost"),
  refType: text("ref_type"),
  refId: integer("ref_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blingCredentials = pgTable("bling_credentials", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"), // Corrigido
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  code: text("code"),
  redirectUri: text("redirect_uri"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const blingTokens = pgTable("bling_tokens", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"), // Corrigido
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const modules = pgTable("modules", {
  id: serial("id").primaryKey(),
  key: text("key"),
  label: text("label"),
  description: text("description"),
  icon: text("icon"),
  defaultRoles: text("default_roles"),
  sortOrder: integer("sort_order"),
});

export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// Alias Legado
export const b2bUsers = users;
export const b2bProducts = products;
