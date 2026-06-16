"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Settings, User, Key, Bell, Palette, Globe, RefreshCw, Eraser, Table2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { authClient } from "@/lib/auth-client"
import { BillingSyncSettingsContent } from "@/components/settings/billing-sync-settings-content"
import { FeishuBitableSyncSettingsContent } from "@/components/settings/feishu-bitable-sync-settings-content"
import { SupplierDataCleanupSettingsContent } from "@/components/settings/supplier-data-cleanup-settings-content"

const settingsSections = [
  { id: "account", label: "账户设置", icon: User },
  { id: "api", label: "API 密钥", icon: Key },
  { id: "notifications", label: "通知设置", icon: Bell },
  { id: "appearance", label: "外观设置", icon: Palette },
  { id: "language", label: "语言设置", icon: Globe },
  { id: "billing-sync", label: "账单同步", icon: RefreshCw },
  { id: "feishu-bitable-sync", label: "飞书多维表格", icon: Table2, adminOnly: true },
  { id: "supplier-data-cleanup", label: "供应商数据清理", icon: Eraser, adminOnly: true },
] as const

type SettingsSectionId = (typeof settingsSections)[number]["id"]

function isSettingsSection(id: string | null): id is SettingsSectionId {
  return settingsSections.some((section) => section.id === id)
}

export function SettingsPageClient() {
  const searchParams = useSearchParams()
  const { data: session } = authClient.useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role
  const canAccessAdminSettings = userRole !== 'user'
  const visibleSections = settingsSections.filter(
    (s) => !('adminOnly' in s && s.adminOnly) || canAccessAdminSettings,
  )
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("account")
  const [apiKey, setApiKey] = useState("")
  const [notifications, setNotifications] = useState({
    email: true,
    browser: false,
    marketing: false,
  })

  useEffect(() => {
    const section = searchParams.get("section")
    if (isSettingsSection(section)) {
      setActiveSection(section)
    }
  }, [searchParams])

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center">
            <Settings className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">设置</h1>
            <p className="text-sm text-muted-foreground">管理你的账户和偏好设置</p>
          </div>
        </div>

        <div className="flex gap-8">
          <nav className="w-48 flex-shrink-0 space-y-1">
            {visibleSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  activeSection === section.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 space-y-6">
            {activeSection === "account" && (
              <div className="space-y-6">
                <div className="p-6 rounded-xl border border-border bg-card">
                  <h2 className="font-semibold mb-4">个人信息</h2>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">U</span>
                      </div>
                      <Button variant="outline" size="sm">更换头像</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">用户名</label>
                        <Input defaultValue="user123" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">邮箱</label>
                        <Input defaultValue="user@example.com" type="email" />
                      </div>
                    </div>
                    <Button>保存更改</Button>
                  </div>
                </div>

                <div className="p-6 rounded-xl border border-border bg-card">
                  <h2 className="font-semibold mb-4">订阅计划</h2>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary">
                    <div>
                      <p className="font-medium">免费版</p>
                      <p className="text-sm text-muted-foreground">每日 10 次免费生成</p>
                    </div>
                    <Button>升级计划</Button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "api" && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold">API 密钥</h2>
                <p className="text-sm text-muted-foreground">
                  使用 API 密钥可以在你的应用中集成 共绩CRM 的功能
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">你的 API 密钥</label>
                  <div className="flex gap-2">
                    <Input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-xxxxxxxxxxxxxxxx"
                      type="password"
                    />
                    <Button variant="outline">复制</Button>
                  </div>
                </div>
                <Button>生成新密钥</Button>
              </div>
            )}

            {activeSection === "notifications" && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold">通知设置</h2>
                <div className="space-y-4">
                  {[
                    { key: "email", label: "邮件通知", description: "生成完成后发送邮件通知" },
                    { key: "browser", label: "浏览器通知", description: "在浏览器中显示通知" },
                    { key: "marketing", label: "营销邮件", description: "接收产品更新和优惠信息" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <button
                        onClick={() => setNotifications(prev => ({
                          ...prev,
                          [item.key]: !prev[item.key as keyof typeof prev]
                        }))}
                        className={cn(
                          "w-12 h-6 rounded-full transition-colors relative",
                          notifications[item.key as keyof typeof notifications]
                            ? "bg-primary"
                            : "bg-secondary"
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                            notifications[item.key as keyof typeof notifications]
                              ? "translate-x-7"
                              : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === "appearance" && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold">外观设置</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">主题</label>
                    <div className="flex gap-2">
                      {["暗色", "亮色", "跟随系统"].map((theme) => (
                        <Button
                          key={theme}
                          variant={theme === "暗色" ? "default" : "outline"}
                          size="sm"
                        >
                          {theme}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "language" && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold">语言设置</h2>
                <div className="space-y-2">
                  <label className="text-sm font-medium">界面语言</label>
                  <div className="flex gap-2">
                    {["简体中文", "English", "日本語"].map((lang) => (
                      <Button
                        key={lang}
                        variant={lang === "简体中文" ? "default" : "outline"}
                        size="sm"
                      >
                        {lang}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === "billing-sync" && (
              <div className="p-6 rounded-xl border border-border bg-card">
                <BillingSyncSettingsContent />
              </div>
            )}

            {activeSection === "feishu-bitable-sync" && (
              <div className="p-6 rounded-xl border border-border bg-card">
                {canAccessAdminSettings ? (
                  <FeishuBitableSyncSettingsContent />
                ) : (
                  <p className="text-sm text-muted-foreground">仅管理员可配置飞书多维表格同步。</p>
                )}
              </div>
            )}

            {activeSection === "supplier-data-cleanup" && (
              <div className="p-6 rounded-xl border border-border bg-card">
                {canAccessAdminSettings ? (
                  <SupplierDataCleanupSettingsContent />
                ) : (
                  <p className="text-sm text-muted-foreground">仅管理员可访问供应商数据清理。</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
