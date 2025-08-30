import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface RightPanelProps {
  nodeId: string;
  canvasId: string;
  onClose: () => void;
}

interface AssigneeInputProps {
  currentAssignees: string[];
  onAssigneesChange: (assignees: string[]) => void;
}

// 타이핑 기반 담당자 입력 컴포넌트
function AssigneeInput({ currentAssignees, onAssigneesChange }: AssigneeInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      addAssignee();
    } else if (e.key === "Backspace" && inputValue === "" && currentAssignees.length > 0) {
      // 입력이 비어있을 때 백스페이스로 마지막 담당자 제거
      removeAssignee(currentAssignees.length - 1);
    }
  };

  const addAssignee = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !currentAssignees.includes(trimmedValue)) {
      onAssigneesChange([...currentAssignees, trimmedValue]);
      setInputValue("");
    }
  };

  const removeAssignee = (index: number) => {
    const newAssignees = currentAssignees.filter((_, i) => i !== index);
    onAssigneesChange(newAssignees);
  };

  const getInitials = (name: string) => {
    const words = name.split(" ");
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="border border-gray-300 rounded-lg p-2 min-h-[40px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
      <div className="flex flex-wrap gap-1 items-center">
        {currentAssignees.map((assignee, index) => (
          <div
            key={index}
            className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm"
          >
            <div className="w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
              {getInitials(assignee)}
            </div>
            <span>{assignee}</span>
            <button
              onClick={() => removeAssignee(index)}
              className="text-blue-600 hover:text-blue-800 ml-1"
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addAssignee}
          placeholder={currentAssignees.length === 0 ? "담당자 이름 입력..." : ""}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
        />
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Enter, 쉼표, Tab으로 추가 • 백스페이스로 제거
      </div>
    </div>
  );
}

export default function RightPanel({ nodeId, canvasId, onClose }: RightPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Local state for node editing
  const [editedNode, setEditedNode] = useState<any>(null);
  const [assignees, setAssignees] = useState<string[]>([]);

  const [nodeTitle, setNodeTitle] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");
  const [nodeIcon, setNodeIcon] = useState("");
  const [nodeColor, setNodeColor] = useState("");

  // Fetch canvas state to get node data with real-time refetch
  const { data: canvasState, isLoading, refetch } = useQuery({
    queryKey: ["/api/canvases", canvasId, "state", "latest"],
    enabled: !!canvasId,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale to force refetch
  });

  // Auto-refetch when nodeId changes (when a new node is selected)
  useEffect(() => {
    if (nodeId && canvasId) {
      refetch();
    }
  }, [nodeId, canvasId, refetch]);

  // Get workspace ID from canvas data
  const { data: canvasInfo } = useQuery({
    queryKey: ["/api/canvases", canvasId],
    enabled: !!canvasId,
  });

  // Find the selected node from canvas state with comprehensive debugging
  const flowJson = (canvasState as any)?.flowJson;
  console.log("FlowJson detailed structure:", {
    flowJson,
    hasFlowJson: !!flowJson,
    flowJsonType: typeof flowJson,
    flowJsonKeys: flowJson ? Object.keys(flowJson) : [],
    fullFlowJson: JSON.stringify(flowJson, null, 2)
  });
  
  let node = null;
  let availableNodeIds: string[] = [];
  
  // Try different possible node structures
  if (flowJson?.nodes && Array.isArray(flowJson.nodes)) {
    node = flowJson.nodes.find((n: any) => n.id === nodeId);
    availableNodeIds = flowJson.nodes.map((n: any) => n.id);
    console.log("Found nodes in flowJson.nodes:", availableNodeIds);
  } else if (flowJson && typeof flowJson === 'object') {
    // Check for other possible structures
    const keys = Object.keys(flowJson);
    console.log("Checking flowJson keys:", keys);
    
    for (const key of keys) {
      if (Array.isArray(flowJson[key])) {
        const items = flowJson[key];
        console.log(`Checking array in flowJson.${key}:`, items.map((item: any) => ({ id: item?.id, type: typeof item })));
        
        const foundNode = items.find((n: any) => n?.id === nodeId);
        if (foundNode) {
          node = foundNode;
          availableNodeIds = items.map((n: any) => n?.id).filter(Boolean);
          console.log(`Found node in flowJson.${key}`);
          break;
        }
      }
    }
  }
  
  // Show error message if node not found
  if (!isLoading && !node && nodeId) {
    return (
      <div className="w-80 h-full border-l border-gray-200 bg-white p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">노드 정보</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-yellow-800 mb-2">노드를 찾을 수 없습니다</h3>
          <p className="text-sm text-yellow-700 mb-3">
            선택된 노드가 아직 로드되지 않았습니다. 잠시 후 다시 시도하거나 페이지를 새로고침해주세요.
          </p>
          <div className="text-xs text-yellow-600">
            <p><strong>노드 ID:</strong> {nodeId}</p>
            <p><strong>총 노드 수:</strong> {availableNodeIds.length}</p>
            {availableNodeIds.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer">사용 가능한 노드 ID들</summary>
                <ul className="mt-1 pl-4">
                  {availableNodeIds.map(id => (
                    <li key={id} className="break-all">{id}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <button 
            onClick={() => refetch()}
            className="mt-3 px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
          >
            다시 로드
          </button>
        </div>
      </div>
    );
  }

  // 노드 업데이트 뮤테이션
  const updateNodeMutation = useMutation({
    mutationFn: async (updatedNode: any) => {
      const currentFlow = (canvasState as any)?.flowJson || { nodes: [], edges: [] };
      const updatedNodes = currentFlow.nodes.map((n: any) => 
        n.id === nodeId ? { ...n, ...updatedNode } : n
      );
      const updatedFlow = { ...currentFlow, nodes: updatedNodes };
      
      return apiRequest(`/api/canvases/${canvasId}/state`, "POST", { flowJson: updatedFlow });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/canvases", canvasId, "state", "latest"] });
    }
  });

  // 담당자들 변경 핸들러
  const handleAssigneesChange = (newAssignees: string[]) => {
    setAssignees(newAssignees);
    console.log("Assignees changed:", newAssignees);
  };

  // Save changes to server
  const handleSaveChanges = async () => {
    if (!node || !canvasState) return;
    
    try {
      // Get current canvas data
      const currentFlowData = (canvasState as any)?.flowJson;
      if (!currentFlowData?.nodes) return;
      
      // Update the node with edited data
      const updatedNodes = currentFlowData.nodes.map((n: any) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              title: nodeTitle,
              subtitle: nodeDescription,
              icon: nodeIcon,
              color: nodeColor,
              assignees: assignees
            }
          };
        }
        return n;
      });
      
      const updatedFlowData = {
        ...currentFlowData,
        nodes: updatedNodes
      };
      
      console.log("Saving node changes:", { nodeId, nodeTitle, nodeDescription, assignees });
      
      // Save to server
      const response = await fetch(`/api/canvases/${canvasId}/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ flowJson: updatedFlowData })
      });
      
      if (response.ok) {
        console.log("Node changes saved successfully");
        // Force refresh the canvas state immediately
        await queryClient.invalidateQueries({ queryKey: ["/api/canvases", canvasId, "state", "latest"] });
        await queryClient.refetchQueries({ queryKey: ["/api/canvases", canvasId, "state", "latest"] });
        
        // Show success feedback
        console.log("Canvas state refreshed after node update");
        toast({
          title: "변경사항 저장됨",
          description: "노드 정보가 성공적으로 업데이트되었습니다.",
        });
      } else {
        console.error("Failed to save node changes:", response.status);
      }
    } catch (error) {
      console.error("Error saving node changes:", error);
    }
  };

  // Delete node
  const handleDeleteNode = async () => {
    if (!node || !canvasState) return;
    
    const confirmed = window.confirm("정말로 이 노드를 삭제하시겠습니까?");
    if (!confirmed) return;
    
    try {
      // Get current canvas data
      const currentFlowData = (canvasState as any)?.flowJson;
      if (!currentFlowData?.nodes) return;
      
      // Remove the node
      const updatedNodes = currentFlowData.nodes.filter((n: any) => n.id !== nodeId);
      
      // Remove edges connected to this node
      const updatedEdges = (currentFlowData.edges || []).filter((edge: any) => 
        edge.source !== nodeId && edge.target !== nodeId
      );
      
      const updatedFlowData = {
        ...currentFlowData,
        nodes: updatedNodes,
        edges: updatedEdges
      };
      
      console.log("Deleting node:", nodeId);
      
      // Save to server
      const response = await fetch(`/api/canvases/${canvasId}/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ flowJson: updatedFlowData })
      });
      
      if (response.ok) {
        console.log("Node deleted successfully");
        // Refresh the canvas state and close panel
        queryClient.invalidateQueries({ queryKey: ["/api/canvases", canvasId, "state", "latest"] });
        onClose();
      } else {
        console.error("Failed to delete node:", response.status);
      }
    } catch (error) {
      console.error("Error deleting node:", error);
    }
  };

  if (isLoading || !canvasState) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">노드 세부사항</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <i className="fas fa-times text-gray-400"></i>
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-gray-500 text-sm">캔버스 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 노드 존재 여부를 더 정확히 확인
  const nodeExists = node && typeof node === 'object' && node.id;
  console.log("Node validation:", { node, nodeExists, nodeId, hasId: !!node?.id, hasData: !!node?.data });
  
  // Initialize form values when node data changes
  useEffect(() => {
    if (node) {
      setNodeTitle(node.data.title || "");
      setNodeDescription(node.data.subtitle || "");
      setNodeIcon(node.data.icon || "📄");
      setNodeColor(node.data.color || "#3B82F6");
      setAssignees(node.data.assignees || []);
    }
  }, [node]);
  
  if (!nodeExists) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">노드 세부사항</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <i className="fas fa-times text-gray-400"></i>
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-500 text-sm">선택된 노드를 찾을 수 없습니다.</p>
            <p className="text-gray-400 text-xs mt-1">노드 ID: {nodeId}</p>
            <p className="text-gray-400 text-xs mt-1">
              총 노드 수: {availableNodeIds.length}
            </p>
            <div className="text-xs text-gray-400 mt-2 max-h-32 overflow-y-auto">
              <p>사용 가능한 노드 ID들:</p>
              {availableNodeIds.map((id) => (
                <div key={id} className="text-left">{id}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue":
        return "bg-blue-100 text-blue-600";
      case "green":
        return "bg-green-100 text-green-600";
      case "purple":
        return "bg-purple-100 text-purple-600";
      case "orange":
        return "bg-orange-100 text-orange-600";
      case "red":
        return "bg-red-100 text-red-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center border"
              style={{
                backgroundColor: node.data.color + '20',
                color: node.data.color,
                borderColor: node.data.color + '40'
              }}
            >
              <span className="text-lg">{node.data.icon}</span>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{node.data.title}</h2>
              <p className="text-xs text-gray-500">노드 세부 설정</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <i className="fas fa-times text-gray-400"></i>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">노드 제목</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={nodeTitle}
              onChange={(e) => setNodeTitle(e.target.value)}
            />
          </div>

          {/* Icon and Color Section */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">아이콘</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg"
                value={nodeIcon}
                onChange={(e) => setNodeIcon(e.target.value)}
                placeholder="🎯"
                maxLength={2}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">색상</label>
              <input
                type="color"
                className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                value={nodeColor}
                onChange={(e) => setNodeColor(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-48"
              value={nodeDescription}
              onChange={(e) => setNodeDescription(e.target.value)}
              placeholder="노드에 대한 자세한 설명을 입력하세요..."
              rows={10}
            />
          </div>

          {/* Assignees Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">담당자</label>
            <AssigneeInput 
              currentAssignees={assignees} 
              onAssigneesChange={handleAssigneesChange} 
            />
          </div>

          

          

          



          {/* Action Buttons */}
          <div className="pt-4 space-y-2">
            <Button 
              className="w-full" 
              variant="outline"
              onClick={handleSaveChanges}
            >
              <i className="fas fa-save mr-2"></i>
              변경사항 저장
            </Button>

            <Button 
              className="w-full" 
              variant="destructive"
              onClick={handleDeleteNode}
            >
              <i className="fas fa-trash mr-2"></i>
              노드 삭제
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}