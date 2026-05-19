CREATE TABLE "billing_period" (
	"id" text PRIMARY KEY NOT NULL,
	"period_code" varchar(32) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"total_income" numeric(15, 4),
	"total_cost" numeric(15, 4),
	"total_gross_profit" numeric(15, 4),
	"supplementary" numeric(15, 4),
	"balance_income" numeric(15, 4),
	"baremetal_income" numeric(15, 4),
	"last_computed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_agg_customer_consumption" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"tenant_platform_id" varchar(128) NOT NULL,
	"customer_type" varchar(8) NOT NULL,
	"total_consumption" numeric(15, 4) NOT NULL,
	"voucher_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance_consumption" numeric(15, 4) NOT NULL,
	"source_raw_ids" jsonb NOT NULL,
	"row_count_by_type" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_import_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"file_type" varchar(32) NOT NULL,
	"file_name" varchar(512) NOT NULL,
	"file_sha256" varchar(64) NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"uploaded_by" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_operation_log" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"operation" varchar(32) NOT NULL,
	"purge_scope" varchar(32),
	"actor_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_raw_baremetal_order" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"row_no" integer NOT NULL,
	"order_id" varchar(128) NOT NULL,
	"order_no" varchar(128),
	"tenant_platform_id" varchar(128) NOT NULL,
	"idc_name" varchar(128),
	"device_model" varchar(128),
	"pay_status" varchar(32) NOT NULL,
	"device_status" varchar(32),
	"purchase_qty_text" varchar(128),
	"device_qty" integer,
	"order_amount" numeric(15, 4),
	"refund_amount" numeric(15, 4) DEFAULT '0',
	"final_amount" numeric(15, 4) NOT NULL,
	"ordered_at" timestamp with time zone NOT NULL,
	"raw_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_raw_customer_consumption" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"row_no" integer NOT NULL,
	"tenant_platform_id" varchar(128) NOT NULL,
	"product_type" varchar(128),
	"tenant_type" varchar(32),
	"customer_type" varchar(8) NOT NULL,
	"project_name_excel" varchar(255),
	"total_consumption" numeric(15, 4) NOT NULL,
	"voucher_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance_consumption" numeric(15, 4) NOT NULL,
	"raw_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_raw_tenant_bill" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"row_no" integer NOT NULL,
	"tenant_platform_id" varchar(128) NOT NULL,
	"total_consumption" numeric(15, 4) NOT NULL,
	"voucher_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance_consumption" numeric(15, 4) NOT NULL,
	"total_card_hours" numeric(15, 4),
	"voucher_card_hours" numeric(15, 4) DEFAULT '0',
	"balance_card_hours" numeric(15, 4) NOT NULL,
	"gpu_model" varchar(128) NOT NULL,
	"region_code" varchar(64) NOT NULL,
	"raw_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_reconciliation_report" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"report_json" jsonb NOT NULL,
	"rule_version" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_tenant_project_enrichment" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"tenant_platform_id" varchar(128) NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"project_name" varchar(255) NOT NULL,
	"staff_id" text,
	"account_manager_name" varchar(128),
	"source" varchar(32) NOT NULL,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_tenant_cost_allocation" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"tenant_platform_id" varchar(128) NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"allocation_percent" numeric(7, 4) NOT NULL,
	"preset_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_adjustment_history" (
	"id" text PRIMARY KEY NOT NULL,
	"income_id" text NOT NULL,
	"balance_consumption_before" numeric(15, 4),
	"balance_consumption_after" numeric(15, 4),
	"bare_metal_consumption_before" numeric(15, 4),
	"bare_metal_consumption_after" numeric(15, 4),
	"reason" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_cost_monthly" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"type" varchar(16) NOT NULL,
	"staff_id" text NOT NULL,
	"account_manager" varchar(128) NOT NULL,
	"project_id" text,
	"supplier_unit_cost_id" text,
	"idc_name" varchar(255),
	"idc_code" varchar(64),
	"card_type" varchar(128),
	"balance_consumption" numeric(15, 4),
	"balance_card_hours" numeric(15, 4),
	"voucher_card_hours" numeric(15, 4),
	"confirmed_revenue_excl_tax" numeric(15, 4),
	"sold_duration_cost_excl_tax" numeric(15, 4),
	"gifted_duration_cost_excl_tax" numeric(15, 4),
	"gross_profit" numeric(15, 4),
	"allocation_percent" numeric(7, 4),
	"source_raw_ids" jsonb,
	"list_price_per_hour" numeric(15, 4),
	"deal_unit_price_per_hour" numeric(15, 4),
	"deal_to_list_ratio" numeric(9, 6),
	"matched_tier_order" integer,
	"revenue_share_percent_applied" numeric(7, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform_income_monthly" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"customer_type" varchar(8) NOT NULL,
	"tenant_id" text NOT NULL,
	"tenant_platform_id" varchar(128) NOT NULL,
	"tenant_name" varchar(255) NOT NULL,
	"project_name" varchar(255),
	"customer_full_name" varchar(255),
	"supplementary_consumption" numeric(15, 4),
	"balance_consumption" numeric(15, 4),
	"bare_metal_consumption" numeric(15, 4),
	"total_consumption" numeric(15, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "supplementary_consumption_history" (
	"id" text PRIMARY KEY NOT NULL,
	"income_id" text NOT NULL,
	"previous_value" numeric(15, 4),
	"new_value" numeric(15, 4) NOT NULL,
	"type" varchar(32) NOT NULL,
	"remark" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_project_cost" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"allocation_percent" numeric(7, 4) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"remark" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher_card_hours_adjustment_history" (
	"id" text PRIMARY KEY NOT NULL,
	"cost_id" text NOT NULL,
	"voucher_card_hours_before" numeric(15, 4),
	"voucher_card_hours_after" numeric(15, 4),
	"adjustment_hours" numeric(15, 4) NOT NULL,
	"gifted_duration_cost_excl_tax_before" numeric(15, 4),
	"gifted_duration_cost_excl_tax_after" numeric(15, 4),
	"gross_profit_before" numeric(15, 4),
	"gross_profit_after" numeric(15, 4),
	"unit_price_per_hour" numeric(15, 4) NOT NULL,
	"reason" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_condition_sheet" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"version_no" integer NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"gpu_network_cpu_terms" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compute_node" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_device_id" text NOT NULL,
	"node_role" varchar(32) NOT NULL,
	"mgmt_ip" varchar(45),
	"cluster_id" varchar(64),
	"lifecycle_status" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_center" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" varchar(128),
	"address" text,
	"status" varchar(32) NOT NULL,
	"network_fee_monthly" numeric(15, 4) DEFAULT '0' NOT NULL,
	"mgmt_node_fee_monthly" numeric(15, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_state_transition_log" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" text NOT NULL,
	"from_state" varchar(64) NOT NULL,
	"to_state" varchar(64) NOT NULL,
	"operator_staff_id" text,
	"reason_code" varchar(64),
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "fault_incident" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_device_id" text,
	"compute_node_id" text,
	"severity" varchar(8) NOT NULL,
	"incident_status" varchar(32) NOT NULL,
	"resolution_outcome" text,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gpu_card_type" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"manufacturer" varchar(32) NOT NULL,
	"memory_gb" integer,
	"tdp_watts" integer,
	"compute_capability" varchar(64),
	"status" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_test_hold" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_device_id" text,
	"supplier_gpu_inventory_id" text,
	"scope" varchar(255) NOT NULL,
	"hold_from" timestamp with time zone NOT NULL,
	"hold_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lifecycle_state_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" varchar(32) NOT NULL,
	"state_code" varchar(64) NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_kind" varchar(32) NOT NULL,
	"supplier_id" text NOT NULL,
	"supplier_code" varchar(64) NOT NULL,
	"supplier_name" varchar(255) NOT NULL,
	"supplier_short_name" varchar(64),
	"data_center_id" text NOT NULL,
	"idc_code" varchar(64) NOT NULL,
	"data_center_name" varchar(255) NOT NULL,
	"idc_region" varchar(64),
	"contract_id" text NOT NULL,
	"access_condition_sheet_id" text NOT NULL,
	"batch_code" varchar(64) NOT NULL,
	"batch_status" varchar(32) NOT NULL,
	"planned_ready_at" timestamp with time zone,
	"access_method" varchar(32) NOT NULL,
	"import_file_name" varchar(255),
	"import_file_uri" varchar(1024),
	"import_file_mime_type" varchar(128),
	"import_file_size_bytes" bigint,
	"import_status" varchar(32) DEFAULT 'draft' NOT NULL,
	"parse_error" text,
	"parsed_row_count" integer DEFAULT 0 NOT NULL,
	"parsed_success_count" integer DEFAULT 0 NOT NULL,
	"parsed_rows_json" jsonb,
	"parsed_at" timestamp with time zone,
	"committed_device_count" integer DEFAULT 0 NOT NULL,
	"committed_at" timestamp with time zone,
	"created_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_batch_import_row" (
	"id" text PRIMARY KEY NOT NULL,
	"onboarding_batch_id" text NOT NULL,
	"row_no" integer NOT NULL,
	"public_ip" varchar(45) NOT NULL,
	"private_ip" varchar(45) NOT NULL,
	"root_account" varchar(128) NOT NULL,
	"root_password_enc" text NOT NULL,
	"sn" varchar(64),
	"asset_no" varchar(64),
	"gpu_count" integer,
	"gpu_card_type_id" text,
	"parse_status" varchar(32) NOT NULL,
	"parse_message" text,
	"supplier_device_id" text
);
--> statement-breakpoint
CREATE TABLE "onboarding_task" (
	"id" text PRIMARY KEY NOT NULL,
	"onboarding_batch_id" text NOT NULL,
	"supplier_device_id" text,
	"task_type" varchar(64) NOT NULL,
	"assignee_staff_id" text NOT NULL,
	"task_status" varchar(32) NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_pool_binding" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_device_id" text NOT NULL,
	"resource_pool_id" varchar(128),
	"pool_code" varchar(64),
	"workload_profile" varchar(32) NOT NULL,
	"is_exclusive_pool" boolean DEFAULT false NOT NULL,
	"bound_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"short_name" varchar(64) NOT NULL,
	"status" varchar(32) NOT NULL,
	"default_cooperation_mode" varchar(32),
	"default_revenue_share_percent" numeric(7, 4),
	"business_manager_staff_id" text,
	"contact_person" varchar(128),
	"contact_phone" varchar(32),
	"contact_email" varchar(255),
	"address" text,
	"bank_name" varchar(255),
	"bank_account" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"author_staff_id" text,
	"author_name" varchar(128),
	"author_role" varchar(32),
	"ref_domain" varchar(64),
	"ref_id" text,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_activity_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" bigint,
	"mime_type" varchar(128),
	"storage_uri" varchar(1024) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_activity_type_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"type_code" varchar(64) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"category" varchar(32),
	"sort_order" integer
);
--> statement-breakpoint
CREATE TABLE "supplier_bill" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"bill_month" varchar(7) NOT NULL,
	"cooperation_mode" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"total_usage_hours" numeric(15, 4) NOT NULL,
	"total_amount" numeric(15, 4) NOT NULL,
	"network_fee" numeric(15, 4) NOT NULL,
	"management_fee" numeric(15, 4) NOT NULL,
	"final_amount" numeric(15, 4) NOT NULL,
	"due_date" date NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_bill_detail" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"usage_hours" numeric(15, 4) NOT NULL,
	"unit_cost" numeric(15, 4) NOT NULL,
	"amount" numeric(15, 4) NOT NULL,
	"tenant_consumption" numeric(15, 4)
);
--> statement-breakpoint
CREATE TABLE "supplier_card_list_price" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"list_price_per_hour" numeric(15, 4) NOT NULL,
	"currency" varchar(8) DEFAULT 'CNY' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"source" varchar(64),
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_contract" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"contract_no" varchar(64) NOT NULL,
	"type" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"pricing_mode" varchar(32) NOT NULL,
	"tier_basis" varchar(32),
	"cooperation_mode" varchar(32) NOT NULL,
	"unit_price_per_hour" numeric(15, 4),
	"revenue_share_percent" numeric(7, 4),
	"list_price_per_hour" numeric(15, 4),
	"deal_to_list_ratio" numeric(9, 6),
	"min_commit_hours" numeric(15, 4),
	"settlement_cycle" varchar(32),
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"terms" text,
	"signed_at" timestamp with time zone,
	"signer_name" varchar(128),
	"contract_file_uri" varchar(1024),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_device" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"contract_id" text,
	"onboarding_batch_id" text,
	"data_center_id" text,
	"gpu_card_type_id" text NOT NULL,
	"asset_no" varchar(64),
	"sn" varchar(64) NOT NULL,
	"idc_code" varchar(64) NOT NULL,
	"idc_region" varchar(64),
	"gpu_count" integer NOT NULL,
	"external_ip" varchar(45),
	"internal_ip" varchar(45),
	"lifecycle_status" varchar(32) NOT NULL,
	"onboarding_substage" varchar(64),
	"platform_resource_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_gpu_inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"online_quantity" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) NOT NULL,
	"is_internal_test" boolean DEFAULT false NOT NULL,
	"internal_test_scope" varchar(255),
	"internal_test_until" timestamp with time zone,
	"card_time_cost_per_hour" numeric(15, 4),
	"revenue_share_cost_per_hour" numeric(15, 4),
	"last_synced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_ops_upload_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" varchar(32) NOT NULL,
	"supplier_id" text NOT NULL,
	"idc_code" varchar(64) NOT NULL,
	"access_method" varchar(32),
	"file_name" varchar(255) NOT NULL,
	"rows_json" jsonb NOT NULL,
	"status" varchar(32) NOT NULL,
	"parse_error" text,
	"onboarding_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_pricing_history" (
	"id" text PRIMARY KEY NOT NULL,
	"pricing_record_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"pricing_mode" varchar(32) NOT NULL,
	"previous_list_price_per_hour" numeric(15, 4),
	"new_list_price_per_hour" numeric(15, 4),
	"previous_unit_price_per_hour" numeric(15, 4),
	"new_unit_price_per_hour" numeric(15, 4),
	"previous_deal_to_list_ratio" numeric(9, 6),
	"new_deal_to_list_ratio" numeric(9, 6),
	"previous_revenue_share_percent" numeric(7, 4),
	"new_revenue_share_percent" numeric(7, 4),
	"changed_at" timestamp with time zone NOT NULL,
	"changed_by_staff_id" text NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "supplier_pricing_record" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"supplier_unit_cost_id" text,
	"supplier_card_list_price_id" text,
	"pricing_mode" varchar(32) NOT NULL,
	"list_price_per_hour" numeric(15, 4),
	"unit_price_per_hour" numeric(15, 4),
	"deal_to_list_ratio" numeric(9, 6),
	"revenue_share_percent" numeric(7, 4),
	"pricing_tiers" jsonb,
	"effective_from" date NOT NULL,
	"updated_by_staff_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_pricing_tier" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"supplier_card_list_price_id" text,
	"tier_order" integer NOT NULL,
	"list_price_multiplier" numeric(9, 6),
	"deal_to_list_ratio_min" numeric(9, 6),
	"deal_to_list_ratio_max" numeric(9, 6),
	"deal_unit_price_per_hour" numeric(15, 4),
	"revenue_share_percent" numeric(7, 4),
	"remark" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "supplier_terms_version" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text,
	"contract_id" text,
	"deal_mode" varchar(64) NOT NULL,
	"terms_json" jsonb NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_unit_cost" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_terms_version_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"supplier_card_list_price_id" text NOT NULL,
	"list_price_per_hour" numeric(15, 4) NOT NULL,
	"deal_unit_price_per_hour" numeric(15, 4),
	"deal_to_list_ratio" numeric(9, 6),
	"unit_cost" numeric(15, 4),
	"revenue_share_percent" numeric(7, 4),
	"tier_json" jsonb,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD CONSTRAINT "billing_period_agg_customer_consumption_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_import_batch" ADD CONSTRAINT "billing_period_import_batch_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_import_batch" ADD CONSTRAINT "billing_period_import_batch_uploaded_by_user_staff_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_operation_log" ADD CONSTRAINT "billing_period_operation_log_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_operation_log" ADD CONSTRAINT "billing_period_operation_log_actor_id_user_staff_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_raw_baremetal_order" ADD CONSTRAINT "billing_period_raw_baremetal_order_batch_id_billing_period_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."billing_period_import_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_raw_customer_consumption" ADD CONSTRAINT "billing_period_raw_customer_consumption_batch_id_billing_period_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."billing_period_import_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_raw_tenant_bill" ADD CONSTRAINT "billing_period_raw_tenant_bill_batch_id_billing_period_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."billing_period_import_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_reconciliation_report" ADD CONSTRAINT "billing_period_reconciliation_report_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_tenant_project_enrichment" ADD CONSTRAINT "billing_period_tenant_project_enrichment_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_tenant_project_enrichment" ADD CONSTRAINT "billing_period_tenant_project_enrichment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_tenant_project_enrichment" ADD CONSTRAINT "billing_period_tenant_project_enrichment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_tenant_project_enrichment" ADD CONSTRAINT "billing_period_tenant_project_enrichment_staff_id_user_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_tenant_cost_allocation" ADD CONSTRAINT "billing_tenant_cost_allocation_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_tenant_cost_allocation" ADD CONSTRAINT "billing_tenant_cost_allocation_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_tenant_cost_allocation" ADD CONSTRAINT "billing_tenant_cost_allocation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_tenant_cost_allocation" ADD CONSTRAINT "billing_tenant_cost_allocation_preset_id_tenant_project_cost_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."tenant_project_cost"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_tenant_cost_allocation" ADD CONSTRAINT "billing_tenant_cost_allocation_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_adjustment_history" ADD CONSTRAINT "income_adjustment_history_income_id_platform_income_monthly_id_fk" FOREIGN KEY ("income_id") REFERENCES "public"."platform_income_monthly"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_adjustment_history" ADD CONSTRAINT "income_adjustment_history_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD CONSTRAINT "platform_cost_monthly_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD CONSTRAINT "platform_cost_monthly_staff_id_user_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."user_staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD CONSTRAINT "platform_cost_monthly_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD CONSTRAINT "platform_cost_monthly_supplier_unit_cost_id_supplier_unit_cost_id_fk" FOREIGN KEY ("supplier_unit_cost_id") REFERENCES "public"."supplier_unit_cost"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_income_monthly" ADD CONSTRAINT "platform_income_monthly_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_income_monthly" ADD CONSTRAINT "platform_income_monthly_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplementary_consumption_history" ADD CONSTRAINT "supplementary_consumption_history_income_id_platform_income_monthly_id_fk" FOREIGN KEY ("income_id") REFERENCES "public"."platform_income_monthly"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplementary_consumption_history" ADD CONSTRAINT "supplementary_consumption_history_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_project_cost" ADD CONSTRAINT "tenant_project_cost_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_project_cost" ADD CONSTRAINT "tenant_project_cost_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_project_cost" ADD CONSTRAINT "tenant_project_cost_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" ADD CONSTRAINT "voucher_card_hours_adjustment_history_cost_id_platform_cost_monthly_id_fk" FOREIGN KEY ("cost_id") REFERENCES "public"."platform_cost_monthly"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" ADD CONSTRAINT "voucher_card_hours_adjustment_history_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_condition_sheet" ADD CONSTRAINT "access_condition_sheet_contract_id_supplier_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compute_node" ADD CONSTRAINT "compute_node_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_center" ADD CONSTRAINT "data_center_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_state_transition_log" ADD CONSTRAINT "entity_state_transition_log_operator_staff_id_user_staff_id_fk" FOREIGN KEY ("operator_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD CONSTRAINT "fault_incident_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD CONSTRAINT "fault_incident_compute_node_id_compute_node_id_fk" FOREIGN KEY ("compute_node_id") REFERENCES "public"."compute_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD CONSTRAINT "internal_test_hold_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD CONSTRAINT "internal_test_hold_supplier_gpu_inventory_id_supplier_gpu_inventory_id_fk" FOREIGN KEY ("supplier_gpu_inventory_id") REFERENCES "public"."supplier_gpu_inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD CONSTRAINT "onboarding_batch_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD CONSTRAINT "onboarding_batch_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD CONSTRAINT "onboarding_batch_contract_id_supplier_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contract"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD CONSTRAINT "onboarding_batch_access_condition_sheet_id_access_condition_sheet_id_fk" FOREIGN KEY ("access_condition_sheet_id") REFERENCES "public"."access_condition_sheet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD CONSTRAINT "onboarding_batch_created_by_staff_id_user_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_import_row" ADD CONSTRAINT "onboarding_batch_import_row_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_import_row" ADD CONSTRAINT "onboarding_batch_import_row_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_import_row" ADD CONSTRAINT "onboarding_batch_import_row_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_task" ADD CONSTRAINT "onboarding_task_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_task" ADD CONSTRAINT "onboarding_task_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_task" ADD CONSTRAINT "onboarding_task_assignee_staff_id_user_staff_id_fk" FOREIGN KEY ("assignee_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_pool_binding" ADD CONSTRAINT "resource_pool_binding_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_business_manager_staff_id_user_staff_id_fk" FOREIGN KEY ("business_manager_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_activity" ADD CONSTRAINT "supplier_activity_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_activity" ADD CONSTRAINT "supplier_activity_author_staff_id_user_staff_id_fk" FOREIGN KEY ("author_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_activity_attachment" ADD CONSTRAINT "supplier_activity_attachment_activity_id_supplier_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."supplier_activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill" ADD CONSTRAINT "supplier_bill_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_detail" ADD CONSTRAINT "supplier_bill_detail_bill_id_supplier_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."supplier_bill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_detail" ADD CONSTRAINT "supplier_bill_detail_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_detail" ADD CONSTRAINT "supplier_bill_detail_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_card_list_price" ADD CONSTRAINT "supplier_card_list_price_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_card_list_price" ADD CONSTRAINT "supplier_card_list_price_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_card_list_price" ADD CONSTRAINT "supplier_card_list_price_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contract" ADD CONSTRAINT "supplier_contract_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_device" ADD CONSTRAINT "supplier_device_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_device" ADD CONSTRAINT "supplier_device_contract_id_supplier_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contract"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_device" ADD CONSTRAINT "supplier_device_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_device" ADD CONSTRAINT "supplier_device_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_device" ADD CONSTRAINT "supplier_device_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_gpu_inventory" ADD CONSTRAINT "supplier_gpu_inventory_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_gpu_inventory" ADD CONSTRAINT "supplier_gpu_inventory_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_gpu_inventory" ADD CONSTRAINT "supplier_gpu_inventory_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ops_upload_batch" ADD CONSTRAINT "supplier_ops_upload_batch_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ops_upload_batch" ADD CONSTRAINT "supplier_ops_upload_batch_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD CONSTRAINT "supplier_pricing_history_pricing_record_id_supplier_pricing_record_id_fk" FOREIGN KEY ("pricing_record_id") REFERENCES "public"."supplier_pricing_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD CONSTRAINT "supplier_pricing_history_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD CONSTRAINT "supplier_pricing_history_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD CONSTRAINT "supplier_pricing_history_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_history" ADD CONSTRAINT "supplier_pricing_history_changed_by_staff_id_user_staff_id_fk" FOREIGN KEY ("changed_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_record" ADD CONSTRAINT "supplier_pricing_record_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_record" ADD CONSTRAINT "supplier_pricing_record_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_record" ADD CONSTRAINT "supplier_pricing_record_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_record" ADD CONSTRAINT "supplier_pricing_record_supplier_unit_cost_id_supplier_unit_cost_id_fk" FOREIGN KEY ("supplier_unit_cost_id") REFERENCES "public"."supplier_unit_cost"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_record" ADD CONSTRAINT "supplier_pricing_record_supplier_card_list_price_id_supplier_card_list_price_id_fk" FOREIGN KEY ("supplier_card_list_price_id") REFERENCES "public"."supplier_card_list_price"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_record" ADD CONSTRAINT "supplier_pricing_record_updated_by_staff_id_user_staff_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_tier" ADD CONSTRAINT "supplier_pricing_tier_contract_id_supplier_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pricing_tier" ADD CONSTRAINT "supplier_pricing_tier_supplier_card_list_price_id_supplier_card_list_price_id_fk" FOREIGN KEY ("supplier_card_list_price_id") REFERENCES "public"."supplier_card_list_price"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_terms_version" ADD CONSTRAINT "supplier_terms_version_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_terms_version" ADD CONSTRAINT "supplier_terms_version_contract_id_supplier_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_unit_cost" ADD CONSTRAINT "supplier_unit_cost_supplier_terms_version_id_supplier_terms_version_id_fk" FOREIGN KEY ("supplier_terms_version_id") REFERENCES "public"."supplier_terms_version"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_unit_cost" ADD CONSTRAINT "supplier_unit_cost_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_unit_cost" ADD CONSTRAINT "supplier_unit_cost_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_unit_cost" ADD CONSTRAINT "supplier_unit_cost_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_unit_cost" ADD CONSTRAINT "supplier_unit_cost_supplier_card_list_price_id_supplier_card_list_price_id_fk" FOREIGN KEY ("supplier_card_list_price_id") REFERENCES "public"."supplier_card_list_price"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_period_code_uk" ON "billing_period" USING btree ("period_code");--> statement-breakpoint
CREATE INDEX "billing_period_status_idx" ON "billing_period" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_period_period_start_idx" ON "billing_period" USING btree ("period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_agg_customer_consumption_uk" ON "billing_period_agg_customer_consumption" USING btree ("billing_period_id","tenant_platform_id","customer_type");--> statement-breakpoint
CREATE INDEX "billing_period_agg_customer_consumption_period_id_idx" ON "billing_period_agg_customer_consumption" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_file_type_uk" ON "billing_period_import_batch" USING btree ("billing_period_id","file_type");--> statement-breakpoint
CREATE INDEX "billing_period_import_batch_period_id_idx" ON "billing_period_import_batch" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "billing_period_operation_log_period_id_idx" ON "billing_period_operation_log" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "billing_period_operation_log_operation_idx" ON "billing_period_operation_log" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "billing_period_operation_log_created_at_idx" ON "billing_period_operation_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "billing_period_raw_baremetal_order_batch_id_idx" ON "billing_period_raw_baremetal_order" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "billing_period_raw_baremetal_order_tenant_idx" ON "billing_period_raw_baremetal_order" USING btree ("tenant_platform_id");--> statement-breakpoint
CREATE INDEX "billing_period_raw_baremetal_order_ordered_at_idx" ON "billing_period_raw_baremetal_order" USING btree ("ordered_at");--> statement-breakpoint
CREATE INDEX "billing_period_raw_customer_consumption_batch_id_idx" ON "billing_period_raw_customer_consumption" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "billing_period_raw_customer_consumption_tenant_idx" ON "billing_period_raw_customer_consumption" USING btree ("tenant_platform_id");--> statement-breakpoint
CREATE INDEX "billing_period_raw_tenant_bill_batch_id_idx" ON "billing_period_raw_tenant_bill" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "billing_period_raw_tenant_bill_tenant_idx" ON "billing_period_raw_tenant_bill" USING btree ("tenant_platform_id");--> statement-breakpoint
CREATE INDEX "billing_period_raw_tenant_bill_region_gpu_idx" ON "billing_period_raw_tenant_bill" USING btree ("region_code","gpu_model");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_reconciliation_report_period_uk" ON "billing_period_reconciliation_report" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_tenant_project_enrichment_uk" ON "billing_period_tenant_project_enrichment" USING btree ("billing_period_id","tenant_platform_id","project_id");--> statement-breakpoint
CREATE INDEX "billing_period_tenant_project_enrichment_period_id_idx" ON "billing_period_tenant_project_enrichment" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "billing_period_tenant_project_enrichment_tenant_id_idx" ON "billing_period_tenant_project_enrichment" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_tenant_cost_allocation_uk" ON "billing_tenant_cost_allocation" USING btree ("billing_period_id","tenant_id","project_id");--> statement-breakpoint
CREATE INDEX "billing_tenant_cost_allocation_period_id_idx" ON "billing_tenant_cost_allocation" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "billing_tenant_cost_allocation_tenant_id_idx" ON "billing_tenant_cost_allocation" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "income_adjustment_history_income_id_idx" ON "income_adjustment_history" USING btree ("income_id");--> statement-breakpoint
CREATE INDEX "platform_cost_monthly_billing_period_id_idx" ON "platform_cost_monthly" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "platform_cost_monthly_staff_id_idx" ON "platform_cost_monthly" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "platform_cost_monthly_billing_period_type_idx" ON "platform_cost_monthly" USING btree ("billing_period_id","type");--> statement-breakpoint
CREATE INDEX "platform_cost_monthly_supplier_unit_cost_id_idx" ON "platform_cost_monthly" USING btree ("supplier_unit_cost_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_income_monthly_period_tenant_type_uk" ON "platform_income_monthly" USING btree ("billing_period_id","tenant_id","customer_type");--> statement-breakpoint
CREATE INDEX "platform_income_monthly_billing_period_id_idx" ON "platform_income_monthly" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "platform_income_monthly_tenant_platform_id_idx" ON "platform_income_monthly" USING btree ("tenant_platform_id");--> statement-breakpoint
CREATE INDEX "supplementary_consumption_history_income_id_idx" ON "supplementary_consumption_history" USING btree ("income_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_project_cost_current_uk" ON "tenant_project_cost" USING btree ("tenant_id","project_id") WHERE "tenant_project_cost"."effective_to" IS NULL;--> statement-breakpoint
CREATE INDEX "tenant_project_cost_tenant_id_idx" ON "tenant_project_cost" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_project_cost_project_id_idx" ON "tenant_project_cost" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "voucher_card_hours_adjustment_history_cost_id_idx" ON "voucher_card_hours_adjustment_history" USING btree ("cost_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_condition_sheet_contract_version_uk" ON "access_condition_sheet" USING btree ("contract_id","version_no");--> statement-breakpoint
CREATE UNIQUE INDEX "access_condition_sheet_current_uk" ON "access_condition_sheet" USING btree ("contract_id") WHERE "access_condition_sheet"."is_current" = true;--> statement-breakpoint
CREATE INDEX "compute_node_supplier_device_id_idx" ON "compute_node" USING btree ("supplier_device_id");--> statement-breakpoint
CREATE INDEX "compute_node_cluster_id_idx" ON "compute_node" USING btree ("cluster_id");--> statement-breakpoint
CREATE UNIQUE INDEX "data_center_supplier_code_uk" ON "data_center" USING btree ("supplier_id","code");--> statement-breakpoint
CREATE INDEX "data_center_supplier_id_idx" ON "data_center" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "data_center_status_idx" ON "data_center" USING btree ("status");--> statement-breakpoint
CREATE INDEX "entity_state_transition_log_entity_idx" ON "entity_state_transition_log" USING btree ("entity_type","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "fault_incident_supplier_device_id_idx" ON "fault_incident" USING btree ("supplier_device_id");--> statement-breakpoint
CREATE INDEX "fault_incident_compute_node_id_idx" ON "fault_incident" USING btree ("compute_node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gpu_card_type_name_uk" ON "gpu_card_type" USING btree ("name");--> statement-breakpoint
CREATE INDEX "internal_test_hold_supplier_device_id_idx" ON "internal_test_hold" USING btree ("supplier_device_id");--> statement-breakpoint
CREATE INDEX "internal_test_hold_inventory_id_idx" ON "internal_test_hold" USING btree ("supplier_gpu_inventory_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lifecycle_state_definition_uk" ON "lifecycle_state_definition" USING btree ("domain","state_code");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_batch_code_uk" ON "onboarding_batch" USING btree ("batch_code");--> statement-breakpoint
CREATE INDEX "onboarding_batch_supplier_id_idx" ON "onboarding_batch" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_data_center_id_idx" ON "onboarding_batch" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_idc_code_idx" ON "onboarding_batch" USING btree ("idc_code");--> statement-breakpoint
CREATE INDEX "onboarding_batch_contract_id_idx" ON "onboarding_batch" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_status_idx" ON "onboarding_batch" USING btree ("batch_status");--> statement-breakpoint
CREATE INDEX "onboarding_batch_import_status_idx" ON "onboarding_batch" USING btree ("import_status");--> statement-breakpoint
CREATE INDEX "onboarding_batch_supplier_dc_created_idx" ON "onboarding_batch" USING btree ("supplier_id","data_center_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_batch_import_row_uk" ON "onboarding_batch_import_row" USING btree ("onboarding_batch_id","row_no");--> statement-breakpoint
CREATE INDEX "onboarding_batch_import_row_batch_id_idx" ON "onboarding_batch_import_row" USING btree ("onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_import_row_parse_status_idx" ON "onboarding_batch_import_row" USING btree ("parse_status");--> statement-breakpoint
CREATE INDEX "onboarding_task_batch_id_idx" ON "onboarding_task" USING btree ("onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "resource_pool_binding_supplier_device_id_idx" ON "resource_pool_binding" USING btree ("supplier_device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_code_uk" ON "supplier" USING btree ("code");--> statement-breakpoint
CREATE INDEX "supplier_status_idx" ON "supplier" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_business_manager_staff_id_idx" ON "supplier" USING btree ("business_manager_staff_id");--> statement-breakpoint
CREATE INDEX "supplier_activity_supplier_occurred_idx" ON "supplier_activity" USING btree ("supplier_id","occurred_at");--> statement-breakpoint
CREATE INDEX "supplier_activity_ref_idx" ON "supplier_activity" USING btree ("ref_domain","ref_id");--> statement-breakpoint
CREATE INDEX "supplier_activity_attachment_activity_id_idx" ON "supplier_activity_attachment" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_activity_type_definition_code_uk" ON "supplier_activity_type_definition" USING btree ("type_code");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_bill_supplier_month_uk" ON "supplier_bill" USING btree ("supplier_id","bill_month");--> statement-breakpoint
CREATE INDEX "supplier_bill_supplier_id_idx" ON "supplier_bill" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_detail_bill_id_idx" ON "supplier_bill_detail" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_card_list_price_current_uk" ON "supplier_card_list_price" USING btree ("supplier_id","data_center_id","gpu_card_type_id") WHERE "supplier_card_list_price"."effective_to" IS NULL;--> statement-breakpoint
CREATE INDEX "supplier_card_list_price_supplier_id_idx" ON "supplier_card_list_price" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_card_list_price_dc_card_idx" ON "supplier_card_list_price" USING btree ("data_center_id","gpu_card_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_contract_no_uk" ON "supplier_contract" USING btree ("contract_no");--> statement-breakpoint
CREATE INDEX "supplier_contract_supplier_id_idx" ON "supplier_contract" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_contract_status_idx" ON "supplier_contract" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_contract_pricing_mode_idx" ON "supplier_contract" USING btree ("pricing_mode");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_device_sn_uk" ON "supplier_device" USING btree ("sn");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_device_asset_no_uk" ON "supplier_device" USING btree ("asset_no");--> statement-breakpoint
CREATE INDEX "supplier_device_supplier_id_idx" ON "supplier_device" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_device_onboarding_batch_id_idx" ON "supplier_device" USING btree ("onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "supplier_device_data_center_id_idx" ON "supplier_device" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "supplier_device_lifecycle_status_idx" ON "supplier_device" USING btree ("lifecycle_status");--> statement-breakpoint
CREATE INDEX "supplier_device_idc_code_idx" ON "supplier_device" USING btree ("idc_code");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_gpu_inventory_uk" ON "supplier_gpu_inventory" USING btree ("supplier_id","data_center_id","gpu_card_type_id");--> statement-breakpoint
CREATE INDEX "supplier_ops_upload_batch_supplier_id_idx" ON "supplier_ops_upload_batch" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_ops_upload_batch_onboarding_batch_id_idx" ON "supplier_ops_upload_batch" USING btree ("onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "supplier_pricing_history_record_changed_idx" ON "supplier_pricing_history" USING btree ("pricing_record_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_pricing_record_uk" ON "supplier_pricing_record" USING btree ("supplier_id","data_center_id","gpu_card_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_pricing_tier_uk" ON "supplier_pricing_tier" USING btree ("contract_id","tier_order","supplier_card_list_price_id");--> statement-breakpoint
CREATE INDEX "supplier_terms_version_supplier_id_idx" ON "supplier_terms_version" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_terms_version_contract_id_idx" ON "supplier_terms_version" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_unit_cost_current_uk" ON "supplier_unit_cost" USING btree ("supplier_terms_version_id","data_center_id","gpu_card_type_id") WHERE "supplier_unit_cost"."effective_to" IS NULL;