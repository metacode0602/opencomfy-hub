CREATE TABLE IF NOT EXISTS "onboarding_batch_progress_event" (
	"id" text PRIMARY KEY NOT NULL,
	"onboarding_batch_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"batch_kind" varchar(32) NOT NULL,
	"batch_status" varchar(32) NOT NULL,
	"planned_device_count" integer NOT NULL,
	"planned_gpu_count" integer NOT NULL,
	"touched_device_count" integer NOT NULL,
	"touched_pipeline_gpu" integer NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text,
	"idc_region" varchar(64),
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_batch_progress_event" ADD CONSTRAINT "onboarding_batch_progress_event_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "onboarding_batch_progress_event" ADD CONSTRAINT "onboarding_batch_progress_event_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "onboarding_batch_progress_event" ADD CONSTRAINT "onboarding_batch_progress_event_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_batch_progress_event_batch_occurred_idx" ON "onboarding_batch_progress_event" USING btree ("onboarding_batch_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_batch_progress_event_occurred_idx" ON "onboarding_batch_progress_event" USING btree ("occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_batch_progress_event_kind_occurred_idx" ON "onboarding_batch_progress_event" USING btree ("batch_kind","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_batch_progress_event_supplier_dc_occurred_idx" ON "onboarding_batch_progress_event" USING btree ("supplier_id","data_center_id","occurred_at");
--> statement-breakpoint
INSERT INTO "supplier_activity_type_definition" ("id", "type_code", "display_name", "category", "sort_order")
SELECT 'sat-batch-plan-adjusted', 'batch_plan_adjusted', '批次计划手动调整', 'batch', 120
WHERE NOT EXISTS (
  SELECT 1 FROM "supplier_activity_type_definition" WHERE "type_code" = 'batch_plan_adjusted'
);
