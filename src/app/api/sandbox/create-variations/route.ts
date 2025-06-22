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
 * API route for creating image variations with OpenAI (DALL-E 2)
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // Extract form data
    const count = parseInt(formData.get('count') as string) || 2;
    const size = formData.get('size') as string || '1024x1024';
    const sessionId = formData.get('sessionId') as string || null;
    const sessionType = formData.get('sessionType') as string || 'sandbox';
    
    // Get the image file
    const imageFile = formData.get('image') as File;
    
    // Validate input
    if (!imageFile) {
      return NextResponse.json(
        { error: "Image file is required for creating variations" },
        { status: 400 }
      );
    }

    if (count < 1 || count > 10) {
      return NextResponse.json(
        { error: "Count must be between 1 and 10" },
        { status: 400 }
      );
    }

    // Validate image file
    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }
    
    // Check file size (4MB for DALL-E 2)
    if (imageFile.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image file must be less than 4MB" },
        { status: 400 }
      );
    }

    // Validate size parameter
    const validSizes = ["256x256", "512x512", "1024x1024"];
    if (!validSizes.includes(size)) {
      return NextResponse.json(
        { error: "Size must be one of: 256x256, 512x512, 1024x1024" },
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
    
    // Calculate credit cost for image variations (same as regular image generation)
    const baseCost = CREDIT_COSTS.GENERATION.IMAGE;
    const creditCost = baseCost * count;
    
    // Credit description
    const description = `Image variations: ${count} variation${count > 1 ? 's' : ''}`;
    
    // Check and deduct credits
    const creditResult = await checkAndDeductCredits(
      supabase,
      userOrg.organizationId,
      creditCost,
      description,
      'image_variation'
    );
    
    if (!creditResult.success) {
      return NextResponse.json(
        { error: creditResult.error || CREDIT_ERRORS.INSUFFICIENT },
        { status: 402 }
      );
    }
    
    console.log(`Creating ${count} variation${count > 1 ? 's' : ''} of uploaded image (size: ${size})`);
    
    // Array to store all generated image URLs
    const allImageUrls: string[] = [];
    
    try {
      const result = await openai.images.createVariation({
        model: "dall-e-2", // Only DALL-E 2 supports variations
        image: imageFile,
        n: count,
        size: size as "256x256" | "512x512" | "1024x1024",
        response_format: "url" // DALL-E 2 supports URL response format
      });
      
      if (result.data && result.data.length > 0) {
        for (let i = 0; i < result.data.length; i++) {
          const imageData = result.data[i];
          if (imageData.url) {
            allImageUrls.push(imageData.url);
          }
        }
      }
    } catch (err) {
      console.error(`Error creating image variations:`, err);
      
      // Check if it's an OpenAI API error with more details
      if (err instanceof Error) {
        // Pass through the actual OpenAI error message
        throw new Error(`DALL-E 2 API Error: ${err.message}`);
      }
      
      throw new Error("Failed to create image variations with DALL-E 2");
    }
    
    console.log(`OpenAI returned ${allImageUrls.length} variation URLs`);
    
    if (allImageUrls.length === 0) {
      throw new Error("Failed to create any variations");
    }

    // Try to upload variation images to permanent storage (optional - graceful fallback)
    console.log("Attempting to upload variation images to Supabase Storage...");
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `variations_${timestamp}`;
    
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
          console.error(`Failed to upload variation image ${index + 1}:`, result.error);
          failedUploads.push(allImageUrls[index]);
          // Fall back to data URL if upload fails
          permanentImageUrls.push(allImageUrls[index]);
        }
      });

      console.log(`Successfully uploaded ${uploadResults.filter(r => r.success).length}/${allImageUrls.length} variation images to permanent storage`);
      
      if (failedUploads.length > 0) {
        console.warn(`${failedUploads.length} variation images failed to upload and will use data URLs`);
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
      // Create a new session for this variation creation
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          organization_id: userOrg.organizationId,
          user_id: userOrg.user!.id,
          type: sessionType,
          title: sessionType === 'magic_ads' 
            ? `Magic Ad Variations: ${count} variation${count > 1 ? 's' : ''}` 
            : `Ad Variations: ${count} variation${count > 1 ? 's' : ''}`,
          metadata: { 
            size: size,
            imageCount: count,
            action: 'variations'
          }
        })
        .select()
        .single();

      if (!sessionError && newSession) {
        currentSessionId = newSession.id;
      }
    }

    // Save variations as interaction and artifacts
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

      // Create interaction for this variation creation
      const { data: interaction, error: interactionError } = await supabase
        .from('interactions')
        .insert({
          session_id: currentSessionId,
          type: 'image_variation',
          content: `Created ${count} variation${count > 1 ? 's' : ''} of uploaded image`,
          metadata: { 
            size: size,
            count: allImageUrls.length,
            action: 'variations'
          },
          cost_credits: creditCost,
          sequence: nextSequence
        })
        .select()
        .single();

      // Create artifacts for each variation image using permanent URLs
      if (!interactionError && interaction) {
        const artifacts = permanentImageUrls.map((url, index) => ({
          interaction_id: interaction.id,
          type: 'image' as const,
          url: url,
          metadata: { 
            index,
            size: size,
            action: 'variations',
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
      message: "Image variations created successfully",
      sessionId: currentSessionId,
      credits: {
        cost: creditCost,
        remaining: creditResult.newBalance
      },
      data: {
        imageUrls: permanentImageUrls,
        count: permanentImageUrls.length,
        size: size,
        timestamp: new Date().toISOString(),
        action: 'variations',
        storage: {
          successful_uploads: uploadResults.filter(r => r.success).length,
          failed_uploads: failedUploads.length,
          using_permanent_storage: uploadResults.some(r => r.success)
        }
      }
    });
  } catch (error) {
    console.error("Error in image variations API:", error);
    let errorMessage = "Failed to create image variations";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 