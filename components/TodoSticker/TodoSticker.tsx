import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Check, Trash2, ChevronDown, ChevronUp, Circle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/Ui/buttons';
import { Input } from '@/components/Ui/form-controls';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { createClient } from '@/lib/supabase/client';

interface TodoItem {
  id: string;
  canvas_id: string;
  text: string;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

interface TodoStickerProps {
  canvasId: string;
  onHide?: () => void;
  isReadOnly?: boolean;
  initialTodos?: TodoItem[];
}

export default function TodoSticker({ canvasId, onHide, isReadOnly = false, initialTodos }: TodoStickerProps) {
  const [newTodoText, setNewTodoText] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  
  // 컴포넌트 마운트 로그
  useEffect(() => {
    console.log('📝 Todo 스티커 마운트 - Canvas:', canvasId, 'ReadOnly:', isReadOnly, 'Visible:', isVisible);
    return () => {
      console.log('📝 Todo 스티커 언마운트 - Canvas:', canvasId);
    };
  }, [canvasId, isReadOnly]);
  const [showCompleted, setShowCompleted] = useState(false);
  
  // Editing state
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 16, y: 16 }); // top-4 right-4 in pixels
  
  // Resizing state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeOffset, setResizeOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 300, height: 400 });

  // Realtime state
  const [optimisticTodos, setOptimisticTodos] = useState<TodoItem[]>([]);
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());
  const realtimeChannelRef = useRef<any>(null);
  const supabaseClient = useRef(createClient());

  const queryClient = useQueryClient();

  // Fetch todos from API (스티커가 보일 때만 활성화, read-only 모드에서 initialTodos 제공 시 비활성화)
  const { data: todos = [], isLoading } = useQuery<TodoItem[]>({
    queryKey: [`/api/canvases/${canvasId}/todos`],
    queryFn: () => apiRequest('GET', `/api/canvases/${canvasId}/todos`).then(res => res.json()),
    enabled: !!canvasId && !isReadOnly && isVisible
  });

  // 낙관적 업데이트와 실시간 데이터 병합
  const mergedTodos = useCallback(() => {
    const baseTodos = isReadOnly && initialTodos ? initialTodos : todos;
    
    // 낙관적 업데이트 적용
    let result = [...baseTodos];
    
    // 낙관적으로 추가된 항목들 병합
    optimisticTodos.forEach(optimisticTodo => {
      const existingIndex = result.findIndex(t => t.id === optimisticTodo.id);
      if (existingIndex >= 0) {
        // 기존 항목 업데이트 (타임스탬프 비교로 최신 우선)
        const existing = result[existingIndex];
        if (new Date(optimisticTodo.updated_at) > new Date(existing.updated_at)) {
          result[existingIndex] = optimisticTodo;
        }
      } else {
        // 새 항목 추가
        result.push(optimisticTodo);
      }
    });
    
    // 삭제 대기 중인 항목들 제외
    result = result.filter(todo => !pendingOperations.has(`delete-${todo.id}`));
    
    return result.sort((a, b) => a.position - b.position);
  }, [todos, optimisticTodos, pendingOperations, isReadOnly, initialTodos]);

  const activeTodos = mergedTodos();

  // 기존 할일들에 대해 노드가 없으면 생성 (스티커가 보일 때만 실행)
  useEffect(() => {
    if (!isReadOnly && isVisible && activeTodos.length > 0) {
      const syncTodoNodes = async () => {
        try {
          // 모든 노드를 한 번만 가져오기
          const response = await apiRequest('GET', `/api/canvases/${canvasId}/nodes`);
          const { nodes } = await response.json();
          
          // 기존 todo 노드들 찾기
          const existingTodoNodes = nodes.filter((node: any) => 
            node.node_id.startsWith('todo-')
          );
          
          // 각 할일에 대해 노드가 없으면 생성
          console.log('🔄 Syncing todos with canvas nodes:', {
            totalTodos: activeTodos.length,
            existingTodoNodes: existingTodoNodes.length
          });
          
          for (const todo of activeTodos) {
            const existingNode = existingTodoNodes.find((node: any) => 
              node.node_id === `todo-${todo.id}`
            );
            
            if (!existingNode) {
              console.log('🆕 Creating missing todo node:', `todo-${todo.id}`);
              await createTodoNode(todo);
            } else {
              console.log('✅ Todo node already exists:', `todo-${todo.id}`);
            }
          }
        } catch (error) {
          console.error('Failed to sync todo nodes:', error);
        }
      };

      syncTodoNodes();
    }
      }, [activeTodos.length, canvasId, isReadOnly, isVisible]);

  // Supabase Realtime 구독 설정 - 스티커가 보일 때만 활성화
  useEffect(() => {
    if (isReadOnly || !canvasId || !isVisible) return;

    const supabase = supabaseClient.current;
    
    // 실시간 채널 생성
    const channel = supabase
      .channel(`canvas-todos-${canvasId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'canvas_todos',
          filter: `canvas_id=eq.${canvasId}`,
        },
        (payload) => {
          console.log('🔄 Realtime todo event:', payload);
          handleRealtimeEvent(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status, '- Sticker visible:', isVisible);
      });

    realtimeChannelRef.current = channel;
    console.log('🔌 Todo Realtime 구독 시작 - Canvas:', canvasId, 'Visible:', isVisible);

    return () => {
      if (realtimeChannelRef.current) {
        console.log('🔌 Todo Realtime 구독 종료 - Canvas:', canvasId, 'Visible:', isVisible);
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [canvasId, isReadOnly, isVisible]);

  // 실시간 이벤트 처리
  const handleRealtimeEvent = useCallback((payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
      case 'INSERT':
        // 새 할일 추가 - 낙관적 업데이트가 아닌 경우만 추가
        if (!pendingOperations.has(`create-${newRecord.id}`)) {
          setOptimisticTodos(prev => {
            const exists = prev.some(t => t.id === newRecord.id);
            if (!exists) {
              return [...prev, newRecord];
            }
            return prev;
          });
        } else {
          // 낙관적 업데이트 완료 - pending 제거
          setPendingOperations(prev => {
            const newSet = new Set(prev);
            newSet.delete(`create-${newRecord.id}`);
            return newSet;
          });
        }
        break;
        
      case 'UPDATE':
        // 할일 업데이트
        if (!pendingOperations.has(`update-${newRecord.id}`)) {
          setOptimisticTodos(prev => {
            const index = prev.findIndex(t => t.id === newRecord.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = newRecord;
              return updated;
            }
            return [...prev, newRecord];
          });
        } else {
          // 낙관적 업데이트 완료
          setPendingOperations(prev => {
            const newSet = new Set(prev);
            newSet.delete(`update-${newRecord.id}`);
            return newSet;
          });
        }
        break;
        
      case 'DELETE':
        // 할일 삭제
        if (!pendingOperations.has(`delete-${oldRecord.id}`)) {
          setOptimisticTodos(prev => prev.filter(t => t.id !== oldRecord.id));
        } else {
          // 낙관적 삭제 완료
          setPendingOperations(prev => {
            const newSet = new Set(prev);
            newSet.delete(`delete-${oldRecord.id}`);
            return newSet;
          });
        }
        break;
    }
    
    // 캐시 무효화 (부분적으로만)
    queryClient.invalidateQueries({ 
      queryKey: [`/api/canvases/${canvasId}/todos`],
      exact: false 
    });
  }, [canvasId, pendingOperations, queryClient]);

  // Create todo mutation with optimistic updates
  const createTodoMutation = useMutation({
    mutationFn: (text: string) => 
      apiRequest('POST', `/api/canvases/${canvasId}/todos`, { text }),
    onMutate: async (text: string) => {
      // 낙관적 업데이트: 즉시 UI에 반영
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const optimisticTodo: TodoItem = {
        id: tempId,
        canvas_id: canvasId,
        text: text.trim(),
        completed: false,
        position: activeTodos.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // 낙관적 상태에 추가
      setOptimisticTodos(prev => [...prev, optimisticTodo]);
      setPendingOperations(prev => new Set([...prev, `create-${tempId}`]));
      
      // 즉시 UI 초기화
      setNewTodoText('');
      
      return { tempId, optimisticTodo };
    },
    onSuccess: async (response, text, context) => {
      const newTodo = await response.json();
      
      // 임시 ID를 실제 ID로 교체
      setOptimisticTodos(prev => 
        prev.map(todo => 
          todo.id === context?.tempId ? newTodo : todo
        )
      );
      
      // pending 상태 업데이트
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(`create-${context?.tempId}`);
        newSet.add(`create-${newTodo.id}`);
        return newSet;
      });
      
      // 할일을 캔버스에 노드로 추가
      await createTodoNode(newTodo);
    },
    onError: (error, text, context) => {
      // 실패 시 낙관적 업데이트 롤백
      setOptimisticTodos(prev => 
        prev.filter(todo => todo.id !== context?.tempId)
      );
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(`create-${context?.tempId}`);
        return newSet;
      });
      
      // 입력 텍스트 복원
      setNewTodoText(text);
      console.error('Failed to create todo:', error);
    }
  });

  // Update todo mutation with optimistic updates
  const updateTodoMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<TodoItem> }) =>
      apiRequest('PATCH', `/api/canvases/${canvasId}/todos/${id}`, updates),
    onMutate: async ({ id, updates }) => {
      // 기존 상태 백업
      const previousTodos = [...optimisticTodos];
      const existingTodo = activeTodos.find(t => t.id === id);
      
      if (existingTodo) {
        // 낙관적 업데이트 적용
        const optimisticUpdate = {
          ...existingTodo,
          ...updates,
          updated_at: new Date().toISOString(),
        };
        
        setOptimisticTodos(prev => {
          const index = prev.findIndex(t => t.id === id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = optimisticUpdate;
            return updated;
          }
          return [...prev, optimisticUpdate];
        });
        
        setPendingOperations(prev => new Set([...prev, `update-${id}`]));
      }
      
      return { previousTodos, existingTodo };
    },
    onSuccess: async (response, { id, updates }, context) => {
      const updatedTodo = await response.json();
      
      // 실제 서버 응답으로 업데이트
      setOptimisticTodos(prev => {
        const index = prev.findIndex(t => t.id === id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = updatedTodo;
          return updated;
        }
        return prev;
      });
      
      // 할일 상태나 텍스트가 변경되면 캔버스 노드도 업데이트
      if (updates.completed !== undefined || updates.text !== undefined) {
        await updateTodoNode(updatedTodo);
      }
    },
    onError: (error, { id }, context) => {
      // 실패 시 이전 상태로 롤백
      if (context?.previousTodos) {
        setOptimisticTodos(context.previousTodos);
      }
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(`update-${id}`);
        return newSet;
      });
      console.error('Failed to update todo:', error);
    }
  });

  // Delete todo mutation with optimistic updates
  const deleteTodoMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('DELETE', `/api/canvases/${canvasId}/todos/${id}`),
    onMutate: async (id: string) => {
      // 기존 상태 백업
      const previousTodos = [...optimisticTodos];
      const todoToDelete = activeTodos.find(t => t.id === id);
      
      // 낙관적 삭제: 즉시 UI에서 제거
      setPendingOperations(prev => new Set([...prev, `delete-${id}`]));
      
      return { previousTodos, todoToDelete };
    },
    onSuccess: async (response, id, context) => {
      // 할일 삭제 시 캔버스 노드도 삭제
      await deleteTodoNode(id);
      
      // 낙관적 상태에서도 제거
      setOptimisticTodos(prev => prev.filter(t => t.id !== id));
    },
    onError: (error, id, context) => {
      // 실패 시 이전 상태로 롤백
      if (context?.previousTodos) {
        setOptimisticTodos(context.previousTodos);
      }
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(`delete-${id}`);
        return newSet;
      });
      console.error('Failed to delete todo:', error);
    }
  });

  // Load position and size from localStorage on mount
  useEffect(() => {
    const savedPosition = localStorage.getItem(`todo-position-${canvasId}`);
    if (savedPosition) {
      try {
        setPosition(JSON.parse(savedPosition));
      } catch (error) {
        console.error('Failed to load position:', error);
      }
    }
    
    const savedSize = localStorage.getItem(`todo-size-${canvasId}`);
    if (savedSize) {
      try {
        setSize(JSON.parse(savedSize));
      } catch (error) {
        console.error('Failed to load size:', error);
      }
    }
  }, [canvasId]);

  // Save position and size to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`todo-position-${canvasId}`, JSON.stringify(position));
  }, [position, canvasId]);
  
  useEffect(() => {
    localStorage.setItem(`todo-size-${canvasId}`, JSON.stringify(size));
  }, [size, canvasId]);

  // 할일을 캔버스 노드로 생성하는 함수 (중복 체크 포함)
  const createTodoNode = async (todo: TodoItem) => {
    try {
      const nodeId = `todo-${todo.id}`;
      
      // 먼저 기존 노드가 있는지 확인
      try {
        const response = await apiRequest('GET', `/api/canvases/${canvasId}/nodes`);
        const { nodes } = await response.json();
        const existingNode = nodes.find((node: any) => node.node_id === nodeId);
        
        if (existingNode) {
          console.log('🔄 Todo node already exists, skipping creation:', nodeId);
          return; // 이미 존재하면 생성하지 않음
        }
      } catch (checkError) {
        console.warn('⚠️ Failed to check existing nodes, proceeding with creation:', checkError);
      }

      // 캔버스 중앙 근처에 랜덤한 위치 생성
      const randomX = Math.random() * 400 + 200; // 200-600px 범위
      const randomY = Math.random() * 300 + 150; // 150-450px 범위

      const nodeData = {
        node_id: nodeId,
        type: 'todo',
        position: { x: randomX, y: randomY },
        data: {
          title: todo.text,
          subtitle: todo.completed ? '완료됨' : '진행중',
          icon: todo.completed ? '✅' : '⭕',
          color: todo.completed ? '#22c55e' : '#eab308',
          todoId: todo.id,
          completed: todo.completed,
        },
        metadata: {
          type: 'todo',
          todoId: todo.id,
          createdAt: todo.created_at,
        }
      };

      await apiRequest('POST', `/api/canvases/${canvasId}/nodes`, nodeData);
      console.log('✅ Todo node created successfully:', nodeData);
    } catch (error) {
      // 중복 키 에러인 경우 무시 (이미 존재하는 노드)
      if (error instanceof Error && (error.message.includes('duplicate key') || error.message.includes('23505'))) {
        console.log('🔄 Todo node already exists (duplicate key), ignoring:', `todo-${todo.id}`);
        return;
      }
      console.error('❌ Failed to create todo node:', error);
    }
  };

  // 할일 노드 업데이트 함수 (기존 위치를 유지하면서 데이터만 업데이트)
  const updateTodoNode = async (todo: TodoItem) => {
    try {
      // 기본 위치 (새 노드인 경우 사용)
      const defaultPosition = { 
        x: Math.random() * 400 + 200, 
        y: Math.random() * 300 + 150 
      };

      const nodeData = {
        node_id: `todo-${todo.id}`,
        type: 'todo',
        position: defaultPosition, // upsert에서 기존 위치가 있으면 유지됨
        data: {
          title: todo.text,
          subtitle: todo.completed ? '완료됨' : '진행중',
          icon: todo.completed ? '✅' : '⭕',
          color: todo.completed ? '#22c55e' : '#eab308',
          todoId: todo.id,
          completed: todo.completed,
        },
        metadata: {
          type: 'todo',
          todoId: todo.id,
          updatedAt: todo.updated_at,
        }
      };

      await apiRequest('POST', `/api/canvases/${canvasId}/nodes`, nodeData);
      console.log('Todo node updated successfully:', nodeData);
    } catch (error) {
      console.error('Failed to update todo node:', error);
      // 에러가 발생해도 할일 업데이트는 계속 진행되도록 함
    }
  };

  // 할일 노드 삭제 함수
  const deleteTodoNode = async (todoId: string) => {
    try {
      await apiRequest('DELETE', `/api/canvases/${canvasId}/nodes?nodeId=todo-${todoId}`);
      console.log('Todo node deleted successfully:', todoId);
    } catch (error) {
      console.error('Failed to delete todo node:', error);
    }
  };

  const addTodo = () => {
    if (!newTodoText.trim()) return;
    createTodoMutation.mutate(newTodoText.trim());
  };

  const toggleTodo = (id: string) => {
    const todo = activeTodos.find(t => t.id === id);
    if (todo) {
      updateTodoMutation.mutate({
        id,
        updates: { completed: !todo.completed }
      });
    }
  };

  const deleteTodo = (id: string) => {
    deleteTodoMutation.mutate(id);
  };

  const startEditing = (todo: TodoItem) => {
    if (isReadOnly) return;
    setEditingTodoId(todo.id);
    setEditingText(todo.text);
  };

  const cancelEditing = () => {
    setEditingTodoId(null);
    setEditingText('');
  };

  const saveEditing = () => {
    if (!editingText.trim() || !editingTodoId) return;
    
    updateTodoMutation.mutate({
      id: editingTodoId,
      updates: { text: editingText.trim() }
    });
    
    setEditingTodoId(null);
    setEditingText('');
  };

  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEditing();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  // Separate completed and incomplete todos
  const incompleteTodos = activeTodos.filter(todo => !todo.completed);
  const completedTodos = activeTodos.filter(todo => todo.completed);
  const completedCount = completedTodos.length;
  const totalCount = activeTodos.length;

  // Drag handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isReadOnly) return;
    
    // Only start dragging if clicking on the header area, not on buttons or inputs
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) {
      console.log('Drag blocked - clicked on button or input');
      return;
    }

    console.log('Starting drag - position:', position, 'mouse:', { x: e.clientX, y: e.clientY });
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - 200;
      
      const finalPosition = {
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      };
      
      console.log('Dragging to:', finalPosition);
      setPosition(finalPosition);
    } else if (isResizing) {
      const newWidth = Math.max(200, e.clientX - position.x + resizeOffset.x);
      const newHeight = Math.max(150, e.clientY - position.y + resizeOffset.y);
      setSize({
        width: newWidth,
        height: newHeight
      });
    }
  };

  const handleMouseUp = () => {
    console.log('Mouse up - ending drag/resize');
    setIsDragging(false);
    setIsResizing(false);
  };

  // Resize handler
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeOffset({
      x: size.width - e.clientX + position.x,
      y: size.height - e.clientY + position.y
    });
  };

  // Global mouse event listeners for dragging and resizing
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      
      if (isDragging) {
        document.body.style.cursor = 'grabbing';
      } else if (isResizing) {
        document.body.style.cursor = 'nw-resize';
      }
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, isResizing, dragOffset, resizeOffset, position, size]);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed z-50 bg-yellow-50 dark:bg-yellow-900 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg shadow-lg transition-shadow ${
        isDragging ? 'shadow-2xl scale-105' : isResizing ? 'shadow-xl' : 'shadow-lg'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        cursor: isReadOnly ? 'default' : (isDragging ? 'grabbing' : 'grab')
      }}
    >
      {/* Header - Draggable area */}
      <div 
        className={`flex items-center justify-between p-3 border-b border-yellow-300 dark:border-yellow-700 select-none ${
          isReadOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
          <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
            할일 체크리스트
          </h3>
          {totalCount > 0 && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
          {!isReadOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
              onClick={(e) => {
                e.stopPropagation();
                console.log('🙈 Todo 스티커 숨기기 - Canvas:', canvasId);
                setIsVisible(false);
                onHide?.();
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-3">
          {/* Add todo input - Only show in edit mode */}
          {!isReadOnly && (
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="새 할일 추가..."
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                className="text-sm bg-white dark:bg-white text-black dark:text-black border-yellow-300 dark:border-yellow-700 focus:border-yellow-500 dark:focus:border-yellow-500"
                disabled={createTodoMutation.isPending}
              />
              <Button
                onClick={addTodo}
                size="sm"
                className="bg-yellow-500 hover:bg-yellow-600 text-yellow-900 dark:text-yellow-100"
                disabled={createTodoMutation.isPending}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Todo list */}
          <div className="space-y-3 overflow-y-auto" style={{ maxHeight: `${size.height - 150}px` }}>
            {isLoading ? (
              <p className="text-yellow-600 dark:text-yellow-400 text-sm text-center py-4">
                불러오는 중...
              </p>
            ) : totalCount === 0 ? (
              <p className="text-yellow-600 dark:text-yellow-400 text-sm text-center py-4">
                아직 할일이 없습니다
              </p>
            ) : (
              <>
                {/* 미완료 할일 섹션 */}
                {incompleteTodos.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 border-b border-yellow-300/50 dark:border-yellow-600/50 pb-1">
                      진행중 ({incompleteTodos.length})
                    </h4>
                    {incompleteTodos.map((todo) => {
                      const isPending = pendingOperations.has(`update-${todo.id}`) || 
                                       pendingOperations.has(`delete-${todo.id}`) ||
                                       todo.id.startsWith('temp-');
                      
                      return (
                      <div
                        key={todo.id}
                        className={`flex items-center gap-2 p-2 rounded border bg-white dark:bg-gray-100 border-yellow-300 dark:border-yellow-700 transition-all ${
                          isPending ? 'opacity-60 pointer-events-none' : ''
                        }`}
                      >
                        <button
                          onClick={!isReadOnly ? () => toggleTodo(todo.id) : undefined}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors border-yellow-400 dark:border-yellow-600 hover:border-yellow-500 ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                          disabled={updateTodoMutation.isPending || isReadOnly}
                        >
                          {todo.completed && <Check className="w-3 h-3" />}
                        </button>
                        {editingTodoId === todo.id ? (
                          <Input
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={handleEditKeyPress}
                            onBlur={saveEditing}
                            autoFocus
                            className="flex-1 text-sm h-auto py-1 px-2 bg-white dark:bg-white text-black dark:text-black border-yellow-400 dark:border-yellow-600 focus:border-yellow-500"
                          />
                        ) : (
                          <div className="flex items-center gap-2 flex-1">
                            <Circle className="w-3 h-3 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                            <span 
                              className="text-sm text-yellow-800 dark:text-yellow-200 cursor-pointer hover:bg-yellow-200/30 dark:hover:bg-yellow-800/30 px-1 py-0.5 rounded transition-colors"
                              onDoubleClick={() => startEditing(todo)}
                              title="더블클릭하여 수정"
                            >
                              {todo.text}
                            </span>
                          </div>
                        )}
                        {!isReadOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-yellow-600 hover:text-red-600 dark:text-yellow-400 dark:hover:text-red-400"
                            onClick={() => deleteTodo(todo.id)}
                            disabled={deleteTodoMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}

                {/* 완료된 할일 섹션 */}
                {completedTodos.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-yellow-700 dark:text-yellow-400 border-b border-yellow-300/50 dark:border-yellow-600/50 pb-1 flex-1">
                        완료됨 ({completedTodos.length})
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200 ml-2"
                        onClick={() => setShowCompleted(!showCompleted)}
                      >
                        {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                    
                    {showCompleted && (
                      <div className="space-y-2">
                        {completedTodos.map((todo) => {
                          const isPending = pendingOperations.has(`update-${todo.id}`) || 
                                           pendingOperations.has(`delete-${todo.id}`) ||
                                           todo.id.startsWith('temp-');
                          
                          return (
                          <div
                            key={todo.id}
                            className={`flex items-center gap-2 p-2 rounded border bg-yellow-100 dark:bg-yellow-200 border-yellow-400 dark:border-yellow-600 transition-all opacity-90 ${
                              isPending ? 'opacity-40 pointer-events-none' : ''
                            }`}
                          >
                            <button
                              onClick={!isReadOnly ? () => toggleTodo(todo.id) : undefined}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors bg-yellow-500 border-yellow-500 text-primary-foreground ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                              disabled={updateTodoMutation.isPending || isReadOnly}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            {editingTodoId === todo.id ? (
                              <Input
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onKeyDown={handleEditKeyPress}
                                onBlur={saveEditing}
                                autoFocus
                                className="flex-1 text-sm h-auto py-1 px-2 bg-white dark:bg-white text-black dark:text-black border-yellow-400 dark:border-yellow-600 focus:border-yellow-500"
                              />
                            ) : (
                              <div className="flex items-center gap-2 flex-1">
                                <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                                <span 
                                  className="text-sm line-through text-yellow-600 dark:text-yellow-400 cursor-pointer hover:bg-yellow-200/30 dark:hover:bg-yellow-800/30 px-1 py-0.5 rounded transition-colors"
                                  onDoubleClick={() => startEditing(todo)}
                                  title="더블클릭하여 수정"
                                >
                                  {todo.text}
                                </span>
                              </div>
                            )}
                            {!isReadOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-yellow-600 hover:text-red-600 dark:text-yellow-400 dark:hover:text-red-400"
                                onClick={() => deleteTodo(todo.id)}
                                disabled={deleteTodoMutation.isPending}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="mt-3 pt-2 border-t border-yellow-300 dark:border-yellow-700">
              <div className="w-full bg-yellow-200 dark:bg-yellow-300 rounded-full h-2">
                <div
                  className="bg-yellow-500 dark:bg-yellow-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 text-center">
                {completedCount === totalCount && totalCount > 0
                  ? '🎉 모든 할일을 완료했습니다!'
                  : `${Math.round((completedCount / totalCount) * 100)}% 완료`
                }
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Resize handle - Only show in edit mode */}
      {!isReadOnly && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize bg-yellow-400 dark:bg-yellow-600 opacity-70 hover:opacity-100 transition-opacity"
          style={{
            clipPath: 'polygon(100% 0, 0 100%, 100% 100%)'
          }}
          onMouseDown={handleResizeMouseDown}
          title="크기 조정"
        />
      )}
    </div>
  );
}

// Show/Hide button for when the sticker is hidden
export function TodoStickerToggle({ canvasId, onShow }: { canvasId: string; onShow: () => void }) {
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [clickPrevented, setClickPrevented] = useState(false);

  // Fetch todos from API for count
  const { data: todos = [] } = useQuery<TodoItem[]>({
    queryKey: [`/api/canvases/${canvasId}/todos`],
    queryFn: () => apiRequest('GET', `/api/canvases/${canvasId}/todos`).then(res => res.json()),
    enabled: !!canvasId
  });

  useEffect(() => {
    const savedPosition = localStorage.getItem(`todo-position-${canvasId}`);
    if (savedPosition) {
      try {
        setPosition(JSON.parse(savedPosition));
      } catch (error) {
        setPosition({ x: 16, y: 16 });
      }
    }
  }, [canvasId]);

  // Save position to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`todo-position-${canvasId}`, JSON.stringify(position));
  }, [position, canvasId]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setClickPrevented(false);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setClickPrevented(true);
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - 200; // Button width
      const maxY = window.innerHeight - 40; // Button height
      
      const finalPosition = {
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      };
      
      setPosition(finalPosition);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (clickPrevented) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onShow();
  };

  // Global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, dragOffset, position]);

  return (
    <Button
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      size="sm"
      className={`fixed z-40 bg-yellow-500 hover:bg-yellow-600 text-yellow-900 shadow-lg transition-shadow ${
        isDragging ? 'shadow-2xl cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      할일 {todos.length > 0 && `(${todos.length})`}
    </Button>
  );
}