import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Database, Heart, Server, Sparkles, Bolt, TerminalSquare, Code, Workflow, Plus } from 'lucide-react'

// Features showcase information
const FEATURES = [
  {
    id: 'supabase',
    title: 'Built for Supabase',
    description: 'Seamless integration with Supabase for auth, storage, and database',
    items: [
      {
        icon: <Database className="h-5 w-5 text-primary" />,
        name: 'Postgres Database',
        description: 'Type-safe access to your Supabase Postgres database'
      },
      {
        icon: <Server className="h-5 w-5 text-primary" />,
        name: 'Edge Functions',
        description: 'Serverless functions with Supabase Edge Functions'
      },
      {
        icon: <Sparkles className="h-5 w-5 text-primary" />,
        name: 'Auth & Storage',
        description: 'Pre-configured authentication and storage systems'
      }
    ]
  },
  {
    id: 'lovable',
    title: 'AI Coding Compatible',
    description: 'Optimized for modern AI coding platforms',
    items: [
      {
        icon: <TerminalSquare className="h-5 w-5 text-primary" />,
        name: 'Cursor AI Ready',
        description: 'Custom rules and structure for optimal Cursor suggestions'
      },
      {
        icon: <Heart className="h-5 w-5 text-primary" />,
        name: 'Lovable.dev Friendly',
        description: 'Easily import and make visual edits with Lovable.dev'
      },
      {
        icon: <Bolt className="h-5 w-5 text-primary" />,
        name: 'Bolt.new Compatible',
        description: 'Seamless integration with Bolt.new for rapid iterations'
      }
    ]
  },
  {
    id: 'cursor',
    title: 'Optimized for Cursor',
    description: 'AI-powered development with Cursor integration',
    items: [
      {
        icon: <TerminalSquare className="h-5 w-5 text-primary" />,
        name: 'AI Rules',
        description: 'Custom rules to help AI understand your codebase'
      },
      {
        icon: <Code className="h-5 w-5 text-primary" />,
        name: 'Intelligent Coding',
        description: 'Get smart suggestions and code completions'
      },
      {
        icon: <Workflow className="h-5 w-5 text-primary" />,
        name: 'Streamlined Workflow',
        description: 'Build faster with AI-assisted development'
      }
    ]
  }
];

interface FeatureSectionProps {
  feature: typeof FEATURES[0];
}

function FeatureSection({ feature }: FeatureSectionProps) {
  return (
    <section id={feature.id} className="py-16">
      <div className="mx-4 md:mx-auto max-w-5xl rounded-3xl border px-6 py-12 md:py-20 bg-muted dark:bg-background">
        <div className="mx-auto max-w-lg space-y-6 text-center mb-12">
          <h2 className="font-mono text-balance text-3xl font-semibold md:text-4xl lg:text-5xl">{feature.title}</h2>
          <p className="text-muted-foreground">{feature.description}</p>
        </div>

        <div className="mx-auto max-w-md px-6 [mask-image:radial-gradient(ellipse_100%_100%_at_50%_0%,#000_70%,transparent_100%)]">
          <div className="bg-background dark:bg-muted/50 rounded-xl border px-6 pb-12 pt-3 shadow-xl">
            {feature.items.map((item, index) => (
              <FeatureItem
                key={index}
                icon={item.icon}
                name={item.name}
                description={item.description}
              />
            ))}
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <Button
            variant="outline"
            size="lg"
            asChild>
            <Link href={`#${feature.id}`}>Learn More</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

// Renamed from Integration to FeatureItem for clarity
const FeatureItem = ({ icon, name, description }: { icon: React.ReactNode; name: string; description: string }) => {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-dashed py-3 last:border-b-0">
      <div className="bg-muted border-foreground/5 flex size-12 items-center justify-center rounded-lg border">{icon}</div>
      <div className="space-y-0.5">
        <h3 className="font-mono text-sm font-medium">{name}</h3>
        <p className="text-muted-foreground line-clamp-1 text-sm">{description}</p>
      </div>
      <Button
        variant="outline"
        size="icon"
        aria-label={`Learn more about ${name}`}>
        <Plus className="size-4" />
      </Button>
    </div>
  )
}

export default function ClassicFeaturesSection() {
  return (
    <>
      <FeatureSection feature={FEATURES[0]} />
      <FeatureSection feature={FEATURES[1]} />
      <FeatureSection feature={FEATURES[2]} />
    </>
  )
}
