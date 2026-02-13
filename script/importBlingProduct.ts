import "dotenv/config";

async function run() {
  const idArg = process.argv[2];
  if (!idArg) {
    console.error(
      "Usage: npx tsx script/importBlingProduct.ts <blingProductId> [companyId]",
    );
    process.exit(1);
  }
  const productId = Number(idArg);
  const companyId = process.argv[3] || null;
  const m = await import("../server/services/bling");
  try {
    await m.initializeBlingTokens().catch(() => null);
    const res = await m.importBlingProductById(
      productId,
      companyId || undefined,
    );
    console.log("import result:", res);
  } catch (err) {
    console.error("import failed:", err);
  }
  process.exit(0);
}

run();
