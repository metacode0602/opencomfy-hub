ALTER TABLE "feishu_work_order_bitable_config" ALTER COLUMN "status_mapping_json" SET DEFAULT '{"待审核":"pending_review","待分配":"pending_assign","处理中":"in_progress","已结束":"completed","已终止":"cancelled"}'::jsonb;--> statement-breakpoint
ALTER TABLE "data_center" ADD COLUMN "cooperation_status" varchar(32) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "feishu_work_order_bitable_config" ADD COLUMN "inbound_channel" varchar(32) DEFAULT 'bitable_automation' NOT NULL;--> statement-breakpoint
ALTER TABLE "feishu_work_order_bitable_config" ADD COLUMN "automation_webhook_secret" varchar(128);--> statement-breakpoint
ALTER TABLE "feishu_work_order_bitable_config" ADD COLUMN "automation_token" varchar(255);--> statement-breakpoint
ALTER TABLE "feishu_work_order_bitable_config" ADD COLUMN "inbound_policy_json" jsonb DEFAULT '{"timeline_on_every_sync":true,"timeline_on_terminal_only":false,"auto_sync_in_progress_status":true,"dedupe_window_seconds":60}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "data_center_cooperation_status_idx" ON "data_center" USING btree ("cooperation_status");