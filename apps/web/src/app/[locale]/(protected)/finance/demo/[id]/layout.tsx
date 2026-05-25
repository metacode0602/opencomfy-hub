import { DemoPeriodProvider } from "../_demo/demo-period-store"

export default function FinanceDemoPeriodLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DemoPeriodProvider>{children}</DemoPeriodProvider>
}
