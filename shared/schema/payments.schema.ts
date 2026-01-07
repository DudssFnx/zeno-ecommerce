import { pgTable, serial, text, varchar, decimal, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const feeTypeEnum = pgEnum("fee_type", ["PERCENTUAL", "FIXO"]);
export const integrationStatusEnum = pgEnum("integration_status", ["ATIVO", "INATIVO", "PENDENTE"]);

export const paymentTypes = pgTable("payment_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  feeType: feeTypeEnum("fee_type"),
  feeValue: decimal("fee_value", { precision: 10, scale: 2 }),
  compensationDays: decimal("compensation_days", { precision: 5, scale: 0 }),
  isIntegration: boolean("is_integration").notNull().default(false),
  integrationId: text("integration_id"),
  isStoreCredit: boolean("is_store_credit").notNull().default(false),
  sortOrder: decimal("sort_order", { precision: 5, scale: 0 }).default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaymentTypeSchema = createInsertSchema(paymentTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentType = z.infer<typeof insertPaymentTypeSchema>;
export type PaymentType = typeof paymentTypes.$inferSelect;

export const paymentIntegrations = pgTable("payment_integrations", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  status: integrationStatusEnum("status").notNull().default("INATIVO"),
  credentials: jsonb("credentials"),
  enabledMethods: text("enabled_methods").array(),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  sandbox: boolean("sandbox").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaymentIntegrationSchema = createInsertSchema(paymentIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentIntegration = z.infer<typeof insertPaymentIntegrationSchema>;
export type PaymentIntegration = typeof paymentIntegrations.$inferSelect;

export const paymentTransactions = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  orderId: text("order_id"),
  paymentTypeId: text("payment_type_id"),
  integrationId: text("integration_id"),
  externalId: text("external_id"),
  status: text("status").notNull().default("pending"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 10, scale: 2 }),
  netAmount: decimal("net_amount", { precision: 12, scale: 2 }),
  metadata: jsonb("metadata"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
