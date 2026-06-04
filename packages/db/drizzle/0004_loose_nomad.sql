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
ALTER TABLE "project" ADD COLUMN "opportunity_source" varchar(32);--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "deal_closed_month" varchar(7);--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "commission_month_phase" varchar(32);--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "commission_phase_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_conversion_setting" ADD CONSTRAINT "project_conversion_setting_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_conversion_setting" ADD CONSTRAINT "project_conversion_setting_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_opportunity_source_assignment" ADD CONSTRAINT "project_opportunity_source_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_opportunity_source_assignment" ADD CONSTRAINT "project_opportunity_source_assignment_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_conversion_setting_project_id_uk" ON "project_conversion_setting" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_conversion_setting_conversion_date_idx" ON "project_conversion_setting" USING btree ("conversion_date");--> statement-breakpoint
CREATE UNIQUE INDEX "project_opportunity_source_assignment_current_uk" ON "project_opportunity_source_assignment" USING btree ("project_id") WHERE "project_opportunity_source_assignment"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "project_opportunity_source_assignment_project_id_idx" ON "project_opportunity_source_assignment" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_opportunity_source_assignment_effective_from_idx" ON "project_opportunity_source_assignment" USING btree ("project_id","effective_from");--> statement-breakpoint
CREATE INDEX "project_opportunity_source_idx" ON "project" USING btree ("opportunity_source");--> statement-breakpoint
CREATE INDEX "project_deal_closed_month_idx" ON "project" USING btree ("deal_closed_month");