import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CheckCircle2, ArrowRight } from 'lucide-react'

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="mb-2 flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
              <CardTitle className="text-2xl text-center">Thank you for signing up!</CardTitle>
              <CardDescription className="text-center">Check your email to confirm</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  You&apos;ve successfully signed up. Please check your email to confirm your account
                  before signing in.
                </p>
                
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">What&apos;s next?</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground mb-4">
                    <li>Confirm your email by clicking the link we sent you</li>
                    <li>Log in to your account</li>
                    <li>Create your first organization</li>
                    <li>Start using SupaStart!</li>
                  </ol>
                  
                  <Button asChild className="w-full">
                    <Link href="/auth/login" className="flex items-center justify-center">
                      Continue to Login
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
