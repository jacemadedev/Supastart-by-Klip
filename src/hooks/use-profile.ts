import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { errorToast, successToast, promiseToast, loadingToast } from "@/lib/toast"
import { useRouter } from "next/navigation"
import type { PostgrestError } from "@supabase/supabase-js"
import { toast } from "sonner"

export interface Profile {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  website: string | null
  email: string
}

export interface DeleteAccountResult {
  success: boolean;
  error?: string;
  blockedByOwnedOrganizations?: string[];
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user found")

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (error) {
        // If profile doesn't exist, create one
        if (error.code === 'PGRST116' && error.message.includes('no rows')) {
          console.log('Profile missing, attempting to create one')
          
          // Create a new profile with minimal information to avoid foreign key issues
          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .insert([{ 
              id: user.id, 
              email: user.email,
              // Don't set organization-related fields until the user joins or creates an org
            }])
            .select()
            .single()
            
          if (createError) {
            console.error("Failed to create profile:", createError)
            throw createError
          }
          
          console.log("Profile created successfully:", newProfile)
          setProfile(newProfile)
          return
        }
        throw error
      }
      setProfile(data)
    } catch (error) {
      console.error("Error fetching profile:", error instanceof Error ? error.message : error)
      errorToast("Error fetching profile", {
        duration: 3000,
        position: 'top-center'
      })
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user found")

      // Log the update attempt
      console.log("Attempting to update profile with:", updates)

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single()

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      console.log("Profile update response:", data)

      setProfile(prev => prev ? { ...prev, ...updates } : null)
      successToast("Profile updated successfully")
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error("Error updating profile:", {
        message: errorMessage,
        error,
        updates
      })
      errorToast("Failed to update profile", {
        duration: 3000,
        position: 'top-center'
      })
      return false
    }
  }

  const uploadAvatar = async (file: File) => {
    return promiseToast(
      (async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("No user found")

        const fileExt = file.name.split(".").pop()
        const filePath = `${user.id}/avatar.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, file, { upsert: true })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath)

        const success = await updateProfile({ avatar_url: publicUrl })
        if (!success) throw new Error("Failed to update profile with avatar URL")

        return true
      })(),
      {
        loading: "Uploading avatar...",
        success: "Avatar updated successfully",
        error: "Failed to upload avatar"
      }
    )
  }

  const deleteAccount = async (transferOwnership?: {orgId: string, newOwnerId: string}[]): Promise<DeleteAccountResult> => {
    const deleteAccountToastId = "delete-account-toast"
    try {
      loadingToast("Deleting your account...", { id: deleteAccountToastId })
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.dismiss(deleteAccountToastId)
        return { success: false, error: "No user found" }
      }

      // Check if user owns any organizations
      type OwnedOrgResult = {
        organization_id: string;
        organizations: {
          name: string;
        };
      };

      const { data: ownedOrgs, error: orgsError } = await supabase
        .from('organization_members')
        .select(`
          organization_id,
          organizations:organization_id (
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('role', 'owner') as { data: OwnedOrgResult[] | null, error: PostgrestError | null };

      if (orgsError) {
        return { success: false, error: "Failed to check organization ownership" }
      }

      // If user owns organizations and no transfer plan is provided, prevent deletion
      if (ownedOrgs && ownedOrgs.length > 0 && (!transferOwnership || transferOwnership.length === 0)) {
        const orgNames = ownedOrgs.map(org => org.organizations.name);
        return { 
          success: false, 
          error: "You are the owner of one or more organizations. You must transfer ownership before deleting your account.",
          blockedByOwnedOrganizations: orgNames
        }
      }

      // If transfer plan is provided, execute transfers
      if (transferOwnership && transferOwnership.length > 0) {
        for (const transfer of transferOwnership) {
          // Check if the user is actually the owner of this org
          const isOwner = ownedOrgs?.some(org => org.organization_id === transfer.orgId);
          if (!isOwner) {
            return { success: false, error: `You're not the owner of one of the organizations you're trying to transfer` }
          }

          // Check if new owner is a member
          const { data: newOwnerData, error: newOwnerError } = await supabase
            .from('organization_members')
            .select('id')
            .eq('organization_id', transfer.orgId)
            .eq('user_id', transfer.newOwnerId)
            .single()
          
          if (newOwnerError || !newOwnerData) {
            return { success: false, error: `New owner not found in the organization` }
          }

          // Update the role to owner
          const { error: transferError } = await supabase
            .from('organization_members')
            .update({ role: 'owner' })
            .eq('id', newOwnerData.id)
          
          if (transferError) {
            return { success: false, error: `Failed to transfer ownership: ${transferError.message}` }
          }

          // Change the current user's role to member
          const { data: myMembershipData, error: myMembershipError } = await supabase
            .from('organization_members')
            .select('id')
            .eq('organization_id', transfer.orgId)
            .eq('user_id', user.id)
            .single()
          
          if (myMembershipError || !myMembershipData) {
            return { success: false, error: `Failed to update your role` }
          }

          const { error: roleChangeError } = await supabase
            .from('organization_members')
            .update({ role: 'member' })
            .eq('id', myMembershipData.id)
          
          if (roleChangeError) {
            return { success: false, error: `Failed to update your role: ${roleChangeError.message}` }
          }
        }
      }

      // Remove user from all organizations
      const { error: membersError } = await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', user.id)

      if (membersError) {
        return { success: false, error: `Failed to remove from organizations: ${membersError.message}` }
      }

      // Now delete the user
      const response = await fetch('/api/auth/delete-user', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.dismiss(deleteAccountToastId)
        return { success: false, error: errorData.error || "Failed to delete user" }
      }

      toast.dismiss(deleteAccountToastId)
      successToast("Your account has been deleted")
      router.push('/signin')
      supabase.auth.signOut()
      return { success: true }
    } catch (error) {
      console.error("Error deleting account:", error)
      toast.dismiss(deleteAccountToastId)
      return { success: false, error: error instanceof Error ? error.message : "Unknown error occurred" }
    }
  }

  return {
    profile,
    loading,
    updateProfile,
    uploadAvatar,
    deleteAccount
  }
} 