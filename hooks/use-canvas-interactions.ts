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
  // 드래그 중 실시간 위치를 외부에서 참조할 수 있도록 보관 (엣지 동기화용)
  const livePositionsRef = useRef<Record<string, Point>>({})
  // 포인터 기반 제어 플래그 및 보조키 상태
  const pointerActiveRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const captureTargetRef = useRef<EventTarget | null>(null)
  const shiftDownRef = useRef(false)
  // 포인터 업 직후 발생하는 마우스 업 중복 처리 플래그
  const upHandledByPointerRef = useRef(false)
  // 단순 그리드 스냅(Shift로 활성화)
  const GRID_SIZE = 20
  const applyGridSnap = (x: number, y: number) => {
    if (!shiftDownRef.current) return { x, y }
    const sx = Math.round(x / GRID_SIZE) * GRID_SIZE
    const sy = Math.round(y / GRID_SIZE) * GRID_SIZE
    return { x: sx, y: sy }
  }

  // 드래그 임계값 관련 상태
  const isDragStartedRef = useRef(false)
  const DRAG_THRESHOLD = 5 // 5픽셀 이상 움직여야 드래그 시작

  // 헬퍼: 노드 DOM 엘리먼트 조회
  const getNodeElement = (nodeId: string): HTMLElement | null => {
    return canvasRef.current?.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null
  }

  // 드래그 중 RAF 루프
  const runDragLoop = useCallback(() => {
    if (!isDraggingRef.current || !draggedNodeIdRef.current || !isDragStartedRef.current) return
    const nodeEl = getNodeElement(draggedNodeIdRef.current)
    if (!nodeEl) return

    // 화면 기준 마우스 이동량
    const deltaX = latestMouseRef.current.x - dragStartMouseRef.current.x
    const deltaY = latestMouseRef.current.y - dragStartMouseRef.current.y

    // 줌 반영하여 실제 좌표 이동량 계산
    let newX = originalNodePosRef.current.x + deltaX / viewport.zoom
    let newY = originalNodePosRef.current.y + deltaY / viewport.zoom
    const snapped = applyGridSnap(newX, newY)
    newX = snapped.x
    newY = snapped.y

    // transform 기반 하드웨어 가속 이동
    nodeEl.style.transform = `translate3d(${newX}px, ${newY}px, 0)`
    // 실시간 위치 공개 (엣지 경로 동기화에서 사용)
    livePositionsRef.current[draggedNodeIdRef.current] = { x: newX, y: newY }

    rafIdRef.current = window.requestAnimationFrame(runDragLoop)
  }, [viewport.zoom])

  // 전역 마우스 무브/업 핸들러
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isReadOnly) return
      if (pointerActiveRef.current) return // 포인터 사용 중엔 무시
      shiftDownRef.current = e.shiftKey
      if (isPanningRef.current) {
        const deltaX = e.clientX - panStartRef.current.x
        const deltaY = e.clientY - panStartRef.current.y
        setViewport({ x: lastPanPointRef.current.x + deltaX, y: lastPanPointRef.current.y + deltaY, zoom: viewport.zoom })
        return
      }
      if (isDraggingRef.current && draggedNodeIdRef.current) {
        latestMouseRef.current = { x: e.clientX, y: e.clientY }
        
        // 드래그 임계값 체크
        if (!isDragStartedRef.current) {
          const deltaX = Math.abs(e.clientX - dragStartMouseRef.current.x)
          const deltaY = Math.abs(e.clientY - dragStartMouseRef.current.y)
          
          if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
            isDragStartedRef.current = true
            // 실제 드래그 시작 - 노드에 드래그 스타일 적용
            const nodeEl = getNodeElement(draggedNodeIdRef.current)
            if (nodeEl) {
              nodeEl.classList.add('cursor-grabbing')
              nodeEl.style.zIndex = '20'
            }
          }
        }
        
        // 드래그가 시작된 경우에만 RAF 루프 실행
        if (isDragStartedRef.current && rafIdRef.current === null) {
          rafIdRef.current = window.requestAnimationFrame(runDragLoop)
        }
      }
    }

    const onMouseUp = () => {
      if (isReadOnly) return
      if (isDraggingRef.current && draggedNodeIdRef.current) {
        // 실제로 드래그가 시작된 경우에만 위치 업데이트
        if (isDragStartedRef.current) {
          const deltaX = latestMouseRef.current.x - dragStartMouseRef.current.x
          const deltaY = latestMouseRef.current.y - dragStartMouseRef.current.y
          const finalX = originalNodePosRef.current.x + deltaX / viewport.zoom
          const finalY = originalNodePosRef.current.y + deltaY / viewport.zoom

          const nodeId = draggedNodeIdRef.current
          setNodePositions(prev => ({ ...prev, [nodeId!]: { x: finalX, y: finalY } }))
          triggerSave('drag-end', true)
        }

        // 드래그 스타일 정리
        const nodeEl = getNodeElement(draggedNodeIdRef.current)
        if (nodeEl) {
          nodeEl.classList.remove('cursor-grabbing')
          nodeEl.style.zIndex = ''
          nodeEl.style.willChange = ''
          nodeEl.style.transition = ''
        }
      }

      // 모든 드래그 관련 상태 초기화
      isDraggingRef.current = false
      isDragStartedRef.current = false
      if (draggedNodeIdRef.current) {
        delete livePositionsRef.current[draggedNodeIdRef.current]
      }
      pointerActiveRef.current = false
      pointerIdRef.current = null
      draggedNodeIdRef.current = null
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      isPanningRef.current = false
    }

    document.addEventListener('mousemove', onMouseMove)
    // 포인터 업 후 이어지는 마우스 업 이벤트는 무시하여 중복 저장 방지
    const onMouseUpEvent = () => {
      if (upHandledByPointerRef.current) {
        upHandledByPointerRef.current = false
        return
      }
      onMouseUp()
    }
    document.addEventListener('mouseup', onMouseUpEvent)
    // 포인터 이벤트(우선)
    const onPointerMove = (e: PointerEvent) => {
      if (isReadOnly) return
      if (!pointerActiveRef.current) return
      shiftDownRef.current = e.shiftKey
      // 패닝 처리 (포인터 기반)
      if (isPanningRef.current) {
        const deltaX = e.clientX - panStartRef.current.x
        const deltaY = e.clientY - panStartRef.current.y
        setViewport({
          x: lastPanPointRef.current.x + deltaX,
          y: lastPanPointRef.current.y + deltaY,
          zoom: viewport.zoom,
        })
        return
      }
      latestMouseRef.current = { x: e.clientX, y: e.clientY }
      if (!isDragStartedRef.current && isDraggingRef.current) {
        const dx = Math.abs(e.clientX - dragStartMouseRef.current.x)
        const dy = Math.abs(e.clientY - dragStartMouseRef.current.y)
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          isDragStartedRef.current = true
          const nodeEl = draggedNodeIdRef.current ? getNodeElement(draggedNodeIdRef.current) : null
          if (nodeEl) {
            nodeEl.classList.add('cursor-grabbing')
            nodeEl.style.zIndex = '20'
          }
          // 실제 드래그 시작 시에만 포인터 캡처 (클릭/작은 이동 방해 방지)
          if (pointerIdRef.current != null) {
            const tgt = captureTargetRef.current as any
            try { tgt?.setPointerCapture?.(pointerIdRef.current) } catch {}
          }
        }
      }
      if (isDragStartedRef.current && rafIdRef.current === null) {
        rafIdRef.current = window.requestAnimationFrame(runDragLoop)
      }
    }
    const onPointerUp = (_e: PointerEvent) => {
      // 포인터 캡처 해제 (안전)
      if (pointerIdRef.current != null) {
        const tgt = captureTargetRef.current as any
        try { tgt?.releasePointerCapture?.(pointerIdRef.current) } catch {}
      }
      captureTargetRef.current = null
      // 이후 이어질 mouseup은 무시되도록 플래그 설정
      upHandledByPointerRef.current = true
      onMouseUp()
    }
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUpEvent)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
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

  // 포인터 기반 패닝 시작 (fallback: 마우스 핸들러 유지)
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (isReadOnly) return
    const target = e.target as HTMLElement
    if (target.closest('[data-node]') || target.closest('[data-memo-id]')) return
    isPanningRef.current = true
    panStartRef.current = { x: e.clientX, y: e.clientY }
    lastPanPointRef.current = { x: viewport.x, y: viewport.y }
    pointerActiveRef.current = true
    pointerIdRef.current = e.pointerId
    captureTargetRef.current = e.currentTarget
    e.preventDefault()
  }, [isReadOnly, viewport.x, viewport.y])

  // 노드 드래그 시작
  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (isReadOnly) return
    e.stopPropagation()
    
    // 드래그 관련 상태 초기화
    draggedNodeIdRef.current = nodeId
    isDraggingRef.current = true
    isDragStartedRef.current = false // 아직 실제 드래그는 시작되지 않음
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY }
    latestMouseRef.current = { x: e.clientX, y: e.clientY }

    const node = nodes.find(n => n.id === nodeId)
    const base = node?.position ?? { x: 0, y: 0 }
    originalNodePosRef.current = base

    // 초기 transform을 현재 위치로 설정하여 누락 방지
    const el = getNodeElement(nodeId)
    if (el) {
      el.style.willChange = 'transform'
      el.style.transition = 'none'
      el.style.transform = `translate3d(${base.x}px, ${base.y}px, 0)`
    }
  }, [isReadOnly, nodes])

  // 포인터 기반 드래그 시작 (fallback으로 마우스도 유지)
  const handleNodePointerDown = useCallback((nodeId: string, e: React.PointerEvent) => {
    if (isReadOnly) return
    e.stopPropagation()
    pointerActiveRef.current = true
    pointerIdRef.current = e.pointerId
    captureTargetRef.current = e.currentTarget

    draggedNodeIdRef.current = nodeId
    isDraggingRef.current = true
    isDragStartedRef.current = false
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY }
    latestMouseRef.current = { x: e.clientX, y: e.clientY }

    const node = nodes.find(n => n.id === nodeId)
    const base = node?.position ?? { x: 0, y: 0 }
    originalNodePosRef.current = base

    const el = getNodeElement(nodeId)
    if (el) {
      el.style.willChange = 'transform'
      el.style.transition = 'none'
      el.style.transform = `translate3d(${base.x}px, ${base.y}px, 0)`
    }
  }, [isReadOnly, nodes])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    // 10% 단위 줌 조정, 50%~200% 범위 제한
    const STEP = 0.1
    const MIN_ZOOM = 0.5 // 최소 50%
    const MAX_ZOOM = 2.0 // 최대 200%
    const direction = e.deltaY > 0 ? -1 : 1 // down: zoom out, up: zoom in
    const target = viewport.zoom + direction * STEP
    const quantized = Math.round(target * 10) / 10
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, quantized))

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
    // 포인터 기반 패닝/드래그 시작 (옵션)
    handleCanvasPointerDown,
    handleNodeMouseDown,
    handleNodePointerDown,
    handleWheel,
    livePositionsRef,
  }
}
