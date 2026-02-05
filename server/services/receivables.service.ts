import {
  orders,
  paymentTerms,
  paymentTypes,
  receivableInstallments,
  receivablePayments,
  receivables,
} from "@shared/schema";
import { addDays, format } from "date-fns";
import { and, desc, eq, lte, ne } from "drizzle-orm";
import { db } from "../db";

/**
 * Gerar número único para receivable
 */
function generateReceivableNumber(): string {
  return `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Gerar número único para pagamento
 */
function generatePaymentNumber(): string {
  return `PAG-REC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Criar conta a receber a partir de pedido faturado
 */
export async function createReceivableFromOrder(
  orderId: number,
  companyId: string,
) {
  return await db.transaction(async (tx) => {
    // 1. Buscar pedido
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) throw new Error("Pedido não encontrado");

    // 2. Verificar se tem forma de pagamento definida
    if (!order.paymentTypeId) {
      console.log(
        `[Receivables] Pedido #${orderId} não tem forma de pagamento definida`,
      );
      return null;
    }

    // 3. Buscar forma de pagamento
    const [paymentType] = await tx
      .select()
      .from(paymentTypes)
      .where(eq(paymentTypes.id, order.paymentTypeId))
      .limit(1);

    if (!paymentType) {
      console.log(
        `[Receivables] Forma de pagamento ID ${order.paymentTypeId} não encontrada`,
      );
      return null;
    }

    // 4. Se não é prazo, não cria receivable
    if (paymentType.paymentTermType !== "PRAZO") {
      console.log(
        `[Receivables] Forma de pagamento "${paymentType.name}" é ${paymentType.paymentTermType}, não gera contas a receber`,
      );
      return null;
    }

    // 5. Buscar condição de prazo
    const [paymentTerm] = await tx
      .select()
      .from(paymentTerms)
      .where(eq(paymentTerms.id, paymentType.paymentTermId))
      .limit(1);

    if (!paymentTerm) throw new Error("Condição de prazo não encontrada");

    // 5. Calcular datas
    const issueDate = new Date();
    const firstPaymentDate = addDays(issueDate, paymentTerm.firstPaymentDays);
    const dueDate = format(firstPaymentDate, "yyyy-MM-dd");
    const issueDateStr = format(issueDate, "yyyy-MM-dd");

    // 6. Criar receivable
    const [receivable] = await tx
      .insert(receivables)
      .values({
        companyId,
        receivableNumber: generateReceivableNumber(),
        description: `Pedido #${order.orderNumber}`,
        orderId: order.id,
        customerId: order.userId,
        paymentTypeId: order.paymentTypeId,
        paymentTermId: paymentTerm.id,
        amount: order.total,
        amountPaid: "0",
        amountRemaining: order.total,
        issueDate: issueDateStr,
        dueDate: dueDate,
        status: "ABERTA",
        isOverdue: false,
      })
      .returning();

    // 7. Criar parcelas
    const installmentAmount =
      Number(order.total) / paymentTerm.installmentCount;

    for (let i = 1; i <= paymentTerm.installmentCount; i++) {
      const instDueDate = addDays(
        firstPaymentDate,
        (i - 1) * paymentTerm.intervalDays,
      );

      await tx.insert(receivableInstallments).values({
        receivableId: receivable.id,
        installmentNumber: i,
        amount: installmentAmount.toString(),
        amountPaid: "0",
        amountRemaining: installmentAmount.toString(),
        dueDate: format(instDueDate, "yyyy-MM-dd"),
        status: "ABERTA",
        isOverdue: false,
      });
    }

    return receivable;
  });
}

/**
 * Buscar receivable com detalhes (installments + payments)
 */
export async function getReceivableWithDetails(receivableId: number) {
  const [receivable] = await db
    .select()
    .from(receivables)
    .where(eq(receivables.id, receivableId))
    .limit(1);

  if (!receivable) return null;

  const installments = await db
    .select()
    .from(receivableInstallments)
    .where(eq(receivableInstallments.receivableId, receivableId))
    .orderBy(receivableInstallments.installmentNumber);

  const payments = await db
    .select()
    .from(receivablePayments)
    .where(eq(receivablePayments.receivableId, receivableId))
    .orderBy(desc(receivablePayments.receivedAt));

  return {
    ...receivable,
    installments,
    payments,
  };
}

/**
 * Listar receivables da empresa
 */
export async function listReceivables(
  companyId: string,
  filters?: {
    status?: string;
    customerId?: string;
    isOverdue?: boolean;
  },
) {
  let query = db
    .select()
    .from(receivables)
    .where(eq(receivables.companyId, companyId));

  if (filters?.status) {
    query = query.where(eq(receivables.status, filters.status));
  }
  if (filters?.customerId) {
    query = query.where(eq(receivables.customerId, filters.customerId));
  }
  if (filters?.isOverdue !== undefined) {
    query = query.where(eq(receivables.isOverdue, filters.isOverdue));
  }

  const result = await query.orderBy(desc(receivables.createdAt));
  return result;
}

/**
 * Dashboard de contas a receber
 */
export async function getReceivableDashboard(companyId: string) {
  const today = format(new Date(), "yyyy-MM-dd");

  const allReceivables = await db
    .select()
    .from(receivables)
    .where(eq(receivables.companyId, companyId));

  const totalReceivables = allReceivables.reduce((acc, r) => {
    return acc + Number(r.amount || 0);
  }, 0);

  const totalPaid = allReceivables.reduce((acc, r) => {
    return acc + Number(r.amountPaid || 0);
  }, 0);

  const totalOverdue = allReceivables
    .filter((r) => r.dueDate < today && r.status !== "PAGA")
    .reduce((acc, r) => {
      return acc + Number(r.amountRemaining || 0);
    }, 0);

  const upcomingReceivables = allReceivables
    .filter(
      (r) =>
        r.dueDate >= today &&
        r.dueDate <= format(addDays(new Date(), 30), "yyyy-MM-dd") &&
        r.status !== "PAGA",
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const overdueReceivables = allReceivables
    .filter((r) => r.isOverdue && r.status !== "PAGA")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    overview: {
      totalReceivables: Number(totalReceivables),
      totalReceived: Number(totalPaid),
      totalPending: Number(totalReceivables - totalPaid),
      totalOverdue: Number(totalOverdue),
      overdueCount: overdueReceivables.length,
      receivablesCount: allReceivables.length,
    },
    upcomingReceivables,
    overdueReceivables,
  };
}

/**
 * Registrar pagamento de receivable
 */
export async function recordReceivablePayment(
  receivableId: number,
  companyId: string,
  data: {
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    reference?: string;
    notes?: string;
    installmentId?: number;
    receivedBy?: string;
  },
) {
  return await db.transaction(async (tx) => {
    // 1. Buscar receivable
    const [receivable] = await tx
      .select()
      .from(receivables)
      .where(eq(receivables.id, receivableId))
      .limit(1);

    if (!receivable) throw new Error("Conta a receber não encontrada");

    // 2. Registrar pagamento
    const [payment] = await tx
      .insert(receivablePayments)
      .values({
        companyId,
        receivableId,
        installmentId: data.installmentId,
        paymentNumber: generatePaymentNumber(),
        amount: data.amount.toString(),
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        paymentDate: data.paymentDate,
        receivedAt: new Date(),
        notes: data.notes,
        receivedBy: data.receivedBy,
      })
      .returning();

    // 3. Se tem installmentId, atualizar parcela
    if (data.installmentId) {
      const [inst] = await tx
        .select()
        .from(receivableInstallments)
        .where(eq(receivableInstallments.id, data.installmentId))
        .limit(1);

      const newAmountPaid = Number(inst.amountPaid) + data.amount;
      const newAmountRemaining = Math.max(
        0,
        Number(inst.amount) - newAmountPaid,
      );

      await tx
        .update(receivableInstallments)
        .set({
          amountPaid: newAmountPaid.toString(),
          amountRemaining: newAmountRemaining.toString(),
          status: newAmountRemaining === 0 ? "PAGA" : inst.status,
          paidAt: newAmountRemaining === 0 ? new Date() : null,
        })
        .where(eq(receivableInstallments.id, data.installmentId));
    }

    // 4. Atualizar receivable
    const newAmountPaid = Number(receivable.amountPaid) + data.amount;
    const newAmountRemaining = Math.max(
      0,
      Number(receivable.amount) - newAmountPaid,
    );

    let newStatus = receivable.status;
    if (newAmountRemaining === 0) {
      newStatus = "PAGA";
    } else if (newAmountPaid > 0 && newAmountRemaining > 0) {
      newStatus = "PARCIAL";
    }

    await tx
      .update(receivables)
      .set({
        amountPaid: newAmountPaid.toString(),
        amountRemaining: newAmountRemaining.toString(),
        status: newStatus,
        paidAt: newStatus === "PAGA" ? new Date() : null,
      })
      .where(eq(receivables.id, receivableId));

    return payment;
  });
}

/**
 * Cancelar receivable
 */
export async function cancelReceivable(
  receivableId: number,
  reason: string,
  cancelledBy: string,
) {
  const [cancelled] = await db
    .update(receivables)
    .set({
      status: "CANCELADA",
      cancelledReason: reason,
      cancelledAt: new Date(),
      cancelledBy,
    })
    .where(eq(receivables.id, receivableId))
    .returning();

  return cancelled;
}

/**
 * Cancelar receivables por orderId (para estorno de contas)
 */
export async function cancelReceivablesByOrderId(
  orderId: number,
  reason: string,
  cancelledBy: string,
) {
  const orderReceivables = await db
    .select()
    .from(receivables)
    .where(eq(receivables.orderId, orderId));

  const cancelled = [];
  for (const rec of orderReceivables) {
    if (rec.status !== "CANCELADA" && rec.status !== "PAGA") {
      const [result] = await db
        .update(receivables)
        .set({
          status: "CANCELADA",
          cancelledReason: reason,
          cancelledAt: new Date(),
          cancelledBy,
        })
        .where(eq(receivables.id, rec.id))
        .returning();
      cancelled.push(result);
    }
  }
  return cancelled;
}

/**
 * Verificar se pedido tem receivables
 */
export async function hasReceivablesForOrder(orderId: number) {
  const orderReceivables = await db
    .select()
    .from(receivables)
    .where(eq(receivables.orderId, orderId));

  return orderReceivables.length > 0;
}

/**
 * Reabrir receivable cancelada
 */
export async function reopenReceivable(receivableId: number) {
  const [reopened] = await db
    .update(receivables)
    .set({
      status: "ABERTA",
      cancelledReason: null,
      cancelledAt: null,
      cancelledBy: null,
    })
    .where(eq(receivables.id, receivableId))
    .returning();

  return reopened;
}

/**
 * Atualizar status de receivables vencidas (cron job)
 */
export async function updateOverdueReceivables() {
  const today = format(new Date(), "yyyy-MM-dd");

  // Marcar como vencida
  await db
    .update(receivables)
    .set({
      status: "VENCIDA",
      isOverdue: true,
    })
    .where(
      and(eq(receivables.status, "ABERTA"), lte(receivables.dueDate, today)),
    );

  // Marcar como paga (quando todas as parcelas estão pagas)
  const receivablesWithAllPaidInstallments = await db
    .select()
    .from(receivables)
    .where(
      and(ne(receivables.status, "PAGA"), ne(receivables.status, "CANCELADA")),
    );

  for (const rec of receivablesWithAllPaidInstallments) {
    const unpaidInstallments = await db
      .select()
      .from(receivableInstallments)
      .where(
        and(
          eq(receivableInstallments.receivableId, rec.id),
          ne(receivableInstallments.status, "PAGA"),
        ),
      );

    if (unpaidInstallments.length === 0) {
      await db
        .update(receivables)
        .set({
          status: "PAGA",
          paidAt: new Date(),
          isOverdue: false,
        })
        .where(eq(receivables.id, rec.id));
    }
  }
}
