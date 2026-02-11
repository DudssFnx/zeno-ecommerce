import { eq } from "drizzle-orm";
import {
  orders,
  receivableInstallments,
  receivablePayments,
  receivables,
} from "../../shared/schema";
import { db } from "../db";

async function main() {
  const search = process.argv[2];
  if (!search) {
    console.error(
      "Usage: npx tsx server/scripts/inspectReceivablesForOrder.ts <orderNumber>",
    );
    process.exit(1);
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, search))
    .limit(1);
  if (!order) {
    console.error(`Pedido ${search} não encontrado`);
    process.exit(1);
  }

  console.log(
    `Pedido: id=${order.id} orderNumber=${order.orderNumber} total=${order.total}`,
  );
  const recs = await db
    .select()
    .from(receivables)
    .where(eq(receivables.orderId, order.id));
  console.log(`Receivables encontrados: ${recs.length}`);
  for (const r of recs) {
    console.log(
      `- Receivable id=${r.id} amount=${r.amount} paymentTermId=${r.paymentTermId} status=${r.status}`,
    );
    const insts = await db
      .select()
      .from(receivableInstallments)
      .where(eq(receivableInstallments.receivableId, r.id));
    console.log(`  Insts: ${insts.length}`);
    insts.forEach((i: any) =>
      console.log(
        `    #${i.installmentNumber} amount=${i.amount} remaining=${i.amountRemaining} due=${i.dueDate}`,
      ),
    );
    const pays = await db
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.receivableId, r.id));
    console.log(`  Payments: ${pays.length}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
