import "dotenv/config";

async function run() {
  const m = await import("../server/services/bling");
  console.log("Starting full Bling sync (server-side)...");
  try {
    // Ensure tokens are loaded into this process (read from DB)
    try {
      const init = await m.initializeBlingTokens();
      console.log("initializeBlingTokens ->", init);
    } catch (e) {
      console.warn("initializeBlingTokens failed:", e?.message || e);
    }

    const result = await m.syncProducts();
    console.log("Sync result:", result);
  } catch (err) {
    console.error("Sync failed:", err);
    process.exit(1);
  }
  process.exit(0);
}

run();
