# Agent System

This document explains the AI Agent system in SupaStart, including its features, credit costs, and differences from regular chat.

## Overview

The Agent System is a premium AI feature that provides intelligent routing, specialized capabilities, and human-in-the-loop approvals for enhanced AI interactions. It uses OpenAI's Agents SDK to provide multi-agent architecture with specialized tools.

## Features

### 🤖 **Multi-Agent Architecture**
- **Triage Agent**: Routes conversations to appropriate specialists
- **Web Search Specialist**: Handles requests requiring current information
- **Database Specialist**: Manages sessions and platform features
- **Intelligent Routing**: Automatically determines the best agent for each request

### 🔍 **Web Search with Human Approval**
- **Real-time Information**: Access to current web data via OpenAI's search infrastructure
- **Human-in-the-Loop**: Inline approval system for web searches
- **Safety & Transparency**: Users approve each search before execution
- **Conversational Approvals**: Seamless approval flow within chat interface

### 📝 **Enhanced Formatting**
- **Structured Responses**: Proper markdown formatting with headings and bullet points
- **Source Citations**: Automatic citation of web search sources
- **Professional Output**: Clean, readable responses optimized for business use

### 💾 **Complete Session Management**
- **Full History Storage**: All agent conversations saved to database
- **Metadata Tracking**: Rich metadata including active agent and tools used
- **Credit Tracking**: Detailed cost tracking per interaction

## Credit System

### **Agent Mode Pricing**
```
Agent Chat: 1 credit per conversation
```

**Why Fixed Pricing?**
- **Predictable Costs**: Users always know the cost upfront
- **Premium Positioning**: Reflects the advanced capabilities
- **Simplicity**: Easy to understand and budget for

### **Comparison with Other Features**

| Feature | Cost | Notes |
|---------|------|-------|
| **Basic Chat** | 1 credit | Standard AI chat without special features |
| **Chat with Web Search** | 2 credits | Regular chat + web search capability |
| **Agent Mode** | 1 credit | Multi-agent system + human approvals + enhanced features |
| **Image Generation** | 5+ credits | Base cost × quantity × quality multiplier |

### **Why Agent Mode is 1 Credit**

**Design Philosophy:**
- **Premium Experience**: Agent mode provides superior capabilities at competitive pricing
- **Encourages Adoption**: Lower barrier to entry for advanced features
- **Value Proposition**: More features for the same cost as basic chat

**Technical Justification:**
- **Efficient Architecture**: Multi-agent routing optimizes resource usage
- **Human Approval**: Prevents unnecessary API calls through approval gates
- **Batch Processing**: Intelligent request handling reduces overhead

## Architecture

### **Agent Hierarchy**
```
Triage Agent (Main Router)
├── Web Search Specialist
│   ├── OpenAI Web Search Tool
│   └── Human Approval System
├── Database Specialist
│   ├── Session Management
│   └── Platform Features
└── Direct Handling
    ├── General Conversations
    ├── Knowledge Questions
    └── Creative Tasks
```

### **Request Flow**
1. **User Input**: Message received by triage agent
2. **Intelligent Routing**: Determines appropriate specialist
3. **Tool Execution**: Specialist uses required tools
4. **Human Approval**: User approves sensitive operations
5. **Response Generation**: Formatted response with citations
6. **Session Storage**: Complete interaction saved to database

## Differences from Regular Chat

| Aspect | Regular Chat | Agent Mode |
|--------|-------------|------------|
| **Architecture** | Single model | Multi-agent system |
| **Web Search** | Direct API calls | Human-approved searches |
| **Routing** | Manual feature selection | Intelligent auto-routing |
| **Formatting** | Basic responses | Enhanced markdown formatting |
| **Approvals** | None | Human-in-the-loop for sensitive operations |
| **Specialization** | General purpose | Task-specific specialists |
| **Cost** | 1-2 credits | 1 credit (fixed) |
| **Session Storage** | Basic metadata | Rich metadata with agent info |

## Permission System

Agent access can be controlled through the organization permission system:

### **Permission Configuration**
- **Feature ID**: `"agents"`
- **Default**: Enabled for all roles
- **Control**: Admins can toggle access for members

### **Role Access**
- **Owners**: Always have access
- **Admins**: Always have access  
- **Members**: Access controlled by organization settings

## Implementation Details

### **Credit Handling**
```typescript
// Fixed cost approach (current)
const AGENT_CREDIT_COST = 1;

// Applied per conversation, not per message
if (agentMode) {
  cost_credits: 1
}
```

### **Session Metadata**
```typescript
// Agent sessions include rich metadata
metadata: {
  agentMode: true,
  activeAgent: 'Web Search Specialist',
  toolsUsed: ['web_search'],
  approvals: { web_search: true }
}
```

### **Authentication**
- Uses server-side Supabase client for proper cookie handling
- Full user/organization authentication
- Consistent with other protected features

## Usage Guidelines

### **When to Use Agent Mode**
- ✅ Need current/real-time information
- ✅ Complex queries requiring specialized handling
- ✅ Want enhanced formatting and citations
- ✅ Prefer intelligent routing over manual feature selection

### **When to Use Regular Chat**
- ✅ Simple questions or conversations
- ✅ Don't need web search
- ✅ Want faster responses (no approval delays)
- ✅ Basic formatting is sufficient

## Future Enhancements

### **Potential Features**
- **Dynamic Pricing**: Cost based on tools used
- **More Specialists**: Code generation, data analysis agents
- **Batch Approvals**: Approve multiple operations at once
- **Custom Agents**: Organization-specific specialist agents

### **Pricing Evolution**
```typescript
// Potential future pricing structure
AGENT: {
  BASIC: 1,              // Basic agent chat (no tools)
  WITH_WEB_SEARCH: 2,    // Agent with web search
  WITH_DATABASE: 2,      // Agent with database queries  
  FULL_SUITE: 3,         // All tools available
}
```

## Best Practices

### **For Users**
1. **Use Approvals Wisely**: Only approve searches that add value
2. **Clear Requests**: Specific questions get better routing
3. **Review Citations**: Verify information from web sources

### **For Developers**
1. **Consistent Patterns**: Follow established credit system patterns
2. **Error Handling**: Graceful fallbacks for failed operations
3. **Monitoring**: Track agent performance and costs
4. **Documentation**: Keep this doc updated with new features

## Troubleshooting

### **Common Issues**
- **401 Errors**: Ensure proper server-side Supabase client usage
- **Missing History**: Verify session creation and storage
- **Approval Loops**: Check approval request formatting
- **Credit Deduction**: Confirm proper cost tracking

### **Debug Steps**
1. Check authentication flow
2. Verify session creation
3. Review agent routing logs
4. Validate approval handling
5. Confirm credit deduction 