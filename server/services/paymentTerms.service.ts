import type { InsertPaymentTerm, PaymentTerm } from "@shared/schema";
import { paymentTerms } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { db } from "../db";

/**
 * Criar nova condição de prazo
 */
export async function createPaymentTerm(data: InsertPaymentTerm) {
  const [term] = await db.insert(paymentTerms).values(data).returning();
  return term;
}

/**
 * Listar todas as condições de prazo da empresa
 */
export async function listPaymentTerms(companyId: string) {
  const terms = await db
    .select()
    .from(paymentTerms)
    .where(eq(paymentTerms.companyId, companyId))
    .orderBy(paymentTerms.sortOrder, paymentTerms.name);
  return terms;
}

/**
 * Listar apenas as ativas
 */
export async function listActivePaymentTerms(companyId: string) {
  const terms = await db
    .select()
    .from(paymentTerms)
    .where(
      and(eq(paymentTerms.companyId, companyId), eq(paymentTerms.active, true)),
    )
    .orderBy(paymentTerms.sortOrder, paymentTerms.name);
  return terms;
}

/**
 * Buscar por ID
 */
export async function getPaymentTerm(id: number): Promise<PaymentTerm | null> {
  const [term] = await db
    .select()
    .from(paymentTerms)
    .where(eq(paymentTerms.id, id))
    .limit(1);
  return term || null;
}

/**
 * Atualizar condição de prazo
 */
export async function updatePaymentTerm(
  id: number,
  data: Partial<InsertPaymentTerm>,
) {
  const [updated] = await db
    .update(paymentTerms)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(paymentTerms.id, id))
    .returning();
  return updated;
}

/**
 * Deletar (soft delete - desativar)
 */
export async function deletePaymentTerm(id: number) {
  const [deleted] = await db
    .update(paymentTerms)
    .set({
      active: false,
      updatedAt: new Date(),
    })
    .where(eq(paymentTerms.id, id))
    .returning();
  return deleted;
}
