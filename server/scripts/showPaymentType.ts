import { eq } from "drizzle-orm";
import { paymentTerms, paymentTypes } from "../../shared/schema";
import { db } from "../db";

async function main() {
  const idStr = process.argv[2];
  if (!idStr) {
    console.error(
      "Usage: npx tsx server/scripts/showPaymentType.ts <paymentTypeId>",
    );
    process.exit(1);
  }
  const id = parseInt(idStr);
  const [pt] = await db
    .select()
    .from(paymentTypes)
    .where(eq(paymentTypes.id, id))
    .limit(1);
  if (!pt) {
    console.error(`paymentType ${id} not found`);
    process.exit(1);
  }
  console.log(
    `paymentType id=${pt.id} name=${pt.name} paymentTermType=${pt.paymentTermType} paymentTermId=${pt.paymentTermId}`,
  );
  if (pt.paymentTermId) {
    const [term] = await db
      .select()
      .from(paymentTerms)
      .where(eq(paymentTerms.id, pt.paymentTermId))
      .limit(1);
    console.log(
      `paymentTerm id=${term.id} name=${term.name} installmentCount=${term.installmentCount} firstPaymentDays=${term.firstPaymentDays} intervalDays=${term.intervalDays}`,
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
