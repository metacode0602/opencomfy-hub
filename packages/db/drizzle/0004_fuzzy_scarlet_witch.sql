CREATE TABLE "supply_chain_lead" (
	"id" text PRIMARY KEY NOT NULL,
	"type" varchar(16) NOT NULL,
	"code" varchar(64),
	"name" varchar(255) NOT NULL,
	"status" varchar(32) NOT NULL,
	"priority" varchar(16) DEFAULT 'medium' NOT NULL,
	"description" text,
	"source" varchar(128),
	"province" varchar(64),
	"city" varchar(64),
	"address" text,
	"supplier_name_text" varchar(255),
	"linked_supplier_id" text,
	"parent_supplier_lead_id" text,
	"docking_scope" varchar(32),
	"estimated_online_date" date,
	"owner_staff_id" text,
	"converted_supplier_id" text,
	"converted_data_center_id" text,
	"converted_at" timestamp with time zone,
	"converted_by" text,
	"lost_reason" text,
	"lost_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain_lead_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"type" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"author_staff_id" text,
	"author_name" varchar(128),
	"author_role" varchar(32),
	"metadata" jsonb,
	"ref_domain" varchar(64),
	"ref_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "supply_chain_lead_activity_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" bigint,
	"mime_type" varchar(128),
	"storage_uri" varchar(1024) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain_lead_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"contact_role" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"title" varchar(64),
	"phone" varchar(32),
	"email" varchar(255),
	"wechat_id" varchar(128),
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain_lead_gpu_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"gpu_card_type_id" text,
	"card_type_name" varchar(128) NOT NULL,
	"total_quantity" integer DEFAULT 0 NOT NULL,
	"idle_quantity" integer DEFAULT 0 NOT NULL,
	"reserved_quantity" integer DEFAULT 0 NOT NULL,
	"in_use_quantity" integer DEFAULT 0 NOT NULL,
	"unit_price_per_hour" numeric(15, 4),
	"available_time" varchar(255),
	"notes" text,
	"source" varchar(32) DEFAULT 'manual' NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain_lead_tag" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_chain_lead_tag_assignment" (
	"lead_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supply_chain_lead_tag_assignment_lead_id_tag_id_pk" PRIMARY KEY("lead_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "supply_chain_lead" ADD CONSTRAINT "supply_chain_lead_linked_supplier_id_supplier_id_fk" FOREIGN KEY ("linked_supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead" ADD CONSTRAINT "supply_chain_lead_parent_supplier_lead_id_supply_chain_lead_id_fk" FOREIGN KEY ("parent_supplier_lead_id") REFERENCES "public"."supply_chain_lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead" ADD CONSTRAINT "supply_chain_lead_owner_staff_id_user_staff_id_fk" FOREIGN KEY ("owner_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead" ADD CONSTRAINT "supply_chain_lead_converted_supplier_id_supplier_id_fk" FOREIGN KEY ("converted_supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead" ADD CONSTRAINT "supply_chain_lead_converted_data_center_id_data_center_id_fk" FOREIGN KEY ("converted_data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead" ADD CONSTRAINT "supply_chain_lead_converted_by_user_staff_id_fk" FOREIGN KEY ("converted_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead" ADD CONSTRAINT "supply_chain_lead_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead_activity" ADD CONSTRAINT "supply_chain_lead_activity_lead_id_supply_chain_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."supply_chain_lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead_activity" ADD CONSTRAINT "supply_chain_lead_activity_author_staff_id_user_staff_id_fk" FOREIGN KEY ("author_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead_activity_attachment" ADD CONSTRAINT "supply_chain_lead_activity_attachment_activity_id_supply_chain_lead_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."supply_chain_lead_activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead_contact" ADD CONSTRAINT "supply_chain_lead_contact_lead_id_supply_chain_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."supply_chain_lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead_gpu_snapshot" ADD CONSTRAINT "supply_chain_lead_gpu_snapshot_lead_id_supply_chain_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."supply_chain_lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead_gpu_snapshot" ADD CONSTRAINT "supply_chain_lead_gpu_snapshot_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead_gpu_snapshot" ADD CONSTRAINT "supply_chain_lead_gpu_snapshot_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead_tag_assignment" ADD CONSTRAINT "supply_chain_lead_tag_assignment_lead_id_supply_chain_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."supply_chain_lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_chain_lead_tag_assignment" ADD CONSTRAINT "supply_chain_lead_tag_assignment_tag_id_supply_chain_lead_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."supply_chain_lead_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supply_chain_lead_type_status_idx" ON "supply_chain_lead" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "supply_chain_lead_owner_staff_id_idx" ON "supply_chain_lead" USING btree ("owner_staff_id");--> statement-breakpoint
CREATE INDEX "supply_chain_lead_last_activity_at_idx" ON "supply_chain_lead" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "supply_chain_lead_linked_supplier_id_idx" ON "supply_chain_lead" USING btree ("linked_supplier_id");--> statement-breakpoint
CREATE INDEX "supply_chain_lead_converted_supplier_id_idx" ON "supply_chain_lead" USING btree ("converted_supplier_id");--> statement-breakpoint
CREATE INDEX "supply_chain_lead_converted_data_center_id_idx" ON "supply_chain_lead" USING btree ("converted_data_center_id");--> statement-breakpoint
CREATE INDEX "supply_chain_lead_activity_lead_occurred_idx" ON "supply_chain_lead_activity" USING btree ("lead_id","occurred_at");--> statement-breakpoint
CREATE INDEX "supply_chain_lead_activity_attachment_activity_id_idx" ON "supply_chain_lead_activity_attachment" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "supply_chain_lead_contact_lead_id_idx" ON "supply_chain_lead_contact" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supply_chain_lead_contact_primary_uk" ON "supply_chain_lead_contact" USING btree ("lead_id","contact_role") WHERE "supply_chain_lead_contact"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "supply_chain_lead_gpu_snapshot_lead_card_uk" ON "supply_chain_lead_gpu_snapshot" USING btree ("lead_id","card_type_name");--> statement-breakpoint
CREATE INDEX "supply_chain_lead_gpu_snapshot_lead_id_idx" ON "supply_chain_lead_gpu_snapshot" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "supply_chain_lead_gpu_snapshot_card_type_id_idx" ON "supply_chain_lead_gpu_snapshot" USING btree ("gpu_card_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supply_chain_lead_tag_name_uk" ON "supply_chain_lead_tag" USING btree ("name");--> statement-breakpoint
CREATE INDEX "supply_chain_lead_tag_assignment_tag_id_idx" ON "supply_chain_lead_tag_assignment" USING btree ("tag_id");