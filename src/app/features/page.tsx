import ClassicFeaturesSection from "@/components/website-components/features"
import NavHeader from "@/components/website-components/nav-header"
import CallToAction from "@/components/website-components/call-to-action"
import Footer from "@/components/website-components/footer"

export default function FeaturesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />
      <ClassicFeaturesSection />
      <CallToAction />
      <Footer />
    </div>
  )
} 