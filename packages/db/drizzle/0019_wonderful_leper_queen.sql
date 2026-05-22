ALTER TABLE "platform_card_list_price" ALTER COLUMN "effective_from" SET DATA TYPE timestamp(0) USING ("effective_from"::text || ' 00:00:00')::timestamp(0);--> statement-breakpoint
ALTER TABLE "platform_card_list_price" ALTER COLUMN "effective_to" SET DATA TYPE timestamp(0) USING (
  CASE
    WHEN "effective_to" IS NULL THEN NULL
    ELSE ("effective_to"::text || ' 23:59:59')::timestamp(0)
  END
);--> statement-breakpoint
ALTER TABLE "platform_card_price_record" ALTER COLUMN "effective_from" SET DATA TYPE timestamp(0) USING ("effective_from"::text || ' 00:00:00')::timestamp(0);
