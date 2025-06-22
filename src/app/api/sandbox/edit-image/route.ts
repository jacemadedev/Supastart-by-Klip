import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAndDeductCredits, getUserAndOrganization } from "@/lib/supabase/credits";
import { 
  CREDIT_ERRORS,
  CREDIT_COSTS
} from "@/lib/supabase/creditConstants";
import { uploadImagesFromUrls, ImageUploadResult } from "@/lib/storage/image-upload";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI();

/**
 * Prepares images for GPT-Image-1 API
 * GPT-Image-1 supports up to 16 images natively as an array
 * @param imageFiles - Array of image files
 * @returns Single image or array of images for the API
 */
function prepareImagesForAPI(imageFiles: File[]): File | File[] {
  if (imageFiles.length === 1) {
    return imageFiles[0];
  }
  
  // GPT-Image-1 supports multiple images natively (up to 16)
  console.log(`Sending ${imageFiles.length} images to GPT-Image-1 for editing`);
  return imageFiles;
}

/**
 * API route for editing images with OpenAI
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // Extract form data
    const prompt = formData.get('prompt') as string;
    const count = parseInt(formData.get('count') as string) || 1;
    const quality = formData.get('quality') as string || 'medium';
    const size = formData.get('size') as string || '1024x1024';
    const sessionId = formData.get('sessionId') as string || null;
    const sessionType = formData.get('sessionType') as string || 'sandbox';
    
    // Get image files
    const imageFiles: File[] = [];
    let fileIndex = 0;
    while (formData.get(`image_${fileIndex}`)) {
      const file = formData.get(`image_${fileIndex}`) as File;
      imageFiles.push(file);
      fileIndex++;
    }
    
    // Also check for single image field
    const singleImage = formData.get('image') as File;
    if (singleImage && imageFiles.length === 0) {
      imageFiles.push(singleImage);
    }
    
    // Validate input
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required for editing" },
        { status: 400 }
      );
    }

    if (count < 1 || count > 10) {
      return NextResponse.json(
        { error: "Count must be between 1 and 10" },
        { status: 400 }
      );
    }

    // Validate image files (GPT-Image-1 supports up to 16 images)
    if (imageFiles.length > 16) {
      return NextResponse.json(
        { error: "Maximum 16 images allowed for GPT-Image-1" },
        { status: 400 }
      );
    }

    for (const file of imageFiles) {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json(
          { error: "All files must be images" },
          { status: 400 }
        );
      }
      
      // Check file size (50MB for gpt-image-1)
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Image files must be less than 50MB each" },
          { status: 400 }
        );
      }
    }
    
    // Validate size parameter for GPT Image 1
    const validSizes = ["1024x1024", "1536x1024", "1024x1536", "auto"];
    if (!validSizes.includes(size)) {
      return NextResponse.json(
        { error: "Size must be one of: 1024x1024, 1536x1024, 1024x1536, auto" },
        { status: 400 }
      );
    }
    
    // Create Supabase client
    const supabase = await createClient();
    
    // Get user and organization
    const userOrg = await getUserAndOrganization(supabase);
    
    if (!userOrg.success) {
      return NextResponse.json(
        { error: userOrg.error || "Authentication error" },
        { status: userOrg.status || 401 }
      );
    }
    
    // Calculate credit cost for image editing (1.5x regular image generation)
    const baseCost = Math.round(CREDIT_COSTS.GENERATION.IMAGE * 1.5);
    const creditCost = baseCost * count;
    
    // Credit description
    const description = `Image editing: ${count} image${count > 1 ? 's' : ''}`;
    
    // Check and deduct credits
    const creditResult = await checkAndDeductCredits(
      supabase,
      userOrg.organizationId,
      creditCost,
      description,
      'image_edit'
    );
    
    if (!creditResult.success) {
      return NextResponse.json(
        { error: creditResult.error || CREDIT_ERRORS.INSUFFICIENT },
        { status: 402 }
      );
    }
    
    // Convert quality for GPT Image 1
    const gptImageQuality = quality === "hd" ? "high" : 
                           quality === "standard" ? "medium" : 
                           quality as "low" | "medium" | "high" | "auto";
    
    console.log(`Editing ${imageFiles.length} image(s) with prompt: "${prompt.substring(0, 30)}..." (quality: ${gptImageQuality})`);
    
    // Array to store all generated image URLs
    const allImageUrls: string[] = [];
    
    try {
      // Prepare images for GPT-Image-1 (supports multiple images natively)
      const imagesToEdit = prepareImagesForAPI(imageFiles);
      
      const result = await openai.images.edit({
        model: "gpt-image-1",
        image: imagesToEdit,
        prompt: prompt,
        n: count,
        quality: gptImageQuality,
        size: size as "1024x1024" // Cast to supported type while GPT-Image-1 API handles additional sizes
      } as Parameters<typeof openai.images.edit>[0]);
      
      if (result.data && result.data.length > 0) {
        for (let i = 0; i < result.data.length; i++) {
          const imageData = result.data[i];
          if (imageData.b64_json) {
            // Convert base64 to data URL for immediate use
            const dataUrl = `data:image/png;base64,${imageData.b64_json}`;
            allImageUrls.push(dataUrl);
          }
        }
      }
    } catch (err) {
      console.error(`Error editing images:`, err);
      
      // Check if it's an OpenAI API error with more details
      if (err instanceof Error) {
        // If it's a verification error, provide helpful message
        if (err.message.includes('verification') || err.message.includes('verified')) {
          throw new Error("Organization verification required for GPT Image 1. Please verify your OpenAI organization in the OpenAI console.");
        }
        
        // Pass through the actual OpenAI error message
        throw new Error(`GPT Image 1 API Error: ${err.message}`);
      }
      
      throw new Error("Failed to edit images with GPT Image 1");
    }
    
    console.log(`OpenAI returned ${allImageUrls.length} edited image URLs`);
    
    if (allImageUrls.length === 0) {
      throw new Error("Failed to edit any images");
    }

    // Try to upload edited images to permanent storage (optional - graceful fallback)
    console.log("Attempting to upload edited images to Supabase Storage...");
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `edited_${timestamp}`;
    
    let uploadResults: ImageUploadResult[] = [];
    let permanentImageUrls: string[] = [];
    let failedUploads: string[] = [];
    
    try {
      uploadResults = await uploadImagesFromUrls(
        supabase,
        allImageUrls,
        userOrg.organizationId,
        baseFilename
      );

      // Filter successful uploads and collect their permanent URLs
      uploadResults.forEach((result, index) => {
        if (result.success && result.url) {
          permanentImageUrls.push(result.url);
        } else {
          console.error(`Failed to upload edited image ${index + 1}:`, result.error);
          failedUploads.push(allImageUrls[index]);
          // Fall back to data URL if upload fails
          permanentImageUrls.push(allImageUrls[index]);
        }
      });

      console.log(`Successfully uploaded ${uploadResults.filter(r => r.success).length}/${allImageUrls.length} edited images to permanent storage`);
      
      if (failedUploads.length > 0) {
        console.warn(`${failedUploads.length} edited images failed to upload and will use data URLs`);
      }
    } catch (storageError) {
      console.warn("Storage upload failed, using data URLs as fallback:", storageError);
      // If storage upload completely fails, use data URLs for all images
      permanentImageUrls = allImageUrls;
      failedUploads = allImageUrls;
    }

    // Create or use existing session
    let currentSessionId = sessionId;

    if (!currentSessionId) {
      // Create a new session for this editing
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          organization_id: userOrg.organizationId,
          user_id: userOrg.user!.id,
          type: sessionType,
          title: sessionType === 'magic_ads' 
            ? `Magic Ad Edit: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}` 
            : `Ad Edit: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}`,
          metadata: { 
            style: quality, 
            prompt: prompt,
            imageCount: count,
            action: 'edit'
          }
        })
        .select()
        .single();

      if (!sessionError && newSession) {
        currentSessionId = newSession.id;
      }
    }

    // Save editing as interaction and artifacts
    if (currentSessionId) {
      // Get next sequence number
      const { data: lastInteraction } = await supabase
        .from('interactions')
        .select('sequence')
        .eq('session_id', currentSessionId)
        .order('sequence', { ascending: false })
        .limit(1)
        .single();

      const nextSequence = lastInteraction ? lastInteraction.sequence + 1 : 1;

      // Create interaction for this editing
      const { data: interaction, error: interactionError } = await supabase
        .from('interactions')
        .insert({
          session_id: currentSessionId,
          type: 'image_edit',
          content: prompt,
          metadata: { 
            quality: gptImageQuality,
            count: allImageUrls.length,
            originalImageCount: imageFiles.length,
            action: 'edit'
          },
          cost_credits: creditCost,
          sequence: nextSequence
        })
        .select()
        .single();

      // Create artifacts for each edited image using permanent URLs
      if (!interactionError && interaction) {
        const artifacts = permanentImageUrls.map((url, index) => ({
          interaction_id: interaction.id,
          type: 'image' as const,
          url: url,
          metadata: { 
            index,
            prompt,
            quality: gptImageQuality,
            action: 'edit',
            original_temp_url: allImageUrls[index],
            stored_permanently: uploadResults[index]?.success || false
          }
        }));

        const { error: artifactsError } = await supabase
          .from('artifacts')
          .insert(artifacts);

        if (artifactsError) {
          console.error('Error creating artifacts:', artifactsError);
        }
      }
    }
    
    // Return the result with permanent URLs
    return NextResponse.json({
      success: true,
      message: "Images edited successfully",
      sessionId: currentSessionId,
      credits: {
        cost: creditCost,
        remaining: creditResult.newBalance
      },
      data: {
        imageUrls: permanentImageUrls,
        count: permanentImageUrls.length,
        prompt: prompt,
        timestamp: new Date().toISOString(),
        action: 'edit',
        storage: {
          successful_uploads: uploadResults.filter(r => r.success).length,
          failed_uploads: failedUploads.length,
          using_permanent_storage: uploadResults.some(r => r.success)
        }
      }
    });
  } catch (error) {
    console.error("Error in image editing API:", error);
    let errorMessage = "Failed to edit images";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 