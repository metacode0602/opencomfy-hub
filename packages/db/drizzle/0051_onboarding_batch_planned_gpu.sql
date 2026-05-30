ALTER TABLE "onboarding_batch" ADD COLUMN IF NOT EXISTS "planned_gpu_count" integer DEFAULT 0 NOT NULL;
