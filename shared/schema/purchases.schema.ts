import {
  decimal,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
// ✅ CORREÇÃO: Buscando cada tabela de seu respectivo lugar
import { products } from "./legacy.schema"; // products continua aqui

import { suppliers } from "./legacy.schema";

// Purchase Order Status:
// - DRAFT: Rascunho - pode editar itens e fornecedor
// - FINALIZED: Finalizado - nao pode mais editar, aguardando lancamento de estoque
// - STOCK_POSTED: Estoque lancado - itens entraram no estoque
// - STOCK_REVERSED: Estoque devolvido - estorno realizado
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(), // PC-000001
  status: text("status").notNull().default("DRAFT"), // DRAFT, FINALIZED, STOCK_POSTED, STOCK_REVERSED
  supplierId: integer("supplier_id").references(() => suppliers.id),
  notes: text("notes"),
  totalValue: decimal("total_value", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  finalizedAt: timestamp("finalized_at"),
  postedAt: timestamp("posted_at"),
  reversedAt: timestamp("reversed_at"),
});

export const insertPurchaseOrderSchema = createInsertSchema(
  purchaseOrders,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  finalizedAt: true,
  postedAt: true,
  reversedAt: true,
});

export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

// Purchase Order Items - produtos do pedido de compra
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  descriptionSnapshot: text("description_snapshot"), // Nome do produto no momento da compra
  skuSnapshot: text("sku_snapshot"), // SKU no momento da compra
  qty: decimal("qty", { precision: 10, scale: 3 }).notNull(), // Quantidade
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(), // Custo unitario
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(), // qty * unitCost
});

export const insertPurchaseOrderItemSchema = createInsertSchema(
  purchaseOrderItems,
).omit({
  id: true,
});

export type InsertPurchaseOrderItem = z.infer<
  typeof insertPurchaseOrderItemSchema
>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

// Stock Movement - registro de movimentacoes de estoque (ledger)
// TYPE: IN (entrada) | OUT (saida)
// REASON: PURCHASE_POST (lancamento de compra) | PURCHASE_REVERSE (estorno de compra) | SALE (venda) | ADJUSTMENT (ajuste manual)
// REF_TYPE: PURCHASE_ORDER | ORDER | MANUAL
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // IN, OUT
  reason: text("reason").notNull(), // PURCHASE_POST, PURCHASE_REVERSE, SALE, ADJUSTMENT
  refType: text("ref_type").notNull(), // PURCHASE_ORDER, ORDER, MANUAL
  refId: integer("ref_id"), // ID do documento de referencia
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  qty: decimal("qty", { precision: 10, scale: 3 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStockMovementSchema = createInsertSchema(
  stockMovements,
).omit({
  id: true,
  createdAt: true,
});

export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;
