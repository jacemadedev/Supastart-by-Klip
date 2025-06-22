import React from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface ActionButtonsProps {
  selectedControl: string | null
  onAction?: () => void
  onGenerate?: () => void
  isLoading?: boolean
}

export function ActionButtons({ 
  selectedControl, 
  onAction,
  onGenerate,
  isLoading = false
}: ActionButtonsProps) {
  const handleGenerate = () => {
    if (onGenerate) onGenerate()
    if (onAction) onAction()
  }

  return (
    <div className="mt-auto px-2 space-y-2 pt-4">
      <Button className="w-full" onClick={handleGenerate} disabled={isLoading || selectedControl !== "image"}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Working...
          </>
        ) : (
          selectedControl === "image" ? "Generate" : 
          "Coming Soon"
        )}
      </Button>
    </div>
  )
} 