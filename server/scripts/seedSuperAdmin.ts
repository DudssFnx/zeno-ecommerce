import { b2bUsers } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db";

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const SUPER_ADMIN_PASSWORD =
  process.env.SUPER_ADMIN_DEFAULT_PASSWORD || "ChangeMe@2024!";

export async function seedSuperAdmin() {
  if (SUPER_ADMIN_EMAILS.length === 0) {
    console.log("[SEED] No SUPER_ADMIN_EMAILS configured, skipping seed");
    return;
  }

  console.log("[SEED] Verificando usuários SUPER_ADMIN...");

  for (const email of SUPER_ADMIN_EMAILS) {
    const [existing] = await db
      .select()
      .from(b2bUsers)
      .where(eq(b2bUsers.email, email));

    if (existing) {
      console.log("[SEED] SUPER_ADMIN já existe:", email);
      continue;
    }

    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
    const name =
      email
        .split("@")[0]
        .replace(/[^a-zA-Z]/g, " ")
        .trim() || "Super Admin";

    const [superAdmin] = await db
      .insert(b2bUsers)
      .values({
        firstName: name,
        email: email,
        password: hashedPassword,
        role: "super_admin",
      })
      .returning();

    console.log("[SEED] SUPER_ADMIN criado:", email);
  }

  console.log("[SEED] Seed SUPER_ADMIN concluído");
}
