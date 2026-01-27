import {
  decimal,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const unidadeMedidaEnum = pgEnum("unidade_medida", [
  "UN",
  "CX",
  "KG",
  "MT",
  "PC",
  "LT",
]);
export const productStatusEnum = pgEnum("product_status", [
  "ATIVO",
  "INATIVO",
  "DESCONTINUADO",
]);
export const disponibilidadeEnum = pgEnum("disponibilidade", [
  "DISPONIVEL",
  "INDISPONIVEL",
  "SOB_CONSULTA",
]);

export const b2bProducts = pgTable("b2b_products", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  sku: varchar("sku", { length: 50 }).unique().notNull(),
  unidadeMedida: unidadeMedidaEnum("unidade_medida").notNull().default("UN"),
  precoVarejo: decimal("preco_varejo", { precision: 10, scale: 2 }).notNull(),
  precoAtacado: decimal("preco_atacado", { precision: 10, scale: 2 }).notNull(),

  // ADICIONADO: Coluna de estoque que criamos no banco
  estoque: integer("estoque").default(0),

  status: productStatusEnum("status").notNull().default("ATIVO"),
  disponibilidade: disponibilidadeEnum("disponibilidade")
    .notNull()
    .default("DISPONIVEL"),
  descricao: text("descricao"),
  imagem: text("imagem"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertB2bProductSchema = createInsertSchema(b2bProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertB2bProduct = z.infer<typeof insertB2bProductSchema>;
export type B2bProduct = typeof b2bProducts.$inferSelect;
