"use client"

import React, { useState, useEffect, Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { History, Sparkles } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useHistory } from "@/hooks/useHistory"
import { useSearchParams, useRouter } from "next/navigation"
import type { SessionWithInteractions } from "@/types/history"
import { useOrganizationContext } from "@/contexts/organization-context"
import { downloadImage } from "@/lib/utils/download"
import { canMemberUseFeature } from "@/lib/organization/permissions"

// Import components
import { AdCreationPanel } from "./components/AdCreationPanel"
import { PreviewArea } from "./components/PreviewArea"
import { HistoryPanel, HistoryItem } from "./components/HistoryPanel"

function MagicAdsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { organization, userRole } = useOrganizationContext()
  const { getSession, deleteArtifact } = useHistory()
  
  // Session management
  const sessionId = searchParams.get('session')
  const [currentSession, setCurrentSession] = useState<SessionWithInteractions | null>(null)
  const [justCreatedSession, setJustCreatedSession] = useState<string | null>(null)

  // Ad generation state
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Session loading state
  const [isLoadingSession, setIsLoadingSession] = useState(false)

  // Preview state
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [currentPrompt, setCurrentPrompt] = useState<string | undefined>(undefined)
  const [isStarred, setIsStarred] = useState(false)

  // Responsive UI state
  const [isMobile, setIsMobile] = useState(false)
  const [activeMobilePanel, setActiveMobilePanel] = useState<"controls" | "preview" | "history">("controls")
  
  // Collapsible panels state (desktop only)
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState(false)
  const [isHistoryPanelCollapsed, setIsHistoryPanelCollapsed] = useState(false)

  // Check if device is mobile on mount and window resize
  useEffect(() => {
    const checkIfMobile = () => {
      const isMobileView = window.innerWidth < 768
      setIsMobile(isMobileView)
      
      // Reset collapsed state when switching to mobile
      if (isMobileView) {
        setIsControlPanelCollapsed(false)
        setIsHistoryPanelCollapsed(false)
      }
    }
    
    // Initial check
    checkIfMobile()
    
    // Add event listener
    window.addEventListener("resize", checkIfMobile)
    
    // Cleanup
    return () => window.removeEventListener("resize", checkIfMobile)
  }, [])

  // Load session if sessionId is provided
  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId || !organization) {
        return
      }
      
      if (currentSession?.id === sessionId) {
        return
      }
      
      if (sessionId === justCreatedSession) {
        setJustCreatedSession(null)
        return
      }
      
      try {
        setIsLoadingSession(true)
        const session = await getSession(sessionId)
        setCurrentSession(session)
        
        // Convert session data to history items for display
        const sessionHistoryItems: HistoryItem[] = []
        
        session.interactions.forEach(interaction => {
          if ((interaction.type === 'image_generation' || interaction.type === 'image_edit') && interaction.artifacts) {
            interaction.artifacts.forEach((artifact) => {
              if (artifact.url) {
                sessionHistoryItems.push({
                  id: `${artifact.id}`, // Use actual artifact ID for deletion
                  url: artifact.url,
                  prompt: interaction.content || '',
                  date: new Date(interaction.created_at || '').toLocaleDateString(),
                  starred: session.starred || false,
                  // Add creation timestamp for sorting
                  createdAt: new Date(artifact.created_at || interaction.created_at || '').getTime()
                })
              }
            })
          }
        })
        
        // Sort by creation time (newest first)
        sessionHistoryItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        
        setHistoryItems(sessionHistoryItems)
      } catch (error) {
        console.error('Failed to load session:', error)
        toast.error('Failed to load session')
      } finally {
        setIsLoadingSession(false)
      }
    }
    
    loadSession()
  }, [sessionId, organization, getSession, justCreatedSession, currentSession?.id])

  // History state
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])

  // Creation panel controlled state
  const [creationPrompt, setCreationPrompt] = useState<string>("")
  const [creationAdExampleImages, setCreationAdExampleImages] = useState<File[]>([])
  const [creationProductImages, setCreationProductImages] = useState<File[]>([])



  // Handler functions
  const handleSelectHistoryItem = (item: HistoryItem) => {
    setCurrentImages([item.url])
    setCurrentPrompt(item.prompt)
    setIsStarred(item.starred)
    if (isMobile) {
      setActiveMobilePanel("preview")
    }
  }
  
  // Handle ad creation requests (generation, editing)
  const handleAdCreation = async (prompt: string, images?: File[], size?: string) => {
    // Check permission before proceeding
    if (!canMemberUseFeature(organization, userRole, "magic_ads")) {
      toast.error("You don't have permission to use Magic Ads in this organization. Please contact your organization owner for access.");
      return;
    }

    if (!prompt.trim() && !images?.length) {
      toast.error("Please provide a prompt or upload images");
      return;
    }
    
    // Determine the action based on the prompt and images
    let action: 'generate' | 'edit' = 'generate';
    
    try {
      setIsGenerating(true);
      
      if (isMobile) {
        setActiveMobilePanel("preview");
      }
      
      if (images && images.length > 0) {
        // If images are provided, default to editing
        action = 'edit';
      }
      
      let response: Response;
      
      if (action === 'generate') {
        // Regular image generation
        response = await fetch('/api/sandbox/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt,
            count: 1,
            quality: "standard",
            size: size || "1024x1024",
            sessionId: currentSession?.id,
            sessionType: 'magic_ads'
          }),
        });
      } else if (action === 'edit') {
        // Image editing
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('count', '1');
        formData.append('quality', 'medium');
        formData.append('size', size || "1024x1024");
        formData.append('sessionType', 'magic_ads');
        if (currentSession?.id) {
          formData.append('sessionId', currentSession.id);
        }
        
        // Add images to form data
        images!.forEach((image, index) => {
          formData.append(`image_${index}`, image);
        });
        
        response = await fetch('/api/sandbox/edit-image', {
          method: 'POST',
          body: formData,
        });
      } else {
        throw new Error('Invalid action type');
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} images`);
      }
      
      if (data.success) {
        // Get image URLs from response
        const imageUrls = data.data.imageUrls || [];
        
        // Handle session ID from response
        if (data.sessionId && data.sessionId !== currentSession?.id) {
          // Mark this as a newly created session to avoid unnecessary loading
          setJustCreatedSession(data.sessionId)
          
          // Create a lightweight session object to avoid refetching
          setCurrentSession({
            id: data.sessionId,
            organization_id: organization?.id || '',
            user_id: '',
            type: 'magic_ads',
            title: `Magic Ad ${action}: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}`,
            metadata: { webSearch: false },
            starred: false,
            archived: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            interactions: []
          })
          
          // Update URL with new session ID
          const newUrl = new URL(window.location.href)
          newUrl.searchParams.set('session', data.sessionId)
          router.replace(newUrl.pathname + newUrl.search, { scroll: false })
        }
        
        if (imageUrls.length > 0) {
          setCurrentImages(imageUrls);
          setCurrentPrompt(prompt);
          
          // Add all images to history individually
          const timestamp = Date.now();
          const formattedTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          
          const newHistoryItems = imageUrls.map((url: string, index: number) => ({
            id: `${action}-${timestamp}-${index}`,
            url: url,
            prompt: prompt,
            date: `Today, ${formattedTime}`,
            starred: false,
            createdAt: timestamp + index // Add slight offset for multiple images
          }));
          
          // Merge and sort all history items by creation time (newest first)
          const allHistoryItems = [...newHistoryItems, ...historyItems];
          allHistoryItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setHistoryItems(allHistoryItems);
          
          const actionText = action === 'generate' ? 'Generated' : 'Edited';
          toast.success(`${actionText} ${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''} (${data.credits.cost} credits used)`);
          
          // Clear only the prompt after successful generation, keep images for iteration
          setCreationPrompt("")
          // Keep ad example images and product images so users can iterate easily
        } else {
          toast.error(`No images were ${action === 'generate' ? 'generated' : 'edited'}`);
        }
      }
    } catch (error) {
      console.error(`Error in ad ${action}:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${action} images`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleToggleStar = () => {
    setIsStarred(!isStarred)
  }

  const handleToggleHistoryItemStar = (item: HistoryItem) => {
    setHistoryItems(historyItems.map(i => 
      i.id === item.id ? { ...i, starred: !i.starred } : i
    ))
  }

  const handleDeleteHistoryItem = async (item: HistoryItem) => {
    try {
      // Check if this is a real artifact ID (UUID format) vs a temporary ID
      if (item.id.length === 36 && item.id.includes('-') && !item.id.includes('generate') && !item.id.includes('edit')) {
        // This is a database artifact, delete it
        await deleteArtifact(item.id)
        toast.success('Image deleted successfully!')
      }
      
      // Remove from local state regardless
      setHistoryItems(historyItems.filter(i => i.id !== item.id))
    } catch (error: unknown) {
      console.error('Failed to delete artifact:', error)
      const errorMessage = (error as Error)?.message || 'Failed to delete image'
      
      if (errorMessage.includes('only delete artifacts from your own sessions')) {
        toast.error('You can only delete images from your own sessions')
      } else if (errorMessage.includes('not found')) {
        toast.error('Image not found')
        // Remove from local state since it doesn't exist in database
        setHistoryItems(historyItems.filter(i => i.id !== item.id))
      } else {
        toast.error('Failed to delete image from database, but removed from view')
        // Still remove from local state even if database delete fails
        setHistoryItems(historyItems.filter(i => i.id !== item.id))
      }
    }
  }

  const handleDownloadCurrentImage = async () => {
    if (currentImages.length > 0) {
      try {
        const currentIndex = 0 // For now, download the first image if multiple
        const imageUrl = currentImages[currentIndex]
        const prompt = currentPrompt || 'magic-ad'
        const filename = `${prompt.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)}-${Date.now()}.png`
        
        await downloadImage(imageUrl, filename)
        toast.success('Image downloaded successfully!')
      } catch (error) {
        console.error('Download failed:', error)
        toast.error('Failed to download image')
      }
    }
  }

  const handleDownloadHistoryItem = async (item: HistoryItem) => {
    try {
      const filename = `${item.prompt.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)}-${Date.now()}.png`
      await downloadImage(item.url, filename)
      toast.success('Image downloaded successfully!')
    } catch (error) {
      console.error('Download failed:', error)
      toast.error('Failed to download image')
    }
  }

  const handleCopyHistoryItem = async (item: HistoryItem) => {
    try {
      await navigator.clipboard.writeText(item.prompt)
      toast.success('Prompt copied to clipboard!')
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }
  
  // Toggle panel collapse functions
  const toggleControlPanel = () => {
    setIsControlPanelCollapsed(!isControlPanelCollapsed)
  }

  const toggleHistoryPanel = () => {
    setIsHistoryPanelCollapsed(!isHistoryPanelCollapsed)
  }

  const handleRemoveImage = (index: number) => {
    setCurrentImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleCopy = async () => {
    if (currentPrompt) {
      try {
        await navigator.clipboard.writeText(currentPrompt)
        toast.success('Prompt copied to clipboard!')
      } catch {
        toast.error('Failed to copy to clipboard')
      }
    }
  }

  const handleShare = async () => {
    if (currentImages.length > 0) {
      try {
        const shareData = {
          title: 'Magic Ad Creation',
          text: currentPrompt || 'Check out this AI-generated ad!',
          url: window.location.href
        }
        
        if (navigator.share) {
          await navigator.share(shareData)
        } else {
          // Fallback: copy URL to clipboard
          await navigator.clipboard.writeText(window.location.href)
          toast.success('Link copied to clipboard!')
        }
      } catch (error) {
        console.error('Share failed:', error)
        toast.error('Failed to share')
      }
    }
  }

  // New editing handlers
  const handleEditImage = async (imageUrl: string) => {
    // Convert image URL to File object and populate creation panel
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const file = new File([blob], 'image-to-edit.png', { type: 'image/png' })
      
      // Pre-populate creation panel with edit prompt template and image
      setCreationPrompt("Edit this image: ")
      setCreationProductImages([file]) // Add to product images for editing
      
      // Switch to creation panel on mobile
      if (isMobile) {
        setActiveMobilePanel("controls")
      }
      
      toast.success('Image loaded for editing! Add your edit instructions and click "Create Magic Ad".')
    } catch (error) {
      console.error('Failed to prepare image for editing:', error)
      toast.error('Failed to prepare image for editing')
    }
  }



  const handleUseAsBase = async (imageUrl: string) => {
    // Add image to creation panel as base image
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const file = new File([blob], 'base-image.png', { type: 'image/png' })
      
      // Pre-populate creation panel with base image
      setCreationPrompt("")
      setCreationAdExampleImages([file]) // Add to ad examples as reference
      
      // Switch to creation panel on mobile
      if (isMobile) {
        setActiveMobilePanel("controls")
      }
      
      toast.success('Image loaded as base! Add your description and click "Create Magic Ad".')
    } catch (error) {
      console.error('Failed to prepare base image:', error)
      toast.error('Failed to prepare base image')
    }
  }

  // Render based on mobile/desktop
  if (isMobile) {
    return (
      <div className="absolute inset-0 flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Magic Ads</h1>
            </div>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="px-4 py-2 border-b flex-shrink-0">
          <Tabs value={activeMobilePanel} onValueChange={(value: string) => {
            if (value === "controls" || value === "preview" || value === "history") {
              setActiveMobilePanel(value)
            }
          }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="controls">Create</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Mobile Content */}
        <div className="flex-1 overflow-hidden">
          {activeMobilePanel === "controls" && (
            <div className="h-full p-4 overflow-y-auto">
              <AdCreationPanel
                onGenerate={handleAdCreation}
                isLoading={isGenerating}
                prompt={creationPrompt}
                onPromptChange={setCreationPrompt}
                adExampleImages={creationAdExampleImages}
                onAdExampleImagesChange={setCreationAdExampleImages}
                productImages={creationProductImages}
                onProductImagesChange={setCreationProductImages}
              />
            </div>
          )}
          
          {activeMobilePanel === "preview" && (
            <div className="h-full overflow-hidden">
              <PreviewArea
                images={currentImages}
                prompt={currentPrompt}
                isStarred={isStarred}
                onToggleStar={handleToggleStar}
                onDownload={handleDownloadCurrentImage}
                onShare={handleShare}
                onCopy={handleCopy}
                isMobile={true}
                onRemoveImage={handleRemoveImage}
                isLoading={isGenerating}
                onEditImage={handleEditImage}
                onUseAsBase={handleUseAsBase}
              />
            </div>
          )}
          
          {activeMobilePanel === "history" && (
            <div className="h-full overflow-hidden">
              <HistoryPanel
                historyItems={historyItems}
                isLoading={isLoadingSession}
                onSelectItem={handleSelectHistoryItem}
                onCopyItem={handleCopyHistoryItem}
                onToggleStar={handleToggleHistoryItemStar}
                onDeleteItem={handleDeleteHistoryItem}
                onDownloadItem={handleDownloadHistoryItem}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Desktop layout
  return (
    <div className="absolute inset-0 flex bg-background overflow-hidden">
      {/* Left Panel - Ad Creation */}
      <div className={`${isControlPanelCollapsed ? "w-12 border-r" : "w-96 border-r overflow-y-auto"} bg-muted/20 flex flex-col transition-all duration-300 ease-in-out`}>
        {!isControlPanelCollapsed && (
          <>
            <div className="p-4 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-semibold">Magic Ads</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Create, edit, and refine advertisements with AI
              </p>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto">
              <AdCreationPanel
                onGenerate={handleAdCreation}
                isLoading={isGenerating}
                prompt={creationPrompt}
                onPromptChange={setCreationPrompt}
                adExampleImages={creationAdExampleImages}
                onAdExampleImagesChange={setCreationAdExampleImages}
                productImages={creationProductImages}
                onProductImagesChange={setCreationProductImages}
              />
            </div>
          </>
        )}
        
        {isControlPanelCollapsed && (
          <div className="flex flex-col items-center pt-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsControlPanelCollapsed(false)}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Center Panel - Preview */}
      <div className="flex-1 overflow-hidden">
        <PreviewArea
          images={currentImages}
          prompt={currentPrompt}
          isStarred={isStarred}
          onToggleStar={handleToggleStar}
          onDownload={handleDownloadCurrentImage}
          onShare={handleShare}
          onCopy={handleCopy}
          onToggleLeftPanel={toggleControlPanel}
          onToggleRightPanel={toggleHistoryPanel}
          isLeftPanelCollapsed={isControlPanelCollapsed}
          isRightPanelCollapsed={isHistoryPanelCollapsed}
          isMobile={false}
          onRemoveImage={handleRemoveImage}
          isLoading={isGenerating}
          onEditImage={handleEditImage}
          onUseAsBase={handleUseAsBase}
        />
      </div>

      {/* Right Panel - History */}
      {!isHistoryPanelCollapsed && (
        <div className="w-80 border-l bg-muted/20 flex flex-col overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="font-medium">History</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleHistoryPanel}
              className="h-8 w-8 p-0"
            >
              <Separator orientation="vertical" className="h-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <HistoryPanel
              historyItems={historyItems}
              isLoading={isLoadingSession}
              onSelectItem={handleSelectHistoryItem}
              onCopyItem={handleCopyHistoryItem}
              onToggleStar={handleToggleHistoryItemStar}
              onDeleteItem={handleDeleteHistoryItem}
              onDownloadItem={handleDownloadHistoryItem}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function MagicAdsPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    }>
      <MagicAdsPageContent />
    </Suspense>
  )
} 