CREATE TABLE "supplier_device_change_log" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_device_id" text NOT NULL,
	"onboarding_batch_id" text NOT NULL,
	"internal_ip" varchar(45),
	"occurred_at" timestamp with time zone NOT NULL,
	"change_action" varchar(64) NOT NULL,
	"change_content" text,
	"description" text,
	"ticket_no" varchar(64),
	"import_row_no" integer,
	"previous_ops_status" varchar(64),
	"new_ops_status" varchar(64),
	"previous_lifecycle_status" varchar(32),
	"new_lifecycle_status" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fault_incident" ALTER COLUMN "severity" SET DEFAULT 'P3';--> statement-breakpoint
ALTER TABLE "compute_node" ADD COLUMN "cluster_name" varchar(128);--> statement-breakpoint
ALTER TABLE "compute_node" ADD COLUMN "node_name" varchar(128);--> statement-breakpoint
ALTER TABLE "compute_node" ADD COLUMN "expected_service" varchar(255);--> statement-breakpoint
ALTER TABLE "fault_incident" ADD COLUMN "supplier_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD COLUMN "supplier_ops_upload_batch_id" text;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD COLUMN "fault_type" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD COLUMN "impact_minutes" integer;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD COLUMN "impact_scope" varchar(255);--> statement-breakpoint
ALTER TABLE "fault_incident" ADD COLUMN "affected_device_count" integer;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD COLUMN "postmortem" text;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_device" ADD COLUMN "external_device_id" varchar(128);--> statement-breakpoint
ALTER TABLE "supplier_device" ADD COLUMN "ops_status" varchar(64) DEFAULT '预留闲置中' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_device" ADD COLUMN "in_maintenance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_device" ADD COLUMN "bandwidth_group" varchar(64);--> statement-breakpoint
ALTER TABLE "supplier_device" ADD COLUMN "rate_limit" varchar(64);--> statement-breakpoint
ALTER TABLE "supplier_device" ADD COLUMN "device_spec" text;--> statement-breakpoint
ALTER TABLE "supplier_device" ADD COLUMN "received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "supplier_device" ADD COLUMN "remark" text;--> statement-breakpoint
ALTER TABLE "supplier_device" ADD COLUMN "login_username" varchar(128);--> statement-breakpoint
ALTER TABLE "supplier_device" ADD COLUMN "login_password" text;--> statement-breakpoint
ALTER TABLE "supplier_ops_upload_batch" ADD COLUMN "import_status" varchar(32) DEFAULT 'uploaded' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_ops_upload_batch" ADD COLUMN "parsed_row_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_ops_upload_batch" ADD COLUMN "parsed_success_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_ops_upload_batch" ADD COLUMN "committed_incident_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_ops_upload_batch" ADD COLUMN "committed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "supplier_ops_upload_batch" ADD COLUMN "created_by_staff_id" text;--> statement-breakpoint
ALTER TABLE "supplier_device_change_log" ADD CONSTRAINT "supplier_device_change_log_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_device_change_log" ADD CONSTRAINT "supplier_device_change_log_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_device_change_log_batch_row_uk" ON "supplier_device_change_log" USING btree ("onboarding_batch_id","import_row_no");--> statement-breakpoint
CREATE INDEX "supplier_device_change_log_device_occurred_idx" ON "supplier_device_change_log" USING btree ("supplier_device_id","occurred_at");--> statement-breakpoint
CREATE INDEX "supplier_device_change_log_batch_id_idx" ON "supplier_device_change_log" USING btree ("onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "supplier_device_change_log_ticket_no_idx" ON "supplier_device_change_log" USING btree ("ticket_no");--> statement-breakpoint
ALTER TABLE "fault_incident" ADD CONSTRAINT "fault_incident_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD CONSTRAINT "fault_incident_supplier_ops_upload_batch_id_supplier_ops_upload_batch_id_fk" FOREIGN KEY ("supplier_ops_upload_batch_id") REFERENCES "public"."supplier_ops_upload_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ops_upload_batch" ADD CONSTRAINT "supplier_ops_upload_batch_created_by_staff_id_user_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fault_incident_supplier_id_opened_idx" ON "fault_incident" USING btree ("supplier_id","opened_at");--> statement-breakpoint
CREATE INDEX "fault_incident_ops_upload_batch_id_idx" ON "fault_incident" USING btree ("supplier_ops_upload_batch_id");--> statement-breakpoint
CREATE INDEX "fault_incident_fault_type_idx" ON "fault_incident" USING btree ("fault_type");--> statement-breakpoint
CREATE INDEX "supplier_device_ops_status_idx" ON "supplier_device" USING btree ("ops_status");--> statement-breakpoint
CREATE INDEX "supplier_device_in_maintenance_idx" ON "supplier_device" USING btree ("in_maintenance");--> statement-breakpoint
CREATE INDEX "supplier_device_external_device_id_idx" ON "supplier_device" USING btree ("external_device_id");--> statement-breakpoint
CREATE INDEX "supplier_ops_upload_batch_import_status_idx" ON "supplier_ops_upload_batch" USING btree ("import_status");