import { SupabaseClient } from '@supabase/supabase-js'

export interface CreditCheckResult {
  success: boolean
  error?: string
  newBalance?: number
}

/**
 * Checks if an organization has sufficient credits and deducts them if available
 * This uses the use_organization_credits_safe RPC function which handles the transaction atomically with proper authorization
 */
export async function checkAndDeductCredits(
  supabase: SupabaseClient,
  organizationId: string,
  creditsRequired: number,
  description: string = 'API usage',
  featureId?: string
): Promise<CreditCheckResult> {
  try {
    // Call the SAFE RPC function that atomically checks and deducts credits with authorization
    const { data, error } = await supabase
      .rpc('use_organization_credits_safe', {
        org_id: organizationId,
        amount: creditsRequired,
        description,
        feature_id: featureId || null
      })
    
    if (error) {
      return {
        success: false,
        error: error.message
      }
    }
    
    if (data === false) {
      return {
        success: false,
        error: 'Insufficient credits'
      }
    }
    
    // Get the new balance
    const { data: orgData } = await supabase
      .from('organizations')
      .select('credits_balance')
      .eq('id', organizationId)
      .single()
    
    return {
      success: true,
      newBalance: orgData?.credits_balance
    }
  } catch (error) {
    console.error('Error deducting credits:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Helper function to get user and organization in API routes
 */
export async function getUserAndOrganization(supabase: SupabaseClient) {
  try {
    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log("GET_ORG - User authentication:", {
      success: !userError && !!user,
      userId: user?.id,
      timestamp: new Date().toISOString()
    })
    
    if (userError || !user) {
      return { 
        success: false, 
        error: 'Unauthorized', 
        status: 401 
      }
    }
    
    // Get user's organization from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('current_organization_id')
      .eq('id', user.id)
      .single()
    
    console.log("GET_ORG - Profile lookup result:", {
      hasProfile: !profileError && !!profile,
      currentOrgId: profile?.current_organization_id,
      profileError: profileError?.message,
      timestamp: new Date().toISOString()
    })
    
    // If the profile has a current organization ID, validate it still exists
    if (!profileError && profile?.current_organization_id) {
      // Check that the user is still a member of this organization
      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', profile.current_organization_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      console.log("GET_ORG - Current org membership check:", {
        organizationId: profile.current_organization_id,
        isMember: !membershipError && !!membership,
        membershipError: membershipError?.message,
        timestamp: new Date().toISOString()
      })
      
      if (!membershipError && membership) {
        // The user is still a member of this organization, use it
        console.log("GET_ORG - Using current org from profile:", profile.current_organization_id)
        return {
          success: true,
          user,
          organizationId: profile.current_organization_id
        }
      }
      
      // The stored organization is invalid, we'll need to update it
      console.warn('GET_ORG - User has invalid current_organization_id, finding a new one')
    }
    
    // If no current organization is set or there was a profile error, 
    // or the current organization is invalid,
    // get the first organization the user belongs to
    const { data: organizations, error: orgsError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
    
    console.log("GET_ORG - Fallback org lookup result:", {
      hasOrgs: !orgsError && !!organizations && organizations.length > 0,
      firstOrgId: organizations?.[0]?.organization_id,
      orgsError: orgsError?.message,
      timestamp: new Date().toISOString()
    })
    
    if (orgsError || !organizations || organizations.length === 0) {
      return { 
        success: false, 
        error: 'No organizations found. Please create or join an organization.', 
        status: 400 
      }
    }
    
    // Use the first organization
    const organizationId = organizations[0].organization_id
    
    // Update the user's profile with this organization as current
    try {
      console.log("GET_ORG - Updating profile with new current org:", organizationId)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ current_organization_id: organizationId })
        .eq('id', user.id)
      
      if (updateError) {
        console.error('GET_ORG - Error updating current organization:', updateError)
        // Try once more after a short delay
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const { error: retryError } = await supabase
          .from('profiles')
          .update({ current_organization_id: organizationId })
          .eq('id', user.id)
          
        if (retryError) {
          console.error('GET_ORG - Retry failed to update current organization:', retryError)
        } else {
          console.log('GET_ORG - Retry succeeded in updating current organization')
        }
      } else {
        console.log('GET_ORG - Successfully updated current organization')
      }
    } catch (updateError) {
      console.error('GET_ORG - Exception updating current organization:', updateError)
      // Continue anyway - we'll use this org for now
    }
    
    console.log("GET_ORG - Final organization selection:", organizationId)
    return {
      success: true,
      user,
      organizationId
    }
  } catch (error) {
    console.error('GET_ORG - Error getting user and organization:', error)
    return {
      success: false,
      error: 'Server error',
      status: 500
    }
  }
} 