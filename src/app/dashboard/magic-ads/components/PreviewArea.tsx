import React, { useState } from "react"
import { Download, Star, StarOff, Share2, Copy, Maximize, Minus, Plus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trash2, Loader2, Edit, Upload, Sparkles } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface PreviewAreaProps {
  images?: string[] 
  prompt?: string
  isStarred?: boolean
  onToggleStar?: () => void
  onDownload?: () => void
  onShare?: () => void
  onCopy?: () => void
  onToggleLeftPanel?: () => void
  onToggleRightPanel?: () => void
  isLeftPanelCollapsed?: boolean
  isRightPanelCollapsed?: boolean
  isMobile?: boolean
  onRemoveImage?: (index: number) => void
  isLoading?: boolean
  onEditImage?: (imageUrl: string) => void

  onUseAsBase?: (imageUrl: string) => void
}

export function PreviewArea({
  images = [],
  prompt = "A futuristic cityscape with flying cars and neon lights, photorealistic style, high quality, vibrant colors",
  isStarred = false,
  onToggleStar = () => {},
  onDownload = () => {},
  onShare = () => {},
  onCopy = () => {},
  onToggleLeftPanel = () => {},
  onToggleRightPanel = () => {},
  isLeftPanelCollapsed = false,
  isRightPanelCollapsed = false,
  isMobile = false,
  onRemoveImage = () => {},
  isLoading = false,
  onEditImage = () => {},

  onUseAsBase = () => {}
}: PreviewAreaProps) {
  const [zoomLevel, setZoomLevel] = useState(100)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  
  // Use empty array when no images are provided
  const allImages = images.length > 0 ? images : []
  const currentImage = allImages.length > 0 ? allImages[currentImageIndex] : null

  const goToNextImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex < allImages.length - 1 ? prevIndex + 1 : prevIndex
    )
  }

  const goToPreviousImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex > 0 ? prevIndex - 1 : prevIndex
    )
  }
  
  const handleRemoveImage = (index: number) => {
    if (allImages.length <= 1) return; // Don't remove the last image
    
    // Notify parent component
    onRemoveImage(index);
    
    // If we're removing the current image, adjust the currentImageIndex
    if (index === currentImageIndex) {
      // If we're removing the last image, go to the previous one
      if (index === allImages.length - 1) {
        setCurrentImageIndex(Math.max(0, index - 1));
      }
      // Otherwise currentIndex stays the same and will point to the next image
    } else if (index < currentImageIndex) {
      // If we're removing an image before the current one, adjust the index
      setCurrentImageIndex(currentImageIndex - 1);
    }
  }
  
  return (
    <div className="flex-1 flex flex-col bg-muted/30 h-full">
      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-3 sm:p-4 md:p-6 relative min-h-0">
        {/* Panel toggle buttons (desktop only) */}
        {!isMobile && (
          <>
            <div className="absolute left-3 top-3 z-10">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-full bg-background shadow-md border-muted-foreground/20"
                onClick={onToggleLeftPanel}
              >
                <ChevronLeft className={`h-4 w-4 transition-transform ${isLeftPanelCollapsed ? "rotate-180" : ""}`} />
              </Button>
            </div>
            <div className="absolute right-3 top-3 z-10">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-full bg-background shadow-md border-muted-foreground/20"
                onClick={onToggleRightPanel}
              >
                <ChevronRight className={`h-4 w-4 transition-transform ${isRightPanelCollapsed ? "rotate-180" : ""}`} />
              </Button>
            </div>
          </>
        )}
        
        <div className="relative w-full max-w-2xl">
          {/* Main Preview Image */}
          <div className="relative w-full flex items-center justify-center">
            <div className="absolute top-2 right-2 z-10 flex gap-1 sm:gap-2">
              <button 
                className="bg-background/50 backdrop-blur p-1 sm:p-1.5 rounded-md hover:bg-background"
                onClick={onDownload}
                disabled={isLoading || !currentImage}
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
              <button 
                className="bg-background/50 backdrop-blur p-1 sm:p-1.5 rounded-md hover:bg-background"
                onClick={onShare}
                disabled={isLoading || !currentImage}
              >
                <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
              <button 
                className="bg-background/50 backdrop-blur p-1 sm:p-1.5 rounded-md hover:bg-background"
                onClick={onCopy}
                disabled={isLoading || !currentImage}
              >
                <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
              <button 
                className="bg-background/50 backdrop-blur p-1 sm:p-1.5 rounded-md hover:bg-background"
                onClick={onToggleStar}
                disabled={isLoading || !currentImage}
              >
                {isStarred ? (
                  <Star className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-400 fill-yellow-400" />
                ) : (
                  <StarOff className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
              </button>
              {allImages.length > 1 && !isLoading && (
                <button 
                  className="bg-red-500/20 text-red-500 backdrop-blur p-1 sm:p-1.5 rounded-md hover:bg-red-500/30"
                  onClick={() => handleRemoveImage(currentImageIndex)}
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
              )}
            </div>
            
            {/* Image Navigation (if multiple images) */}
            {allImages.length > 1 && !isLoading && (
              <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 flex flex-col gap-1">
                <button 
                  className="bg-background/50 backdrop-blur p-1 sm:p-1.5 rounded-md hover:bg-background disabled:opacity-30"
                  onClick={goToPreviousImage}
                  disabled={currentImageIndex === 0}
                >
                  <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
                <div className="bg-background/50 backdrop-blur p-1 sm:p-1.5 rounded-md text-center">
                  <span className="text-[10px] sm:text-xs">{currentImageIndex + 1}/{allImages.length}</span>
                </div>
                <button 
                  className="bg-background/50 backdrop-blur p-1 sm:p-1.5 rounded-md hover:bg-background disabled:opacity-30"
                  onClick={goToNextImage}
                  disabled={currentImageIndex === allImages.length - 1}
                >
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
              </div>
            )}
            
            {isLoading ? (
              <div className="relative bg-background shadow-lg border rounded-lg overflow-hidden w-full max-w-2xl mx-auto">
                {/* Skeleton for action buttons */}
                <div className="absolute top-2 right-2 z-10 flex gap-1 sm:gap-2">
                  <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 rounded-md" />
                  <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 rounded-md" />
                  <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 rounded-md" />
                  <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 rounded-md" />
                </div>
                
                {/* Main image skeleton */}
                <div className="relative">
                  <Skeleton className="h-[250px] sm:h-64 md:h-96 w-full rounded-none" />
                  
                  {/* Overlay with generation status */}
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Creating your magic ad...</p>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                          <span className="text-xs text-muted-foreground">10-20 seconds</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress indicator */}
                    <div className="w-full max-w-xs">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full animate-pulse w-2/3"></div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        AI is processing your prompt and generating high-quality imagery
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Skeleton for zoom controls */}
                <div className="absolute right-2 bottom-2">
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              </div>
            ) : currentImage ? (
              <div 
                className="relative group bg-background shadow-lg border rounded-lg overflow-hidden"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                style={{
                  width: `${zoomLevel}%`,
                  maxWidth: '100%',
                }}
              >
                <img 
                  src={currentImage} 
                  alt={`Generated image ${currentImageIndex + 1}`}
                  className="object-contain w-full h-auto cursor-pointer block"
                  style={{
                    maxHeight: '80vh', // Prevent portrait images from being too tall
                  }}
                />
                
                {/* Hover Overlay (Desktop only) */}
                {!isMobile && isHovering && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3 transition-opacity duration-200">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shadow-lg"
                      onClick={() => onEditImage(currentImage)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit This Image
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shadow-lg"
                      onClick={() => onUseAsBase(currentImage)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Use as Example
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[300px] h-full w-full">
                <div className="flex flex-col items-center text-center space-y-6 max-w-sm mx-auto p-4">
                  {/* Simple Icon */}
                  <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-muted-foreground" />
                  </div>
                  
                  {/* Simple heading */}
                  <div className="space-y-2">
                    <h3 className="text-xl font-medium text-foreground">
                      Create your first magic ad
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {isMobile 
                        ? "Switch to the Create tab to start generating amazing ads with AI"
                        : "Add a prompt or upload images to get started"
                      }
                    </p>
                  </div>
                  
                  {/* Simple CTA */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span>{isMobile ? "Tap 'Create' below" : "Use the panel on the left"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>



          {/* Zoom Controls */}
          <div className="absolute right-2 bottom-2 bg-background/80 backdrop-blur rounded-md flex items-center p-0.5 sm:p-1 shadow-sm">
            <button 
              className="p-0.5 sm:p-1 hover:bg-muted rounded-md" 
              onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
              disabled={zoomLevel <= 50 || isLoading || !currentImage}
            >
              <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
            <span className="text-[10px] sm:text-xs px-1 sm:px-2">{zoomLevel}%</span>
            <button 
              className="p-0.5 sm:p-1 hover:bg-muted rounded-md" 
              onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
              disabled={zoomLevel >= 200 || isLoading || !currentImage}
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
            <Separator orientation="vertical" className="mx-0.5 sm:mx-1 h-4 sm:h-5" />
            <button 
              className="p-0.5 sm:p-1 hover:bg-muted rounded-md"
              disabled={isLoading || !currentImage}
            >
              <Maximize className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
          </div>
          
          {/* Multiple Image Thumbnail Preview */}
          {allImages.length > 1 && !isLoading && (
            <div className="mt-2 flex justify-center gap-2 overflow-x-auto py-1">
              {allImages.map((img, index) => (
                <div key={index} className="relative group">
                  <button 
                    className={`h-14 w-14 rounded-md border-2 overflow-hidden flex-shrink-0 transition-all
                      ${currentImageIndex === index ? 'border-primary' : 'border-muted hover:border-muted-foreground/50'}`}
                    onClick={() => setCurrentImageIndex(index)}
                  >
                    <img 
                      src={img} 
                      alt={`Thumbnail ${index + 1}`} 
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <button
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(index);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Prompt Display */}
      {prompt && (
        <div className="p-2 sm:p-4 border-t bg-background/50 backdrop-blur">
          <p className="text-xs sm:text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Prompt:</span> {prompt}
          </p>
        </div>
      )}
    </div>
  )
} 