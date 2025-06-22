import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAndDeductCredits, getUserAndOrganization } from "@/lib/supabase/credits";
import { 
  CREDIT_ERRORS,
  calculateExampleFeatureCost,
  CREDIT_DESCRIPTIONS
} from "@/lib/supabase/creditConstants";

/**
 * Example API route for a feature that consumes credits
 * This shows how to implement credit checking and deduction for new features
 */
export async function POST(request: Request) {
  try {
    // Parse the request
    const { featureOptions = {} } = await request.json();
    
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
    
    // Define credit cost - can be dynamic based on options or feature complexity
    const creditCost = calculateExampleFeatureCost({ 
      premium: featureOptions.premium 
    });
    
    // Get the appropriate description based on the feature tier
    const description = featureOptions.premium 
      ? CREDIT_DESCRIPTIONS.EXAMPLE_PREMIUM 
      : CREDIT_DESCRIPTIONS.EXAMPLE_BASIC;
    
    // Check and deduct credits
    const creditResult = await checkAndDeductCredits(
      supabase,
      userOrg.organizationId,
      creditCost,
      description,
      featureOptions.premium ? 'example_premium' : 'example_basic'
    );
    
    if (!creditResult.success) {
      return NextResponse.json(
        { error: creditResult.error || CREDIT_ERRORS.INSUFFICIENT },
        { status: 402 }
      );
    }
    
    // Proceed with main feature logic
    // This would be your actual feature implementation
    
    // Return the result
    return NextResponse.json({
      success: true,
      message: "Feature executed successfully",
      credits: {
        cost: creditCost,
        remaining: creditResult.newBalance
      },
      data: {
        // Feature-specific response data would go here
        result: "Example feature result",
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Error in example feature API:", error);
    let errorMessage = "Failed to process request";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 