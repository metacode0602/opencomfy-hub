ALTER TABLE "consumption_usage_daily" ADD COLUMN "balance" numeric(20, 4);--> statement-breakpoint
ALTER TABLE "consumption_usage_daily" ADD COLUMN "voucher_amount" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "consumption_usage_daily" ADD COLUMN "balance_amount" numeric(15, 4);