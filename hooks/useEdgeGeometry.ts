import { useCallback } from "react";
import type { FlowNode, FlowEdge } from "@/types/canvas";

/**
 * useEdgeGeometry - 엣지의 곡선 경로와 제어점을 계산하는 훅
 *
 * 주요 역할:
 * 1. 소스/타깃 노드의 앵커 포인트 계산
 * 2. 수평/수직 연결에 따른 베지어 제어점 계산
 * 3. 경로 문자열과 미드포인트 계산에 필요한 좌표 반환
 *
 * 핵심 특징:
 * - viewportZoom을 고려해 두께/오프셋 보정
 * - DOM 측정을 통한 실제 노드 크기 반영 (fallback 존재)
 * - 멀티 연결 시 간격 오프셋 적용
 *
 * 주의사항:
 * - DOM 측정은 브라우저 환경에서만 동작하므로 서버 사이드 렌더링 시 fallback 크기를 사용
 */
export function useEdgeGeometry(viewportZoom: number) {
  const computeEdgeGeometry = useCallback((edge: FlowEdge, nodes: FlowNode[], edges: FlowEdge[]) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return null;

    const measureNodeSize = (id: string) => {
      const el = typeof document !== 'undefined' ? (document.querySelector(`[data-node-id="${id}"]`) as HTMLElement | null) : null;
      if (el) {
        const rect = el.getBoundingClientRect();
        return { width: rect.width / viewportZoom, height: rect.height / viewportZoom };
      }
      return { width: 160, height: 80 };
    };

    const srcSize = measureNodeSize(sourceNode.id);
    const tgtSize = measureNodeSize(targetNode.id);

    const sourceAnchor = ((edge.data as any)?.sourceAnchor as 'left' | 'right' | 'top' | 'bottom') || 'right';
    const targetAnchor = ((edge.data as any)?.targetAnchor as 'left' | 'right' | 'top' | 'bottom') || 'left';

    const getAnchorPoint = (n: FlowNode, a: 'left' | 'right' | 'top' | 'bottom') => {
      const size = n.id === sourceNode.id ? srcSize : tgtSize;
      switch (a) {
        case 'left': return { x: n.position.x, y: n.position.y + size.height / 2 };
        case 'right': return { x: n.position.x + size.width, y: n.position.y + size.height / 2 };
        case 'top': return { x: n.position.x + size.width / 2, y: n.position.y };
        case 'bottom': return { x: n.position.x + size.width / 2, y: n.position.y + size.height };
      }
    };

    const { x: sourceX, y: sourceY } = getAnchorPoint(sourceNode, sourceAnchor)!;
    const { x: targetX, y: targetY } = getAnchorPoint(targetNode, targetAnchor)!;

    const isVertical = sourceAnchor === 'top' || sourceAnchor === 'bottom' || targetAnchor === 'top' || targetAnchor === 'bottom';

    // Multi-connection offset: vertical edges offset horizontally, horizontal edges offset vertically
    const connectionsFromSameAnchor = edges.filter(e => e.source === edge.source && ((((e.data as any)?.sourceAnchor) || 'right') === sourceAnchor));
    const connectionIndex = connectionsFromSameAnchor.findIndex(e => e.id === edge.id);
    const offsetAmount = (connectionIndex - (connectionsFromSameAnchor.length - 1) / 2) * 15;
    const offsetX = isVertical ? offsetAmount : 0;
    const offsetY = isVertical ? 0 : offsetAmount;

    if (!isVertical) {
      const deltaX = targetX - sourceX;
      const controlOffset = Math.max(Math.abs(deltaX) * 0.4, 50);
      const control1X = sourceX + controlOffset;
      const control1Y = sourceY + offsetY;
      const control2X = targetX - controlOffset;
      const control2Y = targetY;
      const path = `M ${sourceX} ${sourceY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${targetX} ${targetY}`;
      return { path, sourceX, sourceY, targetX, targetY, control1X, control1Y, control2X, control2Y };
    } else {
      const deltaY = targetY - sourceY;
      const controlOffset = Math.max(Math.abs(deltaY) * 0.4, 50);
      const control1X = sourceX + offsetX;
      const control1Y = sourceY + (sourceAnchor === 'top' ? -controlOffset : controlOffset);
      const control2X = targetX + offsetX;
      const control2Y = targetY + (targetAnchor === 'top' ? -controlOffset : controlOffset);
      const path = `M ${sourceX} ${sourceY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${targetX} ${targetY}`;
      return { path, sourceX, sourceY, targetX, targetY, control1X, control1Y, control2X, control2Y };
    }
  }, [viewportZoom]);

  const generatePath = useCallback((edge: FlowEdge, nodes: FlowNode[], edges: FlowEdge[]) => {
    const geom = computeEdgeGeometry(edge, nodes, edges);
    return geom ? geom.path : "";
  }, [computeEdgeGeometry]);

  return { computeEdgeGeometry, generatePath };
}
