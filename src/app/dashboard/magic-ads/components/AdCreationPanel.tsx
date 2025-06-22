import React, { useState, useRef } from "react"
import { Send, Upload, Trash2, ChevronDown, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface AdCreationPanelProps {
  onGenerate?: (prompt: string, images?: File[], size?: string) => void
  isLoading?: boolean
  // Controlled state props for external manipulation
  prompt?: string
  onPromptChange?: (prompt: string) => void
  adExampleImages?: File[]
  onAdExampleImagesChange?: (images: File[]) => void
  productImages?: File[]
  onProductImagesChange?: (images: File[]) => void
}

export function AdCreationPanel({ 
  onGenerate, 
  isLoading = false,
  // Controlled state props
  prompt: externalPrompt,
  onPromptChange,
  adExampleImages: externalAdExampleImages,
  onAdExampleImagesChange,
  productImages: externalProductImages,
  onProductImagesChange
}: AdCreationPanelProps) {
  // Use controlled state if provided, otherwise use internal state
  const [internalInputValue, setInternalInputValue] = useState("")
  const [internalAdExampleImages, setInternalAdExampleImages] = useState<File[]>([])
  const [internalProductImages, setInternalProductImages] = useState<File[]>([])
  const [selectedSize, setSelectedSize] = useState<string>("auto")

  // Determine which state to use
  const inputValue = externalPrompt !== undefined ? externalPrompt : internalInputValue
  const adExampleImages = externalAdExampleImages !== undefined ? externalAdExampleImages : internalAdExampleImages
  const productImages = externalProductImages !== undefined ? externalProductImages : internalProductImages

  // State setters that work with both controlled and uncontrolled modes
  const setInputValue = (value: string) => {
    if (onPromptChange) {
      onPromptChange(value)
    } else {
      setInternalInputValue(value)
    }
  }

  const setAdExampleImages = (images: File[] | ((prev: File[]) => File[])) => {
    const newImages = typeof images === 'function' ? images(adExampleImages) : images
    if (onAdExampleImagesChange) {
      onAdExampleImagesChange(newImages)
    } else {
      setInternalAdExampleImages(newImages)
    }
  }

  const setProductImages = (images: File[] | ((prev: File[]) => File[])) => {
    const newImages = typeof images === 'function' ? images(productImages) : images
    if (onProductImagesChange) {
      onProductImagesChange(newImages)
    } else {
      setInternalProductImages(newImages)
    }
  }

  const adExampleInputRef = useRef<HTMLInputElement>(null)
  const productInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const allImages = [...adExampleImages, ...productImages]
    
    if (!inputValue.trim() && allImages.length === 0) {
      toast.error("Please provide a prompt or upload images")
      return
    }

    // Call the generate function if provided
    if (onGenerate) {
      onGenerate(inputValue, allImages.length > 0 ? allImages : undefined, selectedSize)
    }

    // Clear input - only if not in controlled mode
    if (externalPrompt === undefined) {
      setInputValue("")
    }
    if (externalAdExampleImages === undefined) {
      setAdExampleImages([])
    }
    if (externalProductImages === undefined) {
      setProductImages([])
    }
  }

  const handleAdExampleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length !== files.length) {
      toast.error("Only image files are allowed")
    }

    const totalImages = adExampleImages.length + productImages.length + imageFiles.length
    if (totalImages > 16) {
      toast.error("Maximum 16 images total allowed")
      return
    }

    if (adExampleImages.length + imageFiles.length > 8) {
      toast.error("Maximum 8 ad example images allowed")
      return
    }

    setAdExampleImages(prev => [...prev, ...imageFiles.slice(0, 8 - prev.length)])
  }

  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length !== files.length) {
      toast.error("Only image files are allowed")
    }

    const totalImages = adExampleImages.length + productImages.length + imageFiles.length
    if (totalImages > 16) {
      toast.error("Maximum 16 images total allowed")
      return
    }

    if (productImages.length + imageFiles.length > 8) {
      toast.error("Maximum 8 product images allowed")
      return
    }

    setProductImages(prev => [...prev, ...imageFiles.slice(0, 8 - prev.length)])
  }

  const removeAdExampleImage = (index: number) => {
    setAdExampleImages(prev => prev.filter((_, i) => i !== index))
  }

  const removeProductImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index))
  }

  // Aspect ratio options for GPT-Image-1
  const aspectRatioOptions = [
    { value: "1024x1024", label: "Square (1:1)", description: "Instagram posts, profile images" },
    { value: "1536x1024", label: "Landscape (3:2)", description: "Facebook ads, banners" },
    { value: "1024x1536", label: "Portrait (2:3)", description: "Instagram stories, mobile ads" },
    { value: "auto", label: "Auto", description: "AI chooses best ratio" }
  ]

  return (
    <div className="flex flex-col space-y-4 min-h-0">
      {/* Combined Images Section */}
      <Card className="flex-shrink-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ImageIcon className="h-4 w-4" />
            Upload Images {(adExampleImages.length + productImages.length) > 0 && `(${adExampleImages.length + productImages.length}/16)`}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Upload ad examples for style inspiration and product photos to feature in your ad
          </p>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* Display all images together */}
          {(adExampleImages.length > 0 || productImages.length > 0) && (
            <div className="space-y-3">
              {/* Ad Examples */}
              {adExampleImages.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Ad Examples ({adExampleImages.length})</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {adExampleImages.map((file, index) => (
                      <div key={`ad-${index}`} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Ad Example ${index + 1}`}
                          className="w-full h-20 object-cover rounded-md border"
                        />
                        <button
                          className="absolute -top-1 -right-1 bg-background/90 text-muted-foreground hover:bg-background hover:text-foreground rounded-full p-1 text-xs transition-colors shadow-sm border"
                          onClick={() => removeAdExampleImage(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Product Images */}
              {productImages.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Product Images ({productImages.length})</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {productImages.map((file, index) => (
                      <div key={`product-${index}`} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Product Image ${index + 1}`}
                          className="w-full h-20 object-cover rounded-md border"
                        />
                        <button
                          className="absolute -top-1 -right-1 bg-background/90 text-muted-foreground hover:bg-background hover:text-foreground rounded-full p-1 text-xs transition-colors shadow-sm border"
                          onClick={() => removeProductImage(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Upload Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex flex-col items-center justify-center h-20 rounded-xl border-2 border-dashed border-border hover:border-muted-foreground/50 hover:bg-muted/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              onClick={() => adExampleInputRef.current?.click()}
              disabled={adExampleImages.length >= 8}
            >
              <Upload className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors mb-1" />
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Ad Examples</span>
            </button>
            
            <button
              type="button"
              className="flex flex-col items-center justify-center h-20 rounded-xl border-2 border-dashed border-border hover:border-muted-foreground/50 hover:bg-muted/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              onClick={() => productInputRef.current?.click()}
              disabled={productImages.length >= 8}
            >
              <Upload className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors mb-1" />
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Product Photos</span>
            </button>
          </div>
          
          <input
            ref={adExampleInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleAdExampleUpload}
          />
          
          <input
            ref={productInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleProductUpload}
          />
        </CardContent>
      </Card>

      {/* Prompt Section */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ImageIcon className="h-4 w-4" />
            Prompt
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Describe the magic ad you want to create
          </p>
        </CardHeader>
        <CardContent className="pt-0 flex-1 flex flex-col min-h-0">
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Modern Input Container */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-start rounded-2xl border border-border bg-card/80 backdrop-blur-xl hover:bg-card/90 shadow-sm px-4 py-3 transition-all dark:bg-card/50 dark:hover:bg-card/60 flex-1 min-h-0">
                <div className="relative flex-grow min-w-0 flex-1">
                  <textarea 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Describe the magic ad you want to create, or ask me to edit an existing image..."
                    className="w-full bg-transparent text-foreground placeholder:text-muted-foreground text-base outline-none resize-none py-2 overflow-y-auto leading-6 flex-1 min-h-[120px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit(e)
                      }
                    }}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
            
            {/* Controls Row */}
            <div className="flex flex-col gap-3 flex-shrink-0">
              <div className="flex gap-2 items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-shrink-0 rounded-full px-3.5 text-sm font-medium">
                      {aspectRatioOptions.find(option => option.value === selectedSize)?.label || "Square"}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {aspectRatioOptions.map((option) => (
                      <DropdownMenuItem 
                        key={option.value} 
                        onClick={() => setSelectedSize(option.value)}
                        className="flex flex-col items-start py-2"
                      >
                        <span className="text-sm font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button
                  type="submit"
                  className="flex-1 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-all"
                  disabled={!inputValue.trim() && adExampleImages.length === 0 && productImages.length === 0 || isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Create Magic Ad
                    </>
                  )}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Press Enter to create, Shift+Enter for new line
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 