import { buttonVariants } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import Link from 'next/link'
import { Logo } from '../layout/logo'
import { websiteConfig } from '@/lib/config/website'

export default function BuiltWithButton() {
  return (
    <Link
      target='_blank'
      href={`${websiteConfig.metadata.base_url}?utm_source=built-with-bytemarketing`}
      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md border border-border px-4')}
    >
      <span>Built with</span>
      <span>
        <Logo className='size-5 rounded-full' />
      </span>
      <span className='font-semibold'>{websiteConfig.metadata.base_url}</span>
    </Link>
  )
}
