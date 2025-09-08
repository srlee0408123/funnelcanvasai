import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/auth/withAuthorization'
import { createGlobalKnowledge, listGlobalKnowledge, createGlobalKnowledgeChunks } from '@/services/storageService'
import { firecrawlService } from '@/services/firecrawl'
import { extractYouTubeTranscript } from '@/services/apify/youtubeTranscript'
import { buildChunks } from '@/services/textChunker'
import { OpenAIService } from '@/services/openai'

export const GET = withAdmin(async (_req: NextRequest) => {
  const list = await listGlobalKnowledge()
  return NextResponse.json(list)
})

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { type, title, content, tags, sourceUrl, url, youtubeUrl } = body || {}

    // 1) TEXT 직접 입력 (문서 생성 + 청킹/임베딩 + 청크 저장)
    if ((type === 'text' || !type) && title && content) {
      const created = await createGlobalKnowledge({ title, content, tags, sourceUrl })
      const ai = new OpenAIService()
      const chunks = await buildChunks(content)
      const embeddings = await ai.generateEmbeddingsBatch(chunks)
      await createGlobalKnowledgeChunks({
        knowledgeId: created.id,
        chunks: chunks.map((text, idx) => ({ seq: idx + 1, text, embedding: embeddings[idx] }))
      })
      return NextResponse.json(created)
    }

    // 2) URL 스크래핑
    if (type === 'url' && url) {
      const scraped = await firecrawlService.scrapeToText(url)
      const docTitle = title || scraped.title || url
      const docContent = scraped.markdown || scraped.text || ''
      if (!docContent) return NextResponse.json({ error: '스크래핑 결과가 비어 있습니다.' }, { status: 400 })
      const created = await createGlobalKnowledge({ title: docTitle, content: docContent, tags, sourceUrl: url })
      const ai = new OpenAIService()
      // 청킹은 순수 텍스트 기준 (markdown 우선 저장이더라도 텍스트로 분할 안정성)
      const chunks = await buildChunks(scraped.text || scraped.markdown || docContent)
      const embeddings = await ai.generateEmbeddingsBatch(chunks)
      await createGlobalKnowledgeChunks({
        knowledgeId: created.id,
        chunks: chunks.map((text, idx) => ({ seq: idx + 1, text, embedding: embeddings[idx] }))
      })
      return NextResponse.json(created)
    }

    // 3) YouTube 전사
    if (type === 'youtube' && (youtubeUrl || url)) {
      const yt = await extractYouTubeTranscript(youtubeUrl || url)
      const transcript = yt.transcript || ''
      if (!transcript) return NextResponse.json({ error: '자막을 추출하지 못했습니다.' }, { status: 400 })
      const docTitle = title || yt.title || (youtubeUrl || url)
      const docContent = `YouTube Video Transcript\n\nTitle: ${yt.title}\nChannel: ${yt.channelName}\nDuration: ${yt.duration}\n\n${transcript}`
      const created = await createGlobalKnowledge({ title: docTitle, content: docContent, tags, sourceUrl: youtubeUrl || url })
      const ai = new OpenAIService()
      const chunks = await buildChunks(transcript)
      const embeddings = await ai.generateEmbeddingsBatch(chunks)
      await createGlobalKnowledgeChunks({
        knowledgeId: created.id,
        chunks: chunks.map((text, idx) => ({ seq: idx + 1, text, embedding: embeddings[idx] }))
      })
      return NextResponse.json(created)
    }

    return NextResponse.json({ error: '유효한 입력이 아닙니다.' }, { status: 400 })
  } catch (e) {
    console.error('Admin global knowledge POST error:', e)
    return NextResponse.json({ error: '글로벌 지식 생성 실패' }, { status: 500 })
  }
})


