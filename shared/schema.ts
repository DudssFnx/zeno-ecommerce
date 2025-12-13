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
  role: text("role").notNull().default("customer"), // admin, sales, customer
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
  blingId: integer("bling_id"),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  categoryId: integer("category_id").references(() => categories.id),
  brand: text("brand"),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  orderNumber: text("order_number").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending, approved, processing, completed, cancelled
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  printed: boolean("printed").notNull().default(false),
  printedAt: timestamp("printed_at"),
  printedBy: varchar("printed_by").references(() => users.id),
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
