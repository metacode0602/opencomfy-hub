"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { IconLoader2 } from "@tabler/icons-react"
import { AppShell } from "@/components/dashboard/app-shell"
import { LocaleLink, useLocaleRouter } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { formatMoney, formatText } from "../../_lib/display"
import { getProjectsFromSharedWarning } from "@/lib/finance/single-income-validation"
import {
  getPeriodDateRange,
  isPublishedPeriodStatus,
  isValidPeriodCode,
} from "../../_lib/period"

export default function FinanceCreateSinglePeriodPage() {
  const router = useLocaleRouter()
  const searchParams = useSearchParams()
  const editPeriodId = searchParams.get("periodId")
  const utils = trpc.useUtils()

  const [periodCode, setPeriodCode] = useState("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")
  const [periodId, setPeriodId] = useState<string | null>(null)
  const [computingIncome, setComputingIncome] = useState(false)
  const [persisting, setPersisting] = useState(false)
  const [savingSupplementary, setSavingSupplementary] = useState(false)
  const [computeError, setComputeError] = useState<string | null>(null)
  const [supplementaryDraft, setSupplementaryDraft] = useState<Record<string, string>>({})

  const createPeriod = trpc.finance.periods.create.useMutation()
  const computeSingleIncome = trpc.finance.periods.computeSingleIncome.useMutation()
  const publishPeriod = trpc.finance.periods.publish.useMutation()
  const saveSupplementary = trpc.finance.periods.saveSupplementary.useMutation()

  const { data: existingPeriod } = trpc.finance.periods.getById.useQuery(
    { id: editPeriodId! },
    { enabled: Boolean(editPeriodId) },
  )

  const { data: draftBundle } = trpc.finance.periods.getBundle.useQuery(
    { id: periodId! },
    { enabled: Boolean(periodId) },
  )

  const { data: validation, refetch: refetchValidation } =
    trpc.finance.periods.validateSingleIncome.useQuery(
      { billingPeriodId: periodId! },
      { enabled: Boolean(periodId) },
    )

  useEffect(() => {
    if (!existingPeriod || periodId) return
    setPeriodId(existingPeriod.id)
    setPeriodCode(existingPeriod.period_code)
    setPeriodStart(existingPeriod.period_start)
    setPeriodEnd(existingPeriod.period_end)
    setComputeError(null)
  }, [existingPeriod, periodId])

  useEffect(() => {
    if (!draftBundle?.income) return
    const next: Record<string, string> = {}
    for (const row of draftBundle.income) {
      next[row.id] = row.supplementary_consumption ?? "0"
    }
    setSupplementaryDraft(next)
  }, [draftBundle?.income])

  const isEditingExisting = Boolean(editPeriodId || periodId)
  const datesReady =
    Boolean(periodStart) && Boolean(periodEnd) && periodStart <= periodEnd

  const ensurePeriod = useCallback(async (): Promise<string> => {
    if (periodId) return periodId
    const created = await createPeriod.mutateAsync({
      periodCode: periodCode.trim(),
      periodStart,
      periodEnd,
    })
    setPeriodId(created.id)
    return created.id
  }, [createPeriod, periodCode, periodEnd, periodId, periodStart])

  const canClickCompute =
    isValidPeriodCode(periodCode) &&
    datesReady &&
    !computingIncome &&
    !persisting &&
    !savingSupplementary &&
    (!periodId || (validation?.canComputeSingleIncome ?? false))

  const handleComputeIncome = async () => {
    if (!isValidPeriodCode(periodCode) || !datesReady) {
      setComputeError("请先填写正确格式的账期编码（YYYY-MM）与起止日期")
      return
    }
    setComputingIncome(true)
    setComputeError(null)
    try {
      const id = await ensurePeriod()
      const check = await utils.finance.periods.validateSingleIncome.fetch({
        billingPeriodId: id,
      })
      if (!check.canComputeSingleIncome) {
        setComputeError("数据未就绪：请确认项目已绑定具备平台租户 ID 的计费账户，且已同步 CRM 月度账单")
        await refetchValidation()
        return
      }
      await computeSingleIncome.mutateAsync({ billingPeriodId: id })
      await utils.finance.periods.getBundle.invalidate({ id })
      await refetchValidation()
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : "计算收入失败")
      if (periodId) await refetchValidation()
    } finally {
      setComputingIncome(false)
    }
  }

  const handleSaveSupplementary = async () => {
    if (!periodId || !draftBundle) return
    setSavingSupplementary(true)
    try {
      await saveSupplementary.mutateAsync({
        billingPeriodId: periodId,
        items: draftBundle.income.map((row) => ({
          incomeRowId: row.id,
          supplementaryConsumption: supplementaryDraft[row.id] ?? "0",
        })),
      })
      await utils.finance.periods.getBundle.invalidate({ id: periodId })
      setComputeError(null)
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : "保存补充消费失败")
    } finally {
      setSavingSupplementary(false)
    }
  }

  const handlePublish = async () => {
    if (!periodId) return
    setPersisting(true)
    try {
      await publishPeriod.mutateAsync({ billingPeriodId: periodId })
      await utils.finance.periods.list.invalidate()
      router.push("/finance")
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : "发布失败")
    } finally {
      setPersisting(false)
    }
  }

  const periodStatus = draftBundle?.period?.status
  const canPublish =
    Boolean(periodId) &&
    (periodStatus === "computed" || periodStatus === "adjusted") &&
    !isPublishedPeriodStatus(periodStatus ?? "")

  const hasIncomePreview = (draftBundle?.income?.length ?? 0) > 0

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <LocaleLink href="/finance">← 返回账期列表</LocaleLink>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold">单账期收入（CRM 账单）</h1>
          <p className="text-muted-foreground">
            按经营项目计费（须绑定平台租户 ID），从 CRM 月度账单汇总余额与裸金属消费；可录入补充消费后自动合计总消费
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isEditingExisting ? "账期信息" : "创建账期"}</CardTitle>
            <CardDescription>
              账期编码须与 CRM 账单 bill_month（YYYY-MM）一致；总消费 = 补充消费 + 余额消费 + 裸金属消费
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {computeError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {computeError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="period_code">账期编码</Label>
                <Input
                  id="period_code"
                  placeholder="YYYY-MM，例如 2026-05"
                  value={periodCode}
                  readOnly={isEditingExisting}
                  disabled={isEditingExisting}
                  onChange={(e) => {
                    const v = e.target.value
                    setPeriodCode(v)
                    const range = getPeriodDateRange(v)
                    if (range) {
                      setPeriodStart(range.start)
                      setPeriodEnd(range.end)
                    }
                  }}
                />
                {periodCode.trim() && !isValidPeriodCode(periodCode) && (
                  <p className="text-sm text-destructive">账期编码格式应为 YYYY-MM</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="period_start">账期开始</Label>
                <Input
                  id="period_start"
                  type="date"
                  value={periodStart}
                  readOnly={isEditingExisting}
                  disabled={isEditingExisting}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period_end">账期结束</Label>
                <Input
                  id="period_end"
                  type="date"
                  value={periodEnd}
                  readOnly={isEditingExisting}
                  disabled={isEditingExisting}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            {periodStart && periodEnd && periodStart > periodEnd && (
              <p className="text-sm text-destructive">结束日期不能早于开始日期</p>
            )}

            {periodId && validation && (
              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">数据就绪检查</CardTitle>
                  <CardDescription>
                    账期 {validation.billMonth} · 库内账单 {validation.billsInDb} 条
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <ul className="list-inside list-disc space-y-1">
                    <li>具备平台租户 ID 的项目：{validation.projectsEligible}</li>
                    <li>将参与计算的项目：{validation.projectsIncluded}</li>
                    <li>有项目但缺账单（警告）：{validation.projectsMissingBill.length}</li>
                  </ul>

                  {validation.projectsMissingBill.length > 0 && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-100">
                      <p className="font-medium">缺 CRM 月度账单（不阻断计算）</p>
                      <ul className="mt-1 list-inside list-disc">
                        {validation.projectsMissingBill.slice(0, 8).map((p) => (
                          <li key={p.projectId}>
                            {p.projectName}（项目ID: {p.projectId}）· 平台租户{" "}
                            {p.platformTenantId} · 租户ID {p.tenantId}
                          </li>
                        ))}
                        {validation.projectsMissingBill.length > 8 && (
                          <li>…共 {validation.projectsMissingBill.length} 个</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {validation.sharedPlatformTenantWarnings.length > 0 && (
                    <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2">
                      <p className="font-medium">同一平台租户对应多个项目</p>
                      <ul className="mt-1 list-inside list-disc text-muted-foreground">
                        {(validation.sharedPlatformTenantWarnings ?? []).map((w) => (
                          <li key={w.platformTenantId}>
                            平台租户 {w.platformTenantId}
                            {w.tenantId ? `（租户ID: ${w.tenantId}` : ""}
                            {w.tenantName ? `${w.tenantId ? "，" : "（"}${w.tenantName}` : ""}
                            {w.tenantId || w.tenantName ? "）" : ""}：
                            {getProjectsFromSharedWarning(w)
                              .map((p) => `${p.projectName}（${p.projectId}）`)
                              .join("、")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!validation.canComputeSingleIncome && (
                    <p className="text-destructive">
                      当前不可计算：须至少 1 个「有平台租户 ID 且已同步账单」的项目，且账期未发布/作废
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!canClickCompute}
              onClick={() => void handleComputeIncome()}
            >
              {computingIncome ? (
                <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  计算中…
                </>
              ) : (
                "计算收入"
              )}
            </Button>
            {periodId && (
              <Button
                type="button"
                variant="outline"
                disabled={computingIncome}
                onClick={() => void refetchValidation()}
              >
                刷新检查
              </Button>
            )}
            {canPublish && (
              <Button
                type="button"
                variant="default"
                disabled={persisting || computingIncome}
                onClick={() => void handlePublish()}
              >
                {persisting ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    发布中…
                  </>
                ) : (
                  "发布账期"
                )}
              </Button>
            )}
          </CardFooter>
        </Card>

        {hasIncomePreview && draftBundle && (
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>收入明细</CardTitle>
                <CardDescription>
                  CRM 账单计算 · 共 {draftBundle.income.length} 条
                  {draftBundle.period?.status
                    ? ` · 状态 ${draftBundle.period.status}`
                    : ""}
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={savingSupplementary || computingIncome || persisting}
                onClick={() => void handleSaveSupplementary()}
              >
                {savingSupplementary ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    保存中…
                  </>
                ) : (
                  "保存补充消费"
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left whitespace-nowrap">项目名称</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">客户全称</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">租户Id</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">补充消费</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">余额消费</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">线上裸金属</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">总消费</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftBundle.income.map((row) => {
                      const sup = supplementaryDraft[row.id] ?? "0"
                      const total =
                        (Number(sup) || 0) +
                        (Number(row.balance_consumption ?? 0) || 0) +
                        (Number(row.bare_metal_consumption ?? 0) || 0)
                      return (
                        <tr key={row.id} className="border-b">
                          <td className="px-3 py-2">{formatText(row.project_name)}</td>
                          <td className="max-w-[240px] px-3 py-2">
                            <div>{formatText(row.customer_full_name)}</div>
                            <div className="text-muted-foreground mt-0.5 font-mono text-xs">
                              租户 {row.tenant_platform_id}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              className="ml-auto max-w-[140px] text-right tabular-nums"
                              value={sup}
                              onChange={(e) =>
                                setSupplementaryDraft((d) => ({
                                  ...d,
                                  [row.id]: e.target.value,
                                }))
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatMoney(row.balance_consumption ?? "0")}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatMoney(row.bare_metal_consumption ?? "0")}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {formatMoney(String(total))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
