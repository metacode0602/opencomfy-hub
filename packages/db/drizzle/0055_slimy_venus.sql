CREATE TABLE "internal_test_hold_device_link" (
	"id" text PRIMARY KEY NOT NULL,
	"hold_id" text NOT NULL,
	"supplier_device_id" text NOT NULL,
	"port" varchar(16) DEFAULT '22' NOT NULL,
	"login_username" varchar(128) NOT NULL,
	"login_password" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "internal_test_hold" ALTER COLUMN "scope" SET DEFAULT 'planned';--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD COLUMN "supplier_id" text;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD COLUMN "data_center_id" text;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD COLUMN "work_order_no" varchar(64);--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD COLUMN "user_name" varchar(128);--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD COLUMN "department" varchar(32);--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD COLUMN "settlement_mode" varchar(32);--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD COLUMN "gpu_card_type_id" text;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD COLUMN "unit_count" integer;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD COLUMN "remark" text;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "internal_test_hold_device_link" ADD CONSTRAINT "internal_test_hold_device_link_hold_id_internal_test_hold_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."internal_test_hold"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_test_hold_device_link" ADD CONSTRAINT "internal_test_hold_device_link_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "internal_test_hold_device_link_uk" ON "internal_test_hold_device_link" USING btree ("hold_id","supplier_device_id");--> statement-breakpoint
CREATE INDEX "internal_test_hold_device_link_hold_id_idx" ON "internal_test_hold_device_link" USING btree ("hold_id");--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD CONSTRAINT "internal_test_hold_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD CONSTRAINT "internal_test_hold_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD CONSTRAINT "internal_test_hold_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "internal_test_hold_supplier_id_idx" ON "internal_test_hold" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "internal_test_hold_data_center_id_idx" ON "internal_test_hold" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "internal_test_hold_work_order_no_idx" ON "internal_test_hold" USING btree ("work_order_no");