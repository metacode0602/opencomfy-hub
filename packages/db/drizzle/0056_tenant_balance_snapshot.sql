ALTER TABLE "consumption_usage_daily" DROP COLUMN IF EXISTS "balance";--> statement-breakpoint
CREATE TABLE "balance_snapshot_job_run" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger" varchar(32) NOT NULL,
	"granularity" varchar(8) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(32) NOT NULL,
	"tenant_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "balance_snapshot_job_item" (
	"id" text PRIMARY KEY NOT NULL,
	"job_run_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"status" varchar(32) NOT NULL,
	"granularity" varchar(8) NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "tenant_balance_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"customer_id" text,
	"granularity" varchar(8) NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"bucket_date" date NOT NULL,
	"balance" numeric(20, 4) NOT NULL,
	"credit_limit" numeric(20, 4),
	"source" varchar(32) DEFAULT 'platform_sync' NOT NULL,
	"platform_tenant_id" varchar(128),
	"platform_coin_raw" numeric(20, 4),
	"captured_at" timestamp with time zone NOT NULL,
	"job_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balance_snapshot_job_item" ADD CONSTRAINT "balance_snapshot_job_item_job_run_id_balance_snapshot_job_run_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."balance_snapshot_job_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_snapshot_job_item" ADD CONSTRAINT "balance_snapshot_job_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_balance_snapshot" ADD CONSTRAINT "tenant_balance_snapshot_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_balance_snapshot" ADD CONSTRAINT "tenant_balance_snapshot_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_balance_snapshot" ADD CONSTRAINT "tenant_balance_snapshot_job_run_id_balance_snapshot_job_run_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."balance_snapshot_job_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balance_snapshot_job_run_started_at_idx" ON "balance_snapshot_job_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "balance_snapshot_job_run_status_idx" ON "balance_snapshot_job_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "balance_snapshot_job_item_job_run_id_idx" ON "balance_snapshot_job_item" USING btree ("job_run_id");--> statement-breakpoint
CREATE INDEX "balance_snapshot_job_item_tenant_id_idx" ON "balance_snapshot_job_item" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_balance_snapshot_uk" ON "tenant_balance_snapshot" USING btree ("tenant_id","granularity","bucket_start");--> statement-breakpoint
CREATE INDEX "tenant_balance_snapshot_tenant_date_idx" ON "tenant_balance_snapshot" USING btree ("tenant_id","bucket_date");--> statement-breakpoint
CREATE INDEX "tenant_balance_snapshot_granularity_date_idx" ON "tenant_balance_snapshot" USING btree ("granularity","bucket_date");
