import { pool } from "../db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const prodRes = await client.query(`SELECT id FROM products LIMIT 1`);

    let productId: number;
    if (prodRes.rows.length === 0) {
      const insertProd = await client.query(
        `INSERT INTO products (name, sku, price, stock, created_at, updated_at) VALUES ($1,$2,$3,$4,now(),now()) RETURNING id`,
        ["Produto Teste", "TESTSKU", "10.00", 100],
      );
      productId = insertProd.rows[0].id;
      console.log("Produto criado id=", productId);
    } else {
      productId = prodRes.rows[0].id;
      console.log("Produto existente id=", productId);
    }

    const insertOrder = await client.query(
      `INSERT INTO orders (company_id, order_number, status, total, created_at, updated_at) VALUES ($1,$2,$3,$4,now(),now()) RETURNING id`,
      ["1", `TEST-${Date.now()}`, "ORCAMENTO", "10.00"],
    );
    const orderId = insertOrder.rows[0].id;
    console.log("Pedido criado id=", orderId);

    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, price, line_total) VALUES ($1,$2,$3,$4,$5)`,
      [orderId, productId, 2, "10.00", "20.00"],
    );

    await client.query("COMMIT");
    console.log("Setup de teste concluído.");
    console.log(`Use orderId=${orderId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
  } finally {
    client.release();
  }
}

main().catch((e) => console.error(e));
