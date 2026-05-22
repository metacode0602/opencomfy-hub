ALTER TABLE "supplier_pricing_record" ADD COLUMN "effective_to" timestamp(0);--> statement-breakpoint
ALTER TABLE "supplier_pricing_record" ALTER COLUMN "effective_from" SET DATA TYPE timestamp(0) USING ("effective_from"::text || ' 00:00:00')::timestamp(0);
