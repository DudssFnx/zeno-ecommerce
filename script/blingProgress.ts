import "dotenv/config";

async function run() {
  const m = await import("../server/services/bling");
  console.log(JSON.stringify(m.getSyncProgress(), null, 2));
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
