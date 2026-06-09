CREATE TABLE "platform_tenant_blacklist" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_blacklist_id" integer NOT NULL,
	"blacklist_type" varchar(32) NOT NULL,
	"platform_tenant_id" varchar(128) NOT NULL,
	"status" varchar(16) NOT NULL,
	"platform_tenant_name" varchar(255),
	"remark" text,
	"merchant_id" integer,
	"platform_created_at" timestamp with time zone,
	"platform_updated_at" timestamp with time zone,
	"local_tenant_id" text,
	"last_synced_at" timestamp with time zone NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_conversion_setting" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"reason" varchar(32) NOT NULL,
	"signed_on" date NOT NULL,
	"conversion_date" date NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_opportunity_source_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_source" varchar(32) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "tenant_blacklist_sync_job_run" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger" varchar(32) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(32) NOT NULL,
	"data_start_time" text DEFAULT '' NOT NULL,
	"data_end_time" text NOT NULL,
	"safety_days" integer NOT NULL,
	"full_sync" boolean DEFAULT false NOT NULL,
	"platform_count" integer DEFAULT 0 NOT NULL,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"upserted_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "tenant_blacklist_sync_state" (
	"id" text PRIMARY KEY NOT NULL,
	"last_pull_end_date" date,
	"default_safety_days" integer DEFAULT 2 NOT NULL,
	"last_job_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_personal_income_summary" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"summary_kind" varchar(32) NOT NULL,
	"balance_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"bare_metal_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"total_consumption" numeric(15, 4) NOT NULL,
	"matched_tenant_count" integer DEFAULT 0 NOT NULL,
	"tenant_bill_batch_id" text,
	"baremetal_batch_id" text,
	"rule_version" varchar(32),
	"last_computed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_cost_commission_derive_am_phase" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"account_manager_staff_id" text NOT NULL,
	"month_phase" varchar(32) NOT NULL,
	"project_count" integer DEFAULT 0 NOT NULL,
	"gross_profit_base_sum" numeric(15, 4) DEFAULT '0' NOT NULL,
	"sales_commission_sum" numeric(15, 4) DEFAULT '0' NOT NULL,
	"flex_consumption_sum" numeric(15, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_cost_commission_derive_dept_phase" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"recipient_dept" varchar(32) NOT NULL,
	"month_phase" varchar(32) NOT NULL,
	"gross_profit_base_sum" numeric(15, 4) DEFAULT '0' NOT NULL,
	"commission_pool_sum" numeric(15, 4) DEFAULT '0' NOT NULL,
	"project_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_cost_commission_derive_issue" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"project_id" text,
	"code" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_cost_commission_derive_line" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"project_id" text NOT NULL,
	"recipient_role" varchar(32) NOT NULL,
	"recipient_staff_id" text,
	"recipient_dept" varchar(32),
	"month_phase" varchar(32) NOT NULL,
	"rate" numeric(15, 4) DEFAULT '0' NOT NULL,
	"platform_ratio" numeric(15, 4) DEFAULT '1' NOT NULL,
	"gross_profit_base" numeric(15, 4) DEFAULT '0' NOT NULL,
	"commission_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_cost_commission_derive_project" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"project_id" text NOT NULL,
	"settlement_month" varchar(7) NOT NULL,
	"flex_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"gross_profit_base" numeric(15, 4) DEFAULT '0' NOT NULL,
	"gross_profit_rate_display" numeric(15, 4),
	"opportunity_source" varchar(32),
	"deal_closed_month" varchar(7),
	"month_phase" varchar(32),
	"months_since_deal" integer,
	"account_manager_staff_id" text,
	"revenue_department" varchar(32),
	"skipped_commission" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_cost_commission_derive_run" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"policy_code" varchar(64) NOT NULL,
	"run_version" integer DEFAULT 1 NOT NULL,
	"status" varchar(32) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "internal_effective_from" date;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "internal_effective_to" date;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "opportunity_source" varchar(32);--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "deal_closed_month" varchar(7);--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "commission_month_phase" varchar(32);--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "commission_phase_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_period" ADD COLUMN "enterprise_income" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "billing_period" ADD COLUMN "personal_income" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "billing_period" ADD COLUMN "income_total" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "billing_period" ADD COLUMN "project_cost" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "billing_period" ADD COLUMN "internal_user_cost" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "billing_period" ADD COLUMN "ignore_list_price_windows" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" ADD COLUMN "balance_card_hours_before" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" ADD COLUMN "balance_card_hours_after" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" ADD COLUMN "sold_duration_cost_excl_tax_before" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" ADD COLUMN "sold_duration_cost_excl_tax_after" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "platform_tenant_blacklist" ADD CONSTRAINT "platform_tenant_blacklist_local_tenant_id_tenant_id_fk" FOREIGN KEY ("local_tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_conversion_setting" ADD CONSTRAINT "project_conversion_setting_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_conversion_setting" ADD CONSTRAINT "project_conversion_setting_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_opportunity_source_assignment" ADD CONSTRAINT "project_opportunity_source_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_opportunity_source_assignment" ADD CONSTRAINT "project_opportunity_source_assignment_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_personal_income_summary" ADD CONSTRAINT "billing_period_personal_income_summary_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_personal_income_summary" ADD CONSTRAINT "billing_period_personal_income_summary_tenant_bill_batch_id_billing_period_import_batch_id_fk" FOREIGN KEY ("tenant_bill_batch_id") REFERENCES "public"."billing_period_import_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_personal_income_summary" ADD CONSTRAINT "billing_period_personal_income_summary_baremetal_batch_id_billing_period_import_batch_id_fk" FOREIGN KEY ("baremetal_batch_id") REFERENCES "public"."billing_period_import_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_commission_derive_am_phase" ADD CONSTRAINT "platform_cost_commission_derive_am_phase_run_id_platform_cost_commission_derive_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."platform_cost_commission_derive_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_commission_derive_am_phase" ADD CONSTRAINT "platform_cost_commission_derive_am_phase_account_manager_staff_id_user_staff_id_fk" FOREIGN KEY ("account_manager_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_commission_derive_dept_phase" ADD CONSTRAINT "platform_cost_commission_derive_dept_phase_run_id_platform_cost_commission_derive_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."platform_cost_commission_derive_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_commission_derive_issue" ADD CONSTRAINT "platform_cost_commission_derive_issue_run_id_platform_cost_commission_derive_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."platform_cost_commission_derive_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_commission_derive_issue" ADD CONSTRAINT "platform_cost_commission_derive_issue_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_commission_derive_line" ADD CONSTRAINT "platform_cost_commission_derive_line_run_id_platform_cost_commission_derive_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."platform_cost_commission_derive_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_commission_derive_line" ADD CONSTRAINT "platform_cost_commission_derive_line_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_commission_derive_line" ADD CONSTRAINT "platform_cost_commission_derive_line_recipient_staff_id_user_staff_id_fk" FOREIGN KEY ("recipient_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_commission_derive_project" ADD CONSTRAINT "platform_cost_commission_derive_project_run_id_platform_cost_commission_derive_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."platform_cost_commission_derive_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_commission_derive_project" ADD CONSTRAINT "platform_cost_commission_derive_project_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_commission_derive_project" ADD CONSTRAINT "platform_cost_commission_derive_project_account_manager_staff_id_user_staff_id_fk" FOREIGN KEY ("account_manager_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_commission_derive_run" ADD CONSTRAINT "platform_cost_commission_derive_run_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_tenant_blacklist_platform_id_uk" ON "platform_tenant_blacklist" USING btree ("platform_blacklist_id");--> statement-breakpoint
CREATE INDEX "platform_tenant_blacklist_platform_tenant_id_idx" ON "platform_tenant_blacklist" USING btree ("platform_tenant_id");--> statement-breakpoint
CREATE INDEX "platform_tenant_blacklist_status_idx" ON "platform_tenant_blacklist" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_tenant_blacklist_removed_at_idx" ON "platform_tenant_blacklist" USING btree ("removed_at");--> statement-breakpoint
CREATE INDEX "platform_tenant_blacklist_platform_updated_at_idx" ON "platform_tenant_blacklist" USING btree ("platform_updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_conversion_setting_project_id_uk" ON "project_conversion_setting" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_conversion_setting_conversion_date_idx" ON "project_conversion_setting" USING btree ("conversion_date");--> statement-breakpoint
CREATE UNIQUE INDEX "project_opportunity_source_assignment_current_uk" ON "project_opportunity_source_assignment" USING btree ("project_id") WHERE "project_opportunity_source_assignment"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "project_opportunity_source_assignment_project_id_idx" ON "project_opportunity_source_assignment" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_opportunity_source_assignment_effective_from_idx" ON "project_opportunity_source_assignment" USING btree ("project_id","effective_from");--> statement-breakpoint
CREATE INDEX "tenant_blacklist_sync_job_run_started_at_idx" ON "tenant_blacklist_sync_job_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "tenant_blacklist_sync_job_run_status_idx" ON "tenant_blacklist_sync_job_run" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_personal_income_summary_period_kind_uk" ON "billing_period_personal_income_summary" USING btree ("billing_period_id","summary_kind");--> statement-breakpoint
CREATE INDEX "billing_period_personal_income_summary_period_id_idx" ON "billing_period_personal_income_summary" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_commission_derive_am_phase_run_am_phase_uk" ON "platform_cost_commission_derive_am_phase" USING btree ("run_id","account_manager_staff_id","month_phase");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_commission_derive_dept_phase_run_dept_phase_uk" ON "platform_cost_commission_derive_dept_phase" USING btree ("run_id","recipient_dept","month_phase");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_commission_derive_issue_run_project_code_uk" ON "platform_cost_commission_derive_issue" USING btree ("run_id","project_id","code");--> statement-breakpoint
CREATE INDEX "platform_cost_commission_derive_issue_run_idx" ON "platform_cost_commission_derive_issue" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_commission_derive_line_run_project_role_uk" ON "platform_cost_commission_derive_line" USING btree ("run_id","project_id","recipient_role");--> statement-breakpoint
CREATE INDEX "platform_cost_commission_derive_line_run_idx" ON "platform_cost_commission_derive_line" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_commission_derive_project_run_project_uk" ON "platform_cost_commission_derive_project" USING btree ("run_id","project_id");--> statement-breakpoint
CREATE INDEX "platform_cost_commission_derive_project_run_idx" ON "platform_cost_commission_derive_project" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "platform_cost_commission_derive_run_period_idx" ON "platform_cost_commission_derive_run" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_commission_derive_run_period_policy_ver_uk" ON "platform_cost_commission_derive_run" USING btree ("billing_period_id","policy_code","run_version");--> statement-breakpoint
CREATE INDEX "project_opportunity_source_idx" ON "project" USING btree ("opportunity_source");--> statement-breakpoint
CREATE INDEX "project_deal_closed_month_idx" ON "project" USING btree ("deal_closed_month");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_personal_tenant_bill_uk" ON "billing_period_import_batch" USING btree ("billing_period_id") WHERE "billing_period_import_batch"."file_type" = 'personal_tenant_bill';--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_personal_baremetal_uk" ON "billing_period_import_batch" USING btree ("billing_period_id") WHERE "billing_period_import_batch"."file_type" = 'personal_baremetal_order';--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" DROP COLUMN "voucher_card_hours_before";--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" DROP COLUMN "voucher_card_hours_after";--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" DROP COLUMN "gifted_duration_cost_excl_tax_before";--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" DROP COLUMN "gifted_duration_cost_excl_tax_after";