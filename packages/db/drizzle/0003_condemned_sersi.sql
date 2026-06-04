CREATE TABLE "platform_tenant_blacklist" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_blacklist_id" integer NOT NULL,
	"blacklist_type" varchar(32) NOT NULL,
	"platform_tenant_id" varchar(128) NOT NULL,
	"status" varchar(16) NOT NULL,
	"platform_tenant_name" varchar(255),
	"remark" text,
	"merchant_id" integer,
	"platform_created_at" timestamp with time zone,
	"platform_updated_at" timestamp with time zone,
	"local_tenant_id" text,
	"last_synced_at" timestamp with time zone NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_blacklist_sync_job_run" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger" varchar(32) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(32) NOT NULL,
	"data_start_time" text DEFAULT '' NOT NULL,
	"data_end_time" text NOT NULL,
	"safety_days" integer NOT NULL,
	"full_sync" boolean DEFAULT false NOT NULL,
	"platform_count" integer DEFAULT 0 NOT NULL,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"upserted_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "tenant_blacklist_sync_state" (
	"id" text PRIMARY KEY NOT NULL,
	"last_pull_end_date" date,
	"default_safety_days" integer DEFAULT 2 NOT NULL,
	"last_job_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
ALTER TABLE "tenant" ADD COLUMN "internal_effective_from" date;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "internal_effective_to" date;--> statement-breakpoint
ALTER TABLE "platform_tenant_blacklist" ADD CONSTRAINT "platform_tenant_blacklist_local_tenant_id_tenant_id_fk" FOREIGN KEY ("local_tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_personal_income_summary" ADD CONSTRAINT "billing_period_personal_income_summary_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_personal_income_summary" ADD CONSTRAINT "billing_period_personal_income_summary_tenant_bill_batch_id_billing_period_import_batch_id_fk" FOREIGN KEY ("tenant_bill_batch_id") REFERENCES "public"."billing_period_import_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_personal_income_summary" ADD CONSTRAINT "billing_period_personal_income_summary_baremetal_batch_id_billing_period_import_batch_id_fk" FOREIGN KEY ("baremetal_batch_id") REFERENCES "public"."billing_period_import_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_tenant_blacklist_platform_id_uk" ON "platform_tenant_blacklist" USING btree ("platform_blacklist_id");--> statement-breakpoint
CREATE INDEX "platform_tenant_blacklist_platform_tenant_id_idx" ON "platform_tenant_blacklist" USING btree ("platform_tenant_id");--> statement-breakpoint
CREATE INDEX "platform_tenant_blacklist_status_idx" ON "platform_tenant_blacklist" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_tenant_blacklist_removed_at_idx" ON "platform_tenant_blacklist" USING btree ("removed_at");--> statement-breakpoint
CREATE INDEX "platform_tenant_blacklist_platform_updated_at_idx" ON "platform_tenant_blacklist" USING btree ("platform_updated_at");--> statement-breakpoint
CREATE INDEX "tenant_blacklist_sync_job_run_started_at_idx" ON "tenant_blacklist_sync_job_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "tenant_blacklist_sync_job_run_status_idx" ON "tenant_blacklist_sync_job_run" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_personal_income_summary_period_kind_uk" ON "billing_period_personal_income_summary" USING btree ("billing_period_id","summary_kind");--> statement-breakpoint
CREATE INDEX "billing_period_personal_income_summary_period_id_idx" ON "billing_period_personal_income_summary" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_personal_tenant_bill_uk" ON "billing_period_import_batch" USING btree ("billing_period_id") WHERE "billing_period_import_batch"."file_type" = 'personal_tenant_bill';--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_personal_baremetal_uk" ON "billing_period_import_batch" USING btree ("billing_period_id") WHERE "billing_period_import_batch"."file_type" = 'personal_baremetal_order';