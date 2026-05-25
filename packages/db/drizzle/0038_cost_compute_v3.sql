DROP TABLE IF EXISTS "billing_period_cost_detail" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "billing_period_cost_baremetal_agg" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "billing_period_cost_enrichment" CASCADE;--> statement-breakpoint
DROP INDEX IF EXISTS "platform_cost_monthly_period_staff_idc_card_uk";--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" DROP COLUMN IF EXISTS "project_id";--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" DROP COLUMN IF EXISTS "allocation_percent";--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" DROP COLUMN IF EXISTS "source_raw_ids";--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ALTER COLUMN "staff_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ALTER COLUMN "account_manager" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD COLUMN IF NOT EXISTS "data_center_id" text;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD COLUMN IF NOT EXISTS "gpu_card_type_id" text;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD COLUMN IF NOT EXISTS "total_consumption" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD COLUMN IF NOT EXISTS "voucher_consumption" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD COLUMN IF NOT EXISTS "total_card_hours" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD COLUMN IF NOT EXISTS "pricing_snapshot_id" text;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD COLUMN IF NOT EXISTS "source_line_ids" jsonb;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_period_cost_source_line" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"kind" varchar(16) NOT NULL,
	"source_raw_id" text NOT NULL,
	"tenant_id" text,
	"tenant_platform_id" varchar(128) NOT NULL,
	"project_id" text,
	"staff_id" text,
	"staff_name" varchar(128),
	"data_center_id" text NOT NULL,
	"data_center_name" varchar(255),
	"gpu_card_type_id" text NOT NULL,
	"gpu_card_type_name" varchar(128),
	"total_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"voucher_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"total_card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"voucher_card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance_card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"supplier_unit_cost_id" text,
	"window_id" text,
	"source_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_period_cost_pricing_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"window_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"gpu_card_type_name" varchar(128),
	"data_center_id" text NOT NULL,
	"data_center_name" varchar(255),
	"supplier_unit_cost_id" text NOT NULL,
	"pricing_mode" varchar(32) NOT NULL,
	"list_price_per_hour" numeric(15, 4),
	"deal_unit_price_per_hour" numeric(15, 4),
	"revenue_share_percent" numeric(7, 4),
	"pricing_tiers" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD CONSTRAINT "platform_cost_monthly_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD CONSTRAINT "platform_cost_monthly_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD CONSTRAINT "platform_cost_monthly_pricing_snapshot_id_billing_period_cost_pricing_snapshot_id_fk" FOREIGN KEY ("pricing_snapshot_id") REFERENCES "public"."billing_period_cost_pricing_snapshot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_tenant_id_billing_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."billing_tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_staff_id_user_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_supplier_unit_cost_id_supplier_unit_cost_id_fk" FOREIGN KEY ("supplier_unit_cost_id") REFERENCES "public"."supplier_unit_cost"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_window_id_billing_period_tenant_bill_window_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."billing_period_tenant_bill_window"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD CONSTRAINT "billing_period_cost_pricing_snapshot_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD CONSTRAINT "billing_period_cost_pricing_snapshot_window_id_billing_period_tenant_bill_window_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."billing_period_tenant_bill_window"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD CONSTRAINT "billing_period_cost_pricing_snapshot_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD CONSTRAINT "billing_period_cost_pricing_snapshot_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD CONSTRAINT "billing_period_cost_pricing_snapshot_supplier_unit_cost_id_supplier_unit_cost_id_fk" FOREIGN KEY ("supplier_unit_cost_id") REFERENCES "public"."supplier_unit_cost"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_period_cost_source_line_uk" ON "billing_period_cost_source_line" USING btree ("billing_period_id","kind","source_raw_id","staff_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_period_cost_source_line_period_id_idx" ON "billing_period_cost_source_line" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_period_cost_pricing_snapshot_uk" ON "billing_period_cost_pricing_snapshot" USING btree ("billing_period_id","window_id","data_center_id","gpu_card_type_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_period_cost_pricing_snapshot_period_id_idx" ON "billing_period_cost_pricing_snapshot" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_cost_monthly_record_uk" ON "platform_cost_monthly" USING btree ("billing_period_id","staff_id","data_center_id","gpu_card_type_id") WHERE "platform_cost_monthly"."type" = 'record';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_cost_monthly_sum_uk" ON "platform_cost_monthly" USING btree ("billing_period_id") WHERE "platform_cost_monthly"."type" = 'sum';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_cost_monthly_data_center_id_idx" ON "platform_cost_monthly" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_cost_monthly_gpu_card_type_id_idx" ON "platform_cost_monthly" USING btree ("gpu_card_type_id");
