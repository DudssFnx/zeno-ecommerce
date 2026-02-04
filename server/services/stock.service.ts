import { b2bOrderItems, b2bProducts } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";

/**
 * Reserva estoque ao gerar pedido
 */
export async function reserveStock(orderId: number) {
  const items = await db
    .select()
    .from(b2bOrderItems)
    .where(eq(b2bOrderItems.orderId, orderId));

  for (const item of items) {
    await db
      .update(b2bProducts)
      .set({
        reservedStock: sql`reserved_stock + ${item.quantity}`,
      })
      .where(eq(b2bProducts.id, item.productId));
  }
}

/**
 * Baixa estoque ao faturar pedido
 */
export async function deductStock(orderId: number) {
  const items = await db
    .select()
    .from(b2bOrderItems)
    .where(eq(b2bOrderItems.orderId, orderId));

  for (const item of items) {
    await db
      .update(b2bProducts)
      .set({
        stock: sql`stock - ${item.quantity}`,
        reservedStock: sql`reserved_stock - ${item.quantity}`,
      })
      .where(eq(b2bProducts.id, item.productId));
  }
}
