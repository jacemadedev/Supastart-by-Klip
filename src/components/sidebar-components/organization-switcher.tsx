"use client"

import { Building, ChevronDown, Plus, RefreshCw } from "lucide-react"
import { useOrganizationContext } from "@/contexts/organization-context"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Image from "next/image"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/dashboard-components/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { successToast } from "@/lib/toast"

export function OrganizationSwitcher() {
  const { 
    organization,
    organizations,
    switchOrganization,
    updateOrganizationState,
    loading
  } = useOrganizationContext()
  
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  // Generate org initials for the avatar
  const getOrgInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleCreateOrg = () => {
    // Redirect to settings page organization tab where the create org UI already exists
    router.push('/dashboard/settings?tab=organization')
  }
  
  const handleSyncCheck = async () => {
    setSyncing(true)
    try {
      await updateOrganizationState()
      successToast("Organization synchronized successfully")
    } finally {
      setSyncing(false)
    }
  }

  if (loading || !organization) {
    return (
      <SidebarMenu className="px-2 mb-1">
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <div className="bg-sidebar-accent flex aspect-square size-8 items-center justify-center rounded-lg animate-pulse"></div>
            <div className="grid flex-1 gap-1">
              <div className="h-4 w-24 animate-pulse rounded bg-sidebar-accent"></div>
              <div className="h-3 w-16 animate-pulse rounded bg-sidebar-accent"></div>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const currentOrgInitials = getOrgInitials(organization.name)

  return (
    <SidebarMenu className="px-2 mb-1">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                {organization.logo_url ? (
                  <div className="relative h-full w-full rounded-lg overflow-hidden">
                    <Image 
                      src={organization.logo_url} 
                      alt={organization.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <span className="font-medium">{currentOrgInitials}</span>
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{organization.name}</span>
                <span className="truncate text-xs">{organizations.length} organization{organizations.length !== 1 ? 's' : ''}</span>
              </div>
              <ChevronDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg p-1"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            {/* Organizations List */}
            <div className="max-h-[300px] overflow-y-auto">
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={async () => {
                    setSyncing(true)
                    try {
                      const result = await switchOrganization(org.id)
                      if (!result.success) {
                        console.error("Failed to switch organization:", result.error)
                      }
                    } finally {
                      setSyncing(false)
                    }
                  }}
                  className={org.id === organization.id ? "bg-accent" : ""}
                >
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg mr-2">
                    {org.logo_url ? (
                      <div className="relative h-full w-full rounded-lg overflow-hidden">
                        <Image 
                          src={org.logo_url} 
                          alt={org.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <span className="font-medium">{getOrgInitials(org.name)}</span>
                    )}
                  </div>
                  <span className="truncate font-medium">{org.name}</span>
                </DropdownMenuItem>
              ))}
            </div>
            
            <DropdownMenuSeparator />
            
            {/* Create Organization */}
            <DropdownMenuItem onClick={handleCreateOrg}>
              <Plus className="mr-2 size-4" />
              Create Organization
            </DropdownMenuItem>
            
            {/* View All Organizations */}
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings?tab=organization')}>
              <Building className="mr-2 size-4" />
              Manage Organizations
            </DropdownMenuItem>
            
            {/* Sync Organizations */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem onClick={handleSyncCheck} disabled={syncing}>
                    <RefreshCw className={`mr-2 size-4 ${syncing ? 'animate-spin' : ''}`} />
                    Refresh Organization Data
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh organization data from the database</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
} 