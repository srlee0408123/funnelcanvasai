import { useQuery } from "@tanstack/react-query";

interface FunnelNodeType {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  defaultProperties: any;
  isActive: boolean;
}

interface NodePaletteProps {
  workspaceId: string;
}

export default function NodePalette({ workspaceId }: NodePaletteProps) {
  // Fetch available node types from admin-created funnel node types
  const { data: nodeTypes, isLoading } = useQuery<FunnelNodeType[]>({
    queryKey: ['/api/admin/node-types'],
    retry: false,
  });

  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue":
        return "bg-blue-100 text-blue-600 border-blue-200";
      case "green":
        return "bg-green-100 text-green-600 border-green-200";
      case "purple":
        return "bg-purple-100 text-purple-600 border-purple-200";
      case "orange":
        return "bg-orange-100 text-orange-600 border-orange-200";
      case "red":
        return "bg-red-100 text-red-600 border-red-200";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const handleDragStart = (e: React.DragEvent, nodeType: FunnelNodeType) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'node',
      nodeType: nodeType.category,
      data: {
        title: nodeType.name,
        subtitle: nodeType.category,
        icon: nodeType.icon,
        color: nodeType.color,
        ...nodeType.defaultProperties
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-medium text-gray-900 mb-3">노드 타입</h3>
        <div className="animate-pulse space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!nodeTypes || nodeTypes.length === 0) {
    return (
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-medium text-gray-900 mb-3">노드 타입</h3>
        <p className="text-sm text-gray-500">사용 가능한 노드 타입이 없습니다.</p>
      </div>
    );
  }

  // Group nodes by category
  const groupedNodes = nodeTypes.reduce((acc, nodeType) => {
    const category = nodeType.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(nodeType);
    return acc;
  }, {} as Record<string, FunnelNodeType[]>);

  const categoryLabels: Record<string, string> = {
    email: "이메일",
    landing: "랜딩페이지", 
    social: "소셜미디어",
    crm: "CRM/SMS",
    ads: "광고",
    page: "페이지",
    payment: "결제",
    automation: "자동화"
  };

  return (
    <div className="p-4 border-b border-gray-100">
      <h3 className="font-medium text-gray-900 mb-3">노드 타입</h3>
      <div className="space-y-3">
        {Object.entries(groupedNodes).map(([category, nodes]) => (
          <div key={category}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {categoryLabels[category] || category}
            </h4>
            <div className="space-y-1">
              {nodes.filter(node => node.isActive).map((nodeType) => (
                <div
                  key={nodeType.id}
                  className={`p-3 rounded-lg border cursor-grab hover:shadow-md transition-all duration-200 ${getColorClasses(nodeType.color)}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, nodeType)}
                  title={`${nodeType.name}를 캔버스로 드래그하세요`}
                >
                  <div className="flex items-center space-x-2">
                    <i className={`${nodeType.icon} text-sm`}></i>
                    <span className="text-sm font-medium truncate">
                      {nodeType.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}