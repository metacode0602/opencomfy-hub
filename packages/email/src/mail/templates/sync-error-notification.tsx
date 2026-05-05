import { defaultMessages } from '@/i18n/messages'
import { routing } from '@/i18n/routing'
import EmailLayout from '@/mail/components/email-layout'
import type { BaseEmailProps } from '@/mail/types'
import { Heading, Hr, Section, Text } from '@react-email/components'

interface SyncErrorNotificationProps extends BaseEmailProps {
  syncDate: string
  totalUsers: number
  processed: number
  failed: number
  errors: Array<{
    userId: string
    error: string
  }>
}

export function SyncErrorNotification({
  syncDate,
  totalUsers,
  processed,
  failed,
  errors,
  locale,
  messages,
}: SyncErrorNotificationProps) {
  const successRate = totalUsers > 0 ? ((processed / totalUsers) * 100).toFixed(2) : '0'
  const errorList = errors.slice(0, 10).map((e) => `- 用户 ${e.userId}: ${e.error}`).join('\n')
  const moreErrors = errors.length > 10 ? `\n... 还有 ${errors.length - 10} 个错误` : ''
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

  return (
    <EmailLayout locale={locale} messages={messages}>
      <Heading className="text-2xl font-bold text-red-600">⚠️ LiteLLM 数据同步异常通知</Heading>

      <Text className="mt-4">
        同步任务在 <strong>{syncDate}</strong> 执行时发生异常，详情如下：
      </Text>

      <Section className="mt-6 rounded-lg border-l-4 border-red-500 bg-gray-50 p-4">
        <Heading as="h3" className="text-lg font-semibold">
          同步统计
        </Heading>
        <Text className="mt-2">
          <strong>总用户数：</strong>
          {totalUsers}
        </Text>
        <Text>
          <strong>成功处理：</strong>
          {processed}
        </Text>
        <Text className="text-red-600">
          <strong>失败数量：</strong>
          {failed}
        </Text>
        <Text>
          <strong>成功率：</strong>
          {successRate}%
        </Text>
      </Section>

      {errors.length > 0 && (
        <Section className="mt-4 rounded-lg bg-red-50 p-4">
          <Heading as="h3" className="text-lg font-semibold text-red-700">
            错误详情（前10条）
          </Heading>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-sm text-gray-800">
            {errorList}
            {moreErrors}
          </pre>
        </Section>
      )}

      <Hr className="my-6" />

      <Section className="rounded-lg bg-blue-50 p-4">
        <Text className="text-sm font-semibold text-gray-700">建议操作：</Text>
        <Text className="mt-2 text-sm text-gray-700">1. 检查 LiteLLM API 服务是否正常</Text>
        <Text className="text-sm text-gray-700">2. 检查网络连接是否稳定</Text>
        <Text className="text-sm text-gray-700">3. 查看服务器日志获取更多详情</Text>
        <Text className="text-sm text-gray-700">4. 如有需要，可以手动触发同步任务</Text>
      </Section>

      <Text className="mt-4 text-xs text-gray-500">此邮件由 LiteLLM 数据同步系统自动发送</Text>
      <Text className="text-xs text-gray-500">时间: {timestamp}</Text>
    </EmailLayout>
  )
}

SyncErrorNotification.PreviewProps = {
  locale: routing.defaultLocale,
  messages: defaultMessages,
  syncDate: '2025-01-15 10:30:00',
  totalUsers: 100,
  processed: 85,
  failed: 15,
  errors: [
    { userId: 'user_1', error: 'Network timeout' },
    { userId: 'user_2', error: 'API rate limit exceeded' },
    { userId: 'user_3', error: 'Invalid response format' },
  ],
}

export default SyncErrorNotification
