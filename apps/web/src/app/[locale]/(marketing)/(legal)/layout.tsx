import type { PropsWithChildren } from 'react'
import { Navbar } from '@/components/landing/navbar'
import { Footer } from '@/components/landing/footer'
import Container from '@/components/layout/container'
import '@/app/legal.css'
export default function LegalLayout({ children }: PropsWithChildren) {
  return (
    <main className='min-h-screen'>
      <Navbar />
      <Container className='px-4 sm:px-6 sm:py-12 lg:px-8 my-8'>
      {children}
      </Container>
      
      <Footer />
    </main>
  )
}
