import "dotenv/config"; // <--- ADICIONE ESTA LINHA AQUI
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("ERRO: DATABASE_URL não encontrada no ambiente!");
  // Fallback para evitar erro de 'base' caso a variável falhe
  process.env.DATABASE_URL =
    "postgresql://postgres:HuAEUzZKFvIviCrffwOmkAMFaSYDwiHz@gondola.proxy.rlwy.net:32164/railway";
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const db = drizzle(pool);
export { pool };
