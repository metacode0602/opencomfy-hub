ALTER TABLE "supplier_pricing_record" ADD COLUMN IF NOT EXISTS "billing_unit" varchar(16) DEFAULT 'hour' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_pricing_record" ADD COLUMN IF NOT EXISTS "unit_price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "supplier_pricing_record" ADD COLUMN IF NOT EXISTS "cards_per_machine" integer DEFAULT 8;--> statement-breakpoint
UPDATE "supplier_pricing_record" SET "billing_unit" = 'hour', "unit_price" = "unit_price_per_hour" WHERE "unit_price" IS NULL AND "unit_price_per_hour" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD COLUMN IF NOT EXISTS "previous_billing_unit" varchar(16);--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD COLUMN IF NOT EXISTS "new_billing_unit" varchar(16);--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD COLUMN IF NOT EXISTS "previous_unit_price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD COLUMN IF NOT EXISTS "new_unit_price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD COLUMN IF NOT EXISTS "previous_cards_per_machine" integer;--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD COLUMN IF NOT EXISTS "new_cards_per_machine" integer;--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD COLUMN IF NOT EXISTS "billing_unit" varchar(16);--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD COLUMN IF NOT EXISTS "monthly_rent_per_machine" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD COLUMN IF NOT EXISTS "cards_per_machine" integer;
