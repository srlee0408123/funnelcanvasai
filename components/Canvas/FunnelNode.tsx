import { X, AlertTriangle, Check } from "lucide-react";

interface Node {
  id: string;
  type: string;
  data: {
    title: string;
    subtitle?: string;
    icon: string;
    color: string;
    size?: "small" | "medium" | "large";
  };
  position: {
    x: number;
    y: number;
  };
}

interface FunnelNodeProps {
  node: Node;
  selected: boolean;
  feedbackSeverity: "none" | "low" | "medium" | "high";
  onClick?: () => void;
  onDoubleClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseUp?: () => void;
  isDragging?: boolean;
  isConnectable?: boolean;
  onConnectionStart?: (nodeId: string, e: React.MouseEvent) => void;
  onDelete?: (nodeId: string) => void;
  isReadOnly?: boolean;
  size?: "small" | "medium" | "large";
}

export default function FunnelNode({
  node,
  selected,
  feedbackSeverity,
  onClick,
  onDoubleClick,
  onMouseDown,
  onMouseUp,
  isDragging = false,
  isConnectable = false,
  onConnectionStart,
  onDelete,
  isReadOnly = false,
  size = "medium",
}: FunnelNodeProps) {
  // 노드 데이터의 size를 우선적으로 사용, 없으면 prop의 size 사용
  const actualSize = node.data?.size || size;
  
  // Debug logging for node rendering
  console.log('🔧 FunnelNode rendering:', {
    nodeId: node.id,
    position: node.position,
    title: node.data?.title,
    isReadOnly,
    size: actualSize
  });

  // 노드 크기에 따른 스타일 설정
  const getSizeStyles = () => {
    switch (actualSize) {
      case "small":
        return {
          container: "p-2",
          icon: "w-8 h-8 text-sm",
          title: "text-xs font-medium",
          subtitle: "text-xs",
          content: "min-w-[80px] max-w-[120px]",
          assignee: "text-xs px-1 py-0.5",
          assigneeAvatar: "w-2 h-2 text-xs"
        };
      case "large":
        return {
          container: "p-6",
          icon: "w-16 h-16 text-3xl",
          title: "text-xl font-semibold",
          subtitle: "text-base",
          content: "min-w-[180px] max-w-[280px]",
          assignee: "text-sm px-3 py-1",
          assigneeAvatar: "w-4 h-4 text-sm"
        };
      default: // medium
        return {
          container: "p-4",
          icon: "w-12 h-12 text-xl",
          title: "text-base font-medium",
          subtitle: "text-sm",
          content: "min-w-[120px] max-w-[200px]",
          assignee: "text-xs px-2 py-0.5",
          assigneeAvatar: "w-3 h-3 text-xs"
        };
    }
  };

  const sizeStyles = getSizeStyles();

  const getColorStyles = (color: string) => {
    // For hex colors, create dynamic styles
    if (color.startsWith('#')) {
      return {
        backgroundColor: color + '20', // Add transparency
        color: color,
        borderColor: color + '40'
      };
    }
    
    // Fallback for old color names
    switch (color) {
      case "blue":
        return { backgroundColor: '#3B82F620', color: '#3B82F6', borderColor: '#3B82F640' };
      case "green":
        return { backgroundColor: '#10B98120', color: '#10B981', borderColor: '#10B98140' };
      case "purple":
        return { backgroundColor: '#8B5CF620', color: '#8B5CF6', borderColor: '#8B5CF640' };
      case "orange":
        return { backgroundColor: '#F9731620', color: '#F97316', borderColor: '#F9731640' };
      case "red":
        return { backgroundColor: '#EF444420', color: '#EF4444', borderColor: '#EF444440' };
      default:
        return { backgroundColor: '#6B728020', color: '#6B7280', borderColor: '#6B728040' };
    }
  };

  const getFeedbackBadge = () => {
    if (feedbackSeverity === "none") return null;

    const badges = {
      high: {
        icon: <X className="h-3 w-3" />,
        color: "bg-red-500",
        tooltip: "중요한 개선사항 있음",
      },
      medium: {
        icon: <AlertTriangle className="h-3 w-3" />,
        color: "bg-yellow-500",
        tooltip: "개선 권장사항 있음",
      },
      low: {
        icon: <Check className="h-3 w-3" />,
        color: "bg-green-500",
        tooltip: "잘 설계됨",
      },
    };

    const badge = badges[feedbackSeverity];

    return (
      <div
        className={`absolute -top-2 -right-2 w-6 h-6 ${badge.color} rounded-full flex items-center justify-center cursor-help`}
        title={badge.tooltip}
      >
        <div className="text-primary-foreground">{badge.icon}</div>
      </div>
    );
  };

  const getAssigneeAvatars = () => {
    const assignees = (node.data as any).assignees;
    if (!assignees || assignees.length === 0) return null;

    const getInitials = (name: string) => {
      const words = name.split(" ");
      if (words.length >= 2) {
        return `${words[0][0]}${words[1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    };

    // Show up to 3 avatars, with overflow indicator
    const displayAssignees = assignees.slice(0, 3);
    const hasOverflow = assignees.length > 3;

    return (
      <div className="absolute -top-2 -left-2 flex -space-x-1">
        {displayAssignees.map((assignee: string, index: number) => (
          <div
            key={index}
            className="w-6 h-6 bg-blue-500 text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium cursor-help border-2 border-white shadow-sm"
            title={`담당자: ${assignee}`}
            style={{ zIndex: displayAssignees.length - index }}
          >
            {getInitials(assignee)}
          </div>
        ))}
        {hasOverflow && (
          <div
            className="w-6 h-6 bg-gray-500 text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium cursor-help border-2 border-white shadow-sm"
            title={`+${assignees.length - 3}명 더`}
          >
            +{assignees.length - 3}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      data-node
      data-node-id={node.id}
      className={`absolute bg-white rounded-xl shadow-lg border-2 transition-all duration-200 select-none group inline-block ${sizeStyles.container} ${
        isDragging 
          ? "cursor-grabbing shadow-2xl scale-105" 
          : isReadOnly 
          ? "cursor-default"
          : "cursor-grab hover:scale-105 hover:shadow-xl"
      } ${
        selected
          ? "border-blue-500 ring-2 ring-blue-200"
          : isConnectable
          ? "border-green-400 ring-2 ring-green-200"
          : "border-gray-200 hover:border-blue-300"
      }`}
      style={{
        transform: `translate(${node.position.x}px, ${node.position.y}px) ${isDragging ? ' rotate(2deg)' : ''}`,
        zIndex: isDragging ? 20 : (selected ? 10 : 5),
        pointerEvents: 'auto',
        border: isReadOnly ? '2px solid red' : undefined,
        backgroundColor: isReadOnly ? 'rgba(255,0,0,0.1)' : undefined,
        willChange: 'transform'
      }}
      onClick={!isReadOnly ? (e) => {
        // 삭제 버튼이나 연결점을 클릭한 경우 노드 클릭 이벤트 방지
        const target = e.target as HTMLElement;
        if (target.closest('.delete-button') || target.closest('.connection-point')) {
          return;
        }
        onClick?.();
      } : undefined}
      onDoubleClick={!isReadOnly ? (e) => {
        // 삭제 버튼이나 연결점을 더블클릭한 경우 노드 더블클릭 이벤트 방지
        const target = e.target as HTMLElement;
        if (target.closest('.delete-button') || target.closest('.connection-point')) {
          return;
        }
        e.stopPropagation();
        onDoubleClick?.();
      } : undefined}
      onMouseDown={!isReadOnly ? (e) => {
        // 삭제 버튼이나 연결점을 마우스다운한 경우 드래그 이벤트 방지
        const target = e.target as HTMLElement;
        if (target.closest('.delete-button') || target.closest('.connection-point')) {
          e.stopPropagation();
          return;
        }
        e.stopPropagation();
        onMouseDown?.(e);
      } : undefined}
      onMouseUp={!isReadOnly ? (e) => {
        // 삭제 버튼을 마우스업한 경우 노드 마우스업 이벤트 방지
        const target = e.target as HTMLElement;
        if (target.closest('.delete-button')) {
          return;
        }
        onMouseUp?.();
      } : undefined}
    >
      <div className="flex items-center space-x-3">
        <div 
          className={`${sizeStyles.icon} rounded-lg flex items-center justify-center border`}
          style={getColorStyles(node.data.color)}
        >
          <span className={sizeStyles.icon.includes('text-') ? '' : 'text-xl'}>{node.data.icon}</span>
        </div>
        <div className={`ml-3 ${sizeStyles.content}`}>
          <h4 className={`text-gray-900 leading-tight break-words ${sizeStyles.title}`}>
            {node.data.title}
          </h4>
          {node.data.subtitle && (
            <p className={`text-gray-500 mt-1 leading-tight break-words ${sizeStyles.subtitle}`}>
              {node.data.subtitle}
            </p>
          )}
          
          {/* Assignees - inline display */}
          {(node.data as any).assignees && (node.data as any).assignees.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(node.data as any).assignees.slice(0, 2).map((assignee: string, index: number) => (
                <div
                  key={index}
                  className={`inline-flex items-center space-x-1 bg-blue-100 text-blue-800 rounded ${sizeStyles.assignee}`}
                >
                  <div className={`${sizeStyles.assigneeAvatar} bg-blue-500 text-primary-foreground rounded-full flex items-center justify-center font-medium`}>
                    {assignee.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate max-w-[60px]">{assignee}</span>
                </div>
              ))}
              {(node.data as any).assignees.length > 2 && (
                <div className={`inline-flex items-center rounded bg-gray-100 text-gray-600 ${sizeStyles.assignee}`}>
                  +{(node.data as any).assignees.length - 2}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete button - appears on hover */}
      {!isReadOnly && (
        <div 
          className="delete-button absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg z-50 hover:scale-110"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🗑️ Delete button clicked for node:', node.id);
            if (onDelete) {
              onDelete(node.id);
            }
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🗑️ Delete button mouse down for node:', node.id);
          }}
          onMouseUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            // Force show delete button and change cursor
            const element = e.currentTarget as HTMLElement;
            element.style.opacity = '1';
            element.style.cursor = 'pointer';
            // Also change the node cursor to default when hovering over delete button
            const nodeElement = element.closest('[data-node]') as HTMLElement;
            if (nodeElement) {
              nodeElement.style.cursor = 'default';
            }
          }}
          onMouseLeave={(e) => {
            e.stopPropagation();
            // Restore node cursor when leaving delete button
            const nodeElement = (e.currentTarget as HTMLElement).closest('[data-node]') as HTMLElement;
            if (nodeElement && !isDragging) {
              nodeElement.style.cursor = 'grab';
            }
          }}
          title="노드 삭제"
          style={{ 
            pointerEvents: 'all',
            cursor: 'pointer'
          }}
        >
          <X className="h-4 w-4 text-white" />
        </div>
      )}


      
      {getFeedbackBadge()}
      
      {/* Connection points - Enhanced visibility and animation with larger hit area */}
      <div 
        className="connection-point absolute -right-3 top-1/2 transform -translate-y-1/2 cursor-crosshair z-50"
        data-anchor="right"
        onMouseDown={(e) => {
          e.stopPropagation();
          if (onConnectionStart) {
            onConnectionStart(node.id, e);
          }
        }}
      >
        {/* Larger invisible hit area for easier clicking */}
        <div className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 bg-transparent" 
             title="드래그해서 다른 노드와 연결" />
        {/* Visible connection point */}
        <div 
          className={`
            w-5 h-5 rounded-full border-2 border-white shadow-lg transition-all duration-300
            ${isConnectable 
              ? "bg-green-500 opacity-100 scale-125 animate-pulse ring-2 ring-green-300" 
              : "bg-blue-500 opacity-0 group-hover:opacity-100 hover:scale-110"
            }
          `}
        >
          {/* Inner dot for better visibility */}
          <div className="absolute inset-1 bg-white rounded-full opacity-80"></div>
        </div>
      </div>

      {/* Extended right edge connection area for easier access */}
      <div 
        className="connection-point absolute right-0 top-0 w-4 h-full cursor-crosshair z-40 bg-transparent hover:bg-blue-100/20 transition-colors"
        data-anchor="right"
        onMouseDown={(e) => {
          e.stopPropagation();
          if (onConnectionStart) {
            onConnectionStart(node.id, e);
          }
        }}
        title="드래그해서 연결 시작"
      />
      
      {/* Input connection point */}
      <div 
        className={`connection-point
          absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg transition-all duration-300
          ${isConnectable 
            ? "bg-green-400 opacity-100 scale-110 ring-2 ring-green-200" 
            : "bg-gray-400 opacity-0 group-hover:opacity-80"
          }
        `}
        title="연결 입력점"
      >
        <div className="absolute inset-0.5 bg-white rounded-full opacity-60"></div>
      </div>

      {/* Top connection point (outgoing) */}
      <div 
        className="connection-point absolute left-1/2 -top-3 transform -translate-x-1/2 cursor-crosshair z-50"
        data-anchor="top"
        onMouseDown={(e) => {
          e.stopPropagation();
          if (onConnectionStart) {
            onConnectionStart(node.id, e);
          }
        }}
      >
        <div className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 bg-transparent" 
             title="드래그해서 다른 노드와 연결" />
        <div 
          className={`
            w-5 h-5 rounded-full border-2 border-white shadow-lg transition-all duration-300
            ${isConnectable 
              ? "bg-green-500 opacity-100 scale-125 animate-pulse ring-2 ring-green-300" 
              : "bg-blue-500 opacity-0 group-hover:opacity-100 hover:scale-110"
            }
          `}
        >
          <div className="absolute inset-1 bg-white rounded-full opacity-80"></div>
        </div>
      </div>

      {/* Bottom connection point (outgoing) */}
      <div 
        className="connection-point absolute left-1/2 -bottom-3 transform -translate-x-1/2 cursor-crosshair z-50"
        data-anchor="bottom"
        onMouseDown={(e) => {
          e.stopPropagation();
          if (onConnectionStart) {
            onConnectionStart(node.id, e);
          }
        }}
      >
        <div className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 bg-transparent" 
             title="드래그해서 다른 노드와 연결" />
        <div 
          className={`
            w-5 h-5 rounded-full border-2 border-white shadow-lg transition-all duration-300
            ${isConnectable 
              ? "bg-green-500 opacity-100 scale-125 animate-pulse ring-2 ring-green-300" 
              : "bg-blue-500 opacity-0 group-hover:opacity-100 hover:scale-110"
            }
          `}
        >
          <div className="absolute inset-1 bg-white rounded-full opacity-80"></div>
        </div>
      </div>
    </div>
  );
}
