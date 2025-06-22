import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const imageUrl = searchParams.get('url')
    const filename = searchParams.get('filename')
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }
    
    // Fetch the image from the provided URL
    const response = await fetch(imageUrl)
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.statusText}` },
        { status: response.status }
      )
    }
    
    // Get the image data
    const imageData = await response.arrayBuffer()
    
    // Determine content type
    const contentType = response.headers.get('content-type') || 'image/png'
    
    // Generate filename if not provided
    let downloadFilename = filename
    if (!downloadFilename) {
      // Try to extract filename from URL
      const urlParts = imageUrl.split('/')
      const lastPart = urlParts[urlParts.length - 1]
      
      if (lastPart.includes('.')) {
        downloadFilename = lastPart.split('?')[0] // Remove query params
      } else {
        // Default filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const extension = contentType.includes('jpeg') ? 'jpg' : 
                         contentType.includes('png') ? 'png' : 
                         contentType.includes('gif') ? 'gif' : 'png'
        downloadFilename = `generated-image-${timestamp}.${extension}`
      }
    }
    
    // Return the image with appropriate headers for download
    return new NextResponse(imageData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${downloadFilename}"`,
        'Content-Length': imageData.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('Error in image download API:', error)
    return NextResponse.json(
      { error: 'Failed to download image' },
      { status: 500 }
    )
  }
} 