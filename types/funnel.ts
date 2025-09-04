export interface FunnelNode {
  id: string;
  type: NodeType;
  data: NodeData;
  position: Position;
  metrics?: NodeMetrics;
  feedback?: NodeFeedback[];
  metadata?: NodeMetadata;
}

export interface NodeData {
  title: string;
  subtitle?: string;
  icon: string;
  color: NodeColor;
  properties: NodeProperties;
  contents: NodeContents;
}

export interface Position {
  x: number;
  y: number;
}

export interface FunnelEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: EdgeType;
  animated?: boolean;
  data?: EdgeData;
  metadata?: EdgeMetadata;
}

export interface FunnelFlow {
  nodes: FunnelNode[];
  edges: FunnelEdge[];
  viewport?: Viewport;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export type NodeType = 
  | "email"
  | "landing" 
  | "social"
  | "sms"
  | "payment"
  | "automation"
  | "form"
  | "video"
  | "webinar"
  | "survey";

export type NodeColor = 
  | "blue"
  | "green" 
  | "purple"
  | "orange"
  | "red"
  | "indigo"
  | "pink"
  | "yellow"
  | "gray";

export type EdgeType = 
  | "default"
  | "smoothstep"
  | "step"
  | "straight";

export interface NodeProperties {
  channel?: string;
  cta?: string;
  sendTime?: string;
  frequency?: string;
  targeting?: string;
  automation?: boolean;
  triggers?: string[];
  conditions?: Condition[];
}

export interface Condition {
  type: "user_action" | "time_delay" | "attribute" | "behavior";
  operator: "equals" | "contains" | "greater_than" | "less_than" | "exists";
  value: string | number | boolean;
  field?: string;
}

export interface NodeContents {
  subject?: string;
  body?: string;
  htmlBody?: string;
  images?: string[];
  videos?: string[];
  attachments?: string[];
  template?: string;
  variables?: Record<string, string>;
}

export interface NodeMetrics {
  [key: string]: MetricValue;
}

export interface MetricValue {
  value: number | string;
  label: string;
  trend?: "up" | "down" | "neutral";
  change?: number;
  period?: DateRange;
  source?: "auto" | "manual" | "integration";
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface NodeFeedback {
  id: string;
  severity: FeedbackSeverity;
  title: string;
  suggestion: string;
  rationale?: string;
  source: "ai" | "user" | "system";
  category: FeedbackCategory;
  createdAt: Date;
  resolved?: boolean;
}

export type FeedbackSeverity = "low" | "medium" | "high" | "critical";

export type FeedbackCategory = 
  | "performance"
  | "content"
  | "design"
  | "technical"
  | "compliance"
  | "best_practice";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  flow: FunnelFlow;
  parameters: TemplateParameter[];
  preview?: TemplatePreview;
  author?: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateParameter {
  key: string;
  label: string;
  type: "text" | "number" | "email" | "url" | "select" | "boolean";
  required: boolean;
  defaultValue?: any;
  options?: string[];
  validation?: ParameterValidation;
}

export interface ParameterValidation {
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
}

export interface TemplatePreview {
  thumbnail?: string;
  nodeCount: number;
  estimatedSetupTime: number; // minutes
  requiredIntegrations: string[];
  sampleMetrics?: Record<string, number>;
}

export interface Asset {
  id: string;
  workspaceId: string;
  canvasId?: string;
  type: AssetType;
  title: string;
  url?: string;
  fileRef?: string;
  status: AssetStatus;
  metadata: AssetMetadata;
  createdAt: Date;
  processedAt?: Date;
}

export type AssetType = "pdf" | "youtube" | "url" | "image" | "video" | "text";

export type AssetStatus = "pending" | "processing" | "completed" | "failed";

export interface AssetMetadata {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  duration?: number; // for videos
  pageCount?: number; // for PDFs
  wordCount?: number;
  language?: string;
  extractedText?: string;
  thumbnails?: string[];
  tags?: string[];
}

export interface Workspace {
  id: string;
  name: string;
  plan: "free" | "pro" | "enterprise";
  ownerId: string;
  members: WorkspaceMember[];
  settings: WorkspaceSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  userId: string;
  role: "owner" | "admin" | "editor" | "viewer";
  invitedAt: Date;
  lastActiveAt?: Date;
}

export interface WorkspaceSettings {
  aiEnabled: boolean;
  allowPublicSharing: boolean;
  defaultNodeStyle: Partial<NodeData>;
  integrations: Integration[];
  notifications: NotificationSettings;
}

export interface Integration {
  type: string;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  lastSyncAt?: Date;
}

export interface NotificationSettings {
  email: boolean;
  slack: boolean;
  webhook?: string;
  events: string[];
}

export interface Canvas {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  flow: FunnelFlow;
  templateId?: string;
  collaborators: string[];
  lastSavedAt: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIFeedbackRequest {
  canvasId: string;
  stateVersion?: number;
  focusAreas?: FeedbackCategory[];
  context?: string;
}

export interface AIFeedbackResponse {
  runId: string;
  items: NodeFeedback[];
  summary: string;
  overallScore: number;
  recommendations: string[];
  processingTime: number;
  model: string;
  createdAt: Date;
}

export interface ExportOptions {
  format: "json" | "png" | "svg" | "pdf";
  includeMetrics?: boolean;
  includeFeedback?: boolean;
  quality?: "low" | "medium" | "high";
  scale?: number;
}

export interface ImportOptions {
  mergeStrategy: "replace" | "merge" | "append";
  preserveIds?: boolean;
  validateFlow?: boolean;
}

// Database-specific types for node and edge metadata
export interface NodeMetadata {
  // 성능 관련 메타데이터
  performance?: {
    conversionRate?: number;
    clickThroughRate?: number;
    bounceRate?: number;
    avgTimeOnPage?: number;
    lastOptimized?: Date;
  };
  
  // 콘텐츠 관련 메타데이터
  content?: {
    version?: string;
    lastUpdated?: Date;
    author?: string;
    approvalStatus?: "draft" | "pending" | "approved" | "rejected";
    reviewNotes?: string;
    language?: string;
    wordCount?: number;
  };
  
  // 기술적 메타데이터
  technical?: {
    integrationId?: string;
    externalId?: string;
    apiEndpoint?: string;
    webhookUrl?: string;
    lastSyncAt?: Date;
    syncStatus?: "synced" | "pending" | "failed";
    errorLog?: string[];
  };
  
  // 분석 및 추적 메타데이터
  analytics?: {
    trackingId?: string;
    pixelId?: string;
    goalId?: string;
    customEvents?: string[];
    utmParameters?: Record<string, string>;
    conversionGoals?: ConversionGoal[];
  };
  
  // 사용자 정의 메타데이터
  custom?: Record<string, any>;
  
  // 시스템 메타데이터
  system?: {
    createdBy?: string;
    lastModifiedBy?: string;
    version?: number;
    tags?: string[];
    notes?: string;
    priority?: "low" | "medium" | "high" | "critical";
    status?: "active" | "inactive" | "archived";
  };
}

export interface EdgeMetadata {
  // 연결 관련 메타데이터
  connection?: {
    weight?: number; // 연결 강도 (0-1)
    probability?: number; // 전환 확률
    conditions?: EdgeCondition[];
    triggers?: EdgeTrigger[];
  };
  
  // 성능 메타데이터
  performance?: {
    conversionRate?: number;
    dropOffRate?: number;
    avgTransitionTime?: number;
    lastOptimized?: Date;
  };
  
  // 스타일 및 표시 메타데이터
  display?: {
    color?: string;
    strokeWidth?: number;
    dashArray?: string;
    label?: string;
    labelPosition?: "start" | "middle" | "end";
    showArrow?: boolean;
  };
  
  // 사용자 정의 메타데이터
  custom?: Record<string, any>;
  
  // 시스템 메타데이터
  system?: {
    createdBy?: string;
    lastModifiedBy?: string;
    version?: number;
    notes?: string;
    status?: "active" | "inactive" | "archived";
  };
}

export interface EdgeData {
  label?: string;
  style?: Record<string, any>;
  markerEnd?: string;
  animated?: boolean;
}

export interface ConversionGoal {
  id: string;
  name: string;
  type: "page_view" | "click" | "form_submit" | "purchase" | "custom";
  value?: number;
  currency?: string;
  conditions?: Record<string, any>;
}

export interface EdgeCondition {
  type: "user_segment" | "time_based" | "behavior" | "attribute" | "random";
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "in" | "not_in";
  field?: string;
  value: any;
  probability?: number; // 0-1 for random conditions
}

export interface EdgeTrigger {
  type: "immediate" | "delay" | "event" | "condition";
  delay?: number; // milliseconds for delay triggers
  event?: string; // event name for event triggers
  condition?: EdgeCondition; // condition for condition triggers
}

// Database entity types (matching the database schema)
export interface CanvasNodeEntity {
  id: string; // UUID
  canvas_id: string;
  node_id: string; // Frontend node ID
  type: string;
  position: { x: number; y: number };
  data: NodeData;
  metadata: NodeMetadata;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasEdgeEntity {
  id: string; // UUID
  canvas_id: string;
  edge_id: string; // Frontend edge ID
  source_node_id: string;
  target_node_id: string;
  type: string;
  data: EdgeData;
  metadata: EdgeMetadata;
  created_by: string;
  created_at: string;
  updated_at: string;
}
