import { Geist, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ExternalLinkGuard } from "@/components/external-link-guard"
import { DebugPanelGate } from "../components/debug-panel-gate"
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider><TooltipProvider><main data-ui-scroll-container><ExternalLinkGuard /><DebugPanelGate />{children}</main></TooltipProvider></ThemeProvider>
      </body>
    </html>
  )
}
