DROP INDEX "device_platform_probe_snapshot_device_hour_uk";--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ALTER COLUMN "supplier_device_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ALTER COLUMN "supplier_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ALTER COLUMN "ops_status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ALTER COLUMN "lifecycle_status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "device_platform_probe_job_run" ADD COLUMN "orphan_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "device_platform_probe_job_run" ADD COLUMN "missing_crm_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD COLUMN "record_kind" varchar(16) DEFAULT 'crm_inventory' NOT NULL;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD COLUMN "presence_crm" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD COLUMN "presence_proxy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD COLUMN "presence_k8s" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD COLUMN "presence_bare_metal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "device_platform_probe_snapshot" ADD COLUMN "orphan_merge_key" varchar(128);--> statement-breakpoint
CREATE UNIQUE INDEX "device_platform_probe_snapshot_crm_uk" ON "device_platform_probe_snapshot" USING btree ("supplier_device_id","snapshot_hour") WHERE record_kind = 'crm_inventory' AND supplier_device_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "device_platform_probe_snapshot_orphan_uk" ON "device_platform_probe_snapshot" USING btree ("snapshot_hour","orphan_merge_key") WHERE record_kind = 'platform_orphan' AND orphan_merge_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX "device_platform_probe_snapshot_hour_record_kind_idx" ON "device_platform_probe_snapshot" USING btree ("snapshot_hour","record_kind");