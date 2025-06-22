"use client"

import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import Script from "next/script"
import { YouTubePlayer } from "@/types/youtube"
import { createPortal } from "react-dom"

interface VideoPlayerProps {
  videoId: string;
  title?: string;
  isOpen: boolean;
  autoplay?: boolean;
}

export function VideoPlayer({
  videoId,
  title = "Video Player",
  isOpen,
  autoplay = true,
}: VideoPlayerProps) {
  const [youtubeApiReady, setYoutubeApiReady] = useState(false)
  const [mounted, setMounted] = useState(false)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const [playerKey, setPlayerKey] = useState(Date.now())

  // Handle mounting for portal
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Load YouTube API
  useEffect(() => {
    const checkYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        setYoutubeApiReady(true)
        return true
      }
      return false
    }

    if (!checkYouTubeAPI()) {
      // Set up the callback for when API loads
      window.onYouTubeIframeAPIReady = () => {
        setYoutubeApiReady(true)
      }
      
      // Also check periodically in case the callback was missed
      const intervalId = setInterval(() => {
        if (checkYouTubeAPI()) {
          clearInterval(intervalId)
        }
      }, 100)

      return () => {
        clearInterval(intervalId)
        if (playerRef.current) {
          playerRef.current.destroy()
          playerRef.current = null
        }
      }
    } else {
      setYoutubeApiReady(true)
    }
    
    setPlayerKey(Date.now())

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [isOpen])

  // Initialize YouTube player when API is ready
  useEffect(() => {
    const createPlayer = () => {
      // Double-check that YouTube API is available
      if (!window.YT || !window.YT.Player) {
        console.error('YouTube API not loaded')
        return
      }

      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }

      try {
        playerRef.current = new window.YT.Player(`youtube-player-${playerKey}`, {
          videoId,
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onStateChange: (event: { data: number }) => {
              // Video ended (state = 0)
              if (event.data === 0) {
                // Dispatch custom event for video completion
                window.dispatchEvent(new CustomEvent('videoComplete', { detail: { videoId } }))
              }
            }
          }
        })
      } catch (error) {
        console.error('Failed to create YouTube player:', error)
      }
    }

    if (youtubeApiReady && isOpen && window.YT && window.YT.Player) {
      setTimeout(createPlayer, 0)
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [youtubeApiReady, videoId, autoplay, playerKey, isOpen])

  const handleClose = () => {
    // Dispatch custom event for modal close
    window.dispatchEvent(new CustomEvent('videoModalClose'))
  }

  if (!isOpen || !mounted) return null

  const modalContent = (
    <>
      {/* YouTube API Script */}
      <Script src="https://www.youtube.com/iframe_api" strategy="lazyOnload" />

      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-card rounded-lg shadow-xl w-full max-w-4xl overflow-hidden relative border border-border">
          <div className="p-4 flex justify-between items-center border-b border-border">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="aspect-video bg-muted">
            <div id={`youtube-player-${playerKey}`} className="w-full h-full"></div>
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(modalContent, document.body)
} 