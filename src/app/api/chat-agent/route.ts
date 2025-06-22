import { NextRequest, NextResponse } from 'next/server';
import { Agent, run, tool, webSearchTool } from '@openai/agents';
import { z } from 'zod';
import { getSessionById, updateSessionCredits } from '@/lib/session-management';
import { getUserCredits } from '@/lib/credits';
import { createClient } from '@/lib/supabase/server';
import { getUserAndOrganization } from '@/lib/supabase/credits';

// Enhanced web search tool with human approval using OpenAI's built-in web search
const webSearchToolWithApproval = tool({
  name: 'web_search',
  description: 'Search the web for current information and recent developments',
  parameters: z.object({
    query: z.string().describe('The search query to execute'),
    reason: z.string().describe('Brief explanation of why this search is needed')
  }),
  // Require human approval for all web searches in agent mode
  needsApproval: true,
  execute: async ({ query, reason }) => {
    try {
      console.log(`🔍 Executing approved web search: "${query}" (Reason: ${reason})`);
      
      // Use OpenAI's built-in web search tool
      const webTool = webSearchTool();
      const result = await run(new Agent({
        name: 'Web Search Agent',
        tools: [webTool],
        instructions: `Search for: ${query}. Format your response with clear headings, bullet points, and proper markdown formatting for readability.`
      }), `Please search for: ${query}`);
      
      return result.finalOutput || `Search completed for "${query}"`;
    } catch (error) {
      console.error('Web search error:', error);
      return `Failed to search for "${query}". Please try a different query.`;
    }
  }
});

// Session management tool
const sessionTool = tool({
  name: 'get_session_info',
  description: 'Get information about the current chat session',
  parameters: z.object({
    sessionId: z.string().describe('The session ID to look up')
  }),
  execute: async ({ sessionId }) => {
    try {
      const session = await getSessionById(sessionId);
      if (!session) {
        return 'Session not found';
      }
      
      return `Session "${session.title}" created on ${session.createdAt.toLocaleDateString()}. Messages: ${session.messages.length}`;
    } catch (error) {
      console.error('Session lookup error:', error);
      return 'Unable to retrieve session information';
    }
  }
});

// Note: Credit checking is now handled at the route level for better security

// Specialized agents
const webSearchSpecialist = new Agent({
  name: 'Web Search Specialist',
  instructions: `You are a web search specialist agent. Your role is to:
1. Perform web searches when current information is needed
2. Always explain why a search is necessary before executing it
3. Synthesize search results into helpful, accurate responses with proper markdown formatting
4. Cite sources when providing information from web searches
5. Format responses with clear headings, bullet points, and proper structure for readability

When you need to search the web, provide a clear reason for why the search is needed.
Always format your final response with proper markdown including:
- Clear headings (##, ###)
- Bullet points for lists
- **Bold** for emphasis
- Proper line breaks for readability`,
  tools: [webSearchToolWithApproval],
  handoffDescription: 'Handles requests requiring current information, recent news, or real-time data'
});

const databaseSpecialist = new Agent({
  name: 'Database Specialist', 
  instructions: `You are a database and session management specialist. Your role is to:
1. Help users manage their chat sessions
2. Provide information about conversation history
3. Assist with platform-specific features

You have access to session information.`,
  tools: [sessionTool],
  handoffDescription: 'Handles session management, user accounts, and platform features'
});

// Main triage agent
const triageAgent = new Agent({
  name: 'AI Assistant',
  instructions: `You are an intelligent AI assistant that routes conversations to specialized agents when needed.

**Decision Framework:**
- If the user needs current information, recent news, real-time data, or asks about recent events → Hand off to Web Search Specialist
- If the user asks about their sessions, account, credits, or platform features → Hand off to Database Specialist  
- For general conversations, knowledge questions, coding help, creative tasks → Handle directly

**Important Guidelines:**
- Always be helpful and conversational
- Explain your reasoning when handing off to specialists
- Provide comprehensive responses for general inquiries
- Be proactive in suggesting web searches for time-sensitive information
- Format all responses with proper markdown for readability`,
  handoffs: [webSearchSpecialist, databaseSpecialist]
});

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

interface ApprovalRequest {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  agent: string;
  timestamp: number;
}

// Helper function to extract search query from user message
function extractSearchQuery(message: string): string {
  // Remove common prefixes and clean up the query
  const query = message
    .replace(/^(use the web to |please |can you |could you |)/i, '')
    .replace(/^(research |search for |find |look up |tell me about )/i, '')
    .trim();
  
  return query;
}



export async function POST(request: NextRequest) {
  try {
    const { 
      message, 
      sessionId, 
      conversationHistory = [],
      agentMode = false,
      approvals = {}
    } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client and get user/organization info
    const supabase = await createClient();
    const userOrg = await getUserAndOrganization(supabase);
    
    if (!userOrg.success) {
      return NextResponse.json(
        { error: userOrg.error || "Authentication error" },
        { status: userOrg.status || 401 }
      );
    }

    // Credit check for agent mode using organization credits
    if (agentMode) {
      try {
        const credits = await getUserCredits(userOrg.user!.id);
        if (credits <= 0) {
          return NextResponse.json(
            { error: 'Insufficient credits for agent mode' },
            { status: 402 }
          );
        }
      } catch (error) {
        console.error('Credit check failed:', error);
        return NextResponse.json(
          { error: 'Unable to verify credits' },
          { status: 500 }
        );
      }
    }

    let currentSessionId = sessionId;

    // Create or find session for history storage
    if (!currentSessionId) {
      try {
        const { data: newSession, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            organization_id: userOrg.organizationId,
            user_id: userOrg.user!.id,
            title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            type: 'chat',
            metadata: { agentMode: true }
          })
          .select()
          .single();

        if (sessionError || !newSession) {
          console.error('Error creating agent chat session:', sessionError);
          // Continue without session tracking rather than failing
        } else {
          currentSessionId = newSession.id;
        }
      } catch (error) {
        console.error('Session creation error:', error);
        // Continue without session tracking
      }
    }

    // Save user message to session
    if (currentSessionId) {
      try {
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
            metadata: { agentMode: true },
            cost_credits: 0,
            sequence: nextSequence
          });
      } catch (error) {
        console.error('Error saving user message:', error);
        // Continue without failing the request
      }
    }

    // Build conversation context
    const conversationContext = conversationHistory
      .slice(-10) // Keep last 10 messages for context
      .map((msg: ChatMessage) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const fullPrompt = conversationContext 
      ? `Previous conversation:\n${conversationContext}\n\nCurrent message: ${message}`
      : message;

    console.log(`🤖 Agent Mode: Processing message with ${agentMode ? 'multi-agent' : 'traditional'} approach`);

    // If approvals are provided, this is a continuation of a previous request
    const hasApprovals = Object.keys(approvals).length > 0;
    
    if (hasApprovals) {
      console.log(`✅ Continuing execution with approvals:`, approvals);
      
      // Check if any approvals were rejected
      const rejectedApprovals = Object.entries(approvals).filter(([, approved]) => !approved);
      const approvedApprovals = Object.entries(approvals).filter(([, approved]) => approved);
      
      if (rejectedApprovals.length > 0) {
        const rejectionMessage = `I understand you've rejected some actions. I'll proceed without those capabilities and provide the best response I can with the available information.`;
        
        // Save assistant response to session
        if (currentSessionId) {
          try {
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
                content: rejectionMessage,
                metadata: { 
                  agentMode: true,
                  activeAgent: 'AI Assistant',
                  toolsUsed: [],
                  approvalRejected: true
                },
                cost_credits: agentMode ? 1 : 0,
                sequence: nextSequence
              });

            // Update session timestamp
            await supabase
              .from('sessions')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', currentSessionId);
          } catch (error) {
            console.error('Error saving rejection response:', error);
          }
        }
        
        return NextResponse.json({
          message: rejectionMessage,
          agentMode: true,
          sessionId: currentSessionId,
          usage: {
            activeAgent: 'AI Assistant',
            toolsUsed: [],
            creditsUsed: agentMode ? 1 : 0
          }
        });
      }
      
      if (approvedApprovals.length > 0) {
        // Execute approved web search with proper streaming
        try {
          const searchQuery = extractSearchQuery(message);
          console.log(`🔍 Executing approved search for: "${searchQuery}"`);
          
          // Use OpenAI's built-in web search with streaming
          const webTool = webSearchTool();
          const searchAgent = new Agent({
            name: 'Search Agent',
            tools: [webTool],
            instructions: `You are a web search agent. Search for comprehensive information about: ${searchQuery}. 

Format your response with proper markdown:
- Use ## for main headings
- Use ### for subheadings  
- Use **bold** for emphasis
- Use bullet points for lists
- Include proper line breaks for readability
- Cite sources clearly

Provide comprehensive results with sources and links.`
          });
          
          // Use streaming for the search execution
          const result = await run(searchAgent, `Please search for comprehensive information about: ${searchQuery}`, {
            stream: true
          });

          let searchResult = '';
          
          // Process the stream to get the final output
          for await (const event of result) {
            if (event.type === 'run_item_stream_event' && event.item.type === 'message_output_item') {
              searchResult += event.item.content || '';
            }
          }
          
          // Wait for completion
          await result.completed;
          
          // Use final output if streaming didn't capture everything
          if (!searchResult && result.finalOutput) {
            searchResult = result.finalOutput;
          }
          
          const finalMessage = `## Search Results for "${searchQuery}"\n\n${searchResult}`;
          
          // Save assistant response to session
          if (currentSessionId) {
            try {
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
                  content: finalMessage,
                  metadata: { 
                    agentMode: true,
                    activeAgent: 'Web Search Specialist',
                    toolsUsed: ['web_search']
                  },
                  cost_credits: agentMode ? 1 : 0,
                  sequence: nextSequence
                });

              // Update session timestamp
              await supabase
                .from('sessions')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', currentSessionId);
            } catch (error) {
              console.error('Error saving assistant response:', error);
            }
          }
          
          return NextResponse.json({
            message: finalMessage,
            agentMode: true,
            sessionId: currentSessionId,
            usage: {
              activeAgent: 'Web Search Specialist',
              toolsUsed: ['web_search'],
              creditsUsed: agentMode ? 1 : 0
            }
          });
        } catch (error) {
          console.error('Error executing approved web search:', error);
          const errorMessage = `I apologize, but I encountered an error while performing the web search. Please try again.`;
          
          // Save error response to session
          if (currentSessionId) {
            try {
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
                  content: errorMessage,
                  metadata: { 
                    agentMode: true,
                    activeAgent: 'Web Search Specialist',
                    toolsUsed: [],
                    error: true
                  },
                  cost_credits: 0,
                  sequence: nextSequence
                });
            } catch (saveError) {
              console.error('Error saving error response:', saveError);
            }
          }
          
          return NextResponse.json({
            message: errorMessage,
            agentMode: true,
            sessionId: currentSessionId,
            usage: {
              activeAgent: 'Web Search Specialist',
              toolsUsed: [],
              creditsUsed: agentMode ? 1 : 0
            }
          });
        }
      }
    }

    // Run the agent with streaming support for approval handling
    const result = await run(triageAgent, fullPrompt, {
      stream: true
    });

    let finalOutput = '';
    const approvalRequests: ApprovalRequest[] = [];
    let needsApproval = false;

    // Handle streaming events including approval requests
    for await (const event of result) {
      if (event.type === 'run_item_stream_event') {
        if (event.item.type === 'tool_approval_item') {
          // Tool approval needed
          const approvalRequest: ApprovalRequest = {
            id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            toolName: event.item.rawItem.name || 'unknown_tool',
            arguments: (typeof event.item.rawItem.arguments === 'object' && event.item.rawItem.arguments !== null) 
              ? event.item.rawItem.arguments as Record<string, unknown>
              : {},
            agent: 'Web Search Specialist',
            timestamp: Date.now()
          };
          
          approvalRequests.push(approvalRequest);
          needsApproval = true;
          
          console.log(`⏸️ Approval required for ${approvalRequest.toolName}`);
        } else if (event.item.type === 'message_output_item') {
          finalOutput += event.item.content || '';
        }
      }
    }

    // Wait for the stream to complete
    await result.completed;

    // If approvals are needed, return them for user confirmation
    if (needsApproval && approvalRequests.length > 0) {
      // Update approval requests with actual search query
      const searchQuery = extractSearchQuery(message);
      const updatedApprovalRequests = approvalRequests.map(request => ({
        ...request,
        arguments: {
          ...request.arguments,
          query: searchQuery,
          reason: `To provide current and accurate information about: ${searchQuery}`
        }
      }));

      return NextResponse.json({
        message: 'I need to search the web to provide you with current information. Would you like me to proceed?',
        approvalRequests: updatedApprovalRequests,
        status: 'pending_approval',
        agentMode: true,
        sessionId: currentSessionId,
        conversationHistory: [
          ...conversationHistory,
          { role: 'user', content: message, timestamp: Date.now() }
        ]
      });
    }

    // Get final output if no approvals needed
    if (!finalOutput && result.finalOutput) {
      finalOutput = result.finalOutput;
    }

    if (!finalOutput) {
      finalOutput = "I apologize, but I wasn't able to process your request properly. Could you please try again?";
    }

    // Deduct credits for agent mode
    if (agentMode && currentSessionId) {
      try {
        await updateSessionCredits(userOrg.user!.id, currentSessionId, 1);
      } catch (error) {
        console.error('Failed to update credits:', error);
        // Continue anyway - don't fail the request
      }
    }

    console.log(`✅ Agent response generated (${finalOutput.length} characters)`);

    // Save assistant response to session
    if (currentSessionId && finalOutput) {
      try {
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
            content: finalOutput,
            metadata: { 
              agentMode: true,
              activeAgent: result.lastAgent?.name || 'AI Assistant',
              toolsUsed: []
            },
            cost_credits: agentMode ? 1 : 0,
            sequence: nextSequence
          });

        // Update session timestamp
        await supabase
          .from('sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', currentSessionId);
      } catch (error) {
        console.error('Error saving assistant response:', error);
      }
    }

    return NextResponse.json({
      message: finalOutput,
      agentMode: true,
      sessionId: currentSessionId,
      usage: {
        activeAgent: result.lastAgent?.name || 'AI Assistant',
        toolsUsed: [],
        creditsUsed: agentMode ? 1 : 0
      }
    });

  } catch (error) {
    console.error('Agent API Error:', error);
    
    let errorMessage = 'An error occurred while processing your request.';
    
    if (error instanceof Error) {
      if (error.message.includes('insufficient_quota')) {
        errorMessage = 'OpenAI API quota exceeded. Please try again later.';
      } else if (error.message.includes('invalid_api_key')) {
        errorMessage = 'OpenAI API configuration error.';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 