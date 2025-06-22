/**
 * 💰 CREDIT SYSTEM CONSTANTS 💰
 * 
 * This file contains all constants related to the credit system.
 * Update this file when adding new features that use credits or
 * when changing the credit cost of existing features.
 */

/**
 * Credit costs for various features
 * 
 * PATTERN:
 * FEATURE_NAME: {
 *   VARIANT_NAME: number
 * }
 * 
 * - Keep features in alphabetical order for easy reference
 * - Use SCREAMING_SNAKE_CASE for consistency
 * - Add a comment for each feature explaining its purpose
 */
export const CREDIT_COSTS = {
  // Chat feature costs
  CHAT: {
    BASIC: 1,              // Basic chat without special capabilities
    WITH_WEB_SEARCH: 2,    // Chat with web search capability
    WITH_CODE_GEN: 3,      // Chat optimized for code generation
  },

  // Example feature (template for new features)
  EXAMPLE_FEATURE: {
    BASIC: 2,              // Basic tier of the example feature
    PREMIUM: 5,            // Premium tier with advanced capabilities
  },

  // File generation costs
  GENERATION: {
    DOCUMENT: 5,           // Document generation (PDF, Word, etc.)
    IMAGE: 5,              // Image generation
    VIDEO: 10,             // Video generation
  },

  // API integration costs
  INTEGRATION: {
    BASIC_API_CALL: 1,     // Simple third-party API calls
    COMPLEX_API_CALL: 3,   // Complex data processing with external APIs
  },
};

/**
 * Standard descriptions for credit transactions
 * Use these to keep credit history descriptions consistent
 * 
 * TIP: Use template strings with these constants for dynamic descriptions:
 * `${CREDIT_DESCRIPTIONS.CHAT_BASIC} - ${userQuery.substring(0, 50)}...`
 */
export const CREDIT_DESCRIPTIONS = {
  // Chat descriptions
  CHAT_BASIC: "Chat: Basic usage",
  CHAT_WEB_SEARCH: "Chat: With web search",
  CHAT_CODE_GEN: "Chat: Code generation",
  
  // Example feature descriptions
  EXAMPLE_BASIC: "Example feature: Basic tier",
  EXAMPLE_PREMIUM: "Example feature: Premium tier",
  
  // Generation descriptions
  GENERATION_DOCUMENT: "Document generation",
  GENERATION_IMAGE: "Image generation",
  GENERATION_VIDEO: "Video generation",
  
  // API integration descriptions
  INTEGRATION_BASIC: "API integration: Basic",
  INTEGRATION_COMPLEX: "API integration: Complex",
};

/**
 * Standard error messages for credit-related errors
 */
export const CREDIT_ERRORS = {
  INSUFFICIENT: "Insufficient credits. Please add more credits to continue using this feature.",
  FAILED_CHECK: "Failed to check credit balance. Please try again.",
  FAILED_DEDUCT: "Failed to deduct credits. Please try again.",
};

/**
 * Helper functions for calculating credit costs
 * Add new calculators as you add features with complex pricing
 */

/**
 * Calculate the cost of a chat interaction based on provided options
 * 
 * @example
 * // Calculate cost for chat with web search
 * const cost = calculateChatCost({ webSearch: true });
 */
export function calculateChatCost(options: { 
  webSearch?: boolean;
  codeGeneration?: boolean;
} = {}): number {
  if (options.codeGeneration) return CREDIT_COSTS.CHAT.WITH_CODE_GEN;
  if (options.webSearch) return CREDIT_COSTS.CHAT.WITH_WEB_SEARCH;
  return CREDIT_COSTS.CHAT.BASIC;
}

/**
 * Calculate the cost of the example feature based on options
 */
export function calculateExampleFeatureCost(options: {
  premium?: boolean;
} = {}): number {
  return options.premium 
    ? CREDIT_COSTS.EXAMPLE_FEATURE.PREMIUM 
    : CREDIT_COSTS.EXAMPLE_FEATURE.BASIC;
}

/**
 * Generate a description for a chat interaction
 */
export function getChatDescription(options: {
  webSearch?: boolean;
  codeGeneration?: boolean;
  customSuffix?: string;
} = {}): string {
  let description = CREDIT_DESCRIPTIONS.CHAT_BASIC;
  
  if (options.codeGeneration) {
    description = CREDIT_DESCRIPTIONS.CHAT_CODE_GEN;
  } else if (options.webSearch) {
    description = CREDIT_DESCRIPTIONS.CHAT_WEB_SEARCH;
  }
  
  if (options.customSuffix) {
    description += `: ${options.customSuffix}`;
  }
  
  return description;
}

/**
 * 🌟 USAGE EXAMPLES 🌟
 * 
 * In your API route:
 * 
 * ```typescript
 * import { CREDIT_COSTS, CREDIT_DESCRIPTIONS, calculateChatCost } from '@/lib/supabase/creditConstants';
 * 
 * // Simple usage:
 * const creditCost = CREDIT_COSTS.CHAT.BASIC;
 * const description = CREDIT_DESCRIPTIONS.CHAT_BASIC;
 * 
 * // Dynamic cost calculation:
 * const useWebSearch = req.body.webSearch || false;
 * const creditCost = calculateChatCost({ webSearch: useWebSearch });
 * 
 * // Then use with checkAndDeductCredits:
 * const creditResult = await checkAndDeductCredits(
 *   supabase,
 *   userOrg.organizationId,
 *   creditCost,
 *   getChatDescription({ webSearch: useWebSearch })
 * );
 * ```
 */ 