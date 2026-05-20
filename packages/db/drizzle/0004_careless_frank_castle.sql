ALTER TABLE "tenant" ADD COLUMN "phone" varchar(32);--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "overdue_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "credit_limit" numeric(15, 4);