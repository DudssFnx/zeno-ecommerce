import { sql } from "drizzle-orm";
import { pgTable, varchar, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tipoClienteEnum = pgEnum("tipo_cliente", ["ATACADO", "VAREJO"]);
export const approvalStatusEnum = pgEnum("approval_status", ["PENDENTE", "APROVADO", "REPROVADO"]);

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 100 }).unique(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  cnpj: varchar("cnpj", { length: 18 }).unique().notNull(),
  tipoCliente: tipoClienteEnum("tipo_cliente").notNull().default("VAREJO"),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("PENDENTE"),
  ativo: boolean("ativo").notNull().default(true),
  cep: varchar("cep", { length: 9 }),
  endereco: text("endereco"),
  numero: text("numero"),
  complemento: text("complemento"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  estado: varchar("estado", { length: 2 }),
  telefone: text("telefone"),
  email: text("email"),
  inscricaoEstadual: text("inscricao_estadual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
