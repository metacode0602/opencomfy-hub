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
CREATE TABLE "tenant" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"platform_tenant_id" varchar(128),
	"is_default" boolean DEFAULT false NOT NULL,
	"status" varchar(32) NOT NULL,
	"balance" numeric(15, 4) DEFAULT '0' NOT NULL,
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
	"amount" numeric(15, 4) NOT NULL,
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
	"product_line" varchar(64),
	"unit" varchar(32),
	"amount" numeric(15, 4),
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
	"balance" numeric(15, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"customer_code" varchar(64),
	"account_name" varchar(255),
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "tenant_bill" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"tenant_id" text,
	"project_id" text,
	"bill_month" varchar(7) NOT NULL,
	"total_amount" numeric(15, 4) NOT NULL,
	"status" varchar(32) NOT NULL,
	"due_date" date NOT NULL,
	"paid_at" timestamp with time zone
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
	"amount" numeric(15, 4) NOT NULL
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_activity" ADD CONSTRAINT "account_activity_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_activity" ADD CONSTRAINT "account_activity_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_activity" ADD CONSTRAINT "account_activity_activity_type_id_activity_type_definition_id_fk" FOREIGN KEY ("activity_type_id") REFERENCES "public"."activity_type_definition"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_activity" ADD CONSTRAINT "account_activity_actor_user_id_user_staff_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_manager_assignment" ADD CONSTRAINT "account_manager_assignment_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_manager_assignment" ADD CONSTRAINT "account_manager_assignment_user_staff_id_user_staff_id_fk" FOREIGN KEY ("user_staff_id") REFERENCES "public"."user_staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "project_tenant" ADD CONSTRAINT "project_tenant_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tenant" ADD CONSTRAINT "project_tenant_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recharge" ADD CONSTRAINT "recharge_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recharge" ADD CONSTRAINT "recharge_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recharge_order" ADD CONSTRAINT "recharge_order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recharge_order" ADD CONSTRAINT "recharge_order_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_bill" ADD CONSTRAINT "tenant_bill_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_bill" ADD CONSTRAINT "tenant_bill_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_bill" ADD CONSTRAINT "tenant_bill_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_bill_detail" ADD CONSTRAINT "tenant_bill_detail_bill_id_tenant_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."tenant_bill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_voucher_issue" ADD CONSTRAINT "test_voucher_issue_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_voucher_issue" ADD CONSTRAINT "test_voucher_issue_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_voucher_issue" ADD CONSTRAINT "test_voucher_issue_operator_id_user_staff_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_voucher_issue" ADD CONSTRAINT "test_voucher_issue_coupon_id_coupon_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupon"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_activity_idempotency_key_uk" ON "account_activity" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "account_activity_customer_occurred_idx" ON "account_activity" USING btree ("customer_id","occurred_at");--> statement-breakpoint
CREATE INDEX "account_activity_tenant_occurred_idx" ON "account_activity" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "account_manager_assignment_customer_id_idx" ON "account_manager_assignment" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "account_manager_assignment_user_staff_id_idx" ON "account_manager_assignment" USING btree ("user_staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_type_definition_type_code_uk" ON "activity_type_definition" USING btree ("type_code");--> statement-breakpoint
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
CREATE INDEX "consumption_usage_daily_tenant_date_idx" ON "consumption_usage_daily" USING btree ("tenant_id","usage_date");--> statement-breakpoint
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
CREATE UNIQUE INDEX "project_tenant_project_tenant_uk" ON "project_tenant" USING btree ("project_id","tenant_id");--> statement-breakpoint
CREATE INDEX "project_tenant_tenant_id_idx" ON "project_tenant" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recharge_transaction_id_uk" ON "recharge" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "recharge_tenant_id_idx" ON "recharge" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "recharge_project_id_idx" ON "recharge" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "recharge_order_tenant_id_idx" ON "recharge_order" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_bill_project_month_uk" ON "tenant_bill" USING btree ("project_id","bill_month");--> statement-breakpoint
CREATE INDEX "tenant_bill_tenant_id_idx" ON "tenant_bill" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_bill_detail_bill_id_idx" ON "tenant_bill_detail" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "test_voucher_issue_customer_id_idx" ON "test_voucher_issue" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_employee_no_uk" ON "user_staff" USING btree ("employee_no");--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_email_uk" ON "user_staff" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_staff_status_idx" ON "user_staff" USING btree ("status");