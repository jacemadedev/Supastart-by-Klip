"use client"

import { useState, useEffect, useCallback } from "react"
import { useOrganizationContext } from "@/contexts/organization-context"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Info, CreditCard } from "lucide-react"
import { UsageIndicator } from "./usage-indicator"
import { Separator } from "@/components/ui/separator"
import { StripeCheckoutButton } from "./stripe-checkout-button"
import { StripePortalButton } from "./stripe-portal-button"

interface Plan {
  id: string
  name: string
  description: string
  price: number
  billing_interval: string
  is_active: boolean
  features: Record<string, unknown>
}

export function SubscriptionManager() {
  const { organization, userRole, updateSubscription, cancelSubscription, members } = useOrganizationContext()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [changingPlan, setChangingPlan] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const supabase = createClient()
  
  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true })
      
      if (error) throw error
      setPlans(data || [])
    } catch (error) {
      console.error("Error fetching plans:", error)
    } finally {
      setLoading(false)
    }
  }, [supabase])
  
  useEffect(() => {
    fetchPlans()
  }, [organization?.id, organization?.subscription?.plan_id, fetchPlans])
  
  const handleChangePlan = async (planId: string) => {
    if (!organization) return
    
    // For free plans, use the existing method
    const plan = plans.find(p => p.id === planId)
    if (plan && plan.price === 0) {
      setChangingPlan(true)
      try {
        const result = await updateSubscription(planId)
        if (!result.success && result.error) {
          console.error("Failed to update subscription:", result.error)
        }
      } finally {
        setChangingPlan(false)
      }
    }
    // For paid plans, the Stripe checkout button will handle it
  }
  
  const handleCancelSubscription = async () => {
    if (!organization) return
    
    setCanceling(true)
    try {
      const result = await cancelSubscription()
      if (!result.success && result.error) {
        console.error("Failed to cancel subscription:", result.error)
      }
    } finally {
      setCanceling(false)
    }
  }
  
  const formatPrice = (price: number, interval: string) => {
    if (price === 0) return "Free"
    return `$${price}/${interval === 'monthly' ? 'mo' : 'yr'}`
  }
  
  const getCurrentPlanId = () => {
    return organization?.subscription?.plan_id || ''
  }
  
  const isCurrentPlan = (planId: string) => {
    return getCurrentPlanId() === planId
  }
  
  const isPaidPlan = (plan: Plan) => {
    return plan.price > 0
  }
  
  const hasStripeSubscription = () => {
    if (!organization?.subscription) return false;
    
    // Either active subscription with paid plan, or
    // subscription marked for cancellation but still on paid plan
    const currentPlan = plans.find(p => p.id === organization.subscription?.plan_id);
    const isPaid = currentPlan && currentPlan.price > 0;
    
    return organization.subscription.subscription_status === 'active' && 
           isPaid;
  }
  
  const formatFeature = (key: string, value: unknown) => {
    if (key === "max_members") {
      return `Up to ${value} team members`
    }
    if (key === "projects") {
      return `${value} projects`
    }
    if (key === "storage") {
      return `${value}GB storage`
    }
    if (key === "advanced_analytics" && value === true) {
      return "Advanced analytics"
    }
    return `${key}: ${value}`
  }
  
  const renderPlanFeatures = (features: Record<string, unknown>) => {
    return Object.entries(features).map(([key, value]) => (
      <div key={key} className="flex items-center mb-2">
        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
        <span>{formatFeature(key, value)}</span>
      </div>
    ))
  }
  
  // Only show to organization owners
  if (userRole !== 'owner') {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only organization owners can manage subscription plans.
        </AlertDescription>
      </Alert>
    )
  }
  
  if (loading) {
    return <div className="space-y-4">
      <Skeleton className="h-[300px] w-full" />
    </div>
  }
  
  // Add current plan details section
  const renderCurrentPlanDetails = () => {
    if (!organization?.subscription) return null;
    
    const currentPlan = plans.find(p => p.id === organization.subscription?.plan_id);
    if (!currentPlan) return null;
    
    return (
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan: {currentPlan.name}</CardTitle>
              <CardDescription>
                {organization.subscription.cancel_at_period_end 
                  ? `Your subscription will be canceled on ${new Date(organization.subscription.current_period_end).toLocaleDateString()}`
                  : `Your subscription renews on ${new Date(organization.subscription.current_period_end).toLocaleDateString()}`
                }
              </CardDescription>
            </div>
            {currentPlan.price > 0 && (
              <div className="text-2xl font-bold">
                {formatPrice(currentPlan.price, currentPlan.billing_interval)}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium flex items-center gap-2 mb-4">
                <Info className="h-4 w-4" />
                Resource Usage
              </h3>
              <div className="space-y-4">
                <UsageIndicator 
                  feature="max_members" 
                  label="Team Members" 
                  currentUsage={members.length} 
                />
                {/* You can add more usage indicators for other numeric features */}
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-medium mb-3">Plan Features</h3>
              <div className="space-y-2">
                {renderPlanFeatures(currentPlan.features as Record<string, unknown>)}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2 flex-wrap">
          {!organization.subscription.cancel_at_period_end ? (
            <>
              <Button 
                variant="outline" 
                onClick={handleCancelSubscription}
                disabled={canceling}
                className="sm:w-auto"
              >
                {canceling ? "Canceling..." : "Cancel Subscription"}
              </Button>
              
              {hasStripeSubscription() && (
                <StripePortalButton
                  organizationId={organization.id}
                  variant="outline"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage Payment Details
                </StripePortalButton>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={() => handleChangePlan(currentPlan.id)}
                disabled={changingPlan}
                className="sm:w-auto"
              >
                {changingPlan ? "Updating..." : "Reactivate Subscription"}
              </Button>
              
              {/* Keep showing the portal button for users to verify cancellation */}
              {hasStripeSubscription() && (
                <StripePortalButton
                  organizationId={organization.id}
                  variant="outline"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage Billing
                </StripePortalButton>
              )}
            </>
          )}
        </CardFooter>
      </Card>
    );
  };
  
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-medium">Subscription Plans</h2>
        <p className="text-sm text-muted-foreground">
          Choose a plan that fits your organization&apos;s needs
        </p>
      </div>
      
      {organization?.subscription?.cancel_at_period_end && (
        <Alert className="mb-6 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Your subscription will be canceled on{' '}
            {new Date(organization.subscription.current_period_end).toLocaleDateString()}.
            You can reactivate your subscription by selecting a plan.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Add current plan details section */}
      {renderCurrentPlanDetails()}
      
      <h3 className="text-base font-medium mb-4">Available Plans</h3>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={`relative ${isCurrentPlan(plan.id) ? 'border-primary' : ''}`}>
            {isCurrentPlan(plan.id) && (
              <Badge className="absolute top-3 right-3">Current Plan</Badge>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-2 text-2xl font-bold">
                {formatPrice(plan.price, plan.billing_interval)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {renderPlanFeatures(plan.features as Record<string, unknown>)}
              </div>
            </CardContent>
            <CardFooter>
              {isCurrentPlan(plan.id) ? (
                <>
                  {!organization?.subscription?.cancel_at_period_end && (
                    <Button 
                      variant="outline" 
                      onClick={handleCancelSubscription}
                      disabled={canceling}
                      className="w-full"
                    >
                      {canceling ? "Canceling..." : "Cancel Plan"}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {isPaidPlan(plan) ? (
                    <StripeCheckoutButton
                      planId={plan.id}
                      organizationId={organization!.id}
                      className="w-full"
                      disabled={changingPlan}
                    >
                      {changingPlan ? "Processing..." : `Switch to ${plan.name}`}
                    </StripeCheckoutButton>
                  ) : (
                    <Button
                      onClick={() => handleChangePlan(plan.id)}
                      disabled={changingPlan}
                      className="w-full"
                    >
                      {changingPlan ? "Updating..." : `Switch to ${plan.name}`}
                    </Button>
                  )}
                </>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
} 