import { companies, users } from "@shared/schema";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/db";

async function run() {
  try {
    const companyRazao = "TestCo Auto Login";

    const [existingCompany] = await db
      .select()
      .from(companies)
      .where(eq(companies.razaoSocial, companyRazao))
      .limit(1);

    let companyId: string;
    if (existingCompany) {
      companyId = existingCompany.id;
      console.log("Found existing company:", companyId);
    } else {
      const [newCompany] = await db
        .insert(companies)
        .values({
          razaoSocial: companyRazao,
          fantasyName: "TestCo",
          createdAt: new Date(),
          updatedAt: new Date(),
          active: true,
          approvalStatus: "APROVADO",
          slug: "testco-auto-login",
        })
        .returning();
      companyId = newCompany.id;
      console.log("Created company:", companyId);
    }

    const testEmail = "test-login@local.invalid";
    const password = "Test1234";

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    if (existingUser) {
      console.log("User already exists:", existingUser.id);
    } else {
      const hashed = await bcrypt.hash(password, 10);
      const [newUser] = await db
        .insert(users)
        .values({
          firstName: "Auto",
          lastName: "Tester",
          email: testEmail,
          password: hashed,
          companyId,
          role: "admin",
          approved: true,
          createdAt: new Date(),
        })
        .returning();
      console.log("Created user:", newUser.id);
    }

    console.log(`
Created/verified test user:
  email: ${testEmail}
  password: ${password}
  company razaoSocial: ${companyRazao}
`);
  } catch (err: any) {
    console.error("Error creating test company/user:", err);
    process.exit(1);
  }
  process.exit(0);
}

run();
