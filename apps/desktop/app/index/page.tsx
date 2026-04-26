"use client"

import Link from "next/link"
import { useMemo } from "react"

import { MVP_TEMPLATES } from "@/lib/mvp/templates"
import { useMvpStore } from "@/lib/mvp/store"
import { ApiBaseHint } from "@/components/api-base-hint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

function OutputTypeBadge({ outputType }: { outputType: "image" | "video" }) {
	return (
		<Badge variant={outputType === "video" ? "secondary" : "default"}>
			{outputType === "video" ? "视频" : "图片"}
		</Badge>
	)
}

const GENERATE_GROUPS = [
	{
		id: "webui",
		title: "WebUI",
		href: "/generate/webui",
		description: "文生图 / 图生图：填写 checkPointId、prompt 等必填项后提交，并自动查询状态与结果。",
	},
	{
		id: "kontext",
		title: "Kontext（F.1）",
		href: "/generate/kontext",
		description: "文生图 / 图生图：prompt 必填；图生图需每行一条参考图 URL。",
	},
	{
		id: "comfy",
		title: "Comfy",
		href: "/generate/comfy",
		description: "工作流：粘贴 generateParams JSON 对象（须含 workflow 与节点配置）。",
	},
] as const

export default function IndexPage() {
	const deliveriesCount = useMvpStore((s) => Object.keys(s.deliveries).length)
	const recentDeliveryId = useMvpStore((s) => {
		const all = Object.values(s.deliveries)
		all.sort((a, b) => b.createdAt - a.createdAt)
		return all[0]?.id
	})

	const templates = useMemo(() => MVP_TEMPLATES.slice(0, 8), [])

	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-6">
			<div className="mb-6 flex flex-col gap-2">
				<div className="flex items-center justify-between gap-3">
					<h1 className="text-xl font-semibold">OpenComfy Studio（MVP Mock）</h1>
					<div className="flex items-center gap-2">
						<Badge variant="outline">无 SSR / 客户端页面</Badge>
						<Badge variant="outline">交付数：{deliveriesCount}</Badge>
					</div>
				</div>
				<p className="text-sm text-muted-foreground">
					「真实链路」三组入口进入详情页，按 dashboard 代理 API 要求填写参数后再提交与轮询；「本地 MVP」模板仍为纯前端模拟。
				</p>
				{recentDeliveryId ? (
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-sm text-muted-foreground">最近一次交付：</span>
						<Link
							href={`/deliveries?deliveryId=${encodeURIComponent(recentDeliveryId)}`}
							className="text-sm font-medium underline underline-offset-4"
						>
							查看下载页
						</Link>
					</div>
				) : null}
			</div>

			<div className="mb-6">
				<ApiBaseHint />
			</div>

			<div className="mb-12">
				<h2 className="mb-4 text-lg font-semibold">真实链路 · 生成详情</h2>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					{GENERATE_GROUPS.map((g) => (
						<Card key={g.id} className="flex flex-col gap-3 p-4">
							<div className="flex items-center gap-2">
								<h3 className="font-medium">{g.title}</h3>
								<Badge variant="secondary" className="text-xs">
									详情页
								</Badge>
							</div>
							<p className="text-sm text-muted-foreground">{g.description}</p>
							<Button asChild className="mt-auto w-full sm:w-auto">
								<Link href={g.href}>进入 {g.title}</Link>
							</Button>
						</Card>
					))}
				</div>
			</div>

			<h2 className="mb-4 text-lg font-semibold">本地 MVP · 模板</h2>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{templates.map((t) => (
					<Card key={t.id} className="p-4">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<div className="text-lg">{t.previewEmoji}</div>
									<h3 className="truncate font-medium">{t.name}</h3>
									<OutputTypeBadge outputType={t.outputType} />
								</div>
								<p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
							</div>
							<Button asChild>
								<Link href={`/templates?templateId=${encodeURIComponent(t.id)}`}>打开</Link>
							</Button>
						</div>

						<div className="mt-3 flex flex-wrap gap-2">
							{t.fields.slice(0, 3).map((f) => (
								<Badge key={f.key} variant="secondary">
									{f.label}
								</Badge>
							))}
							{t.fields.length > 3 ? (
								<Badge variant="secondary">+{t.fields.length - 3}</Badge>
							) : null}
						</div>
					</Card>
				))}
			</div>

			<div className="mt-8 rounded-xl border bg-card p-4">
				<div className="mb-2 flex items-center justify-between">
					<h3 className="font-medium">说明</h3>
					<Badge variant="outline">Mock 数据</Badge>
				</div>
				<ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
					<li>详情页内「提交」在必填项未填齐时不可用；提交成功后会轮询状态直至成功/失败/超时。</li>
					<li>「本地 MVP」生成结果与二维码为前端模拟，状态在 localStorage。</li>
				</ul>
			</div>
		</div>
	)
}
