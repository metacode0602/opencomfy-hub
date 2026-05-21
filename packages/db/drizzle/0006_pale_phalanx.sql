ALTER TABLE "data_center" ADD COLUMN "region_tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "data_center" ADD COLUMN "external_onboarding_id" varchar(64);--> statement-breakpoint
ALTER TABLE "data_center" ADD COLUMN "platform_tenant_id" varchar(32);--> statement-breakpoint
ALTER TABLE "data_center" ADD COLUMN "container_instance_region" varchar(128);--> statement-breakpoint
ALTER TABLE "data_center" ADD COLUMN "bare_metal_region" varchar(128);--> statement-breakpoint
ALTER TABLE "data_center" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "data_center" ADD COLUMN "scale" varchar(64);--> statement-breakpoint
ALTER TABLE "data_center" ADD COLUMN "public_ip_count" integer;--> statement-breakpoint
ALTER TABLE "data_center" ADD COLUMN "internal_network_cidr" varchar(64);--> statement-breakpoint
ALTER TABLE "data_center" ADD COLUMN "audit_status" varchar(32);--> statement-breakpoint
ALTER TABLE "data_center" ADD COLUMN "audit_remark" text;--> statement-breakpoint
ALTER TABLE "data_center" ADD COLUMN "source_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "external_onboarding_id" varchar(64);--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "platform_tenant_id" varchar(32);--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "onboarding_type" varchar(16);--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "identity_no" varchar(32);--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "business_scope" text;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "business_license_uri" varchar(1024);--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "id_card_front_uri" varchar(1024);--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "id_card_back_uri" varchar(1024);--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "bank_branch_name" varchar(255);--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "bank_branch_address" text;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "admin_phone" varchar(32);--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "admin_email" varchar(255);--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "device_info_raw" text;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "audit_status" varchar(32);--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "audit_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "audit_remark" text;--> statement-breakpoint
CREATE INDEX "data_center_supplier_external_onboarding_id_idx" ON "data_center" USING btree ("supplier_id","external_onboarding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_external_onboarding_id_uk" ON "supplier" USING btree ("external_onboarding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_platform_tenant_id_uk" ON "supplier" USING btree ("platform_tenant_id");--> statement-breakpoint
CREATE INDEX "supplier_identity_no_idx" ON "supplier" USING btree ("identity_no");