export interface FunnelNode {
  id: string;
  type: NodeType;
  data: NodeData;
  position: Position;
  metrics?: NodeMetrics;
  feedback?: NodeFeedback[];
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
