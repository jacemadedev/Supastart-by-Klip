'use client'

import { useState, useEffect, useMemo } from "react"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { useOrganizationContext } from "@/contexts/organization-context"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getAvailableFeatures } from "@/lib/organization/permissions"
import { errorToast, successToast } from "@/lib/toast"

export function PermissionManager() {
  const { organization, isOwner, updateOrganization } = useOrganizationContext()
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Memoize features to prevent recreation on every render
  const features = useMemo(() => getAvailableFeatures(), [])
  
  // Load permissions from organization on mount
  useEffect(() => {
    if (organization) {
      setLoading(true)
      
      // Get current permissions or set defaults
      const currentPermissions = organization.settings?.member_permissions || {}
      
      // Ensure all features have a value (default to true for backward compatibility)
      const initializedPermissions = { ...currentPermissions }
      
      // Initialize any missing permissions to true (allow by default)
      features.forEach(feature => {
        if (initializedPermissions[feature.id] === undefined) {
          initializedPermissions[feature.id] = true
        }
      })
      
      setPermissions(initializedPermissions)
      setLoading(false)
    }
  }, [organization, features])
  
  // Only owners can manage permissions
  if (!isOwner) {
    return (
      <Alert>
        <AlertDescription>
          Only organization owners can manage member permissions.
        </AlertDescription>
      </Alert>
    )
  }
  
  // Handle toggle changes
  const handleTogglePermission = (featureId: string, enabled: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [featureId]: enabled
    }))
  }
  
  // Save permissions
  const handleSavePermissions = async () => {
    if (!organization) return
    
    setSaving(true)
    
    try {
      // Get current settings or initialize empty object
      const currentSettings = organization.settings || {}
      
      // Update with new permissions
      const result = await updateOrganization({
        settings: {
          ...currentSettings,
          member_permissions: permissions
        }
      })
      
      if (result.success) {
        successToast("Member permissions updated successfully")
      } else {
        errorToast(result.error || "Failed to update permissions")
      }
    } catch (error) {
      console.error("Error updating permissions:", error)
      errorToast("An unexpected error occurred")
    } finally {
      setSaving(false)
    }
  }
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Member Permissions</CardTitle>
          <CardDescription>
            Control which features regular members can access
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Member Permissions</CardTitle>
        <CardDescription>
          Control which features regular members can access in your organization.
          Owners and admins always have access to all features.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {features.map(feature => (
            <div key={feature.id} className="flex items-center justify-between">
              <div>
                <Label htmlFor={`${feature.id}-toggle`} className="font-medium">{feature.name}</Label>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
              <Switch
                id={`${feature.id}-toggle`}
                checked={permissions[feature.id] || false}
                onCheckedChange={(checked) => handleTogglePermission(feature.id, checked)}
              />
            </div>
          ))}
          
          <Separator className="my-4" />
          
          <div className="flex justify-end">
            <Button 
              onClick={handleSavePermissions} 
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Permissions
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 