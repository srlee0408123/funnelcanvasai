/**
 * useCanvasOnboarding - 캔버스 최초 온보딩(초기 AI 가이드) 상태 관리 훅
 * 
 * 주요 역할:
 * 1. 온보딩 모달 열림/단계(intro/chat) 상태 관리
 * 2. AI 대화(chat) 진행 및 종료(finalize) 시 즉시 노드/엣지 적용
 * 3. 적용 즉시 모달 닫기 및 저장 훅이 자동 감지
 * 
 * 핵심 특징:
 * - LocalStorage 플래그로 최초 1회 모달 자동 표시 제어(onboarding-shown-<canvasId>)
 * - 서비스 계층(canvasOnboardingService)로 API 호출 분리
 * - 간단한 규칙으로 종료 질문("노드를 생성할까요?") 감지
 * 
 * 주의사항:
 * - 저장은 CanvasArea의 useCanvasSync가 감지하여 처리(본 훅은 setNodes/setEdges만 수행)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { canvasOnboardingService, type OnboardingChatMessage } from '@/services/canvasOnboardingService';
import { useCanvasStore } from '@/hooks/useCanvasStore';
import type { FlowNode, FlowEdge } from '@/types/canvas';

type Step = 'intro' | 'chat';

interface UseCanvasOnboardingOptions {
  autoOpenIfFirstTime?: boolean;
  canEdit?: boolean;
  hasInitialState?: boolean;
}

export function useCanvasOnboarding(canvasId: string, options: UseCanvasOnboardingOptions = {}) {
  const { autoOpenIfFirstTime = true, canEdit = true, hasInitialState = false } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('intro');
  const [messages, setMessages] = useState<OnboardingChatMessage[]>([
    { 
      role: 'assistant', 
      content: [
        '안녕하세요! 저는 크리에이터를 위한 비즈니스 아키텍트 AI입니다.',
        '유튜브와 콘텐츠 비즈니스가 완전히 처음이어도 괜찮습니다. 저는 여러분이 체계적이고 확실한 로드맵을 따라 강력한 브랜드를 구축할 수 있도록 도와드리는 전문가이자 코치 역할을 합니다.',
        '유튜브 채널의 기획 단계인지 아니면 운영 단계인지 편하게 말씀해 주세요.',
      ].join('\n')
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [assistantSuggestedFinalize, setAssistantSuggestedFinalize] = useState(false);
  // 요약/초안 중간 단계 제거: 바로 적용

  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  const storageKey = useMemo(() => `onboarding-shown-${canvasId}`, [canvasId]);

  // 최초 1회 자동 오픈(새 캔버스이고, 편집 가능, 로컬 플래그 없음)
  useEffect(() => {
    if (!autoOpenIfFirstTime) return;
    if (!canEdit) return;
    if (!canvasId) return;

    try {
      const shown = localStorage.getItem(storageKey);
      if (shown !== 'true' && !hasInitialState) {
        setIsOpen(true);
        setStep('intro');
      }
    } catch {}
  }, [autoOpenIfFirstTime, canEdit, canvasId, hasInitialState, storageKey]);

  const markShown = useCallback(() => {
    try { localStorage.setItem(storageKey, 'true'); } catch {}
  }, [storageKey]);

  const open = useCallback(() => { setIsOpen(true); }, []);
  const close = useCallback(() => { setIsOpen(false); }, []);

  const startChat = useCallback(() => {
    setStep('chat');
  }, []);

  const skipOnboarding = useCallback(() => {
    markShown();
    setIsOpen(false);
  }, [markShown]);

  const detectFinalizeSuggestion = useCallback((assistantReply: string) => {
    const text = (assistantReply || '').toLowerCase();
    return text.includes('노드를 생성할까요') || text.includes('노드 생성할까요') || text.includes('초안') || text.includes('생성해 드릴까요');
  }, []);

  const sendMessage = useCallback(async () => {
    const content = inputText.trim();
    if (!content || isSending) return;
    setIsSending(true);
    setIsTyping(true);
    const userMsg: OnboardingChatMessage = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    try {
      const reply = await canvasOnboardingService.chat(canvasId, [...messages, userMsg]);
      const assistantMsg: OnboardingChatMessage = { role: 'assistant', content: reply || '추가로 도와드릴 내용이 있을까요?' };
      setMessages((prev) => [...prev, assistantMsg]);
      // 스크롤 하단 이동
      try {
        const el = document.getElementById('onboarding-chat-scroll');
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      } catch {}
      if (detectFinalizeSuggestion(assistantMsg.content)) {
        setAssistantSuggestedFinalize(true);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '죄송합니다. 잠시 후 다시 시도해 주세요.' }]);
    } finally {
      setIsSending(false);
      setIsTyping(false);
    }
  }, [canvasId, inputText, isSending, messages, detectFinalizeSuggestion]);

  const finalize = useCallback(async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    try {
      const result = await canvasOnboardingService.finalize(canvasId, messages);
      const nodes = result.flow.nodes || [];
      const edges = result.flow.edges || [];
      setNodes(nodes);
      setEdges(edges);
      markShown();
      setIsOpen(false);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '초안 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' }]);
    } finally {
      setIsFinalizing(false);
    }
  }, [isFinalizing, canvasId, messages, setNodes, setEdges, markShown]);

  // 중간 적용 단계 제거로 불필요

  return {
    // modal
    isOpen,
    step,
    open,
    close,
    startChat,
    skipOnboarding,

    // chat
    messages,
    inputText,
    setInputText,
    isSending,
    isTyping,
    assistantSuggestedFinalize,
    sendMessage,

    // finalize
    isFinalizing,
    finalize,
    // 즉시 적용 구조로 요약/초안 상태는 제공하지 않음
  } as const;
}


