import * as React from "react"

import { cn } from "@/lib/utils"

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxRows?: number
}

const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(({ className, maxRows, onChange, ...props }, ref) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const [text, setText] = React.useState("")

  // Merge refs
  React.useImperativeHandle(ref, () => textareaRef.current!)

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = event.currentTarget
      setText(textarea.value)
      
      if (onChange) {
        onChange(event)
      }
    },
    [onChange]
  )

  React.useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto"
    
    // Calculate new height
    let newHeight = textarea.scrollHeight
    
    // Apply max height if maxRows is specified
    if (maxRows) {
      // Calculate line height (approximately)
      const lineHeight = parseInt(
        window.getComputedStyle(textarea).lineHeight || "20"
      )
      const maxHeight = lineHeight * maxRows + 
        // Account for padding, border, etc.
        (parseInt(window.getComputedStyle(textarea).paddingTop) + 
         parseInt(window.getComputedStyle(textarea).paddingBottom))
      
      newHeight = Math.min(newHeight, maxHeight)
    }
    
    textarea.style.height = `${newHeight}px`
  }, [text, maxRows])

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none overflow-hidden",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      ref={textareaRef}
      onChange={handleChange}
      {...props}
    />
  )
})
AutoResizeTextarea.displayName = "AutoResizeTextarea"

export { AutoResizeTextarea } 