import React from "react"
import { History, Star, Copy, Trash2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface HistoryItem {
  id: string
  url: string
  prompt: string
  date: string
  starred: boolean
}

interface HistoryPanelProps {
  historyItems: HistoryItem[]
  onSelectItem?: (item: HistoryItem) => void
  onCopyItem?: (item: HistoryItem) => void
  onDeleteItem?: (item: HistoryItem) => void
  onToggleStar?: (item: HistoryItem) => void
  onDownloadItem?: (item: HistoryItem) => void
}

export function HistoryPanel({
  historyItems = [],
  onSelectItem = () => {},
  onCopyItem = () => {},
  onDeleteItem = () => {},
  onToggleStar = () => {},
  onDownloadItem = () => {}
}: HistoryPanelProps) {
  return (
    <div className="w-full md:w-64 h-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex flex-col">
      <div className="p-3 md:p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">History</h3>
          <History className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        {historyItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs p-4 text-center">
            <History className="h-8 w-8 mb-2 opacity-20" />
            <p>No generation history yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-1">
            {historyItems.map((item) => (
              <div 
                key={item.id} 
                className="p-2 sm:p-3 border-b hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => onSelectItem(item)}
              >
                <div className="relative aspect-square mb-2">
                  <img 
                    src={item.url} 
                    alt={item.prompt}
                    className="w-full h-full object-cover rounded-md" 
                  />
                  <div className="absolute top-1 right-1">
                    {item.starred && (
                      <Star className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-400 fill-yellow-400" />
                    )}
                  </div>
                  <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/50 flex items-center justify-center transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 sm:h-8 sm:w-8 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(item);
                      }}
                    >
                      <Star className={`h-3 w-3 sm:h-4 sm:w-4 ${item.starred ? "fill-yellow-400 text-yellow-400" : ""}`} />
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">{item.prompt}</p>
                <div className="flex items-center justify-between mt-1 sm:mt-2">
                  <span className="text-[8px] sm:text-[10px] text-muted-foreground">{item.date}</span>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 sm:h-6 sm:w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadItem(item);
                      }}
                    >
                      <Download className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 sm:h-6 sm:w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyItem(item);
                      }}
                    >
                      <Copy className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 sm:h-6 sm:w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(item);
                      }}
                    >
                      <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </Button>
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