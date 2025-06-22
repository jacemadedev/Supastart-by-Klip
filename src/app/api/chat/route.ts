import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ChatMessageType } from "@/components/dashboard-components/Chat/ChatMessage";
import { createClient } from "@/lib/supabase/server";
import { checkAndDeductCredits, getUserAndOrganization } from "@/lib/supabase/credits";
import { 
  CREDIT_ERRORS, 
  calculateChatCost, 
  getChatDescription 
} from "@/lib/supabase/creditConstants";


// Initialize the OpenAI client with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface UrlCitation {
  url: string;
  title: string;
  start_index: number;
  end_index: number;
}

interface DeltaWithAnnotations {
  content?: string;
  annotations?: Array<{
    type: string;
    url_citation?: UrlCitation;
  }>;
}

export async function POST(request: Request) {
  try {
    // Get the message, options, history, and session info from the request body
    const { message, useWebSearch = false, history = [], sessionId = null } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured");
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 500 }
      );
    }
    
    // Create Supabase client
    const supabase = await createClient();
    
    // Get user and organization
    const userOrg = await getUserAndOrganization(supabase);
    
    console.log("CHAT CREDITS - User and organization info:", {
      success: userOrg.success,
      userId: userOrg.user?.id,
      organizationId: userOrg.organizationId,
      timestamp: new Date().toISOString()
    });
    
    if (!userOrg.success) {
      return NextResponse.json(
        { error: userOrg.error || "Authentication error" },
        { status: userOrg.status || 401 }
      );
    }
    
    // Calculate credit cost based on features used
    const creditCost = calculateChatCost({ webSearch: useWebSearch });
    
    console.log("CHAT CREDITS - About to deduct credits:", {
      organizationId: userOrg.organizationId,
      creditCost,
      features: { webSearch: useWebSearch },
      timestamp: new Date().toISOString()
    });
    
    // Check and deduct credits
    const creditResult = await checkAndDeductCredits(
      supabase,
      userOrg.organizationId,
      creditCost,
      getChatDescription({ 
        webSearch: useWebSearch,
        customSuffix: message.substring(0, 30) + (message.length > 30 ? '...' : '')
      }),
      useWebSearch ? 'chat_with_search' : 'chat'
    );
    
    console.log("CHAT CREDITS - Deduction result:", {
      success: creditResult.success,
      newBalance: creditResult.newBalance,
      error: creditResult.error,
      timestamp: new Date().toISOString()
    });
    
    if (!creditResult.success) {
      return NextResponse.json(
        { error: creditResult.error || CREDIT_ERRORS.INSUFFICIENT },
        { status: 402 }
      );
    }

    // Handle session management
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      // Create a new session for this conversation
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          organization_id: userOrg.organizationId,
          user_id: userOrg.user!.id,
          type: 'chat',
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          metadata: { webSearch: useWebSearch }
        })
        .select()
        .single();

      if (sessionError || !newSession) {
        console.error('Error creating chat session:', sessionError);
        // Continue without session tracking rather than failing
      } else {
        currentSessionId = newSession.id;
      }
    }

    // Save user message to session
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

      await supabase
        .from('interactions')
        .insert({
          session_id: currentSessionId,
          type: 'user_message',
          content: message,
          metadata: { webSearch: useWebSearch },
          cost_credits: 0,
          sequence: nextSequence
        });
    }

    // Convert chat history to OpenAI format
    const formattedHistory = history
      .filter((msg: ChatMessageType) => msg.role === "user" || msg.role === "assistant")
      .map((msg: ChatMessageType) => ({
        role: msg.role,
        content: msg.content,
      }));

    // Set up model and options based on whether web search is enabled
    const model = useWebSearch ? "gpt-4o-search-preview" : "gpt-4";
    const searchOptions = useWebSearch ? { 
      web_search_options: { 
        search_context_size: "medium" as "medium" | "low" | "high" 
      } 
    } : {};

    // System message to include at the start of every conversation
    const systemMessage = {
      role: "system",
      content: "You are a helpful assistant."
    };

    try {
      // Create the OpenAI completion
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          systemMessage,
          // Include all previous messages except the last one (the current message)
          ...formattedHistory.slice(0, -1),
          // Include the current message
          { role: "user", content: message }
        ],
        stream: true,
        ...searchOptions,
      });

      // Create a streaming response
      const encoder = new TextEncoder();
      let fullResponseText = "";
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const citations = [];

            // Process the streaming response
            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content || "";
              
              // Collect citation data if available
              if (chunk.choices[0]?.delta.hasOwnProperty('annotations')) {
                const deltaWithAnnotations = chunk.choices[0]?.delta as DeltaWithAnnotations;
                if (deltaWithAnnotations.annotations && deltaWithAnnotations.annotations.length > 0) {
                  for (const annotation of deltaWithAnnotations.annotations) {
                    if (annotation.type === "url_citation" && annotation.url_citation) {
                      citations.push(annotation.url_citation);
                    }
                  }
                }
              }

              if (content) {
                fullResponseText += content;
                controller.enqueue(encoder.encode(content));
              }
            }

            // If there were citations, send them at the end
            let sourcesText = "";
            if (citations.length > 0) {
              sourcesText = "\n\n---\nSources:\n";
              citations.forEach((citation, index) => {
                sourcesText += `[${index + 1}] ${citation.title}: ${citation.url}\n`;
              });
              controller.enqueue(encoder.encode(sourcesText));
              fullResponseText += sourcesText;
            }

            // Save assistant response to session
            if (currentSessionId) {
              const { data: lastInteraction } = await supabase
                .from('interactions')
                .select('sequence')
                .eq('session_id', currentSessionId)
                .order('sequence', { ascending: false })
                .limit(1)
                .single();

              const nextSequence = lastInteraction ? lastInteraction.sequence + 1 : 1;

              await supabase
                .from('interactions')
                .insert({
                  session_id: currentSessionId,
                  type: 'assistant_message',
                  content: fullResponseText,
                  metadata: { 
                    webSearch: useWebSearch, 
                    citations: citations.length > 0 ? citations : undefined 
                  },
                  cost_credits: creditCost,
                  sequence: nextSequence
                });

              // Update session title if it's still the default
              if (fullResponseText.length > 0) {
                await supabase
                  .from('sessions')
                  .update({ 
                    updated_at: new Date().toISOString(),
                    title: message.substring(0, 50) + (message.length > 50 ? '...' : '')
                  })
                  .eq('id', currentSessionId);
              }
            }

            controller.close();
          } catch (streamError) {
            console.error("Error in stream processing:", streamError);
            // Close the stream properly instead of erroring it
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Session-Id": currentSessionId || "",
        },
      });
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError);
      // Return a JSON error response for OpenAI errors
      if (openaiError instanceof Error) {
        return NextResponse.json(
          { error: openaiError.message || "AI service error" },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Failed to generate response from AI service" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in chat API:", error);
    // Make sure we're returning a proper JSON error object
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