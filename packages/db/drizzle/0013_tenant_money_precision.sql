ALTER TABLE "tenant" ALTER COLUMN "credit_limit" SET DATA TYPE numeric(20, 4);--> statement-breakpoint
ALTER TABLE "tenant" ALTER COLUMN "balance" SET DATA TYPE numeric(20, 4);--> statement-breakpoint
ALTER TABLE "tenant" ALTER COLUMN "balance" SET DEFAULT '0';