import NavHeader from "@/components/website-components/nav-header"
import Footer from "@/components/website-components/footer"
import CallToAction from "@/components/website-components/call-to-action"
import ComponentShowcase from "@/components/website-components/component-showcase"
import BentoFeaturesSection from "@/components/website-components/features-bento"
import HeroSection from "@/components/website-components/hero-section"
import ClassicFeaturesSection from "@/components/website-components/features"
import Testimonials from "@/components/website-components/testimonials"
import DemoSection from "@/components/website-components/demo-section"
import { Button } from "@/components/ui/button"
import AlternativeBentoSection from "@/components/website-components/alternative-bento"

export default function StyleguidePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader fullWidth />
      {/* Main content area */}
      <div className="flex-grow">
        {/* Page header */}
        <div className="border-b py-8 mb-8">
          <div className="container mx-auto px-4">
            <h1 className="font-mono text-3xl font-bold mb-2">Design System & Component Library</h1>
            <p className="text-muted-foreground">
              A collection of components and design patterns used throughout the Supastart platform.
            </p>
          </div>
        </div>

        {/* Components showcase */}
        <div className="container mx-auto px-4 pb-16">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Marketing Components</h2>
            
            <ComponentShowcase 
              title="Hero Section" 
              description="Main hero section used on the homepage."
            >
              <div className="border rounded-lg overflow-hidden">
                <HeroSection />
              </div>
            </ComponentShowcase>
            
            <ComponentShowcase 
              title="Call to Action" 
              description="Used to drive user actions and conversions."
            >
              <div className="border rounded-lg overflow-hidden">
                <CallToAction />
              </div>
            </ComponentShowcase>

            <ComponentShowcase 
              title="Demo Section" 
              description="Video showcase with heading and call-to-action."
            >
              <div className="border rounded-lg overflow-hidden">
                <DemoSection />
              </div>
            </ComponentShowcase>

            <ComponentShowcase 
              title="Testimonials" 
              description="Social proof section with customer quotes and avatars."
            >
              <div className="border rounded-lg overflow-hidden">
                <Testimonials />
              </div>
            </ComponentShowcase>

            <ComponentShowcase 
              title="Classic Features Section"
              description="Vertical stacked feature sections with clean card-based design."
            >
              <div className="border rounded-lg overflow-hidden">
                <ClassicFeaturesSection />
              </div>
            </ComponentShowcase>

            <ComponentShowcase 
              title="Feature Showcase (Bento)"
              description="Bento grid layout highlighting key features."
            >
              <div className="border rounded-lg overflow-hidden">
                <BentoFeaturesSection />
              </div>
            </ComponentShowcase>
            
            <ComponentShowcase 
              title="Alternative Bento Layout"
              description="Advanced feature showcase using a bento grid arrangement."
            >
              <div className="border rounded-lg overflow-hidden">
                <AlternativeBentoSection />
              </div>
            </ComponentShowcase>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">UI Components</h2>
            
            <ComponentShowcase 
              title="Buttons" 
              description="Various button styles and variants."
            >
              <div className="flex flex-wrap gap-4">
                <Button size="sm">Small</Button>
                <Button>Default</Button>
                <Button size="lg">Large</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
            </ComponentShowcase>
          </section>
        </div>
      </div>

      {/* Footer component */}
      <Footer />
    </div>
  )
} 