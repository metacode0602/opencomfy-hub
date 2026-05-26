ALTER TABLE "consumption_usage_daily" ADD COLUMN "usage_month" varchar(7);--> statement-breakpoint
ALTER TABLE "consumption_usage_daily" ADD COLUMN "total_card_hours" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "consumption_usage_daily" ADD COLUMN "balance_card_hours" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "consumption_usage_daily" ADD COLUMN "voucher_card_hours" numeric(15, 4) DEFAULT '0';--> statement-breakpoint
UPDATE "consumption_usage_daily" SET "usage_month" = to_char("usage_date", 'YYYY-MM') WHERE "usage_month" IS NULL;--> statement-breakpoint
ALTER TABLE "consumption_usage_daily" ALTER COLUMN "usage_month" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "consumption_usage_daily_tenant_date_pl_uk" ON "consumption_usage_daily" USING btree ("tenant_id","usage_date","product_line");--> statement-breakpoint
CREATE INDEX "consumption_usage_daily_tenant_month_pl_idx" ON "consumption_usage_daily" USING btree ("tenant_id","usage_month","product_line");--> statement-breakpoint
CREATE TABLE "tenant_consumption_daily_detail" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"tenant_id" text NOT NULL,
	"usage_date" date NOT NULL,
	"usage_month" varchar(7) NOT NULL,
	"product_line" varchar(64) NOT NULL,
	"data_center_id" text,
	"data_center_code" varchar(64) NOT NULL,
	"data_center_name" varchar(255) NOT NULL,
	"gpu_card_type_id" text,
	"gpu_card_type_code" varchar(64) NOT NULL,
	"gpu_card_type_name" varchar(128),
	"platform_task_id" varchar(64),
	"task_name" varchar(255),
	"total_amount" numeric(15, 4) NOT NULL,
	"voucher_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"total_card_hours" numeric(15, 4),
	"voucher_card_hours" numeric(15, 4) DEFAULT '0',
	"balance_card_hours" numeric(15, 4),
	"source" varchar(32) DEFAULT 'platform_sync' NOT NULL,
	"platform_idempotency_key" varchar(256) NOT NULL,
	"raw_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_consumption_daily_detail" ADD CONSTRAINT "tenant_consumption_daily_detail_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_consumption_daily_detail" ADD CONSTRAINT "tenant_consumption_daily_detail_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_consumption_daily_detail_idempotency_uk" ON "tenant_consumption_daily_detail" USING btree ("platform_idempotency_key");--> statement-breakpoint
CREATE INDEX "tenant_consumption_daily_detail_tenant_date_pl_idx" ON "tenant_consumption_daily_detail" USING btree ("tenant_id","usage_date","product_line");--> statement-breakpoint
CREATE INDEX "tenant_consumption_daily_detail_tenant_month_pl_idx" ON "tenant_consumption_daily_detail" USING btree ("tenant_id","usage_month","product_line");
