import { eq } from "drizzle-orm";
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
      "Usage: npx tsx server/scripts/repairReceivableForOrder.ts <orderNumber>",
    );
    process.exit(1);
  }

  console.log(`Procurando pedido com orderNumber='${search}'`);

  // 1. Tentar encontrar o pedido por orderNumber exato
  let order = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, search))
    .limit(1)
    .then((rows) => rows[0]);

  // 2. Tentar buscar por contém (fallback)
  if (!order) {
    console.log(
      "Pedido não encontrado por igualdade, tentando busca por contêm...",
    );
    const raw = await db.execute(
      sql`SELECT * FROM orders WHERE order_number LIKE ${"%" + search + "%"} LIMIT 1`,
    );
    order = raw.rows && raw.rows[0];
  }

  if (!order) {
    console.error(`Pedido com orderNumber '${search}' não encontrado.`);
    process.exit(1);
  }

  console.log(
    `Pedido encontrado: id=${order.id} orderNumber=${order.orderNumber} total=${order.total}`,
  );

  // Buscar receivable associado
  const [rec] = await db
    .select()
    .from(receivables)
    .where(eq(receivables.orderId, order.id))
    .limit(1);

  if (!rec) {
    console.error(`Nenhum receivable encontrado para pedido id=${order.id}.`);
    process.exit(1);
  }

  console.log(
    `Receivable encontrado: id=${rec.id} amount=${rec.amount} paymentTermId=${rec.paymentTermId}`,
  );

  const installments = await db
    .select()
    .from(receivableInstallments)
    .where(eq(receivableInstallments.receivableId, rec.id));

  const payments = await db
    .select()
    .from(receivablePayments)
    .where(eq(receivablePayments.receivableId, rec.id));

  console.log(
    `Found installments=${installments.length} payments=${payments.length}`,
  );

  if (payments.length > 0) {
    console.error(
      "Receivable tem pagamentos registrados. Não será feita alteração automática por segurança.",
    );
    process.exit(1);
  }

  const totalCents = Math.round(Number(rec.amount) * 100);
  const sumInstallmentCents = installments.reduce(
    (acc: number, it: any) => acc + Math.round(Number(it.amount) * 100),
    0,
  );

  if (
    installments.length !== (rec.paymentTermId ? null : null) &&
    sumInstallmentCents === totalCents
  ) {
    console.log("As parcelas já estão consistentes. Nada a fazer.");
    process.exit(0);
  }

  if (!rec.paymentTermId) {
    console.error(
      "Receivable não possui paymentTermId. Não é possível recriar parcelas automaticamente.",
    );
    process.exit(1);
  }

  console.log("Recriando parcelas usando paymentTermId=", rec.paymentTermId);
  await recreateInstallments(rec.id, rec.paymentTermId);

  const newInst = await db
    .select()
    .from(receivableInstallments)
    .where(eq(receivableInstallments.receivableId, rec.id));

  console.log(`Parcelas recriadas: count=${newInst.length}`);
  newInst.forEach((i: any) =>
    console.log(
      `#${i.installmentNumber} - amount=${i.amount} due=${i.dueDate}`,
    ),
  );

  console.log("Reparo concluído com sucesso.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Erro ao executar script:", e);
  process.exit(1);
});
