/**
 * pdf.ts - 서버용 PDF 텍스트 추출 유틸리티
 *
 * 역할:
 * - pdf2json을 사용하여 ArrayBuffer에서 텍스트를 추출
 * - 라우트들 간 중복 제거를 위해 공통 함수 제공
 */

export async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdf2json = await import('pdf2json')
  const PDFParser = (pdf2json as any).default || (pdf2json as any)
  const parser = new PDFParser()
  const buffer = Buffer.from(arrayBuffer)
  const text = await new Promise<string>((resolve, reject) => {
    let combined = ''
    const handleDataReady = (data: any) => {
      try {
        const decode = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }
        const rawPages = (data && (data.formImage?.Pages || data.Pages)) || []
        const pages = Array.isArray(rawPages) ? rawPages : []
        for (const page of pages) {
          const texts = Array.isArray((page as any)?.Texts) ? (page as any).Texts : []
          let line = ''
          for (const t of texts) {
            const runs = Array.isArray((t as any)?.R) ? (t as any).R : []
            const runStr = runs.length > 0
              ? runs.map((r: any) => decode(typeof r?.T === 'string' ? r.T : '')).join('')
              : decode(typeof (t as any)?.T === 'string' ? (t as any).T : '')
            if (runStr && runStr.trim()) line += (line ? ' ' : '') + runStr.trim()
          }
          if (line.trim()) combined += (combined ? '\n\n' : '') + line.trim()
        }
        resolve(combined || '')
      } catch (e) {
        reject(e)
      } finally {
        parser.removeAllListeners('pdfParser_dataReady')
        parser.removeAllListeners('pdfParser_dataError')
      }
    }
    const handleError = (err: any) => {
      parser.removeAllListeners('pdfParser_dataReady')
      parser.removeAllListeners('pdfParser_dataError')
      reject(err)
    }
    parser.on('pdfParser_dataReady', handleDataReady)
    parser.on('pdfParser_dataError', handleError)
    parser.parseBuffer(buffer)
  })
  return text
}


