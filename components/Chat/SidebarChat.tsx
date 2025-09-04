/**
 * SidebarChat - 오른쪽 사이드바에 고정되는 채팅 컴포넌트
 * 
 * 주요 역할:
 * 1. 캔버스 우측에 고정된 채팅 인터페이스 제공
 * 2. AI 어시스턴트와의 실시간 대화 기능
 * 3. 캔버스 컨텍스트를 활용한 맞춤형 답변
 * 
 * 핵심 특징:
 * - 고정된 사이드바 형태로 항상 접근 가능
 * - 캔버스 지식과 할일 정보를 컨텍스트로 활용
 * - 읽기 전용 모드에서는 채팅 입력 비활성화
 * 
 * 주의사항:
 * - 메시지는 데이터베이스에 영구 저장
 * - 실시간 메시지 동기화 지원
 * - 공유 캔버스에서는 입력 제한
 */

import { useState, useEffect, useRef } from "react";
import { Bot, Eye, Send, MessageCircle, Minimize2 } from "lucide-react";
import { Button } from "@/components/Ui/buttons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SidebarChatProps {
  canvasId: string;
  isReadOnly?: boolean;
  onToggle?: () => void;
  isCollapsed?: boolean;
}

export default function SidebarChat({ 
  canvasId, 
  isReadOnly = false, 
  onToggle,
  isCollapsed = false 
}: SidebarChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 캔버스 지식 정보 가져오기 - 읽기 전용일 때는 공개 API 사용
  const { data: canvasKnowledge } = useQuery({
    queryKey: isReadOnly 
      ? ['/api/public/canvas', canvasId, 'knowledge']
      : ['/api/canvases', canvasId, 'knowledge'],
    enabled: true
  });

  // 캔버스 할일 정보 가져오기 - 읽기 전용일 때는 공개 API 사용
  const { data: canvasTodos } = useQuery({
    queryKey: isReadOnly
      ? ['/api/public/canvas', canvasId, 'todos']
      : ['/api/canvases', canvasId, 'todos'],
    enabled: true
  });

  // 채팅 기록 불러오기 - 읽기 전용일 때는 공개 API 사용
  const { data: chatHistory } = useQuery({
    queryKey: isReadOnly
      ? ['/api/public/canvas', canvasId, 'chat-messages']
      : ['/api/canvases', canvasId, 'chat-messages'],
    enabled: true
  });

  // 메시지 하단으로 자동 스크롤
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 채팅 기록이 로드되면 로컬 메시지 업데이트
  useEffect(() => {
    if (chatHistory && Array.isArray(chatHistory)) {
      const formattedMessages = chatHistory.map((msg: any) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.createdAt)
      }));
      
      // 채팅 기록이 없으면 환영 메시지 추가
      if (formattedMessages.length === 0) {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: '안녕하세요! 저는 두더지 AI입니다. 퍼널 설계와 마케팅에 대해 궁금한 점이 있으시면 언제든 물어보세요. 업로드하신 자료와 글로벌 지식을 바탕으로 도움드리겠습니다.',
          timestamp: new Date()
        }]);
      } else {
        setMessages(formattedMessages);
      }
    }
  }, [chatHistory]);

  // 메시지나 타이핑 상태 변경 시 하단으로 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // 채팅 메시지 전송 뮤테이션
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/chat/canvas', {
        message,
        canvasId
      });
      return response.json();
    },
    onSuccess: (response: any) => {
      // 메시지가 데이터베이스에 저장되므로 쿼리를 새로고침하여 최신 메시지 가져오기
      setIsTyping(false);
      
      // 채팅 메시지 데이터베이스에서 새로고침
      queryClient.invalidateQueries({ 
        queryKey: ['/api/canvases', canvasId, 'chat-messages'] 
      });
    },
    onError: () => {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해 주세요.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsTyping(false);
    }
  });

  const handleSendMessage = () => {
    if (!currentMessage.trim() || chatMutation.isPending) return;

    // 사용자 메시지 추가
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsTyping(true);
    
    // AI에게 전송
    chatMutation.mutate(currentMessage.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 최소화된 상태일 때 보여줄 컴포넌트
  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border-l border-gray-200 flex flex-col items-center py-4">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="채팅 열기"
        >
          <MessageCircle className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* 헤더 */}
      <div className="bg-blue-600 text-primary-foreground p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bot className="h-5 w-5" />
          <div>
            <h3 className="font-medium">두더지 AI</h3>
            <p className="text-xs text-blue-100">퍼널 전문 어시스턴트</p>
          </div>
        </div>
        {onToggle && (
          <button
            onClick={onToggle}
            className="text-primary-foreground hover:text-gray-200 transition-colors"
            title="채팅 최소화"
          >
            <Minimize2 size={18} />
          </button>
        )}
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-primary-foreground'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-1 ${
                message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
              }`}>
                {message.timestamp.toLocaleTimeString('ko-KR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        {/* 스크롤을 위한 보이지 않는 div */}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="p-4 border-t border-gray-200">
        {isReadOnly ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-sm text-blue-700 mb-2 flex items-center justify-center">
              <Eye className="h-4 w-4 mr-2" />
              읽기 전용 모드
            </p>
            <p className="text-xs text-blue-600">
              이 캔버스는 공유된 상태로 채팅 기능을 사용할 수 없습니다.
            </p>
          </div>
        ) : (
          <div className="flex space-x-2">
            <textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="퍼널이나 마케팅에 대해 질문해보세요..."
              className="flex-1 resize-none px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows={2}
              disabled={chatMutation.isPending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!currentMessage.trim() || chatMutation.isPending}
              size="sm"
              className="px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {/* 컨텍스트 정보 */}
        <div className="text-xs text-gray-500 mt-2 space-y-1">
          {Array.isArray(canvasKnowledge) && canvasKnowledge.length > 0 && (
            <p>업로드된 자료 {canvasKnowledge.length}개</p>
          )}
          {Array.isArray(canvasTodos) && canvasTodos.length > 0 && (
            <p>할일 체크리스트 {canvasTodos.length}개 (완료: {canvasTodos.filter((todo: any) => todo.completed).length}개)</p>
          )}
          {(Array.isArray(canvasKnowledge) && canvasKnowledge.length > 0) || 
           (Array.isArray(canvasTodos) && canvasTodos.length > 0) ? (
            <p>위 정보들을 참고하여 맞춤형 답변을 드립니다.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
