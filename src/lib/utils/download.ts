/**
 * Download an image from a URL or data URL
 * Works with both Supabase Storage URLs, data URLs, and other image URLs
 */
export async function downloadImage(url: string, filename?: string): Promise<void> {
  try {
    // Generate filename if not provided
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      filename = `generated-image-${timestamp}.png`
    }
    
    // Handle data URLs directly on client side
    if (url.startsWith('data:')) {
      // Create download link for data URL
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      
      // Trigger download
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      return
    }
    
    // For regular URLs, use our API route to proxy the download
    let downloadUrl = `/api/download/image?url=${encodeURIComponent(url)}`
    if (filename) {
      downloadUrl += `&filename=${encodeURIComponent(filename)}`
    }
    
    // Create download link that points to our API
    const link = document.createElement('a')
    link.href = downloadUrl
    link.target = '_blank' // Open in new tab as fallback
    
    // Trigger download
    document.body.appendChild(link)
    link.click()
    
    // Cleanup
    document.body.removeChild(link)
  } catch (error) {
    console.error('Error downloading image:', error)
    throw error
  }
} 