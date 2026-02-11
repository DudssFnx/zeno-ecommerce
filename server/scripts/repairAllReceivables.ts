import { db } from "../db";
import "../scripts/helpers/env";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`Repair script invoked. Apply changes: ${apply}`);

  const dupOrders = await db.query(`
    SELECT order_id, COUNT(*) as cnt FROM receivables WHERE order_id IS NOT NULL GROUP BY order_id HAVING COUNT(*) > 1
  `);

  if (dupOrders.rowCount === 0) {
    console.log("No duplicate receivables found.");
    process.exit(0);
  }

  for (const row of dupOrders.rows) {
    const orderId = row.order_id;
    console.log(`Order ${orderId} has ${row.cnt} receivables. Inspecting...`);

    const rs = await db.query(
      `SELECT id FROM receivables WHERE order_id = $1 ORDER BY id`,
      [orderId],
    );
    const receivableIds = rs.rows.map((r) => r.id);

    // Decide keeper: prefer receivable with payments, else the earliest id
    let keeper = null;
    for (const id of receivableIds) {
      const payments = await db.query(
        `SELECT COUNT(*) as cnt FROM payments WHERE receivable_id = $1`,
        [id],
      );
      if (Number(payments.rows[0].cnt) > 0) {
        keeper = id;
        break;
      }
    }
    if (!keeper) keeper = receivableIds[0];

    const toDelete = receivableIds.filter((id: number) => id !== keeper);

    console.log(`Keeping ${keeper}; will delete: ${toDelete.join(", ")}`);

    if (apply) {
      for (const id of toDelete) {
        await db.query(`DELETE FROM installments WHERE receivable_id = $1`, [
          id,
        ]);
        await db.query(`DELETE FROM payments WHERE receivable_id = $1`, [id]);
        await db.query(`DELETE FROM receivables WHERE id = $1`, [id]);
        console.log(`Deleted receivable ${id}`);
      }
      // Recreate installments for keeper if needed (reuse server/service logic if desired)
      console.log(`Finished repairing order ${orderId}`);
    }
  }

  console.log("Repair run complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
