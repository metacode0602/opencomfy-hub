ALTER TABLE "commerce_order" ADD COLUMN "data_center_id" text;--> statement-breakpoint
ALTER TABLE "commerce_order" ADD COLUMN "data_center_name" varchar(255);--> statement-breakpoint
ALTER TABLE "commerce_order" ADD COLUMN "balance_amount" numeric(15, 4) NOT NULL;--> statement-breakpoint
ALTER TABLE "commerce_order" ADD COLUMN "coupon_amount" numeric(15, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "commerce_order" ADD COLUMN "discount_amount" numeric(15, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "commerce_order" ADD COLUMN "device_count" integer;--> statement-breakpoint
ALTER TABLE "commerce_order" ADD COLUMN "device_model" varchar(64);--> statement-breakpoint
ALTER TABLE "commerce_order" ADD COLUMN "gpu_count" integer;--> statement-breakpoint
ALTER TABLE "commerce_order" ADD COLUMN "unit" varchar(32);--> statement-breakpoint
ALTER TABLE "recharge" ADD COLUMN "refund_id" varchar(128);--> statement-breakpoint
ALTER TABLE "recharge" ADD COLUMN "refund_amount" numeric(15, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_bill" ADD COLUMN "balance_amount" numeric(15, 4) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_bill" ADD COLUMN "coupon_amount" numeric(15, 4) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_bill_detail" ADD COLUMN "balance_amount" numeric(15, 4) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_bill_detail" ADD COLUMN "coupon_amount" numeric(15, 4) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_bill_detail" ADD COLUMN "type" varchar(32) NOT NULL;