'use client'

import { useOrganizationContext } from "@/contexts/organization-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export function PlanStatusBanner() {
  const { organization } = useOrganizationContext()
  const router = useRouter()
  
  // Check if the organization has no subscription plan
  // This occurs when organization exists but subscription is undefined
  const hasPlanSelected = Boolean(organization?.subscription?.plan_id)
  
  if (!organization || hasPlanSelected) {
    return null
  }
  
  return (
    <Alert 
      variant="warning" 
      className="mb-4 bg-amber-50 border-amber-200 shadow-sm"
    >
      <AlertCircle className="h-5 w-5 text-amber-600" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
        <div>
          <AlertTitle className="text-amber-800">No Plan Selected</AlertTitle>
          <AlertDescription className="text-amber-700">
            Your organization doesn&apos;t have a plan selected, which may limit access to features due to insufficient credits.
          </AlertDescription>
        </div>
        <Button 
          className="bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap"
          onClick={() => router.push('/dashboard/billing')}
        >
          Select a Plan
        </Button>
      </div>
    </Alert>
  )
} 