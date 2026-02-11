import { eq } from "drizzle-orm";
import { orders, paymentTerms } from "../../shared/schema";
import { db } from "../db";

async function main() {
  const orderNumber = process.argv[2];
  if (!orderNumber) {
    console.error(
      "Usage: npx tsx server/scripts/showOrderPaymentTerm.ts <orderNumber>",
    );
    process.exit(1);
  }

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
    `Pedido: id=${order.id} orderNumber=${order.orderNumber} total=${order.total}`,
  );
  console.log(
    `order.paymentTermId=${order.paymentTermId} order.paymentTypeId=${order.paymentTypeId}`,
  );

  if (order.paymentTermId) {
    const [pt] = await db
      .select()
      .from(paymentTerms)
      .where(eq(paymentTerms.id, order.paymentTermId))
      .limit(1);
    console.log(
      `paymentTerm: id=${pt.id} name=${pt.name} installmentCount=${pt.installmentCount} firstPaymentDays=${pt.firstPaymentDays} intervalDays=${pt.intervalDays}`,
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
