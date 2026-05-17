'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageCircle, Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog'
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import { toast } from 'sonner'
import Image from 'next/image'
import { websiteConfig } from '@/lib/config/website'

interface WeChatQRDialogProps {
  /**
   * 微信二维码图片的URL
   */
  qrCodeUrl?: string
  /**
   * 微信ID或联系方式
   */
  wechatId?: string
  /**
   * 自定义按钮文本
   */
  buttonText?: string
  /**
   * 自定义按钮样式
   */
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  /**
   * 自定义按钮大小
   */
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon'
  /**
   * 是否显示图标
   */
  showIcon?: boolean
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 是否显示为图标按钮
   */
  asIconButton?: boolean
  /**
   * 受控的打开状态
   */
  open?: boolean
  /**
   * 打开状态变化回调
   */
  onOpenChange?: (open: boolean) => void
}

/**
 * 微信二维码对话框组件
 * 提供一个可重用的微信二维码展示对话框
 */
export function WeChatQRDialog({
  qrCodeUrl = '/images/wechat.png', // 默认二维码图片路径
  wechatId = websiteConfig.metadata.social.wechatId,
  buttonText,
  buttonVariant = 'outline',
  buttonSize = 'default',
  showIcon = true,
  className,
  asIconButton = false,
  open: controlledOpen,
  onOpenChange,
}: WeChatQRDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const t = useTranslations('ContactPage.wechat')

  // 如果提供了受控的 open，使用受控模式
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled && onOpenChange) {
      onOpenChange(newOpen)
    } else {
      setInternalOpen(newOpen)
    }
    // 重置复制状态当对话框关闭时
    if (!newOpen) {
      setCopied(false)
    }
  }

  const handleCopyWeChatId = async () => {
    try {
      await navigator.clipboard.writeText(wechatId)
      setCopied(true)
      toast.success(t('copySuccess'))

      // 2秒后重置复制状态
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy WeChat ID:', err)
      toast.error(t('copyFailed'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button
            variant={buttonVariant}
            size={buttonSize}
            className={cn('gap-2', asIconButton && 'px-2', className)}
            aria-label={t('openDialog')}
          >
            {showIcon && <MessageCircle className='h-4 w-4' />}
            {!asIconButton && (buttonText || t('contactWeChat'))}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <MessageCircle className='h-5 w-5 text-primary' />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className='flex flex-col items-center space-y-4 py-4'>
          {/* 二维码图片 */}
          <div className='relative'>
            <div className='rounded-lg border-2 border-gray-200 p-4 bg-white shadow-sm'>
              <Image
                src={qrCodeUrl}
                alt={t('qrCodeAlt')}
                width={256}
                height={256}
                className='h-64 w-64 object-contain'
                onError={(e) => {
                  // 如果图片加载失败，显示占位符
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const placeholder = target.nextElementSibling as HTMLElement
                  if (placeholder) {
                    placeholder.style.display = 'flex'
                  }
                }}
              />
              {/* 图片加载失败时的占位符 */}
              <div
                className='h-64 w-64 flex items-center justify-center bg-gray-100 text-gray-500 text-sm'
                style={{ display: 'none' }}
              >
                {t('qrCodePlaceholder')}
              </div>
            </div>
          </div>

          {/* 微信号和复制按钮 */}
          <div className='w-full space-y-2'>
            <div className='flex items-center justify-center gap-2'>
              <span className='text-sm font-medium text-muted-foreground'>{t('wechatId')}:</span>
              <span className='text-sm font-semibold'>{wechatId}</span>
            </div>
            <Button
              onClick={handleCopyWeChatId}
              variant='outline'
              size='sm'
              className='w-full gap-2'
              aria-label={t('copy')}
            >
              {copied ? (
                <>
                  <Check className='h-4 w-4 text-amber-500' />
                  <span>{t('copied')}</span>
                </>
              ) : (
                <>
                  <Copy className='h-4 w-4' />
                  <span>{t('copy')}</span>
                </>
              )}
            </Button>
          </div>

          {/* 使用说明 */}
          <div className='text-center text-sm text-muted-foreground space-y-1'>
            <p className='font-medium text-foreground'>{t('supportNote')}</p>
            <p>{t('instruction1')}</p>
            {/* <p>{t("instruction2")}</p> */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

