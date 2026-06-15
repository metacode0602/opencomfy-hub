ALTER TABLE "supplier_device_change_log" ADD COLUMN IF NOT EXISTS "external_device_id" varchar(64);--> statement-breakpoint
ALTER TABLE "supplier_device_change_log" ADD COLUMN IF NOT EXISTS "attachment_names" text;
