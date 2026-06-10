CREATE TABLE "merchant_purchase_price" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"product_line" varchar(32) NOT NULL,
	"billing_unit" varchar(16) DEFAULT 'hour' NOT NULL,
	"purchase_price" numeric(15, 4) NOT NULL,
	"currency" varchar(8) DEFAULT 'CNY' NOT NULL,
	"source" varchar(32) NOT NULL,
	"platform_list_price_id" text,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"status" varchar(32) NOT NULL,
	"remark" text,
	"updated_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_purchase_price_record" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"product_line" varchar(32) NOT NULL,
	"billing_unit" varchar(16) DEFAULT 'hour' NOT NULL,
	"purchase_price" numeric(15, 4) NOT NULL,
	"platform_list_price_id" text,
	"source" varchar(32) NOT NULL,
	"effective_from" date NOT NULL,
	"updated_by_staff_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_purchase_price" ADD CONSTRAINT "merchant_purchase_price_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_purchase_price" ADD CONSTRAINT "merchant_purchase_price_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_purchase_price" ADD CONSTRAINT "merchant_purchase_price_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_purchase_price" ADD CONSTRAINT "merchant_purchase_price_platform_list_price_id_platform_card_list_price_id_fk" FOREIGN KEY ("platform_list_price_id") REFERENCES "public"."platform_card_list_price"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_purchase_price" ADD CONSTRAINT "merchant_purchase_price_updated_by_staff_id_user_staff_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_purchase_price_record" ADD CONSTRAINT "merchant_purchase_price_record_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_purchase_price_record" ADD CONSTRAINT "merchant_purchase_price_record_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_purchase_price_record" ADD CONSTRAINT "merchant_purchase_price_record_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_purchase_price_record" ADD CONSTRAINT "merchant_purchase_price_record_platform_list_price_id_platform_card_list_price_id_fk" FOREIGN KEY ("platform_list_price_id") REFERENCES "public"."platform_card_list_price"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_purchase_price_record" ADD CONSTRAINT "merchant_purchase_price_record_updated_by_staff_id_user_staff_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_purchase_price_active_uk" ON "merchant_purchase_price" USING btree ("merchant_id","data_center_id","gpu_card_type_id","product_line","billing_unit") WHERE "merchant_purchase_price"."effective_to" IS NULL AND "merchant_purchase_price"."status" = 'active';--> statement-breakpoint
CREATE INDEX "merchant_purchase_price_merchant_dc_idx" ON "merchant_purchase_price" USING btree ("merchant_id","data_center_id");--> statement-breakpoint
CREATE INDEX "merchant_purchase_price_gpu_card_type_id_idx" ON "merchant_purchase_price" USING btree ("gpu_card_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_purchase_price_record_uk" ON "merchant_purchase_price_record" USING btree ("merchant_id","data_center_id","gpu_card_type_id","product_line","billing_unit");--> statement-breakpoint
CREATE INDEX "merchant_purchase_price_record_merchant_id_idx" ON "merchant_purchase_price_record" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_purchase_price_record_data_center_id_idx" ON "merchant_purchase_price_record" USING btree ("data_center_id");