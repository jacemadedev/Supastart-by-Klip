"use client"

import React, { useState, useEffect, Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { History } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useHistory } from "@/hooks/useHistory"
import { useSearchParams, useRouter } from "next/navigation"
import type { SessionWithInteractions } from "@/types/history"
import { useOrganizationContext } from "@/contexts/organization-context"
import { downloadImage } from "@/lib/utils/download"

// Import components
import { ControlSelector, controls } from "./components/ControlSelector"
import { ImageGenerationPanel, imageStyles } from "./components/ImageGenerationPanel"
import { CharacterGenerationPanel } from "./components/CharacterGenerationPanel"
import { InpaintingPanel } from "./components/InpaintingPanel"
import { ActionButtons } from "./components/ActionButtons"
import { PreviewArea } from "./components/PreviewArea"
import { HistoryPanel, HistoryItem } from "./components/HistoryPanel"

function SandboxPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { organization } = useOrganizationContext()
  const { getSession } = useHistory()
  
  // Session management
  const sessionId = searchParams.get('session')
  const [currentSession, setCurrentSession] = useState<SessionWithInteractions | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [justCreatedSession, setJustCreatedSession] = useState<string | null>(null)

  // Control state
  const [selectedControl, setSelectedControl] = useState<string | null>("image")
  const [qualityValue, setQualityValue] = useState(75)
  
  // Image generation state
  const [imagePrompt, setImagePrompt] = useState("")
  const [imageCount, setImageCount] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedImageStyle, setSelectedImageStyle] = useState("photorealistic")
  const [selectedInpaintStyle, setSelectedInpaintStyle] = useState("match")
  
  // Character generation selections
  const [selectedCharacterType, setSelectedCharacterType] = useState("human")
  const [selectedPose, setSelectedPose] = useState("portrait")
  const [selectedCharacterStyle, setSelectedCharacterStyle] = useState("realistic")

  // Preview state
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null)
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

  // Load session if sessionId is provided (but not if we already have it)
  useEffect(() => {
    const loadSession = async () => {
      // Don't load if:
      // 1. No sessionId provided
      // 2. No organization context
      // 3. We already have this session loaded
      // 4. This is a session we just created
      if (!sessionId || !organization) {
        return
      }
      
      if (currentSession?.id === sessionId) {
        // We already have this session loaded, no need to fetch again
        return
      }
      
      if (sessionId === justCreatedSession) {
        // Clear the flag if this is the session we just created
        setJustCreatedSession(null)
        return
      }
      
      // Only load from database if we don't already have this session
      setSessionLoading(true)
      try {
        const session = await getSession(sessionId)
        setCurrentSession(session)
        
        // Convert session data to history items for display
        const sessionHistoryItems: HistoryItem[] = []
        
        session.interactions.forEach(interaction => {
          if (interaction.type === 'image_generation' && interaction.artifacts) {
            interaction.artifacts.forEach((artifact, index) => {
              if (artifact.url) {
                sessionHistoryItems.push({
                  id: `${interaction.id}-${index}`,
                  url: artifact.url,
                  prompt: interaction.content || '',
                  date: new Date(interaction.created_at || '').toLocaleDateString(),
                  starred: session.starred || false
                })
              }
            })
          }
        })
        
        setHistoryItems(sessionHistoryItems)
      } catch (error) {
        console.error('Failed to load session:', error)
        toast.error('Failed to load session')
      } finally {
        setSessionLoading(false)
      }
    }
    
    loadSession()
  }, [sessionId, organization, getSession, justCreatedSession, currentSession?.id])

  // Empty initial history
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])

  // Handler functions
  const handleSelectHistoryItem = (item: HistoryItem) => {
    // For history items, we're treating them as single images for now
    setCurrentImages([item.url])
    setCurrentPrompt(item.prompt)
    setIsStarred(item.starred)
    // Switch to preview on mobile after selecting an item from history
    if (isMobile) {
      setActiveMobilePanel("preview")
    }
  }
  
  // Generate images with OpenAI API
  const handleGenerateImages = async () => {
    if (!imagePrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }
    
    try {
      setIsGenerating(true);
      
      if (isMobile) {
        setActiveMobilePanel("preview");
      }
      
      // Map quality slider value to appropriate OpenAI quality setting
      // GPT Image 1 accepts 'low', 'medium', 'high', or 'auto', but we map to our existing format
      const imageQuality = qualityValue >= 75 ? "hd" : "standard";
      
      // Find the selected style's details from the imageStyles array
      const selectedStyleInfo = imageStyles.find(style => style.id === selectedImageStyle);
      
      // Enhance prompt with the selected style if available
      let enhancedPrompt = imagePrompt;
      if (selectedStyleInfo && selectedImageStyle !== "photorealistic") {
        // Add style information to the prompt in a more natural way
        const styleDescription = 
          selectedImageStyle === "abstract" ? "Create this in abstract art style." :
          selectedImageStyle === "watercolor" ? "Render this as a watercolor painting." :
          selectedImageStyle === "3drender" ? "Make this a detailed 3D rendering." :
          selectedImageStyle === "pixelart" ? "Create this in pixel art style." : "";
        
        enhancedPrompt = `${imagePrompt}. ${styleDescription}`.trim();
      }
      
      console.log(`Generating images with prompt: "${enhancedPrompt}", style: ${selectedImageStyle}, count: ${imageCount}, quality: ${imageQuality}`);
      
      const response = await fetch('/api/sandbox/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          count: imageCount,
          quality: imageQuality,
          sessionId: currentSession?.id
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate images");
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
            type: 'sandbox',
            title: `Image: ${imagePrompt.substring(0, 30)}${imagePrompt.length > 30 ? '...' : ''}`,
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
          setCurrentPrompt(imagePrompt);
          
          // Add all images to history individually
          const timestamp = Date.now();
          const formattedTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          
          const newHistoryItems = imageUrls.map((url: string, index: number) => ({
            id: `img-${timestamp}-${index}`,
            url: url,
            prompt: imagePrompt,
            date: `Today, ${formattedTime}`,
            starred: false
          }));
          
          // Add all new history items to the existing history
          setHistoryItems([...newHistoryItems, ...historyItems]);
          
          toast.success(`Generated ${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''} (${data.credits.cost} credits used)`);
        } else {
          toast.error("No images were generated");
        }
      }
    } catch (error) {
      console.error("Error generating images:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate images");
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

  const handleDeleteHistoryItem = (item: HistoryItem) => {
    setHistoryItems(historyItems.filter(i => i.id !== item.id))
  }

  const handleDownloadCurrentImage = async () => {
    if (currentImages.length > 0) {
      try {
        const currentIndex = 0 // For now, download the first image if multiple
        const imageUrl = currentImages[currentIndex]
        const prompt = currentPrompt || 'generated-image'
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
  
  // Toggle panel collapse functions
  const toggleControlPanel = () => {
    setIsControlPanelCollapsed(!isControlPanelCollapsed)
  }
  
  const toggleHistoryPanel = () => {
    setIsHistoryPanelCollapsed(!isHistoryPanelCollapsed)
  }
  
  // Show loading state while session is loading
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-var(--header-height)-2rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height)-2rem)] md:flex-row border rounded-md m-2 overflow-hidden bg-background">
      {/* Mobile Navigation Tabs */}
      {isMobile && (
        <div className="border-b md:hidden">
          <Tabs 
            value={activeMobilePanel} 
            onValueChange={(value) => setActiveMobilePanel(value as "controls" | "preview" | "history")}
            className="w-full"
          >
            <TabsList className="w-full h-12 grid grid-cols-3 rounded-none bg-background">
              <TabsTrigger value="controls" className="text-xs">Controls</TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      
      {/* Content Area - Mobile shows active tab, Desktop shows all panels */}
      <div className="flex flex-1 md:flex-row overflow-hidden relative" style={{ height: isMobile ? 'calc(100% - 48px)' : '100%' }}>
        {/* Sidebar Control Panel */}
        <div 
          className={`${isMobile ? 
            activeMobilePanel === "controls" ? "absolute inset-0 overflow-y-auto" : "hidden" : 
            isControlPanelCollapsed ? "w-12 border-r" : "w-80 border-r overflow-y-auto"
          } bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 ease-in-out`}
        >
          {!isControlPanelCollapsed && (
            <div className="flex flex-col px-3 py-4">
              <div className="px-2 py-2">
                <h2 className="text-lg font-semibold">Generation Controls</h2>
              </div>
              
              <ControlSelector 
                selectedControl={selectedControl}
                onSelectControl={(controlId) => setSelectedControl(controlId)}
              />
              
              <Separator className="my-4" />
              
              <div className="px-2 space-y-6">
                {selectedControl === "image" && (
                  <ImageGenerationPanel
                    selectedStyle={selectedImageStyle}
                    setSelectedStyle={setSelectedImageStyle}
                    qualityValue={qualityValue}
                    setQualityValue={setQualityValue}
                    prompt={imagePrompt}
                    setPrompt={setImagePrompt}
                    imageCount={imageCount}
                    setImageCount={setImageCount}
                  />
                )}
                
                {selectedControl === "character" && (
                  <CharacterGenerationPanel
                    selectedType={selectedCharacterType}
                    setSelectedType={setSelectedCharacterType}
                    selectedPose={selectedPose}
                    setSelectedPose={setSelectedPose}
                    selectedStyle={selectedCharacterStyle}
                    setSelectedStyle={setSelectedCharacterStyle}
                  />
                )}
                
                {selectedControl === "inpainting" && (
                  <InpaintingPanel
                    selectedStyle={selectedInpaintStyle}
                    setSelectedStyle={setSelectedInpaintStyle}
                  />
                )}
                

              </div>
              
              <div className="mt-4 mb-4">
                <ActionButtons 
                  selectedControl={selectedControl} 
                  onAction={() => isMobile && setActiveMobilePanel("preview")}
                  onGenerate={selectedControl === "image" ? handleGenerateImages : () => {
                    toast.info(`${selectedControl === "character" ? "Character" : "Inpainting"} generation not yet implemented`);
                  }}
                  isLoading={isGenerating}
                />
              </div>
            </div>
          )}
          
          {!isMobile && isControlPanelCollapsed && (
            <div className="flex flex-col items-center pt-4 gap-4">
              {controls.map((control) => (
                <Button
                  key={control.id}
                  variant={selectedControl === control.id ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setSelectedControl(control.id);
                    setIsControlPanelCollapsed(false);
                  }}
                >
                  <control.icon className="h-4 w-4" />
                </Button>
              ))}
            </div>
          )}
        </div>
        
        {/* Main Preview Area */}
        <div className={`${isMobile ? 
          activeMobilePanel === "preview" ? "absolute inset-0" : "hidden" : 
          "flex-1"}`}>
          <PreviewArea 
            images={currentImages}
            prompt={currentPrompt || undefined}
            isStarred={isStarred}
            onToggleStar={handleToggleStar}
            onDownload={handleDownloadCurrentImage}
            onShare={() => console.log('Share clicked')}
            onCopy={() => console.log('Copy clicked')}
            onToggleLeftPanel={toggleControlPanel}
            onToggleRightPanel={toggleHistoryPanel}
            isLeftPanelCollapsed={isControlPanelCollapsed}
            isRightPanelCollapsed={isHistoryPanelCollapsed}
            isMobile={isMobile}
            onRemoveImage={(index) => {
              // Remove the image at the specified index
              setCurrentImages(currentImages.filter((_, i) => i !== index));
              
              // If removing the last image, clear the prompt too
              if (currentImages.length <= 1) {
                setCurrentPrompt(null);
              }
            }}
            isLoading={isGenerating}
          />
        </div>
        
        {/* History Panel */}
        <div 
          className={`${isMobile ? 
            activeMobilePanel === "history" ? "absolute inset-0 overflow-y-auto" : "hidden" : 
            isHistoryPanelCollapsed ? "w-12 border-l" : "w-64 border-l overflow-y-auto"
          } bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 ease-in-out`}
        >
          {!isHistoryPanelCollapsed && (
            <HistoryPanel 
              historyItems={historyItems}
              onSelectItem={handleSelectHistoryItem}
              onToggleStar={handleToggleHistoryItemStar}
              onCopyItem={(item) => console.log('Copy item', item.id)}
              onDeleteItem={handleDeleteHistoryItem}
              onDownloadItem={handleDownloadHistoryItem}
            />
          )}
          
          {!isMobile && isHistoryPanelCollapsed && (
            <div className="flex flex-col items-center pt-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsHistoryPanelCollapsed(false)}
              >
                <History className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SandboxPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-var(--header-height)-2rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SandboxPageContent />
    </Suspense>
  )
} 