import {
  orders,
  paymentTerms,
  paymentTypes,
  receivableInstallments,
  receivablePayments,
  receivables,
} from "@shared/schema";
import { addDays, format } from "date-fns";
import { and, desc, eq, inArray, lte, ne } from "drizzle-orm";
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

    // 5. Buscar condição de prazo do PEDIDO (não da forma de pagamento)
    // A condição vem do pedido (order.paymentTermId), não da forma de pagamento
    const paymentTermIdToUse = order.paymentTermId || paymentType.paymentTermId;

    if (!paymentTermIdToUse) {
      console.log(
        `[Receivables] Pedido #${order.orderNumber} não tem condição de prazo definida e forma de pagamento "${paymentType.name}" também não tem`,
      );
      return null;
    }

    // 6. Buscar condição de prazo
    const [paymentTerm] = await tx
      .select()
      .from(paymentTerms)
      .where(eq(paymentTerms.id, paymentTermIdToUse))
      .limit(1);

    if (!paymentTerm) {
      console.log(
        `[Receivables] Condição de prazo ID ${paymentTermIdToUse} não encontrada`,
      );
      return null;
    }

    console.log(
      `[Receivables] Usando condição de prazo "${paymentTerm.name}" (${paymentTerm.installmentCount} parcelas) do pedido #${order.orderNumber}`,
    );

    // 7. Calcular datas
    const issueDate = new Date();
    const firstPaymentDate = addDays(issueDate, paymentTerm.firstPaymentDays);
    const dueDate = format(firstPaymentDate, "yyyy-MM-dd");
    const issueDateStr = format(issueDate, "yyyy-MM-dd");

    // 8. Criar receivable
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

    console.log(
      `[Receivables] ✅ Conta a receber criada: #${receivable.receivableNumber} para pedido #${order.orderNumber}, valor: ${order.total}, empresa: ${companyId}`,
    );

    // 9. Criar parcelas
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
  // Construir condições dinamicamente
  const conditions = [eq(receivables.companyId, companyId)];

  if (filters?.status) {
    conditions.push(eq(receivables.status, filters.status));
  }
  if (filters?.customerId) {
    conditions.push(eq(receivables.customerId, filters.customerId));
  }
  if (filters?.isOverdue !== undefined) {
    conditions.push(eq(receivables.isOverdue, filters.isOverdue));
  }

  const result = await db
    .select()
    .from(receivables)
    .where(and(...conditions))
    .orderBy(desc(receivables.createdAt));

  return result;
}

/**
 * Listar parcelas da empresa com dados enriquecidos
 */
export async function listInstallments(
  companyId: string,
  filters?: {
    status?: string;
    customerId?: string;
    isOverdue?: boolean;
  },
) {
  console.log(`[DEBUG] listInstallments - companyId: ${companyId}`);

  // 1. Buscar todos os receivables da empresa
  const allReceivables = await db
    .select()
    .from(receivables)
    .where(eq(receivables.companyId, companyId));

  console.log(`[DEBUG] allReceivables encontrados: ${allReceivables.length}`);
  if (allReceivables.length > 0) {
    console.log(
      `[DEBUG] Primeiro receivable:`,
      JSON.stringify(allReceivables[0]),
    );
  }

  // Aplicar filtros no receivable se necessário
  let filteredReceivables = allReceivables;
  if (filters?.customerId) {
    filteredReceivables = filteredReceivables.filter(
      (r) => r.customerId === filters.customerId,
    );
  }

  // 1.1 Buscar pedidos relacionados para pegar o vendedor (invoicedBy)
  const orderIds = filteredReceivables
    .filter((r) => r.orderId)
    .map((r) => r.orderId as number);

  let ordersMap = new Map<number, { invoicedBy: string | null }>();
  if (orderIds.length > 0) {
    const relatedOrders = await db
      .select({ id: orders.id, invoicedBy: orders.invoicedBy })
      .from(orders)
      .where(inArray(orders.id, orderIds));
    ordersMap = new Map(
      relatedOrders.map((o) => [o.id, { invoicedBy: o.invoicedBy }]),
    );
  }

  // 2. Buscar parcelas de todos os receivables filtrados
  const receivableIds = filteredReceivables.map((r) => r.id);
  let allInstallments: any[] = [];

  if (receivableIds.length > 0) {
    for (const recId of receivableIds) {
      const installments = await db
        .select()
        .from(receivableInstallments)
        .where(eq(receivableInstallments.receivableId, recId));
      allInstallments.push(...installments);
    }
  }

  // Se não há parcelas, criar "parcelas virtuais" a partir dos receivables
  // (para receivables antigos que não têm parcelas)
  if (allInstallments.length === 0 && filteredReceivables.length > 0) {
    allInstallments = filteredReceivables.map((rec) => ({
      id: rec.id,
      receivableId: rec.id,
      installmentNumber: 1,
      amount: rec.amount,
      amountPaid: rec.amountPaid,
      amountRemaining: rec.amountRemaining,
      dueDate: rec.dueDate,
      status: rec.status,
      isOverdue: rec.isOverdue,
      paidAt: rec.paidAt,
    }));
  }

  // 3. Aplicar filtros nas parcelas
  if (filters?.status) {
    allInstallments = allInstallments.filter(
      (inst) => inst.status === filters.status,
    );
  }
  if (filters?.isOverdue !== undefined) {
    allInstallments = allInstallments.filter(
      (inst) => inst.isOverdue === filters.isOverdue,
    );
  }

  // 4. Criar mapa de receivables
  const receivablesMap = new Map(filteredReceivables.map((r) => [r.id, r]));

  // 5. Enriquecer parcelas
  const enrichedInstallments = allInstallments.map((inst) => {
    const rec = receivablesMap.get(inst.receivableId);
    const orderNumber =
      rec?.description?.replace("Pedido #", "") || String(rec?.orderId || "");
    const installmentStr = String(inst.installmentNumber).padStart(3, "0");
    const displayNumber = `${orderNumber}/${installmentStr}`;

    // Pegar vendedor do pedido (invoicedBy)
    const orderData = rec?.orderId ? ordersMap.get(rec.orderId) : null;
    const sellerId = orderData?.invoicedBy || null;

    return {
      ...inst,
      receivable: rec,
      customerId: rec?.customerId,
      orderId: rec?.orderId,
      displayNumber,
      description: rec?.description,
      receivableNumber: rec?.receivableNumber,
      sellerId, // ID do vendedor (quem faturou o pedido)
    };
  });

  // 6. Ordenar por vencimento
  return enrichedInstallments.sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
}

/**
 * Criar conta a receber manual (sem pedido)
 */
export async function createManualReceivable(
  companyId: string,
  data: {
    customerId: string;
    amount: number;
    description?: string;
    issueDate: string;
    dueDate: string;
    paymentTermId?: number;
    customInstallments?: number; // Parcelas customizadas (ex: 2, 3, 4...)
    intervalDays?: number; // Intervalo entre parcelas em dias (padrão: 30)
    documentNumber?: string;
    notes?: string;
  },
) {
  return await db.transaction(async (tx) => {
    // Se tiver condição de pagamento, buscar para calcular parcelas
    let installmentCount = 1;
    let intervalDays = data.intervalDays || 30; // Padrão: 30 dias
    let firstPaymentDays = 0;

    if (data.paymentTermId) {
      const [paymentTerm] = await tx
        .select()
        .from(paymentTerms)
        .where(eq(paymentTerms.id, data.paymentTermId))
        .limit(1);

      if (paymentTerm) {
        installmentCount = paymentTerm.installmentCount || 1;
        intervalDays = paymentTerm.intervalDays || 30;
        firstPaymentDays = paymentTerm.firstPaymentDays || 0;
      }
    } else if (data.customInstallments && data.customInstallments > 1) {
      // Usar parcelas customizadas
      installmentCount = data.customInstallments;
      // firstPaymentDays = 0 significa que primeira parcela vence na data informada
    }

    // Calcular data de vencimento da primeira parcela
    const issueDate = new Date(data.issueDate);
    const firstDueDate = new Date(data.dueDate); // Usar a data de vencimento informada

    const [receivable] = await tx
      .insert(receivables)
      .values({
        companyId,
        receivableNumber: data.documentNumber || generateReceivableNumber(),
        description: data.description || "Lançamento manual",
        customerId: data.customerId,
        paymentTermId: data.paymentTermId || null,
        amount: data.amount.toString(),
        amountPaid: "0",
        amountRemaining: data.amount.toString(),
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        status: "ABERTA",
        isOverdue: false,
      })
      .returning();

    // Criar parcelas
    const installmentAmount = data.amount / installmentCount;

    for (let i = 0; i < installmentCount; i++) {
      let installmentDueDate: Date;

      if (data.customInstallments && data.customInstallments > 1) {
        // Para parcelas customizadas: primeira parcela na data informada, depois +30 dias
        installmentDueDate = new Date(firstDueDate);
        installmentDueDate.setDate(
          installmentDueDate.getDate() + i * intervalDays,
        );
      } else if (data.paymentTermId) {
        // Para condições cadastradas: usar firstPaymentDays + intervalDays
        installmentDueDate = new Date(issueDate);
        installmentDueDate.setDate(
          installmentDueDate.getDate() + firstPaymentDays + i * intervalDays,
        );
      } else {
        // À vista: usa a data de vencimento informada
        installmentDueDate = new Date(firstDueDate);
      }

      await tx.insert(receivableInstallments).values({
        receivableId: receivable.id,
        installmentNumber: i + 1,
        amount: installmentAmount.toFixed(2),
        amountPaid: "0",
        amountRemaining: installmentAmount.toFixed(2),
        dueDate: installmentDueDate.toISOString().split("T")[0],
        status: "ABERTA",
        isOverdue: false,
      });
    }

    console.log(
      `[Receivables] ✅ Conta manual criada: #${receivable.receivableNumber}, valor: R$ ${data.amount}, parcelas: ${installmentCount}`,
    );
    return receivable;
  });
}

/**
 * Listar pagamentos recebidos (títulos baixados + vendas à vista)
 */
export async function listReceivedPayments(companyId: string) {
  // 1. Buscar pagamentos de títulos (receivablePayments)
  // Selecionando apenas colunas que existem no banco
  const titlePayments = await db
    .select({
      id: receivablePayments.id,
      companyId: receivablePayments.companyId,
      receivableId: receivablePayments.receivableId,
      installmentId: receivablePayments.installmentId,
      paymentNumber: receivablePayments.paymentNumber,
      amount: receivablePayments.amount,
      paymentMethod: receivablePayments.paymentMethod,
      paymentDate: receivablePayments.paymentDate,
      receivedAt: receivablePayments.receivedAt,
      receivedBy: receivablePayments.receivedBy,
      notes: receivablePayments.notes,
    })
    .from(receivablePayments)
    .where(eq(receivablePayments.companyId, companyId))
    .orderBy(desc(receivablePayments.receivedAt));

  // 2. Buscar receivables para enriquecer
  const allReceivables = await db
    .select()
    .from(receivables)
    .where(eq(receivables.companyId, companyId));

  const receivablesMap = new Map(allReceivables.map((r) => [r.id, r]));

  // 3. Buscar parcelas para enriquecer
  let allInstallments: any[] = [];
  const receivableIds = [...new Set(titlePayments.map((p) => p.receivableId))];
  for (const recId of receivableIds) {
    const insts = await db
      .select()
      .from(receivableInstallments)
      .where(eq(receivableInstallments.receivableId, recId));
    allInstallments.push(...insts);
  }
  const installmentsMap = new Map(allInstallments.map((i) => [i.id, i]));

  // 4. Enriquecer pagamentos de títulos
  const enrichedTitlePayments = titlePayments.map((payment) => {
    const rec = receivablesMap.get(payment.receivableId);
    const inst = payment.installmentId
      ? installmentsMap.get(payment.installmentId)
      : null;

    const orderNumber =
      rec?.description?.replace("Pedido #", "") || String(rec?.orderId || "");
    const installmentStr = inst
      ? String(inst.installmentNumber).padStart(3, "0")
      : "001";
    const displayNumber = orderNumber
      ? `${orderNumber}/${installmentStr}`
      : `Manual #${rec?.id}`;

    return {
      id: payment.id,
      type: "TITULO" as const,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      receivedAt: payment.receivedAt,
      receivedBy: payment.receivedBy,
      notes: payment.notes,
      displayNumber,
      customerId: rec?.customerId,
      orderId: rec?.orderId,
      description: rec?.description,
    };
  });

  // 5. Buscar vendas à vista (pedidos com forma de pagamento à vista e faturados)
  const cashOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.companyId, companyId));

  // Buscar formas de pagamento para identificar quais são à vista
  const allPaymentTypes = await db
    .select()
    .from(paymentTypes)
    .where(eq(paymentTypes.companyId, companyId));

  const vistaPaymentTypeIds = allPaymentTypes
    .filter((pt) => pt.paymentTermType === "VISTA")
    .map((pt) => pt.id);

  // Filtrar pedidos faturados com pagamento à vista
  const cashSales = cashOrders
    .filter(
      (order) =>
        order.status === "FATURADO" &&
        order.paymentTypeId &&
        vistaPaymentTypeIds.includes(order.paymentTypeId),
    )
    .map((order) => {
      const paymentType = allPaymentTypes.find(
        (pt) => pt.id === order.paymentTypeId,
      );
      return {
        id: `order-${order.id}`,
        type: "VISTA" as const,
        amount: order.total,
        paymentMethod: paymentType?.name || order.paymentMethod,
        paymentDate: order.invoicedAt
          ? format(new Date(order.invoicedAt), "yyyy-MM-dd")
          : format(new Date(order.createdAt!), "yyyy-MM-dd"),
        receivedAt: order.invoicedAt || order.createdAt,
        receivedBy: order.invoicedBy,
        notes: null,
        displayNumber: `Pedido #${order.orderNumber}`,
        customerId: order.userId,
        orderId: order.id,
        description: `Venda à vista - Pedido #${order.orderNumber}`,
      };
    });

  // 6. Combinar e ordenar por data (mais recente primeiro)
  return [...enrichedTitlePayments, ...cashSales].sort((a, b) => {
    const dateA = new Date(a.receivedAt || a.paymentDate);
    const dateB = new Date(b.receivedAt || b.paymentDate);
    return dateB.getTime() - dateA.getTime();
  });
}

/**
 * Dashboard de contas a receber - baseado em PARCELAS
 */
export async function getReceivableDashboard(companyId: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  const thirtyDaysFromNow = format(addDays(new Date(), 30), "yyyy-MM-dd");

  // Buscar todos os receivables da empresa com suas parcelas
  const allReceivables = await db
    .select()
    .from(receivables)
    .where(eq(receivables.companyId, companyId));

  console.log(
    `[Dashboard] Encontrados ${allReceivables.length} receivables para empresa ${companyId}`,
  );

  // Buscar todas as parcelas dos receivables
  const receivableIds = allReceivables.map((r) => r.id);

  let allInstallments: any[] = [];
  if (receivableIds.length > 0) {
    // Buscar parcelas de todos os receivables
    for (const recId of receivableIds) {
      const installments = await db
        .select()
        .from(receivableInstallments)
        .where(eq(receivableInstallments.receivableId, recId));
      allInstallments.push(...installments);
    }
  }

  console.log(
    `[Dashboard] Encontradas ${allInstallments.length} parcelas reais na tabela receivableInstallments`,
  );

  // Log detalhado das parcelas encontradas
  if (allInstallments.length > 0) {
    console.log(
      `[Dashboard] Parcelas encontradas:`,
      allInstallments.map((inst) => ({
        id: inst.id,
        receivableId: inst.receivableId,
        installmentNumber: inst.installmentNumber,
        amount: inst.amount,
        dueDate: inst.dueDate,
      })),
    );
  }

  // Criar mapa de receivables para acesso rápido
  const receivablesMap = new Map(allReceivables.map((r) => [r.id, r]));

  // Se não há parcelas, criar "parcelas virtuais" a partir dos receivables
  // (para receivables antigos que não têm parcelas)
  if (allInstallments.length === 0 && allReceivables.length > 0) {
    console.log(
      `[Dashboard] ⚠️ Criando parcelas virtuais para ${allReceivables.length} receivables sem parcelas na tabela`,
    );
    allInstallments = allReceivables.map((rec) => {
      console.log(
        `[Dashboard] Parcela virtual para receivable #${rec.id}: ${rec.description}, valor: ${rec.amount}`,
      );
      return {
        id: rec.id,
        receivableId: rec.id,
        installmentNumber: 1,
        amount: rec.amount,
        amountPaid: rec.amountPaid,
        amountRemaining: rec.amountRemaining,
        dueDate: rec.dueDate,
        status: rec.status,
        isOverdue: rec.isOverdue,
        paidAt: rec.paidAt,
      };
    });
  }

  // Enriquecer parcelas com dados do receivable (pedido, cliente)
  const enrichedInstallments = allInstallments.map((inst) => {
    const rec = receivablesMap.get(inst.receivableId);
    // Formatar número como "pedido/parcela" - ex: 287422/001
    const orderNumber =
      rec?.description?.replace("Pedido #", "") || String(rec?.orderId || "");
    const installmentStr = String(inst.installmentNumber).padStart(3, "0");
    const displayNumber = `${orderNumber}/${installmentStr}`;

    return {
      ...inst,
      receivable: rec,
      customerId: rec?.customerId,
      orderId: rec?.orderId,
      displayNumber,
      description: rec?.description,
    };
  });

  // Calcular totais
  const totalReceivables = enrichedInstallments.reduce((acc, inst) => {
    return acc + Number(inst.amount || 0);
  }, 0);

  const totalPaid = enrichedInstallments.reduce((acc, inst) => {
    return acc + Number(inst.amountPaid || 0);
  }, 0);

  // Parcelas vencidas (não pagas e com data anterior a hoje)
  const overdueInstallments = enrichedInstallments
    .filter((inst) => inst.dueDate < today && inst.status !== "PAGA")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const totalOverdue = overdueInstallments.reduce((acc, inst) => {
    return acc + Number(inst.amountRemaining || 0);
  }, 0);

  // Parcelas a vencer (próximos 30 dias)
  const upcomingInstallments = enrichedInstallments
    .filter(
      (inst) =>
        inst.dueDate >= today &&
        inst.dueDate <= thirtyDaysFromNow &&
        inst.status !== "PAGA",
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    overview: {
      totalReceivables: Number(totalReceivables),
      totalReceived: Number(totalPaid),
      totalPending: Number(totalReceivables - totalPaid),
      totalOverdue: Number(totalOverdue),
      overdueCount: overdueInstallments.length,
      receivablesCount: enrichedInstallments.length,
    },
    // Retornar parcelas ao invés de receivables
    upcomingInstallments,
    overdueInstallments,
    // Manter compatibilidade com nomes antigos (receberão as parcelas)
    upcomingReceivables: upcomingInstallments,
    overdueReceivables: overdueInstallments,
  };
}

/**
 * Registrar pagamento de receivable (baixa total ou parcial)
 * Suporta juros, desconto, multa e tarifa
 */
export async function recordReceivablePayment(
  receivableId: number,
  companyId: string,
  data: {
    amount: number; // Valor efetivamente recebido (líquido)
    paymentMethod: string;
    paymentDate: string;
    reference?: string;
    notes?: string;
    installmentId?: number;
    receivedBy?: string;
    // Novos campos para baixa detalhada
    originalAmount?: number; // Valor original da parcela
    interest?: number; // Juros cobrados
    discount?: number; // Desconto concedido
    fine?: number; // Multa cobrada
    fee?: number; // Tarifa bancária
    financialAccountId?: number; // Conta destino
    categoryId?: number; // Categoria financeira
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

    // Calcular valor base para baixar na parcela
    // Valor líquido = original - desconto + juros + multa - tarifa
    // Mas vamos usar o amount como o valor que está sendo baixado da parcela
    const amountToDeduct = data.originalAmount || data.amount;

    // 2. Registrar pagamento
    const [payment] = await tx
      .insert(receivablePayments)
      .values({
        companyId,
        receivableId,
        installmentId: data.installmentId,
        paymentNumber: generatePaymentNumber(),
        amount: data.amount.toString(),
        originalAmount: data.originalAmount?.toString(),
        interest: (data.interest || 0).toString(),
        discount: (data.discount || 0).toString(),
        fine: (data.fine || 0).toString(),
        fee: (data.fee || 0).toString(),
        paymentMethod: data.paymentMethod,
        financialAccountId: data.financialAccountId,
        categoryId: data.categoryId,
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

      const newAmountPaid = Number(inst.amountPaid) + amountToDeduct;
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
    const newAmountPaid = Number(receivable.amountPaid) + amountToDeduct;
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
 * Reabrir receivables canceladas por orderId
 */
export async function reopenReceivablesByOrderId(orderId: number) {
  const orderReceivables = await db
    .select()
    .from(receivables)
    .where(eq(receivables.orderId, orderId));

  const reopened = [];
  for (const rec of orderReceivables) {
    if (rec.status === "CANCELADA") {
      const [result] = await db
        .update(receivables)
        .set({
          status: "ABERTA",
          cancelledReason: null,
          cancelledAt: null,
          cancelledBy: null,
        })
        .where(eq(receivables.id, rec.id))
        .returning();
      reopened.push(result);
    }
  }
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

/**
 * Recriar parcelas de um receivable com base em uma condição de prazo
 */
export async function recreateInstallments(
  receivableId: number,
  paymentTermId: number,
) {
  return await db.transaction(async (tx) => {
    // 1. Buscar receivable
    const [receivable] = await tx
      .select()
      .from(receivables)
      .where(eq(receivables.id, receivableId))
      .limit(1);

    if (!receivable) {
      throw new Error(`Receivable ID ${receivableId} não encontrado`);
    }

    // 2. Verificar se há pagamentos - se houver, não permitir recriar
    const payments = await tx
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.receivableId, receivableId));

    if (payments.length > 0) {
      throw new Error(
        `Não é possível recriar parcelas: receivable já tem ${payments.length} pagamento(s)`,
      );
    }

    // 3. Buscar condição de prazo
    const [paymentTerm] = await tx
      .select()
      .from(paymentTerms)
      .where(eq(paymentTerms.id, paymentTermId))
      .limit(1);

    if (!paymentTerm) {
      throw new Error(`Condição de prazo ID ${paymentTermId} não encontrada`);
    }

    // 4. Deletar parcelas antigas
    await tx
      .delete(receivableInstallments)
      .where(eq(receivableInstallments.receivableId, receivableId));

    console.log(
      `[Receivables] Parcelas antigas deletadas para receivable ${receivableId}`,
    );

    // 5. Calcular novas parcelas
    const issueDate = new Date(receivable.issueDate);
    const firstPaymentDate = addDays(issueDate, paymentTerm.firstPaymentDays);
    const installmentAmount =
      Number(receivable.amount) / paymentTerm.installmentCount;

    // 6. Criar novas parcelas
    for (let i = 1; i <= paymentTerm.installmentCount; i++) {
      const instDueDate = addDays(
        firstPaymentDate,
        (i - 1) * paymentTerm.intervalDays,
      );

      await tx.insert(receivableInstallments).values({
        receivableId: receivable.id,
        installmentNumber: i,
        amount: installmentAmount.toFixed(2),
        amountPaid: "0",
        amountRemaining: installmentAmount.toFixed(2),
        dueDate: format(instDueDate, "yyyy-MM-dd"),
        status: "ABERTA",
        isOverdue: false,
      });

      console.log(
        `[Receivables] Parcela ${i}/${paymentTerm.installmentCount} criada: R$ ${installmentAmount.toFixed(2)} vencimento ${format(instDueDate, "dd/MM/yyyy")}`,
      );
    }

    // 7. Atualizar receivable com nova condição de prazo e data de vencimento da primeira parcela
    const newDueDate = format(firstPaymentDate, "yyyy-MM-dd");
    await tx
      .update(receivables)
      .set({
        paymentTermId: paymentTermId,
        dueDate: newDueDate,
      })
      .where(eq(receivables.id, receivableId));

    console.log(
      `[Receivables] ✅ Receivable ${receivableId} atualizado com ${paymentTerm.installmentCount} parcelas usando condição "${paymentTerm.name}"`,
    );

    return {
      receivableId,
      paymentTermId,
      paymentTermName: paymentTerm.name,
      installmentCount: paymentTerm.installmentCount,
      installmentAmount: installmentAmount.toFixed(2),
    };
  });
}

/**
 * Excluir parcela específica
 * Se for a última parcela, exclui o receivable e remove accountsPosted do pedido
 */
export async function deleteInstallment(
  installmentId: number,
  companyId: string,
) {
  return await db.transaction(async (tx) => {
    // 1. Buscar parcela
    const [inst] = await tx
      .select()
      .from(receivableInstallments)
      .where(eq(receivableInstallments.id, installmentId))
      .limit(1);

    if (!inst) throw new Error("Parcela não encontrada");

    // 2. Buscar receivable
    const [receivable] = await tx
      .select()
      .from(receivables)
      .where(eq(receivables.id, inst.receivableId))
      .limit(1);

    if (!receivable) throw new Error("Conta a receber não encontrada");
    if (receivable.companyId !== companyId)
      throw new Error("Sem permissão para excluir esta parcela");

    // 3. Verificar se a parcela tem pagamentos
    const payments = await tx
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.installmentId, installmentId));

    if (payments.length > 0) {
      throw new Error(
        "Não é possível excluir parcela com pagamentos. Estorne os pagamentos primeiro.",
      );
    }

    // 4. Contar quantas parcelas existem para este receivable
    const allInstallments = await tx
      .select()
      .from(receivableInstallments)
      .where(eq(receivableInstallments.receivableId, inst.receivableId));

    // 5. Excluir a parcela
    await tx
      .delete(receivableInstallments)
      .where(eq(receivableInstallments.id, installmentId));

    console.log(`[Receivables] Parcela ${installmentId} excluída`);

    // 6. Se era a última parcela, excluir receivable e remover accountsPosted do pedido
    if (allInstallments.length === 1) {
      // Excluir receivable
      await tx.delete(receivables).where(eq(receivables.id, inst.receivableId));
      console.log(
        `[Receivables] Receivable ${inst.receivableId} excluído (era a última parcela)`,
      );

      // Remover accountsPosted do pedido
      if (receivable.orderId) {
        await tx
          .update(orders)
          .set({
            accountsPosted: false,
            accountsPostedAt: null,
            accountsPostedBy: null,
          })
          .where(eq(orders.id, receivable.orderId));
        console.log(
          `[Receivables] accountsPosted removido do pedido ${receivable.orderId}`,
        );
      }

      return { deleted: true, receivableDeleted: true };
    } else {
      // Atualizar o valor do receivable (subtrair valor da parcela excluída)
      const newAmount = Number(receivable.amount) - Number(inst.amount);
      const newAmountRemaining =
        Number(receivable.amountRemaining) - Number(inst.amountRemaining);

      await tx
        .update(receivables)
        .set({
          amount: newAmount.toFixed(2),
          amountRemaining: Math.max(0, newAmountRemaining).toFixed(2),
        })
        .where(eq(receivables.id, inst.receivableId));

      console.log(
        `[Receivables] Valor do receivable ${inst.receivableId} atualizado para R$ ${newAmount.toFixed(2)}`,
      );

      return { deleted: true, receivableDeleted: false };
    }
  });
}

/**
 * Atualizar parcela (valor, data de vencimento)
 * Retorna informação se os valores diferem do pedido original
 */
export async function updateInstallment(
  installmentId: number,
  companyId: string,
  data: {
    amount?: number;
    dueDate?: string;
    notes?: string;
  },
) {
  return await db.transaction(async (tx) => {
    // 1. Buscar parcela
    const [inst] = await tx
      .select()
      .from(receivableInstallments)
      .where(eq(receivableInstallments.id, installmentId))
      .limit(1);

    if (!inst) throw new Error("Parcela não encontrada");

    // 2. Buscar receivable
    const [receivable] = await tx
      .select()
      .from(receivables)
      .where(eq(receivables.id, inst.receivableId))
      .limit(1);

    if (!receivable) throw new Error("Conta a receber não encontrada");
    if (receivable.companyId !== companyId)
      throw new Error("Sem permissão para editar esta parcela");

    // 3. Calcular diferenças
    const oldAmount = Number(inst.amount);
    const newAmount = data.amount !== undefined ? data.amount : oldAmount;
    const amountDiff = newAmount - oldAmount;

    // 4. Atualizar parcela
    const updateData: any = {};
    if (data.amount !== undefined) {
      updateData.amount = newAmount.toFixed(2);
      // Atualizar amountRemaining proporcionalmente
      const paidAmount = oldAmount - Number(inst.amountRemaining);
      updateData.amountRemaining = Math.max(0, newAmount - paidAmount).toFixed(
        2,
      );
    }
    if (data.dueDate) {
      updateData.dueDate = data.dueDate;
      // Atualizar isOverdue
      updateData.isOverdue =
        new Date(data.dueDate) < new Date() && inst.status !== "PAGA";
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    await tx
      .update(receivableInstallments)
      .set(updateData)
      .where(eq(receivableInstallments.id, installmentId));

    // 5. Se o valor mudou, atualizar o receivable
    if (amountDiff !== 0) {
      const newReceivableAmount = Number(receivable.amount) + amountDiff;
      const newReceivableRemaining =
        Number(receivable.amountRemaining) + amountDiff;

      await tx
        .update(receivables)
        .set({
          amount: newReceivableAmount.toFixed(2),
          amountRemaining: Math.max(0, newReceivableRemaining).toFixed(2),
        })
        .where(eq(receivables.id, inst.receivableId));
    }

    // 6. Verificar se difere do pedido original
    let differsFromOrder = false;
    let originalOrderInfo = null;

    if (receivable.orderId) {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, receivable.orderId))
        .limit(1);

      if (order) {
        // Buscar todas as parcelas atualizadas
        const allInstallments = await tx
          .select()
          .from(receivableInstallments)
          .where(eq(receivableInstallments.receivableId, inst.receivableId));

        const totalInstallments = allInstallments.reduce(
          (sum, i) => sum + Number(i.amount),
          0,
        );

        // Compara com valor original do pedido
        const orderTotal = Number(order.total);
        if (Math.abs(totalInstallments - orderTotal) > 0.01) {
          differsFromOrder = true;
          originalOrderInfo = {
            orderId: order.id,
            orderTotal: orderTotal,
            installmentsTotal: totalInstallments,
            difference: totalInstallments - orderTotal,
          };
        }
      }
    }

    console.log(
      `[Receivables] Parcela ${installmentId} atualizada. Difere do pedido: ${differsFromOrder}`,
    );

    return {
      updated: true,
      differsFromOrder,
      originalOrderInfo,
    };
  });
}

/**
 * Estornar pagamento (total ou parcial)
 */
export async function reversePayment(
  paymentId: number,
  companyId: string,
  reverseAmount?: number, // Se não informado, estorna total
) {
  return await db.transaction(async (tx) => {
    // 1. Buscar pagamento
    const [payment] = await tx
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.id, paymentId))
      .limit(1);

    if (!payment) throw new Error("Pagamento não encontrado");
    if (payment.companyId !== companyId)
      throw new Error("Sem permissão para estornar este pagamento");

    const amountToReverse = reverseAmount || Number(payment.amount);

    if (amountToReverse > Number(payment.amount)) {
      throw new Error("Valor de estorno maior que o valor do pagamento");
    }

    // 2. Buscar receivable
    const [receivable] = await tx
      .select()
      .from(receivables)
      .where(eq(receivables.id, payment.receivableId))
      .limit(1);

    if (!receivable) throw new Error("Conta a receber não encontrada");

    // 3. Se estorno total, excluir pagamento
    if (amountToReverse === Number(payment.amount)) {
      await tx
        .delete(receivablePayments)
        .where(eq(receivablePayments.id, paymentId));
      console.log(
        `[Receivables] Pagamento ${paymentId} excluído (estorno total)`,
      );
    } else {
      // Estorno parcial: atualizar valor do pagamento
      const newPaymentAmount = Number(payment.amount) - amountToReverse;
      await tx
        .update(receivablePayments)
        .set({ amount: newPaymentAmount.toFixed(2) })
        .where(eq(receivablePayments.id, paymentId));
      console.log(
        `[Receivables] Pagamento ${paymentId} atualizado para R$ ${newPaymentAmount.toFixed(2)} (estorno parcial)`,
      );
    }

    // 4. Atualizar parcela se existir
    if (payment.installmentId) {
      const [inst] = await tx
        .select()
        .from(receivableInstallments)
        .where(eq(receivableInstallments.id, payment.installmentId))
        .limit(1);

      if (inst) {
        const newAmountPaid = Math.max(
          0,
          Number(inst.amountPaid) - amountToReverse,
        );
        const newAmountRemaining = Number(inst.amount) - newAmountPaid;

        let newStatus = inst.status;
        if (newAmountRemaining > 0 && newAmountPaid > 0) {
          newStatus = "PARCIAL";
        } else if (newAmountRemaining > 0) {
          newStatus = "ABERTA";
        }

        await tx
          .update(receivableInstallments)
          .set({
            amountPaid: newAmountPaid.toFixed(2),
            amountRemaining: newAmountRemaining.toFixed(2),
            status: newStatus,
            paidAt: null,
          })
          .where(eq(receivableInstallments.id, payment.installmentId));
      }
    }

    // 5. Atualizar receivable
    const newAmountPaid = Math.max(
      0,
      Number(receivable.amountPaid) - amountToReverse,
    );
    const newAmountRemaining = Number(receivable.amount) - newAmountPaid;

    let newStatus = receivable.status;
    if (newAmountRemaining > 0 && newAmountPaid > 0) {
      newStatus = "PARCIAL";
    } else if (newAmountRemaining > 0) {
      newStatus = "ABERTA";
    }

    await tx
      .update(receivables)
      .set({
        amountPaid: newAmountPaid.toFixed(2),
        amountRemaining: newAmountRemaining.toFixed(2),
        status: newStatus,
        paidAt: null,
      })
      .where(eq(receivables.id, payment.receivableId));

    console.log(
      `[Receivables] Receivable ${payment.receivableId} atualizado após estorno: pago R$ ${newAmountPaid.toFixed(2)}, pendente R$ ${newAmountRemaining.toFixed(2)}`,
    );

    return {
      reversed: true,
      amountReversed: amountToReverse,
      paymentDeleted: amountToReverse === Number(payment.amount),
    };
  });
}

/**
 * Obter detalhes de um pagamento
 */
export async function getPaymentDetails(paymentId: number, companyId: string) {
  const [payment] = await db
    .select()
    .from(receivablePayments)
    .where(eq(receivablePayments.id, paymentId))
    .limit(1);

  if (!payment) return null;
  if (payment.companyId !== companyId) return null;

  // Buscar receivable
  const [receivable] = await db
    .select()
    .from(receivables)
    .where(eq(receivables.id, payment.receivableId))
    .limit(1);

  // Buscar parcela se existir
  let installment = null;
  if (payment.installmentId) {
    const [inst] = await db
      .select()
      .from(receivableInstallments)
      .where(eq(receivableInstallments.id, payment.installmentId))
      .limit(1);
    installment = inst;
  }

  return {
    ...payment,
    receivable,
    installment,
  };
}
