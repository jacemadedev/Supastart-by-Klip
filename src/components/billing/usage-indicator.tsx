"use client"

import { useOrganizationContext } from "@/contexts/organization-context"
import { Progress } from "@/components/ui/progress"

interface UsageIndicatorProps {
  feature: string
  label: string
  currentUsage: number
  showCount?: boolean
}

export function UsageIndicator({ feature, label, currentUsage, showCount = true }: UsageIndicatorProps) {
  const { organization } = useOrganizationContext()
  
  if (!organization?.subscription?.plan_features) {
    return null
  }
  
  const limit = organization.subscription.plan_features[feature] as number
  
  if (!limit) {
    return null
  }
  
  const percentage = Math.min(Math.round((currentUsage / limit) * 100), 100)
  const isNearLimit = percentage >= 80
  const isAtLimit = percentage >= 100
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        {showCount && (
          <span className={isAtLimit ? "text-destructive font-medium" : ""}>
            {currentUsage} / {limit}
          </span>
        )}
      </div>
      <Progress 
        value={percentage} 
        className={`h-2 ${
          isAtLimit 
            ? "bg-destructive/20" 
            : isNearLimit 
              ? "bg-amber-100" 
              : ""
        }`}
        indicatorClassName={
          isAtLimit 
            ? "bg-destructive" 
            : isNearLimit 
              ? "bg-amber-500" 
              : ""
        }
      />
    </div>
  )
} 