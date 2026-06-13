import { useCallback, useEffect, useRef, useState } from 'react'
import flowData from '../../data/flowLayout.json'

interface FlowNode {
  id: string
  label: string
  shape: string
  x: number
  y: number
  w: number
  h: number
  kind: 'node' | 'annotation' | 'connector-label'
}

interface FlowEdge {
  id: string
  source: string
  target: string
  label: string
}

type NodePositions = Record<string, { x: number; y: number }>

const NODES = (flowData.nodes as FlowNode[]).filter((n) => n.kind !== 'connector-label')
const EDGES = flowData.edges as FlowEdge[]

// Mapa de connector-label por id para buscar etiquetas en aristas
const CONNECTOR_LABELS: Record<string, string> = {}
for (const n of flowData.nodes as FlowNode[]) {
  if (n.kind === 'connector-label') {
    CONNECTOR_LABELS[n.id] = n.label
  }
}

// Posiciones originales del JSON
const ORIGINAL_POSITIONS: NodePositions = {}
for (const n of NODES) {
  ORIGINAL_POSITIONS[n.id] = { x: n.x, y: n.y }
}

function getNodeMap(positions: NodePositions): Map<string, FlowNode & { x: number; y: number }> {
  const map = new Map<string, FlowNode & { x: number; y: number }>()
  for (const n of NODES) {
    const pos = positions[n.id] ?? { x: n.x, y: n.y }
    map.set(n.id, { ...n, x: pos.x, y: pos.y })
  }
  return map
}

function edgeMidpoint(
  src: FlowNode & { x: number; y: number },
  tgt: FlowNode & { x: number; y: number },
): { mx: number; my: number; x1: number; y1: number; x2: number; y2: number } {
  const x1 = src.x + src.w / 2
  const y1 = src.y + src.h / 2
  const x2 = tgt.x + tgt.w / 2
  const y2 = tgt.y + tgt.h / 2
  return { mx: (x1 + x2) / 2, my: (y1 + y2) / 2, x1, y1, x2, y2 }
}

function DiamondPath({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const cx = x + w / 2
  const cy = y + h / 2
  const d = `M${cx},${y} L${x + w},${cy} L${cx},${y + h} L${x},${cy} Z`
  return <path d={d} />
}

export default function FlowDiagram() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Viewport transform: pan + zoom
  const [transform, setTransform] = useState({ x: 0, y: 40, scale: 0.12 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  // Node positions (draggable)
  const [positions, setPositions] = useState<NodePositions>({ ...ORIGINAL_POSITIONS })

  // Dragging state
  const draggingId = useRef<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Restore layout
  const handleRestore = useCallback(() => {
    setPositions({ ...ORIGINAL_POSITIONS })
  }, [])

  // ── Pan handlers (on SVG background) ──
  const onBgPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).dataset.nodeid) return
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }, [transform])

  const onBgPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setTransform((t) => ({ ...t, x: panStart.current.tx + dx, y: panStart.current.ty + dy }))
    }
  }, [])

  const onBgPointerUp = useCallback(() => {
    isPanning.current = false
  }, [])

  // ── Wheel zoom ──
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.12 : 0.9
    setTransform((t) => {
      const newScale = Math.max(0.04, Math.min(4, t.scale * factor))
      // Zoom toward cursor
      const scaleChange = newScale / t.scale
      return {
        scale: newScale,
        x: cx - scaleChange * (cx - t.x),
        y: cy - scaleChange * (cy - t.y),
      }
    })
  }, [])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // ── Node drag handlers ──
  const onNodePointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation()
    draggingId.current = nodeId
    const pos = positions[nodeId]
    // Convert screen coords to SVG content coords
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return
    const svgX = (e.clientX - svgRect.left - transform.x) / transform.scale
    const svgY = (e.clientY - svgRect.top - transform.y) / transform.scale
    dragOffset.current = { x: svgX - pos.x, y: svgY - pos.y }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }, [positions, transform])

  const onNodePointerMove = useCallback((e: React.PointerEvent, nodeId: string) => {
    if (draggingId.current !== nodeId) return
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return
    const svgX = (e.clientX - svgRect.left - transform.x) / transform.scale
    const svgY = (e.clientY - svgRect.top - transform.y) / transform.scale
    setPositions((prev) => ({
      ...prev,
      [nodeId]: { x: svgX - dragOffset.current.x, y: svgY - dragOffset.current.y },
    }))
  }, [transform])

  const onNodePointerUp = useCallback(() => {
    draggingId.current = null
  }, [])

  const nodeMap = getNodeMap(positions)

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
        <button
          onClick={handleRestore}
          style={{
            padding: '4px 14px',
            borderRadius: 6,
            background: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-label)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Restaurar layout
        </button>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          Rueda: zoom · Arrastrar fondo: pan · Arrastrar nodo: reposicionar
        </span>
      </div>

      {/* SVG canvas */}
      <svg
        ref={svgRef}
        style={{
          flex: 1,
          background: 'var(--color-bg-panel)',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          cursor: isPanning.current ? 'grabbing' : 'grab',
          userSelect: 'none',
          minHeight: 0,
        }}
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerUp={onBgPointerUp}
        onPointerCancel={onBgPointerUp}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* ── Edges ── */}
          {EDGES.map((edge) => {
            const src = nodeMap.get(edge.source)
            const tgt = nodeMap.get(edge.target)
            if (!src || !tgt) return null
            const { x1, y1, x2, y2, mx, my } = edgeMidpoint(src, tgt)
            const edgeLabel = edge.label || CONNECTOR_LABELS[edge.target] || ''
            return (
              <g key={edge.id}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#4b5563"
                  strokeWidth={3}
                  markerEnd="url(#arrowhead)"
                />
                {edgeLabel && (
                  <g>
                    <rect
                      x={mx - 14} y={my - 9} width={28} height={16}
                      rx={3} fill="#1f2937"
                    />
                    <text
                      x={mx} y={my + 4}
                      textAnchor="middle"
                      fontSize={12}
                      fill="#9ca3af"
                      fontWeight="600"
                    >
                      {edgeLabel}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {/* ── Nodes ── */}
          {NODES.map((n) => {
            const pos = positions[n.id] ?? { x: n.x, y: n.y }
            const isAnnotation = n.kind === 'annotation'
            const isDiamond = n.shape === 'decision'
            const fillColor = isAnnotation ? 'var(--color-annotation-bg)' : '#1e293b'
            const strokeColor = isAnnotation ? '#a16207' : '#374151'
            const textColor = isAnnotation ? 'var(--color-annotation-text)' : '#d1d5db'

            return (
              <g
                key={n.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                style={{ cursor: 'move' }}
                data-nodeid={n.id}
                onPointerDown={(e) => onNodePointerDown(e, n.id)}
                onPointerMove={(e) => onNodePointerMove(e, n.id)}
                onPointerUp={onNodePointerUp}
                onPointerCancel={onNodePointerUp}
              >
                {isDiamond ? (
                  <DiamondPath x={0} y={0} w={n.w} h={n.h} />
                ) : (
                  <rect x={0} y={0} width={n.w} height={n.h} rx={isAnnotation ? 4 : 6} />
                )}
                <style>{`
                  g[data-nodeid="${n.id}"] path,
                  g[data-nodeid="${n.id}"] rect {
                    fill: ${fillColor};
                    stroke: ${strokeColor};
                    stroke-width: 2;
                  }
                `}</style>
                <foreignObject x={4} y={4} width={n.w - 8} height={n.h - 8}>
                  <div
                    // @ts-expect-error xmlns needed for foreignObject
                    xmlns="http://www.w3.org/1999/xhtml"
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isDiamond ? 14 : 13,
                      fontWeight: isDiamond ? 700 : 500,
                      color: textColor,
                      textAlign: 'center',
                      lineHeight: 1.25,
                      overflow: 'hidden',
                      padding: '2px',
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    {n.label.replace(/\\n/g, '\n').split('\n')[0]}
                  </div>
                </foreignObject>
              </g>
            )
          })}

          {/* Arrowhead marker */}
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#4b5563" />
            </marker>
          </defs>
        </g>
      </svg>
    </div>
  )
}
