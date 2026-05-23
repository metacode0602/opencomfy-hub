
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-4">
      {children}
      {/* 仅占位，不会渲染任何内容，避免children组件与底部边距重叠 */}
      <div aria-hidden className="h-4 shrink-0" />
    </div>
  )
}
