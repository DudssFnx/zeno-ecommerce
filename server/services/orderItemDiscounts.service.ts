import type { InsertOrderItemDiscount } from "@shared/schema";
import { orderItemDiscounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";

/**
 * Solicita desconto (fica PENDENTE)
 */
export async function requestItemDiscount(data: InsertOrderItemDiscount) {
  const [discount] = await db
    .insert(orderItemDiscounts)
    .values({
      ...data,
      status: "PENDENTE",
    })
    .returning();

  return discount;
}

/**
 * Aprova desconto (SUPERVISOR)
 */
export async function approveItemDiscount({
  discountId,
  approvedBy,
}: {
  discountId: number;
  approvedBy: string;
}) {
  const [discount] = await db
    .update(orderItemDiscounts)
    .set({
      status: "APROVADO",
      approvedBy,
      approvedAt: new Date(),
    })
    .where(eq(orderItemDiscounts.id, discountId))
    .returning();

  return discount;
}
