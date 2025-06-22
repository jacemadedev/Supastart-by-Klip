import { Sparkles } from "lucide-react"
import { useOrganizationContext } from "@/contexts/organization-context"

interface CreditInfo {
  used: number
  total: number
}

export function CreditTracker({ className }: { className?: string }) {
  const { organization } = useOrganizationContext()
  
  // Get actual credits from the organization
  const planCreditsPerPeriod = organization?.subscription?.plan_features?.credits_per_period 
    ? Number(organization.subscription.plan_features.credits_per_period) 
    : 0
  
  const credits: CreditInfo = {
    // Calculate used credits based on plan credits_per_period and current balance
    used: organization?.subscription?.plan_id 
      ? planCreditsPerPeriod - (organization?.credits_balance || 0)
      : 0,
    total: planCreditsPerPeriod
  }

  // Ensure used doesn't go negative
  const normalizedUsed = Math.max(0, credits.used)
  const percentage = credits.total > 0 ? Math.round((normalizedUsed / credits.total) * 100) : 0
  const isLow = percentage > 80

  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{organization?.credits_balance || 0}</span>
          <span className="text-muted-foreground">credits remaining</span>
        </div>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isLow ? "bg-destructive" : "bg-primary"
          }`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
} 