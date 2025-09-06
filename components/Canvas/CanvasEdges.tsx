import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import type { FlowNode, FlowEdge } from "@/types/canvas";
import { useEdgeGeometry } from "@/hooks/useEdgeGeometry";

/**
 * CanvasEdges - 엣지 SVG 레이어 컴포넌트
 *
 * 주요 역할:
 * 1. 엣지 경로/마커/그림자 등 SVG 렌더링
 * 2. 미드포인트 계산 및 삭제 버튼 표시
 * 3. 연결 중 임시 경로 표시
 *
 * 핵심 특징:
 * - useEdgeGeometry 훅을 통해 경로/제어점 일관 계산
 * - viewport 변환을 그룹에 한 번만 적용하여 퍼포먼스 최적화
 * - 포인터 이벤트 분리로 정확한 호버/클릭 처리
 *
 * 주의사항:
 * - 삭제/저장 트리거는 상위에서 주입
 */
export interface CanvasEdgesProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: { x: number; y: number; zoom: number };
  isReadOnly?: boolean;
  isConnecting: boolean;
  connectionStart: string | null;
  connectionStartAnchor: 'left' | 'right' | 'top' | 'bottom' | null;
  temporaryConnection: { x: number; y: number } | null;
  onDeleteEdge: (edgeId: string) => void;
}

export function CanvasEdges({
  nodes,
  edges,
  viewport,
  isReadOnly = false,
  isConnecting,
  connectionStart,
  connectionStartAnchor,
  temporaryConnection,
  onDeleteEdge,
}: CanvasEdgesProps) {
  const { computeEdgeGeometry, generatePath } = useEdgeGeometry(viewport.zoom);
  const edgePathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [edgeMidpoints, setEdgeMidpoints] = useState<Record<string, { x: number; y: number }>>({});

  const handleEdgeDelete = useCallback((edgeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteEdge(edgeId);
  }, [onDeleteEdge]);

  // 노드 위치 변경 시 엣지 미드포인트 캐시 초기화
  useEffect(() => {
    setEdgeMidpoints({});
  }, [nodes]);

  return (
    <svg 
      className="absolute inset-0 w-full h-full" 
      style={{ zIndex: 1, pointerEvents: 'auto' }}
    >
      <defs>
        <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{stopColor:"#6366F1", stopOpacity:1}} />
          <stop offset="100%" style={{stopColor:"#3B82F6", stopOpacity:1}} />
        </linearGradient>
        <filter id="arrowShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="1" dy="1" stdDeviation="1" floodOpacity="0.3"/>
        </filter>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 8 3 L 0 6 L 2 3 Z" fill="url(#arrowGradient)" filter="url(#arrowShadow)" />
        </marker>

        <linearGradient id="tempArrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{stopColor:"#06B6D4", stopOpacity:1}} />
          <stop offset="100%" style={{stopColor:"#3B82F6", stopOpacity:1}} />
        </linearGradient>
        <marker id="temp-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 10 3.5 L 0 7 L 2.5 3.5 Z" fill="url(#tempArrowGradient)" filter="url(#arrowShadow)" />
        </marker>

        <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{stopColor:"#8B5CF6", stopOpacity:0.8}} />
          <stop offset="50%" style={{stopColor:"#6366F1", stopOpacity:0.9}} />
          <stop offset="100%" style={{stopColor:"#3B82F6", stopOpacity:0.8}} />
        </linearGradient>
        <linearGradient id="tempConnectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{stopColor:"#06B6D4", stopOpacity:0.7}} />
          <stop offset="100%" style={{stopColor:"#3B82F6", stopOpacity:0.9}} />
        </linearGradient>
      </defs>

      {(edges).map((edge) => {
        const path = generatePath(edge, nodes, edges);
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (!sourceNode || !targetNode || !path) return null;

        const geom = computeEdgeGeometry(edge, nodes, edges);
        if (!geom) return null;
        const { sourceX, sourceY, targetX, targetY, control1X, control1Y, control2X, control2Y } = geom;

        const t = 0.5;
        const midX = Math.pow(1-t, 3) * sourceX + 3 * Math.pow(1-t, 2) * t * control1X + 3 * (1-t) * Math.pow(t, 2) * control2X + Math.pow(t, 3) * targetX;
        const midY = Math.pow(1-t, 3) * (sourceY) + 3 * Math.pow(1-t, 2) * t * control1Y + 3 * (1-t) * Math.pow(t, 2) * control2Y + Math.pow(t, 3) * targetY;

        return (
          <g key={edge.id} data-edge={edge.id} className="edge-group group">
            <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
              <path d={path} stroke="rgba(0,0,0,0.1)" strokeWidth={6 / viewport.zoom} fill="none" className="pointer-events-none" />
              <path
                d={path}
                stroke="transparent"
                strokeWidth={Math.max(28, 28 / viewport.zoom)}
                fill="none"
                style={{ pointerEvents: 'stroke', cursor: 'pointer', strokeLinecap: 'round', strokeLinejoin: 'round' }}
                ref={(el) => {
                  if (el) {
                    edgePathRefs.current.set(edge.id, el);
                  } else {
                    edgePathRefs.current.delete(edge.id);
                  }
                }}
                onMouseEnter={() => {
                  const pathEl = edgePathRefs.current.get(edge.id);
                  if (pathEl) {
                    try {
                      const total = pathEl.getTotalLength();
                      const p = pathEl.getPointAtLength(total / 2);
                      setEdgeMidpoints(prev => ({ ...prev, [edge.id]: { x: p.x, y: p.y } }));
                    } catch {}
                  }
                  setHoveredEdgeId(edge.id);
                }}
                onMouseLeave={() => setHoveredEdgeId(prev => (prev === edge.id ? null : prev))}
              />
              <path
                d={path}
                stroke="url(#connectionGradient)"
                strokeWidth={3 / viewport.zoom}
                fill="none"
                markerEnd="url(#arrowhead)"
                className="hover:stroke-[url(#tempConnectionGradient)] transition-all duration-300 hover:drop-shadow-lg"
                style={{ pointerEvents: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
              />
            </g>

            <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
              {(() => {
                // 캐시된 미드포인트가 있으면 사용, 없으면 계산된 미드포인트 사용
                const mid = edgeMidpoints[edge.id];
                const displayX = mid ? mid.x : midX;
                const displayY = mid ? mid.y : midY;
                return (
                  <g transform={`translate(${displayX}, ${displayY})`}>
                    <g 
                      className="delete-button opacity-20 group-hover:opacity-100 hover:opacity-100 transition-opacity duration-200"
                      style={{ pointerEvents: 'all', cursor: 'pointer' }}
                      onClick={(e) => handleEdgeDelete(edge.id, e)}
                      onMouseEnter={() => setHoveredEdgeId(edge.id)}
                      onMouseLeave={() => setHoveredEdgeId(null)}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    >
                      <g transform={`scale(${hoveredEdgeId === edge.id ? 1.1 : 1})`}>
                        <circle cx={0} cy={0} r={Math.max(14, 14 / viewport.zoom)} fill="transparent" style={{ pointerEvents: 'all', cursor: 'pointer' }} />
                        <circle cx={0} cy={0} r={Math.max(10, 10 / viewport.zoom)} fill="white" stroke="#EF4444" strokeWidth={Math.max(2, 2 / viewport.zoom)} style={{ pointerEvents: 'none', filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.3))' }} />
                        <g style={{ pointerEvents: 'none' }}>
                          <line x1={Math.max(-4, -4 / viewport.zoom)} y1={Math.max(-4, -4 / viewport.zoom)} x2={Math.max(4, 4 / viewport.zoom)} y2={Math.max(4, 4 / viewport.zoom)} stroke="#EF4444" strokeWidth={Math.max(2, 2 / viewport.zoom)} strokeLinecap="round" />
                          <line x1={Math.max(4, 4 / viewport.zoom)} y1={Math.max(-4, -4 / viewport.zoom)} x2={Math.max(-4, -4 / viewport.zoom)} y2={Math.max(4, 4 / viewport.zoom)} stroke="#EF4444" strokeWidth={Math.max(2, 2 / viewport.zoom)} strokeLinecap="round" />
                        </g>
                      </g>
                    </g>
                  </g>
                );
              })()}
            </g>
          </g>
        );
      })}

      {!isReadOnly && isConnecting && connectionStart && temporaryConnection && (() => {
        const sourceNode = nodes.find((n) => n.id === connectionStart);
        if (!sourceNode) return null;

        const el = typeof document !== 'undefined' ? (document.querySelector(`[data-node-id="${connectionStart}"]`) as HTMLElement | null) : null;
        let nodeWidth = 160;
        let nodeHeight = 80;
        if (el) {
          const rect = el.getBoundingClientRect();
          nodeWidth = rect.width / viewport.zoom;
          nodeHeight = rect.height / viewport.zoom;
        }

        const startAnchor = (connectionStartAnchor as any) || 'right';
        let sourceX = sourceNode.position.x + nodeWidth;
        let sourceY = sourceNode.position.y + nodeHeight / 2;
        if (startAnchor === 'left') {
          sourceX = sourceNode.position.x;
          sourceY = sourceNode.position.y + nodeHeight / 2;
        } else if (startAnchor === 'top') {
          sourceX = sourceNode.position.x + nodeWidth / 2;
          sourceY = sourceNode.position.y;
        } else if (startAnchor === 'bottom') {
          sourceX = sourceNode.position.x + nodeWidth / 2;
          sourceY = sourceNode.position.y + nodeHeight;
        }

        const targetX = temporaryConnection.x;
        const targetY = temporaryConnection.y;

        const isVertical = startAnchor === 'top' || startAnchor === 'bottom';
        let tempPath = '';
        if (!isVertical) {
          const deltaX = targetX - sourceX;
          const controlOffset = Math.max(Math.abs(deltaX) * 0.4, 50);
          const control1X = sourceX + controlOffset;
          const control1Y = sourceY;
          const control2X = targetX - controlOffset;
          const control2Y = targetY;
          tempPath = `M ${sourceX} ${sourceY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${targetX} ${targetY}`;
        } else {
          const deltaY = targetY - sourceY;
          const controlOffset = Math.max(Math.abs(deltaY) * 0.4, 50);
          const control1X = sourceX;
          const control1Y = sourceY + (startAnchor === 'top' ? -controlOffset : controlOffset);
          const control2X = targetX;
          const control2Y = targetY + (startAnchor === 'top' ? -controlOffset : controlOffset);
          tempPath = `M ${sourceX} ${sourceY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${targetX} ${targetY}`;
        }

        return (
          <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
            <path d={tempPath} stroke="rgba(59, 130, 246, 0.3)" strokeWidth={6 / viewport.zoom} fill="none" className="pointer-events-none" />
            <path d={tempPath} stroke="url(#tempConnectionGradient)" strokeWidth={2.5 / viewport.zoom} fill="none" strokeDasharray={`${6 / viewport.zoom},${3 / viewport.zoom}`} markerEnd="url(#temp-arrowhead)" style={{ filter: 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.5))' }} />
            <g>
              <circle cx={targetX} cy={targetY} r={8 / viewport.zoom} fill="rgba(59, 130, 246, 0.2)" />
              <circle cx={targetX} cy={targetY} r={4 / viewport.zoom} fill="url(#tempArrowGradient)" />
            </g>
          </g>
        );
      })()}
    </svg>
  );
}
