import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { companies, products } from "../shared/schema";

async function run() {
  const slug = process.argv[2] || "loja-madrugadao";
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);
  console.log(
    "company found =>",
    !!company,
    company?.id,
    company?.slug,
    company?.fantasyName,
  );
  if (!company) return process.exit(0);
  const prods = await db
    .select()
    .from(products)
    .where(eq(products.companyId, company.id));
  console.log("products count for", slug, ":", prods.length);
  for (const p of prods.slice(0, 20)) {
    console.log("-", p.id, p.name, p.sku, p.price, p.status, p.categoryId);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
