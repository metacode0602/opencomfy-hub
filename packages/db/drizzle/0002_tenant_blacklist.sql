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
CREATE TABLE "tenant_blacklist_sync_state" (
	"id" text PRIMARY KEY NOT NULL,
	"last_pull_end_date" date,
	"default_safety_days" integer DEFAULT 2 NOT NULL,
	"last_job_id" text,
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
ALTER TABLE "platform_tenant_blacklist" ADD CONSTRAINT "platform_tenant_blacklist_local_tenant_id_billing_tenant_id_fk" FOREIGN KEY ("local_tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_tenant_blacklist_platform_id_uk" ON "platform_tenant_blacklist" USING btree ("platform_blacklist_id");
--> statement-breakpoint
CREATE INDEX "platform_tenant_blacklist_platform_tenant_id_idx" ON "platform_tenant_blacklist" USING btree ("platform_tenant_id");
--> statement-breakpoint
CREATE INDEX "platform_tenant_blacklist_status_idx" ON "platform_tenant_blacklist" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "platform_tenant_blacklist_removed_at_idx" ON "platform_tenant_blacklist" USING btree ("removed_at");
--> statement-breakpoint
CREATE INDEX "platform_tenant_blacklist_platform_updated_at_idx" ON "platform_tenant_blacklist" USING btree ("platform_updated_at");
--> statement-breakpoint
CREATE INDEX "tenant_blacklist_sync_job_run_started_at_idx" ON "tenant_blacklist_sync_job_run" USING btree ("started_at");
--> statement-breakpoint
CREATE INDEX "tenant_blacklist_sync_job_run_status_idx" ON "tenant_blacklist_sync_job_run" USING btree ("status");
--> statement-breakpoint
INSERT INTO "tenant_blacklist_sync_state" ("id", "default_safety_days") VALUES ('default', 2) ON CONFLICT DO NOTHING;
