// Types for the unified history system

export type SessionType = 'chat' | 'sandbox' | 'agent' | 'magic_ads'

export type InteractionType = 
  | 'user_message' 
  | 'assistant_message' 
  | 'image_generation' 
  | 'image_edit'
  | 'image_variation'
  | 'agent_action' 
  | 'agent_finding'

export type ArtifactType = 'image' | 'document' | 'code' | 'data'

export type AgentMonitorType = 
  | 'website' 
  | 'blog' 
  | 'search_results' 
  | 'rss_feed' 
  | 'api_endpoint'

export type AgentChangeType = 
  | 'content_change' 
  | 'new_content' 
  | 'keyword_match' 
  | 'structure_change'

export interface Session {
  id: string
  organization_id: string
  user_id: string
  type: SessionType
  title?: string
  description?: string
  metadata: Record<string, unknown>
  starred: boolean
  archived: boolean
  created_at: string
  updated_at: string
}

export interface Interaction {
  id: string
  session_id: string
  type: InteractionType
  content?: string
  metadata: Record<string, unknown>
  cost_credits: number
  created_at: string
  sequence: number
}

export interface Artifact {
  id: string
  interaction_id: string
  type: ArtifactType
  url?: string
  filename?: string
  size_bytes?: number
  mime_type?: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AgentMonitor {
  id: string
  organization_id: string
  user_id: string
  name: string
  type: AgentMonitorType
  target_url: string
  check_frequency: string // interval
  keywords?: string[]
  last_checked?: string
  last_change_detected?: string
  active: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AgentFinding {
  id: string
  monitor_id: string
  session_id?: string
  change_type: AgentChangeType
  summary: string
  details: Record<string, unknown>
  confidence_score?: number
  reviewed: boolean
  created_at: string
}

// Combined types for UI components
export interface SessionWithInteractions extends Session {
  interactions: InteractionWithArtifacts[]
}

export interface InteractionWithArtifacts extends Interaction {
  artifacts: Artifact[]
}

// Chat-specific types for backwards compatibility
export interface ChatSession extends Session {
  type: 'chat'
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  metadata?: Record<string, unknown>
  cost_credits?: number
  timestamp?: string
}

// Sandbox-specific types for backwards compatibility
export interface SandboxSession extends Session {
  type: 'sandbox'
}

export interface SandboxGeneration {
  id: string
  prompt: string
  images: string[]
  style?: string
  cost_credits: number
  timestamp: string
  starred?: boolean
}

// API request/response types
export interface CreateSessionRequest {
  organization_id: string
  type: SessionType
  title?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface CreateInteractionRequest {
  session_id: string
  type: InteractionType
  content?: string
  metadata?: Record<string, unknown>
  cost_credits?: number
}

export interface CreateArtifactRequest {
  interaction_id: string
  type: ArtifactType
  url?: string
  filename?: string
  size_bytes?: number
  mime_type?: string
  metadata?: Record<string, unknown>
}

export interface UpdateSessionRequest {
  title?: string
  description?: string
  metadata?: Record<string, unknown>
  starred?: boolean
  archived?: boolean
}

// History filtering and pagination
export interface HistoryFilters {
  type?: SessionType[]
  starred?: boolean
  archived?: boolean
  user_id?: string
  search?: string
  date_from?: string
  date_to?: string
}

export interface HistoryPagination {
  limit?: number
  offset?: number
  order_by?: 'created_at' | 'updated_at' | 'title'
  order_direction?: 'asc' | 'desc'
}

export interface SessionWithSummary extends Session {
  interaction_count: number
  latest_artifacts: Artifact[]
}

export interface HistoryResponse {
  sessions: SessionWithSummary[]
  total_count: number
  has_more: boolean
}

// Agent monitoring types
export interface CreateAgentMonitorRequest {
  organization_id: string
  name: string
  type: AgentMonitorType
  target_url: string
  check_frequency?: string
  keywords?: string[]
  metadata?: Record<string, unknown>
}

export interface UpdateAgentMonitorRequest {
  name?: string
  target_url?: string
  check_frequency?: string
  keywords?: string[]
  active?: boolean
  metadata?: Record<string, unknown>
}

export interface AgentFindingWithMonitor extends AgentFinding {
  monitor: AgentMonitor
}

// Utility types
export type SessionPreview = Pick<Session, 'id' | 'type' | 'title' | 'created_at' | 'updated_at' | 'starred'>

export type InteractionPreview = Pick<Interaction, 'id' | 'type' | 'content' | 'created_at' | 'cost_credits'> 