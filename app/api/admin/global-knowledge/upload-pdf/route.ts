import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/auth/withAuthorization'
import { createServiceClient } from '@/lib/supabase/service'
import { buildChunks, estimateTokens } from '@/services/textChunker'
import { OpenAIService } from '@/services/openai'
import { extractPdfText } from '@/services/pdf'

const BUCKET_ID = 'canvas-assets'

async function handlePost(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const title = (formData.get('title') as string | null) || 'Untitled'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Only PDF is allowed' }, { status: 400 })

    const supabase = createServiceClient()

    // Extract text from PDF (pdf2json)
    const arrayBuffer = await file.arrayBuffer()
    const extractedText = await extractPdfText(arrayBuffer)

    // Upload PDF to storage under global path
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9-_]+/g, '-')
    const fileName = `${Date.now()}-${sanitizedTitle || 'document'}.pdf`
    const storagePath = `global/${fileName}`
    const uploadRes = await supabase.storage.from(BUCKET_ID).upload(storagePath, new Uint8Array(arrayBuffer), {
      contentType: 'application/pdf',
      upsert: false,
    })
    if (uploadRes.error) return NextResponse.json({ error: `Upload failed: ${uploadRes.error.message}` }, { status: 500 })

    const { data: publicUrl } = supabase.storage.from(BUCKET_ID).getPublicUrl(storagePath)

    // Chunk + embeddings (shared chunker)
    const chunkTexts = await buildChunks(extractedText)
    const ai = new OpenAIService()
    const embeddings = await ai.generateEmbeddingsBatch(chunkTexts)

    // Insert into global_ai_knowledge
    const { data: inserted, error: insertErr } = await (supabase as any)
      .from('global_ai_knowledge')
      .insert({
        title,
        content: extractedText,
        tags: null,
        source_url: publicUrl?.publicUrl || null,
        version: 1,
      })
      .select('id, title, content, created_at')
      .single()
    if (insertErr || !inserted) return NextResponse.json({ error: 'Failed to create global knowledge' }, { status: 500 })

    // Insert chunks
    const rows = chunkTexts.map((text, idx) => ({
      knowledge_id: inserted.id,
      seq: idx + 1,
      text,
      embedding: (embeddings[idx] as any) ?? null,
      tokens: estimateTokens(text),
    }))
    if (rows.length > 0) {
      const { error: chunkErr } = await (supabase as any).from('global_knowledge_chunks').insert(rows)
      if (chunkErr) return NextResponse.json({ error: `Failed to insert chunks: ${chunkErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: inserted.id, fileUrl: publicUrl?.publicUrl || null, chunkCount: rows.length })
  } catch (e) {
    console.error('Admin global PDF upload error:', e)
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const POST = withAdmin(handlePost)


