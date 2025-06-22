"use client"

import * as React from "react"
import { SidebarIcon } from "lucide-react"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/dashboard-components/sidebar"
import { CreditTracker } from "@/components/dashboard-components/credit-tracker"

export function SiteHeader() {
  const { toggleSidebar } = useSidebar()
  const pathname = usePathname()

  // Convert path to breadcrumb items
  const pathSegments = pathname
    ?.split('/')
    .filter(Boolean)
    .map((segment) => ({
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
      href: `/${pathname
        ?.split('/')
        .filter(Boolean)
        .slice(0, pathname?.split('/').filter(Boolean).indexOf(segment) + 1)
        .join('/')}`
    }))

  return (
    <header className="bg-background border-b">
      <div className="flex h-[var(--header-height)] items-center gap-2 px-4">
        <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          <SidebarIcon />
        </Button>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb className="hidden sm:block">
          <BreadcrumbList>
            {pathSegments?.map((segment, index) => (
              <React.Fragment key={segment.href}>
                <BreadcrumbItem>
                  {index === pathSegments.length - 1 ? (
                    <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={segment.href}>
                      {segment.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < pathSegments.length - 1 && <BreadcrumbSeparator />}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto hidden w-48 sm:block">
          <CreditTracker />
        </div>
      </div>
    </header>
  )
}
