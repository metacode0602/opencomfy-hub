DROP INDEX "platform_income_monthly_period_tenant_type_uk";--> statement-breakpoint
DROP INDEX "billing_period_agg_customer_consumption_uk";--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD COLUMN "tenant_id" text;--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD COLUMN "customer_id" text;--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD COLUMN "customer_full_name" varchar(255);--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD COLUMN "project_name" varchar(255);--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD COLUMN "allocation_percent" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "platform_income_monthly" ADD COLUMN "customer_id" text;--> statement-breakpoint
ALTER TABLE "platform_income_monthly" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD CONSTRAINT "billing_period_agg_customer_consumption_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD CONSTRAINT "billing_period_agg_customer_consumption_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD CONSTRAINT "billing_period_agg_customer_consumption_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_income_monthly" ADD CONSTRAINT "platform_income_monthly_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_income_monthly" ADD CONSTRAINT "platform_income_monthly_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_income_monthly_period_tenant_project_uk" ON "platform_income_monthly" USING btree ("billing_period_id","tenant_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_agg_customer_consumption_uk" ON "billing_period_agg_customer_consumption" USING btree ("billing_period_id","tenant_platform_id","project_id");