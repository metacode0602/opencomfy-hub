ALTER TABLE "voucher_card_hours_adjustment_history" RENAME COLUMN "voucher_card_hours_before" TO "balance_card_hours_before";--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" RENAME COLUMN "voucher_card_hours_after" TO "balance_card_hours_after";--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" RENAME COLUMN "gifted_duration_cost_excl_tax_before" TO "sold_duration_cost_excl_tax_before";--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" RENAME COLUMN "gifted_duration_cost_excl_tax_after" TO "sold_duration_cost_excl_tax_after";
