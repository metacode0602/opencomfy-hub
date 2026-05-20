ALTER TABLE "project" ADD COLUMN "last_month_recharge" numeric(15, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "this_month_recharge" numeric(15, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "last_month_consumption" numeric(15, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "this_month_consumption" numeric(15, 4) DEFAULT '0' NOT NULL;