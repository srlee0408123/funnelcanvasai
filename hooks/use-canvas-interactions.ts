/**
 * use-canvas-interactions.ts - 캔버스 상호작용(패닝/드래그/줌) 성능 최적화 훅
 * 
 * 주요 역할:
 * 1. requestAnimationFrame 기반으로 DOM transform을 직접 업데이트하여 드래그 성능 극대화
 * 2. 드래그 종료 시에만 Zustand 스토어에 최종 위치 반영(불필요 리렌더 제거)
 * 3. 패닝/줌/노드 연결 등 캔버스 상호작용 핸들러 제공
 * 
 * 핵심 특징:
 * - 드래그 중 React 상태 업데이트 금지 → GPU 가속 transform 사용
 * - 스로틀 없이 RAF 루프에서 계산, 프레임 스킵 최소화
 * - 뷰포트 변환(viewport x/y/zoom)과 일관되게 좌표 계산
 * 
 * 주의사항:
 * - 노드 요소에는 data-node 및 data-node-id 속성이 있어야 함
 * - 노드 기본 위치는 store.nodePositions 또는 node.position에서 읽음
 * - 마우스 업 시 triggerSave 호출로 서버 동기화
 */

import { useCallback, useEffect, useRef } from 'react'
import type { Viewport } from '@/hooks/useCanvasStore'

type Point = { x: number; y: number }

interface UseCanvasInteractionsParams {
  canvasRef: React.RefObject<HTMLDivElement>
  viewport: Viewport
  setViewport: (v: Viewport) => void
  nodes: Array<{ id: string; position: Point }>
  setNodePositions: (next: Record<string, Point> | ((prev: Record<string, Point>) => Record<string, Point>)) => void
  triggerSave: (reason: string, immediate?: boolean) => void
  isReadOnly?: boolean
}

export function useCanvasInteractions({
  canvasRef,
  viewport,
  setViewport,
  nodes,
  setNodePositions,
  triggerSave,
  isReadOnly = false,
}: UseCanvasInteractionsParams) {
  const isPanningRef = useRef(false)
  const panStartRef = useRef<Point>({ x: 0, y: 0 })
  const lastPanPointRef = useRef<Point>({ x: 0, y: 0 })

  const isDraggingRef = useRef(false)
  const draggedNodeIdRef = useRef<string | null>(null)
  const dragStartMouseRef = useRef<Point>({ x: 0, y: 0 })
  const originalNodePosRef = useRef<Point>({ x: 0, y: 0 })
  const rafIdRef = useRef<number | null>(null)
  const latestMouseRef = useRef<Point>({ x: 0, y: 0 })

  // 헬퍼: 노드 DOM 엘리먼트 조회
  const getNodeElement = (nodeId: string): HTMLElement | null => {
    return canvasRef.current?.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null
  }

  // 드래그 중 RAF 루프
  const runDragLoop = useCallback(() => {
    if (!isDraggingRef.current || !draggedNodeIdRef.current) return
    const nodeEl = getNodeElement(draggedNodeIdRef.current)
    if (!nodeEl) return

    // 화면 기준 마우스 이동량
    const deltaX = latestMouseRef.current.x - dragStartMouseRef.current.x
    const deltaY = latestMouseRef.current.y - dragStartMouseRef.current.y

    // 줌 반영하여 실제 좌표 이동량 계산
    const newX = originalNodePosRef.current.x + deltaX / viewport.zoom
    const newY = originalNodePosRef.current.y + deltaY / viewport.zoom

    // transform 기반 하드웨어 가속 이동
    nodeEl.style.transform = `translate(${newX}px, ${newY}px)`

    rafIdRef.current = window.requestAnimationFrame(runDragLoop)
  }, [viewport.zoom])

  // 전역 마우스 무브/업 핸들러
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isReadOnly) return
      if (isPanningRef.current) {
        const deltaX = e.clientX - panStartRef.current.x
        const deltaY = e.clientY - panStartRef.current.y
        setViewport({ x: lastPanPointRef.current.x + deltaX, y: lastPanPointRef.current.y + deltaY, zoom: viewport.zoom })
        return
      }
      if (isDraggingRef.current) {
        latestMouseRef.current = { x: e.clientX, y: e.clientY }
        if (rafIdRef.current === null) {
          rafIdRef.current = window.requestAnimationFrame(runDragLoop)
        }
      }
    }

    const onMouseUp = () => {
      if (isReadOnly) return
      if (isDraggingRef.current && draggedNodeIdRef.current) {
        // 최종 좌표 계산 후 Zustand에 1회 반영
        const deltaX = latestMouseRef.current.x - dragStartMouseRef.current.x
        const deltaY = latestMouseRef.current.y - dragStartMouseRef.current.y
        const finalX = originalNodePosRef.current.x + deltaX / viewport.zoom
        const finalY = originalNodePosRef.current.y + deltaY / viewport.zoom

        const nodeId = draggedNodeIdRef.current
        setNodePositions(prev => ({ ...prev, [nodeId!]: { x: finalX, y: finalY } }))
        triggerSave('drag-end', true)
      }

      isDraggingRef.current = false
      draggedNodeIdRef.current = null
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      isPanningRef.current = false
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isReadOnly, runDragLoop, setNodePositions, setViewport, triggerSave, viewport.zoom])

  // 캔버스 배경에서 패닝 시작
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (isReadOnly) return
    const target = e.target as HTMLElement
    if (target.closest('[data-node]') || target.closest('[data-memo-id]')) return
    isPanningRef.current = true
    panStartRef.current = { x: e.clientX, y: e.clientY }
    lastPanPointRef.current = { x: viewport.x, y: viewport.y }
    e.preventDefault()
  }, [isReadOnly, viewport.x, viewport.y])

  // 노드 드래그 시작
  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (isReadOnly) return
    e.stopPropagation()
    draggedNodeIdRef.current = nodeId
    isDraggingRef.current = true
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY }

    const node = nodes.find(n => n.id === nodeId)
    const base = node?.position ?? { x: 0, y: 0 }
    originalNodePosRef.current = base

    // 초기 transform을 현재 위치로 설정하여 누락 방지
    const el = getNodeElement(nodeId)
    if (el) {
      el.style.willChange = 'transform'
      el.style.transform = `translate(${base.x}px, ${base.y}px)`
    }
  }, [isReadOnly, nodes])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.1, Math.min(3, viewport.zoom * delta))
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const centerX = e.clientX - rect.left
      const centerY = e.clientY - rect.top
      const zoomRatio = newZoom / viewport.zoom
      const newX = centerX - (centerX - viewport.x) * zoomRatio
      const newY = centerY - (centerY - viewport.y) * zoomRatio
      setViewport({ x: newX, y: newY, zoom: newZoom })
    }
  }, [canvasRef, setViewport, viewport.x, viewport.y, viewport.zoom])

  return {
    handleCanvasMouseDown,
    handleNodeMouseDown,
    handleWheel,
  }
}


