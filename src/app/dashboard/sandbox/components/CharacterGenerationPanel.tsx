import React from "react"
import { Sparkles, UserCircle, Bot, Cat, PenTool } from "lucide-react"
import { OptionCards, renderIconOption, renderColorCircle, renderPoseOption } from "./OptionCards"

// Define character types
export const characterTypes = [
  { id: "human", name: "Human", icon: UserCircle, color: "text-slate-500", bg: "bg-slate-500", description: "Realistic human characters" },
  { id: "fantasy", name: "Fantasy", icon: Sparkles, color: "text-violet-500", bg: "bg-violet-500", description: "Magical and mythical beings" },
  { id: "scifi", name: "Sci-Fi", icon: Bot, color: "text-cyan-500", bg: "bg-cyan-500", description: "Futuristic and technological" },
  { id: "animal", name: "Animal", icon: Cat, color: "text-amber-500", bg: "bg-amber-500", description: "Wildlife and creatures" },
  { id: "cartoon", name: "Cartoon", icon: PenTool, color: "text-pink-500", bg: "bg-pink-500", description: "Stylized animated characters" },
]

// Define poses
export const poses = [
  { id: "portrait", name: "Portrait", description: "Head and shoulders" },
  { id: "fullbody", name: "Full Body", description: "Complete character" },
  { id: "action", name: "Action Pose", description: "Dynamic movement" },
  { id: "sitting", name: "Sitting", description: "Seated position" },
  { id: "custom", name: "Custom", description: "Specific pose" },
]

// Define character styles
export const characterStyles = [
  { id: "realistic", name: "Realistic", description: "Photorealistic rendering", color: "bg-slate-600" },
  { id: "anime", name: "Anime", description: "Japanese animation style", color: "bg-indigo-500" },
  { id: "comic", name: "Comic Book", description: "Stylized comic art", color: "bg-amber-500" },
  { id: "3d", name: "3D Rendered", description: "Computer generated", color: "bg-cyan-500" },
  { id: "pixel", name: "Pixel Art", description: "Retro pixel style", color: "bg-green-500" },
]

interface CharacterGenerationPanelProps {
  selectedType: string
  setSelectedType: (type: string) => void
  selectedPose: string
  setSelectedPose: (pose: string) => void
  selectedStyle: string
  setSelectedStyle: (style: string) => void
}

export function CharacterGenerationPanel({
  selectedType,
  setSelectedType,
  selectedPose,
  setSelectedPose,
  selectedStyle,
  setSelectedStyle
}: CharacterGenerationPanelProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
        <textarea 
          className="w-full min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background" 
          placeholder="Describe the character you want to generate..."
        />
      </div>
      
      <OptionCards
        label="Character Type"
        options={characterTypes}
        selectedOption={selectedType}
        onSelectOption={setSelectedType}
        renderIcon={renderIconOption}
      />
      
      <OptionCards
        label="Pose"
        options={poses}
        selectedOption={selectedPose}
        onSelectOption={setSelectedPose}
        cardWidth="w-[110px]"
        renderIcon={(option) => renderPoseOption(option, option.id === selectedPose)}
      />
      
      <OptionCards
        label="Style"
        options={characterStyles}
        selectedOption={selectedStyle}
        onSelectOption={setSelectedStyle}
        cardWidth="w-[110px]"
        renderIcon={(option) => renderColorCircle({ ...option, color: option.color })}
      />
    </div>
  )
} 