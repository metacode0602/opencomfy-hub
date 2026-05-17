"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import Container from "../layout/container"
import Image from "next/image"

const footerLinks = {
  product: {
    title: "产品",
    links: [
      { label: "功能", href: "/#features" },
      { label: "模型", href: "/#models" },
      { label: "定价", href: "/#pricing" },
      { label: "更新日志", href: "/changelog" },
    ],
  },
  resources: {
    title: "资源",
    links: [
      { label: "文档", href: "#" },
      { label: "教程", href: "#" },
      { label: "社区", href: "#" },
      { label: "API", href: "#" },
    ],
  },
  company: {
    title: "公司",
    links: [
      { label: "关于我们", href: "/about" },
      { label: "博客", href: "#" },
      { label: "招聘", href: "#" },
      { label: "联系我们", href: "/contact" },
    ],
  },
  legal: {
    title: "法律",
    links: [
      { label: "隐私政策", href: "/privacy" },
      { label: "服务条款", href: "/terms" },
      { label: "Cookie 政策", href: "/cookie" },
    ],
  },
}

export function Footer() {
  return (
    <footer className="py-16 border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold gradient-text">Genesis AI</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              用 AI 释放你的创意
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key}>
              <h4 className="font-semibold mb-4">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <Container className="px-4">
            <div className="flex flex-col items-center justify-center gap-y-3 sm:gap-y-4 text-center">
              <span className="text-muted-foreground text-xs sm:text-sm px-2">
                Copyright ©2025-2027 天津聚链科技有限公司版权所有
              </span>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-y-2 sm:gap-y-0 sm:gap-x-4 text-sm text-muted-foreground">
                <span className="hover:text-primary transition-colors">
                  <Link
                    href="https://beian.miit.gov.cn/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    津ICP备2023007973号-6
                  </Link>
                </span>
                <span className="hidden sm:inline text-muted-foreground/50">
                  |
                </span>
                <div className="flex items-center gap-x-2">
                  <Image
                    src="/images/gongan.jpg"
                    alt="beian"
                    width={16}
                    height={16}
                    className="h-4 w-4 flex-shrink-0"
                  />
                  <span className="hover:text-primary transition-colors">
                    <Link
                      href="http://www.beian.gov.cn/portal/registerSystemInfo"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      津公网安备12011402001495号
                    </Link>
                  </span>
                </div>
              </div>
            </div>
          </Container>
        </div>
      </div>
    </footer>
  )
}
