import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { Tabs } from 'fumadocs-ui/components/tabs'
import { Tab } from 'fumadocs-ui/components/tabs'
import { TypeTable } from 'fumadocs-ui/components/type-table'
import { Accordion } from 'fumadocs-ui/components/accordion'
import { Accordions } from 'fumadocs-ui/components/accordion'
import { Steps } from 'fumadocs-ui/components/steps'
import { Step } from 'fumadocs-ui/components/steps'
import { File } from 'fumadocs-ui/components/files'
import { Folder } from 'fumadocs-ui/components/files'
import { Files } from 'fumadocs-ui/components/files'
import { Callout } from 'fumadocs-ui/components/callout'
import type { FC } from 'react'
import type { ComponentProps } from 'react'

interface CustomMDXContentProps {
  code: string
}

const baseComponents: Record<string, any> = {
  ...defaultMdxComponents,
  // ...LucideIcons,
  ...((await import('lucide-react'))),
  Tabs,
  Tab,
  TypeTable,
  Accordion,
  Accordions,
  Steps,
  Step,
  File,
  Folder,
  Files,
  blockquote: Callout as unknown as FC<ComponentProps<'blockquote'>>,
}

export function CustomMDXContent({ code }: CustomMDXContentProps) {
  return (
    <div className='prose dark:prose-invert prose-headings:mt-8 prose-headings:mb-4 prose-ol:mb-6 prose-p:mb-4 prose-ul:mb-6 max-w-none'>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={baseComponents}>
        {code}
      </ReactMarkdown>
    </div>
  )
}
