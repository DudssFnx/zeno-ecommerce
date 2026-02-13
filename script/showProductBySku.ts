import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { products } from "../shared/schema";

async function run() {
  const sku = process.argv[2];
  if (!sku) {
    console.error("Usage: npx tsx script/showProductBySku.ts <sku>");
    process.exit(1);
  }
  const rows = await db.select().from(products).where(eq(products.sku, sku));
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
