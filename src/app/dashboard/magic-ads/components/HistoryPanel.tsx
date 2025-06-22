import React from "react"
import { History, Star, Copy, Trash2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export interface HistoryItem {
  id: string
  url: string
  prompt: string
  date: string
  starred: boolean
  createdAt?: number // Optional timestamp for sorting
}

interface HistoryPanelProps {
  historyItems: HistoryItem[]
  isLoading?: boolean
  onSelectItem?: (item: HistoryItem) => void
  onCopyItem?: (item: HistoryItem) => void
  onDeleteItem?: (item: HistoryItem) => void
  onToggleStar?: (item: HistoryItem) => void
  onDownloadItem?: (item: HistoryItem) => void
}

export function HistoryPanel({
  historyItems = [],
  isLoading = false,
  onSelectItem = () => {},
  onCopyItem = () => {},
  onDeleteItem = () => {},
  onToggleStar = () => {},
  onDownloadItem = () => {}
}: HistoryPanelProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {/* Skeleton loading items */}
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="relative aspect-square mb-3">
                  <Skeleton className="w-full h-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : historyItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
            <History className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-medium mb-1">No generation history yet</p>
            <p className="text-xs text-muted-foreground/70">
              Generated ads will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {historyItems.map((item) => (
              <div 
                key={item.id} 
                className="group p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-all hover:shadow-sm"
                onClick={() => onSelectItem(item)}
              >
                <div className="relative aspect-square mb-3">
                  <img 
                    src={item.url} 
                    alt={item.prompt}
                    className="w-full h-full object-cover rounded-md" 
                  />
                  
                  {/* Star indicator */}
                  {item.starred && (
                    <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1">
                      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    </div>
                  )}
                  
                  {/* Hover overlay with actions */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/60 dark:bg-black/60 flex items-center justify-center gap-1 transition-opacity rounded-md">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="h-8 w-8 p-0 bg-background/90 hover:bg-background shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(item);
                      }}
                    >
                      <Star className={`h-3 w-3 ${item.starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="h-8 w-8 p-0 bg-background/90 hover:bg-background shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadItem(item);
                      }}
                    >
                      <Download className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="h-8 w-8 p-0 bg-background/90 hover:bg-background shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyItem(item);
                      }}
                    >
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="h-8 w-8 p-0 bg-background/90 hover:bg-background shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(item);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                
                {/* Item details */}
                <div className="space-y-2">
                  <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
                    {item.prompt}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{item.date}</span>
                    {item.starred && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-yellow-600 dark:text-yellow-400">Starred</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 