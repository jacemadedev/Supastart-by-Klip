import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAndDeductCredits, getUserAndOrganization } from "@/lib/supabase/credits";
import { 
  CREDIT_ERRORS,
  CREDIT_DESCRIPTIONS,
  CREDIT_COSTS
} from "@/lib/supabase/creditConstants";
import { uploadImagesFromUrls, ImageUploadResult } from "@/lib/storage/image-upload";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI();

/**
 * API route for generating images with OpenAI
 */
export async function POST(request: Request) {
  try {
    // Parse the request
    const { prompt, count = 1, quality = "standard", size = "1024x1024", sessionId = null, sessionType = "sandbox" } = await request.json();
    
    // Validate input
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (count < 1 || count > 4) {
      return NextResponse.json(
        { error: "Count must be between 1 and 4" },
        { status: 400 }
      );
    }
    
    // Validate quality parameter - GPT Image 1 accepts 'low', 'medium', 'high', and 'auto'
    if (!["standard", "hd"].includes(quality)) {
      return NextResponse.json(
        { error: "Quality must be either 'standard' or 'hd'" },
        { status: 400 }
      );
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
    
    // Calculate credit cost based on number of images and quality
    const isHDQuality = quality === "hd";
    const baseCost = CREDIT_COSTS.GENERATION.IMAGE;
    const creditCost = baseCost * count * (isHDQuality ? 2 : 1);
    
    // Credit description
    const description = `${CREDIT_DESCRIPTIONS.GENERATION_IMAGE}: ${count} ${isHDQuality ? 'HD' : 'standard'} image${count > 1 ? 's' : ''}`;
    
    // Check and deduct credits
    const creditResult = await checkAndDeductCredits(
      supabase,
      userOrg.organizationId,
      creditCost,
      description,
      'image_generation'
    );
    
    if (!creditResult.success) {
      return NextResponse.json(
        { error: creditResult.error || CREDIT_ERRORS.INSUFFICIENT },
        { status: 402 }
      );
    }
    
    // Generate images with OpenAI - GPT Image 1 supports multiple images in a single request
    console.log(`Generating ${count} images with prompt: "${prompt.substring(0, 30)}..." (quality: ${quality})`);
    
    // Array to store all generated image URLs
    const allImageUrls: string[] = [];
    
    // Convert quality from DALL-E format to GPT Image 1 format
    const gptImageQuality = quality === "hd" ? "high" : "medium";
    
    try {
      const result = await openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt,
        n: count, // GPT Image 1 supports multiple images in one request
        quality: gptImageQuality as "low" | "medium" | "high" | "auto",
        size: size as "1024x1024" | "1536x1024" | "1024x1536" | "auto"
      });
      
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
      console.error(`Error generating images:`, err);
      
      // Check if it's an OpenAI API error with more details
      if (err instanceof Error) {
        // If it's a verification error, provide helpful message
        if (err.message.includes('verification') || err.message.includes('verified')) {
          throw new Error("Organization verification required for GPT Image 1. Please verify your OpenAI organization in the OpenAI console.");
        }
        
        // Pass through the actual OpenAI error message
        throw new Error(`GPT Image 1 API Error: ${err.message}`);
      }
      
      throw new Error("Failed to generate images with GPT Image 1");
    }
    
    console.log(`OpenAI returned ${allImageUrls.length} image URLs:`, allImageUrls);
    
    if (allImageUrls.length === 0) {
      throw new Error("Failed to generate any images");
    }

    // Try to upload images to permanent storage (optional - graceful fallback)
    console.log("Attempting to upload images to Supabase Storage...");
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `generated_${timestamp}`;
    
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
          console.error(`Failed to upload image ${index + 1}:`, result.error);
          failedUploads.push(allImageUrls[index]);
          // Fall back to data URL if upload fails
          permanentImageUrls.push(allImageUrls[index]);
        }
      });

      console.log(`Successfully uploaded ${uploadResults.filter(r => r.success).length}/${allImageUrls.length} images to permanent storage`);
      
      if (failedUploads.length > 0) {
        console.warn(`${failedUploads.length} images failed to upload and will use data URLs`);
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
      // Create a new session for this generation
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          organization_id: userOrg.organizationId,
          user_id: userOrg.user!.id,
          type: sessionType,
          title: sessionType === 'magic_ads' 
            ? `Magic Ad: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}` 
            : `Image: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}`,
          metadata: { 
            style: quality, 
            prompt: prompt,
            imageCount: count 
          }
        })
        .select()
        .single();

      if (!sessionError && newSession) {
        currentSessionId = newSession.id;
      }
    }

    // Save generation as interaction and artifacts
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

      // Create interaction for this generation
      const { data: interaction, error: interactionError } = await supabase
        .from('interactions')
        .insert({
          session_id: currentSessionId,
          type: 'image_generation',
          content: prompt,
          metadata: { 
            quality,
            count: allImageUrls.length,
            style: quality
          },
          cost_credits: creditCost,
          sequence: nextSequence
        })
        .select()
        .single();

      // Create artifacts for each generated image using permanent URLs
      if (!interactionError && interaction) {
        const artifacts = permanentImageUrls.map((url, index) => ({
          interaction_id: interaction.id,
          type: 'image' as const,
          url: url,
          metadata: { 
            index,
            prompt,
            quality,
            original_temp_url: allImageUrls[index], // Keep reference to original URL
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
      message: "Images generated successfully",
      sessionId: currentSessionId,
      credits: {
        cost: creditCost,
        remaining: creditResult.newBalance
      },
      data: {
        imageUrls: permanentImageUrls, // Return permanent URLs
        count: permanentImageUrls.length,
        prompt: prompt,
        timestamp: new Date().toISOString(),
        storage: {
          successful_uploads: uploadResults.filter(r => r.success).length,
          failed_uploads: failedUploads.length,
          using_permanent_storage: uploadResults.some(r => r.success)
        }
      }
    });
  } catch (error) {
    console.error("Error in image generation API:", error);
    let errorMessage = "Failed to generate images";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 