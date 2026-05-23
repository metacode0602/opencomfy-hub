ALTER TABLE "billing_period_import_batch" ADD COLUMN IF NOT EXISTS "storage_path" varchar(1024) DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "billing_period_import_batch" ADD COLUMN IF NOT EXISTS "error_report_path" varchar(1024);
--> statement-breakpoint
ALTER TABLE "billing_period_import_batch" ADD COLUMN IF NOT EXISTS "file_size_bytes" integer;
--> statement-breakpoint
ALTER TABLE "billing_period_import_batch" ADD COLUMN IF NOT EXISTS "parse_status" varchar(16) DEFAULT 'ok' NOT NULL;
--> statement-breakpoint
ALTER TABLE "billing_period_import_batch" ADD COLUMN IF NOT EXISTS "parse_error_count" integer DEFAULT 0 NOT NULL;
