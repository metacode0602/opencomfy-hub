ALTER TABLE "internal_test_hold" ADD COLUMN "onboarding_batch_id" text;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD CONSTRAINT "internal_test_hold_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "internal_test_hold_onboarding_batch_id_idx" ON "internal_test_hold" USING btree ("onboarding_batch_id");
