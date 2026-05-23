CREATE TABLE "onboarding_batch_device_link" (
	"id" text PRIMARY KEY NOT NULL,
	"business_onboarding_batch_id" text NOT NULL,
	"supplier_device_id" text NOT NULL,
	"link_kind" varchar(32) DEFAULT 'touched' NOT NULL,
	"source_change_log_id" text,
	"source_changelog_batch_id" text,
	"gpu_card_type_id" text NOT NULL,
	"cooperation_type" varchar(32) NOT NULL,
	"linked_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_batch_plan_line" (
	"id" text PRIMARY KEY NOT NULL,
	"onboarding_batch_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"cooperation_type" varchar(32) NOT NULL,
	"planned_quantity" integer NOT NULL,
	"touched_quantity" integer DEFAULT 0 NOT NULL,
	"online_quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lifecycle_state_definition" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN "touched_device_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN "online_device_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD COLUMN "progress_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "supplier_device_change_log" ADD COLUMN "business_onboarding_batch_id" text;--> statement-breakpoint
ALTER TABLE "onboarding_batch_device_link" ADD CONSTRAINT "onboarding_batch_device_link_business_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("business_onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_device_link" ADD CONSTRAINT "onboarding_batch_device_link_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_device_link" ADD CONSTRAINT "onboarding_batch_device_link_source_changelog_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("source_changelog_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_device_link" ADD CONSTRAINT "onboarding_batch_device_link_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_plan_line" ADD CONSTRAINT "onboarding_batch_plan_line_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_plan_line" ADD CONSTRAINT "onboarding_batch_plan_line_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_batch_device_link_uk" ON "onboarding_batch_device_link" USING btree ("business_onboarding_batch_id","supplier_device_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_device_link_batch_id_idx" ON "onboarding_batch_device_link" USING btree ("business_onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_device_link_device_linked_idx" ON "onboarding_batch_device_link" USING btree ("supplier_device_id","linked_at");--> statement-breakpoint
CREATE INDEX "onboarding_batch_device_link_batch_card_coop_idx" ON "onboarding_batch_device_link" USING btree ("business_onboarding_batch_id","gpu_card_type_id","cooperation_type");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_batch_plan_line_uk" ON "onboarding_batch_plan_line" USING btree ("onboarding_batch_id","gpu_card_type_id","cooperation_type");--> statement-breakpoint
CREATE INDEX "onboarding_batch_plan_line_batch_id_idx" ON "onboarding_batch_plan_line" USING btree ("onboarding_batch_id");--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD CONSTRAINT "onboarding_batch_parent_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("parent_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_device_change_log" ADD CONSTRAINT "supplier_device_change_log_business_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("business_onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lifecycle_state_definition_domain_idx" ON "lifecycle_state_definition" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_batch_supplier_work_order_uk" ON "onboarding_batch" USING btree ("supplier_id","work_order_no") WHERE "onboarding_batch"."work_order_no" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "onboarding_batch_parent_batch_id_idx" ON "onboarding_batch" USING btree ("parent_batch_id");--> statement-breakpoint
CREATE INDEX "supplier_device_cooperation_type_idx" ON "supplier_device" USING btree ("cooperation_type");--> statement-breakpoint
CREATE INDEX "supplier_device_change_log_business_batch_id_idx" ON "supplier_device_change_log" USING btree ("business_onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "supplier_device_change_log_business_device_idx" ON "supplier_device_change_log" USING btree ("business_onboarding_batch_id","supplier_device_id");