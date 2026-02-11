import { paymentTerms } from "../../shared/schema";
import { db } from "../db";

async function main() {
  const terms = await db.select().from(paymentTerms);
  console.log(
    terms.map((t) => ({
      id: t.id,
      name: t.name,
      installmentCount: t.installmentCount,
    })),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
