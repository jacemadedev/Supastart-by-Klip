'use client'

import { useState } from 'react'
import { useOrganizationContext } from '@/contexts/organization-context'
import { createClient } from '@/lib/supabase/client'
import { errorToast, successToast } from '@/lib/toast'
import { useRouter } from 'next/navigation'

export interface CreditOperationResult {
  success: boolean
  error?: string
}

export function useCreditOperations() {
  const { 
    organization, 
    userRole
  } = useOrganizationContext()
  
  const [isProcessing, setIsProcessing] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  /**
   * Consumes credits from the current organization
   * @param amount Number of credits to use
   * @param description Description of what the credits are being used for
   * @param featureId Optional feature identifier for tracking
   */
  const useCredits = async (
    amount: number, 
    description: string, 
    featureId?: string
  ): Promise<CreditOperationResult> => {
    if (!organization) {
      errorToast("No active organization selected")
      return { success: false, error: "No organization selected" }
    }

    // Prevent concurrent credit operations
    if (isProcessing) {
      errorToast("Another credit operation is in progress")
      return { success: false, error: "Operation in progress" }
    }

    setIsProcessing(true)
    try {
      const orgId = organization.id
      
      // Double-check that we're still connected to the correct organization
      const { data: currentMembership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .eq('organization_id', orgId)
        .maybeSingle()
        
      if (!currentMembership) {
        errorToast("Organization membership could not be verified")
        return { success: false, error: "Membership verification failed" }
      }

      // Use the credits with the verified organization ID
      const { data, error } = await supabase
        .rpc('use_organization_credits_safe', { 
          org_id: orgId,
          amount,
          description,
          feature_id: featureId || null
        })
        
      if (error) throw error
      
      if (!data) {
        errorToast("Insufficient credits")
        return { success: false, error: "Insufficient credits" }
      }

      // Refresh organization data to update credit balance
      const { data: orgData } = await supabase
        .from('organizations')
        .select('credits_balance')
        .eq('id', orgId)
        .single()

      if (orgData && organization) {
        // Force UI refresh by routing to the same page
        router.refresh()
      }
      
      return { success: true }
    } catch (error) {
      console.error("Error using credits:", error)
      errorToast("Failed to use credits")
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Adds credits to the current organization
   * @param amount Number of credits to add
   * @param description Description of why credits are being added
   * @param transactionType Type of credit addition
   */
  const addCredits = async (
    amount: number, 
    description: string, 
    transactionType: 'add' | 'refund' = 'add'
  ): Promise<CreditOperationResult> => {
    if (!organization) {
      errorToast("No active organization selected")
      return { success: false, error: "No organization selected" }
    }

    // Only owners and admins can add credits
    if (userRole !== 'owner' && userRole !== 'admin') {
      errorToast("Only organization owners and admins can add credits")
      return { success: false, error: "Insufficient permissions" }
    }

    // Prevent concurrent credit operations
    if (isProcessing) {
      errorToast("Another credit operation is in progress")
      return { success: false, error: "Operation in progress" }
    }

    setIsProcessing(true)
    try {
      const orgId = organization.id
      
      // Double-check that we're still connected to the correct organization with proper role
      const { data: currentMembership } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .eq('organization_id', orgId)
        .maybeSingle()
        
      if (!currentMembership || !['owner', 'admin'].includes(currentMembership.role)) {
        errorToast("Organization membership or role could not be verified")
        return { success: false, error: "Permission verification failed" }
      }

      // Add the credits with the verified organization ID using the secure admin function
      const { data, error } = await supabase
        .rpc('admin_add_organization_credits', { 
          org_id: orgId,
          amount,
          description,
          transaction_type: transactionType
        })
        
      if (error) throw error
      
      if (!data) {
        errorToast("Failed to add credits")
        return { success: false, error: "Failed to add credits" }
      }

      // Refresh the page to update UI
      router.refresh()
      
      successToast(`Successfully added ${amount} credits`)
      return { success: true }
    } catch (error) {
      console.error("Error adding credits:", error)
      errorToast("Failed to add credits")
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Check if the organization has enough credits for an operation
   * @param amount Number of credits required
   * @returns Boolean indicating if enough credits are available
   */
  const hasEnoughCredits = (amount: number): boolean => {
    if (!organization) return false
    return organization.credits_balance >= amount
  }

  /**
   * Get the current credit balance
   * @returns Current credit balance or 0 if no organization
   */
  const getCreditBalance = (): number => {
    return organization?.credits_balance || 0
  }

  return {
    useCredits,
    addCredits,
    hasEnoughCredits,
    getCreditBalance,
    isProcessing,
    organization
  }
} 