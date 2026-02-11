import "../scripts/helpers/env";
import { db } from "../db";

async function main() {
  console.log("Scanning all orders for receivable anomalies...");

  const orders = await db.query(`SELECT id, order_number, total FROM orders ORDER BY id`);
  const report: any[] = [];

  for (const o of orders.rows) {
    const res = await db.query(
      `SELECT id, status, (SELECT COUNT(*) FROM installments i WHERE i.receivable_id = r.id) as installments_count, (SELECT COUNT(*) FROM payments p WHERE p.receivable_id = r.id) as payments_count
       FROM receivables r WHERE r.order_id = $1`,
      [o.id]
    );

    if (res.rowCount > 1) {
      report.push({ orderId: o.id, orderNumber: o.order_number, total: o.total, receivables: res.rows });
    } else if (res.rowCount === 1) {
      const r = res.rows[0];
      // Check installments and sum
      const insts = await db.query(`SELECT id, amount, remaining FROM installments WHERE receivable_id = $1 ORDER BY due_date`, [r.id]);
      const sum = insts.rows.reduce((s: number, it: any) => s + Number(it.amount), 0);
      if (Number(o.total) !== sum) {
        report.push({ orderId: o.id, orderNumber: o.order_number, total: o.total, receivableId: r.id, issue: 'installments_mismatch', installments: insts.rows });
      }
    }
  }

  console.log(`Scan complete. Found ${report.length} problematic orders.`);
  if (report.length > 0) {
    console.log(JSON.stringify(report, null, 2));
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
