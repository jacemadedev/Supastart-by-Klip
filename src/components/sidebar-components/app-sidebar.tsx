"use client"

import * as React from "react"
import {
  BookOpen,
  Command,
  LifeBuoy,
  Send,
  ChevronDown,
  Plus,
  RefreshCw,
  Building,
  Code,
  Sparkles,
} from "lucide-react"
import { usePathname } from "next/navigation"

import { NavMain } from "@/components/sidebar-components/nav-main"
import { NavProjects } from "@/components/sidebar-components/nav-projects"
import { NavSecondary } from "@/components/sidebar-components/nav-secondary"
import { NavUser } from "@/components/sidebar-components/nav-user"
import { CreditTracker } from "@/components/dashboard-components/credit-tracker"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/dashboard-components/sidebar"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { User } from "@supabase/supabase-js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useOrganizationContext } from "@/contexts/organization-context"
import { successToast } from "@/lib/toast"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Skeleton } from "@/components/ui/skeleton"
import { ThemeToggle } from "@/components/theme-toggle"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: Command,
    },
    {
      title: "Chat",
      url: "/dashboard/chat",
      icon: Send,
      permissionRequired: "chat"
    },
    {
      title: "History",
      url: "/dashboard/history",
      icon: BookOpen,
      permissionRequired: "history"
    },
    {
      title: "Sandbox",
      url: "/dashboard/sandbox",
      icon: Code,
    },
    {
      title: "Magic Ads",
      url: "/dashboard/magic-ads",
      icon: Sparkles,
      permissionRequired: "magic_ads"
    }
  ],
  navSecondary: [
    {
      title: "Support",
      url: "https://github.com/your-repo/issues",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "mailto:feedback@yourdomain.com",
      icon: Send,
    },
  ]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [syncing, setSyncing] = useState(false)
  const { isMobile } = useSidebar()
  const { 
    organization,
    organizations,
    switchOrganization,
    updateOrganizationState,
    loading: orgLoading
  } = useOrganizationContext()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const userData = {
    name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    avatar: user?.user_metadata?.avatar_url || '',
  }

  // Generate org initials for the avatar
  const getOrgInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Function to check if a URL matches the current path
  const isPathActive = (url: string) => {
    // For dashboard home
    if (url === "/dashboard" && pathname === "/dashboard") {
      return true
    }
    // For other pages, check if the current path starts with the URL
    // This ensures parent paths are highlighted when on child routes
    return url !== "/dashboard" && pathname.startsWith(url)
  }

  // Add isActive property to navigation items (removed permission filtering for better UX)
  const navMainWithActiveState = data.navMain
    .map(item => ({
      ...item,
      isActive: isPathActive(item.url)
    }))

  // Handle sync click
  const handleSyncCheck = async () => {
    setSyncing(true)
    try {
      await updateOrganizationState()
      successToast("Organization data refreshed")
    } finally {
      setSyncing(false)
    }
  }

  // Handle creating a new organization
  const handleCreateOrg = () => {
    router.push('/dashboard/settings?tab=organization')
  }

  return (
    <Sidebar
      className="inset-0 min-h-screen max-h-screen"
      {...props}
    >
      <SidebarHeader>
        {orgLoading ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : organization ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                      <Image 
                        src="/logo.svg"
                        alt="Logo"
                        width={20}
                        height={20}
                        className="object-contain invert"
                      />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">Dashboard</span>
                      <span className="truncate text-xs">{organization.name} • {organizations.length} org{organizations.length !== 1 ? 's' : ''}</span>
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
                  {/* Dashboard Link */}
                  <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                    <Command className="mr-2 size-4" />
                    Dashboard Home
                  </DropdownMenuItem>
                  
                  {/* Theme Toggle */}
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-sm">Theme</span>
                    <ThemeToggle />
                  </div>
                  
                  <DropdownMenuSeparator />
                  
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
                        <div className="bg-primary text-primary-foreground flex aspect-square size-5 items-center justify-center rounded-md text-xs font-semibold">
                          {getOrgInitials(org.name)}
                        </div>
                        <span className="ml-2 truncate">{org.name}</span>
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
        ) : null}
      </SidebarHeader>
      <SidebarContent className="overflow-y-auto py-2">
        {/* Use the modified navigation items with active states */}
        <NavMain items={navMainWithActiveState} />
        <NavProjects />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border pt-2">
        <NavSecondary items={data.navSecondary} className="mb-1" />
        
        {orgLoading ? (
          <div className="my-2 px-4">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-muted" aria-hidden="true" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <Skeleton className="h-full w-1/3" />
            </div>
          </div>
        ) : (
          <div className="px-4">
            <CreditTracker />
          </div>
        )}
        
        {!user || orgLoading ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <NavUser user={userData} />
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
