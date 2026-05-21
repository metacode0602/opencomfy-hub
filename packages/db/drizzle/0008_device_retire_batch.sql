ALTER TABLE "onboarding_batch" ALTER COLUMN "contract_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ALTER COLUMN "access_condition_sheet_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN "retire_reason" varchar(64);--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN "expected_completion_date" date;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN "retire_remark" text;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN "retired_device_count" integer DEFAULT 0 NOT NULL;
