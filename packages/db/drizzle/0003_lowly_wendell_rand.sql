CREATE TABLE "merchant" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_merchant_id" integer NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"company_full_name" varchar(512) NOT NULL,
	"unified_social_credit_code" varchar(18) NOT NULL,
	"merchant_mark" varchar(128),
	"access_mode" varchar(16) DEFAULT 'oem' NOT NULL,
	"type" varchar(32) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" varchar(32) NOT NULL,
	"contact_user" varchar(128),
	"contact_phone" varchar(32),
	"remark" text,
	"platform_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"author_staff_id" text,
	"author_name" varchar(128) NOT NULL,
	"author_role" varchar(32) NOT NULL,
	"ref_domain" varchar(64),
	"ref_id" text,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_activity_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" bigint,
	"mime_type" varchar(128),
	"storage_uri" varchar(1024) NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "merchant_recharge_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"recharge_id" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"file_size" bigint NOT NULL,
	"storage_uri" varchar(1024) NOT NULL,
	"uploaded_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_recharge_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"recharge_id" text NOT NULL,
	"merchant_id" text NOT NULL,
	"action" varchar(16) NOT NULL,
	"operator_staff_id" text,
	"operator_name" varchar(128) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"changes" jsonb,
	"remark" text
);
--> statement-breakpoint
CREATE TABLE "merchant_recharge_record" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"amount" numeric(15, 4) NOT NULL,
	"payment_method" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"transaction_id" varchar(128),
	"recharge_date" date NOT NULL,
	"remark" text,
	"source" varchar(32) DEFAULT 'manual' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by_staff_id" text,
	"updated_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_merchant" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"merchant_id" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"binding_role" varchar(32) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"remark" text,
	"created_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_ops_engineer" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"name" varchar(128) NOT NULL,
	"phone" varchar(32),
	"email" varchar(255),
	"wechat_id" varchar(128),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "identity_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "identity_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "identity_verification_type" varchar(16);--> statement-breakpoint
ALTER TABLE "merchant_activity" ADD CONSTRAINT "merchant_activity_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_activity" ADD CONSTRAINT "merchant_activity_author_staff_id_user_staff_id_fk" FOREIGN KEY ("author_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_activity_attachment" ADD CONSTRAINT "merchant_activity_attachment_activity_id_merchant_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."merchant_activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_datacenter_card_type" ADD CONSTRAINT "merchant_datacenter_card_type_merchant_datacenter_region_id_merchant_datacenter_region_id_fk" FOREIGN KEY ("merchant_datacenter_region_id") REFERENCES "public"."merchant_datacenter_region"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_datacenter_card_type" ADD CONSTRAINT "merchant_datacenter_card_type_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_datacenter_region" ADD CONSTRAINT "merchant_datacenter_region_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_datacenter_region" ADD CONSTRAINT "merchant_datacenter_region_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_datacenter_region" ADD CONSTRAINT "merchant_datacenter_region_updated_by_staff_id_user_staff_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "merchant_recharge_attachment" ADD CONSTRAINT "merchant_recharge_attachment_recharge_id_merchant_recharge_record_id_fk" FOREIGN KEY ("recharge_id") REFERENCES "public"."merchant_recharge_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_recharge_attachment" ADD CONSTRAINT "merchant_recharge_attachment_uploaded_by_staff_id_user_staff_id_fk" FOREIGN KEY ("uploaded_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_recharge_audit_log" ADD CONSTRAINT "merchant_recharge_audit_log_recharge_id_merchant_recharge_record_id_fk" FOREIGN KEY ("recharge_id") REFERENCES "public"."merchant_recharge_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_recharge_audit_log" ADD CONSTRAINT "merchant_recharge_audit_log_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_recharge_audit_log" ADD CONSTRAINT "merchant_recharge_audit_log_operator_staff_id_user_staff_id_fk" FOREIGN KEY ("operator_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_recharge_record" ADD CONSTRAINT "merchant_recharge_record_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_recharge_record" ADD CONSTRAINT "merchant_recharge_record_created_by_staff_id_user_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_recharge_record" ADD CONSTRAINT "merchant_recharge_record_updated_by_staff_id_user_staff_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_merchant" ADD CONSTRAINT "tenant_merchant_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_merchant" ADD CONSTRAINT "tenant_merchant_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_merchant" ADD CONSTRAINT "tenant_merchant_created_by_staff_id_user_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ops_engineer" ADD CONSTRAINT "supplier_ops_engineer_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ops_engineer" ADD CONSTRAINT "supplier_ops_engineer_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_platform_merchant_id_uk" ON "merchant" USING btree ("platform_merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_code_uk" ON "merchant" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_uscc_uk" ON "merchant" USING btree ("unified_social_credit_code");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_is_default_uk" ON "merchant" USING btree ("is_default") WHERE is_default = true;--> statement-breakpoint
CREATE INDEX "merchant_status_idx" ON "merchant" USING btree ("status");--> statement-breakpoint
CREATE INDEX "merchant_name_idx" ON "merchant" USING btree ("name");--> statement-breakpoint
CREATE INDEX "merchant_activity_merchant_occurred_idx" ON "merchant_activity" USING btree ("merchant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "merchant_activity_ref_idx" ON "merchant_activity" USING btree ("ref_domain","ref_id");--> statement-breakpoint
CREATE INDEX "merchant_activity_attachment_activity_id_idx" ON "merchant_activity_attachment" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_datacenter_card_type_region_card_uk" ON "merchant_datacenter_card_type" USING btree ("merchant_datacenter_region_id","gpu_card_type_id");--> statement-breakpoint
CREATE INDEX "merchant_datacenter_card_type_region_id_idx" ON "merchant_datacenter_card_type" USING btree ("merchant_datacenter_region_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_datacenter_region_merchant_dc_active_uk" ON "merchant_datacenter_region" USING btree ("merchant_id","data_center_id") WHERE effective_to IS NULL;--> statement-breakpoint
CREATE INDEX "merchant_datacenter_region_merchant_status_idx" ON "merchant_datacenter_region" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "merchant_datacenter_region_data_center_id_idx" ON "merchant_datacenter_region" USING btree ("data_center_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_purchase_price_active_uk" ON "merchant_purchase_price" USING btree ("merchant_id","data_center_id","gpu_card_type_id","product_line","billing_unit") WHERE "merchant_purchase_price"."effective_to" IS NULL AND "merchant_purchase_price"."status" = 'active';--> statement-breakpoint
CREATE INDEX "merchant_purchase_price_merchant_dc_idx" ON "merchant_purchase_price" USING btree ("merchant_id","data_center_id");--> statement-breakpoint
CREATE INDEX "merchant_purchase_price_gpu_card_type_id_idx" ON "merchant_purchase_price" USING btree ("gpu_card_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_purchase_price_record_uk" ON "merchant_purchase_price_record" USING btree ("merchant_id","data_center_id","gpu_card_type_id","product_line","billing_unit");--> statement-breakpoint
CREATE INDEX "merchant_purchase_price_record_merchant_id_idx" ON "merchant_purchase_price_record" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_purchase_price_record_data_center_id_idx" ON "merchant_purchase_price_record" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "merchant_recharge_attachment_recharge_id_idx" ON "merchant_recharge_attachment" USING btree ("recharge_id");--> statement-breakpoint
CREATE INDEX "merchant_recharge_audit_recharge_idx" ON "merchant_recharge_audit_log" USING btree ("recharge_id","occurred_at");--> statement-breakpoint
CREATE INDEX "merchant_recharge_audit_merchant_idx" ON "merchant_recharge_audit_log" USING btree ("merchant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "merchant_recharge_merchant_date_idx" ON "merchant_recharge_record" USING btree ("merchant_id","recharge_date");--> statement-breakpoint
CREATE INDEX "merchant_recharge_merchant_status_idx" ON "merchant_recharge_record" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "tenant_merchant_merchant_id_idx" ON "tenant_merchant" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "tenant_merchant_tenant_id_idx" ON "tenant_merchant" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_merchant_tenant_primary_idx" ON "tenant_merchant" USING btree ("tenant_id","is_primary");--> statement-breakpoint
CREATE INDEX "supplier_ops_engineer_supplier_id_idx" ON "supplier_ops_engineer" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_ops_engineer_data_center_id_idx" ON "supplier_ops_engineer" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "supplier_ops_engineer_data_center_sort_idx" ON "supplier_ops_engineer" USING btree ("data_center_id","sort_order");