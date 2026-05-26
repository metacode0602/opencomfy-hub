CREATE TABLE "billing_sync_job_item" (
	"id" text PRIMARY KEY NOT NULL,
	"job_run_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" varchar(32) NOT NULL,
	"summary" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "billing_sync_job_run" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger" varchar(32) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(32) NOT NULL,
	"sync_end_date" date NOT NULL,
	"safety_days" integer NOT NULL,
	"project_count" integer DEFAULT 0 NOT NULL,
	"tenant_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text
);
--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "billing_sync_cursor_end_date" date;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "billing_sync_last_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "billing_sync_last_finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "billing_sync_last_status" varchar(32);--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "billing_sync_last_error" text;--> statement-breakpoint
ALTER TABLE "billing_sync_job_item" ADD CONSTRAINT "billing_sync_job_item_job_run_id_billing_sync_job_run_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."billing_sync_job_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_sync_job_item" ADD CONSTRAINT "billing_sync_job_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_sync_job_item" ADD CONSTRAINT "billing_sync_job_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_sync_job_item_job_run_id_idx" ON "billing_sync_job_item" USING btree ("job_run_id");--> statement-breakpoint
CREATE INDEX "billing_sync_job_item_tenant_id_idx" ON "billing_sync_job_item" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_sync_job_run_started_at_idx" ON "billing_sync_job_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "billing_sync_job_run_status_idx" ON "billing_sync_job_run" USING btree ("status");