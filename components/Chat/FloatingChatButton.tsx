import { useState, useEffect, useRef } from "react";
import { X, MessageCircle, Bot, Eye, Send } from "lucide-react";
import { Button } from "@/components/Ui/buttons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface FloatingChatButtonProps {
  canvasId: string;
  isReadOnly?: boolean;
}

export default function FloatingChatButton({ canvasId, isReadOnly = false }: FloatingChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get canvas knowledge for context - use public API if read-only
  const { data: canvasKnowledge } = useQuery({
    queryKey: isReadOnly 
      ? ['/api/public/canvas', canvasId, 'knowledge']
      : ['/api/canvases', canvasId, 'knowledge'],
    enabled: isOpen
  });

  // Get canvas todos for context - use public API if read-only
  const { data: canvasTodos } = useQuery({
    queryKey: isReadOnly
      ? ['/api/public/canvas', canvasId, 'todos']
      : ['/api/canvases', canvasId, 'todos'],
    enabled: isOpen
  });

  // Load chat messages from database - use public API if read-only
  const { data: chatHistory } = useQuery({
    queryKey: isReadOnly
      ? ['/api/public/canvas', canvasId, 'chat-messages']
      : ['/api/canvases', canvasId, 'chat-messages'],
    enabled: isOpen
  });

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Update local messages when chat history is loaded
  useEffect(() => {
    if (chatHistory && Array.isArray(chatHistory)) {
      const formattedMessages = chatHistory.map((msg: any) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.createdAt)
      }));
      
      // Add welcome message if no chat history exists
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

  // Scroll to bottom when messages change or typing status changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/chat/canvas', {
        message,
        canvasId
      });
      return response.json();
    },
    onSuccess: (response: any) => {
      // Messages are now persisted in database, so we need to refresh the query
      // to get the latest messages from the server
      setIsTyping(false);
      
      // Refresh chat messages from database
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

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsTyping(true);
    
    // Send to AI
    chatMutation.mutate(currentMessage.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-primary-foreground rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 z-50"
        title="AI 어시스턴트와 채팅"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="bg-blue-600 text-primary-foreground p-4 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bot className="h-5 w-5" />
          <div>
            <h3 className="font-medium">두더지 AI</h3>
            <p className="text-xs text-blue-100">퍼널 전문 어시스턴트</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-primary-foreground hover:text-gray-200 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
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
        
        {/* Invisible div for scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
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