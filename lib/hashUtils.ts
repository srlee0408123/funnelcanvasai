/**
 * hashUtils.ts - 퍼널/지식 베이스 해시 및 정규화 유틸리티
 *
 * 주요 역할:
 * 1. flowJson 정규화 및 안정적 해시 생성
 * 2. 지식 베이스 요약 해시 생성
 * 3. 템플릿 파라미터 적용 유틸
 *
 * 핵심 특징:
 * - sha256 기반 32자 트렁크 해시
 * - 노드/엣지 정렬로 순서 변화에 강건
 * - 순수 함수로 어디서든 재사용 가능
 *
 * 주의사항:
 * - 입력 객체는 직렬화 가능한 구조여야 함
 */
import { createHash } from "crypto";

export function normalizeFlowJson(flowJson: any): any {
  const normalized = { ...flowJson };
  if (normalized.nodes) {
    normalized.nodes = [...normalized.nodes].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  if (normalized.edges) {
    normalized.edges = [...normalized.edges].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  return normalized;
}

export function generateFlowHash(flowJson: any): string {
  const normalized = normalizeFlowJson(flowJson);
  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex")
    .substring(0, 32);
}

export function generateKnowledgeHash(knowledgeBase: Array<{ title: string; content: string; source: string }>): string {
  const concatenated = knowledgeBase
    .map((kb) => `${kb.source}:${kb.title}:${kb.content.substring(0, 100)}`)
    .sort()
    .join("|");
  return createHash("sha256")
    .update(concatenated)
    .digest("hex")
    .substring(0, 32);
}

export function applyTemplateParameters(flowJson: any, parameters: Record<string, any>): any {
  let jsonString = JSON.stringify(flowJson);
  for (const [key, value] of Object.entries(parameters)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    jsonString = jsonString.replace(regex, String(value));
  }
  return JSON.parse(jsonString);
}


