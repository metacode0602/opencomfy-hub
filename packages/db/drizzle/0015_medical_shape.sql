ALTER TABLE "user_staff" ADD COLUMN "position" varchar(128);--> statement-breakpoint
ALTER TABLE "user_staff" ADD COLUMN "roles" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_staff" ADD COLUMN "is_default_pre_sales" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_staff" ADD COLUMN "is_default_account_manager" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_staff" ADD COLUMN "is_default_delivery_manager" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_staff" ADD COLUMN "is_default_project_manager" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_default_pre_sales_uk" ON "user_staff" USING btree ("is_default_pre_sales") WHERE "user_staff"."is_default_pre_sales" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_default_account_manager_uk" ON "user_staff" USING btree ("is_default_account_manager") WHERE "user_staff"."is_default_account_manager" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_default_delivery_manager_uk" ON "user_staff" USING btree ("is_default_delivery_manager") WHERE "user_staff"."is_default_delivery_manager" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_default_project_manager_uk" ON "user_staff" USING btree ("is_default_project_manager") WHERE "user_staff"."is_default_project_manager" = true;