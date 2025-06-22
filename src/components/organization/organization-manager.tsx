'use client'

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, UserPlus, UserCog, ChevronDown, LogOut, Trash, AlertCircle, Pencil } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useOrganizationContext, CreateOrganizationResult, AddMemberResult, RemoveMemberResult, LeaveOrganizationResult, DeleteOrganizationResult, UpdateOrganizationResult } from "@/contexts/organization-context"
import { OrganizationSetup } from "@/components/onboarding/organization-setup"
import { errorToast, successToast } from "@/lib/toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function OrganizationManager({
  showOnboardingDialog,
  onOpenChange
}: {
  showOnboardingDialog: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const {
    organization,
    organizations,
    members,
    membersLoading,
    isOwner,
    isAdmin,
    loading: orgLoading,
    switchOrganization,
    addMember,
    removeMember,
    updateMemberRole,
    createOrganization,
    leaveOrganization,
    deleteOrganization,
    canUseFeature,
    fetchMembers,
    updateOrganization
  } = useOrganizationContext()

  const [isSaving, setIsSaving] = useState(false)
  const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = useState(false)
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false)
  const [isLeaveOrgDialogOpen, setIsLeaveOrgDialogOpen] = useState(false)
  const [isDeleteOrgDialogOpen, setIsDeleteOrgDialogOpen] = useState(false)
  const [emailToAdd, setEmailToAdd] = useState("")
  const [roleToAdd, setRoleToAdd] = useState<"admin" | "member">("member")
  const [orgError, setOrgError] = useState<string>("")
  
  // Add a ref to track if we've already fetched members
  const hasFetchedMembersRef = useRef(false)
  
  const [isEditOrgDialogOpen, setIsEditOrgDialogOpen] = useState(false)
  
  // Fetch members when the component mounts if we have an organization
  useEffect(() => {
    if (organization && !hasFetchedMembersRef.current) {
      hasFetchedMembersRef.current = true
      fetchMembers()
    }
  }, [organization, fetchMembers])

  const handleCreateOrg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      const formData = new FormData(e.currentTarget)
      const name = formData.get("org_name") as string
      
      const result: CreateOrganizationResult = await createOrganization({ name })
      
      if (result.success) {
        setIsCreateOrgDialogOpen(false)
      } else if (result.error) {
        errorToast(result.error)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      const result: AddMemberResult = await addMember(emailToAdd, roleToAdd)
      if (result.success) {
        setEmailToAdd("")
        setRoleToAdd("member")
        setIsAddMemberDialogOpen(false)
      } else if (result.error) {
        errorToast(result.error)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleOnboardingCreate = async (name: string) => {
    setIsSaving(true)
    setOrgError("")
    
    const result: CreateOrganizationResult = await createOrganization({ name })
    
    if (result.success) {
      if (onOpenChange) {
        onOpenChange(false);
      }
      return true
    }
    
    if (result.error) {
      setOrgError(result.error)
    }
    
    setIsSaving(false)
    return false
  }

  const handleLeaveOrganization = async () => {
    setIsSaving(true)
    try {
      const result: LeaveOrganizationResult = await leaveOrganization()
      if (result.success) {
        setIsLeaveOrgDialogOpen(false)
        successToast("You have left the organization")
      } else if (result.error) {
        errorToast(result.error)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteOrganization = async () => {
    setIsSaving(true)
    try {
      const result: DeleteOrganizationResult = await deleteOrganization()
      if (result.success) {
        setIsDeleteOrgDialogOpen(false)
        successToast("Organization deleted successfully")
      } else if (result.error) {
        errorToast(result.error)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    const result: RemoveMemberResult = await removeMember(memberId)
    if (!result.success && result.error) {
      errorToast(result.error)
    }
  }

  const handleOnboardingClose = () => {
    if (onOpenChange) {
      onOpenChange(false);
    }
  }

  const handleUpdateOrganization = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      const formData = new FormData(e.currentTarget)
      const name = formData.get("org_name") as string
      
      const result: UpdateOrganizationResult = await updateOrganization({ name })
      
      if (result.success) {
        setIsEditOrgDialogOpen(false)
        successToast("Organization updated successfully")
      } else if (result.error) {
        errorToast(result.error)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Organizations</h2>
          <p className="text-sm text-muted-foreground">
            Manage your organizations and team members.
          </p>
        </div>
        <Button onClick={() => setIsCreateOrgDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Organization
        </Button>
      </div>
      
      {!orgLoading && organizations.length === 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-primary">
          <h3 className="font-medium mb-1">Welcome to SupaStart!</h3>
          <p className="text-sm">Please create your first organization to unlock the rest of the dashboard features.</p>
        </div>
      )}
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Organization</CardTitle>
            <CardDescription>
              Manage your organization and team members
            </CardDescription>
          </div>
          {organizations.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  {organization?.name || "Select Organization"}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {organizations.map((org) => (
                  <DropdownMenuItem 
                    key={org.id}
                    onClick={async () => {
                      const result = await switchOrganization(org.id);
                      if (!result.success) {
                        console.error("Failed to switch organization:", result.error);
                      }
                    }}
                    className={org.id === organization?.id ? "bg-accent" : ""}
                  >
                    {org.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsLeaveOrgDialogOpen(true)}
                  className="text-orange-500 hover:text-orange-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Leave Organization
                </DropdownMenuItem>
                {isOwner && (
                  <DropdownMenuItem
                    onClick={() => setIsDeleteOrgDialogOpen(true)}
                    className="text-destructive hover:text-destructive/90"
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Delete Organization
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Organization Details Section */}
            <div>
              <h3 className="text-lg font-medium mb-4">Organization Details</h3>
              <div className="space-y-4">
                {organizations.length === 0 ? (
                  <div className="rounded-md bg-muted p-4">
                    <div className="text-sm">
                      You don&apos;t have any organizations yet. Create one to get started.
                    </div>
                  </div>
                ) : organization ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium mb-1">Name</h3>
                      <div className="flex items-center">
                        <p className="text-sm text-muted-foreground">{organization.name}</p>
                        {(isOwner || isAdmin) && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="ml-2 h-6 w-6 p-0" 
                            onClick={() => setIsEditOrgDialogOpen(true)}
                          >
                            <Pencil className="h-3 w-3" />
                            <span className="sr-only">Edit organization name</span>
                          </Button>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-1">Slug</h3>
                      <p className="text-sm text-muted-foreground">{organization.slug}</p>
                    </div>
                    {/* Add more organization details here as needed */}
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Organizations List Section */}
            {organizations.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Your Organizations</h3>
                  <Button
                    size="sm"
                    onClick={() => setIsCreateOrgDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Organization
                  </Button>
                </div>
                <div className="border rounded-md divide-y">
                  {organizations.map((org) => (
                    <div key={org.id} className="p-4 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {org.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {org.slug}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {org.id === organization?.id ? (
                          <div className="px-2 py-1 text-xs rounded-full bg-primary text-primary-foreground">
                            Active
                          </div>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={async () => {
                              const result = await switchOrganization(org.id);
                              if (!result.success) {
                                console.error("Failed to switch organization:", result.error);
                              }
                            }}
                          >
                            Switch
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Organization Members Section */}
            {organization && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Members</h3>
                  {(isOwner || isAdmin) && (
                    <Button
                      size="sm"
                      onClick={() => setIsAddMemberDialogOpen(true)}
                      disabled={!canUseFeature('max_members')}
                      title={!canUseFeature('max_members') ? "Upgrade your plan to add more members" : ""}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Member
                    </Button>
                  )}
                </div>

                {!canUseFeature('max_members') && (
                  <Alert className="mb-4 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      You&apos;ve reached your plan&apos;s member limit. <a href="/dashboard/billing" className="font-medium underline">Upgrade your plan</a> to add more members.
                    </AlertDescription>
                  </Alert>
                )}

                {membersLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="border rounded-md divide-y">
                    {members.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">
                        No members found
                      </div>
                    ) : (
                      members.map((member) => (
                        <div key={member.id} className="p-4 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {member.profiles?.full_name || member.profiles?.email || 'Unknown user'}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {member.profiles?.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`px-2 py-1 text-xs rounded-full ${
                              member.role === 'owner' 
                                ? 'bg-primary text-primary-foreground' 
                                : member.role === 'admin' 
                                ? 'bg-secondary text-secondary-foreground' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {member.role}
                            </div>
                            
                            {(isOwner || (isAdmin && member.role !== 'owner')) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <UserCog className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {isOwner && member.role !== 'owner' && (
                                    <DropdownMenuItem
                                      onClick={() => updateMemberRole(member.id, 'owner')}
                                    >
                                      Make Owner
                                    </DropdownMenuItem>
                                  )}
                                  {(isOwner || (isAdmin && member.role === 'member')) && member.role !== 'admin' && (
                                    <DropdownMenuItem
                                      onClick={() => updateMemberRole(member.id, 'admin')}
                                    >
                                      Make Admin
                                    </DropdownMenuItem>
                                  )}
                                  {(isOwner || isAdmin) && member.role !== 'member' && (
                                    <DropdownMenuItem
                                      onClick={() => updateMemberRole(member.id, 'member')}
                                    >
                                      Make Member
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleRemoveMember(member.id)}
                                  >
                                    Remove Member
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Dialog open={isCreateOrgDialogOpen} onOpenChange={setIsCreateOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to collaborate with others.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateOrg} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="org_name" className="text-sm font-medium">
                Organization Name
              </label>
              <Input
                id="org_name"
                name="org_name"
                placeholder="Enter organization name"
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOrgDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Add a new member to your organization.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter user email"
                value={emailToAdd}
                onChange={(e) => setEmailToAdd(e.target.value)}
                required
              />
              <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm text-primary font-medium">
                  Important: User must have an existing account
                </p>
                <p className="text-xs text-primary/80 mt-1">
                  The email address must belong to a registered user. If they haven&apos;t signed up yet, please ask them to create an account first.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium">
                Role
              </label>
              <div className="border rounded-md">
                <div className="flex">
                  <button
                    type="button"
                    className={`flex-1 p-2 text-sm ${roleToAdd === 'admin' ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'}`}
                    onClick={() => setRoleToAdd('admin')}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    className={`flex-1 p-2 text-sm ${roleToAdd === 'member' ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'}`}
                    onClick={() => setRoleToAdd('member')}
                  >
                    Member
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Admins can manage members and organization settings. Members have basic access.
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddMemberDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Member
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <OrganizationSetup 
        isDialog={true}
        isOpen={showOnboardingDialog}
        onClose={handleOnboardingClose}
        onCreate={handleOnboardingCreate}
        title="Create Your First Organization"
        description="You'll need an organization to get started with SupaStart."
        error={orgError}
      />

      {/* Leave Organization Dialog */}
      <Dialog open={isLeaveOrgDialogOpen} onOpenChange={setIsLeaveOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Organization</DialogTitle>
            <DialogDescription>
              You are about to leave {organization?.name}. You will lose access to all resources in this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                This action cannot be undone. You will need to be invited back to rejoin this organization.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsLeaveOrgDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleLeaveOrganization}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Leave Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Dialog */}
      <Dialog open={isDeleteOrgDialogOpen} onOpenChange={setIsDeleteOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              You are about to delete {organization?.name}. All data associated with this organization will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                This action cannot be undone. All members will lose access to the organization and its resources.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOrgDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteOrganization}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog open={isEditOrgDialogOpen} onOpenChange={setIsEditOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update your organization details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateOrganization} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="org_name" className="text-sm font-medium">
                Organization Name
              </label>
              <Input
                id="org_name"
                name="org_name"
                placeholder="Enter organization name"
                defaultValue={organization?.name}
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOrgDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
} 