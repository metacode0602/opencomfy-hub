ALTER TABLE "onboarding_batch" ADD COLUMN IF NOT EXISTS "planned_lines_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN IF NOT EXISTS "planned_device_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN IF NOT EXISTS "list_upload_mode" varchar(32) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN IF NOT EXISTS "work_order_no" varchar(64);--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN IF NOT EXISTS "online_reason" varchar(64);--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN IF NOT EXISTS "order_no" varchar(128);--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN IF NOT EXISTS "remark" text;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN IF NOT EXISTS "parent_batch_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_batch_work_order_no_idx" ON "onboarding_batch" USING btree ("work_order_no");
