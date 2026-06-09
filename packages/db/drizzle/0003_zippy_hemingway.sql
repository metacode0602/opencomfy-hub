ALTER TABLE "customer" ADD COLUMN "identity_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "identity_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "identity_verification_type" varchar(16);