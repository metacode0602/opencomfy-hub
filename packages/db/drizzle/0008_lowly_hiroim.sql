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
ALTER TABLE "device_platform_probe_snapshot" ADD CONSTRAINT "device_platform_probe_snapshot_job_run_id_device_platform_probe_job_run_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."device_platform_probe_job_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD CONSTRAINT "device_platform_probe_snapshot_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD CONSTRAINT "device_platform_probe_snapshot_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD CONSTRAINT "device_platform_probe_snapshot_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_platform_probe_job_run_started_at_idx" ON "device_platform_probe_job_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "device_platform_probe_job_run_status_idx" ON "device_platform_probe_job_run" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "device_platform_probe_snapshot_device_hour_uk" ON "device_platform_probe_snapshot" USING btree ("supplier_device_id","snapshot_hour");--> statement-breakpoint
CREATE INDEX "device_platform_probe_snapshot_hour_supplier_idx" ON "device_platform_probe_snapshot" USING btree ("snapshot_hour","supplier_id");--> statement-breakpoint
CREATE INDEX "device_platform_probe_snapshot_hour_dc_idx" ON "device_platform_probe_snapshot" USING btree ("snapshot_hour","data_center_id");--> statement-breakpoint
CREATE INDEX "device_platform_probe_snapshot_hour_probe_status_idx" ON "device_platform_probe_snapshot" USING btree ("snapshot_hour","probe_status");--> statement-breakpoint
CREATE INDEX "device_platform_probe_snapshot_hour_consistency_idx" ON "device_platform_probe_snapshot" USING btree ("snapshot_hour","consistency_flag");--> statement-breakpoint
CREATE INDEX "device_platform_probe_snapshot_device_hour_desc_idx" ON "device_platform_probe_snapshot" USING btree ("supplier_device_id","snapshot_hour");