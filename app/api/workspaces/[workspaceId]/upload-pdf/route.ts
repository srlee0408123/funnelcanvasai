import { NextRequest, NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { createServiceClient } from "@/lib/supabase/service";
import { isFreePlan, countCanvasKnowledge } from '@/lib/planLimits';
import { buildChunks } from "@/services/textChunker";
import { OpenAIService } from "@/services/openai";
import { extractPdfText } from "@/services/pdf";

/**
 * upload-pdf/route.ts - PDF 업로드, 텍스트 추출, 청킹 및 지식 저장
 * 
 * 주요 역할:
 * 1. 멀티파트 FormData로 업로드된 PDF를 Supabase Storage에 저장 (bucket: canvas-assets)
 * 2. 저장된 파일을 서버에서 다운로드 후 LangChain PDFLoader로 텍스트 추출
 * 3. RecursiveCharacterTextSplitter로 텍스트 청킹 후 knowledge_chunks에 일괄 저장
 * 4. canvas_knowledge 레코드 생성 및 업로드 메타데이터 저장
 * 
 * 핵심 특징:
 * - 저장 경로: workspaceId/canvasId/{timestamp}-{sanitizedTitle}.pdf
 * - 대용량 파일 대비 스트림 대신 Blob 처리 (Supabase SDK download)
 * - 안전한 서버 키(Service Role)로 RLS 우회 삽입
 * 
 * 주의사항:
 * - 클라이언트는 PdfUploadModal에서 FormData로 file, title, workspaceId, canvasId 전송
 * - bucket은 supabase/migrations/00002_storage_buckets.sql의 'canvas-assets' 사용
 * - 임베딩은 후속 단계에서 처리(여기서는 embedding null)
 */

const BUCKET_ID = "canvas-assets";

async function handlePost(request: NextRequest, { params, auth }: { params: { workspaceId: string }; auth: { userId: string } }) {
  try {
    const { workspaceId } = params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null) || "Untitled";
    const canvasId = formData.get("canvasId") as string | null;
    const workspaceIdFromBody = formData.get("workspaceId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!canvasId) {
      return NextResponse.json({ error: "canvasId is required" }, { status: 400 });
    }
    if (!workspaceId || workspaceIdFromBody !== workspaceId) {
      return NextResponse.json({ error: "Invalid workspaceId" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF is allowed" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 무료 플랜: 캔버스당 지식 3개 제한 (Pro는 제한 없음)
    try {
      if (canvasId) {
        const free = await isFreePlan(auth.userId);
        if (free) {
          const count = await countCanvasKnowledge(canvasId);
          if (count >= 3) {
            return NextResponse.json({
              error: '무료 플랜에서는 캔버스당 지식 자료를 3개까지만 업로드할 수 있습니다.',
              code: 'FREE_PLAN_LIMIT_KNOWLEDGE',
              limit: 3
            }, { status: 403 });
          }
        }
      }
    } catch (planErr) {
      console.warn('PDF upload knowledge limit check failed:', planErr);
    }

    // 1) Upload to Supabase Storage with path workspace/canvas
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9-_]+/g, "-");
    const fileName = `${Date.now()}-${sanitizedTitle || "document"}.pdf`;
    const storagePath = `${workspaceId}/${canvasId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const extractedText = await extractPdfText(arrayBuffer);
    
    // 1-b) Upload to Supabase Storage with path workspace/canvas
    const uploadRes = await supabase
      .storage
      .from(BUCKET_ID)
      .upload(storagePath, new Uint8Array(arrayBuffer), {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadRes.error) {
      return NextResponse.json({ error: `Upload failed: ${uploadRes.error.message}` }, { status: 500 });
    }

    // 2) Split text into chunks (shared chunker)
    const chunkTexts = await buildChunks(extractedText);
    // Generate embeddings for chunks
    const ai = new OpenAIService();
    const embeddings = await ai.generateEmbeddingsBatch(chunkTexts);

    // 3) Insert into canvas_knowledge
    const { data: publicUrl } = supabase
      .storage
      .from(BUCKET_ID)
      .getPublicUrl(storagePath);

    const metadata = {
      source: "pdf",
      storageBucket: BUCKET_ID,
      storagePath,
      originalFileName: file.name || fileName,
      contentLength: extractedText.length,
      processedAt: new Date().toISOString(),
      fileUrl: publicUrl?.publicUrl || null,
    } as const;

    const { data: knowledge, error: knowledgeError } = await supabase
      .from("canvas_knowledge")
      .insert({
        canvas_id: canvasId,
        type: "pdf",
        title,
        content: extractedText,
        metadata,
      })
      .select()
      .single();

    if (knowledgeError) {
      return NextResponse.json({ error: `Failed to create knowledge: ${knowledgeError.message}` }, { status: 500 });
    }

    // 4) Insert chunks into knowledge_chunks
    const inserts = chunkTexts.map((text, idx) => ({
      canvas_id: canvasId,
      knowledge_id: knowledge.id,
      seq: idx + 1,
      text,
      embedding: (embeddings[idx] as unknown as any) ?? null,
    }));

    if (inserts.length > 0) {
      const { error: chunkError } = await (supabase as any)
        .from("knowledge_chunks")
        .upsert(inserts, { onConflict: 'knowledge_id,seq' });
      if (chunkError) {
        return NextResponse.json({ error: `Failed to insert chunks: ${chunkError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      knowledgeId: knowledge.id,
      fileUrl: publicUrl?.publicUrl || null,
      chunkCount: inserts.length,
    });
  } catch (error) {
    console.error("upload-pdf error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withAuthorization({ resourceType: "workspace", minRole: "member" }, handlePost);


