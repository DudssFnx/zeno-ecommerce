import {
  payableInstallments,
  payablePayments,
  payables,
  paymentTerms,
  paymentTypes,
  purchaseOrders,
} from "@shared/schema";
import { addDays, format } from "date-fns";
import { and, desc, eq, lte, ne } from "drizzle-orm";
import { db } from "../db";

/**
 * Gerar número único para payable
 */
function generatePayableNumber(): string {
  return `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Gerar número único para pagamento
 */
function generatePaymentNumber(): string {
  return `PAG-PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Criar conta a pagar a partir de compra finalizada
 */
export async function createPayableFromPurchaseOrder(
  purchaseOrderId: number,
  companyId: string,
) {
  return await db.transaction(async (tx) => {
    // 1. Buscar pedido de compra
    const [purchaseOrder] = await tx
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, purchaseOrderId))
      .limit(1);

    if (!purchaseOrder) throw new Error("Pedido de compra não encontrado");

    // 2. Buscar forma de pagamento
    const [paymentType] = await tx
      .select()
      .from(paymentTypes)
      .where(eq(paymentTypes.id, purchaseOrder.paymentTypeId))
      .limit(1);

    if (!paymentType) throw new Error("Forma de pagamento não encontrada");

    // 3. Se não é prazo, não cria payable
    if (paymentType.paymentTermType !== "PRAZO") {
      return null;
    }

    // 4. Buscar condição de prazo
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

    // 6. Criar payable
    const [payable] = await tx
      .insert(payables)
      .values({
        companyId,
        payableNumber: generatePayableNumber(),
        description: `Compra #${purchaseOrder.purchaseOrderNumber}`,
        purchaseOrderId: purchaseOrder.id,
        supplierId: purchaseOrder.supplierId,
        paymentTypeId: purchaseOrder.paymentTypeId,
        paymentTermId: paymentTerm.id,
        amount: purchaseOrder.total,
        amountPaid: "0",
        amountRemaining: purchaseOrder.total,
        issueDate: issueDateStr,
        dueDate: dueDate,
        status: "ABERTA",
        isOverdue: false,
      })
      .returning();

    // 7. Criar parcelas
    const installmentAmount =
      Number(purchaseOrder.total) / paymentTerm.installmentCount;

    for (let i = 1; i <= paymentTerm.installmentCount; i++) {
      const instDueDate = addDays(
        firstPaymentDate,
        (i - 1) * paymentTerm.intervalDays,
      );

      await tx.insert(payableInstallments).values({
        payableId: payable.id,
        installmentNumber: i,
        amount: installmentAmount.toString(),
        amountPaid: "0",
        amountRemaining: installmentAmount.toString(),
        dueDate: format(instDueDate, "yyyy-MM-dd"),
        status: "ABERTA",
        isOverdue: false,
      });
    }

    return payable;
  });
}

/**
 * Buscar payable com detalhes (installments + payments)
 */
export async function getPayableWithDetails(payableId: number) {
  const [payable] = await db
    .select()
    .from(payables)
    .where(eq(payables.id, payableId))
    .limit(1);

  if (!payable) return null;

  const installments = await db
    .select()
    .from(payableInstallments)
    .where(eq(payableInstallments.payableId, payableId))
    .orderBy(payableInstallments.installmentNumber);

  const payments = await db
    .select()
    .from(payablePayments)
    .where(eq(payablePayments.payableId, payableId))
    .orderBy(desc(payablePayments.paidAt));

  return {
    ...payable,
    installments,
    payments,
  };
}

/**
 * Listar payables da empresa
 */
export async function listPayables(
  companyId: string,
  filters?: {
    status?: string;
    supplierId?: string;
    isOverdue?: boolean;
  },
) {
  let query = db
    .select()
    .from(payables)
    .where(eq(payables.companyId, companyId));

  if (filters?.status) {
    query = query.where(eq(payables.status, filters.status));
  }
  if (filters?.supplierId) {
    query = query.where(eq(payables.supplierId, filters.supplierId));
  }
  if (filters?.isOverdue !== undefined) {
    query = query.where(eq(payables.isOverdue, filters.isOverdue));
  }

  const result = await query.orderBy(desc(payables.createdAt));
  return result;
}

/**
 * Dashboard de contas a pagar
 */
export async function getPayableDashboard(companyId: string) {
  const today = format(new Date(), "yyyy-MM-dd");

  const allPayables = await db
    .select()
    .from(payables)
    .where(eq(payables.companyId, companyId));

  const totalPayables = allPayables.reduce((acc, p) => {
    return acc + Number(p.amount || 0);
  }, 0);

  const totalPaid = allPayables.reduce((acc, p) => {
    return acc + Number(p.amountPaid || 0);
  }, 0);

  const totalOverdue = allPayables
    .filter((p) => p.dueDate < today && p.status !== "PAGA")
    .reduce((acc, p) => {
      return acc + Number(p.amountRemaining || 0);
    }, 0);

  const upcomingPayables = allPayables
    .filter(
      (p) =>
        p.dueDate >= today &&
        p.dueDate <= format(addDays(new Date(), 30), "yyyy-MM-dd") &&
        p.status !== "PAGA",
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const overduePayables = allPayables
    .filter((p) => p.isOverdue && p.status !== "PAGA")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    overview: {
      totalPayables: Number(totalPayables),
      totalPaid: Number(totalPaid),
      totalPending: Number(totalPayables - totalPaid),
      totalOverdue: Number(totalOverdue),
      overdueCount: overduePayables.length,
      payablesCount: allPayables.length,
    },
    upcomingPayables,
    overduePayables,
  };
}

/**
 * Registrar pagamento de payable
 */
export async function recordPayablePayment(
  payableId: number,
  companyId: string,
  data: {
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    reference?: string;
    notes?: string;
    installmentId?: number;
    paidBy?: string;
  },
) {
  return await db.transaction(async (tx) => {
    // 1. Buscar payable
    const [payable] = await tx
      .select()
      .from(payables)
      .where(eq(payables.id, payableId))
      .limit(1);

    if (!payable) throw new Error("Conta a pagar não encontrada");

    // 2. Registrar pagamento
    const [payment] = await tx
      .insert(payablePayments)
      .values({
        companyId,
        payableId,
        installmentId: data.installmentId,
        paymentNumber: generatePaymentNumber(),
        amount: data.amount.toString(),
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        paymentDate: data.paymentDate,
        paidAt: new Date(),
        notes: data.notes,
        paidBy: data.paidBy,
      })
      .returning();

    // 3. Se tem installmentId, atualizar parcela
    if (data.installmentId) {
      const [inst] = await tx
        .select()
        .from(payableInstallments)
        .where(eq(payableInstallments.id, data.installmentId))
        .limit(1);

      const newAmountPaid = Number(inst.amountPaid) + data.amount;
      const newAmountRemaining = Math.max(
        0,
        Number(inst.amount) - newAmountPaid,
      );

      await tx
        .update(payableInstallments)
        .set({
          amountPaid: newAmountPaid.toString(),
          amountRemaining: newAmountRemaining.toString(),
          status: newAmountRemaining === 0 ? "PAGA" : inst.status,
          paidAt: newAmountRemaining === 0 ? new Date() : null,
        })
        .where(eq(payableInstallments.id, data.installmentId));
    }

    // 4. Atualizar payable
    const newAmountPaid = Number(payable.amountPaid) + data.amount;
    const newAmountRemaining = Math.max(
      0,
      Number(payable.amount) - newAmountPaid,
    );

    let newStatus = payable.status;
    if (newAmountRemaining === 0) {
      newStatus = "PAGA";
    } else if (newAmountPaid > 0 && newAmountRemaining > 0) {
      newStatus = "PARCIAL";
    }

    await tx
      .update(payables)
      .set({
        amountPaid: newAmountPaid.toString(),
        amountRemaining: newAmountRemaining.toString(),
        status: newStatus,
        paidAt: newStatus === "PAGA" ? new Date() : null,
      })
      .where(eq(payables.id, payableId));

    return payment;
  });
}

/**
 * Cancelar payable
 */
export async function cancelPayable(
  payableId: number,
  reason: string,
  cancelledBy: string,
) {
  const [cancelled] = await db
    .update(payables)
    .set({
      status: "CANCELADA",
      cancelledReason: reason,
      cancelledAt: new Date(),
      cancelledBy,
    })
    .where(eq(payables.id, payableId))
    .returning();

  return cancelled;
}

/**
 * Reabrir payable cancelada
 */
export async function reopenPayable(payableId: number) {
  const [reopened] = await db
    .update(payables)
    .set({
      status: "ABERTA",
      cancelledReason: null,
      cancelledAt: null,
      cancelledBy: null,
    })
    .where(eq(payables.id, payableId))
    .returning();

  return reopened;
}

/**
 * Atualizar status de payables vencidas (cron job)
 */
export async function updateOverduePayables() {
  const today = format(new Date(), "yyyy-MM-dd");

  // Marcar como vencida
  await db
    .update(payables)
    .set({
      status: "VENCIDA",
      isOverdue: true,
    })
    .where(and(eq(payables.status, "ABERTA"), lte(payables.dueDate, today)));

  // Marcar como paga (quando todas as parcelas estão pagas)
  const payablesWithAllPaidInstallments = await db
    .select()
    .from(payables)
    .where(and(ne(payables.status, "PAGA"), ne(payables.status, "CANCELADA")));

  for (const payable of payablesWithAllPaidInstallments) {
    const unpaidInstallments = await db
      .select()
      .from(payableInstallments)
      .where(
        and(
          eq(payableInstallments.payableId, payable.id),
          ne(payableInstallments.status, "PAGA"),
        ),
      );

    if (unpaidInstallments.length === 0) {
      await db
        .update(payables)
        .set({
          status: "PAGA",
          paidAt: new Date(),
          isOverdue: false,
        })
        .where(eq(payables.id, payable.id));
    }
  }
}
