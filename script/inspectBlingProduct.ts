import "dotenv/config";

async function run() {
  const idArg = process.argv[2];
  if (!idArg) {
    console.error(
      "Usage: npx tsx script/inspectBlingProduct.ts <blingProductId>",
    );
    process.exit(1);
  }
  const productId = Number(idArg);
  const m = await import("../server/services/bling");
  try {
    await m.initializeBlingTokens().catch(() => null);
    const full = await m.fetchBlingProductDetails(productId, true);
    console.log(JSON.stringify(full, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
