import { createClient } from "@/lib/supabase/client"
import { SupabaseClient } from "@supabase/supabase-js"

export interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  website: string | null
  created_at: string
  updated_at: string
  credits_balance: number
  settings?: {
    member_permissions?: Record<string, boolean>
    cancellation_credits_policy?: string
    [key: string]: unknown
  }
  subscription?: {
    plan_id: string
    plan_name: string
    plan_description: string | null
    plan_features: Record<string, unknown>
    subscription_status: string
    current_period_end: string
    cancel_at_period_end: boolean
  }
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
  updated_at: string
  profiles: {
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

/**
 * OrganizationService - Centralizes all organization operations
 * and ensures database is the single source of truth
 */
class OrganizationService {
  private supabase: SupabaseClient
  private subscriptions: { [key: string]: () => void } = {}

  constructor() {
    this.supabase = createClient()
  }

  /**
   * Get the current user's organization ID from the database
   */
  async getCurrentOrganizationId(): Promise<string | null> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return null

      const { data: profile, error } = await this.supabase
        .from('profiles')
        .select('current_organization_id')
        .eq('id', user.id)
        .single()

      if (error || !profile?.current_organization_id) return null
      return profile.current_organization_id
    } catch (error) {
      console.error("Error getting current organization ID:", error)
      return null
    }
  }

  /**
   * Get a single organization by ID
   */
  async getOrganization(orgId: string): Promise<Organization | null> {
    try {
      const { data, error } = await this.supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single()

      if (error || !data) return null

      // Add subscription data
      const { data: subscriptionData } = await this.supabase
        .rpc('get_organization_plan', { org_id: orgId })

      return {
        ...data,
        subscription: subscriptionData || undefined
      }
    } catch (error) {
      console.error("Error getting organization:", error)
      return null
    }
  }

  /**
   * Get all organizations for the current user
   */
  async getUserOrganizations(): Promise<Organization[]> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await this.supabase
        .from('organizations')
        .select(`
          *,
          organization_members!inner (
            role
          )
        `)
        .eq('organization_members.user_id', user.id)

      if (error || !data) return []

      // Fetch subscription information for each organization
      const orgsWithSubscriptions = await Promise.all(
        data.map(async (org) => {
          const { data: subscriptionData } = await this.supabase
            .rpc('get_organization_plan', { org_id: org.id })
            
          return {
            ...org,
            subscription: subscriptionData || undefined
          }
        })
      )

      return orgsWithSubscriptions
    } catch (error) {
      console.error("Error getting user organizations:", error)
      return []
    }
  }

  /**
   * Switch the current user's organization in the database
   */
  async switchOrganization(orgId: string): Promise<{ success: boolean, error?: string }> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return { success: false, error: "User not authenticated" }

      // Verify the organization exists and user is a member
      const orgs = await this.getUserOrganizations()
      const targetOrg = orgs.find(org => org.id === orgId)
      if (!targetOrg) return { success: false, error: "Organization not found or you are not a member" }

      // Update the profile with the new organization ID
      const { error } = await this.supabase
        .from('profiles')
        .update({ current_organization_id: orgId })
        .eq('id', user.id)

      if (error) return { success: false, error: error.message }
      
      return { success: true }
    } catch (error) {
      console.error("Error switching organization:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }

  /**
   * Subscribe to changes in the current organization
   * Returns a function to unsubscribe
   */
  subscribeToCurrentOrganization(callback: (organization: Organization | null) => void): () => void {
    const channelId = `organization-changes-${Date.now()}`

    // Use realtime subscription to listen for profile changes
    const profileChannel = this.supabase
      .channel(channelId)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: `id=eq.${this.supabase.auth.getUser().then(({ data }) => data.user?.id)}` 
      }, async (payload) => {
        // When profile updates, fetch the new current organization
        const orgId = payload.new.current_organization_id
        
        if (orgId) {
          const org = await this.getOrganization(orgId)
          callback(org)
        } else {
          callback(null)
        }
      })
      .subscribe()

    // Store cleanup function
    this.subscriptions[channelId] = () => {
      this.supabase.removeChannel(profileChannel)
    }

    // Return function to unsubscribe
    return () => {
      if (this.subscriptions[channelId]) {
        this.subscriptions[channelId]()
        delete this.subscriptions[channelId]
      }
    }
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
    try {
      console.log('Getting organization members for:', orgId)
      const { data, error } = await this.supabase
        .from('organization_members_with_profiles')
        .select(`
          id,
          organization_id,
          user_id,
          role,
          created_at,
          updated_at,
          full_name,
          email,
          avatar_url
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error("Supabase error getting organization members:", error)
        return []
      }
      
      if (!data || data.length === 0) {
        console.log('No members found for organization:', orgId)
        return []
      }

      console.log(`Found ${data.length} members for organization:`, orgId)
      
      // Transform the data to match our interface
      return data.map(member => ({
        id: member.id,
        organization_id: member.organization_id,
        user_id: member.user_id,
        role: member.role,
        created_at: member.created_at,
        updated_at: member.updated_at,
        profiles: {
          full_name: member.full_name,
          email: member.email,
          avatar_url: member.avatar_url
        }
      }))
    } catch (error) {
      console.error("Error getting organization members:", error)
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack)
      }
      return []
    }
  }

  /**
   * Clean up all subscriptions
   */
  cleanup() {
    Object.values(this.subscriptions).forEach(unsubscribe => unsubscribe())
    this.subscriptions = {}
  }

  /**
   * Add a member to an organization
   */
  async addMember(orgId: string, email: string, role: 'admin' | 'member'): Promise<{success: boolean, error?: string}> {
    try {
      // Call the add_organization_member RPC function
      const { error } = await this.supabase
        .rpc('add_organization_member', { 
          org_id: orgId, 
          member_email: email, 
          member_role: role 
        })
        
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (error) {
      console.error("Error adding member:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    }
  }

  /**
   * Remove a member from an organization
   */
  async removeMember(memberId: string): Promise<{success: boolean, error?: string}> {
    try {
      const { error } = await this.supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId)
        
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (error) {
      console.error("Error removing member:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    }
  }

  /**
   * Update a member's role in an organization
   */
  async updateMemberRole(memberId: string, newRole: 'owner' | 'admin' | 'member'): Promise<{success: boolean, error?: string}> {
    try {
      const { error } = await this.supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId)
        
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (error) {
      console.error("Error updating member role:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    }
  }

  /**
   * Create a new organization
   */
  async createOrganization(orgData: { name: string, slug?: string }): Promise<{success: boolean, data?: Organization, error?: string}> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return { success: false, error: "User not authenticated" }

      // Create a slug if not provided
      const slug = orgData.slug || orgData.name.toLowerCase().replace(/\s+/g, '-')

      // First create the organization
      const { data: org, error: orgError } = await this.supabase
        .from('organizations')
        .insert({
          name: orgData.name,
          slug: slug,
          credits_balance: 0 // Initial credits balance
        })
        .select()
        .single()

      if (orgError) return { success: false, error: orgError.message }

      // Now add the current user as an owner
      const { error: memberError } = await this.supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: user.id,
          role: 'owner'
        })

      if (memberError) {
        // Clean up the organization if we couldn't add the member
        await this.supabase
          .from('organizations')
          .delete()
          .eq('id', org.id)
          
        return { success: false, error: memberError.message }
      }

      // Set as current organization in profile
      await this.switchOrganization(org.id)

      return { success: true, data: org }
    } catch (error) {
      console.error("Error creating organization:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    }
  }

  /**
   * Leave an organization
   */
  async leaveOrganization(orgId: string): Promise<{success: boolean, error?: string}> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return { success: false, error: "User not authenticated" }

      // Check if user is the only owner
      const { data: members } = await this.supabase
        .from('organization_members')
        .select('id, role, user_id')
        .eq('organization_id', orgId)

      if (!members) return { success: false, error: "Could not fetch members" }

      const owners = members.filter(m => m.role === 'owner')
      const currentUserMember = members.find(m => m.user_id === user.id)

      if (owners.length <= 1 && currentUserMember?.role === 'owner') {
        return { 
          success: false, 
          error: "You cannot leave as you are the only owner. Transfer ownership or delete the organization instead."
        }
      }

      // Find the member record to delete
      const { data: memberData, error: memberError } = await this.supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', user.id)
        .single()

      if (memberError) return { success: false, error: "Could not find your membership record" }

      // Remove the member record
      const { error } = await this.supabase
        .from('organization_members')
        .delete()
        .eq('id', memberData.id)

      if (error) return { success: false, error: error.message }

      return { success: true }
    } catch (error) {
      console.error("Error leaving organization:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    }
  }

  /**
   * Delete an organization
   */
  async deleteOrganization(orgId: string): Promise<{success: boolean, error?: string}> {
    try {
      // First check if current user is an owner
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return { success: false, error: "User not authenticated" }

      const { data: member, error: memberError } = await this.supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', user.id)
        .single()

      if (memberError || !member) return { success: false, error: "Could not verify your role" }
      if (member.role !== 'owner') return { success: false, error: "Only owners can delete organizations" }

      // Delete all member associations first (this is a cascading delete in the DB but we do it explicitly)
      const { error: membersError } = await this.supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', orgId)

      if (membersError) return { success: false, error: `Failed to remove members: ${membersError.message}` }

      // Then delete the organization itself
      const { error: orgError } = await this.supabase
        .from('organizations')
        .delete()
        .eq('id', orgId)

      if (orgError) return { success: false, error: `Failed to delete organization: ${orgError.message}` }

      return { success: true }
    } catch (error) {
      console.error("Error deleting organization:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    }
  }

  /**
   * Update an organization's details
   */
  async updateOrganization(orgId: string, updates: { 
    name?: string, 
    description?: string, 
    website?: string, 
    logo_url?: string,
    settings?: {
      member_permissions?: Record<string, boolean>
      [key: string]: unknown
    }
  }): Promise<{success: boolean, data?: Organization, error?: string}> {
    try {
      // First check if current user is an owner or admin
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return { success: false, error: "User not authenticated" }

      const { data: member, error: memberError } = await this.supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', user.id)
        .single()

      if (memberError || !member) return { success: false, error: "Could not verify your role" }
      if (!['owner', 'admin'].includes(member.role)) return { success: false, error: "Only owners and admins can update organizations" }

      // Update the organization
      const { data: org, error: orgError } = await this.supabase
        .from('organizations')
        .update(updates)
        .eq('id', orgId)
        .select()
        .single()

      if (orgError) return { success: false, error: orgError.message }

      return { success: true, data: org }
    } catch (error) {
      console.error("Error updating organization:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    }
  }

  /**
   * Update an organization's subscription
   */
  async updateSubscription(orgId: string, planId: string): Promise<{success: boolean, error?: string}> {
    try {
      const { error } = await this.supabase
        .rpc('change_subscription_plan', { 
          org_id: orgId, 
          new_plan_id: planId 
        })
        
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (error) {
      console.error("Error updating subscription:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    }
  }

  /**
   * Cancel an organization's subscription
   */
  async cancelSubscription(orgId: string): Promise<{success: boolean, error?: string}> {
    try {
      const { error } = await this.supabase
        .rpc('cancel_subscription', { org_id: orgId })
        
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (error) {
      console.error("Error canceling subscription:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    }
  }

  /**
   * Check if an organization can use a particular feature
   */
  canUseFeature(org: Organization | null, featureName: string): boolean {
    if (!org || !org.subscription) return false
    
    const { plan_features } = org.subscription
    return !!plan_features[featureName]
  }
}

// Export a singleton instance
export const organizationService = new OrganizationService() 