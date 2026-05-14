import { formatDate } from '@/lib/utils/date-utils'
import { CalendarIcon } from 'lucide-react'
import { Card, CardContent } from '@workspace/ui/components/card'
import { CustomMDXContent } from '../shared/custom-mdx-content'

interface CustomPageProps {
  title: string
  description: string
  date: string
  content: any // MDX content
}

export function CustomPage({ title, description, date, content }: CustomPageProps) {
  const formattedDate = formatDate(new Date(date))

  return (
    <div className='mx-auto max-w-6xl space-y-8'>
      {/* Header */}
      <div className='space-y-4'>
        <h1 className='text-center font-bold text-3xl tracking-tight'>{title}</h1>
        <p className='text-center text-lg text-muted-foreground'>{description}</p>
        <div className='flex items-center justify-center gap-2'>
          <CalendarIcon className='size-4 text-muted-foreground' />
          <p className='text-muted-foreground text-sm'>{formattedDate}</p>
        </div>
      </div>

      {/* Content */}
      <Card className='mb-8'>
        <CardContent>
          <div className='prose prose-neutral dark:prose-invert max-w-none prose-img:rounded-lg'>
            <CustomMDXContent code={content} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
