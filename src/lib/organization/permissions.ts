import { Organization } from "./organization-service";

/**
 * Check if a member can use a specific feature based on their role and organization settings
 * - Owners and admins always have access to all features
 * - Regular members' access is controlled by organization settings
 */
export function canMemberUseFeature(
  organization: Organization | null,
  userRole: string | null,
  feature: string
): boolean {
  // If no organization or role, deny access
  if (!organization || !userRole) return false;
  
  // Owners and admins always have access to all features
  if (userRole === 'owner' || userRole === 'admin') return true;
  
  // For regular members, check settings
  if (organization.settings?.member_permissions) {
    return organization.settings.member_permissions[feature] === true;
  }
  
  // Default to true for backward compatibility - allow all features if no settings
  return true;
}

/**
 * Get a list of available features that can be toggled for members
 */
export function getAvailableFeatures(): Array<{id: string, name: string, description: string}> {
  return [
    {
      id: "chat",
      name: "Chat",
      description: "Access to the AI chat feature"
    },
    {
      id: "agents",
      name: "AI Agents",
      description: "Access to advanced AI agent mode with specialized capabilities"
    },
    {
      id: "magic_ads",
      name: "Magic Ads",
      description: "Access to AI-powered advertisement creation and editing"
    },
    {
      id: "history",
      name: "Chat History",
      description: "View past conversation history"
    },
    {
      id: "files",
      name: "File Management",
      description: "Upload and manage files"
    },
    {
      id: "analytics",
      name: "Analytics",
      description: "View organization analytics"
    }
  ];
} 