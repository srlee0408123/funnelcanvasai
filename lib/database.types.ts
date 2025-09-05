/**
 * database.types.ts - Supabase 데이터베이스 타입 정의
 * 
 * 주요 역할:
 * 1. Supabase 데이터베이스 스키마의 TypeScript 타입 정의
 * 2. 타입 안전성을 위한 데이터베이스 인터페이스 제공
 * 3. 자동 완성 및 컴파일 타임 에러 방지
 * 
 * 핵심 특징:
 * - 모든 테이블과 뷰에 대한 타입 정의
 * - Insert, Update, Select 작업을 위한 별도 타입
 * - 관계형 데이터를 위한 조인 타입 지원
 * 
 * 주의사항:
 * - 데이터베이스 스키마 변경 시 수동으로 업데이트 필요
 * - Supabase CLI를 통한 자동 생성 권장
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      text_memos: {
        Row: {
          id: string
          canvas_id: string
          content: string
          position: Json
          size: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          canvas_id: string
          content: string
          position: Json
          size?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          canvas_id?: string
          content?: string
          position?: Json
          size?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Relationships: []
      }
      canvas_states: {
        Row: {
          id: string
          canvas_id: string
          state: Json
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          canvas_id: string
          state: Json
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          canvas_id?: string
          state?: Json
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      canvas_knowledge: {
        Row: {
          id: string
          canvas_id: string
          type: 'pdf' | 'youtube' | 'url' | 'text'
          title: string
          content: string | null
          metadata: Json | null
          embedding: unknown | null
          extracted_text?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          canvas_id: string
          type: 'pdf' | 'youtube' | 'url' | 'text'
          title: string
          content?: string | null
          metadata?: Json | null
          embedding?: unknown | null
          extracted_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          canvas_id?: string
          type?: 'pdf' | 'youtube' | 'url' | 'text'
          title?: string
          content?: string | null
          metadata?: Json | null
          embedding?: unknown | null
          extracted_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      canvases: {
        Row: {
          id: string
          title: string
          description: string | null
          user_id: string
          created_by: string
          workspace_id: string | null
          is_public: boolean
          created_at: string
          updated_at: string
          data: Json | null
          nodes: Json | null
          edges: Json | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          user_id: string
          created_by: string
          workspace_id?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
          data?: Json | null
          nodes?: Json | null
          edges?: Json | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          user_id?: string
          created_by?: string
          workspace_id?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
          data?: Json | null
          nodes?: Json | null
          edges?: Json | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          id: string
          canvas_id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          canvas_id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          canvas_id?: string
          user_id?: string
          role?: 'user' | 'assistant'
          content?: string
          created_at?: string
        }
        Relationships: []
      }
      canvas_chat_messages: {
        Row: {
          id: string
          canvas_id: string
          user_id: string
          message: string
          role: 'user' | 'assistant'
          created_at: string
        }
        Insert: {
          id?: string
          canvas_id: string
          user_id: string
          message: string
          role: 'user' | 'assistant'
          created_at?: string
        }
        Update: {
          id?: string
          canvas_id?: string
          user_id?: string
          message?: string
          role?: 'user' | 'assistant'
          created_at?: string
        }
        Relationships: []
      }
      canvas_text_memos: {
        Row: {
          id: string
          canvas_id: string
          user_id: string
          content: string
          position_x: number
          position_y: number
          width: number
          height: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          canvas_id: string
          user_id: string
          content: string
          position_x: number
          position_y: number
          width: number
          height: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          canvas_id?: string
          user_id?: string
          content?: string
          position_x?: number
          position_y?: number
          width?: number
          height?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      canvas_nodes: {
        Row: {
          id: string
          canvas_id: string
          node_id: string
          type: string
          data: Json
          position: Json
          metadata: Json | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          canvas_id: string
          node_id: string
          type: string
          data: Json
          position: Json
          metadata?: Json | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          canvas_id?: string
          node_id?: string
          type?: string
          data?: Json
          position?: Json
          metadata?: Json | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      canvas_edges: {
        Row: {
          id: string
          canvas_id: string
          edge_id: string
          source_node_id: string
          target_node_id: string
          type: string | null
          data: Json | null
          metadata: Json | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          canvas_id: string
          edge_id: string
          source_node_id: string
          target_node_id: string
          type?: string | null
          data?: Json | null
          metadata?: Json | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          canvas_id?: string
          edge_id?: string
          source_node_id?: string
          target_node_id?: string
          type?: string | null
          data?: Json | null
          metadata?: Json | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      canvas_todos: {
        Row: {
          id: string
          canvas_id: string
          user_id: string
          title: string
          description: string | null
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          priority: 'low' | 'medium' | 'high'
          position_x: number
          position_y: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          canvas_id: string
          user_id: string
          title: string
          description?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          priority?: 'low' | 'medium' | 'high'
          position_x: number
          position_y: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          canvas_id?: string
          user_id?: string
          title?: string
          description?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          priority?: 'low' | 'medium' | 'high'
          position_x?: number
          position_y?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          id: string
          workspace_id: string
          canvas_id: string
          type: string
          url: string | null
          file_ref: string | null
          content_sha256: string | null
          title: string
          meta_json: Json | null
          status: 'pending' | 'processing' | 'completed' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          canvas_id: string
          type: string
          url?: string | null
          file_ref?: string | null
          content_sha256?: string | null
          title: string
          meta_json?: Json | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          canvas_id?: string
          type?: string
          url?: string | null
          file_ref?: string | null
          content_sha256?: string | null
          title?: string
          meta_json?: Json | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          created_at?: string
        }
        Relationships: []
      }
      asset_chunks: {
        Row: {
          id: string
          asset_id: string
          seq: number
          text: string
          embedding: string | null
          tokens: number | null
          created_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          seq: number
          text: string
          embedding?: string | null
          tokens?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          seq?: number
          text?: string
          embedding?: string | null
          tokens?: number | null
          created_at?: string
        }
        Relationships: []
      }
      feedback_runs: {
        Row: {
          id: string
          canvas_id: string
          state_version: number | null
          flow_hash: string | null
          kb_hash: string | null
          prompt_version: string | null
          bp_version: string | null
          model: string | null
          latency_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          canvas_id: string
          state_version?: number | null
          flow_hash?: string | null
          kb_hash?: string | null
          prompt_version?: string | null
          bp_version?: string | null
          model?: string | null
          latency_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          canvas_id?: string
          state_version?: number | null
          flow_hash?: string | null
          kb_hash?: string | null
          prompt_version?: string | null
          bp_version?: string | null
          model?: string | null
          latency_ms?: number | null
          created_at?: string
        }
        Relationships: []
      }
      feedback_items: {
        Row: {
          id: string
          run_id: string
          node_id: string | null
          severity: string
          suggestion: string
          rationale: string | null
          created_at: string
        }
        Insert: {
          id?: string
          run_id: string
          node_id?: string | null
          severity: string
          suggestion: string
          rationale?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          run_id?: string
          node_id?: string | null
          severity?: string
          suggestion?: string
          rationale?: string | null
          created_at?: string
        }
        Relationships: []
      }
      global_ai_knowledge: {
        Row: {
          id: string
          title: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
