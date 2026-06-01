ALTER TABLE "project" ADD COLUMN "revenue_department" varchar(32);--> statement-breakpoint
CREATE TABLE "project_revenue_department_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"department" varchar(32) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);--> statement-breakpoint
ALTER TABLE "project_revenue_department_assignment" ADD CONSTRAINT "project_revenue_department_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_revenue_department_assignment" ADD CONSTRAINT "project_revenue_department_assignment_created_by_user_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_revenue_department_assignment_current_uk" ON "project_revenue_department_assignment" USING btree ("project_id") WHERE "project_revenue_department_assignment"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "project_revenue_department_assignment_project_id_idx" ON "project_revenue_department_assignment" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_revenue_department_assignment_effective_from_idx" ON "project_revenue_department_assignment" USING btree ("project_id","effective_from");--> statement-breakpoint
CREATE INDEX "project_revenue_department_idx" ON "project" USING btree ("revenue_department");
