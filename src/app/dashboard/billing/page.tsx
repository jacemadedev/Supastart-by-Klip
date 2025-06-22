"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Wallet, Loader2 } from "lucide-react"
import { SubscriptionManager } from "@/components/billing/subscription-manager"
import { useOrganizationContext } from "@/contexts/organization-context"
import { createClient } from "@/lib/supabase/client"
import dynamic from 'next/dynamic'
import { errorToast, successToast } from "@/lib/toast"
import { useSearchParams, useRouter } from 'next/navigation'
import { Skeleton } from "@/components/ui/skeleton"

// Dynamically import the CreditManager
const CreditManager = dynamic(() => import('@/components/billing/credit-manager').then(mod => ({ default: mod.CreditManager })), {
  loading: () => <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>,
  ssr: false
})

function BillingPageContent() {
  const {
    organization,
    organizations,
    fetchOrganizations,
    switchOrganization,
  } = useOrganizationContext()
  
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')
  const orgId = searchParams.get('org_id')
  const router = useRouter()
  
  // Use a ref to track if we've already handled this success notification
  const successHandledRef = useRef(false)

  // Use organization data
  const [creditTransactions, setCreditTransactions] = useState<Array<{
    id: string;
    organization_id: string;
    amount: number;
    description: string | null;
    created_at: string;
    transaction_type: 'add' | 'use' | 'refund';
  }>>([])
  const [creditLoading, setCreditLoading] = useState(false)
  
  // Keep track of current credit balance locally
  const [currentCreditBalance, setCurrentCreditBalance] = useState<number>(0)
  
  // Restore organization context from checkout
  useEffect(() => {
    const restoreCheckoutContext = async () => {
      // Try to get organization ID from URL parameters first
      if (orgId && organizations.length > 0) {
        const targetOrg = organizations.find(org => org.id === orgId);
        if (targetOrg && (!organization || organization.id !== orgId)) {
          console.log("Restoring organization from URL parameter:", targetOrg.name);
          await switchOrganization(orgId);
          return true;
        }
      }
      
      return false;
    };
    
    if (organizations.length > 0) {
      restoreCheckoutContext();
    }
  }, [organizations, organization, orgId, switchOrganization]);
  
  // Function to fetch credit data
  const fetchCreditData = useCallback(async () => {
    if (!organization) return
    
    setCreditLoading(true)
    try {
      // Use supabase directly
      const supabase = createClient()
      const { data, error } = await supabase
        .rpc('get_organization_credit_history', { 
          org_id: organization.id,
          limit_count: 50 
        })
        
      if (error) throw error
      setCreditTransactions(data || [])
    } catch (error: unknown) {
      console.error("Error fetching credit history:", error)
      errorToast("Failed to fetch credit history")
    } finally {
      setCreditLoading(false)
    }
  }, [organization])
  
  // Handle Stripe checkout return
  useEffect(() => {
    // Only handle success/canceled once, and then clear the URL parameters
    if (success === 'true' && !successHandledRef.current) {
      successHandledRef.current = true
      
      // Refresh organization data to get updated subscription
      fetchOrganizations()
        .then(() => {
          successToast('Subscription updated successfully')
          // Remove success param from URL to prevent infinite loops
          router.replace('/dashboard/billing')
        })
        .catch((error) => {
          console.error('Failed to refresh organization data:', error)
          router.replace('/dashboard/billing')
        })
    } else if (canceled === 'true' && !successHandledRef.current) {
      successHandledRef.current = true
      errorToast('Checkout was canceled')
      router.replace('/dashboard/billing')
    }
  }, [success, canceled, fetchOrganizations, router])
  
  // Update local credit balance when organization changes
  useEffect(() => {
    if (organization) {
      setCurrentCreditBalance(organization.credits_balance)
      fetchCreditData()
    }
  }, [organization, fetchCreditData])

  if (!organization) {
    return <BillingPageSkeleton />
  }

  return (
    <div className="container py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and credits</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle>Subscription Plans</CardTitle>
          </div>
          <CardDescription>
            Manage your subscription plan and billing details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriptionManager />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            <CardTitle>Credits</CardTitle>
          </div>
          <CardDescription>
            Manage your organization credits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreditManager 
            credits={currentCreditBalance}
            isActiveOrg={true}
            transactions={creditTransactions.map(t => ({
              id: t.id,
              amount: t.amount,
              description: t.description || "",
              createdAt: t.created_at,
              type: t.transaction_type === 'add' || t.transaction_type === 'refund' ? 'add' : 'use'
            }))}
            loading={creditLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}

// Add skeleton component
function BillingPageSkeleton() {
  return (
    <div className="container py-10 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      
      <div className="grid gap-8">
        {/* Subscription card skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-10 w-24" />
            </div>
            <Skeleton className="h-0.5 w-full" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
        
        {/* Billing history skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array(3).fill(null).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Replace the Suspense fallback with the skeleton component
export default function BillingPage() {
  return (
    <Suspense fallback={<BillingPageSkeleton />}>
      <BillingPageContent />
    </Suspense>
  )
} 