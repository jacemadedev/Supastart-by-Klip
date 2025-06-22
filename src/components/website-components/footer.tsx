import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Github } from "lucide-react"

export default function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm text-muted-foreground">
              © 2024 Supastart. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4">
            <Link 
              href="https://github.com/jacemadedev/supastart" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <Github className="h-4 w-4" />
              <span className="text-sm">GitHub</span>
            </Link>
            <Button variant="ghost" size="sm" asChild className="h-8">
              <Link href="/styleguide">Styleguide</Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-8">
              Terms
            </Button>
            <Button variant="ghost" size="sm" className="h-8">
              Privacy
            </Button>
            <Button variant="ghost" size="sm" className="h-8">
              Contact
            </Button>
          </div>
        </div>
      </div>
    </footer>
  )
} 