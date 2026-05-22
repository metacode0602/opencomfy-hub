ALTER TABLE "tenant_bill" ADD COLUMN IF NOT EXISTS "platform_period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant_bill" ADD COLUMN IF NOT EXISTS "platform_period_end" timestamp with time zone;--> statement-breakpoint
DROP INDEX IF EXISTS "tenant_bill_project_month_uk";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_bill_tenant_month_uk" ON "tenant_bill" USING btree ("tenant_id","bill_month");
