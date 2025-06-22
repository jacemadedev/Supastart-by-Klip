'use client'

import React from 'react'
import { AppSidebar } from '@/components/sidebar-components/app-sidebar'
import { SiteHeader } from '@/components/sidebar-components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/dashboard-components/sidebar'
import { OrganizationProvider } from '@/contexts/organization-context'
import { PlanStatusBanner } from '@/components/dashboard-components/plan-status-banner'
import './metadata'

type DashboardLayoutProps = {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="[--header-height:3.5rem]">
      <OrganizationProvider>
        <SidebarProvider className="flex min-h-screen">
          <div className="flex flex-1">
            <AppSidebar />
            <SidebarInset className="flex flex-col flex-1">
              <SiteHeader />
              <div className="flex flex-1 flex-col p-4">
                <PlanStatusBanner />
                {children}
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </OrganizationProvider>
    </div>
  )
} 