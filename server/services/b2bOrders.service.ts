import { db } from "../db";
import { b2bOrders } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { InsertB2bOrder } from "@shared/schema";

/**
 * Cria um pedido B2B usando empresa ativa da sessão
 */
export async function createB2bOrder({
  data,
  userId,
  companyId,
}: {
  data: InsertB2bOrder;
  userId: string;
  companyId: string;
}) {
  const [order] = await db
    .insert(b2bOrders)
    .values({
      ...data,
      companyId,
      createdByUserId: userId,
    })
    .returning();

  return order;
}

/**
 * Lista pedidos da empresa ativa
 */
export async function listOrdersByCompany(companyId: string) {
  return db
    .select()
    .from(b2bOrders)
    .where(eq(b2bOrders.companyId, companyId))
    .orderBy(b2bOrders.createdAt);
}
