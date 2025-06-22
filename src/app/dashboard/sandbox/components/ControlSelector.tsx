import React from "react"
import { Image, UserRound, Edit } from "lucide-react"

interface Control {
  id: string
  name: string
  icon: React.ElementType
  description: string
}

export const controls: Control[] = [
  {
    id: "image",
    name: "Image Generation",
    icon: Image,
    description: "Create AI-generated images",
  },
  {
    id: "character",
    name: "Character Generation",
    icon: UserRound,
    description: "Generate unique characters",
  },
  {
    id: "inpainting",
    name: "Image Inpainting",
    icon: Edit,
    description: "Edit existing images",
  }
]

interface ControlSelectorProps {
  selectedControl: string | null
  onSelectControl: (controlId: string) => void
}

export function ControlSelector({ selectedControl, onSelectControl }: ControlSelectorProps) {
  return (
    <div className="space-y-1 mt-2">
      {controls.map((control) => (
        <div 
          key={control.id} 
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
            selectedControl === control.id 
              ? "bg-primary/10 text-primary" 
              : "hover:bg-muted"
          }`}
          onClick={() => onSelectControl(control.id)}
        >
          <div className="bg-primary/10 text-primary rounded-md p-1.5">
            <control.icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-medium text-sm">{control.name}</h3>
            <p className="text-xs text-muted-foreground">{control.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
} 