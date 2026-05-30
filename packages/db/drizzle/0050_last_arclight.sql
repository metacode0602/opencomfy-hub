CREATE TABLE "dashboard_etl_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"job_code" varchar(64) NOT NULL,
	"granularity" varchar(16) NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"bucket_end" timestamp with time zone,
	"status" varchar(32) DEFAULT 'running' NOT NULL,
	"rows_affected" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_daily_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"supplier_device_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text,
	"gpu_card_type_id" text NOT NULL,
	"gpu_count" integer NOT NULL,
	"lifecycle_status" varchar(32) NOT NULL,
	"ops_status" varchar(64) NOT NULL,
	"in_maintenance" boolean DEFAULT false NOT NULL,
	"is_online_at_end" boolean DEFAULT false NOT NULL,
	"online_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"pool_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"idc_code" varchar(64),
	"idc_region" varchar(64),
	"cooperation_type" varchar(32),
	"etl_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_hourly_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_hour" timestamp with time zone NOT NULL,
	"supplier_device_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text,
	"gpu_card_type_id" text NOT NULL,
	"gpu_count" integer NOT NULL,
	"lifecycle_status" varchar(32) NOT NULL,
	"ops_status" varchar(64) NOT NULL,
	"in_maintenance" boolean DEFAULT false NOT NULL,
	"is_online_at_end" boolean DEFAULT false NOT NULL,
	"online_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"pool_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"idc_code" varchar(64),
	"idc_region" varchar(64),
	"cooperation_type" varchar(32),
	"etl_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_lifecycle_event" (
	"id" text PRIMARY KEY NOT NULL,
	"event_kind" varchar(32) DEFAULT 'state_transition' NOT NULL,
	"supplier_device_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text,
	"gpu_card_type_id" text NOT NULL,
	"gpu_count" integer NOT NULL,
	"from_lifecycle_status" varchar(32) NOT NULL,
	"to_lifecycle_status" varchar(32) NOT NULL,
	"from_ops_status" varchar(64),
	"to_ops_status" varchar(64),
	"occurred_at" timestamp with time zone NOT NULL,
	"source_change_log_id" text,
	"business_onboarding_batch_id" text,
	"source_transition_log_id" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_pool_daily_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"supplier_device_id" text NOT NULL,
	"pool_code" varchar(64) NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"gpu_count" integer NOT NULL,
	"online_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"machine_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"etl_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_pool_hourly_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_hour" timestamp with time zone NOT NULL,
	"supplier_device_id" text NOT NULL,
	"pool_code" varchar(64) NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"gpu_count" integer NOT NULL,
	"online_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"machine_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"etl_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_kpi_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"metric_key" varchar(64) NOT NULL,
	"value_numeric" numeric(15, 4) DEFAULT '0' NOT NULL,
	"device_count" integer,
	"gpu_count" integer,
	"net_change" numeric(15, 4),
	"delta_percent" numeric(15, 4),
	"unit" varchar(16),
	"etl_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_kpi_hourly" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_hour" timestamp with time zone NOT NULL,
	"metric_key" varchar(64) NOT NULL,
	"value_numeric" numeric(15, 4) DEFAULT '0' NOT NULL,
	"device_count" integer,
	"gpu_count" integer,
	"net_change" numeric(15, 4),
	"delta_percent" numeric(15, 4),
	"unit" varchar(16),
	"etl_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lifecycle_stage_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"stage_code" varchar(32) NOT NULL,
	"wip_end_device_count" integer DEFAULT 0 NOT NULL,
	"wip_end_gpu_count" integer DEFAULT 0 NOT NULL,
	"throughput_device_count" integer DEFAULT 0 NOT NULL,
	"avg_dwell_seconds" numeric(15, 2),
	"etl_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lifecycle_stage_hourly" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_hour" timestamp with time zone NOT NULL,
	"stage_code" varchar(32) NOT NULL,
	"wip_end_device_count" integer DEFAULT 0 NOT NULL,
	"wip_end_gpu_count" integer DEFAULT 0 NOT NULL,
	"throughput_device_count" integer DEFAULT 0 NOT NULL,
	"avg_dwell_seconds" numeric(15, 2),
	"etl_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_binding_history" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_device_id" text NOT NULL,
	"pool_code" varchar(64) NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"source_binding_id" text,
	"change_reason" varchar(64),
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_pool_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"pool_code" varchar(64) NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"online_gpu_cards_end" integer DEFAULT 0 NOT NULL,
	"device_count_end" integer DEFAULT 0 NOT NULL,
	"machine_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"online_gpu_cards_net_change" integer,
	"card_hours_net_change" numeric(15, 4),
	"etl_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_pool_hourly" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_hour" timestamp with time zone NOT NULL,
	"pool_code" varchar(64) NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"online_gpu_cards_end" integer DEFAULT 0 NOT NULL,
	"device_count_end" integer DEFAULT 0 NOT NULL,
	"machine_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"online_gpu_cards_net_change" integer,
	"card_hours_net_change" numeric(15, 4),
	"etl_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_daily_snapshot" ADD CONSTRAINT "device_daily_snapshot_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_daily_snapshot" ADD CONSTRAINT "device_daily_snapshot_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_daily_snapshot" ADD CONSTRAINT "device_daily_snapshot_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_daily_snapshot" ADD CONSTRAINT "device_daily_snapshot_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_hourly_snapshot" ADD CONSTRAINT "device_hourly_snapshot_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_hourly_snapshot" ADD CONSTRAINT "device_hourly_snapshot_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_hourly_snapshot" ADD CONSTRAINT "device_hourly_snapshot_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_hourly_snapshot" ADD CONSTRAINT "device_hourly_snapshot_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_lifecycle_event" ADD CONSTRAINT "device_lifecycle_event_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_lifecycle_event" ADD CONSTRAINT "device_lifecycle_event_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_lifecycle_event" ADD CONSTRAINT "device_lifecycle_event_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_lifecycle_event" ADD CONSTRAINT "device_lifecycle_event_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_lifecycle_event" ADD CONSTRAINT "device_lifecycle_event_source_change_log_id_supplier_device_change_log_id_fk" FOREIGN KEY ("source_change_log_id") REFERENCES "public"."supplier_device_change_log"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_lifecycle_event" ADD CONSTRAINT "device_lifecycle_event_business_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("business_onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pool_daily_snapshot" ADD CONSTRAINT "device_pool_daily_snapshot_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pool_daily_snapshot" ADD CONSTRAINT "device_pool_daily_snapshot_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pool_hourly_snapshot" ADD CONSTRAINT "device_pool_hourly_snapshot_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pool_hourly_snapshot" ADD CONSTRAINT "device_pool_hourly_snapshot_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_binding_history" ADD CONSTRAINT "pool_binding_history_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_binding_history" ADD CONSTRAINT "pool_binding_history_source_binding_id_resource_pool_binding_id_fk" FOREIGN KEY ("source_binding_id") REFERENCES "public"."resource_pool_binding"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_pool_daily" ADD CONSTRAINT "resource_pool_daily_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_pool_hourly" ADD CONSTRAINT "resource_pool_hourly_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dashboard_etl_batch_job_bucket_idx" ON "dashboard_etl_batch" USING btree ("job_code","granularity","bucket_start");--> statement-breakpoint
CREATE INDEX "dashboard_etl_batch_status_idx" ON "dashboard_etl_batch" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "device_daily_snapshot_uk" ON "device_daily_snapshot" USING btree ("snapshot_date","supplier_device_id");--> statement-breakpoint
CREATE INDEX "device_daily_snapshot_date_idx" ON "device_daily_snapshot" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "device_daily_snapshot_device_date_idx" ON "device_daily_snapshot" USING btree ("supplier_device_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "device_daily_snapshot_lifecycle_date_idx" ON "device_daily_snapshot" USING btree ("lifecycle_status","snapshot_date");--> statement-breakpoint
CREATE INDEX "device_daily_snapshot_gpu_card_type_date_idx" ON "device_daily_snapshot" USING btree ("gpu_card_type_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "device_daily_snapshot_data_center_date_idx" ON "device_daily_snapshot" USING btree ("data_center_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "device_hourly_snapshot_uk" ON "device_hourly_snapshot" USING btree ("snapshot_hour","supplier_device_id");--> statement-breakpoint
CREATE INDEX "device_hourly_snapshot_hour_idx" ON "device_hourly_snapshot" USING btree ("snapshot_hour");--> statement-breakpoint
CREATE INDEX "device_hourly_snapshot_device_hour_idx" ON "device_hourly_snapshot" USING btree ("supplier_device_id","snapshot_hour");--> statement-breakpoint
CREATE INDEX "device_hourly_snapshot_lifecycle_hour_idx" ON "device_hourly_snapshot" USING btree ("lifecycle_status","snapshot_hour");--> statement-breakpoint
CREATE INDEX "device_hourly_snapshot_gpu_card_type_hour_idx" ON "device_hourly_snapshot" USING btree ("gpu_card_type_id","snapshot_hour");--> statement-breakpoint
CREATE INDEX "device_lifecycle_event_device_occurred_idx" ON "device_lifecycle_event" USING btree ("supplier_device_id","occurred_at");--> statement-breakpoint
CREATE INDEX "device_lifecycle_event_occurred_idx" ON "device_lifecycle_event" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "device_lifecycle_event_to_status_idx" ON "device_lifecycle_event" USING btree ("to_lifecycle_status","occurred_at");--> statement-breakpoint
CREATE INDEX "device_lifecycle_event_supplier_id_idx" ON "device_lifecycle_event" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "device_lifecycle_event_data_center_id_idx" ON "device_lifecycle_event" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "device_lifecycle_event_event_kind_idx" ON "device_lifecycle_event" USING btree ("event_kind","occurred_at");--> statement-breakpoint
CREATE INDEX "device_lifecycle_event_business_batch_id_idx" ON "device_lifecycle_event" USING btree ("business_onboarding_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_pool_daily_snapshot_uk" ON "device_pool_daily_snapshot" USING btree ("snapshot_date","supplier_device_id","pool_code");--> statement-breakpoint
CREATE INDEX "device_pool_daily_snapshot_date_pool_idx" ON "device_pool_daily_snapshot" USING btree ("snapshot_date","pool_code");--> statement-breakpoint
CREATE INDEX "device_pool_daily_snapshot_pool_card_type_date_idx" ON "device_pool_daily_snapshot" USING btree ("pool_code","gpu_card_type_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "device_pool_hourly_snapshot_uk" ON "device_pool_hourly_snapshot" USING btree ("snapshot_hour","supplier_device_id","pool_code");--> statement-breakpoint
CREATE INDEX "device_pool_hourly_snapshot_hour_pool_idx" ON "device_pool_hourly_snapshot" USING btree ("snapshot_hour","pool_code");--> statement-breakpoint
CREATE INDEX "device_pool_hourly_snapshot_pool_card_type_hour_idx" ON "device_pool_hourly_snapshot" USING btree ("pool_code","gpu_card_type_id","snapshot_hour");--> statement-breakpoint
CREATE UNIQUE INDEX "global_kpi_daily_uk" ON "global_kpi_daily" USING btree ("snapshot_date","metric_key");--> statement-breakpoint
CREATE INDEX "global_kpi_daily_date_idx" ON "global_kpi_daily" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "global_kpi_daily_metric_date_idx" ON "global_kpi_daily" USING btree ("metric_key","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "global_kpi_hourly_uk" ON "global_kpi_hourly" USING btree ("snapshot_hour","metric_key");--> statement-breakpoint
CREATE INDEX "global_kpi_hourly_hour_idx" ON "global_kpi_hourly" USING btree ("snapshot_hour");--> statement-breakpoint
CREATE INDEX "global_kpi_hourly_metric_hour_idx" ON "global_kpi_hourly" USING btree ("metric_key","snapshot_hour");--> statement-breakpoint
CREATE UNIQUE INDEX "lifecycle_stage_daily_uk" ON "lifecycle_stage_daily" USING btree ("snapshot_date","stage_code");--> statement-breakpoint
CREATE INDEX "lifecycle_stage_daily_date_idx" ON "lifecycle_stage_daily" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "lifecycle_stage_daily_stage_date_idx" ON "lifecycle_stage_daily" USING btree ("stage_code","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "lifecycle_stage_hourly_uk" ON "lifecycle_stage_hourly" USING btree ("snapshot_hour","stage_code");--> statement-breakpoint
CREATE INDEX "lifecycle_stage_hourly_hour_idx" ON "lifecycle_stage_hourly" USING btree ("snapshot_hour");--> statement-breakpoint
CREATE INDEX "lifecycle_stage_hourly_stage_hour_idx" ON "lifecycle_stage_hourly" USING btree ("stage_code","snapshot_hour");--> statement-breakpoint
CREATE INDEX "pool_binding_history_device_pool_from_idx" ON "pool_binding_history" USING btree ("supplier_device_id","pool_code","effective_from");--> statement-breakpoint
CREATE INDEX "pool_binding_history_pool_effective_idx" ON "pool_binding_history" USING btree ("pool_code","effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "pool_binding_history_effective_from_idx" ON "pool_binding_history" USING btree ("effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_pool_daily_uk" ON "resource_pool_daily" USING btree ("snapshot_date","pool_code","gpu_card_type_id");--> statement-breakpoint
CREATE INDEX "resource_pool_daily_date_pool_idx" ON "resource_pool_daily" USING btree ("snapshot_date","pool_code");--> statement-breakpoint
CREATE INDEX "resource_pool_daily_pool_date_idx" ON "resource_pool_daily" USING btree ("pool_code","snapshot_date");--> statement-breakpoint
CREATE INDEX "resource_pool_daily_card_type_date_idx" ON "resource_pool_daily" USING btree ("gpu_card_type_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_pool_hourly_uk" ON "resource_pool_hourly" USING btree ("snapshot_hour","pool_code","gpu_card_type_id");--> statement-breakpoint
CREATE INDEX "resource_pool_hourly_hour_pool_idx" ON "resource_pool_hourly" USING btree ("snapshot_hour","pool_code");--> statement-breakpoint
CREATE INDEX "resource_pool_hourly_pool_hour_idx" ON "resource_pool_hourly" USING btree ("pool_code","snapshot_hour");