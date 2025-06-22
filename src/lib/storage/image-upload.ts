import { SupabaseClient } from '@supabase/supabase-js'

export interface ImageUploadResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Converts a data URL (base64) to a blob
 * @param dataUrl - Data URL string (e.g., "data:image/png;base64,...")
 * @returns Blob and content type
 */
function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string } {
  const [header, base64Data] = dataUrl.split(',')
  const contentType = header.match(/data:([^;]+)/)?.[1] || 'image/png'
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: contentType })
  
  return { blob, contentType }
}

/**
 * Downloads an image from a temporary URL and uploads it to Supabase Storage
 * @param supabase - Supabase client
 * @param tempUrl - Temporary image URL or data URL (e.g., from OpenAI)
 * @param organizationId - Organization ID for folder structure
 * @param filename - Desired filename for the stored image
 * @returns Promise with upload result
 */
export async function uploadImageFromUrl(
  supabase: SupabaseClient,
  tempUrl: string,
  organizationId: string,
  filename: string
): Promise<ImageUploadResult> {
  try {
    let imageBlob: Blob
    let contentType: string
    
    // Check if this is a data URL (base64)
    if (tempUrl.startsWith('data:')) {
      const result = dataUrlToBlob(tempUrl)
      imageBlob = result.blob
      contentType = result.contentType
    } else {
      // Download the image from the temporary URL
      const response = await fetch(tempUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
      }

      // Get the image as a blob
      imageBlob = await response.blob()
      contentType = response.headers.get('content-type') || 'image/png'
    }
    
    // Determine the file extension based on content type
    const extension = contentType.includes('jpeg') ? 'jpg' : 
                    contentType.includes('webp') ? 'webp' : 'png'
    
    // Create the storage path: organization_id/session_id/filename.ext
    const storagePath = `${organizationId}/${filename}.${extension}`
    
    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('generated-images')
      .upload(storagePath, imageBlob, {
        contentType,
        cacheControl: '3600',
        upsert: false // Don't overwrite existing files
      })

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`)
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('generated-images')
      .getPublicUrl(storagePath)

    return {
      success: true,
      url: publicUrl
    }
  } catch (error) {
    console.error('Error uploading image:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Batch upload multiple images from temporary URLs
 * @param supabase - Supabase client
 * @param tempUrls - Array of temporary image URLs
 * @param organizationId - Organization ID for folder structure
 * @param baseFilename - Base filename (will be appended with index)
 * @returns Promise with array of upload results
 */
export async function uploadImagesFromUrls(
  supabase: SupabaseClient,
  tempUrls: string[],
  organizationId: string,
  baseFilename: string
): Promise<ImageUploadResult[]> {
  const results: ImageUploadResult[] = []
  
  // Process uploads sequentially to avoid overwhelming the API
  for (let i = 0; i < tempUrls.length; i++) {
    const filename = tempUrls.length > 1 ? `${baseFilename}_${i + 1}` : baseFilename
    const result = await uploadImageFromUrl(supabase, tempUrls[i], organizationId, filename)
    results.push(result)
  }
  
  return results
} 