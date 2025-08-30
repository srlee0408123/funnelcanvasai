import { storage } from "../storage";
import { OpenAIService, type FeedbackItem } from "./openai";
const openaiService = new OpenAIService();
import { createHash } from "crypto";

export interface FeedbackRequest {
  canvasId: string;
  stateVersion?: number;
  userId: string;
}

export interface FeedbackResponse {
  run: {
    id: string;
    canvasId: string;
    flowHash: string;
    kbHash: string;
    createdAt: Date;
  };
  items: FeedbackItem[];
}

export class AIFeedbackService {
  async generateFeedback(canvasId: string, stateVersion?: number, userId?: string): Promise<FeedbackResponse> {
    // Get canvas state
    const state = stateVersion 
      ? await storage.getCanvasState(canvasId, stateVersion)
      : await storage.getLatestCanvasState(canvasId);

    if (!state) {
      throw new Error("Canvas state not found");
    }

    const canvas = await storage.getCanvas(canvasId);
    if (!canvas) {
      throw new Error("Canvas not found");
    }

    // Generate flow and knowledge base hashes
    const flowHash = this.generateFlowHash(state.flowJson);
    const kbData = await this.getKnowledgeBase(canvas.workspaceId, userId);
    const kbHash = this.generateKnowledgeHash(kbData);

    // Check for cached feedback
    const existingRun = await storage.getFeedbackRun(canvasId, flowHash, kbHash);
    if (existingRun) {
      const items = await storage.getFeedbackItems(existingRun.id);
      return {
        run: {
          id: existingRun.id,
          canvasId: existingRun.canvasId,
          flowHash: existingRun.flowHash!,
          kbHash: existingRun.kbHash!,
          createdAt: existingRun.createdAt!,
        },
        items: items.map(item => ({
          nodeId: item.nodeId!,
          suggestion: item.suggestion,
          severity: item.severity as "low" | "medium" | "high",
          rationale: item.rationale!,
        })),
      };
    }

    // Generate new feedback
    const startTime = Date.now();
    
    const feedbackItems = await openaiService.generateFunnelFeedback({
      flowJson: state.flowJson,
      knowledgeBase: kbData,
    });

    const latencyMs = Date.now() - startTime;

    // Save feedback run
    const feedbackRun = await storage.createFeedbackRun({
      canvasId,
      stateVersion: state.version,
      flowHash,
      kbHash,
      promptVersion: "1.0",
      bpVersion: "1.0",
      model: "gpt-4o",
      latencyMs,
    });

    // Save feedback items
    for (const item of feedbackItems) {
      await storage.createFeedbackItem({
        runId: feedbackRun.id,
        nodeId: item.nodeId,
        severity: item.severity,
        suggestion: item.suggestion,
        rationale: item.rationale,
      });
    }

    return {
      run: {
        id: feedbackRun.id,
        canvasId: feedbackRun.canvasId,
        flowHash: feedbackRun.flowHash!,
        kbHash: feedbackRun.kbHash!,
        createdAt: feedbackRun.createdAt!,
      },
      items: feedbackItems,
    };
  }

  private async getKnowledgeBase(workspaceId: string, userId?: string): Promise<Array<{
    title: string;
    content: string;
    source: string;
  }>> {
    const knowledgeBase: Array<{ title: string; content: string; source: string; }> = [];

    // Get global knowledge
    const globalKnowledge = await storage.getGlobalKnowledge();
    for (const item of globalKnowledge) {
      knowledgeBase.push({
        title: item.title,
        content: item.content,
        source: "Global Knowledge Base",
      });
    }

    // Canvas knowledge is handled at the canvas level, not user level
    // Individual canvas knowledge is passed separately via canvasId

    // Get asset chunks from workspace assets
    const assetChunks = await storage.getTopKKnowledge(workspaceId, userId || "", undefined, 10);
    for (const chunk of assetChunks) {
      knowledgeBase.push({
        title: `Asset Chunk ${chunk.seq}`,
        content: chunk.text,
        source: "Workspace Assets",
      });
    }

    return knowledgeBase;
  }

  private generateFlowHash(flowJson: any): string {
    const normalized = this.normalizeFlowJson(flowJson);
    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex')
      .substring(0, 32);
  }

  private generateKnowledgeHash(knowledgeBase: Array<{ title: string; content: string; source: string }>): string {
    const concatenated = knowledgeBase
      .map(kb => `${kb.source}:${kb.title}:${kb.content.substring(0, 100)}`)
      .sort()
      .join('|');
    
    return createHash('sha256')
      .update(concatenated)
      .digest('hex')
      .substring(0, 32);
  }

  private normalizeFlowJson(flowJson: any): any {
    // Sort nodes and edges to ensure consistent hashing
    const normalized = { ...flowJson };
    
    if (normalized.nodes) {
      normalized.nodes = [...normalized.nodes].sort((a, b) => a.id.localeCompare(b.id));
    }
    
    if (normalized.edges) {
      normalized.edges = [...normalized.edges].sort((a, b) => a.id.localeCompare(b.id));
    }
    
    return normalized;
  }

  applyTemplateParameters(flowJson: any, parameters: Record<string, any>): any {
    let jsonString = JSON.stringify(flowJson);
    
    // Replace template variables like {{brand_name}}
    for (const [key, value] of Object.entries(parameters)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      jsonString = jsonString.replace(regex, String(value));
    }
    
    return JSON.parse(jsonString);
  }
}

export const aiFeedbackService = new AIFeedbackService();
