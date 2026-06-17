CREATE TABLE "feishu_bitable_sync_config" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"sync_kind" varchar(32) NOT NULL,
	"app_token" varchar(128) NOT NULL,
	"table_id" varchar(128) NOT NULL,
	"view_id" varchar(128),
	"field_mapping_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"filter_formula" text,
	"cron_expr" varchar(64) DEFAULT '15 * * * *' NOT NULL,
	"auto_commit" boolean DEFAULT false NOT NULL,
	"cursor_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feishu_external_link" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" varchar(64) NOT NULL,
	"ref_id" text NOT NULL,
	"external_type" varchar(64) NOT NULL,
	"external_id" varchar(128) NOT NULL,
	"external_code" varchar(128),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feishu_integration_config" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" varchar(64) NOT NULL,
	"app_secret_enc" text NOT NULL,
	"encrypt_key" varchar(255),
	"verification_token" varchar(255),
	"webhook_secret" varchar(128),
	"default_approval_codes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"webhook_policy_json" jsonb DEFAULT '{"auto_complete_on_approval":true,"auto_create_enabled":true}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feishu_integration_job_run" (
	"id" text PRIMARY KEY NOT NULL,
	"job_kind" varchar(32) NOT NULL,
	"status" varchar(16) NOT NULL,
	"supplier_id" text,
	"ref_domain" varchar(64),
	"ref_id" text,
	"request_summary" jsonb,
	"response_summary" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "feishu_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" varchar(256) NOT NULL,
	"instance_id" varchar(128),
	"event_type" varchar(64),
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feishu_work_order_bitable_config" (
	"id" text PRIMARY KEY NOT NULL,
	"app_token" varchar(128) DEFAULT '' NOT NULL,
	"table_id" varchar(128) DEFAULT '' NOT NULL,
	"view_id" varchar(128),
	"work_order_backend" varchar(16) DEFAULT 'bitable' NOT NULL,
	"field_mapping_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"defaults_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status_mapping_json" jsonb DEFAULT '{"已结束":"completed","已终止":"cancelled"}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "feishu_bitable_sync_config_uk" ON "feishu_bitable_sync_config" USING btree ("supplier_id","data_center_id","sync_kind");--> statement-breakpoint
CREATE INDEX "feishu_bitable_sync_config_dc_idx" ON "feishu_bitable_sync_config" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "feishu_bitable_sync_config_enabled_idx" ON "feishu_bitable_sync_config" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "feishu_external_link_domain_ref_type_uk" ON "feishu_external_link" USING btree ("domain","ref_id","external_type");--> statement-breakpoint
CREATE UNIQUE INDEX "feishu_external_link_type_id_uk" ON "feishu_external_link" USING btree ("external_type","external_id");--> statement-breakpoint
CREATE INDEX "feishu_external_link_ref_idx" ON "feishu_external_link" USING btree ("domain","ref_id");--> statement-breakpoint
CREATE INDEX "feishu_integration_job_run_kind_started_idx" ON "feishu_integration_job_run" USING btree ("job_kind","started_at");--> statement-breakpoint
CREATE INDEX "feishu_integration_job_run_ref_idx" ON "feishu_integration_job_run" USING btree ("ref_domain","ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feishu_webhook_event_idempotency_uk" ON "feishu_webhook_event" USING btree ("idempotency_key");