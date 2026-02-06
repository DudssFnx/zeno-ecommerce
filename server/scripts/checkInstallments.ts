import { receivableInstallments, receivables } from "../../shared/schema";
import { db } from "../db";

async function check() {
  console.log("=== VERIFICANDO BANCO DE DADOS ===\n");

  const recs = await db.select().from(receivables);
  console.log(`Receivables: ${recs.length}`);
  recs.forEach((r) => {
    console.log(
      `  - ID ${r.id}: ${r.description}, R$ ${r.amount}, paymentTermId: ${r.paymentTermId}`,
    );
  });

  console.log("");

  const insts = await db.select().from(receivableInstallments);
  console.log(`Parcelas: ${insts.length}`);
  insts.forEach((i) => {
    console.log(
      `  - ID ${i.id}: receivableId=${i.receivableId}, parcela ${i.installmentNumber}, R$ ${i.amount}, vence ${i.dueDate}`,
    );
  });

  process.exit(0);
}

check().catch((e) => {
  console.error("Erro:", e);
  process.exit(1);
});
