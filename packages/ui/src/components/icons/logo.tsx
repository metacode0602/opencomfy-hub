
import type { SVGProps } from 'react'

/**
 * https://icon-sets.iconify.design/fa6-brands/bluesky/
 */
export function LogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
      <rect width='32' height='32' rx='6' className='fill-primary' />
      <text
        x='16'
        y='20'
        textAnchor='middle'
        className='fill-primary-foreground'
        fontFamily='system-ui, -apple-system, sans-serif'
        fontSize='12'
        fontWeight='bold'
      >
        OR
      </text>
    </svg>
  )
}
