CREATE TABLE "supplier_ops_engineer" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"name" varchar(128) NOT NULL,
	"phone" varchar(32),
	"email" varchar(255),
	"wechat_id" varchar(128),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_ops_engineer" ADD CONSTRAINT "supplier_ops_engineer_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ops_engineer" ADD CONSTRAINT "supplier_ops_engineer_data_center_id_data_center_id_fk" FOREIGN KEY ("data_center_id") REFERENCES "public"."data_center"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_ops_engineer_supplier_id_idx" ON "supplier_ops_engineer" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_ops_engineer_data_center_id_idx" ON "supplier_ops_engineer" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "supplier_ops_engineer_data_center_sort_idx" ON "supplier_ops_engineer" USING btree ("data_center_id","sort_order");