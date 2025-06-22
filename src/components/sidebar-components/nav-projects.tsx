"use client"

import { Settings2, CreditCard } from "lucide-react"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/dashboard-components/sidebar"

export function NavProjects() {
  const pathname = usePathname()
  
  // Check if a URL is active
  const isPathActive = (url: string) => {
    return pathname.startsWith(url.split('?')[0])
  }
  
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Account</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isPathActive('/dashboard/settings')}>
            <a href="/dashboard/settings?tab=organization">
              <Settings2 />
              <span>Settings</span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isPathActive('/dashboard/billing')}>
            <a href="/dashboard/billing">
              <CreditCard />
              <span>Billing</span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
