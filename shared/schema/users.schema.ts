import { sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const b2bUsers = pgTable("b2b_users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  email: text("email").unique().notNull(),
  senhaHash: text("senha_hash"),
  telefone: text("telefone"),
  ativo: boolean("ativo").notNull().default(true),
  role: text("role").default("customer"),

  // === DADOS DO CLIENTE ===
  razaoSocial: text("razao_social"),
  nomeFantasia: text("nome_fantasia"),
  cnpj: varchar("cnpj", { length: 20 }),
  cpf: varchar("cpf", { length: 20 }),

  // Inscrição Estadual e Novo campo de Regime
  inscricaoEstadual: varchar("inscricao_estadual", { length: 50 }),
  regimeTributario: varchar("regime_tributario", { length: 50 }).default("1"), // 1: Simples, 2: Presumido, 3: Real

  tipoPessoa: varchar("tipo_pessoa", { length: 20 }).default("juridica"),

  // Endereço
  cep: varchar("cep", { length: 10 }),
  endereco: text("endereco"),
  numero: varchar("numero", { length: 20 }),
  complemento: text("complemento"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  estado: varchar("estado", { length: 2 }),

  // Regras de Negócio
  customerType: varchar("customer_type", { length: 20 }).default("varejo"),
  approved: boolean("approved").default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertB2bUserSchema = createInsertSchema(b2bUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertB2bUser = z.infer<typeof insertB2bUserSchema>;
export type B2bUser = typeof b2bUsers.$inferSelect;
