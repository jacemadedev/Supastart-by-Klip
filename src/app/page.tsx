import HeroSection from "@/components/website-components/hero-section"
import CallToAction from "@/components/website-components/call-to-action"
import BentoFeaturesSection from "@/components/website-components/features-bento"
import Testimonials from "@/components/website-components/testimonials"
import DemoSection from "@/components/website-components/demo-section"
import Footer from "@/components/website-components/footer"
import NavHeader from "@/components/website-components/nav-header"
import AnnouncementBar from "@/components/website-components/announcement-bar"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "SupaStart - The Ultimate SaaS Starter Kit",
  description: "Launch your SaaS faster with SupaStart - a complete Next.js starter kit with authentication, payments, database, and deployment ready out of the box.",
  openGraph: {
    title: "SupaStart - The Ultimate SaaS Starter Kit",
    description: "Launch your SaaS faster with SupaStart - a complete Next.js starter kit with authentication, payments, database, and deployment ready out of the box.",
    images: [
      {
        url: "/hero-section-screenshot.png",
        width: 1200,
        height: 630,
        alt: "SupaStart Dashboard Screenshot",
      },
    ],
  },
}

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SupaStart",
    "description": "Launch your SaaS faster with SupaStart - a complete Next.js starter kit with authentication, payments, database, and deployment ready out of the box.",
    "url": "https://supastart.com",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "199",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "creator": {
      "@type": "Organization",
      "name": "SupaStart Team"
    },
    "softwareVersion": "1.0",
    "screenshot": "https://supastart.com/hero-section-screenshot.png"
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="min-h-screen flex flex-col">
        <AnnouncementBar />
        <NavHeader />
        <HeroSection />
        <BentoFeaturesSection />
        <DemoSection />
        <Testimonials />
        <CallToAction />
        <Footer />
      </div>
    </>
  )
}
