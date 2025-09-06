import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Check, Trash2, ChevronDown, ChevronUp, Circle } from 'lucide-react';
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
  // 노드를 자동 생성/동기화하지 않도록 기본 비활성화
  const SYNC_TODO_TO_NODES = false;

  const [newTodoText, setNewTodoText] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  
  // 컴포넌트 마운트 로그
  useEffect(() => {
    console.log('📝 Todo 스티커 마운트 - Canvas:', canvasId, 'ReadOnly:', isReadOnly, 'Visible:', isVisible);
    return () => {
      console.log('📝 Todo 스티커 언마운트 - Canvas:', canvasId);
    };
  }, [canvasId, isReadOnly, isVisible]);
  const [showCompleted, setShowCompleted] = useState(false);
  
  // Editing state
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        // 공통 키 사용 - 스티커와 토글이 동일한 위치 공유
        const savedPosition = localStorage.getItem(`todo-position-${canvasId}`);
        if (savedPosition) {
          return JSON.parse(savedPosition);
        }
        // Legacy fallbacks: 기존 분리된 키들에서 마이그레이션
        const legacyPosition =
          localStorage.getItem(`todo-sticker-position-${canvasId}`) ||
          localStorage.getItem(`todo-toggle-position-${canvasId}`);
        if (legacyPosition) {
          const parsed = JSON.parse(legacyPosition);
          // 공통 키로 마이그레이션
          localStorage.setItem(`todo-position-${canvasId}`, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch (_) {
      // ignore and fallback
    }
    // Default position
    return { x: 16, y: 16 };
  });
  
  // Resizing state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeOffset, setResizeOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedSize = localStorage.getItem(`todo-size-${canvasId}`);
      if (savedSize) {
        try {
          return JSON.parse(savedSize);
        } catch (_) {
          // ignore and use default
        }
      }
    }
    return { width: 300, height: 400 };
  });

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
    
    // 중복 제거 (id 기준)
    const seen = new Set<string>();
    result = result.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    
    return result.sort((a, b) => a.position - b.position);
  }, [todos, optimisticTodos, pendingOperations, isReadOnly, initialTodos]);

  const activeTodos = mergedTodos();

  // 기존: 할일들을 노드로 동기화하던 로직은 비활성화
  useEffect(() => {
    if (!SYNC_TODO_TO_NODES) return;
    if (!isReadOnly && isVisible && activeTodos.length > 0) {
      // intentionally disabled
    }
  }, [SYNC_TODO_TO_NODES, activeTodos, canvasId, isReadOnly, isVisible]);

  // 실시간 이벤트 처리
  const handleRealtimeEvent = useCallback((payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
      case 'INSERT':
        // 새 할일 추가 - 중복 방지: temp 항목을 실제 항목으로 교체 또는 id 중복 제거
        setOptimisticTodos(prev => {
          // temp 항목 중 동일 텍스트를 가진 항목이 있으면 교체
          const tempIndex = prev.findIndex(t => t.id.startsWith('temp-') && t.text === newRecord.text);
          if (tempIndex >= 0) {
            const next = [...prev];
            next[tempIndex] = newRecord;
            // id 기준 중복 제거
            const seen = new Set<string>();
            return next.filter(item => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            });
          }
          // 이미 같은 id가 있으면 추가하지 않음
          if (prev.some(t => t.id === newRecord.id)) return prev;
          const next = [...prev, newRecord];
          const seen = new Set<string>();
          return next.filter(item => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
        });
        // temp 기반 pending 플래그 정리 및 create-실ID 플래그 제거
        setPendingOperations(prev => {
          const newSet = new Set<string>();
          for (const key of prev) {
            if (key.startsWith('create-temp-')) continue; // temp는 제거
            if (key === `create-${newRecord.id}`) continue; // 실ID도 제거
            newSet.add(key);
          }
          return newSet;
        });
        break;
        
      case 'UPDATE':
        // 할일 업데이트
        if (!pendingOperations.has(`update-${newRecord.id}`)) {
          setOptimisticTodos(prev => {
            const index = prev.findIndex(t => t.id === newRecord.id);
            const next = [...prev];
            if (index >= 0) next[index] = newRecord; else next.push(newRecord);
            const seen = new Set<string>();
            return next.filter(item => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            });
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
  }, [canvasId, isReadOnly, isVisible, handleRealtimeEvent]);

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
      
      // 임시 ID를 실제 ID로 교체 + 중복 제거
      setOptimisticTodos(prev => {
        const replaced = prev.map(todo => todo.id === context?.tempId ? newTodo : todo);
        const seen = new Set<string>();
        return replaced.filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      });
      
      // pending 상태 업데이트 (temp 제거, 실ID는 즉시 제거해 중복 이벤트에도 안전)
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(`create-${context?.tempId}`);
        newSet.delete(`create-${newTodo.id}`);
        return newSet;
      });
      
      // 노드 동기화 비활성화
      if (SYNC_TODO_TO_NODES) {
        await createTodoNode(newTodo);
      }
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
        const next = [...prev];
        if (index >= 0) next[index] = updatedTodo;
        const seen = new Set<string>();
        return next.filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      });
      
      // 할일 상태나 텍스트가 변경되면 캔버스 노드도 업데이트
      if (SYNC_TODO_TO_NODES && (updates.completed !== undefined || updates.text !== undefined)) {
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
      // 할일 삭제 시 노드 삭제 비활성화
      if (SYNC_TODO_TO_NODES) {
        await deleteTodoNode(id);
      }
      
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

  // (Position and size are lazily initialized above to avoid initial jump/flicker)

  // Save position and size to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`todo-position-${canvasId}`, JSON.stringify(position));
  }, [position, canvasId]);
  
  useEffect(() => {
    localStorage.setItem(`todo-size-${canvasId}`, JSON.stringify(size));
  }, [size, canvasId]);

  // 할일을 캔버스 노드로 생성하는 함수 (중복 체크 포함)
  const createTodoNode = useCallback(async (todo: TodoItem) => {
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
  }, [canvasId]);

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

  const handleMouseMove = useCallback((e: MouseEvent) => {
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
  }, [isDragging, dragOffset.x, dragOffset.y, size.width, position.x, position.y, isResizing, resizeOffset.x, resizeOffset.y]);

  const handleMouseUp = useCallback(() => {
    console.log('Mouse up - ending drag/resize');
    setIsDragging(false);
    setIsResizing(false);
  }, []);

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
    if (!isResizing) return;
    const mm = (e: MouseEvent) => handleMouseMove(e);
    const mu = () => handleMouseUp();
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'nw-resize';
    return () => {
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Global mouse event listeners for dragging
  useEffect(() => {
    if (!isDragging) return;
    const mm = (e: MouseEvent) => handleMouseMove(e);
    const mu = () => handleMouseUp();
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    return () => {
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed z-50 todo-sticker-modern transition-all duration-200 ${
        isDragging ? 'shadow-2xl scale-105' : isResizing ? 'shadow-xl' : 'shadow-xl'
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
        className={`todo-sticker-header flex items-center justify-between select-none ${
          isReadOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-amber-600 rounded-full shadow-sm"></div>
          <h3 className="font-semibold todo-text-primary text-base">
            할일 체크리스트
          </h3>
          {totalCount > 0 && (
            <span className="text-sm todo-text-secondary font-medium bg-amber-200 px-2 py-1 rounded-full">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 todo-text-secondary hover:bg-amber-200 rounded-full transition-colors"
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
              className="h-7 w-7 p-0 todo-text-secondary hover:bg-amber-200 rounded-full transition-colors"
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
        <div className="todo-sticker-content">
          {/* Add todo input - Only show in edit mode */}
          {!isReadOnly && (
            <div className="flex gap-3 mb-4">
              <Input
                placeholder="새 할일 추가..."
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                className="text-sm bg-white border-amber-300 focus:border-amber-500 rounded-xl px-4 py-2 todo-text-primary placeholder:todo-text-muted"
              />
              <Button
                onClick={addTodo}
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 shadow-sm transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Todo list */}
          <div className="space-y-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: `${size.height - 150}px` }}>
            {isLoading ? (
              <p className="todo-text-muted text-sm text-center py-8">
                불러오는 중...
              </p>
            ) : totalCount === 0 ? (
              <p className="todo-text-muted text-sm text-center py-8">
                아직 할일이 없습니다
              </p>
            ) : (
              <>
                {/* 미완료 할일 섹션 */}
                {incompleteTodos.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold todo-text-secondary border-b border-amber-300 pb-2">
                      진행중 ({incompleteTodos.length})
                    </h4>
                    {incompleteTodos.map((todo) => {
                      const isPending = pendingOperations.has(`update-${todo.id}`) || 
                                       pendingOperations.has(`delete-${todo.id}`) ||
                                       todo.id.startsWith('temp-');
                      
                      return (
                      <div
                        key={todo.id}
                        className={`todo-item-modern ${
                          isPending ? 'opacity-60 pointer-events-none' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={!isReadOnly ? () => toggleTodo(todo.id) : undefined}
                            className={`todo-checkbox-modern ${isReadOnly ? 'cursor-default' : ''}`}
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
                              className="flex-1 text-sm bg-white border-amber-300 focus:border-amber-500 rounded-lg px-3 py-2 todo-text-primary"
                            />
                          ) : (
                            <div className="flex items-center gap-2 flex-1">
                              <Circle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                              <span 
                                className="text-sm todo-text-primary cursor-pointer hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors flex-1"
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
                              className="h-7 w-7 p-0 todo-text-muted hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                              onClick={() => deleteTodo(todo.id)}
                              disabled={deleteTodoMutation.isPending}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}

                {/* 완료된 할일 섹션 */}
                {completedTodos.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold todo-text-secondary border-b border-amber-300 pb-2 flex-1">
                        완료됨 ({completedTodos.length})
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 todo-text-secondary hover:bg-amber-200 rounded-full transition-colors ml-2"
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
                            className={`todo-item-modern todo-item-completed ${
                              isPending ? 'opacity-40 pointer-events-none' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={!isReadOnly ? () => toggleTodo(todo.id) : undefined}
                                className={`todo-checkbox-modern todo-checkbox-completed ${isReadOnly ? 'cursor-default' : ''}`}
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
                                  className="flex-1 text-sm bg-white border-amber-300 focus:border-amber-500 rounded-lg px-3 py-2 todo-text-primary"
                                />
                              ) : (
                                <div className="flex items-center gap-2 flex-1">
                                  <span 
                                    className="text-sm line-through todo-text-muted cursor-pointer hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors flex-1"
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
                                  className="h-7 w-7 p-0 todo-text-muted hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                  onClick={() => deleteTodo(todo.id)}
                                  disabled={deleteTodoMutation.isPending}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
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
            <div className="mt-4 pt-4 border-t border-amber-300">
              <div className="todo-progress-bar">
                <div
                  className="todo-progress-fill"
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                ></div>
              </div>
              <p className="text-sm todo-text-secondary mt-3 text-center font-medium">
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
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize bg-amber-500 opacity-60 hover:opacity-100 transition-opacity rounded-tl-lg"
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
  const [position, setPosition] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        // 스티커와 동일한 공통 키 사용 - 같은 위치 공유
        const savedPosition = localStorage.getItem(`todo-position-${canvasId}`);
        if (savedPosition) {
          return JSON.parse(savedPosition);
        }
        // Legacy fallback: 기존 분리된 키에서 마이그레이션
        const legacy = localStorage.getItem(`todo-toggle-position-${canvasId}`);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          localStorage.setItem(`todo-position-${canvasId}`, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch (_) {
      // ignore and fallback
    }
    return { x: 16, y: 16 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [clickPrevented, setClickPrevented] = useState(false);

  // Fetch todos from API for count
  const { data: todos = [] } = useQuery<TodoItem[]>({
    queryKey: [`/api/canvases/${canvasId}/todos`],
    queryFn: () => apiRequest('GET', `/api/canvases/${canvasId}/todos`).then(res => res.json()),
    enabled: !!canvasId
  });

  // Position is lazily initialized above

  // Save position to localStorage whenever it changes - 스티커와 동일한 키 사용
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
    if (!isDragging) return;
    const mm = (e: MouseEvent) => handleMouseMove(e);
    const mu = () => handleMouseUp();
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    return () => {
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <Button
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      size="sm"
      className={`fixed z-40 bg-amber-500 hover:bg-amber-600 text-white shadow-xl rounded-2xl px-4 py-2 font-semibold transition-all duration-200 ${
        isDragging ? 'shadow-2xl cursor-grabbing scale-105' : 'cursor-grab hover:scale-105'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      할일 {todos.length > 0 && (
        <span className="bg-amber-600 text-white px-2 py-0.5 rounded-full text-xs ml-1">
          {todos.length}
        </span>
      )}
    </Button>
  );
}