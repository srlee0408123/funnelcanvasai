import { useState, useEffect } from 'react';
import { X, Plus, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface TodoItem {
  id: string;
  canvasId: string;
  text: string;
  completed: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
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

  const queryClient = useQueryClient();

  // Fetch todos from API (disabled in read-only mode if initialTodos provided)
  const { data: todos = [], isLoading } = useQuery<TodoItem[]>({
    queryKey: [`/api/canvases/${canvasId}/todos`],
    enabled: !!canvasId && !isReadOnly
  });

  // Use initial todos in read-only mode, otherwise use fetched todos
  const activeTodos = isReadOnly && initialTodos ? initialTodos : todos;

  // Create todo mutation
  const createTodoMutation = useMutation({
    mutationFn: (text: string) => 
      apiRequest('POST', `/api/canvases/${canvasId}/todos`, { text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/canvases/${canvasId}/todos`] });
      setNewTodoText('');
    }
  });

  // Update todo mutation
  const updateTodoMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<TodoItem> }) =>
      apiRequest('PATCH', `/api/canvases/${canvasId}/todos/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/canvases/${canvasId}/todos`] });
    }
  });

  // Delete todo mutation
  const deleteTodoMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('DELETE', `/api/canvases/${canvasId}/todos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/canvases/${canvasId}/todos`] });
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

  const addTodo = () => {
    if (!newTodoText.trim()) return;
    createTodoMutation.mutate(newTodoText.trim());
  };

  const toggleTodo = (id: string) => {
    const todo = todos.find(t => t.id === id);
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
      className={`fixed z-50 bg-yellow-100 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg shadow-lg backdrop-blur-sm transition-shadow ${
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
                className="text-sm bg-white/80 dark:bg-gray-800/80 border-yellow-300 dark:border-yellow-700 focus:border-yellow-500 dark:focus:border-yellow-500"
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
                    {incompleteTodos.map((todo) => (
                      <div
                        key={todo.id}
                        className="flex items-center gap-2 p-2 rounded border bg-white/80 dark:bg-gray-800/80 border-yellow-300 dark:border-yellow-700 transition-all"
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
                            className="flex-1 text-sm h-auto py-1 px-2 bg-white dark:bg-gray-700 border-yellow-400 dark:border-yellow-600 focus:border-yellow-500"
                          />
                        ) : (
                          <span 
                            className="flex-1 text-sm text-yellow-800 dark:text-yellow-200 cursor-pointer hover:bg-yellow-200/30 dark:hover:bg-yellow-800/30 px-1 py-0.5 rounded transition-colors"
                            onDoubleClick={() => startEditing(todo)}
                            title="더블클릭하여 수정"
                          >
                            {todo.text}
                          </span>
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
                    ))}
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
                        {completedTodos.map((todo) => (
                          <div
                            key={todo.id}
                            className="flex items-center gap-2 p-2 rounded border bg-yellow-200/50 dark:bg-yellow-800/30 border-yellow-400 dark:border-yellow-600 transition-all opacity-75"
                          >
                            <button
                              onClick={!isReadOnly ? () => toggleTodo(todo.id) : undefined}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors bg-yellow-500 border-yellow-500 text-white ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
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
                                className="flex-1 text-sm h-auto py-1 px-2 bg-white dark:bg-gray-700 border-yellow-400 dark:border-yellow-600 focus:border-yellow-500"
                              />
                            ) : (
                              <span 
                                className="flex-1 text-sm line-through text-yellow-600 dark:text-yellow-400 cursor-pointer hover:bg-yellow-200/30 dark:hover:bg-yellow-800/30 px-1 py-0.5 rounded transition-colors"
                                onDoubleClick={() => startEditing(todo)}
                                title="더블클릭하여 수정"
                              >
                                {todo.text}
                              </span>
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
                        ))}
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
              <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
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
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize bg-yellow-400 dark:bg-yellow-600 opacity-50 hover:opacity-100 transition-opacity"
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
      📝 할일 {todos.length > 0 && `(${todos.length})`}
    </Button>
  );
}