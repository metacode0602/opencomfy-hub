ALTER TABLE "voucher_card_hours_adjustment_history" ADD COLUMN "balance_card_hours_before" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" ADD COLUMN "balance_card_hours_after" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" ADD COLUMN "sold_duration_cost_excl_tax_before" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" ADD COLUMN "sold_duration_cost_excl_tax_after" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" DROP COLUMN "voucher_card_hours_before";--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" DROP COLUMN "voucher_card_hours_after";--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" DROP COLUMN "gifted_duration_cost_excl_tax_before";--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" DROP COLUMN "gifted_duration_cost_excl_tax_after";