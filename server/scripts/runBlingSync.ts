import("../services/bling").then(async (m) => {
  try {
    console.log("[sync-script] initialize tokens...");
    const ok = await m.initializeBlingTokens();
    console.log("[sync-script] initializeBlingTokens ->", ok);
    if (!ok) {
      console.error("[sync-script] No tokens loaded from DB. Aborting.");
      process.exit(3);
    }
    console.log("[sync-script] starting syncProducts...");
    const result = await m.syncProducts();
    console.log("[sync-script] SYNC_RESULT", JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error(
      "[sync-script] SYNC_ERROR",
      err && err.stack ? err.stack : err,
    );
    process.exit(2);
  }
});
