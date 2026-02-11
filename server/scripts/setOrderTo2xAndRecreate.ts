import { eq } from "drizzle-orm";
import { orders, receivables } from "../../shared/schema";
import { db } from "../db";
import { recreateInstallments } from "../services/receivables.service";

async function main() {
  const orderNumber = process.argv[2];
  if (!orderNumber) {
    console.error(
      "Usage: npx tsx server/scripts/setOrderTo2xAndRecreate.ts <orderNumber>",
    );
    process.exit(1);
  }

  const twoXPaymentTermId = 2; // paymentTerm id for 30/60 dias (2x)

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!order) {
    console.error(`Pedido ${orderNumber} não encontrado`);
    process.exit(1);
  }

  console.log(
    `Pedido encontrado: id=${order.id} orderNumber=${order.orderNumber} total=${order.total}`,
  );

  // Atualizar order.paymentTermId
  await db
    .update(orders)
    .set({ paymentTermId: twoXPaymentTermId })
    .where(eq(orders.id, order.id));
  console.log(`Order.paymentTermId atualizado para ${twoXPaymentTermId}`);

  // Encontrar receivable (kept)
  const recs = await db
    .select()
    .from(receivables)
    .where(eq(receivables.orderId, order.id));
  if (recs.length === 0) {
    console.error(`Nenhum receivable encontrado para pedido ${orderNumber}`);
    process.exit(1);
  }

  // Escolher o receivable existente mais antigo
  const keeper = recs.sort(
    (a: any, b: any) => (a.id as number) - (b.id as number),
  )[0];

  console.log(
    `Atualizando receivable id=${keeper.id} paymentTermId=${twoXPaymentTermId}`,
  );
  await db
    .update(receivables)
    .set({ paymentTermId: twoXPaymentTermId })
    .where(eq(receivables.id, keeper.id));

  console.log(
    `Chamando recreateInstallments para receivable ${keeper.id} com paymentTermId ${twoXPaymentTermId}`,
  );
  await recreateInstallments(keeper.id, twoXPaymentTermId);

  const updatedInstallments = await db.select().from("receivable_installments");

  console.log(`Parcels for receivable ${keeper.id} after update:`);
  const insts = await db
    .select()
    .from("receivable_installments")
    .where(eq(("receivable_installments" as any).receivableId, keeper.id));
  insts.forEach((i: any) =>
    console.log(
      `#${i.installment_number || i.installmentNumber} amount=${i.amount || i.amount} due=${i.due_date || i.dueDate}`,
    ),
  );

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
