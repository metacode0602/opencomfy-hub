CREATE TABLE "feishu_bitable_sync_config" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"data_center_id" text NOT NULL,
	"sync_kind" varchar(32) NOT NULL,
	"app_token" varchar(128) NOT NULL,
	"table_id" varchar(128) NOT NULL,
	"view_id" varchar(128),
	"field_mapping_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"filter_formula" text,
	"cron_expr" varchar(64) DEFAULT '15 * * * *' NOT NULL,
	"auto_commit" boolean DEFAULT false NOT NULL,
	"cursor_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "feishu_bitable_sync_config_uk" ON "feishu_bitable_sync_config" USING btree ("supplier_id","data_center_id","sync_kind");--> statement-breakpoint
CREATE INDEX "feishu_bitable_sync_config_dc_idx" ON "feishu_bitable_sync_config" USING btree ("data_center_id");--> statement-breakpoint
CREATE INDEX "feishu_bitable_sync_config_enabled_idx" ON "feishu_bitable_sync_config" USING btree ("enabled");
