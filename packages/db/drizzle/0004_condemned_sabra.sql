CREATE TABLE "project_monthly_cost_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_period_id" text NOT NULL,
	"settlement_month" varchar(7) NOT NULL,
	"tenant_id" text NOT NULL,
	"tenant_platform_id" varchar(128) NOT NULL,
	"tenant_name" varchar(255) NOT NULL,
	"project_id" text,
	"project_name" varchar(255),
	"customer_id" text,
	"customer_full_name" varchar(255),
	"account_manager" varchar(128),
	"opportunity_source" varchar(64),
	"month_phase_label" varchar(64),
	"balance_consumption" numeric(15, 4) DEFAULT '0' NOT NULL,
	"balance_card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"voucher_card_hours" numeric(15, 4) DEFAULT '0' NOT NULL,
	"confirmed_revenue_excl_tax" numeric(15, 4) DEFAULT '0' NOT NULL,
	"sold_duration_cost_excl_tax" numeric(15, 4) DEFAULT '0' NOT NULL,
	"gifted_duration_cost_excl_tax" numeric(15, 4) DEFAULT '0' NOT NULL,
	"gross_profit" numeric(15, 4) DEFAULT '0' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"saved_by" text,
	"saved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_monthly_cost_snapshot" ADD CONSTRAINT "project_monthly_cost_snapshot_billing_period_id_billing_period_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_monthly_cost_snapshot" ADD CONSTRAINT "project_monthly_cost_snapshot_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_monthly_cost_snapshot" ADD CONSTRAINT "project_monthly_cost_snapshot_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_monthly_cost_snapshot" ADD CONSTRAINT "project_monthly_cost_snapshot_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_monthly_cost_snapshot" ADD CONSTRAINT "project_monthly_cost_snapshot_saved_by_user_staff_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_monthly_cost_snapshot_period_tenant_uk" ON "project_monthly_cost_snapshot" USING btree ("billing_period_id","tenant_platform_id");--> statement-breakpoint
CREATE INDEX "project_monthly_cost_snapshot_project_month_idx" ON "project_monthly_cost_snapshot" USING btree ("project_id","settlement_month");--> statement-breakpoint
CREATE INDEX "project_monthly_cost_snapshot_tenant_month_idx" ON "project_monthly_cost_snapshot" USING btree ("tenant_id","settlement_month");