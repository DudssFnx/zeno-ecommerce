import "dotenv/config";

async function run() {
  const m = await import("../server/services/bling");
  try {
    await m.initializeBlingTokens().catch(() => null);
  } catch (err) {
    console.warn("initializeBlingTokens failed:", err?.message || err);
  }

  for (let page = 1; page <= 10; page++) {
    try {
      const products = await m.fetchBlingProductsList(page, 100);
      console.log(`Page ${page}: ${products.length} items`);
      if (!products || products.length === 0) break;
    } catch (err: any) {
      console.error(`Error fetching page ${page}:`, err?.message || err);
      break;
    }
    // rate-limit friendliness
    await new Promise((r) => setTimeout(r, 300));
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
