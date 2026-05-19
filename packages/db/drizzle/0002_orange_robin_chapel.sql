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
ALTER TABLE "project_tag_assignment" ADD CONSTRAINT "project_tag_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tag_assignment" ADD CONSTRAINT "project_tag_assignment_tag_id_project_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."project_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_tag_name_uk" ON "project_tag" USING btree ("name");--> statement-breakpoint
CREATE INDEX "project_tag_assignment_tag_id_idx" ON "project_tag_assignment" USING btree ("tag_id");