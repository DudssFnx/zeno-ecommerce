import "dotenv/config";
import { isNull, not } from "drizzle-orm";
import { db } from "../server/db";
import { products } from "../shared/schema";

async function run() {
  const allProducts = await db.select().from(products);
  const blingCount = await db
    .select()
    .from(products)
    .where(not(isNull(products.blingId)))
    .then((r) => r.length);
  const blingStockNonZero = await db
    .select()
    .from(products)
    .where(not(isNull(products.blingId)))
    .then((rows) => rows.filter((r) => (r.stock || 0) > 0).length);

  console.log(`products total: ${allProducts.length}`);
  console.log(`products with blingId: ${blingCount}`);
  console.log(`products with blingId and stock>0: ${blingStockNonZero}`);

  const recentAll = await db
    .select()
    .from(products)
    .where(not(isNull(products.blingLastSyncedAt)));

  const recent = recentAll
    .sort((a, b) => (a.blingLastSyncedAt > b.blingLastSyncedAt ? -1 : 1))
    .slice(0, 10);

  console.log("\nMost recently synced products:");
  recent.forEach((p) => {
    console.log(
      `${p.id} | sku:${p.sku} | blingId:${p.blingId} | stock:${p.stock} | blingLastSyncedAt:${p.blingLastSyncedAt}`,
    );
  });

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
