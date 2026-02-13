import "dotenv/config";
import { isNull, not } from "drizzle-orm";
import { db } from "../server/db";
import { products } from "../shared/schema";

async function run() {
  console.log("Gathering products with blingId from DB...");
  const rows = await db
    .select()
    .from(products)
    .where(not(isNull(products.blingId)));
  const blingIds = Array.from(
    new Set(rows.map((r) => Number(r.blingId)).filter(Boolean)),
  );
  console.log(`Found ${blingIds.length} distinct Bling IDs.`);
  if (blingIds.length === 0) return process.exit(0);

  const m = await import("../server/services/bling");
  try {
    await m.initializeBlingTokens().catch(() => null);
  } catch (err) {
    console.warn("initializeBlingTokens failed:", err?.message || err);
  }

  const batchSize = 50;
  let totalImported = 0;
  let totalSkipped = 0;
  const totalErrors: string[] = [];

  for (let i = 0; i < blingIds.length; i += batchSize) {
    const batch = blingIds.slice(i, i + batchSize);
    console.log(
      `Importing batch ${i / batchSize + 1} — ${batch.length} IDs...`,
    );
    try {
      const res = await m.importBlingProductsByIds(batch);
      console.log(
        `Batch result: imported=${res.imported} skipped=${res.skipped} errors=${res.errors.length}`,
      );
      totalImported += res.imported;
      totalSkipped += res.skipped;
      totalErrors.push(...res.errors);
    } catch (err: any) {
      console.error(`Batch error:`, err?.message || err);
      totalErrors.push(
        `Batch starting at ${i}: ${err?.message || String(err)}`,
      );
    }
    // be polite to Bling API
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(
    `\nSummary: imported=${totalImported} skipped=${totalSkipped} errors=${totalErrors.length}`,
  );
  if (totalErrors.length > 0) {
    console.log("Errors (first 20):", totalErrors.slice(0, 20));
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
