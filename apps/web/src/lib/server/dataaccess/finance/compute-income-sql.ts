import { db } from '@/lib/db'
import { platformIncomeMonthly } from '@workspace/db/schema'
import { eq, sql } from 'drizzle-orm'
import { financeLog } from './logger'

export type TenantClassification = {
  standardPlatformIds: string[]
  multiPlatformIds: string[]
}

/** Step I0 — 按 project_tenant 关联数分类租户（income-sql-compute-design §2.1） */
export async function classifyTenantsSql(periodId: string): Promise<TenantClassification> {
  const rows = await db.execute<{
    platform_tenant_id: string
    project_count: number
  }>(sql`
    SELECT
      t.platform_tenant_id,
      COUNT(pt.project_id)::int AS project_count
    FROM tenant t
    JOIN (
      SELECT DISTINCT r.tenant_platform_id
      FROM billing_period_raw_customer_consumption r
      JOIN billing_period_import_batch b ON b.id = r.batch_id
      WHERE b.billing_period_id = ${periodId}
    ) raw_t ON raw_t.tenant_platform_id = t.platform_tenant_id
    LEFT JOIN project_tenant pt ON pt.tenant_id = t.id
    GROUP BY t.platform_tenant_id
  `)

  const standardPlatformIds: string[] = []
  const multiPlatformIds: string[] = []
  for (const row of rows.rows) {
    if (row.project_count > 1) {
      multiPlatformIds.push(row.platform_tenant_id)
    } else {
      standardPlatformIds.push(row.platform_tenant_id)
    }
  }

  financeLog('compute-income-sql', 'I0 classified', {
    periodId,
    standard: standardPlatformIds.length,
    multi: multiPlatformIds.length,
  })

  return { standardPlatformIds, multiPlatformIds }
}

function platformIdArray(platformIds: string[]) {
  if (platformIds.length === 0) {
    return sql`ARRAY[]::varchar[]`
  }
  return sql`ARRAY[${sql.join(
    platformIds.map((id) => sql`${id}`),
    sql`, `,
  )}]::varchar[]`
}

/** Step I1 — 按租户汇总客户消费 Raw 写入 agg（§4.1） */
export async function stepI1InsertAggFromRaw(periodId: string): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO billing_period_agg_customer_consumption (
      id, billing_period_id, tenant_platform_id, customer_type,
      total_consumption, voucher_consumption, balance_consumption,
      source_raw_ids, row_count_by_type,
      created_at
    )
    SELECT
      gen_random_uuid()::text,
      ${periodId},
      r.tenant_platform_id,
      MIN(r.customer_type),
      SUM(r.total_consumption::numeric),
      SUM(r.voucher_consumption::numeric),
      SUM(r.balance_consumption::numeric),
      jsonb_agg(r.id),
      COUNT(*)::int,
      NOW()
    FROM billing_period_raw_customer_consumption r
    JOIN billing_period_import_batch b ON b.id = r.batch_id
    WHERE b.billing_period_id = ${periodId}
      AND b.file_type = 'customer_consumption'
    GROUP BY r.tenant_platform_id
  `)
  financeLog('compute-income-sql', 'I1 agg inserted', {
    periodId,
    rowCount: result.rowCount,
  })
  return result.rowCount ?? 0
}

/** Step I2 — 补全标准租户 CRM 字段（§4.2） */
export async function stepI2EnrichStandardAgg(
  periodId: string,
  standardPlatformIds: string[],
): Promise<void> {
  if (standardPlatformIds.length === 0) return

  await db.execute(sql`
    UPDATE billing_period_agg_customer_consumption a
    SET
      tenant_id          = t.id,
      customer_id        = c.id,
      customer_full_name = c.name,
      project_id         = p.id,
      project_name       = p.name,
      allocation_percent = 100
    FROM tenant t
    JOIN customer c ON c.id = t.customer_id
    LEFT JOIN project_tenant pt ON pt.tenant_id = t.id
    LEFT JOIN project p ON p.id = pt.project_id
    WHERE a.billing_period_id = ${periodId}
      AND a.tenant_platform_id = t.platform_tenant_id
      AND a.tenant_platform_id = ANY(${platformIdArray(standardPlatformIds)})
  `)

  financeLog('compute-income-sql', 'I2 standard agg enriched', {
    periodId,
    count: standardPlatformIds.length,
  })
}

/** Step I3 — 删除本账期 income 并 INSERT 标准租户收入行（§4.3） */
export async function stepI3InsertStandardIncome(
  periodId: string,
  standardPlatformIds: string[],
): Promise<number> {
  await db
    .delete(platformIncomeMonthly)
    .where(eq(platformIncomeMonthly.billingPeriodId, periodId))

  if (standardPlatformIds.length === 0) return 0

  const result = await db.execute(sql`
    INSERT INTO platform_income_monthly (
      id, billing_period_id, customer_type,
      tenant_id, tenant_platform_id, tenant_name,
      customer_id, customer_full_name,
      project_id, project_name,
      supplementary_consumption,
      balance_consumption,
      bare_metal_consumption, total_consumption,
      created_at
    )
    SELECT
      gen_random_uuid()::text,
      a.billing_period_id,
      a.customer_type,
      a.tenant_id,
      a.tenant_platform_id,
      t.name,
      a.customer_id,
      a.customer_full_name,
      a.project_id,
      a.project_name,
      0,
      a.balance_consumption,
      0,
      a.balance_consumption,
      NOW()
    FROM billing_period_agg_customer_consumption a
    JOIN tenant t ON t.id = a.tenant_id
    WHERE a.billing_period_id = ${periodId}
      AND a.tenant_platform_id = ANY(${platformIdArray(standardPlatformIds)})
  `)

  financeLog('compute-income-sql', 'I3 standard income inserted', {
    periodId,
    rowCount: result.rowCount,
  })
  return result.rowCount ?? 0
}

/** Step I4 — 标准租户裸金属整笔 UPDATE（§4.4） */
export async function stepI4ApplyStandardBaremetal(
  periodId: string,
  standardPlatformIds: string[],
): Promise<void> {
  if (standardPlatformIds.length === 0) return

  await db.execute(sql`
    UPDATE platform_income_monthly i
    SET
      bare_metal_consumption = b.m_bare,
      total_consumption = COALESCE(i.supplementary_consumption, 0)
                        + COALESCE(i.balance_consumption, 0)
                        + b.m_bare
    FROM (
      SELECT bo.tenant_platform_id, SUM(bo.final_amount::numeric) AS m_bare
      FROM billing_period_raw_baremetal_order bo
      JOIN billing_period_import_batch batch ON batch.id = bo.batch_id
      WHERE batch.billing_period_id = ${periodId}
      GROUP BY bo.tenant_platform_id
    ) b
    WHERE i.billing_period_id = ${periodId}
      AND i.tenant_platform_id = b.tenant_platform_id
      AND i.tenant_platform_id = ANY(${platformIdArray(standardPlatformIds)})
  `)

  financeLog('compute-income-sql', 'I4 standard baremetal applied', { periodId })
}

/** Step I5 — 账期收入汇总字段（§4.5） */
export async function stepI5UpdatePeriodIncomeTotals(input: {
  periodId: string
  markComputed?: boolean
}): Promise<void> {
  const { periodId, markComputed = false } = input

  if (markComputed) {
    await db.execute(sql`
      UPDATE billing_period bp
      SET
        total_income     = sub.total,
        balance_income   = sub.balance,
        baremetal_income = sub.bare,
        supplementary    = sub.supplementary,
        last_computed_at = NOW(),
        status           = 'computed'
      FROM (
        SELECT
          COALESCE(SUM(total_consumption::numeric), 0)      AS total,
          COALESCE(SUM(balance_consumption::numeric), 0)    AS balance,
          COALESCE(SUM(bare_metal_consumption::numeric), 0) AS bare,
          COALESCE(SUM(supplementary_consumption::numeric), 0) AS supplementary
        FROM platform_income_monthly
        WHERE billing_period_id = ${periodId}
      ) sub
      WHERE bp.id = ${periodId}
    `)
  } else {
    await db.execute(sql`
      UPDATE billing_period bp
      SET
        total_income     = sub.total,
        balance_income   = sub.balance,
        baremetal_income = sub.bare,
        supplementary    = sub.supplementary
      FROM (
        SELECT
          COALESCE(SUM(total_consumption::numeric), 0)      AS total,
          COALESCE(SUM(balance_consumption::numeric), 0)    AS balance,
          COALESCE(SUM(bare_metal_consumption::numeric), 0) AS bare,
          COALESCE(SUM(supplementary_consumption::numeric), 0) AS supplementary
        FROM platform_income_monthly
        WHERE billing_period_id = ${periodId}
      ) sub
      WHERE bp.id = ${periodId}
    `)
  }

  financeLog('compute-income-sql', 'I5 period income totals updated', {
    periodId,
    markComputed,
  })
}

/** 标准路径 I1～I4 编排 */
export async function runStandardIncomeSqlPath(
  periodId: string,
  standardPlatformIds: string[],
): Promise<number> {
  await stepI1InsertAggFromRaw(periodId)
  await stepI2EnrichStandardAgg(periodId, standardPlatformIds)
  const incomeCount = await stepI3InsertStandardIncome(periodId, standardPlatformIds)
  await stepI4ApplyStandardBaremetal(periodId, standardPlatformIds)
  return incomeCount
}
