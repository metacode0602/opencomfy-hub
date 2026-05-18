import {
  ArrowRight,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  MessageSquare,
  Video,
  Wallet,
} from 'lucide-react'

export function getActivityIcon(type: string) {
  switch (type) {
    case 'comment':
      return MessageSquare
    case 'file':
      return FileText
    case 'meeting':
      return Video
    case 'task':
      return CheckCircle
    case 'stage_change':
      return ArrowRight
    case 'recharge':
      return Wallet
    case 'consumption':
      return CreditCard
    default:
      return Clock
  }
}
