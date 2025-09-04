import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  uuid,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  googleId: varchar("google_id").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workspaces for multi-tenant support
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id").references(() => users.id).notNull(),
  name: varchar("name").notNull(),
  plan: varchar("plan").default("free"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workspace members
export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: uuid("workspace_id").references(() => workspaces.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: varchar("role").notNull().default("editor"), // owner, admin, editor, viewer
  invitedAt: timestamp("invited_at").defaultNow(),
}, (table: any) => [
  index("workspace_members_workspace_id_idx").on(table.workspaceId),
  index("workspace_members_user_id_idx").on(table.userId),
]);

// Canvas/Funnel definitions
export const canvases = pgTable("canvases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid("workspace_id").references(() => workspaces.id).notNull(),
  title: varchar("title").notNull(),
  templateId: uuid("template_id"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Canvas state versions for version control
export const canvasStates = pgTable("canvas_states", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  canvasId: uuid("canvas_id").references(() => canvases.id).notNull(),
  version: integer("version").notNull(),
  flowJson: jsonb("flow_json").notNull(),
  flowHash: varchar("flow_hash"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table: any) => [
  index("canvas_states_canvas_id_version_idx").on(table.canvasId, table.version),
  index("canvas_states_flow_hash_idx").on(table.flowHash),
]);

// Text memos for canvas annotations
export const textMemos = pgTable("text_memos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  canvasId: uuid("canvas_id").references(() => canvases.id, { onDelete: 'cascade' }).notNull(),
  content: text("content").notNull(),
  position: jsonb("position").notNull(), // { x: number, y: number }
  size: jsonb("size"), // { width: number, height: number }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table: any) => [
  index("text_memos_canvas_id_idx").on(table.canvasId),
]);

// Chat messages for canvas AI conversations
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  canvasId: uuid("canvas_id").references(() => canvases.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: varchar("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table: any) => [
  index("chat_messages_canvas_id_idx").on(table.canvasId),
  index("chat_messages_created_at_idx").on(table.createdAt),
]);

// Knowledge assets (uploaded files/URLs) - Now canvas-specific
export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid("workspace_id").references(() => workspaces.id).notNull(),
  canvasId: uuid("canvas_id").references(() => canvases.id).notNull(), // Made required for canvas-specific assets
  type: varchar("type").notNull(), // pdf, youtube, instagram, note, url
  url: text("url"),
  fileRef: varchar("file_ref"),
  contentSha256: varchar("content_sha256"),
  title: varchar("title").notNull(),
  metaJson: jsonb("meta_json"),
  status: varchar("status").default("pending"), // pending, processing, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
}, (table: any) => [
  index("assets_workspace_id_idx").on(table.workspaceId),
  index("assets_canvas_id_idx").on(table.canvasId), // New index for canvas-specific queries
  index("assets_content_sha256_idx").on(table.contentSha256),
]);

// Asset chunks for vector search
export const assetChunks = pgTable("asset_chunks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }).notNull(),
  seq: integer("seq").notNull(),
  text: text("text").notNull(),
  embedding: text("embedding"), // JSON string of vector
  tokens: integer("tokens"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table: any) => [
  index("asset_chunks_asset_id_seq_idx").on(table.assetId, table.seq),
]);

// Ingest jobs for processing assets
export const ingestJobs = pgTable("ingest_jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }).notNull(),
  jobType: varchar("job_type").notNull(), // apify, pdf_text, pdf_ocr
  status: varchar("status").notNull().default("pending"), // pending, running, succeeded, failed
  attempts: integer("attempts").default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Feedback runs
export const feedbackRuns = pgTable("feedback_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  canvasId: uuid("canvas_id").references(() => canvases.id).notNull(),
  stateVersion: integer("state_version"),
  flowHash: varchar("flow_hash"),
  kbHash: varchar("kb_hash"),
  promptVersion: varchar("prompt_version"),
  bpVersion: varchar("bp_version"),
  model: varchar("model"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table: any) => [
  index("feedback_runs_flow_kb_hash_idx").on(table.flowHash, table.kbHash),
]);

// Individual feedback items
export const feedbackItems = pgTable("feedback_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: uuid("run_id").references(() => feedbackRuns.id, { onDelete: "cascade" }).notNull(),
  nodeId: varchar("node_id"),
  severity: varchar("severity").notNull(), // low, medium, high
  suggestion: text("suggestion").notNull(),
  rationale: text("rationale"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Enhanced template system for reusable funnel designs
export const funnelTemplates = pgTable("funnel_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // 'marketing', 'sales', 'education', etc.
  thumbnail: varchar("thumbnail"), // URL to template preview image
  nodeData: jsonb("node_data").notNull(), // Template nodes and their positions
  edgeData: jsonb("edge_data").notNull(), // Template connections
  isPublic: boolean("is_public").default(true),
  isOfficial: boolean("is_official").default(false), // Official templates by admin
  createdBy: varchar("created_by").references(() => users.id),
  usageCount: integer("usage_count").default(0),
  rating: doublePrecision("rating").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Removed funnelNodeTypes - users now create free-form nodes

// Node instances in canvas states
export const nodeInstances = pgTable("node_instances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  canvasStateId: uuid("canvas_state_id").references(() => canvasStates.id, { onDelete: "cascade" }).notNull(),
  nodeIdInFlow: varchar("node_id_in_flow").notNull(),
  nodeTypeKey: varchar("node_type_key").notNull(),
  propsJson: jsonb("props_json"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Node contents (email templates, etc.)
export const nodeContents = pgTable("node_contents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nodeInstanceId: uuid("node_instance_id").references(() => nodeInstances.id, { onDelete: "cascade" }).notNull(),
  contentType: varchar("content_type").notNull(), // email_subject, email_body, landing_copy, etc.
  contentText: text("content_text").notNull(),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// Node metrics
export const nodeMetrics = pgTable("node_metrics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nodeInstanceId: uuid("node_instance_id").references(() => nodeInstances.id, { onDelete: "cascade" }).notNull(),
  metricKey: varchar("metric_key").notNull(), // open_rate, click_rate, conversion_rate
  metricValueNumeric: doublePrecision("metric_value_numeric"),
  metricValueText: varchar("metric_value_text"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  source: varchar("source").notNull().default("manual"), // auto, manual
  createdAt: timestamp("created_at").defaultNow(),
});

// Global AI Knowledge Base
export const globalAiKnowledge = pgTable("global_ai_knowledge", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  tags: text("tags").array(),
  sourceUrl: varchar("source_url"),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// Canvas-specific AI Knowledge Base (replaces user-level knowledge)
export const canvasKnowledge = pgTable("canvas_knowledge", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  canvasId: uuid("canvas_id").references(() => canvases.id, { onDelete: "cascade" }).notNull(),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }),
  assetType: varchar("asset_type").notNull(), // pdf, youtube, url, manual
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  extractedText: text("extracted_text"), // Raw extracted text from PDFs/videos
  processedContent: text("processed_content"), // AI-enhanced content
  tags: text("tags").array(),
  sourceUrl: varchar("source_url"),
  metadata: jsonb("metadata"), // Additional asset-specific metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table: any) => [
  index("canvas_knowledge_canvas_id_idx").on(table.canvasId),
  index("canvas_knowledge_asset_id_idx").on(table.assetId),
]);

// Canvas todos for task management
export const canvasTodos = pgTable("canvas_todos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  canvasId: uuid("canvas_id").references(() => canvases.id, { onDelete: "cascade" }).notNull(),
  text: varchar("text").notNull(),
  completed: boolean("completed").default(false),
  position: integer("position").default(0), // For ordering
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table: any) => [
  index("canvas_todos_canvas_id_idx").on(table.canvasId),
]);

// Canvas nodes for individual node storage with JSON metadata
export const canvasNodes = pgTable("canvas_nodes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  canvasId: uuid("canvas_id").references(() => canvases.id, { onDelete: "cascade" }).notNull(),
  nodeId: varchar("node_id").notNull(), // Frontend node ID
  type: varchar("type").notNull(), // Node type (landing, form, email, etc.)
  position: jsonb("position").notNull(), // { x: number, y: number }
  data: jsonb("data").notNull(), // Node data (title, subtitle, icon, color, etc.)
  metadata: jsonb("metadata").default('{}'), // Additional metadata for the node
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table: any) => [
  index("canvas_nodes_canvas_id_idx").on(table.canvasId),
  index("canvas_nodes_type_idx").on(table.type),
  index("canvas_nodes_created_by_idx").on(table.createdBy),
  // Ensure unique node_id per canvas
  index("canvas_nodes_canvas_node_unique_idx").on(table.canvasId, table.nodeId),
]);

// Canvas edges for storing connections between nodes
export const canvasEdges = pgTable("canvas_edges", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  canvasId: uuid("canvas_id").references(() => canvases.id, { onDelete: "cascade" }).notNull(),
  edgeId: varchar("edge_id").notNull(), // Frontend edge ID
  sourceNodeId: varchar("source_node_id").notNull(), // Source node ID
  targetNodeId: varchar("target_node_id").notNull(), // Target node ID
  type: varchar("type").default("default"), // Edge type
  data: jsonb("data").default('{}'), // Edge data (label, style, etc.)
  metadata: jsonb("metadata").default('{}'), // Additional metadata for the edge
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table: any) => [
  index("canvas_edges_canvas_id_idx").on(table.canvasId),
  index("canvas_edges_source_idx").on(table.sourceNodeId),
  index("canvas_edges_target_idx").on(table.targetNodeId),
  // Ensure unique edge_id per canvas
  index("canvas_edges_canvas_edge_unique_idx").on(table.canvasId, table.edgeId),
]);

// Canvas shares for individual canvas access control
export const canvasShares = pgTable("canvas_shares", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  canvasId: uuid("canvas_id").references(() => canvases.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role").notNull().default("editor"), // owner, editor, viewer
  sharedBy: varchar("shared_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table: any) => [
  index("canvas_shares_canvas_id_idx").on(table.canvasId),
  index("canvas_shares_user_id_idx").on(table.userId),
]);

// Relations
export const usersRelations = relations(users, ({ many, one }: any) => ({
  ownedWorkspaces: many(workspaces),
  workspaceMemberships: many(workspaceMembers),
  createdCanvases: many(canvases),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }: any) => ({
  owner: one(users, { fields: [workspaces.ownerUserId], references: [users.id] }),
  members: many(workspaceMembers),
  canvases: many(canvases),
  assets: many(assets),
  templates: many(funnelTemplates),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }: any) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const canvasesRelations = relations(canvases, ({ one, many }: any) => ({
  workspace: one(workspaces, { fields: [canvases.workspaceId], references: [workspaces.id] }),
  creator: one(users, { fields: [canvases.createdBy], references: [users.id] }),
  states: many(canvasStates),
  assets: many(assets),
  knowledge: many(canvasKnowledge),
  feedbackRuns: many(feedbackRuns),
  shares: many(canvasShares),
  nodes: many(canvasNodes),
  edges: many(canvasEdges),
  todos: many(canvasTodos),
  textMemos: many(textMemos),
  chatMessages: many(chatMessages),
}));

export const canvasSharesRelations = relations(canvasShares, ({ one }: any) => ({
  canvas: one(canvases, { fields: [canvasShares.canvasId], references: [canvases.id] }),
  user: one(users, { fields: [canvasShares.userId], references: [users.id] }),
  sharedByUser: one(users, { fields: [canvasShares.sharedBy], references: [users.id] }),
}));

export const canvasNodesRelations = relations(canvasNodes, ({ one }: any) => ({
  canvas: one(canvases, { fields: [canvasNodes.canvasId], references: [canvases.id] }),
  creator: one(users, { fields: [canvasNodes.createdBy], references: [users.id] }),
}));

export const canvasEdgesRelations = relations(canvasEdges, ({ one }: any) => ({
  canvas: one(canvases, { fields: [canvasEdges.canvasId], references: [canvases.id] }),
  creator: one(users, { fields: [canvasEdges.createdBy], references: [users.id] }),
}));

export const canvasKnowledgeRelations = relations(canvasKnowledge, ({ one }: any) => ({
  canvas: one(canvases, { fields: [canvasKnowledge.canvasId], references: [canvases.id] }),
  asset: one(assets, { fields: [canvasKnowledge.assetId], references: [assets.id] }),
}));

export const canvasStatesRelations = relations(canvasStates, ({ one, many }: any) => ({
  canvas: one(canvases, { fields: [canvasStates.canvasId], references: [canvases.id] }),
  nodeInstances: many(nodeInstances),
}));

export const assetsRelations = relations(assets, ({ one, many }: any) => ({
  workspace: one(workspaces, { fields: [assets.workspaceId], references: [workspaces.id] }),
  canvas: one(canvases, { fields: [assets.canvasId], references: [canvases.id] }),
  chunks: many(assetChunks),
  ingestJobs: many(ingestJobs),
}));

// Schema exports
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Template ratings and reviews
export const templateReviews = pgTable("template_reviews", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: uuid("template_id").references(() => funnelTemplates.id),
  userId: varchar("user_id").references(() => users.id),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin roles for managing the platform
export const adminRoles = pgTable("admin_roles", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  role: varchar("role"), // 'super_admin', 'template_moderator', 'node_creator'
  permissions: jsonb("permissions"), // Array of permission strings
  createdAt: timestamp("created_at").defaultNow(),
});

export type FunnelTemplate = typeof funnelTemplates.$inferSelect;
export type InsertFunnelTemplate = typeof funnelTemplates.$inferInsert;
// Removed FunnelNodeType types - using free-form nodes now
export type TemplateReview = typeof templateReviews.$inferSelect;
export type InsertTemplateReview = typeof templateReviews.$inferInsert;
export type AdminRole = typeof adminRoles.$inferSelect;
export type InsertAdminRole = typeof adminRoles.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type Canvas = typeof canvases.$inferSelect;
export type CanvasState = typeof canvasStates.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type AssetChunk = typeof assetChunks.$inferSelect;
export type FeedbackRun = typeof feedbackRuns.$inferSelect;
export type FeedbackItem = typeof feedbackItems.$inferSelect;
export type TextMemo = typeof textMemos.$inferSelect;
export type InsertTextMemo = typeof textMemos.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
// NodeType removed - using free-form node creation
export type NodeInstance = typeof nodeInstances.$inferSelect;
export type NodeContent = typeof nodeContents.$inferSelect;
export type NodeMetric = typeof nodeMetrics.$inferSelect;
export type CanvasKnowledge = typeof canvasKnowledge.$inferSelect;
export type CanvasTodo = typeof canvasTodos.$inferSelect;
export type InsertCanvasTodo = typeof canvasTodos.$inferInsert;
export type CanvasShare = typeof canvasShares.$inferSelect;
export type InsertCanvasShare = typeof canvasShares.$inferInsert;
export type CanvasNode = typeof canvasNodes.$inferSelect;
export type InsertCanvasNode = typeof canvasNodes.$inferInsert;
export type CanvasEdge = typeof canvasEdges.$inferSelect;
export type InsertCanvasEdge = typeof canvasEdges.$inferInsert;

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCanvasSchema = createInsertSchema(canvases).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true });
export const insertFeedbackRunSchema = createInsertSchema(feedbackRuns).omit({ id: true, createdAt: true });
export const insertFunnelTemplateSchema = createInsertSchema(funnelTemplates).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type InsertCanvas = z.infer<typeof insertCanvasSchema>;

// Workspace member types
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type InsertWorkspaceMember = typeof workspaceMembers.$inferInsert;
export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembers);
export type InsertWorkspaceMemberType = z.infer<typeof insertWorkspaceMemberSchema>;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type InsertFeedbackRun = z.infer<typeof insertFeedbackRunSchema>;
// InsertTemplate removed - using InsertFunnelTemplate instead
// Removed insertNodeTypeSchema - using free-form node creation now
export const insertNodeContentSchema = createInsertSchema(nodeContents).omit({ id: true, createdAt: true });
export type InsertNodeContent = z.infer<typeof insertNodeContentSchema>;
export const insertNodeMetricSchema = createInsertSchema(nodeMetrics).omit({ id: true, createdAt: true });
export type InsertNodeMetric = z.infer<typeof insertNodeMetricSchema>;
export const insertCanvasKnowledgeSchema = createInsertSchema(canvasKnowledge).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCanvasKnowledge = z.infer<typeof insertCanvasKnowledgeSchema>;
export const insertTextMemoSchema = createInsertSchema(textMemos).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTextMemoType = z.infer<typeof insertTextMemoSchema>;
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessageType = z.infer<typeof insertChatMessageSchema>;
export const insertCanvasTodoSchema = createInsertSchema(canvasTodos).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCanvasTodoType = z.infer<typeof insertCanvasTodoSchema>;
export const insertCanvasShareSchema = createInsertSchema(canvasShares).omit({ id: true, createdAt: true });
export type InsertCanvasShareType = z.infer<typeof insertCanvasShareSchema>;
export const insertCanvasNodeSchema = createInsertSchema(canvasNodes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCanvasNodeType = z.infer<typeof insertCanvasNodeSchema>;
export const insertCanvasEdgeSchema = createInsertSchema(canvasEdges).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCanvasEdgeType = z.infer<typeof insertCanvasEdgeSchema>;
