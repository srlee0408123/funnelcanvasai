import { NextRequest, NextResponse } from 'next/server';
import { withAuthorization } from '@/lib/auth/withAuthorization';
import { OpenAIService } from '@/services/openai';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * onboarding/route.ts - 캔버스 최초 온보딩 대화 및 초안 생성 API
 * 
 * 주요 역할:
 * 1. ytsystemprompt.md를 시스템 프롬프트로 사용해 대화 응답 생성(action: "chat")
 * 2. 대화 로그를 요약하고 노드/엣지 초안 JSON을 생성(action: "finalize")
 * 3. 최소 스펙: DB 저장 없음, 응답만 반환(클라이언트가 상태 반영)
 * 
 * 핵심 특징:
 * - 시스템 프롬프트는 런타임에 파일에서 읽어와 모듈 캐시로 재사용
 * - 노드/엣지 스키마 지시를 추가하여 모델이 직접 Flow JSON을 생성
 * - withAuthorization으로 캔버스 접근 권한 검증
 * 
 * 주의사항:
 * - 모델 출력이 코드펜스로 감싸질 수 있어 JSON 파싱 전 정리 필요
 */

const openai = new OpenAIService();
let cachedSystemPrompt: string | null = null;

async function getYtSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const root = process.cwd();
  const filePath = path.join(root, 'docs', 'ytsystemprompt.md');
  const content = await fs.readFile(filePath, 'utf8');
  cachedSystemPrompt = content;
  return cachedSystemPrompt;
}

function buildNodeFlowInstruction(): string {
  return [
    '---',
    '추가 규칙: 응답에서 노드 초안 생성을 지원합니다.',
    '대화가 충분히 진행되어 사용자가 동의하면 반드시 다음 문장을 출력해 종료 사인을 제공합니다:',
    '"이 내용을 바탕으로 노드 생성을 원하시면 하단의 대화 종료 & 초안 만들기 버튼 클릭해 주세요."',
    '',
    '최종 생성 시에는 아래 JSON 스키마를 따르는 Flow를 생성합니다.',
    'JSON 외 텍스트 없이 순수 JSON만 출력해야 합니다.',
    '',
    '{',
    '  "summary": string, // 대화 요약으로 워크플로우 기획서 핵심을 6~10줄로',
    '  "flow": {',
    '    "nodes": [',
    '      {',
    '        "id": string,',
    '        "type": "custom",',
    '        "data": {',
    '          "icon": string,',
    '          "color": string, // HEX, 예: "#3B82F6"',
    '          "title": string,',
    '          "subtitle": string,',
    '          "assignees"?: string[]',
    '        },',
    '        "position": { "x": number, "y": number }',
    '      }',
    '    ],',
    '    "edges": [',
    '      {',
    '        "id": string,',
    '        "source": string,',
    '        "target": string,',
    '        "data": { "sourceAnchor": "left"|"right"|"top"|"bottom", "targetAnchor": "left"|"right"|"top"|"bottom" }',
    '      }',
    '    ]',
    '  }',
    '}',
    '',
    '배치 규칙:',
    '- 노드 위치는 겹치지 않도록 250px 간격의 격자 배치(x는 200부터 증가, y는 100부터 증가).',
    '- 엣지는 왼쪽에서 오른쪽으로 흐르는 방향을 기본으로 하고 sourceAnchor="right", targetAnchor="left"를 기본값으로 합니다.',
  ].join('\n');
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function stringifyConversation(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
    .join('\n');
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    const withoutFirst = trimmed.replace(/^```[a-zA-Z]*\n?/, '');
    const withoutLast = withoutFirst.replace(/```\s*$/, '');
    return withoutLast.trim();
  }
  return trimmed;
}

export const POST = withAuthorization({ resourceType: 'canvas' }, async (req: NextRequest, { params }) => {
  try {
    const { canvasId } = params as { canvasId: string };
    const body = await req.json();
    const action = String(body?.action || 'chat');
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];

    if (!canvasId) {
      return NextResponse.json({ error: 'canvasId가 필요합니다.' }, { status: 400 });
    }
    if (!messages.length) {
      return NextResponse.json({ error: 'messages가 필요합니다.' }, { status: 400 });
    }

    // 시스템 프롬프트는 ytsystemprompt.md 원문 그대로 사용
    const systemPrompt = `${await getYtSystemPrompt()}`;

    if (action === 'chat') {
      const conversationText = stringifyConversation(messages);
      const userPrompt = [
        '다음은 사용자와의 현재까지 대화입니다.',
        '이 대화를 바탕으로 사용자가 다음 액션을 진행할 수 있도록 구체적이고 실행 가능한 안내를 제공하세요.',
        '온보딩은 반드시 단계별로 하나씩 진행합니다. 한 번에 하나의 질문만 던지고, 사용자의 응답을 반영하여 다음 질문을 제시하세요.',
        '각 항목은 반드시 사용자의 확인/동의를 받은 후 다음 단계로 넘어갑니다. 모호하면 명확화 질문을 우선하고, 2~3개의 구체적 예시/선택지를 제시하세요.',
        '진행 중간중간 현재까지의 합의 내용을 2~3문장으로 간단히 요약해 인식 차이를 방지하세요.',
        '사용자가 기획서를 만들어달라고 하면 기획서 내용을 바탕으로 요약해서 기획서 작성 가이드를 제시하세요.',
        '마크다운을 사용하지 말고 순수 텍스트로만 답변하세요.',
        '대화가 충분히 진행되어 사용자가 동의하면 반드시 다음 문장을 출력해 종료 사인을 제공합니다:',
        '"이 내용을 바탕으로 노드 생성을 원하시면 하단의 대화 종료 & 초안 만들기 버튼 클릭해 주세요."',
        '---',
        conversationText,
      ].join('\n');

      const reply = await openai.chat(systemPrompt, userPrompt, { maxTokens: 1200, temperature: 0.3 });
      return NextResponse.json({ reply });
    }

    if (action === 'finalize') {
      const conversationText = stringifyConversation(messages);
      const userPrompt = [
        '아래 대화를 요약하여 워크플로우 기획서(summary)를 만들고,',
        '정확히 지정된 JSON 스키마에 따라 flow(nodes, edges)를 생성하세요.',
        '응답은 JSON만 출력하세요. 불필요한 텍스트, 마크다운 코드펜스는 금지합니다.',
        '',
        buildNodeFlowInstruction(),
        '---',
        conversationText,
      ].join('\n');

      const raw = await openai.chat(systemPrompt, userPrompt, { maxTokens: 2000, temperature: 0.2 });
      const cleaned = stripCodeFences(raw);
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        // 파싱 실패 시 summary만 문자열로 제공, 빈 플로우 반환
        return NextResponse.json({ summary: cleaned.slice(0, 1200), flow: { nodes: [], edges: [] } });
      }

      const summary: string = typeof parsed?.summary === 'string' ? parsed.summary : '';
      const flow = parsed?.flow && typeof parsed.flow === 'object' ? parsed.flow : { nodes: [], edges: [] };
      const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
      const edges = Array.isArray(flow?.edges) ? flow.edges : [];

      return NextResponse.json({ summary, flow: { nodes, edges } });
    }

    return NextResponse.json({ error: '알 수 없는 action 입니다.' }, { status: 400 });
  } catch (error) {
    console.error('Onboarding API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});


