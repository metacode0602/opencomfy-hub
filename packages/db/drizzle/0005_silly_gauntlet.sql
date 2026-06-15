CREATE TABLE "user_site_message" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(200) NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"category" varchar(32),
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bare_metal_order" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_order_id" varchar(64),
	"order_no" varchar(128),
	"order_mark" varchar(16) NOT NULL,
	"tenant_id" text NOT NULL,
	"platform_tenant_id" varchar(128) NOT NULL,
	"customer_id" text,
	"project_id" text,
	"data_center_id" text,
	"supplier_id" text,
	"idc_code" varchar(64),
	"idc_name" varchar(128),
	"status" varchar(32) NOT NULL,
	"pay_status" varchar(32) NOT NULL,
	"billing_unit" varchar(16) NOT NULL,
	"purchase_qty" integer,
	"purchase_qty_text" varchar(128),
	"device_count" integer DEFAULT 0 NOT NULL,
	"gpu_count" integer DEFAULT 0 NOT NULL,
	"order_amount" numeric(15, 4),
	"refund_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"final_amount" numeric(15, 4) NOT NULL,
	"balance_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"coupon_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"ordered_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"rent_starts_at" timestamp with time zone,
	"rent_ends_at" timestamp with time zone,
	"import_batch_id" text,
	"commerce_order_id" text,
	"source" varchar(32) DEFAULT 'platform_sync' NOT NULL,
	"platform_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"match_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bare_metal_order_device" (
	"id" text PRIMARY KEY NOT NULL,
	"bare_metal_order_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"allocation_status" varchar(32) DEFAULT 'planned' NOT NULL,
	"gpu_card_type_id" text,
	"device_model_text" varchar(128),
	"gpu_count" integer DEFAULT 0 NOT NULL,
	"platform_device_id" varchar(128),
	"supplier_device_id" text,
	"device_status" varchar(32),
	"sn" varchar(64),
	"asset_no" varchar(64),
	"external_ip" varchar(45),
	"internal_ip" varchar(45),
	"line_amount" numeric(15, 4),
	"duration_hours" numeric(15, 4),
	"unit_price_per_card_hour" numeric(15, 4),
	"rent_starts_at" timestamp with time zone,
	"rent_ends_at" timestamp with time zone,
	"linked_at" timestamp with time zone,
	"platform_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"match_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bare_metal_order_import_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"bare_metal_order_id" text,
	"file_name" varchar(255) NOT NULL,
	"file_uri" varchar(1024),
	"file_hash" varchar(64),
	"row_count" integer DEFAULT 0 NOT NULL,
	"committed_at" timestamp with time zone,
	"created_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bare_metal_sync_job_item" (
	"id" text PRIMARY KEY NOT NULL,
	"job_run_id" text NOT NULL,
	"platform_tenant_id" varchar(128) NOT NULL,
	"tenant_id" text,
	"phase" varchar(32) NOT NULL,
	"status" varchar(16) NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "bare_metal_sync_job_run" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger" varchar(16) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(16) NOT NULL,
	"orders_fetched_count" integer DEFAULT 0 NOT NULL,
	"unknown_tenant_count" integer DEFAULT 0 NOT NULL,
	"tenants_auto_imported_count" integer DEFAULT 0 NOT NULL,
	"billing_sync_tenant_count" integer DEFAULT 0 NOT NULL,
	"order_upserted_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "bare_metal_sync_state" (
	"id" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_platform_probe_job_run" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger" varchar(16) NOT NULL,
	"snapshot_hour" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(16) NOT NULL,
	"inventory_device_count" integer DEFAULT 0 NOT NULL,
	"proxy_fetched_count" integer DEFAULT 0 NOT NULL,
	"k8s_fetched_count" integer DEFAULT 0 NOT NULL,
	"bare_metal_hit_count" integer DEFAULT 0 NOT NULL,
	"matched_proxy_count" integer DEFAULT 0 NOT NULL,
	"matched_k8s_count" integer DEFAULT 0 NOT NULL,
	"matched_bare_metal_count" integer DEFAULT 0 NOT NULL,
	"ambiguous_count" integer DEFAULT 0 NOT NULL,
	"missing_platform_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "device_platform_probe_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"job_run_id" text NOT NULL,
	"supplier_device_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text,
	"sn" varchar(64) NOT NULL,
	"internal_ip" varchar(45),
	"data_center_name" varchar(255),
	"ops_status" varchar(64) NOT NULL,
	"lifecycle_status" varchar(32) NOT NULL,
	"snapshot_hour" timestamp with time zone NOT NULL,
	"probe_status" varchar(32) NOT NULL,
	"consistency_flag" varchar(32) NOT NULL,
	"proxy_matched" boolean DEFAULT false NOT NULL,
	"proxy_rent_status" varchar(64),
	"proxy_is_container_instance" boolean,
	"proxy_platform_device_id" varchar(64),
	"k8s_matched" boolean DEFAULT false NOT NULL,
	"k8s_device_name" varchar(255),
	"k8s_region" varchar(128),
	"bare_metal_matched" boolean DEFAULT false NOT NULL,
	"bare_metal_order_no" varchar(64),
	"bare_metal_order_status" varchar(32),
	"suggested_action" text,
	"match_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proxy_payload" jsonb,
	"k8s_payload" jsonb,
	"bare_metal_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_platform_probe_state" (
	"id" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_snapshot_hour" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_device_change_log" ADD COLUMN "external_device_id" varchar(64);--> statement-breakpoint
ALTER TABLE "supplier_device_change_log" ADD COLUMN "attachment_names" text;--> statement-breakpoint
ALTER TABLE "user_site_message" ADD CONSTRAINT "user_site_message_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order" ADD CONSTRAINT "bare_metal_order_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order" ADD CONSTRAINT "bare_metal_order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order" ADD CONSTRAINT "bare_metal_order_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order" ADD CONSTRAINT "bare_metal_order_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order" ADD CONSTRAINT "bare_metal_order_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order" ADD CONSTRAINT "bare_metal_order_import_batch_id_bare_metal_order_import_batch_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."bare_metal_order_import_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order" ADD CONSTRAINT "bare_metal_order_commerce_order_id_commerce_order_id_fk" FOREIGN KEY ("commerce_order_id") REFERENCES "public"."commerce_order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order_device" ADD CONSTRAINT "bare_metal_order_device_bare_metal_order_id_bare_metal_order_id_fk" FOREIGN KEY ("bare_metal_order_id") REFERENCES "public"."bare_metal_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order_device" ADD CONSTRAINT "bare_metal_order_device_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order_device" ADD CONSTRAINT "bare_metal_order_device_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order_import_batch" ADD CONSTRAINT "bare_metal_order_import_batch_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order_import_batch" ADD CONSTRAINT "bare_metal_order_import_batch_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order_import_batch" ADD CONSTRAINT "bare_metal_order_import_batch_bare_metal_order_id_bare_metal_order_id_fk" FOREIGN KEY ("bare_metal_order_id") REFERENCES "public"."bare_metal_order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_order_import_batch" ADD CONSTRAINT "bare_metal_order_import_batch_created_by_staff_id_user_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_sync_job_item" ADD CONSTRAINT "bare_metal_sync_job_item_job_run_id_bare_metal_sync_job_run_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."bare_metal_sync_job_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bare_metal_sync_job_item" ADD CONSTRAINT "bare_metal_sync_job_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD CONSTRAINT "device_platform_probe_snapshot_job_run_id_device_platform_probe_job_run_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."device_platform_probe_job_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD CONSTRAINT "device_platform_probe_snapshot_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD CONSTRAINT "device_platform_probe_snapshot_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD CONSTRAINT "device_platform_probe_snapshot_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_site_message_user_created_idx" ON "user_site_message" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_site_message_user_read_idx" ON "user_site_message" USING btree ("user_id","read");--> statement-breakpoint
CREATE UNIQUE INDEX "bare_metal_order_platform_order_id_uk" ON "bare_metal_order" USING btree ("platform_order_id") WHERE "bare_metal_order"."platform_order_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "bare_metal_order_order_no_uk" ON "bare_metal_order" USING btree ("order_no") WHERE "bare_metal_order"."order_no" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "bare_metal_order_tenant_ordered_idx" ON "bare_metal_order" USING btree ("tenant_id","ordered_at");--> statement-breakpoint
CREATE INDEX "bare_metal_order_project_ordered_idx" ON "bare_metal_order" USING btree ("project_id","ordered_at");--> statement-breakpoint
CREATE INDEX "bare_metal_order_data_center_idx" ON "bare_metal_order" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "bare_metal_order_status_idx" ON "bare_metal_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bare_metal_order_order_mark_idx" ON "bare_metal_order" USING btree ("order_mark");--> statement-breakpoint
CREATE INDEX "bare_metal_order_ordered_at_idx" ON "bare_metal_order" USING btree ("ordered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bare_metal_order_device_order_line_uk" ON "bare_metal_order_device" USING btree ("bare_metal_order_id","line_no");--> statement-breakpoint
CREATE INDEX "bare_metal_order_device_order_id_idx" ON "bare_metal_order_device" USING btree ("bare_metal_order_id");--> statement-breakpoint
CREATE INDEX "bare_metal_order_device_supplier_device_idx" ON "bare_metal_order_device" USING btree ("supplier_device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bare_metal_order_device_platform_device_uk" ON "bare_metal_order_device" USING btree ("platform_device_id") WHERE "bare_metal_order_device"."platform_device_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "bare_metal_order_device_gpu_card_type_idx" ON "bare_metal_order_device" USING btree ("gpu_card_type_id");--> statement-breakpoint
CREATE INDEX "bare_metal_order_import_batch_project_id_idx" ON "bare_metal_order_import_batch" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "bare_metal_order_import_batch_tenant_id_idx" ON "bare_metal_order_import_batch" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bare_metal_sync_job_item_job_run_id_idx" ON "bare_metal_sync_job_item" USING btree ("job_run_id");--> statement-breakpoint
CREATE INDEX "bare_metal_sync_job_item_platform_tenant_id_idx" ON "bare_metal_sync_job_item" USING btree ("platform_tenant_id");--> statement-breakpoint
CREATE INDEX "bare_metal_sync_job_run_started_at_idx" ON "bare_metal_sync_job_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "bare_metal_sync_job_run_status_idx" ON "bare_metal_sync_job_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "device_platform_probe_job_run_started_at_idx" ON "device_platform_probe_job_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "device_platform_probe_job_run_status_idx" ON "device_platform_probe_job_run" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "device_platform_probe_snapshot_device_hour_uk" ON "device_platform_probe_snapshot" USING btree ("supplier_device_id","snapshot_hour");--> statement-breakpoint
CREATE INDEX "device_platform_probe_snapshot_hour_supplier_idx" ON "device_platform_probe_snapshot" USING btree ("snapshot_hour","supplier_id");--> statement-breakpoint
CREATE INDEX "device_platform_probe_snapshot_hour_dc_idx" ON "device_platform_probe_snapshot" USING btree ("snapshot_hour","data_center_id");--> statement-breakpoint
CREATE INDEX "device_platform_probe_snapshot_hour_probe_status_idx" ON "device_platform_probe_snapshot" USING btree ("snapshot_hour","probe_status");--> statement-breakpoint
CREATE INDEX "device_platform_probe_snapshot_hour_consistency_idx" ON "device_platform_probe_snapshot" USING btree ("snapshot_hour","consistency_flag");--> statement-breakpoint
CREATE INDEX "device_platform_probe_snapshot_device_hour_desc_idx" ON "device_platform_probe_snapshot" USING btree ("supplier_device_id","snapshot_hour");


-- device platform probe: normalize helpers, latest view, UNLOGGED staging tables
-- consumed by apps/web/src/lib/server/dataaccess/supplier/device-platform-probe-staging.ts

CREATE OR REPLACE FUNCTION normalize_idc_key(input text) RETURNS text AS $$
  SELECT CASE
    WHEN input IS NULL OR btrim(input) = '' THEN NULL
    ELSE lower(regexp_replace(btrim(input), '\s+', ' ', 'g'))
  END;
$$ LANGUAGE sql IMMUTABLE;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION normalize_region_key(input text) RETURNS text AS $$
  SELECT CASE
    WHEN input IS NULL OR btrim(input) = '' THEN NULL
    ELSE lower(btrim(input))
  END;
$$ LANGUAGE sql IMMUTABLE;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION normalize_ip_host(input text) RETURNS text AS $$
  SELECT CASE
    WHEN input IS NULL OR btrim(input) = '' THEN NULL
    WHEN btrim(input) ~ '^\[.+\]' THEN lower(substring(btrim(input) from 2 for position(']' in btrim(input)) - 2))
    WHEN btrim(input) ~ '^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$' THEN lower(split_part(btrim(input), ':', 1))
    ELSE lower(btrim(input))
  END;
$$ LANGUAGE sql IMMUTABLE;
--> statement-breakpoint
CREATE OR REPLACE VIEW device_platform_probe_latest AS
SELECT DISTINCT ON (supplier_device_id)
  *
FROM device_platform_probe_snapshot
ORDER BY supplier_device_id, snapshot_hour DESC;
--> statement-breakpoint
CREATE UNLOGGED TABLE device_platform_probe_staging_inventory (
  job_run_id text NOT NULL,
  supplier_device_id text NOT NULL,
  supplier_id text NOT NULL,
  data_center_id text,
  internal_ip varchar(45),
  ip_host text,
  idc_key text,
  region_key text,
  bm_region_key text,
  ops_status varchar(64) NOT NULL,
  lifecycle_status varchar(32) NOT NULL,
  in_maintenance boolean NOT NULL DEFAULT false,
  sn varchar(64) NOT NULL,
  data_center_name varchar(255),
  external_ip varchar(45),
  idc_code varchar(64),
  gpu_card_type_name varchar(128),
  gpu_count integer,
  container_instance_region varchar(128),
  bare_metal_region varchar(128)
);
--> statement-breakpoint
CREATE INDEX device_platform_probe_staging_inventory_job_idx ON device_platform_probe_staging_inventory (job_run_id);
--> statement-breakpoint
CREATE INDEX device_platform_probe_staging_inventory_idc_ip_idx ON device_platform_probe_staging_inventory (job_run_id, idc_key, ip_host);
--> statement-breakpoint
CREATE UNLOGGED TABLE device_platform_probe_staging_proxy (
  job_run_id text NOT NULL,
  platform_device_id varchar(64),
  idc_key text,
  ip_host text,
  raw_inner_ip varchar(45),
  rent_status varchar(64),
  is_container_instance boolean,
  payload jsonb
);
--> statement-breakpoint
CREATE INDEX device_platform_probe_staging_proxy_job_idc_ip_idx ON device_platform_probe_staging_proxy (job_run_id, idc_key, ip_host);
--> statement-breakpoint
CREATE UNLOGGED TABLE device_platform_probe_staging_k8s (
  job_run_id text NOT NULL,
  platform_node_id varchar(64),
  region_key text,
  ip_host text,
  raw_inner_ip varchar(45),
  device_name varchar(255),
  gpu_name varchar(128),
  gpu_count integer,
  hash varchar(128),
  payload jsonb
);
--> statement-breakpoint
CREATE INDEX device_platform_probe_staging_k8s_job_region_ip_idx ON device_platform_probe_staging_k8s (job_run_id, region_key, ip_host);
--> statement-breakpoint
CREATE UNLOGGED TABLE device_platform_probe_staging_bare_metal (
  job_run_id text NOT NULL,
  bare_metal_order_id text,
  bare_metal_order_device_id text,
  bm_region_key text,
  idc_key text,
  ip_host text,
  order_no varchar(64),
  order_status varchar(32),
  tenant_name varchar(255),
  rent_ends_at timestamp with time zone,
  payload jsonb
);
--> statement-breakpoint
CREATE INDEX device_platform_probe_staging_bm_job_region_ip_idx ON device_platform_probe_staging_bare_metal (job_run_id, bm_region_key, ip_host);
--> statement-breakpoint
CREATE INDEX device_platform_probe_staging_bm_job_idc_ip_idx ON device_platform_probe_staging_bare_metal (job_run_id, idc_key, ip_host);
--> statement-breakpoint
INSERT INTO device_platform_probe_state (id) VALUES ('default') ON CONFLICT DO NOTHING;
