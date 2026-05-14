import { mockBillingPeriods } from "@/lib/data/finance-mock"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { LocaleLink } from "@/lib/i18n/navigation"
import { formatMoney } from "./_lib/display"
import { IconPlus } from "@tabler/icons-react"

export default function FinanceBillingPeriodsPage() {
  const rows = mockBillingPeriods

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle>账期列表</CardTitle>
          <CardDescription>
            平台全部账期（billing_period），可按账期查看收入明细与成本毛利明细
          </CardDescription>
          <Button asChild className="shrink-0 gap-2">
            <LocaleLink href="/finance/create">
              <IconPlus className="size-4" />
              添加账期
            </LocaleLink>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">账期编码</TableHead>
                  <TableHead className="whitespace-nowrap">账期开始</TableHead>
                  <TableHead className="whitespace-nowrap">账期结束</TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    账期总收入
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    账期总成本
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    补充收入
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    余额收入
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    裸金属收入
                  </TableHead>
                  <TableHead className="w-[200px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.period_code}</TableCell>
                    <TableCell className="tabular-nums">{p.period_start}</TableCell>
                    <TableCell className="tabular-nums">{p.period_end}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.total_income)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.total_cost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.supplementary)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.balance_income)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.baremetal_income)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`/finance/${p.id}/income`}>
                            收入
                          </LocaleLink>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`/finance/${p.id}/cost`}>
                            成本
                          </LocaleLink>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
