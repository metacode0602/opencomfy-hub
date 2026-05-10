import { cn } from '@workspace/ui/lib/utils'

interface DividerWithTextProps {
  text: string
  className?: string
}

/**
 * A horizontal divider with text in the middle
 */
export const DividerWithText = ({ text, className }: DividerWithTextProps) => {
  return (
    <div className={cn('relative flex items-center', className)}>
      <div className='grow border-border border-t' />
      <span className='mx-4 shrink text-muted-foreground text-sm'>{text}</span>
      <div className='grow border-border border-t' />
    </div>
  )
}
