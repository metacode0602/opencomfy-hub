CREATE TABLE "platform_card_list_price" (
	"id" text PRIMARY KEY NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"product_line" varchar(32) NOT NULL,
	"billing_unit" varchar(16) DEFAULT 'hour' NOT NULL,
	"sell_price" numeric(15, 4) NOT NULL,
	"currency" varchar(8) DEFAULT 'CNY' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"status" varchar(32) NOT NULL,
	"remark" text,
	"updated_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_card_price_record" (
	"id" text PRIMARY KEY NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"product_line" varchar(32) NOT NULL,
	"billing_unit" varchar(16) DEFAULT 'hour' NOT NULL,
	"sell_price" numeric(15, 4) NOT NULL,
	"platform_card_list_price_id" text,
	"effective_from" date NOT NULL,
	"updated_by_staff_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gpu_card_type" ADD COLUMN "code" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_card_list_price" ADD CONSTRAINT "platform_card_list_price_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_list_price" ADD CONSTRAINT "platform_card_list_price_updated_by_staff_id_user_staff_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_price_record" ADD CONSTRAINT "platform_card_price_record_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_price_record" ADD CONSTRAINT "platform_card_price_record_platform_card_list_price_id_platform_card_list_price_id_fk" FOREIGN KEY ("platform_card_list_price_id") REFERENCES "public"."platform_card_list_price"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_price_record" ADD CONSTRAINT "platform_card_price_record_updated_by_staff_id_user_staff_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_card_list_price_current_uk" ON "platform_card_list_price" USING btree ("gpu_card_type_id","product_line","billing_unit") WHERE "platform_card_list_price"."effective_to" IS NULL AND "platform_card_list_price"."status" = 'active';--> statement-breakpoint
CREATE INDEX "platform_card_list_price_gpu_card_type_id_idx" ON "platform_card_list_price" USING btree ("gpu_card_type_id");--> statement-breakpoint
CREATE INDEX "platform_card_list_price_product_line_idx" ON "platform_card_list_price" USING btree ("product_line");--> statement-breakpoint
CREATE INDEX "platform_card_list_price_effective_from_idx" ON "platform_card_list_price" USING btree ("effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_card_price_record_uk" ON "platform_card_price_record" USING btree ("gpu_card_type_id","product_line","billing_unit");--> statement-breakpoint
CREATE INDEX "platform_card_price_record_list_price_id_idx" ON "platform_card_price_record" USING btree ("platform_card_list_price_id");--> statement-breakpoint
ALTER TABLE "gpu_card_type" ADD CONSTRAINT "gpu_card_type_code_unique" UNIQUE("code");