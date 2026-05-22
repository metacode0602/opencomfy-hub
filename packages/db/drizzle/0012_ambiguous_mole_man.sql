DROP INDEX "tenant_bill_project_month_uk";--> statement-breakpoint
ALTER TABLE "recharge" ADD COLUMN "remark" text;--> statement-breakpoint
ALTER TABLE "tenant_bill" ADD COLUMN "platform_period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant_bill" ADD COLUMN "platform_period_end" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_bill_tenant_month_uk" ON "tenant_bill" USING btree ("tenant_id","bill_month");