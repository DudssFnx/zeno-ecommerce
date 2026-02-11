import { asc, eq } from "drizzle-orm";
import {
  orders,
  receivableInstallments,
  receivablePayments,
  receivables,
} from "../../shared/schema";
import { db } from "../db";
import { recreateInstallments } from "../services/receivables.service";

async function main() {
  const search = process.argv[2];
  if (!search) {
    console.error(
      "Usage: npx tsx server/scripts/mergeReceivablesForOrder.ts <orderNumber>",
    );
    process.exit(1);
  }

  console.log(`Iniciando merge para orderNumber='${search}'`);

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, search))
    .limit(1);
  if (!order) {
    console.error(`Pedido ${search} não encontrado`);
    process.exit(1);
  }

  const recs = await db
    .select()
    .from(receivables)
    .where(eq(receivables.orderId, order.id))
    .orderBy(asc(receivables.id));
  console.log(`Receivables encontrados: ${recs.length}`);
  if (recs.length <= 1) {
    console.log("Apenas 1 receivable; nada a fazer.");
    process.exit(0);
  }

  // Separar que possuem pagamentos
  const recsWithPayments: any[] = [];
  const recsWithoutPayments: any[] = [];

  for (const r of recs) {
    const pays = await db
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.receivableId, r.id));
    if (pays.length > 0) recsWithPayments.push(r);
    else recsWithoutPayments.push(r);
  }

  // If more than one receivable has payments we require manual review
  if (recsWithPayments.length > 1) {
    console.error(
      `Existem ${recsWithPayments.length} receivable(s) com pagamentos. Manual review required. Aborting.`,
    );
    process.exit(1);
  }

  let keeper: any;
  let toDelete: any[] = [];

  if (recsWithPayments.length === 1) {
    // Keep the receivable that already has payments, delete the others without payments
    keeper = recsWithPayments[0];
    toDelete = recsWithoutPayments;
    console.log(
      `Keeper id=${keeper.id} (has payments). Deletando ${toDelete.length} receivable(s) without payments`,
    );
  } else {
    // No receivables with payments: keep the oldest without payments and delete the rest
    keeper = recsWithoutPayments[0];
    toDelete = recsWithoutPayments.slice(1);
    console.log(
      `Keeper id=${keeper.id}. Deletando ${toDelete.length} receivable(s)`,
    );
  }

  for (const d of toDelete) {
    // delete installments
    await db
      .delete(receivableInstallments)
      .where(eq(receivableInstallments.receivableId, d.id));
    // delete receivable
    await db.delete(receivables).where(eq(receivables.id, d.id));
    console.log(`Deleted receivable id=${d.id}`);
  }

  // Recreate installments on keeper to match payment term
  if (!keeper.paymentTermId) {
    console.error(
      `Keeper receivable ${keeper.id} não possui paymentTermId. Manual fix required.`,
    );
    process.exit(1);
  }

  if (recsWithPayments.length === 0) {
    console.log(
      `Recriando parcelas para receivable ${keeper.id} usando paymentTermId ${keeper.paymentTermId}`,
    );
    await recreateInstallments(keeper.id, keeper.paymentTermId);

    // Verify result
    const insts = await db
      .select()
      .from(receivableInstallments)
      .where(eq(receivableInstallments.receivableId, keeper.id));
    console.log(`Parcelas após reparo: ${insts.length}`);
    insts.forEach((i: any) =>
      console.log(
        `#${i.installmentNumber} amount=${i.amount} due=${i.dueDate}`,
      ),
    );
  } else {
    console.log(
      `Keeper receivable ${keeper.id} tem pagamentos; pulando recriação de parcelas para preservar histórico.`,
    );
    const insts = await db
      .select()
      .from(receivableInstallments)
      .where(eq(receivableInstallments.receivableId, keeper.id));
    console.log(`Parcelas atuais no keeper: ${insts.length}`);
    insts.forEach((i: any) =>
      console.log(
        `#${i.installmentNumber} amount=${i.amount} remaining=${i.amountRemaining} due=${i.dueDate}`,
      ),
    );
  }

  console.log("Merge e reparo concluídos com sucesso.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
