import EmailLayout from '../components/email-layout'
import { previewDefaultLocale, previewMessages } from '../preview-messages'
import type { BaseEmailProps } from '../types'
import { Heading, Hr, Section, Text } from '@react-email/components'

interface WechatWebhookFailedProps extends BaseEmailProps {
  orderId?: string
  errorMessage: string
  errorType: 'parse_error' | 'validation_error' | 'processing_error' | 'unknown_error'
  webhookData?: Record<string, any>
  timestamp: string
  stackTrace?: string
}

export function WechatWebhookFailed({
  orderId,
  errorMessage,
  errorType,
  webhookData,
  timestamp,
  stackTrace,
  locale,
  messages,
}: WechatWebhookFailedProps) {
  const getErrorTypeLabel = () => {
    switch (errorType) {
      case 'parse_error':
        return 'XML 解析错误'
      case 'validation_error':
        return '数据验证错误'
      case 'processing_error':
        return '业务处理错误'
      case 'unknown_error':
        return '未知错误'
      default:
        return '错误'
    }
  }

  return (
    <EmailLayout locale={locale} messages={messages}>
      <Heading className="text-2xl font-bold text-red-600">⚠️ 微信支付 Webhook 处理失败通知</Heading>

      <Text className="mt-4">
        微信支付 Webhook 回调处理时发生错误，详情如下：
      </Text>

      <Section className="mt-6 rounded-lg border-l-4 border-red-500 bg-gray-50 p-4">
        <Heading as="h3" className="text-lg font-semibold">
          错误信息
        </Heading>
        <Text className="mt-2">
          <strong>错误类型：</strong>
          {getErrorTypeLabel()}
        </Text>
        {orderId && (
          <Text>
            <strong>订单ID：</strong>
            {orderId}
          </Text>
        )}
        <Text>
          <strong>发生时间：</strong>
          {timestamp}
        </Text>
      </Section>

      <Section className="mt-4 rounded-lg bg-red-50 p-4">
        <Heading as="h3" className="text-lg font-semibold text-red-700">
          错误详情
        </Heading>
        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-sm text-gray-800">{errorMessage}</pre>
      </Section>

      {webhookData && Object.keys(webhookData).length > 0 && (
        <Section className="mt-4 rounded-lg border-l-4 border-blue-500 bg-gray-50 p-4">
          <Heading as="h3" className="text-lg font-semibold">
            Webhook 数据
          </Heading>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-gray-800">
            {JSON.stringify(webhookData, null, 2)}
          </pre>
        </Section>
      )}

      {stackTrace && (
        <Section className="mt-4 rounded-lg bg-yellow-50 p-4">
          <Heading as="h3" className="text-lg font-semibold text-yellow-700">
            堆栈跟踪
          </Heading>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-gray-800">{stackTrace}</pre>
        </Section>
      )}

      <Hr className="my-6" />

      <Section className="rounded-lg bg-blue-50 p-4">
        <Text className="text-sm font-semibold text-gray-700">建议操作：</Text>
        <Text className="mt-2 text-sm text-gray-700">1. 检查服务器日志获取更多详情</Text>
        <Text className="text-sm text-gray-700">2. 验证微信支付配置是否正确</Text>
        <Text className="text-sm text-gray-700">3. 检查数据库连接是否正常</Text>
        <Text className="text-sm text-gray-700">4. 验证订单是否存在</Text>
        {errorType === 'parse_error' && (
          <Text className="mt-2 text-sm text-gray-700">5. 检查 XML 格式是否正确</Text>
        )}
        {errorType === 'validation_error' && (
          <Text className="mt-2 text-sm text-gray-700">5. 检查必要字段是否完整</Text>
        )}
        {errorType === 'processing_error' && (
          <Text className="mt-2 text-sm text-gray-700">5. 检查业务逻辑处理是否正常</Text>
        )}
      </Section>

      <Section className="mt-4 rounded-lg bg-yellow-50 p-4">
        <Text className="text-sm text-gray-700">
          <strong>说明：</strong>
          <br />
          即使处理失败，系统也会返回成功响应给微信支付，避免重复通知。
          <br />
          请及时处理此错误，确保充值流程正常运行。
        </Text>
      </Section>

      <Text className="mt-4 text-xs text-gray-500">此邮件由微信支付 Webhook 系统自动发送</Text>
      <Text className="text-xs text-gray-500">时间: {timestamp}</Text>
    </EmailLayout>
  )
}

WechatWebhookFailed.PreviewProps = {
  locale: previewDefaultLocale,
  messages: previewMessages,
  orderId: 'wechat_1234567890_abcdef',
  errorMessage: '签名验证失败',
  errorType: 'validation_error' as const,
  webhookData: {
    return_code: 'SUCCESS',
    result_code: 'SUCCESS',
    out_trade_no: 'wechat_1234567890_abcdef',
    total_fee: '10000',
  },
  timestamp: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
  stackTrace: 'Error: 签名验证失败\n    at WechatRechargeProvider.verifySign',
}

export default WechatWebhookFailed

