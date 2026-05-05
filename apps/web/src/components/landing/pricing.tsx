"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Check, Sparkles, Copy, CheckCircle, CreditCard, Smartphone, QrCode } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import Image from "next/image"
import { websiteConfig } from "@/lib/config/website"

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
    action: "free",
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
    action: "upgrade",
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
    action: "contact",
    popular: false,
  },
]

const SALES_WECHAT_ID = websiteConfig.metadata.social.wechatId;

export function Pricing() {
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"wechat" | "alipay" | null>(null)
  const [paymentStep, setPaymentStep] = useState<"select" | "pay" | "success">("select")

  const handleCopyWechat = async () => {
    try {
      await navigator.clipboard.writeText(SALES_WECHAT_ID)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handlePlanClick = (action: string) => {
    if (action === "contact") {
      setContactDialogOpen(true)
    } else if (action === "upgrade") {
      setPaymentDialogOpen(true)
      setPaymentStep("select")
      setPaymentMethod(null)
    }
  }

  const handleSelectPayment = (method: "wechat" | "alipay") => {
    setPaymentMethod(method)
    setPaymentStep("pay")
  }

  const handlePaymentComplete = () => {
    setPaymentStep("success")
  }

  const handleClosePayment = () => {
    setPaymentDialogOpen(false)
    setPaymentStep("select")
    setPaymentMethod(null)
  }

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
              {plan.action === "free" ? (
                <Link href="/dashboard/text-to-image" className="block">
                  <Button className="w-full" variant="outline">
                    {plan.cta}
                  </Button>
                </Link>
              ) : (
                <Button
                  className={`w-full ${plan.popular ? "glow-primary" : ""}`}
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handlePlanClick(plan.action)}
                >
                  {plan.cta}
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Contact Sales Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">联系销售</DialogTitle>
            <DialogDescription className="text-center">
              扫描下方二维码添加销售微信，获取企业版定制方案
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-6 py-4">
            {/* QR Code Placeholder */}
            <div className="w-48 h-48 rounded-xl bg-muted/30 flex items-center justify-center">
              <div className="text-center">
                {/* <QrCode className="h-24 w-24 text-muted-foreground/50 mx-auto mb-2" /> */}
                <Image src="/images/wechat.png" alt="WeChat QR Code" width={200} height={200} className="mx-auto mb-2 rounded-xl" />
                <p className="text-xs text-muted-foreground">微信二维码</p>
              </div>
            </div>

            {/* WeChat ID */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50 border">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">微信号</p>
                <p className="font-medium font-mono">{SALES_WECHAT_ID}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleCopyWechat}
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    复制
                  </>
                )}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              工作时间：周一至周五 9:00-18:00
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={handleClosePayment}>
        <DialogContent className="sm:max-w-md">
          {paymentStep === "select" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center">升级专业版</DialogTitle>
                <DialogDescription className="text-center">
                  选择支付方式完成订阅
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                {/* Order Summary */}
                <div className="p-4 rounded-xl bg-muted/30 border mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-muted-foreground">套餐</span>
                    <span className="font-medium">专业版 - 月度订阅</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">金额</span>
                    <span className="text-2xl font-bold text-primary">¥99</span>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="space-y-3">
                  <p className="text-sm font-medium mb-3">选择支付方式</p>
                  
                  <button
                    onClick={() => handleSelectPayment("wechat")}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                      "hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                      <Smartphone className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">微信支付</p>
                      <p className="text-sm text-muted-foreground">推荐使用</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectPayment("alipay")}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                      "hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">支付宝</p>
                      <p className="text-sm text-muted-foreground">快捷支付</p>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

          {paymentStep === "pay" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center">
                  {paymentMethod === "wechat" ? "微信支付" : "支付宝支付"}
                </DialogTitle>
                <DialogDescription className="text-center">
                  请使用{paymentMethod === "wechat" ? "微信" : "支付宝"}扫描下方二维码完成支付
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col items-center gap-6 py-4">
                {/* Payment QR Code */}
                <div className={cn(
                  "w-56 h-56 rounded-xl border-2 flex items-center justify-center",
                  paymentMethod === "wechat" 
                    ? "border-green-500/30 bg-green-500/5" 
                    : "border-blue-500/30 bg-blue-500/5"
                )}>
                  <div className="text-center">
                    <QrCode className={cn(
                      "h-28 w-28 mx-auto mb-2",
                      paymentMethod === "wechat" ? "text-green-500/50" : "text-blue-500/50"
                    )} />
                    <p className="text-sm text-muted-foreground">
                      {paymentMethod === "wechat" ? "微信" : "支付宝"}付款码
                    </p>
                  </div>
                </div>

                {/* Amount */}
                <div className="text-center">
                  <p className="text-muted-foreground mb-1">支付金额</p>
                  <p className="text-3xl font-bold">¥99.00</p>
                </div>

                {/* Payment Status */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  等待支付中...
                </div>

                {/* Simulate Payment Button (for demo) */}
                <Button 
                  className="w-full" 
                  onClick={handlePaymentComplete}
                >
                  模拟支付完成
                </Button>

                <button
                  onClick={() => setPaymentStep("select")}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  返回选择其他支付方式
                </button>
              </div>
            </>
          )}

          {paymentStep === "success" && (
            <>
              <div className="flex flex-col items-center gap-6 py-8">
                {/* Success Icon */}
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>

                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-2">支付成功</h3>
                  <p className="text-muted-foreground">
                    恭喜您已成功升级为专业版会员
                  </p>
                </div>

                {/* Order Info */}
                <div className="w-full p-4 rounded-xl bg-muted/30 border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">订单号</span>
                    <span className="font-mono">CH{Date.now()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">套餐</span>
                    <span>专业版 - 月度订阅</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">有效期</span>
                    <span>30天</span>
                  </div>
                </div>

                <Link href="/dashboard/image-to-image" className="w-full">
                  <Button className="w-full">
                    开始创作
                  </Button>
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
