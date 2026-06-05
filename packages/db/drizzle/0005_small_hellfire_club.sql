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
ALTER TABLE "billing_period" ADD COLUMN "enterprise_income" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "billing_period" ADD COLUMN "personal_income" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "billing_period" ADD COLUMN "income_total" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "billing_period" ADD COLUMN "project_cost" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "billing_period" ADD COLUMN "internal_user_cost" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "billing_period" ADD COLUMN "ignore_list_price_windows" boolean DEFAULT false NOT NULL;--> statement-breakpoint
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
CREATE UNIQUE INDEX "platform_cost_commission_derive_am_phase_run_am_phase_uk" ON "platform_cost_commission_derive_am_phase" USING btree ("run_id","account_manager_staff_id","month_phase");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_commission_derive_dept_phase_run_dept_phase_uk" ON "platform_cost_commission_derive_dept_phase" USING btree ("run_id","recipient_dept","month_phase");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_commission_derive_issue_run_project_code_uk" ON "platform_cost_commission_derive_issue" USING btree ("run_id","project_id","code");--> statement-breakpoint
CREATE INDEX "platform_cost_commission_derive_issue_run_idx" ON "platform_cost_commission_derive_issue" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_commission_derive_line_run_project_role_uk" ON "platform_cost_commission_derive_line" USING btree ("run_id","project_id","recipient_role");--> statement-breakpoint
CREATE INDEX "platform_cost_commission_derive_line_run_idx" ON "platform_cost_commission_derive_line" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_commission_derive_project_run_project_uk" ON "platform_cost_commission_derive_project" USING btree ("run_id","project_id");--> statement-breakpoint
CREATE INDEX "platform_cost_commission_derive_project_run_idx" ON "platform_cost_commission_derive_project" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "platform_cost_commission_derive_run_period_idx" ON "platform_cost_commission_derive_run" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_cost_commission_derive_run_period_policy_ver_uk" ON "platform_cost_commission_derive_run" USING btree ("billing_period_id","policy_code","run_version");