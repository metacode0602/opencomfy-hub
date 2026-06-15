-- device platform probe (supplier-device-platform-probe-design.md v1.4)

CREATE OR REPLACE FUNCTION normalize_idc_key(input text) RETURNS text AS $$
  SELECT CASE
    WHEN input IS NULL OR btrim(input) = '' THEN NULL
    ELSE lower(regexp_replace(btrim(input), '\s+', ' ', 'g'))
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION normalize_region_key(input text) RETURNS text AS $$
  SELECT CASE
    WHEN input IS NULL OR btrim(input) = '' THEN NULL
    ELSE lower(btrim(input))
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION normalize_ip_host(input text) RETURNS text AS $$
  SELECT CASE
    WHEN input IS NULL OR btrim(input) = '' THEN NULL
    WHEN btrim(input) ~ '^\[.+\]' THEN lower(substring(btrim(input) from 2 for position(']' in btrim(input)) - 2))
    WHEN btrim(input) ~ '^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$' THEN lower(split_part(btrim(input), ':', 1))
    ELSE lower(btrim(input))
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE "device_platform_probe_state" (
  "id" text PRIMARY KEY NOT NULL,
  "last_run_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "last_snapshot_hour" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

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

CREATE INDEX "device_platform_probe_job_run_started_at_idx" ON "device_platform_probe_job_run" ("started_at");
CREATE INDEX "device_platform_probe_job_run_status_idx" ON "device_platform_probe_job_run" ("status");

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

ALTER TABLE "device_platform_probe_snapshot" ADD CONSTRAINT "device_platform_probe_snapshot_job_run_id_device_platform_probe_job_run_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."device_platform_probe_job_run"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "device_platform_probe_snapshot" ADD CONSTRAINT "device_platform_probe_snapshot_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "device_platform_probe_snapshot" ADD CONSTRAINT "device_platform_probe_snapshot_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "device_platform_probe_snapshot" ADD CONSTRAINT "device_platform_probe_snapshot_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "device_platform_probe_snapshot_device_hour_uk" ON "device_platform_probe_snapshot" ("supplier_device_id","snapshot_hour");
CREATE INDEX "device_platform_probe_snapshot_hour_supplier_idx" ON "device_platform_probe_snapshot" ("snapshot_hour","supplier_id");
CREATE INDEX "device_platform_probe_snapshot_hour_dc_idx" ON "device_platform_probe_snapshot" ("snapshot_hour","data_center_id");
CREATE INDEX "device_platform_probe_snapshot_hour_probe_status_idx" ON "device_platform_probe_snapshot" ("snapshot_hour","probe_status");
CREATE INDEX "device_platform_probe_snapshot_hour_consistency_idx" ON "device_platform_probe_snapshot" ("snapshot_hour","consistency_flag");
CREATE INDEX "device_platform_probe_snapshot_device_hour_desc_idx" ON "device_platform_probe_snapshot" ("supplier_device_id","snapshot_hour");

CREATE OR REPLACE VIEW device_platform_probe_latest AS
SELECT DISTINCT ON (supplier_device_id)
  *
FROM device_platform_probe_snapshot
ORDER BY supplier_device_id, snapshot_hour DESC;

-- UNLOGGED staging tables (PO-1)
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

CREATE INDEX device_platform_probe_staging_inventory_job_idx ON device_platform_probe_staging_inventory (job_run_id);
CREATE INDEX device_platform_probe_staging_inventory_idc_ip_idx ON device_platform_probe_staging_inventory (job_run_id, idc_key, ip_host);

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

CREATE INDEX device_platform_probe_staging_proxy_job_idc_ip_idx ON device_platform_probe_staging_proxy (job_run_id, idc_key, ip_host);

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

CREATE INDEX device_platform_probe_staging_k8s_job_region_ip_idx ON device_platform_probe_staging_k8s (job_run_id, region_key, ip_host);

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

CREATE INDEX device_platform_probe_staging_bm_job_region_ip_idx ON device_platform_probe_staging_bare_metal (job_run_id, bm_region_key, ip_host);
CREATE INDEX device_platform_probe_staging_bm_job_idc_ip_idx ON device_platform_probe_staging_bare_metal (job_run_id, idc_key, ip_host);

INSERT INTO device_platform_probe_state (id) VALUES ('default') ON CONFLICT DO NOTHING;
