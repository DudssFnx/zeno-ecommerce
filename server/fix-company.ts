import { companies, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";

async function fixCompany() {
  console.log("🔧 Iniciando correção INTELIGENTE...");

  // O erro nos revelou que o ID que está travando tudo é o "1".
  // Vamos usar ele mesmo, pois os pedidos já estão amarrados nele.
  const targetId = "1";
  const adminEmail = "admin@admin.com";

  console.log(`🔄 Atualizando a empresa existente (ID: ${targetId})...`);

  // 1. Atualiza os dados da empresa ID "1" para serem a Zeno Matriz
  // (Isso evita erro de chave estrangeira nos pedidos)
  await db
    .update(companies)
    .set({
      razaoSocial: "Zeno Matriz Ltda",
      nomeFantasia: "Zeno Matriz",
      cnpj: "00.000.000/0001-00",
      email: "admin@admin.com",
      tipoCliente: "VAREJO",
      approvalStatus: "APROVADO",
      ativo: true,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, targetId));

  // 2. Garante que o seu Admin está apontando para o ID "1"
  console.log("🔄 Vinculando usuário Admin...");

  await db
    .update(users)
    .set({
      companyId: targetId,
      company: "Zeno Matriz",
    })
    .where(eq(users.email, adminEmail));

  console.log("✅ SUCESSO! Empresa atualizada e Admin vinculado.");
  console.log("📦 Seus pedidos antigos foram preservados.");
  process.exit(0);
}

fixCompany().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
