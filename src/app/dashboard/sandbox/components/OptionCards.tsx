import React, { useRef } from "react"
import { ScrollNavigation } from "./ScrollNavigation"

interface OptionBase {
  id: string
  name: string
  description: string
}

interface IconOption extends OptionBase {
  icon: React.ElementType
  color: string
  bg: string
}

interface ColorOption extends OptionBase {
  color: string
}

export interface OptionCardsProps<T extends OptionBase> {
  label: string
  options: T[]
  selectedOption: string
  onSelectOption: (optionId: string) => void
  cardWidth?: string
  renderIcon: (option: T) => React.ReactNode
}

export function OptionCards<T extends OptionBase>({
  label,
  options,
  selectedOption,
  onSelectOption,
  cardWidth = "w-[130px]",
  renderIcon,
}: OptionCardsProps<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="relative">
        <div 
          ref={scrollRef}
          className="flex overflow-x-auto pb-2 gap-2 scrollbar-none"
        >
          {options.map((option) => (
            <div
              key={option.id}
              className={`flex-shrink-0 ${cardWidth} flex flex-col items-center p-2 border rounded-md cursor-pointer transition-all ${
                selectedOption === option.id
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-border hover:bg-muted"
              }`}
              onClick={() => onSelectOption(option.id)}
            >
              <div className="h-8 flex items-center justify-center">
                {renderIcon(option)}
              </div>
              <span className="text-xs font-medium mt-1">{option.name}</span>
              <span className="text-[10px] text-muted-foreground text-center line-clamp-2">{option.description}</span>
            </div>
          ))}
        </div>
        <ScrollNavigation scrollRef={scrollRef} />
      </div>
    </div>
  )
}

// Helper functions for common option types
export function renderIconOption(option: IconOption) {
  const Icon = option.icon
  return (
    <div className={`rounded-full p-1 ${option.color}`}>
      <Icon className="h-5 w-5" />
    </div>
  )
}

export function renderColorCircle(option: ColorOption) {
  return <div className={`h-5 w-5 rounded-full ${option.color}`} />
}

export function renderPoseOption(option: OptionBase, isSelected: boolean) {
  return (
    <div className={`h-6 w-6 rounded-full border-2 ${isSelected ? "border-primary" : "border-muted-foreground"}`} />
  )
} 