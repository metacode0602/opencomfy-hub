import type { SVGProps } from 'react'

/**
 * https://icon-sets.iconify.design/fa6-brands/bluesky/
 */
export function OpenRouteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
      <rect width='32' height='32' rx='6' fill='currentColor' className='text-foreground' />
      <text
        x='16'
        y='20'
        textAnchor='middle'
        fill='currentColor'
        className='text-background'
        fontFamily='system-ui, -apple-system, sans-serif'
        fontSize='12'
        fontWeight='bold'
      >
        OR
      </text>
    </svg>
  )
}
