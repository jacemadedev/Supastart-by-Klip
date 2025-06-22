# Agent Tools and Extensions Guide

This guide explains how to extend and customize the agent system using OpenAI Agents JS, including creating custom tools, implementing integrations like Slack, and leveraging advanced agent features.

## Table of Contents

1. [OpenAI Agents SDK Overview](#openai-agents-sdk-overview)
2. [Current Agent Architecture](#current-agent-architecture)
3. [Creating Custom Tools](#creating-custom-tools)
4. [Tool Approval System](#tool-approval-system)
5. [Agent Handoffs](#agent-handoffs)
6. [Guardrails](#guardrails)
7. [Integration Patterns](#integration-patterns)
8. [Slack Integration Example](#slack-integration-example)
9. [Best Practices](#best-practices)
10. [Tracing and Debugging](#tracing-and-debugging)

## OpenAI Agents SDK Overview

The OpenAI Agents SDK provides four core primitives:

### 1. **Agents**
LLMs equipped with specific instructions and tools for particular tasks.

```typescript
import { Agent } from '@openai/agents';

const agent = new Agent({
  name: 'Customer Support Agent',
  instructions: 'You help customers with their inquiries and can access their account information.',
  tools: [customerLookupTool, ticketCreationTool]
});
```

### 2. **Tools**
Functions that agents can call to perform actions or retrieve information.

```typescript
import { tool } from '@openai/agents';
import { z } from 'zod';

const customerLookupTool = tool({
  name: 'lookup_customer',
  description: 'Look up customer information by email or ID',
  parameters: z.object({
    identifier: z.string().describe('Customer email or ID'),
    type: z.enum(['email', 'id']).describe('Type of identifier')
  }),
  execute: async ({ identifier, type }) => {
    // Implementation here
    return customerData;
  }
});
```

### 3. **Handoffs**
Mechanism for agents to delegate tasks to other specialized agents.

```typescript
const generalAgent = new Agent({
  name: 'General Assistant',
  instructions: 'Route requests to appropriate specialists',
  handoffs: [technicalSupportAgent, billingAgent]
});
```

### 4. **Guardrails**
Input validation and safety checks that run in parallel to agent execution.

```typescript
import { guardrail } from '@openai/agents';

const contentSafetyGuardrail = guardrail({
  name: 'content_safety',
  validate: async (input) => {
    // Validate input safety
    return { valid: true };
  }
});
```

## Current Agent Architecture

Our current system implements a **triage-based architecture** with three main agents:

### 1. **Triage Agent** (Main Router)
- Routes requests to appropriate specialists
- Handles general conversations directly
- Manages handoffs to specialized agents

### 2. **Web Search Specialist**
- Handles requests requiring current information
- Uses approval workflow for web searches
- Formats results with proper markdown

### 3. **Database Specialist**
- Manages session and account queries
- Accesses user data and platform features
- Handles organization-specific operations

```typescript
// Current implementation pattern
const triageAgent = new Agent({
  name: 'AI Assistant',
  instructions: `Route conversations to specialized agents when needed...`,
  handoffs: [webSearchSpecialist, databaseSpecialist]
});
```

## Creating Custom Tools

### Basic Tool Structure

```typescript
import { tool } from '@openai/agents';
import { z } from 'zod';

const customTool = tool({
  name: 'tool_name',
  description: 'Clear description of what the tool does',
  parameters: z.object({
    // Define parameters with Zod schema
    param1: z.string().describe('Parameter description'),
    param2: z.number().optional().describe('Optional parameter')
  }),
  needsApproval: false, // Set to true for sensitive operations
  execute: async ({ param1, param2 }) => {
    // Tool implementation
    try {
      const result = await performOperation(param1, param2);
      return result;
    } catch (error) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }
});
```

### Tool Categories

#### 1. **Data Retrieval Tools**
```typescript
const getUserDataTool = tool({
  name: 'get_user_data',
  description: 'Retrieve user profile and settings',
  parameters: z.object({
    userId: z.string().describe('User ID to retrieve data for')
  }),
  execute: async ({ userId }) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw new Error(`Failed to retrieve user data: ${error.message}`);
    return data;
  }
});
```

#### 2. **Action Tools**
```typescript
const sendEmailTool = tool({
  name: 'send_email',
  description: 'Send an email to a user or external contact',
  parameters: z.object({
    to: z.string().email().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
    template: z.string().optional().describe('Email template to use')
  }),
  needsApproval: true, // Require approval for external communications
  execute: async ({ to, subject, body, template }) => {
    // Email sending implementation
    const result = await emailService.send({ to, subject, body, template });
    return `Email sent successfully to ${to}`;
  }
});
```

#### 3. **Integration Tools**
```typescript
const slackMessageTool = tool({
  name: 'send_slack_message',
  description: 'Send a message to a Slack channel or user',
  parameters: z.object({
    channel: z.string().describe('Slack channel ID or user ID'),
    message: z.string().describe('Message content'),
    userId: z.string().describe('User ID for permission checking')
  }),
  needsApproval: true,
  execute: async ({ channel, message, userId }) => {
    // Verify user has connected Slack account
    const slackIntegration = await getSlackIntegration(userId);
    if (!slackIntegration) {
      throw new Error('No Slack integration found. Please connect your Slack account first.');
    }
    
    // Send message using Slack API
    const result = await sendSlackMessage(slackIntegration.accessToken, channel, message);
    return `Message sent to Slack channel: ${channel}`;
  }
});
```

## Tool Approval System

Our current approval system can be extended to handle different types of tools:

### Approval Categories

```typescript
// Extend ApprovalRequest interface
interface ApprovalRequest {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  agent: string;
  timestamp: number;
  category: 'web_search' | 'external_communication' | 'data_modification' | 'integration';
  riskLevel: 'low' | 'medium' | 'high';
  requiredPermissions?: string[];
}
```

### Custom Approval Logic

```typescript
const createApprovalRequest = (toolName: string, args: Record<string, unknown>, agent: string): ApprovalRequest => {
  const category = getToolCategory(toolName);
  const riskLevel = calculateRiskLevel(toolName, args);
  
  return {
    id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    toolName,
    arguments: args,
    agent,
    timestamp: Date.now(),
    category,
    riskLevel,
    requiredPermissions: getRequiredPermissions(toolName)
  };
};
```

## Agent Handoffs

### Creating Specialized Agents

```typescript
// Slack Integration Agent
const slackAgent = new Agent({
  name: 'Slack Integration Specialist',
  instructions: `You specialize in Slack integrations and can:
    1. Send messages to Slack channels and users
    2. Create and manage Slack workflows
    3. Retrieve Slack channel information
    4. Help users connect their Slack accounts
    
    Always verify user permissions before performing Slack operations.`,
  tools: [slackMessageTool, slackChannelListTool, slackUserLookupTool],
  handoffDescription: 'Handles all Slack-related operations and integrations'
});

// Email Marketing Agent
const emailMarketingAgent = new Agent({
  name: 'Email Marketing Specialist',
  instructions: `You help with email marketing campaigns and can:
    1. Create and send marketing emails
    2. Manage email lists and segments
    3. Track email performance metrics
    4. Set up automated email sequences`,
  tools: [sendEmailTool, createEmailListTool, trackEmailTool],
  handoffDescription: 'Manages email marketing campaigns and automation'
});

// Updated Triage Agent
const triageAgent = new Agent({
  name: 'AI Assistant',
  instructions: `Route conversations to specialized agents:
    - Slack operations → Hand off to Slack Integration Specialist
    - Email marketing → Hand off to Email Marketing Specialist
    - Current information → Hand off to Web Search Specialist
    - Account/platform issues → Hand off to Database Specialist`,
  handoffs: [slackAgent, emailMarketingAgent, webSearchSpecialist, databaseSpecialist]
});
```

### Handoff Decision Logic

```typescript
// In your main agent instructions
const routingInstructions = `
**Decision Framework:**
- Slack mentions (channels, messages, notifications) → Hand off to Slack Integration Specialist
- Email campaigns, newsletters, marketing → Hand off to Email Marketing Specialist
- Current events, recent news, real-time data → Hand off to Web Search Specialist
- User accounts, sessions, billing, platform features → Hand off to Database Specialist
- General conversations, coding help, creative tasks → Handle directly
`;
```

## Guardrails

### Permission Guardrails

```typescript
import { guardrail } from '@openai/agents';

const permissionGuardrail = guardrail({
  name: 'user_permissions',
  validate: async (input, context) => {
    const { userId, organizationId, requestedAction } = context;
    
    // Check if user has permission for the requested action
    const hasPermission = await checkUserPermission(userId, organizationId, requestedAction);
    
    if (!hasPermission) {
      return {
        valid: false,
        reason: `User doesn't have permission to perform: ${requestedAction}`
      };
    }
    
    return { valid: true };
  }
});
```

### Content Safety Guardrails

```typescript
const contentSafetyGuardrail = guardrail({
  name: 'content_safety',
  validate: async (input) => {
    // Check for inappropriate content
    const safetyCheck = await moderateContent(input);
    
    if (!safetyCheck.safe) {
      return {
        valid: false,
        reason: 'Content violates safety guidelines'
      };
    }
    
    return { valid: true };
  }
});
```

### Rate Limiting Guardrails

```typescript
const rateLimitGuardrail = guardrail({
  name: 'rate_limit',
  validate: async (input, context) => {
    const { userId, toolName } = context;
    
    // Check rate limits for specific tools
    const withinLimits = await checkRateLimit(userId, toolName);
    
    if (!withinLimits) {
      return {
        valid: false,
        reason: 'Rate limit exceeded for this operation'
      };
    }
    
    return { valid: true };
  }
});
```

## Integration Patterns

### 1. **OAuth Integration Pattern**

```typescript
// Database schema for integrations
interface Integration {
  id: string;
  user_id: string;
  organization_id: string;
  service: 'slack' | 'google' | 'microsoft' | 'github';
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  scopes: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}
```

### 2. **Integration Service Pattern**

```typescript
// services/integrations/slack.ts
export class SlackIntegrationService {
  async connectAccount(userId: string, code: string) {
    // Exchange OAuth code for access token
    const tokenResponse = await this.exchangeOAuthCode(code);
    
    // Store integration in database
    const integration = await this.storeIntegration(userId, tokenResponse);
    
    return integration;
  }
  
  async sendMessage(userId: string, channel: string, message: string) {
    const integration = await this.getIntegration(userId, 'slack');
    if (!integration) {
      throw new Error('Slack not connected');
    }
    
    // Send message via Slack API
    return await this.slackApi.chat.postMessage({
      token: integration.access_token,
      channel,
      text: message
    });
  }
}
```

### 3. **Tool Registration Pattern**

```typescript
// tools/index.ts
export const registerIntegrationTools = (integrations: Integration[]) => {
  const tools = [];
  
  if (integrations.includes('slack')) {
    tools.push(slackMessageTool, slackChannelListTool);
  }
  
  if (integrations.includes('email')) {
    tools.push(sendEmailTool, createEmailListTool);
  }
  
  return tools;
};
```

## Slack Integration Example

Here's a complete example of implementing Slack integration:

### 1. **Database Migration**

```sql
-- Add to migrations
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('slack', 'google', 'microsoft', 'github')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id, service)
);

-- RLS policies
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own integrations"
  ON integrations
  FOR ALL
  USING (user_id = auth.uid());
```

### 2. **OAuth Route**

```typescript
// app/api/integrations/slack/oauth/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  if (!code) {
    return NextResponse.redirect('/dashboard/settings?error=oauth_failed');
  }
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.redirect('/auth/login');
    }
    
    // Exchange code for token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/slack/oauth`
      })
    });
    
    const tokens = await tokenResponse.json();
    
    // Store integration
    await supabase.from('integrations').upsert({
      user_id: user.id,
      organization_id: user.user_metadata.current_organization_id,
      service: 'slack',
      access_token: tokens.access_token,
      scopes: tokens.scope.split(','),
      metadata: {
        team_id: tokens.team.id,
        team_name: tokens.team.name,
        user_id: tokens.authed_user.id
      }
    });
    
    return NextResponse.redirect('/dashboard/settings?success=slack_connected');
  } catch (error) {
    console.error('Slack OAuth error:', error);
    return NextResponse.redirect('/dashboard/settings?error=oauth_failed');
  }
}
```

### 3. **Slack Tools**

```typescript
// tools/slack.ts
import { tool } from '@openai/agents';
import { z } from 'zod';

export const slackMessageTool = tool({
  name: 'send_slack_message',
  description: 'Send a message to a Slack channel or direct message',
  parameters: z.object({
    channel: z.string().describe('Channel name (#channel) or user ID for DM'),
    message: z.string().describe('Message content to send'),
    userId: z.string().describe('User ID for permission checking')
  }),
  needsApproval: true,
  execute: async ({ channel, message, userId }) => {
    const supabase = await createClient();
    
    // Get Slack integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('service', 'slack')
      .single();
    
    if (!integration) {
      throw new Error('Slack integration not found. Please connect your Slack account first.');
    }
    
    // Send message
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: channel.startsWith('#') ? channel.slice(1) : channel,
        text: message
      })
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`);
    }
    
    return `Message sent successfully to ${channel}`;
  }
});

export const slackChannelListTool = tool({
  name: 'list_slack_channels',
  description: 'List available Slack channels for the user',
  parameters: z.object({
    userId: z.string().describe('User ID for permission checking')
  }),
  execute: async ({ userId }) => {
    const supabase = await createClient();
    
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('service', 'slack')
      .single();
    
    if (!integration) {
      throw new Error('Slack integration not found.');
    }
    
    const response = await fetch('https://slack.com/api/conversations.list', {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`
      }
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`);
    }
    
    const channels = result.channels
      .filter((ch: any) => !ch.is_archived)
      .map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        purpose: ch.purpose.value
      }));
    
    return `Available channels:\n${channels.map(ch => `#${ch.name} - ${ch.purpose}`).join('\n')}`;
  }
});
```

### 4. **Updated Agent with Slack Integration**

```typescript
// Update agents in chat-agent route
const slackAgent = new Agent({
  name: 'Slack Integration Specialist',
  instructions: `You are a Slack integration specialist. You can:
    1. Send messages to Slack channels and users
    2. List available Slack channels
    3. Help users connect their Slack accounts
    4. Explain Slack features and best practices
    
    Before performing any Slack operations:
    - Verify the user has connected their Slack account
    - Ask for approval for sending messages
    - Use proper channel formatting (#channel-name)
    - Be helpful and explain what you're doing`,
  tools: [slackMessageTool, slackChannelListTool],
  handoffDescription: 'Handles Slack messaging, channel management, and integration setup'
});

// Update triage agent
const triageAgent = new Agent({
  name: 'AI Assistant',
  instructions: `You are an intelligent AI assistant that routes conversations to specialized agents:

**Decision Framework:**
- Slack operations (send messages, list channels) → Hand off to Slack Integration Specialist
- Current information, news, real-time data → Hand off to Web Search Specialist  
- Account, sessions, billing, platform features → Hand off to Database Specialist
- General conversations, coding help, creative tasks → Handle directly

Always explain handoffs to users and provide helpful context.`,
  handoffs: [slackAgent, webSearchSpecialist, databaseSpecialist]
});
```

## Best Practices

### 1. **Tool Design**
- Use clear, descriptive names and descriptions
- Implement proper error handling and validation
- Include comprehensive parameter descriptions
- Use appropriate approval settings for sensitive operations

### 2. **Agent Specialization**
- Create focused agents for specific domains
- Provide clear instructions and context
- Use descriptive handoff descriptions
- Implement proper fallback behaviors

### 3. **Security**
- Always validate user permissions before tool execution
- Use guardrails for sensitive operations
- Implement proper rate limiting
- Store credentials securely and rotate them regularly

### 4. **User Experience**
- Provide clear approval messages with context
- Implement proper loading states and progress indicators
- Handle errors gracefully with helpful messages
- Maintain conversation context across handoffs

### 5. **Performance**
- Cache frequently accessed data
- Implement proper timeout handling
- Use streaming for long-running operations
- Monitor and optimize agent performance

## Tracing and Debugging

### Enable Tracing

```typescript
import { startTraceExportLoop } from '@openai/agents';

// Start trace export (in development)
if (process.env.NODE_ENV === 'development') {
  startTraceExportLoop({
    apiKey: process.env.OPENAI_API_KEY!,
    projectId: process.env.OPENAI_PROJECT_ID!
  });
}
```

### Custom Tracing

```typescript
import { trace } from '@openai/agents';

const customTool = tool({
  name: 'custom_operation',
  // ... other config
  execute: async (params) => {
    return await trace('custom-operation', async () => {
      // Your tool logic here
      const result = await performOperation(params);
      return result;
    });
  }
});
```

### Debugging Tools

```typescript
// Add debugging information to tool responses
const debugTool = tool({
  name: 'debug_info',
  description: 'Get debugging information about the current session',
  parameters: z.object({
    includeContext: z.boolean().default(false)
  }),
  execute: async ({ includeContext }) => {
    const debug = {
      timestamp: new Date().toISOString(),
      sessionId: getCurrentSessionId(),
      activeAgent: getCurrentAgent(),
      toolsAvailable: getAvailableTools().map(t => t.name)
    };
    
    if (includeContext) {
      debug.context = getConversationContext();
    }
    
    return JSON.stringify(debug, null, 2);
  }
});
```

## Realtime Voice Agents

The OpenAI Agents SDK also supports realtime voice agents for conversational AI:

```typescript
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';

const voiceAgent = new RealtimeAgent({
  name: 'Voice Assistant',
  instructions: 'You are a helpful voice assistant that can perform actions via speech.',
  tools: [slackMessageTool, getUserDataTool],
  // Voice-specific configurations
  voice: 'alloy',
  temperature: 0.7
});

// In a browser environment
const session = new RealtimeSession(voiceAgent);
await session.connect({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY // Client-side key
});
```

### Voice Agent Considerations
- **Security**: Use client-side API keys with proper restrictions
- **Interruption Handling**: Built-in support for conversation interruptions
- **Context Management**: Maintain conversation state across voice interactions
- **Approval Workflows**: Adapt approval UI for voice interactions

## Additional Integration Examples

### GitHub Integration

```typescript
const githubTools = [
  tool({
    name: 'create_github_issue',
    description: 'Create a new GitHub issue in a repository',
    parameters: z.object({
      repo: z.string().describe('Repository name (owner/repo)'),
      title: z.string().describe('Issue title'),
      body: z.string().describe('Issue description'),
      labels: z.array(z.string()).optional().describe('Issue labels')
    }),
    needsApproval: true,
    execute: async ({ repo, title, body, labels, userId }) => {
      const integration = await getGitHubIntegration(userId);
      const response = await createGitHubIssue(integration.accessToken, repo, {
        title, body, labels
      });
      return `Issue created: ${response.html_url}`;
    }
  }),
  
  tool({
    name: 'list_repositories',
    description: 'List user repositories on GitHub',
    parameters: z.object({
      userId: z.string().describe('User ID for permission checking')
    }),
    execute: async ({ userId }) => {
      const integration = await getGitHubIntegration(userId);
      const repos = await listGitHubRepos(integration.accessToken);
      return repos.map(r => `${r.full_name} - ${r.description}`).join('\n');
    }
  })
];
```

### Calendar Integration

```typescript
const calendarTools = [
  tool({
    name: 'create_calendar_event',
    description: 'Create a new calendar event',
    parameters: z.object({
      title: z.string().describe('Event title'),
      startTime: z.string().describe('Start time (ISO format)'),
      endTime: z.string().describe('End time (ISO format)'),
      attendees: z.array(z.string().email()).optional()
    }),
    needsApproval: true,
    execute: async ({ title, startTime, endTime, attendees, userId }) => {
      const integration = await getCalendarIntegration(userId);
      const event = await createCalendarEvent(integration, {
        title, startTime, endTime, attendees
      });
      return `Event created: ${event.htmlLink}`;
    }
  })
];
```

### File Processing Tools

```typescript
const fileTools = [
  tool({
    name: 'analyze_document',
    description: 'Analyze an uploaded document',
    parameters: z.object({
      fileId: z.string().describe('File ID from upload'),
      analysisType: z.enum(['summary', 'extraction', 'classification'])
    }),
    execute: async ({ fileId, analysisType }) => {
      const file = await getFileFromStorage(fileId);
      const analysis = await analyzeDocument(file, analysisType);
      return analysis;
    }
  })
];
```

## Environment Configuration

### Required Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_PROJECT_ID=your_project_id # For tracing

# Integration Keys
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Application URLs
NEXT_PUBLIC_APP_URL=https://your-app.com
```

### Feature Flags

```typescript
// lib/feature-flags.ts
export const FEATURE_FLAGS = {
  AGENT_MODE: process.env.FEATURE_AGENT_MODE === 'true',
  SLACK_INTEGRATION: process.env.FEATURE_SLACK === 'true',
  VOICE_AGENTS: process.env.FEATURE_VOICE === 'true',
  GITHUB_INTEGRATION: process.env.FEATURE_GITHUB === 'true'
} as const;
```

## Testing Strategies

### Tool Testing

```typescript
// __tests__/tools/slack.test.ts
import { slackMessageTool } from '@/tools/slack';

describe('Slack Message Tool', () => {
  it('should send message successfully', async () => {
    const mockIntegration = { access_token: 'mock_token' };
    jest.mocked(getSlackIntegration).mockResolvedValue(mockIntegration);
    
    const result = await slackMessageTool.execute({
      channel: '#general',
      message: 'Test message',
      userId: 'user123'
    });
    
    expect(result).toContain('Message sent successfully');
  });
  
  it('should throw error when integration not found', async () => {
    jest.mocked(getSlackIntegration).mockResolvedValue(null);
    
    await expect(slackMessageTool.execute({
      channel: '#general',
      message: 'Test',
      userId: 'user123'
    })).rejects.toThrow('Slack integration not found');
  });
});
```

### Agent Testing

```typescript
// __tests__/agents/slack-agent.test.ts
import { run } from '@openai/agents';
import { slackAgent } from '@/agents/slack';

describe('Slack Agent', () => {
  it('should handle channel list request', async () => {
    const result = await run(slackAgent, 'List my Slack channels');
    expect(result.finalOutput).toContain('Available channels:');
  });
});
```

## Monitoring and Analytics

### Agent Performance Tracking

```typescript
// lib/analytics.ts
export const trackAgentUsage = async (
  userId: string,
  agentName: string,
  toolsUsed: string[],
  duration: number,
  success: boolean
) => {
  await supabase.from('agent_usage').insert({
    user_id: userId,
    agent_name: agentName,
    tools_used: toolsUsed,
    duration_ms: duration,
    success,
    timestamp: new Date().toISOString()
  });
};
```

### Tool Usage Analytics

```typescript
const analyticsMiddleware = (originalTool: any) => {
  return tool({
    ...originalTool,
    execute: async (params) => {
      const startTime = Date.now();
      let success = false;
      let result;
      
      try {
        result = await originalTool.execute(params);
        success = true;
        return result;
      } catch (error) {
        throw error;
      } finally {
        const duration = Date.now() - startTime;
        await trackToolUsage(
          originalTool.name,
          params.userId,
          duration,
          success
        );
      }
    }
  });
};
```

## Error Handling Patterns

### Global Error Handler

```typescript
// lib/agent-error-handler.ts
export const handleAgentError = (error: Error, context: AgentContext) => {
  console.error('Agent error:', error, context);
  
  // Log to monitoring service
  if (process.env.NODE_ENV === 'production') {
    logger.error('Agent execution failed', {
      error: error.message,
      stack: error.stack,
      userId: context.userId,
      agentName: context.agentName,
      toolName: context.toolName
    });
  }
  
  // Return user-friendly error message
  if (error.message.includes('rate_limit')) {
    return 'I need to slow down a bit. Please try again in a moment.';
  }
  
  if (error.message.includes('permission')) {
    return "I don't have permission to perform that action. Please check your account settings.";
  }
  
  return 'I encountered an error while processing your request. Please try again.';
};
```

### Tool Error Recovery

```typescript
const resilientTool = tool({
  name: 'resilient_operation',
  execute: async (params) => {
    let lastError;
    
    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await performOperation(params);
      } catch (error) {
        lastError = error;
        
        if (attempt < 3) {
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }
    
    throw new Error(`Operation failed after 3 attempts: ${lastError.message}`);
  }
});
```

## Advanced Patterns

### Context-Aware Tools

```typescript
const contextAwareTool = tool({
  name: 'smart_response',
  execute: async (params, context) => {
    // Access conversation history
    const recentMessages = context.conversationHistory.slice(-5);
    
    // Adapt behavior based on context
    if (recentMessages.some(m => m.content.includes('urgent'))) {
      return await handleUrgentRequest(params);
    }
    
    return await handleNormalRequest(params);
  }
});
```

### Dynamic Tool Loading

```typescript
const loadUserTools = async (userId: string) => {
  const integrations = await getUserIntegrations(userId);
  const tools = [];
  
  for (const integration of integrations) {
    const toolModule = await import(`@/tools/${integration.service}`);
    tools.push(...toolModule.tools);
  }
  
  return tools;
};
```

### Workflow Automation

```typescript
const workflowAgent = new Agent({
  name: 'Workflow Automation Specialist',
  instructions: `You can create and execute multi-step workflows by:
    1. Breaking down complex tasks into steps
    2. Using multiple tools in sequence
    3. Handling dependencies between steps
    4. Providing status updates throughout execution`,
  tools: [
    createWorkflowTool,
    executeWorkflowStepTool,
    getWorkflowStatusTool
  ]
});
```

## Deployment Considerations

### Production Checklist

- [ ] Enable tracing and monitoring
- [ ] Set up proper error logging
- [ ] Configure rate limiting
- [ ] Implement proper secret management
- [ ] Set up health checks for integrations
- [ ] Configure backup OAuth credentials
- [ ] Test all approval workflows
- [ ] Validate permission systems
- [ ] Monitor agent performance metrics
- [ ] Set up alerting for failures

### Scaling Considerations

- **Tool Caching**: Cache frequently used data and API responses
- **Rate Limiting**: Implement per-user and per-tool rate limits
- **Queue Management**: Use job queues for long-running operations
- **Resource Monitoring**: Track memory and CPU usage for agent operations
- **Database Optimization**: Index frequently queried integration data

## Extending the System

To add new integrations or tools:

1. **Define the integration schema** in your database
2. **Create OAuth routes** for account connection
3. **Implement tools** with proper validation and approval settings
4. **Create specialized agents** for the integration domain
5. **Update the triage agent** with new handoff logic
6. **Add UI components** for connection management
7. **Implement monitoring and analytics**
8. **Add comprehensive tests**
9. **Document the integration**
10. **Test thoroughly** with proper error handling

This architecture allows for easy extension while maintaining security, user control, and proper separation of concerns. 