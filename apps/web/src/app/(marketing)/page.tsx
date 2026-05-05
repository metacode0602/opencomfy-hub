import { Navbar } from "@/components/landing/navbar"
import { Hero } from "@/components/landing/hero"
import { Features } from "@/components/landing/features"
import { MarketplaceSection } from "@/components/landing/marketplace-section"
import { Models } from "@/components/landing/models"
import { Showcase } from "@/components/landing/showcase"
import { Pricing } from "@/components/landing/pricing"
import { Footer } from "@/components/landing/footer"

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      {/* <Features /> */}
      <MarketplaceSection />
      <Models />
      <Showcase />
      <Pricing />
      <Footer />
    </main>
  )
}
