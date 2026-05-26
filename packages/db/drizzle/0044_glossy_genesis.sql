ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_staff" ADD COLUMN "auth_user_id" text;--> statement-breakpoint
ALTER TABLE "user_staff" ADD CONSTRAINT "user_staff_auth_user_id_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_staff_auth_user_id_uk" ON "user_staff" USING btree ("auth_user_id") WHERE "user_staff"."auth_user_id" is not null;