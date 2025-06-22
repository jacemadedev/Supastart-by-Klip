import React from "react"
import { Upload, BadgeCheck, Sparkles, ImagePlus, Paintbrush } from "lucide-react"
import { OptionCards, renderIconOption } from "./OptionCards"

// Define inpainting styles
export const inpaintingStyles = [
  { id: "match", name: "Match Original", icon: BadgeCheck, color: "text-blue-500", bg: "bg-blue-500", description: "Seamlessly match the original image style" },
  { id: "enhance", name: "Enhance", icon: Sparkles, color: "text-purple-500", bg: "bg-purple-500", description: "Improve quality of selected area" },
  { id: "replace", name: "Replace", icon: ImagePlus, color: "text-indigo-500", bg: "bg-indigo-500", description: "Completely replace with new content" },
  { id: "artistic", name: "Artistic", icon: Paintbrush, color: "text-amber-500", bg: "bg-amber-500", description: "Apply artistic style to area" },
]

interface InpaintingPanelProps {
  selectedStyle: string
  setSelectedStyle: (style: string) => void
}

export function InpaintingPanel({
  selectedStyle,
  setSelectedStyle
}: InpaintingPanelProps) {
  return (
    <div className="space-y-6">
      <div className="border border-input rounded-md bg-transparent p-2 flex items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors">
        <div className="flex flex-col items-center gap-3 py-6">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Select image to edit</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prompt</label>
        <textarea 
          className="w-full min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background" 
          placeholder="Describe what to generate in the selected area..."
        />
      </div>
      
      <OptionCards
        label="Inpainting Style"
        options={inpaintingStyles}
        selectedOption={selectedStyle}
        onSelectOption={setSelectedStyle}
        renderIcon={renderIconOption}
      />
    </div>
  )
} 