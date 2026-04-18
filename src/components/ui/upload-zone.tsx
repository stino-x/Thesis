import * as React from "react"
import { Upload } from "lucide-react"
import { cn } from "@/lib/utils"

interface UploadZoneProps extends React.HTMLAttributes<HTMLDivElement> {
  onDrop?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onClick?: () => void
  isDragging?: boolean
  title?: string
  description?: string
  accept?: string
}

const UploadZone = React.forwardRef<HTMLDivElement, UploadZoneProps>(
  ({ 
    className, 
    onDrop, 
    onDragOver, 
    onClick, 
    isDragging = false,
    title = "Drop your file here or click to browse",
    description = "Supports common image and video formats",
    ...props 
  }, ref) => {
    const [isHovering, setIsHovering] = React.useState(false)

    const handleDragEnter = (e: React.DragEvent) => {
      e.preventDefault()
      setIsHovering(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault()
      setIsHovering(false)
    }

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      setIsHovering(false)
      onDrop?.(e)
    }

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      onDragOver?.(e)
    }

    return (
      <div
        ref={ref}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onClick={onClick}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-300",
          "hover:border-primary hover:bg-primary/5 hover:shadow-lg",
          "active:scale-[0.99] active:shadow-md",
          isHovering && "border-primary bg-primary/10 shadow-xl scale-[1.02]",
          "group",
          className
        )}
        {...props}
      >
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            "p-4 rounded-full bg-primary/10 transition-all duration-300",
            "group-hover:bg-primary/20 group-hover:scale-110",
            isHovering && "bg-primary/30 scale-125"
          )}>
            <Upload className={cn(
              "h-12 w-12 text-primary transition-all duration-300",
              "group-hover:scale-110",
              isHovering && "scale-125 animate-bounce"
            )} />
          </div>
          
          <div className="space-y-2">
            <p className={cn(
              "text-lg font-medium transition-colors duration-300",
              isHovering && "text-primary"
            )}>
              {title}
            </p>
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          </div>

          {/* Animated border effect */}
          <div className={cn(
            "absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300",
            "bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20",
            isHovering && "opacity-100 animate-pulse"
          )} />
        </div>
      </div>
    )
  }
)

UploadZone.displayName = "UploadZone"

export { UploadZone }
