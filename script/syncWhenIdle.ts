import "dotenv/config";

async function waitUntilIdle(m: any, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const progress = m.getSyncProgress();
    if (progress.status !== "running") return true;
    console.log("Sync in progress — waiting 2s...");
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function run() {
  const m = await import("../server/services/bling");
  console.log("Checking existing sync status...");
  const ok = await waitUntilIdle(m);
  if (!ok) {
    console.error("Timeout waiting for existing sync to finish");
    process.exit(1);
  }

  // Ensure this process has Bling tokens loaded from DB
  try {
    const init = await m.initializeBlingTokens();
    console.log("initializeBlingTokens ->", init);
  } catch (e) {
    console.warn("initializeBlingTokens failed:", e?.message || e);
  }

  try {
    console.log("Starting sync now...");
    const started = await m.syncProducts();
    console.log("Sync completed:", started);
  } catch (err) {
    console.error("Sync failed:", err);
    process.exit(1);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
