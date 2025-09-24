"use client";

/**
 * CanvasOnboardingModal - 캔버스 최초 온보딩 모달(UI 전용)
 * 
 * 주요 역할:
 * 1. Intro 단계: 도움 받기/직접 할게요 선택
 * 2. Chat 단계: 메시지 입력/응답 표시, 종료 유도 시 "대화 종료 & 초안 만들기" 버튼 표시
 * 3. Summary 단계: 요약과 "초안 노드 생성" 버튼 표시
 * 
 * 핵심 특징:
 * - 프리젠테이션 전용: 상태/비즈니스 로직은 상위 훅에서 주입
 * - 최소한의 UI 구성으로 빠른 도입
 * 
 * 주의사항:
 * - onCreateDraft는 상위에서 setNodes/setEdges 및 저장 트리거
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/Ui/data-display';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Ui/buttons';

type Step = 'intro' | 'chat';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

interface CanvasOnboardingModalProps {
  isOpen: boolean;
  step: Step;
  onClose: () => void;
  onSkip: () => void;
  onStartChat: () => void;

  messages: ChatMessageProps[];
  inputText: string;
  onChangeInput: (v: string) => void;
  onSendMessage: () => void;
  isSending: boolean;
  isTyping?: boolean;
  assistantSuggestedFinalize: boolean;
  onFinalize: () => void;
  isFinalizing: boolean;
}

export default function CanvasOnboardingModal(props: CanvasOnboardingModalProps) {
  const {
    isOpen, step, onClose, onSkip, onStartChat,
    messages, inputText, onChangeInput, onSendMessage, isSending, isTyping,
    assistantSuggestedFinalize, onFinalize, isFinalizing
  } = props;

  const [isComposing, setIsComposing] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Intro는 내용에 맞춘 컴팩트 모달, 그 외 단계는 넓은 작업 영역
  const contentSizeClass = step === 'intro'
    ? 'max-w-lg w-auto'
    : 'max-w-[calc(100vw-160px)] w-[calc(100vw-160px)] max-h-[calc(100vh-160px)] h-[calc(100vh-160px)]';
  const contentClassName = `${contentSizeClass} px-5 py-5 flex flex-col`;
  
  // 메시지/타이핑 상태 변경 시 하단으로 자동 스크롤 (AI 챗봇 UX)
  useEffect(() => {
    if (step !== 'chat') return;
    const el = scrollRef.current;
    if (!el) return;
    try {
      el.scrollTop = el.scrollHeight;
    } catch {}
  }, [messages.length, isTyping, step]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>캔버스 시작하기</DialogTitle>
          <DialogDescription>
            처음이시라면 AI 가이드의 도움으로 초안 노드를 자동 생성할 수 있어요.
          </DialogDescription>
        </DialogHeader>

        {step === 'intro' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">AI 가이드를 통해 채널 기획서부터 워크플로우까지 함께 설계할 수 있습니다.</p>
            <div className="flex gap-2">
              <Button onClick={onStartChat}>AI 도움 받기</Button>
              <Button variant="outline" onClick={onSkip}>직접 할게요</Button>
            </div>
          </div>
        )}

        {step === 'chat' && (
          <div className="flex flex-col gap-3 h-full min-h-0 relative">
            <div className="flex-1 min-h-0 overflow-y-auto border rounded-md p-3 bg-white" id="onboarding-chat-scroll" ref={scrollRef}>
              {messages.map((m, idx) => (
                <div key={idx} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                  <div className={`inline-block max-w-[80%] px-3 py-2 rounded-lg my-1 ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="text-left">
                  <div className="inline-block px-3 py-2 rounded-lg text-sm my-1 bg-gray-100 text-gray-900">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <textarea
                value={inputText}
                onChange={(e) => onChangeInput(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    const native: any = e.nativeEvent as any;
                    if (native?.isComposing || native?.keyCode === 229 || isComposing) {
                      // 한글 IME 조합 중 Enter는 전송하지 않음
                      return;
                    }
                    e.preventDefault();
                    onSendMessage();
                  }
                }}
                rows={2}
                className="flex-1 border rounded-md px-3 py-2 text-sm min-h-[4.6rem]"
                placeholder="원하는 채널/목표/타깃/벤치마킹 등을 자유롭게 적어주세요"
              />
              <Button onClick={onSendMessage} disabled={isSending || !inputText.trim()}>전송</Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">대화가 충분히 정리되면 AI가 &quot;노드를 생성할까요?&quot;라고 물어봅니다.</div>
              <Button onClick={onFinalize} disabled={isFinalizing || !assistantSuggestedFinalize} variant={assistantSuggestedFinalize ? 'default' : 'outline'}>
                {isFinalizing ? '초안 생성 중...' : '대화 종료 & 초안 만들기'}
              </Button>
            </div>

            {isFinalizing && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-md">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                  노드 생성 중입니다...
                </div>
              </div>
            )}
          </div>
        )}

        {/* summary 단계 제거: finalize 시 즉시 적용 */}
      </DialogContent>
    </Dialog>
  );
}


