import { pool } from "../db";

async function run() {
  const clientId = "TEST_CLIENT_ID";
  const clientSecret = "TEST_CLIENT_SECRET_1234567890";
  const companyId = "1";
  await pool.query(
    `INSERT INTO bling_credentials(company_id, client_id, client_secret, created_at, updated_at) VALUES ($1,$2,$3, now(), now())`,
    [companyId, clientId, clientSecret],
  );
  console.log("Inserted test bling credential for company", companyId);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
