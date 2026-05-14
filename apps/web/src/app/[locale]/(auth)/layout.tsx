export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-primary/5 flex min-h-dvh flex-col items-center justify-center">
      {children}
    </div>
  )
}
