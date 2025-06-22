import { useState, useEffect, useRef } from 'react'

interface UseImageLoaderOptions {
  src: string
  lazy?: boolean
  preload?: boolean
}

export function useImageLoader({ src, lazy = true, preload = false }: UseImageLoaderOptions) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isInView, setIsInView] = useState(!lazy)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (!lazy) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { 
        rootMargin: '50px', // Start loading 50px before coming into view
        threshold: 0.1 
      }
    )

    observerRef.current = observer

    return () => {
      observer.disconnect()
    }
  }, [lazy])

  useEffect(() => {
    const currentImgRef = imgRef.current // ✅ Capture the ref value
    if (!currentImgRef || !lazy) return

    if (observerRef.current) {
      observerRef.current.observe(currentImgRef)
    }

    return () => {
      // ✅ Use the captured value in cleanup
      if (observerRef.current && currentImgRef) {
        observerRef.current.unobserve(currentImgRef)
      }
    }
  }, [lazy])

  useEffect(() => {
    if (!src || (!isInView && lazy)) return

    const img = new Image()
    
    img.onload = () => {
      setIsLoaded(true)
      setIsError(false)
    }
    
    img.onerror = () => {
      setIsError(true)
      setIsLoaded(false)
    }

    // Start loading
    img.src = src

    // Preload next images if enabled
    if (preload) {
      img.loading = 'eager'
    }

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [src, isInView, lazy, preload])

  return {
    imgRef,
    isLoaded,
    isError,
    shouldLoad: isInView || !lazy
  }
} 