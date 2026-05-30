CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" jsonb,
	"entry_approved" boolean DEFAULT false NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"phone_number" text,
	"phone_number_verified" boolean DEFAULT false NOT NULL,
	"role" varchar(256) DEFAULT 'user',
	"must_change_password" boolean DEFAULT false NOT NULL,
	"banned" boolean,
	"ban_reason" text,
	"ban_expires" timestamp,
	"customer_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_invitation_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"max_usage" integer,
	CONSTRAINT "user_invitation_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_invitation_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"inviter_id" text NOT NULL,
	"invitee_id" text NOT NULL,
	"invitation_code_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"reward_granted" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"tenant_id" text,
	"activity_type_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"ref_domain" varchar(64),
	"ref_id" text,
	"idempotency_key" varchar(128),
	"actor_user_id" text,
	"title_snapshot" varchar(255),
	"summary_snapshot" text,
	"payload" jsonb,
	"visibility" varchar(32)
);
--> statement-breakpoint
CREATE TABLE "account_manager_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"user_staff_id" text NOT NULL,
	"role_type" varchar(32) NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_type_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"type_code" varchar(64) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"category" varchar(32),
	"is_platform_projection" boolean DEFAULT true NOT NULL,
	"sort_order" integer
);
--> statement-breakpoint
CREATE TABLE "balance_snapshot_job_item" (
	"id" text PRIMARY KEY NOT NULL,
	"job_run_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"status" varchar(32) NOT NULL,
	"granularity" varchar(8) NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "balance_snapshot_job_run" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger" varchar(32) NOT NULL,
	"granularity" varchar(8) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(32) NOT NULL,
	"tenant_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "billing_sync_job_item" (
	"id" text PRIMARY KEY NOT NULL,
	"job_run_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" varchar(32) NOT NULL,
	"summary" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "billing_sync_job_run" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger" varchar(32) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(32) NOT NULL,
	"sync_end_date" date NOT NULL,
	"safety_days" integer NOT NULL,
	"project_count" integer DEFAULT 0 NOT NULL,
	"tenant_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"platform_tenant_id" varchar(128),
	"is_default" boolean DEFAULT false NOT NULL,
	"status" varchar(32) NOT NULL,
	"phone" varchar(32),
	"overdue_at" timestamp with time zone,
	"credit_limit" numeric(20, 4),
	"balance" numeric(20, 4) DEFAULT '0' NOT NULL,
	"type" varchar(32) DEFAULT 'external' NOT NULL,
	"platform_registered_at" timestamp with time zone,
	"billing_sync_cursor_end_date" date,
	"billing_sync_last_started_at" timestamp with time zone,
	"billing_sync_last_finished_at" timestamp with time zone,
	"billing_sync_last_status" varchar(32),
	"billing_sync_last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_line" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_workday" (
	"calendar_date" date NOT NULL,
	"region_code" varchar(16) NOT NULL,
	"is_workday" boolean NOT NULL,
	CONSTRAINT "calendar_workday_calendar_date_region_code_pk" PRIMARY KEY("calendar_date","region_code")
);
--> statement-breakpoint
CREATE TABLE "commerce_order" (
	"id" text PRIMARY KEY NOT NULL,
	"order_no" varchar(64),
	"customer_id" text,
	"tenant_id" text,
	"project_id" text,
	"product_line" varchar(64),
	"status" varchar(32) NOT NULL,
	"data_center_id" text,
	"data_center_name" varchar(255),
	"amount" numeric(15, 4) NOT NULL,
	"balance_amount" numeric(15, 4) NOT NULL,
	"coupon_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"device_count" integer,
	"device_model" varchar(64),
	"gpu_count" integer,
	"unit" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "commerce_order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"quantity" numeric NOT NULL,
	"unit_price" numeric(15, 4) NOT NULL,
	"total" numeric(15, 4) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compute_task" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(32) NOT NULL,
	"resource_type" varchar(64),
	"gpu_count" integer,
	"cpu_count" integer,
	"memory_gb" integer,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"cost" numeric(15, 4)
);
--> statement-breakpoint
CREATE TABLE "consumption_record" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"tenant_id" text,
	"project_id" text,
	"product_line" varchar(64) NOT NULL,
	"resource_name" varchar(255),
	"amount" numeric(15, 4) NOT NULL,
	"duration" numeric,
	"unit" varchar(32),
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumption_usage_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"tenant_id" text NOT NULL,
	"usage_date" date NOT NULL,
	"usage_month" varchar(7) NOT NULL,
	"product_line" varchar(64),
	"unit" varchar(32),
	"amount" numeric(15, 4),
	"voucher_amount" numeric(15, 4),
	"balance_amount" numeric(15, 4),
	"total_card_hours" numeric(15, 4),
	"balance_card_hours" numeric(15, 4),
	"voucher_card_hours" numeric(15, 4) DEFAULT '0',
	"gpu_seconds" numeric
);
--> statement-breakpoint
CREATE TABLE "contract" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_no" varchar(64),
	"customer_id" text,
	"tenant_id" text,
	"project_id" text,
	"type" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"total_amount" numeric(15, 4) NOT NULL,
	"paid_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"signed_at" timestamp with time zone,
	"signer_name" varchar(128),
	"terms" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"tenant_id" text,
	"contract_no" varchar(64),
	"contract_url" varchar(1024),
	"signed_on" date,
	"amount_summary" varchar(255),
	"external_crm_id" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "conversion_record" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"conversion_date" date NOT NULL,
	"trigger_type" varchar(64) NOT NULL,
	"candidate_signed_on" date,
	"candidate_scale_met_on" date,
	"candidate_recharge_ge_threshold_at" timestamp with time zone,
	"computed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text,
	"code" varchar(64),
	"name" varchar(255) NOT NULL,
	"type" varchar(32) NOT NULL,
	"value" numeric(15, 4) NOT NULL,
	"min_amount" numeric(15, 4),
	"status" varchar(32) NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expired_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"primary_tenant_id" text,
	"business_line_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"stage" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"start_date" date,
	"end_date" date,
	"monthly_budget" numeric(15, 4),
	"last_month_recharge" numeric(15, 4) DEFAULT '0' NOT NULL,
	"this_month_recharge" numeric(15, 4) DEFAULT '0' NOT NULL,
	"last_month_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"this_month_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance" numeric(15, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"customer_code" varchar(64),
	"short_name" varchar(255),
	"cert_code" varchar(64),
	"type" varchar(8) NOT NULL,
	"status" varchar(32) NOT NULL,
	"contact_person" varchar(128),
	"contact_phone" varchar(32),
	"contact_email" varchar(255),
	"industry" varchar(128),
	"address" text,
	"sales_manager_id" text,
	"lifecycle_phase" varchar(64),
	"expected_scale" jsonb,
	"observed_scale_summary" jsonb,
	"test_started_on" date,
	"test_completed_on" date,
	"conversion_date" date,
	"conversion_trigger" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"account_activity_id" text NOT NULL,
	"author_id" text NOT NULL,
	"parent_comment_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement_document" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"project_id" text,
	"uploaded_by" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"version_no" integer DEFAULT 1 NOT NULL,
	"storage_uri" varchar(1024) NOT NULL,
	"visibility" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up_task" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"project_id" text,
	"assignee_id" text,
	"source_account_activity_id" text,
	"title" varchar(255) NOT NULL,
	"status" varchar(32) NOT NULL,
	"due_on" date,
	"completed_at" timestamp with time zone,
	"completion_note" text
);
--> statement-breakpoint
CREATE TABLE "lifecycle_milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"milestone_type" varchar(64) NOT NULL,
	"milestone_date" date NOT NULL,
	"filled_by" text,
	"filled_at" timestamp with time zone NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "milestone_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"lifecycle_milestone_id" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"storage_uri" varchar(1024) NOT NULL,
	"file_hash" varchar(128),
	"uploaded_by" text,
	"uploaded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"type" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"author_name" varchar(128),
	"author_staff_id" text,
	"author_role" varchar(32),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_activity_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" bigint,
	"mime_type" varchar(128),
	"storage_uri" varchar(1024) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_staff_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_staff_id" text NOT NULL,
	"role_type" varchar(32) NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "project_tag" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tag_assignment" (
	"project_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_tag_assignment_project_id_tag_id_pk" PRIMARY KEY("project_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "project_tenant" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"binding_role" varchar(64),
	"binding_label" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recharge" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text,
	"amount" numeric(15, 4) NOT NULL,
	"payment_method" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"transaction_id" varchar(128),
	"refund_id" varchar(128),
	"refund_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recharge_order" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"tenant_id" text NOT NULL,
	"amount" numeric(15, 4) NOT NULL,
	"currency" varchar(8) DEFAULT 'CNY' NOT NULL,
	"status" varchar(32) NOT NULL,
	"type" varchar(32) NOT NULL,
	"paid_at" timestamp with time zone,
	"external_trade_no" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "tenant_balance_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"customer_id" text,
	"granularity" varchar(8) NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"bucket_date" date NOT NULL,
	"balance" numeric(20, 4) NOT NULL,
	"credit_limit" numeric(20, 4),
	"source" varchar(32) DEFAULT 'platform_sync' NOT NULL,
	"platform_tenant_id" varchar(128),
	"platform_coin_raw" numeric(20, 4),
	"captured_at" timestamp with time zone NOT NULL,
	"job_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_bill" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"tenant_id" text,
	"project_id" text,
	"bill_month" varchar(7) NOT NULL,
	"total_amount" numeric(15, 4) NOT NULL,
	"balance_amount" numeric(15, 4) NOT NULL,
	"coupon_amount" numeric(15, 4) NOT NULL,
	"status" varchar(32) NOT NULL,
	"due_date" date NOT NULL,
	"paid_at" timestamp with time zone,
	"platform_period_start" timestamp with time zone,
	"platform_period_end" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tenant_bill_detail" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"product_line" varchar(64),
	"resource_name" varchar(255),
	"usage" numeric,
	"unit" varchar(32),
	"unit_price" numeric(15, 4),
	"amount" numeric(15, 4) NOT NULL,
	"balance_amount" numeric(15, 4) NOT NULL,
	"coupon_amount" numeric(15, 4) NOT NULL,
	"type" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_consumption_daily_detail" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"tenant_id" text NOT NULL,
	"usage_date" date NOT NULL,
	"usage_month" varchar(7) NOT NULL,
	"product_line" varchar(64) NOT NULL,
	"data_center_id" text,
	"data_center_code" varchar(64) NOT NULL,
	"data_center_name" varchar(255) NOT NULL,
	"gpu_card_type_id" text,
	"gpu_card_type_code" varchar(64) NOT NULL,
	"gpu_card_type_name" varchar(128),
	"platform_task_id" varchar(64),
	"task_name" varchar(255),
	"total_amount" numeric(15, 4) NOT NULL,
	"voucher_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"total_card_hours" numeric(15, 4),
	"voucher_card_hours" numeric(15, 4) DEFAULT '0',
	"balance_card_hours" numeric(15, 4),
	"source" varchar(32) DEFAULT 'platform_sync' NOT NULL,
	"platform_idempotency_key" varchar(256) NOT NULL,
	"raw_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_voucher_issue" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"tenant_id" text,
	"operator_id" text,
	"issued_at" timestamp with time zone NOT NULL,
	"issue_status" varchar(32) NOT NULL,
	"coupon_id" text,
	"coupon_config" jsonb,
	"remark" text
);
--> statement-breakpoint
CREATE TABLE "user_staff" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_no" varchar(64),
	"display_name" varchar(128) NOT NULL,
	"mobile" varchar(32) NOT NULL,
	"email" varchar(255),
	"status" varchar(32) NOT NULL,
	"department" varchar(128),
	"position" varchar(128),
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default_pre_sales" boolean DEFAULT false NOT NULL,
	"is_default_account_manager" boolean DEFAULT false NOT NULL,
	"is_default_delivery_manager" boolean DEFAULT false NOT NULL,
	"is_default_project_manager" boolean DEFAULT false NOT NULL,
	"auth_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"tenant_id" text,
	"customer_id" text,
	"customer_full_name" varchar(255),
	"project_id" text,
	"project_name" varchar(255),
	"allocation_percent" numeric(7, 4),
	"total_consumption" numeric(15, 4) NOT NULL,
	"voucher_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance_consumption" numeric(15, 4) NOT NULL,
	"source_raw_ids" jsonb NOT NULL,
	"row_count_by_type" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_cost_pricing_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"window_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"gpu_card_type_name" varchar(128),
	"data_center_id" text NOT NULL,
	"data_center_name" varchar(255),
	"supplier_unit_cost_id" text,
	"supplier_pricing_record_id" text,
	"pricing_mode" varchar(32) NOT NULL,
	"billing_unit" varchar(16),
	"monthly_rent_per_machine" numeric(15, 4),
	"cards_per_machine" integer,
	"list_price_per_hour" numeric(15, 4),
	"deal_unit_price_per_hour" numeric(15, 4),
	"revenue_share_percent" numeric(7, 4),
	"pricing_tiers" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_cost_source_line" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"kind" varchar(16) NOT NULL,
	"source_raw_id" text NOT NULL,
	"tenant_id" text,
	"tenant_platform_id" varchar(128) NOT NULL,
	"project_id" text,
	"staff_id" text,
	"staff_name" varchar(128),
	"data_center_id" text NOT NULL,
	"data_center_name" varchar(255),
	"gpu_card_type_id" text NOT NULL,
	"gpu_card_type_name" varchar(128),
	"total_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"voucher_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"total_card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"voucher_card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance_card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"supplier_unit_cost_id" text,
	"supplier_pricing_record_id" text,
	"window_id" text,
	"source_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_import_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"window_id" text,
	"file_type" varchar(32) NOT NULL,
	"file_name" varchar(512) NOT NULL,
	"storage_path" varchar(1024) DEFAULT '' NOT NULL,
	"error_report_path" varchar(1024),
	"file_sha256" varchar(64) NOT NULL,
	"file_size_bytes" integer,
	"parse_status" varchar(16) DEFAULT 'ok' NOT NULL,
	"parse_error_count" integer DEFAULT 0 NOT NULL,
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
CREATE TABLE "billing_period_tenant_bill_window" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	"sort_order" integer NOT NULL,
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
	"staff_id" text,
	"account_manager" varchar(128),
	"supplier_unit_cost_id" text,
	"data_center_id" text,
	"gpu_card_type_id" text,
	"idc_name" varchar(255),
	"idc_code" varchar(64),
	"card_type" varchar(128),
	"total_consumption" numeric(15, 4),
	"voucher_consumption" numeric(15, 4),
	"balance_consumption" numeric(15, 4),
	"total_card_hours" numeric(15, 4),
	"balance_card_hours" numeric(15, 4),
	"voucher_card_hours" numeric(15, 4),
	"confirmed_revenue_excl_tax" numeric(15, 4),
	"sold_duration_cost_excl_tax" numeric(15, 4),
	"gifted_duration_cost_excl_tax" numeric(15, 4),
	"gross_profit" numeric(15, 4),
	"staff_name" varchar(128),
	"pricing_snapshot_id" text,
	"source_line_ids" jsonb,
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
	"customer_id" text,
	"customer_full_name" varchar(255),
	"project_id" text,
	"project_name" varchar(255),
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
CREATE TABLE "platform_card_list_price" (
	"id" text PRIMARY KEY NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"product_line" varchar(32) NOT NULL,
	"billing_unit" varchar(16) DEFAULT 'hour' NOT NULL,
	"sell_price" numeric(15, 4) NOT NULL,
	"currency" varchar(8) DEFAULT 'CNY' NOT NULL,
	"effective_from" timestamp(0) NOT NULL,
	"effective_to" timestamp(0),
	"status" varchar(32) NOT NULL,
	"remark" text,
	"updated_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_card_price_history" (
	"id" text PRIMARY KEY NOT NULL,
	"price_record_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"product_line" varchar(32) NOT NULL,
	"billing_unit" varchar(16) DEFAULT 'hour' NOT NULL,
	"previous_sell_price" numeric(15, 4),
	"new_sell_price" numeric(15, 4) NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"changed_by_staff_id" text,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "platform_card_price_record" (
	"id" text PRIMARY KEY NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"product_line" varchar(32) NOT NULL,
	"billing_unit" varchar(16) DEFAULT 'hour' NOT NULL,
	"sell_price" numeric(15, 4) NOT NULL,
	"platform_card_list_price_id" text,
	"effective_from" timestamp(0) NOT NULL,
	"updated_by_staff_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"cluster_name" varchar(128),
	"node_name" varchar(128),
	"expected_service" varchar(255),
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
	"region_tags" text[] DEFAULT '{}' NOT NULL,
	"address" text,
	"status" varchar(32) NOT NULL,
	"network_fee_monthly" numeric(15, 4) DEFAULT '0' NOT NULL,
	"mgmt_node_fee_monthly" numeric(15, 4) DEFAULT '0' NOT NULL,
	"external_onboarding_id" varchar(64),
	"platform_tenant_id" varchar(32),
	"container_instance_region" varchar(128),
	"bare_metal_region" varchar(128),
	"description" text,
	"scale" varchar(64),
	"public_ip_count" integer,
	"internal_network_cidr" varchar(64),
	"audit_status" varchar(32),
	"audit_remark" text,
	"source_deleted" boolean DEFAULT false NOT NULL,
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
	"supplier_id" text NOT NULL,
	"supplier_ops_upload_batch_id" text,
	"supplier_device_id" text,
	"compute_node_id" text,
	"fault_type" varchar(64) NOT NULL,
	"severity" varchar(8) DEFAULT 'P3' NOT NULL,
	"incident_status" varchar(32) NOT NULL,
	"impact_minutes" integer,
	"impact_scope" varchar(255),
	"affected_device_count" integer,
	"postmortem" text,
	"resolution_outcome" text,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gpu_card_type" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"code" varchar(64) NOT NULL,
	"manufacturer" varchar(32) NOT NULL,
	"memory_gb" integer,
	"tdp_watts" integer,
	"compute_capability" varchar(64),
	"device_role" varchar(16) DEFAULT 'compute' NOT NULL,
	"status" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gpu_card_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "internal_test_hold" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text,
	"data_center_id" text,
	"work_order_no" varchar(64),
	"user_name" varchar(128),
	"department" varchar(32),
	"settlement_mode" varchar(32),
	"gpu_card_type_id" text,
	"unit_count" integer,
	"remark" text,
	"supplier_device_id" text,
	"supplier_gpu_inventory_id" text,
	"scope" varchar(255) DEFAULT 'planned' NOT NULL,
	"hold_from" timestamp with time zone NOT NULL,
	"hold_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_test_hold_device_link" (
	"id" text PRIMARY KEY NOT NULL,
	"hold_id" text NOT NULL,
	"supplier_device_id" text NOT NULL,
	"port" varchar(16) DEFAULT '22' NOT NULL,
	"login_username" varchar(128) NOT NULL,
	"login_password" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lifecycle_state_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" varchar(32) NOT NULL,
	"state_code" varchar(64) NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"sort_order" integer NOT NULL,
	"payload" jsonb
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
	"contract_id" text,
	"access_condition_sheet_id" text,
	"batch_code" varchar(64) NOT NULL,
	"batch_status" varchar(32) NOT NULL,
	"planned_ready_at" timestamp with time zone,
	"planned_lines_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"planned_device_count" integer DEFAULT 0 NOT NULL,
	"planned_gpu_count" integer DEFAULT 0 NOT NULL,
	"list_upload_mode" varchar(32) DEFAULT 'none' NOT NULL,
	"work_order_no" varchar(64),
	"touched_device_count" integer DEFAULT 0 NOT NULL,
	"online_device_count" integer DEFAULT 0 NOT NULL,
	"progress_synced_at" timestamp with time zone,
	"online_reason" varchar(64),
	"order_no" varchar(128),
	"remark" text,
	"parent_batch_id" text,
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
	"retire_reason" varchar(64),
	"retire_action_type" varchar(32),
	"retire_plan_mode" varchar(32),
	"expected_completion_date" date,
	"retire_remark" text,
	"retired_device_count" integer DEFAULT 0 NOT NULL,
	"progress_flags_json" jsonb,
	"created_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_batch_device_link" (
	"id" text PRIMARY KEY NOT NULL,
	"business_onboarding_batch_id" text NOT NULL,
	"supplier_device_id" text NOT NULL,
	"link_kind" varchar(32) DEFAULT 'touched' NOT NULL,
	"source_change_log_id" text,
	"source_changelog_batch_id" text,
	"gpu_card_type_id" text NOT NULL,
	"cooperation_type" varchar(32) NOT NULL,
	"linked_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "onboarding_batch_plan_line" (
	"id" text PRIMARY KEY NOT NULL,
	"onboarding_batch_id" text NOT NULL,
	"gpu_card_type_id" text NOT NULL,
	"cooperation_type" varchar(32) NOT NULL,
	"planned_quantity" integer NOT NULL,
	"touched_quantity" integer DEFAULT 0 NOT NULL,
	"online_quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_batch_progress_event" (
	"id" text PRIMARY KEY NOT NULL,
	"onboarding_batch_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"batch_kind" varchar(32) NOT NULL,
	"batch_status" varchar(32) NOT NULL,
	"planned_device_count" integer NOT NULL,
	"planned_gpu_count" integer NOT NULL,
	"touched_device_count" integer NOT NULL,
	"touched_pipeline_gpu" integer NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text,
	"idc_region" varchar(64),
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"external_tenant_id" text NOT NULL,
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
	"source" varchar(64) DEFAULT 'import' NOT NULL,
	"bank_account" varchar(64),
	"external_onboarding_id" varchar(64),
	"platform_tenant_id" varchar(32),
	"onboarding_type" varchar(16),
	"identity_no" varchar(32),
	"business_scope" text,
	"business_license_uri" varchar(1024),
	"id_card_front_uri" varchar(1024),
	"id_card_back_uri" varchar(1024),
	"bank_branch_name" varchar(255),
	"bank_branch_address" text,
	"admin_phone" varchar(32),
	"admin_email" varchar(255),
	"device_info_raw" text,
	"audit_status" varchar(32),
	"audit_confirmed" boolean DEFAULT false NOT NULL,
	"audit_remark" text,
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
	"external_device_id" varchar(128),
	"asset_no" varchar(64),
	"sn" varchar(64) NOT NULL,
	"idc_code" varchar(64) NOT NULL,
	"idc_region" varchar(64),
	"gpu_count" integer NOT NULL,
	"external_ip" varchar(45),
	"internal_ip" varchar(45),
	"ops_status" varchar(64) DEFAULT '预留闲置中' NOT NULL,
	"lifecycle_status" varchar(32) NOT NULL,
	"in_maintenance" boolean DEFAULT false NOT NULL,
	"onboarding_substage" varchar(64),
	"bandwidth_group" varchar(64),
	"rate_limit" varchar(64),
	"cooperation_type" varchar(32) DEFAULT 'idle_time' NOT NULL,
	"device_spec" text,
	"device_purpose" varchar(255),
	"received_at" timestamp with time zone,
	"remark" text,
	"login_username" varchar(128),
	"login_password" text,
	"platform_resource_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_device_change_log" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_device_id" text NOT NULL,
	"onboarding_batch_id" text NOT NULL,
	"business_onboarding_batch_id" text,
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
	"import_status" varchar(32) DEFAULT 'uploaded' NOT NULL,
	"parse_error" text,
	"parsed_row_count" integer DEFAULT 0 NOT NULL,
	"parsed_success_count" integer DEFAULT 0 NOT NULL,
	"committed_incident_count" integer DEFAULT 0 NOT NULL,
	"committed_at" timestamp with time zone,
	"onboarding_batch_id" text,
	"created_by_staff_id" text,
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
	"previous_billing_unit" varchar(16),
	"new_billing_unit" varchar(16),
	"previous_unit_price" numeric(15, 4),
	"new_unit_price" numeric(15, 4),
	"previous_cards_per_machine" integer,
	"new_cards_per_machine" integer,
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
	"config_status" varchar(32) DEFAULT 'active' NOT NULL,
	"list_price_per_hour" numeric(15, 4),
	"unit_price_per_hour" numeric(15, 4),
	"billing_unit" varchar(16) DEFAULT 'hour' NOT NULL,
	"unit_price" numeric(15, 4),
	"cards_per_machine" integer DEFAULT 8,
	"deal_to_list_ratio" numeric(9, 6),
	"revenue_share_percent" numeric(7, 4),
	"pricing_tiers" jsonb,
	"effective_from" timestamp(0) NOT NULL,
	"effective_to" timestamp(0),
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
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_active_organization_id_organization_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitation_codes" ADD CONSTRAINT "user_invitation_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitation_relations" ADD CONSTRAINT "user_invitation_relations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitation_relations" ADD CONSTRAINT "user_invitation_relations_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitation_relations" ADD CONSTRAINT "user_invitation_relations_invitation_code_id_user_invitation_codes_id_fk" FOREIGN KEY ("invitation_code_id") REFERENCES "public"."user_invitation_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_activity" ADD CONSTRAINT "account_activity_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_activity" ADD CONSTRAINT "account_activity_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_activity" ADD CONSTRAINT "account_activity_activity_type_id_activity_type_definition_id_fk" FOREIGN KEY ("activity_type_id") REFERENCES "public"."activity_type_definition"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_activity" ADD CONSTRAINT "account_activity_actor_user_id_user_staff_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_manager_assignment" ADD CONSTRAINT "account_manager_assignment_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_manager_assignment" ADD CONSTRAINT "account_manager_assignment_user_staff_id_user_staff_id_fk" FOREIGN KEY ("user_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_snapshot_job_item" ADD CONSTRAINT "balance_snapshot_job_item_job_run_id_balance_snapshot_job_run_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."balance_snapshot_job_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_snapshot_job_item" ADD CONSTRAINT "balance_snapshot_job_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_sync_job_item" ADD CONSTRAINT "billing_sync_job_item_job_run_id_billing_sync_job_run_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."billing_sync_job_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_sync_job_item" ADD CONSTRAINT "billing_sync_job_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_sync_job_item" ADD CONSTRAINT "billing_sync_job_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order" ADD CONSTRAINT "commerce_order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order" ADD CONSTRAINT "commerce_order_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order" ADD CONSTRAINT "commerce_order_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order_item" ADD CONSTRAINT "commerce_order_item_order_id_commerce_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."commerce_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compute_task" ADD CONSTRAINT "compute_task_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compute_task" ADD CONSTRAINT "compute_task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_record" ADD CONSTRAINT "consumption_record_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_record" ADD CONSTRAINT "consumption_record_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_record" ADD CONSTRAINT "consumption_record_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_usage_daily" ADD CONSTRAINT "consumption_usage_daily_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_usage_daily" ADD CONSTRAINT "consumption_usage_daily_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_snapshot" ADD CONSTRAINT "contract_snapshot_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_snapshot" ADD CONSTRAINT "contract_snapshot_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_record" ADD CONSTRAINT "conversion_record_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_primary_tenant_id_tenant_id_fk" FOREIGN KEY ("primary_tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_business_line_id_business_line_id_fk" FOREIGN KEY ("business_line_id") REFERENCES "public"."business_line"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_sales_manager_id_user_staff_id_fk" FOREIGN KEY ("sales_manager_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_comment" ADD CONSTRAINT "engagement_comment_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_comment" ADD CONSTRAINT "engagement_comment_account_activity_id_account_activity_id_fk" FOREIGN KEY ("account_activity_id") REFERENCES "public"."account_activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_comment" ADD CONSTRAINT "engagement_comment_author_id_user_staff_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user_staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_document" ADD CONSTRAINT "engagement_document_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_document" ADD CONSTRAINT "engagement_document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_document" ADD CONSTRAINT "engagement_document_uploaded_by_user_staff_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_task" ADD CONSTRAINT "follow_up_task_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_task" ADD CONSTRAINT "follow_up_task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_task" ADD CONSTRAINT "follow_up_task_assignee_id_user_staff_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_task" ADD CONSTRAINT "follow_up_task_source_account_activity_id_account_activity_id_fk" FOREIGN KEY ("source_account_activity_id") REFERENCES "public"."account_activity"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_milestone" ADD CONSTRAINT "lifecycle_milestone_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_milestone" ADD CONSTRAINT "lifecycle_milestone_filled_by_user_staff_id_fk" FOREIGN KEY ("filled_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_lifecycle_milestone_id_lifecycle_milestone_id_fk" FOREIGN KEY ("lifecycle_milestone_id") REFERENCES "public"."lifecycle_milestone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_uploaded_by_user_staff_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_author_staff_id_user_staff_id_fk" FOREIGN KEY ("author_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity_attachment" ADD CONSTRAINT "project_activity_attachment_activity_id_project_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."project_activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_staff_assignment" ADD CONSTRAINT "project_staff_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_staff_assignment" ADD CONSTRAINT "project_staff_assignment_user_staff_id_user_staff_id_fk" FOREIGN KEY ("user_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_staff_assignment" ADD CONSTRAINT "project_staff_assignment_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tag_assignment" ADD CONSTRAINT "project_tag_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tag_assignment" ADD CONSTRAINT "project_tag_assignment_tag_id_project_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."project_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tenant" ADD CONSTRAINT "project_tenant_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tenant" ADD CONSTRAINT "project_tenant_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recharge" ADD CONSTRAINT "recharge_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recharge" ADD CONSTRAINT "recharge_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recharge_order" ADD CONSTRAINT "recharge_order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recharge_order" ADD CONSTRAINT "recharge_order_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_balance_snapshot" ADD CONSTRAINT "tenant_balance_snapshot_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_balance_snapshot" ADD CONSTRAINT "tenant_balance_snapshot_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_balance_snapshot" ADD CONSTRAINT "tenant_balance_snapshot_job_run_id_balance_snapshot_job_run_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."balance_snapshot_job_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_bill" ADD CONSTRAINT "tenant_bill_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_bill" ADD CONSTRAINT "tenant_bill_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_bill" ADD CONSTRAINT "tenant_bill_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_bill_detail" ADD CONSTRAINT "tenant_bill_detail_bill_id_tenant_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."tenant_bill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_consumption_daily_detail" ADD CONSTRAINT "tenant_consumption_daily_detail_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_consumption_daily_detail" ADD CONSTRAINT "tenant_consumption_daily_detail_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_voucher_issue" ADD CONSTRAINT "test_voucher_issue_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_voucher_issue" ADD CONSTRAINT "test_voucher_issue_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_voucher_issue" ADD CONSTRAINT "test_voucher_issue_operator_id_user_staff_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_voucher_issue" ADD CONSTRAINT "test_voucher_issue_coupon_id_coupon_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupon"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_staff" ADD CONSTRAINT "user_staff_auth_user_id_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "billing_period_agg_customer_consumption" ADD CONSTRAINT "billing_period_agg_customer_consumption_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD CONSTRAINT "billing_period_agg_customer_consumption_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD CONSTRAINT "billing_period_agg_customer_consumption_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_agg_customer_consumption" ADD CONSTRAINT "billing_period_agg_customer_consumption_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD CONSTRAINT "billing_period_cost_pricing_snapshot_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD CONSTRAINT "billing_period_cost_pricing_snapshot_window_id_billing_period_tenant_bill_window_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."billing_period_tenant_bill_window"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD CONSTRAINT "billing_period_cost_pricing_snapshot_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD CONSTRAINT "billing_period_cost_pricing_snapshot_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD CONSTRAINT "billing_period_cost_pricing_snapshot_supplier_unit_cost_id_supplier_unit_cost_id_fk" FOREIGN KEY ("supplier_unit_cost_id") REFERENCES "public"."supplier_unit_cost"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_pricing_snapshot" ADD CONSTRAINT "billing_period_cost_pricing_snapshot_supplier_pricing_record_id_supplier_pricing_record_id_fk" FOREIGN KEY ("supplier_pricing_record_id") REFERENCES "public"."supplier_pricing_record"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_staff_id_user_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_supplier_unit_cost_id_supplier_unit_cost_id_fk" FOREIGN KEY ("supplier_unit_cost_id") REFERENCES "public"."supplier_unit_cost"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_supplier_pricing_record_id_supplier_pricing_record_id_fk" FOREIGN KEY ("supplier_pricing_record_id") REFERENCES "public"."supplier_pricing_record"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_cost_source_line" ADD CONSTRAINT "billing_period_cost_source_line_window_id_billing_period_tenant_bill_window_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."billing_period_tenant_bill_window"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_import_batch" ADD CONSTRAINT "billing_period_import_batch_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_import_batch" ADD CONSTRAINT "billing_period_import_batch_window_id_billing_period_tenant_bill_window_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."billing_period_tenant_bill_window"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_import_batch" ADD CONSTRAINT "billing_period_import_batch_uploaded_by_user_staff_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_operation_log" ADD CONSTRAINT "billing_period_operation_log_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_operation_log" ADD CONSTRAINT "billing_period_operation_log_actor_id_user_staff_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_raw_baremetal_order" ADD CONSTRAINT "billing_period_raw_baremetal_order_batch_id_billing_period_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."billing_period_import_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_raw_customer_consumption" ADD CONSTRAINT "billing_period_raw_customer_consumption_batch_id_billing_period_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."billing_period_import_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_raw_tenant_bill" ADD CONSTRAINT "billing_period_raw_tenant_bill_batch_id_billing_period_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."billing_period_import_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_reconciliation_report" ADD CONSTRAINT "billing_period_reconciliation_report_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_tenant_bill_window" ADD CONSTRAINT "billing_period_tenant_bill_window_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "platform_cost_monthly" ADD CONSTRAINT "platform_cost_monthly_supplier_unit_cost_id_supplier_unit_cost_id_fk" FOREIGN KEY ("supplier_unit_cost_id") REFERENCES "public"."supplier_unit_cost"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD CONSTRAINT "platform_cost_monthly_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD CONSTRAINT "platform_cost_monthly_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_monthly" ADD CONSTRAINT "platform_cost_monthly_pricing_snapshot_id_billing_period_cost_pricing_snapshot_id_fk" FOREIGN KEY ("pricing_snapshot_id") REFERENCES "public"."billing_period_cost_pricing_snapshot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_income_monthly" ADD CONSTRAINT "platform_income_monthly_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_income_monthly" ADD CONSTRAINT "platform_income_monthly_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_income_monthly" ADD CONSTRAINT "platform_income_monthly_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_income_monthly" ADD CONSTRAINT "platform_income_monthly_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplementary_consumption_history" ADD CONSTRAINT "supplementary_consumption_history_income_id_platform_income_monthly_id_fk" FOREIGN KEY ("income_id") REFERENCES "public"."platform_income_monthly"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplementary_consumption_history" ADD CONSTRAINT "supplementary_consumption_history_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_project_cost" ADD CONSTRAINT "tenant_project_cost_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_project_cost" ADD CONSTRAINT "tenant_project_cost_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_project_cost" ADD CONSTRAINT "tenant_project_cost_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" ADD CONSTRAINT "voucher_card_hours_adjustment_history_cost_id_platform_cost_monthly_id_fk" FOREIGN KEY ("cost_id") REFERENCES "public"."platform_cost_monthly"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_card_hours_adjustment_history" ADD CONSTRAINT "voucher_card_hours_adjustment_history_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_list_price" ADD CONSTRAINT "platform_card_list_price_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_list_price" ADD CONSTRAINT "platform_card_list_price_updated_by_staff_id_user_staff_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_price_history" ADD CONSTRAINT "platform_card_price_history_price_record_id_platform_card_price_record_id_fk" FOREIGN KEY ("price_record_id") REFERENCES "public"."platform_card_price_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_price_history" ADD CONSTRAINT "platform_card_price_history_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_price_history" ADD CONSTRAINT "platform_card_price_history_changed_by_staff_id_user_staff_id_fk" FOREIGN KEY ("changed_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_price_record" ADD CONSTRAINT "platform_card_price_record_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_price_record" ADD CONSTRAINT "platform_card_price_record_platform_card_list_price_id_platform_card_list_price_id_fk" FOREIGN KEY ("platform_card_list_price_id") REFERENCES "public"."platform_card_list_price"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_card_price_record" ADD CONSTRAINT "platform_card_price_record_updated_by_staff_id_user_staff_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_condition_sheet" ADD CONSTRAINT "access_condition_sheet_contract_id_supplier_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compute_node" ADD CONSTRAINT "compute_node_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_center" ADD CONSTRAINT "data_center_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_state_transition_log" ADD CONSTRAINT "entity_state_transition_log_operator_staff_id_user_staff_id_fk" FOREIGN KEY ("operator_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD CONSTRAINT "fault_incident_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD CONSTRAINT "fault_incident_supplier_ops_upload_batch_id_supplier_ops_upload_batch_id_fk" FOREIGN KEY ("supplier_ops_upload_batch_id") REFERENCES "public"."supplier_ops_upload_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD CONSTRAINT "fault_incident_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fault_incident" ADD CONSTRAINT "fault_incident_compute_node_id_compute_node_id_fk" FOREIGN KEY ("compute_node_id") REFERENCES "public"."compute_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD CONSTRAINT "internal_test_hold_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD CONSTRAINT "internal_test_hold_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD CONSTRAINT "internal_test_hold_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD CONSTRAINT "internal_test_hold_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_test_hold" ADD CONSTRAINT "internal_test_hold_supplier_gpu_inventory_id_supplier_gpu_inventory_id_fk" FOREIGN KEY ("supplier_gpu_inventory_id") REFERENCES "public"."supplier_gpu_inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_test_hold_device_link" ADD CONSTRAINT "internal_test_hold_device_link_hold_id_internal_test_hold_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."internal_test_hold"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_test_hold_device_link" ADD CONSTRAINT "internal_test_hold_device_link_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD CONSTRAINT "onboarding_batch_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD CONSTRAINT "onboarding_batch_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD CONSTRAINT "onboarding_batch_contract_id_supplier_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contract"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD CONSTRAINT "onboarding_batch_access_condition_sheet_id_access_condition_sheet_id_fk" FOREIGN KEY ("access_condition_sheet_id") REFERENCES "public"."access_condition_sheet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD CONSTRAINT "onboarding_batch_parent_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("parent_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch" ADD CONSTRAINT "onboarding_batch_created_by_staff_id_user_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_device_link" ADD CONSTRAINT "onboarding_batch_device_link_business_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("business_onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_device_link" ADD CONSTRAINT "onboarding_batch_device_link_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_device_link" ADD CONSTRAINT "onboarding_batch_device_link_source_changelog_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("source_changelog_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_device_link" ADD CONSTRAINT "onboarding_batch_device_link_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_import_row" ADD CONSTRAINT "onboarding_batch_import_row_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_import_row" ADD CONSTRAINT "onboarding_batch_import_row_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_import_row" ADD CONSTRAINT "onboarding_batch_import_row_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_plan_line" ADD CONSTRAINT "onboarding_batch_plan_line_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_plan_line" ADD CONSTRAINT "onboarding_batch_plan_line_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_progress_event" ADD CONSTRAINT "onboarding_batch_progress_event_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_progress_event" ADD CONSTRAINT "onboarding_batch_progress_event_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_batch_progress_event" ADD CONSTRAINT "onboarding_batch_progress_event_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "supplier_device_change_log" ADD CONSTRAINT "supplier_device_change_log_supplier_device_id_supplier_device_id_fk" FOREIGN KEY ("supplier_device_id") REFERENCES "public"."supplier_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_device_change_log" ADD CONSTRAINT "supplier_device_change_log_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_device_change_log" ADD CONSTRAINT "supplier_device_change_log_business_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("business_onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_gpu_inventory" ADD CONSTRAINT "supplier_gpu_inventory_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_gpu_inventory" ADD CONSTRAINT "supplier_gpu_inventory_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_gpu_inventory" ADD CONSTRAINT "supplier_gpu_inventory_gpu_card_type_id_gpu_card_type_id_fk" FOREIGN KEY ("gpu_card_type_id") REFERENCES "public"."gpu_card_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ops_upload_batch" ADD CONSTRAINT "supplier_ops_upload_batch_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ops_upload_batch" ADD CONSTRAINT "supplier_ops_upload_batch_onboarding_batch_id_onboarding_batch_id_fk" FOREIGN KEY ("onboarding_batch_id") REFERENCES "public"."onboarding_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ops_upload_batch" ADD CONSTRAINT "supplier_ops_upload_batch_created_by_staff_id_user_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitation_inviter_id_idx" ON "invitation" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_invitation_codes_user_id_idx" ON "user_invitation_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_invitation_codes_code_idx" ON "user_invitation_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "user_invitation_codes_active_idx" ON "user_invitation_codes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_invitation_relations_inviter_idx" ON "user_invitation_relations" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "user_invitation_relations_invitee_idx" ON "user_invitation_relations" USING btree ("invitee_id");--> statement-breakpoint
CREATE INDEX "user_invitation_relations_code_idx" ON "user_invitation_relations" USING btree ("invitation_code_id");--> statement-breakpoint
CREATE INDEX "user_invitation_relations_unique_idx" ON "user_invitation_relations" USING btree ("inviter_id","invitee_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "account_activity_idempotency_key_uk" ON "account_activity" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "account_activity_customer_occurred_idx" ON "account_activity" USING btree ("customer_id","occurred_at");--> statement-breakpoint
CREATE INDEX "account_activity_tenant_occurred_idx" ON "account_activity" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "account_manager_assignment_customer_id_idx" ON "account_manager_assignment" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "account_manager_assignment_user_staff_id_idx" ON "account_manager_assignment" USING btree ("user_staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_type_definition_type_code_uk" ON "activity_type_definition" USING btree ("type_code");--> statement-breakpoint
CREATE INDEX "balance_snapshot_job_item_job_run_id_idx" ON "balance_snapshot_job_item" USING btree ("job_run_id");--> statement-breakpoint
CREATE INDEX "balance_snapshot_job_item_tenant_id_idx" ON "balance_snapshot_job_item" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "balance_snapshot_job_run_started_at_idx" ON "balance_snapshot_job_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "balance_snapshot_job_run_status_idx" ON "balance_snapshot_job_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_sync_job_item_job_run_id_idx" ON "billing_sync_job_item" USING btree ("job_run_id");--> statement-breakpoint
CREATE INDEX "billing_sync_job_item_tenant_id_idx" ON "billing_sync_job_item" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_sync_job_run_started_at_idx" ON "billing_sync_job_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "billing_sync_job_run_status_idx" ON "billing_sync_job_run" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_platform_tenant_id_uk" ON "tenant" USING btree ("platform_tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_customer_default_uk" ON "tenant" USING btree ("customer_id") WHERE "tenant"."is_default" = true;--> statement-breakpoint
CREATE INDEX "tenant_customer_id_idx" ON "tenant" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_line_code_uk" ON "business_line" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_order_order_no_uk" ON "commerce_order" USING btree ("order_no");--> statement-breakpoint
CREATE INDEX "commerce_order_project_id_idx" ON "commerce_order" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "commerce_order_item_order_id_idx" ON "commerce_order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "compute_task_tenant_id_idx" ON "compute_task" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "compute_task_project_id_idx" ON "compute_task" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "consumption_record_project_occurred_idx" ON "consumption_record" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE INDEX "consumption_record_tenant_occurred_idx" ON "consumption_record" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "consumption_usage_daily_tenant_date_pl_uk" ON "consumption_usage_daily" USING btree ("tenant_id","usage_date","product_line");--> statement-breakpoint
CREATE INDEX "consumption_usage_daily_tenant_date_idx" ON "consumption_usage_daily" USING btree ("tenant_id","usage_date");--> statement-breakpoint
CREATE INDEX "consumption_usage_daily_tenant_month_pl_idx" ON "consumption_usage_daily" USING btree ("tenant_id","usage_month","product_line");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_contract_no_uk" ON "contract" USING btree ("contract_no");--> statement-breakpoint
CREATE INDEX "contract_customer_id_idx" ON "contract" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "contract_project_id_idx" ON "contract" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "contract_snapshot_customer_id_idx" ON "contract_snapshot" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "conversion_record_customer_id_idx" ON "conversion_record" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_code_uk" ON "coupon" USING btree ("code");--> statement-breakpoint
CREATE INDEX "coupon_tenant_id_idx" ON "coupon" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "project_customer_id_idx" ON "project" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "project_primary_tenant_id_idx" ON "project" USING btree ("primary_tenant_id");--> statement-breakpoint
CREATE INDEX "project_business_line_id_idx" ON "project" USING btree ("business_line_id");--> statement-breakpoint
CREATE INDEX "project_stage_idx" ON "project" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "project_status_idx" ON "project" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_code_uk" ON "customer" USING btree ("customer_code");--> statement-breakpoint
CREATE INDEX "customer_status_idx" ON "customer" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customer_type_idx" ON "customer" USING btree ("type");--> statement-breakpoint
CREATE INDEX "engagement_comment_account_activity_id_idx" ON "engagement_comment" USING btree ("account_activity_id");--> statement-breakpoint
CREATE INDEX "engagement_document_customer_id_idx" ON "engagement_document" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "follow_up_task_customer_id_idx" ON "follow_up_task" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "follow_up_task_project_id_idx" ON "follow_up_task" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "lifecycle_milestone_customer_id_idx" ON "lifecycle_milestone" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "milestone_evidence_lifecycle_milestone_id_idx" ON "milestone_evidence" USING btree ("lifecycle_milestone_id");--> statement-breakpoint
CREATE INDEX "project_activity_project_id_idx" ON "project_activity" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_activity_attachment_activity_id_idx" ON "project_activity_attachment" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_staff_assignment_current_role_uk" ON "project_staff_assignment" USING btree ("project_id","role_type") WHERE "project_staff_assignment"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "project_staff_assignment_user_staff_id_idx" ON "project_staff_assignment" USING btree ("user_staff_id");--> statement-breakpoint
CREATE INDEX "project_staff_assignment_project_id_idx" ON "project_staff_assignment" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_tag_name_uk" ON "project_tag" USING btree ("name");--> statement-breakpoint
CREATE INDEX "project_tag_assignment_tag_id_idx" ON "project_tag_assignment" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_tenant_project_tenant_uk" ON "project_tenant" USING btree ("project_id","tenant_id");--> statement-breakpoint
CREATE INDEX "project_tenant_tenant_id_idx" ON "project_tenant" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recharge_transaction_id_uk" ON "recharge" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "recharge_tenant_id_idx" ON "recharge" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "recharge_project_id_idx" ON "recharge" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "recharge_order_tenant_id_idx" ON "recharge_order" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_balance_snapshot_uk" ON "tenant_balance_snapshot" USING btree ("tenant_id","granularity","bucket_start");--> statement-breakpoint
CREATE INDEX "tenant_balance_snapshot_tenant_date_idx" ON "tenant_balance_snapshot" USING btree ("tenant_id","bucket_date");--> statement-breakpoint
CREATE INDEX "tenant_balance_snapshot_granularity_date_idx" ON "tenant_balance_snapshot" USING btree ("granularity","bucket_date");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_bill_tenant_month_uk" ON "tenant_bill" USING btree ("tenant_id","bill_month");--> statement-breakpoint
CREATE INDEX "tenant_bill_tenant_id_idx" ON "tenant_bill" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_bill_detail_bill_id_idx" ON "tenant_bill_detail" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_consumption_daily_detail_idempotency_uk" ON "tenant_consumption_daily_detail" USING btree ("platform_idempotency_key");--> statement-breakpoint
CREATE INDEX "tenant_consumption_daily_detail_tenant_date_pl_idx" ON "tenant_consumption_daily_detail" USING btree ("tenant_id","usage_date","product_line");--> statement-breakpoint
CREATE INDEX "tenant_consumption_daily_detail_tenant_month_pl_idx" ON "tenant_consumption_daily_detail" USING btree ("tenant_id","usage_month","product_line");--> statement-breakpoint
CREATE INDEX "test_voucher_issue_customer_id_idx" ON "test_voucher_issue" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_employee_no_uk" ON "user_staff" USING btree ("employee_no");--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_email_uk" ON "user_staff" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_staff_status_idx" ON "user_staff" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_default_pre_sales_uk" ON "user_staff" USING btree ("is_default_pre_sales") WHERE "user_staff"."is_default_pre_sales" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_default_account_manager_uk" ON "user_staff" USING btree ("is_default_account_manager") WHERE "user_staff"."is_default_account_manager" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_default_delivery_manager_uk" ON "user_staff" USING btree ("is_default_delivery_manager") WHERE "user_staff"."is_default_delivery_manager" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_default_project_manager_uk" ON "user_staff" USING btree ("is_default_project_manager") WHERE "user_staff"."is_default_project_manager" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_auth_user_id_uk" ON "user_staff" USING btree ("auth_user_id") WHERE "user_staff"."auth_user_id" is not null;--> statement-breakpoint
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
CREATE UNIQUE INDEX "billing_period_period_code_uk" ON "billing_period" USING btree ("period_code");--> statement-breakpoint
CREATE INDEX "billing_period_status_idx" ON "billing_period" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_period_period_start_idx" ON "billing_period" USING btree ("period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_agg_customer_consumption_uk" ON "billing_period_agg_customer_consumption" USING btree ("billing_period_id","tenant_platform_id","project_id");--> statement-breakpoint
CREATE INDEX "billing_period_agg_customer_consumption_period_id_idx" ON "billing_period_agg_customer_consumption" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_cost_pricing_snapshot_uk" ON "billing_period_cost_pricing_snapshot" USING btree ("billing_period_id","window_id","data_center_id","gpu_card_type_id");--> statement-breakpoint
CREATE INDEX "billing_period_cost_pricing_snapshot_period_id_idx" ON "billing_period_cost_pricing_snapshot" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_cost_source_line_uk" ON "billing_period_cost_source_line" USING btree ("billing_period_id","kind","source_raw_id","staff_id");--> statement-breakpoint
CREATE INDEX "billing_period_cost_source_line_period_id_idx" ON "billing_period_cost_source_line" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_customer_uk" ON "billing_period_import_batch" USING btree ("billing_period_id") WHERE "billing_period_import_batch"."file_type" = 'customer_consumption';--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_baremetal_uk" ON "billing_period_import_batch" USING btree ("billing_period_id") WHERE "billing_period_import_batch"."file_type" = 'baremetal_order';--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_import_batch_period_tenant_window_uk" ON "billing_period_import_batch" USING btree ("billing_period_id","window_id") WHERE "billing_period_import_batch"."file_type" = 'tenant_bill';--> statement-breakpoint
CREATE INDEX "billing_period_import_batch_period_id_idx" ON "billing_period_import_batch" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "billing_period_import_batch_window_id_idx" ON "billing_period_import_batch" USING btree ("window_id");--> statement-breakpoint
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
CREATE UNIQUE INDEX "billing_period_tenant_bill_window_uk" ON "billing_period_tenant_bill_window" USING btree ("billing_period_id","window_start","window_end");--> statement-breakpoint
CREATE INDEX "billing_period_tenant_bill_window_period_id_idx" ON "billing_period_tenant_bill_window" USING btree ("billing_period_id");--> statement-breakpoint
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
CREATE INDEX "platform_cost_monthly_data_center_id_idx" ON "platform_cost_monthly" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "platform_cost_monthly_gpu_card_type_id_idx" ON "platform_cost_monthly" USING btree ("gpu_card_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_monthly_record_uk" ON "platform_cost_monthly" USING btree ("billing_period_id","staff_id","data_center_id","gpu_card_type_id") WHERE "platform_cost_monthly"."type" = 'record';--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_monthly_period_sum_uk" ON "platform_cost_monthly" USING btree ("billing_period_id") WHERE "platform_cost_monthly"."type" = 'sum' AND "platform_cost_monthly"."staff_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_monthly_staff_sum_uk" ON "platform_cost_monthly" USING btree ("billing_period_id","staff_id") WHERE "platform_cost_monthly"."type" = 'sum' AND "platform_cost_monthly"."staff_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_income_monthly_period_tenant_project_uk" ON "platform_income_monthly" USING btree ("billing_period_id","tenant_id","project_id");--> statement-breakpoint
CREATE INDEX "platform_income_monthly_billing_period_id_idx" ON "platform_income_monthly" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "platform_income_monthly_tenant_platform_id_idx" ON "platform_income_monthly" USING btree ("tenant_platform_id");--> statement-breakpoint
CREATE INDEX "supplementary_consumption_history_income_id_idx" ON "supplementary_consumption_history" USING btree ("income_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_project_cost_current_uk" ON "tenant_project_cost" USING btree ("tenant_id","project_id") WHERE "tenant_project_cost"."effective_to" IS NULL;--> statement-breakpoint
CREATE INDEX "tenant_project_cost_tenant_id_idx" ON "tenant_project_cost" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_project_cost_project_id_idx" ON "tenant_project_cost" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "voucher_card_hours_adjustment_history_cost_id_idx" ON "voucher_card_hours_adjustment_history" USING btree ("cost_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_card_list_price_current_uk" ON "platform_card_list_price" USING btree ("gpu_card_type_id","product_line","billing_unit") WHERE "platform_card_list_price"."effective_to" IS NULL AND "platform_card_list_price"."status" = 'active';--> statement-breakpoint
CREATE INDEX "platform_card_list_price_gpu_card_type_id_idx" ON "platform_card_list_price" USING btree ("gpu_card_type_id");--> statement-breakpoint
CREATE INDEX "platform_card_list_price_product_line_idx" ON "platform_card_list_price" USING btree ("product_line");--> statement-breakpoint
CREATE INDEX "platform_card_list_price_effective_from_idx" ON "platform_card_list_price" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "platform_card_price_history_record_changed_idx" ON "platform_card_price_history" USING btree ("price_record_id","changed_at");--> statement-breakpoint
CREATE INDEX "platform_card_price_history_gpu_card_type_id_idx" ON "platform_card_price_history" USING btree ("gpu_card_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_card_price_record_uk" ON "platform_card_price_record" USING btree ("gpu_card_type_id","product_line","billing_unit");--> statement-breakpoint
CREATE INDEX "platform_card_price_record_list_price_id_idx" ON "platform_card_price_record" USING btree ("platform_card_list_price_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_condition_sheet_contract_version_uk" ON "access_condition_sheet" USING btree ("contract_id","version_no");--> statement-breakpoint
CREATE UNIQUE INDEX "access_condition_sheet_current_uk" ON "access_condition_sheet" USING btree ("contract_id") WHERE "access_condition_sheet"."is_current" = true;--> statement-breakpoint
CREATE INDEX "compute_node_supplier_device_id_idx" ON "compute_node" USING btree ("supplier_device_id");--> statement-breakpoint
CREATE INDEX "compute_node_cluster_id_idx" ON "compute_node" USING btree ("cluster_id");--> statement-breakpoint
CREATE UNIQUE INDEX "data_center_supplier_code_uk" ON "data_center" USING btree ("supplier_id","code");--> statement-breakpoint
CREATE INDEX "data_center_supplier_id_idx" ON "data_center" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "data_center_status_idx" ON "data_center" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_center_supplier_external_onboarding_id_idx" ON "data_center" USING btree ("supplier_id","external_onboarding_id");--> statement-breakpoint
CREATE INDEX "entity_state_transition_log_entity_idx" ON "entity_state_transition_log" USING btree ("entity_type","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "fault_incident_supplier_id_opened_idx" ON "fault_incident" USING btree ("supplier_id","opened_at");--> statement-breakpoint
CREATE INDEX "fault_incident_supplier_device_id_idx" ON "fault_incident" USING btree ("supplier_device_id");--> statement-breakpoint
CREATE INDEX "fault_incident_compute_node_id_idx" ON "fault_incident" USING btree ("compute_node_id");--> statement-breakpoint
CREATE INDEX "fault_incident_ops_upload_batch_id_idx" ON "fault_incident" USING btree ("supplier_ops_upload_batch_id");--> statement-breakpoint
CREATE INDEX "fault_incident_fault_type_idx" ON "fault_incident" USING btree ("fault_type");--> statement-breakpoint
CREATE UNIQUE INDEX "gpu_card_type_name_uk" ON "gpu_card_type" USING btree ("name");--> statement-breakpoint
CREATE INDEX "internal_test_hold_supplier_device_id_idx" ON "internal_test_hold" USING btree ("supplier_device_id");--> statement-breakpoint
CREATE INDEX "internal_test_hold_inventory_id_idx" ON "internal_test_hold" USING btree ("supplier_gpu_inventory_id");--> statement-breakpoint
CREATE INDEX "internal_test_hold_supplier_id_idx" ON "internal_test_hold" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "internal_test_hold_data_center_id_idx" ON "internal_test_hold" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "internal_test_hold_work_order_no_idx" ON "internal_test_hold" USING btree ("work_order_no");--> statement-breakpoint
CREATE UNIQUE INDEX "internal_test_hold_device_link_uk" ON "internal_test_hold_device_link" USING btree ("hold_id","supplier_device_id");--> statement-breakpoint
CREATE INDEX "internal_test_hold_device_link_hold_id_idx" ON "internal_test_hold_device_link" USING btree ("hold_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lifecycle_state_definition_uk" ON "lifecycle_state_definition" USING btree ("domain","state_code");--> statement-breakpoint
CREATE INDEX "lifecycle_state_definition_domain_idx" ON "lifecycle_state_definition" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_batch_code_uk" ON "onboarding_batch" USING btree ("batch_code");--> statement-breakpoint
CREATE INDEX "onboarding_batch_supplier_id_idx" ON "onboarding_batch" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_data_center_id_idx" ON "onboarding_batch" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_idc_code_idx" ON "onboarding_batch" USING btree ("idc_code");--> statement-breakpoint
CREATE INDEX "onboarding_batch_contract_id_idx" ON "onboarding_batch" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_status_idx" ON "onboarding_batch" USING btree ("batch_status");--> statement-breakpoint
CREATE INDEX "onboarding_batch_import_status_idx" ON "onboarding_batch" USING btree ("import_status");--> statement-breakpoint
CREATE INDEX "onboarding_batch_supplier_dc_created_idx" ON "onboarding_batch" USING btree ("supplier_id","data_center_id","created_at");--> statement-breakpoint
CREATE INDEX "onboarding_batch_work_order_no_idx" ON "onboarding_batch" USING btree ("work_order_no");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_batch_supplier_work_order_uk" ON "onboarding_batch" USING btree ("supplier_id","work_order_no") WHERE "onboarding_batch"."work_order_no" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "onboarding_batch_parent_batch_id_idx" ON "onboarding_batch" USING btree ("parent_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_batch_device_link_uk" ON "onboarding_batch_device_link" USING btree ("business_onboarding_batch_id","supplier_device_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_device_link_batch_id_idx" ON "onboarding_batch_device_link" USING btree ("business_onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_device_link_device_linked_idx" ON "onboarding_batch_device_link" USING btree ("supplier_device_id","linked_at");--> statement-breakpoint
CREATE INDEX "onboarding_batch_device_link_batch_card_coop_idx" ON "onboarding_batch_device_link" USING btree ("business_onboarding_batch_id","gpu_card_type_id","cooperation_type");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_batch_import_row_uk" ON "onboarding_batch_import_row" USING btree ("onboarding_batch_id","row_no");--> statement-breakpoint
CREATE INDEX "onboarding_batch_import_row_batch_id_idx" ON "onboarding_batch_import_row" USING btree ("onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_import_row_parse_status_idx" ON "onboarding_batch_import_row" USING btree ("parse_status");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_batch_plan_line_uk" ON "onboarding_batch_plan_line" USING btree ("onboarding_batch_id","gpu_card_type_id","cooperation_type");--> statement-breakpoint
CREATE INDEX "onboarding_batch_plan_line_batch_id_idx" ON "onboarding_batch_plan_line" USING btree ("onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "onboarding_batch_progress_event_batch_occurred_idx" ON "onboarding_batch_progress_event" USING btree ("onboarding_batch_id","occurred_at");--> statement-breakpoint
CREATE INDEX "onboarding_batch_progress_event_occurred_idx" ON "onboarding_batch_progress_event" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "onboarding_batch_progress_event_kind_occurred_idx" ON "onboarding_batch_progress_event" USING btree ("batch_kind","occurred_at");--> statement-breakpoint
CREATE INDEX "onboarding_batch_progress_event_supplier_dc_occurred_idx" ON "onboarding_batch_progress_event" USING btree ("supplier_id","data_center_id","occurred_at");--> statement-breakpoint
CREATE INDEX "onboarding_task_batch_id_idx" ON "onboarding_task" USING btree ("onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "resource_pool_binding_supplier_device_id_idx" ON "resource_pool_binding" USING btree ("supplier_device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_code_uk" ON "supplier" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_external_tenant_id_uk" ON "supplier" USING btree ("external_tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_external_onboarding_id_uk" ON "supplier" USING btree ("external_onboarding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_platform_tenant_id_uk" ON "supplier" USING btree ("platform_tenant_id");--> statement-breakpoint
CREATE INDEX "supplier_status_idx" ON "supplier" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_business_manager_staff_id_idx" ON "supplier" USING btree ("business_manager_staff_id");--> statement-breakpoint
CREATE INDEX "supplier_identity_no_idx" ON "supplier" USING btree ("identity_no");--> statement-breakpoint
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
CREATE INDEX "supplier_device_ops_status_idx" ON "supplier_device" USING btree ("ops_status");--> statement-breakpoint
CREATE INDEX "supplier_device_in_maintenance_idx" ON "supplier_device" USING btree ("in_maintenance");--> statement-breakpoint
CREATE INDEX "supplier_device_external_device_id_idx" ON "supplier_device" USING btree ("external_device_id");--> statement-breakpoint
CREATE INDEX "supplier_device_cooperation_type_idx" ON "supplier_device" USING btree ("cooperation_type");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_device_change_log_batch_row_uk" ON "supplier_device_change_log" USING btree ("onboarding_batch_id","import_row_no");--> statement-breakpoint
CREATE INDEX "supplier_device_change_log_device_occurred_idx" ON "supplier_device_change_log" USING btree ("supplier_device_id","occurred_at");--> statement-breakpoint
CREATE INDEX "supplier_device_change_log_batch_id_idx" ON "supplier_device_change_log" USING btree ("onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "supplier_device_change_log_ticket_no_idx" ON "supplier_device_change_log" USING btree ("ticket_no");--> statement-breakpoint
CREATE INDEX "supplier_device_change_log_business_batch_id_idx" ON "supplier_device_change_log" USING btree ("business_onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "supplier_device_change_log_business_device_idx" ON "supplier_device_change_log" USING btree ("business_onboarding_batch_id","supplier_device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_gpu_inventory_uk" ON "supplier_gpu_inventory" USING btree ("supplier_id","data_center_id","gpu_card_type_id");--> statement-breakpoint
CREATE INDEX "supplier_ops_upload_batch_supplier_id_idx" ON "supplier_ops_upload_batch" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_ops_upload_batch_onboarding_batch_id_idx" ON "supplier_ops_upload_batch" USING btree ("onboarding_batch_id");--> statement-breakpoint
CREATE INDEX "supplier_ops_upload_batch_import_status_idx" ON "supplier_ops_upload_batch" USING btree ("import_status");--> statement-breakpoint
CREATE INDEX "supplier_pricing_history_record_changed_idx" ON "supplier_pricing_history" USING btree ("pricing_record_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_pricing_record_uk" ON "supplier_pricing_record" USING btree ("supplier_id","data_center_id","gpu_card_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_pricing_tier_uk" ON "supplier_pricing_tier" USING btree ("contract_id","tier_order","supplier_card_list_price_id");--> statement-breakpoint
CREATE INDEX "supplier_terms_version_supplier_id_idx" ON "supplier_terms_version" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_terms_version_contract_id_idx" ON "supplier_terms_version" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_unit_cost_current_uk" ON "supplier_unit_cost" USING btree ("supplier_terms_version_id","data_center_id","gpu_card_type_id") WHERE "supplier_unit_cost"."effective_to" IS NULL;