import type { SiteMessageLink } from "./types"

/** @deprecated 运行时数据来自 tRPC / DB，仅供文档参考 */
export type SiteMessage = {
  id: string
  title: string
  summary: string
  content: string
  createdAt: string
  read: boolean
  category?: string
  links?: SiteMessageLink[]
}

export const mockSiteMessages: SiteMessage[] = [
  {
    id: "msg-001",
    title: "账单待确认提醒",
    summary: "项目「星云算力-A」2026 年 5 月账单已生成，请在 3 个工作日内完成确认。",
    content: `您好，

项目 **星云算力-A** 的 2026 年 5 月账单已生成，总消费 **¥128,450.00**。

请在收到本消息后 **3 个工作日内** 完成确认。如有疑问，请联系财务对接人或在系统中查看明细。`,
    createdAt: "2026-06-15T09:30:00.000Z",
    read: false,
    category: "财务",
    links: [{ label: "查看账单明细", href: "/dashboard/projects" }],
  },
  {
    id: "msg-002",
    title: "供应商设备导入完成",
    summary: "供应商「华东云」机房设备变更导入已成功，共 42 条记录。",
    content: `供应商 **华东云** 的设备变更导入任务已完成。

- 成功：40 条
- 警告：2 条（未知变更动作，已保留原文）
- 失败：0 条

您可以在 [供应商设备页](/supplier/devices) 查看详情，或点击底部按钮直接进入。`,
    createdAt: "2026-06-14T16:20:00.000Z",
    read: false,
    category: "供应链",
    links: [{ label: "前往设备列表", href: "/supplier/devices" }],
  },
  {
    id: "msg-003",
    title: "系统维护通知",
    summary: "本周六 02:00–04:00 将进行例行维护，期间部分功能可能不可用。",
    content: `为提升系统稳定性，我们计划于 **2026 年 6 月 21 日（周六）02:00–04:00** 进行例行维护。

维护期间以下功能可能暂时不可用：
- 账单同步
- 设备导入提交

如有紧急问题，请通过 [工单系统](https://example.com/support) 联系我们。`,
    createdAt: "2026-06-13T10:00:00.000Z",
    read: true,
    category: "系统",
    links: [{ label: "打开工单系统", href: "https://example.com/support", external: true }],
  },
]
