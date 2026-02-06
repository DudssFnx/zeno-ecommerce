import { addDays, format } from "date-fns";
import { eq } from "drizzle-orm";
import {
  orders,
  receivableInstallments,
  receivables,
} from "../../shared/schema";
import { db } from "../db";

async function fixOrder() {
  console.log("Corrigindo pedido 287422 e suas parcelas...");

  // 1. Atualizar pedido com paymentTermId = 3 (30/60/90)
  await db.update(orders).set({ paymentTermId: 3 }).where(eq(orders.id, 10));
  console.log("✅ Pedido atualizado com paymentTermId = 3 (30/60/90 dias)");

  // 2. Deletar parcelas antigas
  await db
    .delete(receivableInstallments)
    .where(eq(receivableInstallments.receivableId, 1));
  console.log("✅ Parcelas antigas deletadas");

  // 3. Atualizar receivable com nova condição de prazo
  await db
    .update(receivables)
    .set({ paymentTermId: 3 })
    .where(eq(receivables.id, 1));
  console.log("✅ Receivable atualizado com paymentTermId = 3");

  // 4. Criar 3 novas parcelas
  const totalAmount = 90400;
  const installmentCount = 3;
  const amount = totalAmount / installmentCount;
  const issueDate = new Date("2026-02-05");

  for (let i = 1; i <= installmentCount; i++) {
    const dueDate = addDays(issueDate, 30 * i);
    await db.insert(receivableInstallments).values({
      receivableId: 1,
      installmentNumber: i,
      amount: amount.toFixed(2),
      amountPaid: "0",
      amountRemaining: amount.toFixed(2),
      dueDate: format(dueDate, "yyyy-MM-dd"),
      status: "ABERTA",
      isOverdue: false,
    });
    console.log(
      `✅ Parcela ${i}/${installmentCount} criada: R$ ${amount.toFixed(2)} vence em ${format(dueDate, "dd/MM/yyyy")}`,
    );
  }

  console.log("\n🎉 Pronto! 3 parcelas criadas para o pedido 287422.");
  process.exit(0);
}

fixOrder().catch((e) => {
  console.error("Erro:", e);
  process.exit(1);
});
