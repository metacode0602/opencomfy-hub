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
ALTER TABLE "onboarding_batch" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "feishu_external_link_domain_ref_type_uk" ON "feishu_external_link" USING btree ("domain","ref_id","external_type");--> statement-breakpoint
CREATE UNIQUE INDEX "feishu_external_link_type_id_uk" ON "feishu_external_link" USING btree ("external_type","external_id");--> statement-breakpoint
CREATE INDEX "feishu_external_link_ref_idx" ON "feishu_external_link" USING btree ("domain","ref_id");--> statement-breakpoint
CREATE INDEX "feishu_integration_job_run_kind_started_idx" ON "feishu_integration_job_run" USING btree ("job_kind","started_at");--> statement-breakpoint
CREATE INDEX "feishu_integration_job_run_ref_idx" ON "feishu_integration_job_run" USING btree ("ref_domain","ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feishu_webhook_event_idempotency_uk" ON "feishu_webhook_event" USING btree ("idempotency_key");
