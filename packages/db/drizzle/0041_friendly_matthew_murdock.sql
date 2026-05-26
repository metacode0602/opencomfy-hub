ALTER TABLE "billing_period_cost_pricing_snapshot" ADD COLUMN "billing_unit" varchar(16);--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD COLUMN "monthly_rent_per_machine" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD COLUMN "cards_per_machine" integer;--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD COLUMN "previous_billing_unit" varchar(16);--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD COLUMN "new_billing_unit" varchar(16);--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD COLUMN "previous_unit_price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD COLUMN "new_unit_price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD COLUMN "previous_cards_per_machine" integer;--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD COLUMN "new_cards_per_machine" integer;--> statement-breakpoint
ALTER TABLE "supplier_pricing_record" ADD COLUMN "billing_unit" varchar(16) DEFAULT 'hour' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_pricing_record" ADD COLUMN "unit_price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "supplier_pricing_record" ADD COLUMN "cards_per_machine" integer DEFAULT 8;