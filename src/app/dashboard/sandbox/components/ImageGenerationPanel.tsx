import React from "react"
import { BadgeCheck, Shapes, Paintbrush, Layers, Wand2 } from "lucide-react"
import { OptionCards, renderIconOption } from "./OptionCards"

// Define the image styles
export const imageStyles = [
  { id: "photorealistic", name: "Photorealistic", icon: BadgeCheck, color: "text-blue-500", bg: "bg-blue-500", description: "Highly detailed realistic images" },
  { id: "abstract", name: "Abstract", icon: Shapes, color: "text-purple-500", bg: "bg-purple-500", description: "Non-representational art forms" },
  { id: "watercolor", name: "Watercolor", icon: Paintbrush, color: "text-indigo-500", bg: "bg-indigo-500", description: "Soft, paint-like aesthetic" },
  { id: "3drender", name: "3D Render", icon: Layers, color: "text-amber-500", bg: "bg-amber-500", description: "Computer-generated 3D models" },
  { id: "pixelart", name: "Pixel Art", icon: Wand2, color: "text-green-500", bg: "bg-green-500", description: "Retro pixel-based graphics" },
]

// Max prompt length - OpenAI GPT Image 1 has limitations on prompt length  
const MAX_PROMPT_LENGTH = 1000

interface ImageGenerationPanelProps {
  selectedStyle: string
  setSelectedStyle: (style: string) => void
  qualityValue: number
  setQualityValue: (value: number) => void
  prompt: string
  setPrompt: (prompt: string) => void
  imageCount: number
  setImageCount: (count: number) => void
}

export function ImageGenerationPanel({
  selectedStyle,
  setSelectedStyle,
  qualityValue,
  setQualityValue,
  prompt,
  setPrompt,
  imageCount,
  setImageCount
}: ImageGenerationPanelProps) {
  // Calculate the percentage of max length used
  const promptLength = prompt.length
  const isNearLimit = promptLength > MAX_PROMPT_LENGTH * 0.8
  const isOverLimit = promptLength > MAX_PROMPT_LENGTH
  
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prompt</label>
          <span className={`text-xs ${isOverLimit ? 'text-red-500 font-semibold' : isNearLimit ? 'text-amber-500' : 'text-muted-foreground'}`}>
            {promptLength}/{MAX_PROMPT_LENGTH}
          </span>
        </div>
        <textarea 
          className="w-full min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background" 
          placeholder="Describe the image you want to generate..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={MAX_PROMPT_LENGTH + 50} // Allow slightly over the limit with warning
        />
      </div>
      
      <OptionCards
        label="Style"
        options={imageStyles}
        selectedOption={selectedStyle}
        onSelectOption={setSelectedStyle}
        renderIcon={renderIconOption}
      />
      
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Image Count <span className="ml-1 text-xs opacity-70">{imageCount}</span>
        </label>
        <div className="flex justify-between">
          {[1, 2, 3, 4].map(count => (
            <button
              key={count}
              className={`w-12 h-8 rounded-md text-sm ${imageCount === count ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
              onClick={() => setImageCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Quality <span className="ml-1 text-xs opacity-70">{qualityValue >= 75 ? "HD" : "Standard"}</span>
        </label>
        <input 
          type="range" 
          min="1" 
          max="100" 
          step="1" 
          value={qualityValue}
          onChange={(e) => setQualityValue(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-md appearance-none cursor-pointer dark:bg-gray-700"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Standard</span>
          <span>HD</span>
        </div>
      </div>
    </div>
  )
} 