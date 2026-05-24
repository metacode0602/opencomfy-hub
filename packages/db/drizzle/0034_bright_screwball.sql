CREATE TABLE "billing_period_tenant_bill_window" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "billing_period_import_batch_period_file_type_uk";--> statement-breakpoint
ALTER TABLE "billing_period_import_batch" ADD COLUMN "window_id" text;--> statement-breakpoint
ALTER TABLE "billing_period_tenant_bill_window" ADD CONSTRAINT "billing_period_tenant_bill_window_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_tenant_bill_window_uk" ON "billing_period_tenant_bill_window" USING btree ("billing_period_id","window_start","window_end");--> statement-breakpoint
CREATE INDEX "billing_period_tenant_bill_window_period_id_idx" ON "billing_period_tenant_bill_window" USING btree ("billing_period_id");--> statement-breakpoint
ALTER TABLE "billing_period_import_batch" ADD CONSTRAINT "billing_period_import_batch_window_id_billing_period_tenant_bill_window_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."billing_period_tenant_bill_window"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_customer_uk" ON "billing_period_import_batch" USING btree ("billing_period_id") WHERE "billing_period_import_batch"."file_type" = 'customer_consumption';--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_baremetal_uk" ON "billing_period_import_batch" USING btree ("billing_period_id") WHERE "billing_period_import_batch"."file_type" = 'baremetal_order';--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_tenant_window_uk" ON "billing_period_import_batch" USING btree ("billing_period_id","window_id") WHERE "billing_period_import_batch"."file_type" = 'tenant_bill';--> statement-breakpoint
CREATE INDEX "billing_period_import_batch_window_id_idx" ON "billing_period_import_batch" USING btree ("window_id");