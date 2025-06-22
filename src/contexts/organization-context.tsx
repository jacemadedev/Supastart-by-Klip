'use client'

import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react'
import { 
  Organization, 
  OrganizationMember, 
  organizationService 
} from '@/lib/organization/organization-service'
import { useRouter } from 'next/navigation'
import { errorToast, successToast } from '@/lib/toast'

export interface CreateOrganizationResult {
  success: boolean;
  data?: Organization;
  error?: string;
}

export interface AddMemberResult {
  success: boolean;
  error?: string;
}

export interface RemoveMemberResult {
  success: boolean;
  error?: string;
}

export interface LeaveOrganizationResult {
  success: boolean;
  error?: string;
}

export interface DeleteOrganizationResult {
  success: boolean;
  error?: string;
}

export interface UpdateOrganizationResult {
  success: boolean;
  data?: Organization;
  error?: string;
}

export interface UpdateSubscriptionResult {
  success: boolean;
  error?: string;
}

type OrganizationContextType = {
  organization: Organization | null
  organizations: Organization[]
  members: OrganizationMember[]
  userRole: string | null
  loading: boolean
  membersLoading: boolean
  switchOrganization: (orgId: string) => Promise<{success: boolean, error?: string}>
  updateOrganizationState: () => Promise<void>
  hasRequiredOrganization: () => boolean
  isOwner: boolean
  isAdmin: boolean
  fetchOrganizations: () => Promise<void>
  fetchMembers: () => Promise<void>
  addMember: (email: string, role: 'admin' | 'member') => Promise<AddMemberResult>
  removeMember: (memberId: string) => Promise<RemoveMemberResult>
  updateMemberRole: (memberId: string, newRole: 'owner' | 'admin' | 'member') => Promise<boolean>
  createOrganization: (orgData: { name: string; slug?: string }) => Promise<CreateOrganizationResult>
  updateOrganization: (updates: { 
    name?: string, 
    description?: string, 
    website?: string, 
    logo_url?: string,
    settings?: {
      member_permissions?: Record<string, boolean>
      [key: string]: unknown
    }
  }) => Promise<UpdateOrganizationResult>
  leaveOrganization: () => Promise<LeaveOrganizationResult>
  deleteOrganization: () => Promise<DeleteOrganizationResult>
  updateSubscription: (planId: string) => Promise<UpdateSubscriptionResult>
  cancelSubscription: () => Promise<UpdateSubscriptionResult>
  canUseFeature: (featureName: string) => boolean
  syncCheck: () => Promise<boolean>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(true)
  const router = useRouter()

  // Initialize and load organizations data
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await updateOrganizationState()
      setLoading(false)
    }
    
    init()
    
    // Subscribe to organization changes
    const unsubscribe = organizationService.subscribeToCurrentOrganization(async (org) => {
      if (org) {
        console.log("Organization changed via subscription:", org.name)
        setOrganization(org)
        
        // Fetch members for the new organization
        setMembersLoading(true)
        const members = await organizationService.getOrganizationMembers(org.id)
        setMembers(members)
        
        // Determine user role in this organization
        determineUserRole(members)
        setMembersLoading(false)
      } else {
        // If org is null, reload our state to select a default
        await updateOrganizationState()
      }
    })
    
    // Clean up subscription
    return () => {
      unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Update organization state from database
  const updateOrganizationState = async () => {
    try {
      // Get all organizations the user is a member of
      const orgs = await organizationService.getUserOrganizations()
      setOrganizations(orgs)
      
      if (orgs.length === 0) {
        setOrganization(null)
        setMembers([])
        setUserRole(null)
        return
      }
      
      // Get current organization ID from database
      const currentOrgId = await organizationService.getCurrentOrganizationId()
      
      if (currentOrgId) {
        // Find the org in our list
        const currentOrg = orgs.find(org => org.id === currentOrgId) 
        
        if (currentOrg) {
          setOrganization(currentOrg)
          
          // Fetch members for this organization
          const members = await organizationService.getOrganizationMembers(currentOrg.id)
          setMembers(members)
          
          // Determine user role
          determineUserRole(members)
          return
        }
      }
      
      // If no current org was found or valid, use the first one
      if (orgs.length > 0) {
        const firstOrg = orgs[0]
        setOrganization(firstOrg)
        
        // Also update in database for consistency
        await organizationService.switchOrganization(firstOrg.id)
        
        // Fetch members for this organization
        const members = await organizationService.getOrganizationMembers(firstOrg.id)
        setMembers(members)
        
        // Determine user role
        determineUserRole(members)
      }
    } catch (error) {
      console.error("Error updating organization state:", error)
      errorToast("Failed to load organization data")
    }
  }
  
  // Aliases for updateOrganizationState to maintain compatibility
  const fetchOrganizations = async () => {
    await updateOrganizationState()
  }
  
  const fetchMembers = async () => {
    if (!organization) return
    
    try {
      setMembersLoading(true)
      console.log('Fetching members for organization:', organization.id)
      const members = await organizationService.getOrganizationMembers(organization.id)
      console.log('Fetched members:', members)
      setMembers(members)
      determineUserRole(members)
    } catch (error) {
      console.error("Error fetching members:", error)
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack)
      }
      errorToast("Failed to load organization members")
    } finally {
      console.log('Setting membersLoading to false')
      setMembersLoading(false)
    }
  }
  
  // Determine user role from members list
  const determineUserRole = (membersList: OrganizationMember[]) => {
    try {
      // First get user ID from supabase auth
      const userId = async () => {
        const { data } = await organizationService['supabase'].auth.getUser()
        return data.user?.id
      }
      
      userId().then(id => {
        if (!id) {
          setUserRole(null)
          return
        }
        
        const userMember = membersList.find(m => m.user_id === id)
        if (userMember) {
          setUserRole(userMember.role)
        } else {
          setUserRole(null)
        }
      })
    } catch (error) {
      console.error("Error determining user role:", error)
      setUserRole(null)
    }
  }
  
  // Proxy methods to the organization service
  const addMember = async (email: string, role: 'admin' | 'member'): Promise<AddMemberResult> => {
    if (!organization) return { success: false, error: "No active organization" }
    const result = await organizationService.addMember(organization.id, email, role)
    if (result.success) {
      await fetchMembers()
      successToast(`Invitation sent to ${email}`)
    }
    return result
  }
  
  const removeMember = async (memberId: string): Promise<RemoveMemberResult> => {
    const result = await organizationService.removeMember(memberId)
    if (result.success) {
      await fetchMembers()
      successToast("Member removed successfully")
    }
    return result
  }
  
  const updateMemberRole = async (memberId: string, newRole: 'owner' | 'admin' | 'member'): Promise<boolean> => {
    const result = await organizationService.updateMemberRole(memberId, newRole)
    if (result.success) {
      await fetchMembers()
      successToast("Member role updated successfully")
      return true
    }
    return false
  }
  
  const createOrganization = async (orgData: { name: string, slug?: string }): Promise<CreateOrganizationResult> => {
    const result = await organizationService.createOrganization(orgData)
    if (result.success && result.data) {
      await updateOrganizationState()
      successToast(`Organization "${result.data.name}" created successfully`)
    }
    return result
  }
  
  const updateOrganization = async (updates: { 
    name?: string, 
    description?: string, 
    website?: string, 
    logo_url?: string,
    settings?: {
      member_permissions?: Record<string, boolean>
      [key: string]: unknown
    }
  }): Promise<UpdateOrganizationResult> => {
    if (!organization) return { success: false, error: "No active organization" }
    
    const result = await organizationService.updateOrganization(organization.id, updates)
    if (result.success && result.data) {
      await updateOrganizationState()
      successToast("Organization updated successfully")
    }
    return result
  }
  
  const leaveOrganization = async (): Promise<LeaveOrganizationResult> => {
    if (!organization) return { success: false, error: "No active organization" }
    
    const result = await organizationService.leaveOrganization(organization.id)
    if (result.success) {
      await updateOrganizationState()
      successToast("You have left the organization")
    }
    return result
  }
  
  const deleteOrganization = async (): Promise<DeleteOrganizationResult> => {
    if (!organization) return { success: false, error: "No active organization" }
    
    const result = await organizationService.deleteOrganization(organization.id)
    if (result.success) {
      await updateOrganizationState()
      successToast("Organization deleted successfully")
    }
    return result
  }
  
  // Switch organization with UI refresh
  const switchOrganization = async (orgId: string): Promise<{success: boolean, error?: string}> => {
    try {
      // Change organization in database first
      const result = await organizationService.switchOrganization(orgId)
      
      if (!result.success) {
        return result
      }
      
      // Find the new organization in our list
      const newOrg = organizations.find(org => org.id === orgId)
      if (!newOrg) {
        return { success: false, error: "Organization not found" }
      }
      
      // Update local state
      setOrganization(newOrg)
      
      // Fetch members for the new organization
      setMembersLoading(true)
      const members = await organizationService.getOrganizationMembers(orgId)
      setMembers(members)
      
      // Determine user role in this organization
      determineUserRole(members)
      setMembersLoading(false)
      
      // Refresh the UI
      router.refresh()
      
      return { success: true }
    } catch (error) {
      console.error("Error switching organization:", error)
      errorToast("Failed to switch organization")
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    }
  }
  
  // Subscription methods
  const updateSubscription = async (planId: string): Promise<UpdateSubscriptionResult> => {
    if (!organization) return { success: false, error: "No active organization" }
    
    const result = await organizationService.updateSubscription(organization.id, planId)
    if (result.success) {
      await updateOrganizationState()
      successToast("Subscription updated successfully")
    }
    return result
  }
  
  const cancelSubscription = async (): Promise<UpdateSubscriptionResult> => {
    if (!organization) return { success: false, error: "No active organization" }
    
    const result = await organizationService.cancelSubscription(organization.id)
    if (result.success) {
      await updateOrganizationState()
      successToast("Subscription canceled successfully")
    }
    return result
  }
  
  // Feature check
  const canUseFeature = (featureName: string): boolean => {
    return organizationService.canUseFeature(organization, featureName)
  }
  
  // Legacy sync check for backward compatibility
  const syncCheck = async (): Promise<boolean> => {
    try {
      await updateOrganizationState()
      return true
      } catch (error) {
      console.error("Error during sync check:", error)
      return false
    }
  }
  
  // Check if user has at least one organization
  const hasRequiredOrganization = () => {
    return organizations.length > 0
  }

  const contextValue = {
    organization,
    organizations,
    members,
    userRole,
    loading,
    membersLoading,
    switchOrganization,
    updateOrganizationState,
    hasRequiredOrganization,
    isOwner: userRole === 'owner',
    isAdmin: userRole === 'owner' || userRole === 'admin',
    fetchOrganizations,
    fetchMembers,
    addMember,
    removeMember,
    updateMemberRole,
    createOrganization,
    updateOrganization,
    leaveOrganization,
    deleteOrganization,
    updateSubscription,
    cancelSubscription,
    canUseFeature,
    syncCheck
  }

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganizationContext() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganizationContext must be used within an OrganizationProvider')
  }
  return context
} 