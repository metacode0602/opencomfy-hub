import { Footer } from '@/components/landing/footer'
import { Navbar } from '@/components/landing/navbar'
import Container from '@/components/layout/container'
import type { PropsWithChildren } from 'react'

export default function PageLayout({ children }: PropsWithChildren) {
  return (
    <main className='min-h-screen'>
      <Navbar />
      <Container className='px-4 py-8 sm:px-6 sm:py-12 lg:px-8 my-8'>
      {children}
      </Container>
      
      <Footer />
    </main>
  )     
}
