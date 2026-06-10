CREATE TABLE "merchant_datacenter_card_type" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_datacenter_region_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"status" varchar(32) DEFAULT 'enabled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_datacenter_region" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"display_name" varchar(255),
	"region_code" varchar(128) NOT NULL,
	"status" varchar(32) NOT NULL,
	"available_gpu_quota" integer DEFAULT -1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"updated_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_datacenter_card_type" ADD CONSTRAINT "merchant_datacenter_card_type_merchant_datacenter_region_id_merchant_datacenter_region_id_fk" FOREIGN KEY ("merchant_datacenter_region_id") REFERENCES "public"."merchant_datacenter_region"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_datacenter_card_type" ADD CONSTRAINT "merchant_datacenter_card_type_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_datacenter_region" ADD CONSTRAINT "merchant_datacenter_region_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_datacenter_region" ADD CONSTRAINT "merchant_datacenter_region_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_datacenter_region" ADD CONSTRAINT "merchant_datacenter_region_updated_by_staff_id_user_staff_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_datacenter_card_type_region_card_uk" ON "merchant_datacenter_card_type" USING btree ("merchant_datacenter_region_id","gpu_card_type_id");--> statement-breakpoint
CREATE INDEX "merchant_datacenter_card_type_region_id_idx" ON "merchant_datacenter_card_type" USING btree ("merchant_datacenter_region_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_datacenter_region_merchant_dc_active_uk" ON "merchant_datacenter_region" USING btree ("merchant_id","data_center_id") WHERE effective_to IS NULL;--> statement-breakpoint
CREATE INDEX "merchant_datacenter_region_merchant_status_idx" ON "merchant_datacenter_region" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "merchant_datacenter_region_data_center_id_idx" ON "merchant_datacenter_region" USING btree ("data_center_id");