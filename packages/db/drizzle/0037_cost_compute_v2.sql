ALTER TABLE "platform_cost_monthly" ADD COLUMN IF NOT EXISTS "staff_name" varchar(128);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_period_cost_enrichment" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"tenant_platform_id" varchar(128) NOT NULL,
	"tenant_id" text NOT NULL,
	"customer_id" text,
	"customer_full_name" varchar(255),
	"project_id" text NOT NULL,
	"project_name" varchar(255) NOT NULL,
	"staff_id" text,
	"account_manager_name" varchar(128),
	"allocation_percent" numeric(7, 4),
	"source" varchar(32) NOT NULL,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_period_cost_baremetal_agg" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"tenant_platform_id" varchar(128) NOT NULL,
	"idc_code" varchar(64) NOT NULL,
	"idc_name" varchar(255),
	"card_type" varchar(128) NOT NULL,
	"device_qty_total" integer DEFAULT 0 NOT NULL,
	"card_count_per_device" integer DEFAULT 0 NOT NULL,
	"total_gpu_cards" integer DEFAULT 0 NOT NULL,
	"package_qty_total" numeric(15, 4),
	"billing_unit" varchar(16),
	"package_breakdown" jsonb,
	"balance_card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"source_order_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_period_cost_detail" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"tenant_platform_id" varchar(128) NOT NULL,
	"tenant_id" text,
	"customer_id" text,
	"customer_full_name" varchar(255),
	"project_id" text,
	"project_name" varchar(255),
	"staff_id" text NOT NULL,
	"account_manager_name" varchar(128),
	"window_id" text,
	"idc_code" varchar(64) NOT NULL,
	"idc_name" varchar(255),
	"card_type" varchar(128) NOT NULL,
	"balance_consumption" numeric(15, 4),
	"balance_card_hours" numeric(15, 4),
	"voucher_card_hours" numeric(15, 4),
	"supplier_unit_cost_id" text,
	"deal_unit_price_per_hour" numeric(15, 4),
	"list_price_per_hour" numeric(15, 4),
	"confirmed_revenue_excl_tax" numeric(15, 4),
	"sold_duration_cost_excl_tax" numeric(15, 4),
	"gifted_duration_cost_excl_tax" numeric(15, 4),
	"gross_profit" numeric(15, 4),
	"allocation_percent" numeric(7, 4),
	"source_tenant_bill_raw_ids" jsonb,
	"source_baremetal_agg_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "billing_period_cost_enrichment" ADD CONSTRAINT "billing_period_cost_enrichment_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_enrichment" ADD CONSTRAINT "billing_period_cost_enrichment_tenant_id_billing_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."billing_tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_enrichment" ADD CONSTRAINT "billing_period_cost_enrichment_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_enrichment" ADD CONSTRAINT "billing_period_cost_enrichment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_enrichment" ADD CONSTRAINT "billing_period_cost_enrichment_staff_id_user_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_baremetal_agg" ADD CONSTRAINT "billing_period_cost_baremetal_agg_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_detail" ADD CONSTRAINT "billing_period_cost_detail_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_detail" ADD CONSTRAINT "billing_period_cost_detail_tenant_id_billing_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."billing_tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_detail" ADD CONSTRAINT "billing_period_cost_detail_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_detail" ADD CONSTRAINT "billing_period_cost_detail_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_detail" ADD CONSTRAINT "billing_period_cost_detail_staff_id_user_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."user_staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_detail" ADD CONSTRAINT "billing_period_cost_detail_window_id_billing_period_tenant_bill_window_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."billing_period_tenant_bill_window"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_detail" ADD CONSTRAINT "billing_period_cost_detail_supplier_unit_cost_id_supplier_unit_cost_id_fk" FOREIGN KEY ("supplier_unit_cost_id") REFERENCES "public"."supplier_unit_cost"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_period_cost_enrichment_uk" ON "billing_period_cost_enrichment" USING btree ("billing_period_id","tenant_platform_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_period_cost_enrichment_period_id_idx" ON "billing_period_cost_enrichment" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_period_cost_baremetal_agg_uk" ON "billing_period_cost_baremetal_agg" USING btree ("billing_period_id","tenant_platform_id","idc_code","card_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_period_cost_baremetal_agg_period_id_idx" ON "billing_period_cost_baremetal_agg" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_period_cost_detail_uk" ON "billing_period_cost_detail" USING btree ("billing_period_id","staff_id","project_id","idc_code","card_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_period_cost_detail_period_id_idx" ON "billing_period_cost_detail" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_cost_monthly_period_staff_idc_card_uk" ON "platform_cost_monthly" USING btree ("billing_period_id","staff_id","idc_code","card_type");
