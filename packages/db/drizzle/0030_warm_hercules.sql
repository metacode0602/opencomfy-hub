ALTER TABLE "onboarding_batch" ADD COLUMN "retire_action_type" varchar(32);--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN "retire_plan_mode" varchar(32);--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN "progress_flags_json" jsonb;