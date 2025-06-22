"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useProfile } from "@/hooks/use-profile"
import { Loader2, AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ChangePasswordForm } from "@/components/auth-components/change-password-form"
import { useOrganizationContext } from "@/contexts/organization-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { SubscriptionManager } from "@/components/billing/subscription-manager"
import { OrganizationManager } from '@/components/organization/organization-manager'
import { PermissionManager } from "@/components/organization/permission-manager"
import { Skeleton } from "@/components/ui/skeleton"

// Skeleton component for the Settings page
function SettingsPageSkeleton() {
  return (
    <div className="container py-10 space-y-10">
      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            {Array(4).fill(null).map((_, i) => (
              <div key={i} className="grid gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-36" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsPageContent() {
  const { profile, loading: profileLoading, updateProfile, deleteAccount } = useProfile()
  const {
    organization,
    organizations,
    loading: orgLoading,
    fetchMembers
  } = useOrganizationContext()

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tabParam = searchParams.get('tab')
  
  const [isSaving, setIsSaving] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false)
  const [showOnboardingDialog, setShowOnboardingDialog] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState<string>("")
  const [blockedByOrganizations, setBlockedByOrganizations] = useState<string[]>([])
  
  // Active tab state - initialize with default but don't directly use tabParam
  const [activeTab, setActiveTab] = useState('organization')
  
  // Sync activeTab with URL parameter
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])
  
  // Add a ref to track if we've already fetched members
  const hasFetchedMembersRef = useRef(false)
  
  // Fetch members when the organization tab is selected
  useEffect(() => {
    const loadMembers = async () => {
      if (organization && activeTab === 'organization' && !hasFetchedMembersRef.current) {
        hasFetchedMembersRef.current = true;
        
        try {
          await fetchMembers();
        } catch (error) {
          console.error("Error fetching members:", error);
        }
      }
    };
    
    loadMembers();
    
    // No cleanup needed
    return () => {};
  }, [organization, activeTab, fetchMembers]);

  // Reset the ref when tab changes away from organization
  useEffect(() => {
    if (activeTab !== 'organization') {
      hasFetchedMembersRef.current = false
    }
  }, [activeTab])

  useEffect(() => {
    if (!orgLoading && organizations.length === 0) {
      setShowOnboardingDialog(true)
    }
  }, [orgLoading, organizations])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    
    const formData = new FormData(e.currentTarget)
    const updates = {
      full_name: formData.get("full_name") as string,
      username: formData.get("username") as string,
      website: formData.get("website") as string,
    }
    
    await updateProfile(updates)
    setIsSaving(false)
  }

  const handleInitiateDeleteAccount = async () => {
    setDeleteAccountError("")
    setBlockedByOrganizations([])
    setIsSaving(true)
    
    try {
      const result = await deleteAccount()
      
      if (!result.success) {
        setDeleteAccountError(result.error || "Failed to delete account")
        if (result.blockedByOwnedOrganizations && result.blockedByOwnedOrganizations.length > 0) {
          setBlockedByOrganizations(result.blockedByOwnedOrganizations)
        }
      }
      // If successful, page will redirect as handled in deleteAccount function
    } catch (error) {
      setDeleteAccountError(error instanceof Error ? error.message : "An unexpected error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle tab change and update URL
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    
    // Update URL to reflect the selected tab
    const params = new URLSearchParams(searchParams)
    params.set('tab', value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  if (profileLoading || orgLoading || !profile) {
    return <SettingsPageSkeleton />
  }

  return (
    <div className="container py-10 space-y-10">
      <Tabs defaultValue={activeTab} className="w-full" onValueChange={handleTabChange}>
        <TabsList className="mb-8">
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                This information will be displayed publicly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <label htmlFor="full_name" className="text-sm font-medium">
                      Full Name
                    </label>
                    <Input
                      id="full_name"
                      name="full_name"
                      defaultValue={profile.full_name || ""}
                      placeholder="Your full name"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <label htmlFor="username" className="text-sm font-medium">
                      Username
                    </label>
                    <Input
                      id="username"
                      name="username"
                      defaultValue={profile.username || ""}
                      placeholder="your-username"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="email"
                      name="email"
                      value={profile.email}
                      disabled
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <label htmlFor="website" className="text-sm font-medium">
                      Website
                    </label>
                    <Input
                      id="website"
                      name="website"
                      defaultValue={profile.website || ""}
                      placeholder="https://your-website.com"
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPasswordDialogOpen(true)}
                  >
                    Change Password
                  </Button>
                  
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions that affect your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-medium">Delete Account</h3>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setIsDeleteAccountDialogOpen(true)}
                  >
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="organization" className="space-y-8">
          <OrganizationManager 
            showOnboardingDialog={showOnboardingDialog}
            onOpenChange={(open) => setShowOnboardingDialog(open)}
          />
          
          {organization && (
            <PermissionManager />
          )}
        </TabsContent>
        
        <TabsContent value="billing" className="space-y-8">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold">Billing & Subscription</h2>
              <p className="text-sm text-muted-foreground">
                Manage your subscription plan and billing details
              </p>
            </div>
          </div>
          
          {organization ? (
            <SubscriptionManager />
          ) : (
            <Card>
              <CardContent className="py-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <div className="flex justify-end">
                    <Skeleton className="h-10 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <ChangePasswordForm 
            onSuccess={() => setIsPasswordDialogOpen(false)}
            onCancel={() => setIsPasswordDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={isDeleteAccountDialogOpen} onOpenChange={setIsDeleteAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">Delete Account</DialogTitle>
            <DialogDescription>
              This action is irreversible. All your data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          
          {deleteAccountError && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {deleteAccountError}
                
                {blockedByOrganizations.length > 0 && (
                  <div className="mt-2">
                    <p>You are the owner of these organizations:</p>
                    <ul className="list-disc list-inside mt-1">
                      {blockedByOrganizations.map((org, index) => (
                        <li key={index}>{org}</li>
                      ))}
                    </ul>
                    <p className="mt-1">
                      Please transfer ownership or delete these organizations first.
                    </p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteAccountDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleInitiateDeleteAccount}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <SettingsPageContent />
    </Suspense>
  )
} 