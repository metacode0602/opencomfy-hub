"use client"

import { motion } from "framer-motion"
import { Check, Sparkles } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"

const plans = [
  {
    name: "免费版",
    price: "0",
    description: "适合初次体验 AI 创作的用户",
    features: [
      "每日 10 次免费生成",
      "基础图像模型",
      "720P 视频输出",
      "社区工作流",
    ],
    cta: "免费开始",
    popular: false,
  },
  {
    name: "专业版",
    price: "99",
    description: "适合内容创作者和设计师",
    features: [
      "每月 500 次生成",
      "全部图像模型",
      "1080P 视频输出",
      "优先队列",
      "自定义工作流",
      "商用授权",
    ],
    cta: "升级专业版",
    popular: true,
  },
  {
    name: "企业版",
    price: "联系我们",
    description: "适合团队和企业用户",
    features: [
      "无限次生成",
      "全部顶级模型",
      "4K 视频输出",
      "专属 GPU 资源",
      "API 接入",
      "定制化服务",
      "专属客户成功经理",
    ],
    cta: "联系销售",
    popular: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm text-primary font-medium">定价方案</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-balance">
            选择适合你的方案
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            从免费开始，随时升级。所有方案均提供核心 AI 创作功能。
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-6 rounded-2xl border ${
                plan.popular
                  ? "border-primary bg-primary/5 glow-primary"
                  : "border-border bg-card"
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs">
                    <Sparkles className="h-3 w-3" />
                    最受欢迎
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  {plan.price !== "联系我们" ? (
                    <>
                      <span className="text-sm text-muted-foreground">¥</span>
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">/月</span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold">{plan.price}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link href="/create" className="block">
                <Button
                  className={`w-full ${plan.popular ? "glow-primary" : ""}`}
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
