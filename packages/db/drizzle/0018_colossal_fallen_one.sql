CREATE TABLE "platform_card_price_history" (
	"id" text PRIMARY KEY NOT NULL,
	"price_record_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"product_line" varchar(32) NOT NULL,
	"billing_unit" varchar(16) DEFAULT 'hour' NOT NULL,
	"previous_sell_price" numeric(15, 4),
	"new_sell_price" numeric(15, 4) NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"changed_by_staff_id" text,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "platform_card_price_history" ADD CONSTRAINT "platform_card_price_history_price_record_id_platform_card_price_record_id_fk" FOREIGN KEY ("price_record_id") REFERENCES "public"."platform_card_price_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_price_history" ADD CONSTRAINT "platform_card_price_history_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_price_history" ADD CONSTRAINT "platform_card_price_history_changed_by_staff_id_user_staff_id_fk" FOREIGN KEY ("changed_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_card_price_history_record_changed_idx" ON "platform_card_price_history" USING btree ("price_record_id","changed_at");--> statement-breakpoint
CREATE INDEX "platform_card_price_history_gpu_card_type_id_idx" ON "platform_card_price_history" USING btree ("gpu_card_type_id");