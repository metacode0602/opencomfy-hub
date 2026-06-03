CREATE TABLE "billing_period_personal_income_summary" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"summary_kind" varchar(32) NOT NULL,
	"balance_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"bare_metal_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"total_consumption" numeric(15, 4) NOT NULL,
	"matched_tenant_count" integer DEFAULT 0 NOT NULL,
	"tenant_bill_batch_id" text,
	"baremetal_batch_id" text,
	"rule_version" varchar(32),
	"last_computed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_period_personal_income_summary" ADD CONSTRAINT "billing_period_personal_income_summary_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_period_personal_income_summary" ADD CONSTRAINT "billing_period_personal_income_summary_tenant_bill_batch_id_billing_period_import_batch_id_fk" FOREIGN KEY ("tenant_bill_batch_id") REFERENCES "public"."billing_period_import_batch"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_period_personal_income_summary" ADD CONSTRAINT "billing_period_personal_income_summary_baremetal_batch_id_billing_period_import_batch_id_fk" FOREIGN KEY ("baremetal_batch_id") REFERENCES "public"."billing_period_import_batch"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_personal_income_summary_period_kind_uk" ON "billing_period_personal_income_summary" USING btree ("billing_period_id","summary_kind");
--> statement-breakpoint
CREATE INDEX "billing_period_personal_income_summary_period_id_idx" ON "billing_period_personal_income_summary" USING btree ("billing_period_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_personal_tenant_bill_uk" ON "billing_period_import_batch" USING btree ("billing_period_id") WHERE "file_type" = 'personal_tenant_bill';
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_personal_baremetal_uk" ON "billing_period_import_batch" USING btree ("billing_period_id") WHERE "file_type" = 'personal_baremetal_order';
