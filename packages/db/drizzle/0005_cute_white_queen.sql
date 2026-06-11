CREATE TABLE "customer_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"name" varchar(128) NOT NULL,
	"phone" varchar(32),
	"email" varchar(255),
	"wechat_id" varchar(128),
	"title" varchar(64),
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" varchar(128) NOT NULL,
	"phone" varchar(32),
	"email" varchar(255),
	"wechat_id" varchar(128),
	"title" varchar(64),
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"name" varchar(128) NOT NULL,
	"phone" varchar(32),
	"email" varchar(255),
	"wechat_id" varchar(128),
	"title" varchar(64),
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_contact" ADD CONSTRAINT "customer_contact_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_contact" ADD CONSTRAINT "tenant_contact_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_contact" ADD CONSTRAINT "merchant_contact_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_contact_customer_id_idx" ON "customer_contact" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_contact_customer_sort_idx" ON "customer_contact" USING btree ("customer_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_contact_primary_uk" ON "customer_contact" USING btree ("customer_id") WHERE "customer_contact"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "tenant_contact_tenant_id_idx" ON "tenant_contact" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_contact_tenant_sort_idx" ON "tenant_contact" USING btree ("tenant_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_contact_primary_uk" ON "tenant_contact" USING btree ("tenant_id") WHERE "tenant_contact"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "merchant_contact_merchant_id_idx" ON "merchant_contact" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_contact_merchant_sort_idx" ON "merchant_contact" USING btree ("merchant_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_contact_primary_uk" ON "merchant_contact" USING btree ("merchant_id") WHERE "merchant_contact"."is_primary" = true;--> statement-breakpoint
INSERT INTO "customer_contact" (
	"id", "customer_id", "name", "phone", "email", "wechat_id", "title", "is_primary", "sort_order", "created_at", "updated_at"
)
SELECT
	gen_random_uuid()::text,
	c.id,
	COALESCE(NULLIF(trim(c.contact_person), ''), '—'),
	NULLIF(trim(c.contact_phone), ''),
	NULLIF(trim(c.contact_email), ''),
	NULL,
	NULL,
	true,
	0,
	c.created_at,
	c.updated_at
FROM "customer" c
WHERE NULLIF(trim(c.contact_person), '') IS NOT NULL
   OR NULLIF(trim(c.contact_phone), '') IS NOT NULL
   OR NULLIF(trim(c.contact_email), '') IS NOT NULL;--> statement-breakpoint
INSERT INTO "merchant_contact" (
	"id", "merchant_id", "name", "phone", "email", "wechat_id", "title", "is_primary", "sort_order", "created_at", "updated_at"
)
SELECT
	gen_random_uuid()::text,
	m.id,
	COALESCE(NULLIF(trim(m.contact_user), ''), '—'),
	NULLIF(trim(m.contact_phone), ''),
	NULL,
	NULL,
	NULL,
	true,
	0,
	m.created_at,
	m.updated_at
FROM "merchant" m
WHERE NULLIF(trim(m.contact_user), '') IS NOT NULL
   OR NULLIF(trim(m.contact_phone), '') IS NOT NULL;