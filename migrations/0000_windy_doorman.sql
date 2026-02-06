CREATE TYPE "public"."approval_status" AS ENUM('PENDENTE', 'APROVADO', 'REJEITADO', 'BLOQUEADO');--> statement-breakpoint
CREATE TYPE "public"."order_channel" AS ENUM('SITE', 'ADMIN', 'REPRESENTANTE', 'API');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('ORCAMENTO', 'GERADO', 'FATURADO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('ATIVO', 'INATIVO', 'RASCUNHO');--> statement-breakpoint
CREATE TYPE "public"."tipo_cliente" AS ENUM('VAREJO', 'ATACADO', 'DISTRIBUIDOR');--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"product_id" integer,
	"quantity" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"description_snapshot" text,
	"sku_snapshot" text,
	"line_total" numeric
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar,
	"user_id" varchar,
	"order_number" text,
	"status" text DEFAULT 'ORCAMENTO',
	"stage" text,
	"subtotal" numeric,
	"shipping_cost" numeric,
	"total" numeric(10, 2),
	"is_guest_order" boolean,
	"guest_name" text,
	"guest_cpf" text,
	"guest_email" text,
	"guest_phone" text,
	"shipping_address" text,
	"shipping_method" text,
	"payment_method" text,
	"payment_type_id" integer,
	"payment_term_id" integer,
	"payment_notes" text,
	"notes" text,
	"printed" boolean,
	"printed_at" timestamp,
	"printed_by" text,
	"reserved_at" timestamp,
	"reserved_by" text,
	"invoiced_at" timestamp,
	"invoiced_by" text,
	"bling_order_id" text,
	"fiado_installments" integer,
	"accounts_posted" boolean DEFAULT false,
	"accounts_posted_at" timestamp,
	"accounts_posted_by" text,
	"accounts_reversed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"category_id" integer,
	"supplier_id" integer,
	"brand" text,
	"description" text,
	"unit" text DEFAULT 'UN',
	"price" numeric(10, 2) NOT NULL,
	"cost" numeric(10, 2),
	"stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer,
	"max_stock" integer,
	"reserved_stock" integer DEFAULT 0,
	"image" text,
	"images" text[],
	"featured" boolean DEFAULT false,
	"status" text DEFAULT 'ATIVO',
	"format" text DEFAULT 'simple',
	"variations_config" jsonb,
	"weight" numeric(10, 3),
	"gross_weight" numeric(10, 3),
	"width" numeric(10, 2),
	"height" numeric(10, 2),
	"depth" numeric(10, 2),
	"ncm" text,
	"cest" text,
	"origem" text,
	"tax_origin" text,
	"gtin" text,
	"gtin_tributario" text,
	"tipo_item" text,
	"percentual_tributos" numeric,
	"icms_cst" text,
	"icms_aliquota" numeric,
	"ipi_cst" text,
	"ipi_aliquota" numeric,
	"pis_cst" text,
	"pis_aliquota" numeric,
	"cofins_cst" text,
	"cofins_aliquota" numeric,
	"valor_base_icms_st_retencao" numeric,
	"valor_icms_st_retencao" numeric,
	"valor_icms_proprio_substituto" numeric,
	"codigo_excecao_tipi" text,
	"valor_pis_fixo" numeric,
	"valor_cofins_fixo" numeric,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar,
	"email" text,
	"password" text,
	"first_name" text,
	"last_name" text,
	"profile_image_url" text,
	"role" text DEFAULT 'customer',
	"allowed_brands" text[],
	"customer_type" text,
	"company" text,
	"approved" boolean DEFAULT false,
	"phone" text,
	"person_type" text,
	"cnpj" text,
	"cpf" text,
	"trading_name" text,
	"state_registration" text,
	"cep" text,
	"address" text,
	"address_number" text,
	"complement" text,
	"neighborhood" text,
	"city" text,
	"state" text,
	"tag" text,
	"instagram" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "bling_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar,
	"client_id" text,
	"client_secret" text,
	"code" text,
	"redirect_uri" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "bling_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar,
	"access_token" text,
	"refresh_token" text,
	"expires_at" integer,
	"token_type" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar,
	"name" text NOT NULL,
	"slug" text,
	"parent_id" integer,
	"hide_from_varejo" boolean,
	"bling_id" integer
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"razao_social" text,
	"fantasy_name" text,
	"nome_fantasia" text,
	"cnpj" text,
	"email" text,
	"phone" text,
	"telefone" text,
	"address" text,
	"cep" text,
	"endereco" text,
	"numero" text,
	"complemento" text,
	"bairro" text,
	"cidade" text,
	"estado" text,
	"inscricao_estadual" text,
	"tipo_cliente" "tipo_cliente" DEFAULT 'VAREJO',
	"approval_status" "approval_status" DEFAULT 'APROVADO',
	"active" boolean DEFAULT true,
	"ativo" boolean DEFAULT true,
	"slug" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text,
	"label" text,
	"description" text,
	"icon" text,
	"default_roles" text,
	"sort_order" integer
);
--> statement-breakpoint
CREATE TABLE "order_item_discounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_item_id" integer,
	"value" numeric(10, 2),
	"tipo" text,
	"status" text DEFAULT 'PENDENTE',
	"solicitado_por_user_id" varchar,
	"approved_by_user_id" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payable_installments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payable_id" integer NOT NULL,
	"installment_number" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0',
	"amount_remaining" numeric(12, 2) NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'ABERTA',
	"is_overdue" boolean DEFAULT false,
	"applied_interest" numeric(12, 2) DEFAULT '0',
	"applied_fine" numeric(12, 2) DEFAULT '0',
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payable_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar NOT NULL,
	"payable_id" integer NOT NULL,
	"installment_id" integer,
	"payment_number" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" text,
	"reference" text,
	"payment_date" text NOT NULL,
	"paid_at" timestamp DEFAULT now(),
	"notes" text,
	"paid_by" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payable_payments_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE "payables" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar NOT NULL,
	"payable_number" text NOT NULL,
	"description" text,
	"purchase_order_id" integer,
	"supplier_id" integer NOT NULL,
	"payment_type_id" integer,
	"payment_term_id" integer,
	"amount" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0',
	"amount_remaining" numeric(12, 2) NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'ABERTA',
	"is_overdue" boolean DEFAULT false,
	"paid_at" timestamp,
	"cancelled_at" timestamp,
	"cancelled_reason" text,
	"cancelled_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payables_payable_number_unique" UNIQUE("payable_number")
);
--> statement-breakpoint
CREATE TABLE "payment_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"installment_count" integer DEFAULT 1,
	"interval_days" integer DEFAULT 0,
	"first_payment_days" integer DEFAULT 0,
	"interest_monthly" numeric(5, 2) DEFAULT '0',
	"fine_percent" numeric(5, 2) DEFAULT '0',
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar,
	"name" text NOT NULL,
	"type" text,
	"description" text,
	"active" boolean DEFAULT true,
	"is_integration" boolean,
	"integration_id" integer,
	"sort_order" integer,
	"fee_type" text,
	"fee_value" numeric,
	"compensation_days" integer,
	"is_store_credit" boolean,
	"payment_term_type" text DEFAULT 'VISTA',
	"payment_term_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_order_id" integer,
	"product_id" integer,
	"quantity" numeric,
	"qty" numeric,
	"unit_cost" numeric,
	"line_total" numeric,
	"description_snapshot" text,
	"sku_snapshot" text
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar,
	"supplier_id" integer,
	"number" text,
	"status" text,
	"notes" text,
	"total_value" numeric,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"finalized_at" timestamp,
	"posted_at" timestamp,
	"reversed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "receivable_installments" (
	"id" serial PRIMARY KEY NOT NULL,
	"receivable_id" integer NOT NULL,
	"installment_number" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0',
	"amount_remaining" numeric(12, 2) NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'ABERTA',
	"is_overdue" boolean DEFAULT false,
	"applied_interest" numeric(12, 2) DEFAULT '0',
	"applied_fine" numeric(12, 2) DEFAULT '0',
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "receivable_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar NOT NULL,
	"receivable_id" integer NOT NULL,
	"installment_id" integer,
	"payment_number" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" text,
	"reference" text,
	"payment_date" text NOT NULL,
	"received_at" timestamp DEFAULT now(),
	"notes" text,
	"received_by" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "receivable_payments_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE "receivables" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar NOT NULL,
	"receivable_number" text NOT NULL,
	"description" text,
	"order_id" integer,
	"customer_id" varchar NOT NULL,
	"payment_type_id" integer,
	"payment_term_id" integer,
	"amount" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0',
	"amount_remaining" numeric(12, 2) NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'ABERTA',
	"is_overdue" boolean DEFAULT false,
	"paid_at" timestamp,
	"cancelled_at" timestamp,
	"cancelled_reason" text,
	"cancelled_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "receivables_receivable_number_unique" UNIQUE("receivable_number")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"type" text,
	"quantity" numeric,
	"qty" numeric,
	"reason" text,
	"unit_cost" numeric,
	"ref_type" text,
	"ref_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar,
	"name" text NOT NULL,
	"trading_name" text,
	"cnpj" text,
	"email" text,
	"phone" text,
	"contact" text,
	"active" boolean DEFAULT true,
	"cep" text,
	"address" text,
	"address_number" text,
	"complement" text,
	"neighborhood" text,
	"city" text,
	"state" text,
	"notes" text,
	"payment_terms" text,
	"min_order_value" numeric,
	"lead_time" integer,
	"bank_info" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_discounts" ADD CONSTRAINT "order_item_discounts_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;