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

const CONNECTOR_LABELS: Record<string, string> = {}
for (const n of flowData.nodes as FlowNode[]) {
  if (n.kind === 'connector-label') CONNECTOR_LABELS[n.id] = n.label
}

const ORIGINAL_POSITIONS: NodePositions = {}
for (const n of NODES) ORIGINAL_POSITIONS[n.id] = { x: n.x, y: n.y }

// Bounding box de todos los nodos (para ajustar la vista)
const BBOX = (() => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of NODES) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h)
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
})()

function getNodeMap(positions: NodePositions) {
  const map = new Map<string, FlowNode & { x: number; y: number }>()
  for (const n of NODES) {
    const pos = positions[n.id] ?? { x: n.x, y: n.y }
    map.set(n.id, { ...n, x: pos.x, y: pos.y })
  }
  return map
}

function cleanLabel(label: string): string {
  return label.replace(/\\n/g, ' ').replace(/\n/g, ' ').trim()
}

function DiamondPath({ w, h }: { w: number; h: number }) {
  const cx = w / 2, cy = h / 2
  return <path d={`M${cx},0 L${w},${cy} L${cx},${h} L0,${cy} Z`} />
}

export default function FlowDiagram() {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.15 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  const [positions, setPositions] = useState<NodePositions>({ ...ORIGINAL_POSITIONS })
  const draggingId = useRef<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Ajusta la vista para encuadrar todo el diagrama
  const fitView = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const pad = 0.86
    const scale = Math.min(rect.width / BBOX.w, rect.height / BBOX.h) * pad
    const x = (rect.width - BBOX.w * scale) / 2 - BBOX.minX * scale
    const y = (rect.height - BBOX.h * scale) / 2 - BBOX.minY * scale
    setTransform({ x, y, scale })
  }, [])

  useEffect(() => { fitView() }, [fitView])

  const handleRestore = useCallback(() => setPositions({ ...ORIGINAL_POSITIONS }), [])

  // ── Pan ──
  const onBgPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).dataset.nodeid) return
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }, [transform])

  const onBgPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPanning.current) return
    setTransform((t) => ({
      ...t,
      x: panStart.current.tx + (e.clientX - panStart.current.x),
      y: panStart.current.ty + (e.clientY - panStart.current.y),
    }))
  }, [])

  const onBgPointerUp = useCallback(() => { isPanning.current = false }, [])

  // ── Zoom ──
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.12 : 0.9
    setTransform((t) => {
      const ns = Math.max(0.04, Math.min(3, t.scale * factor))
      const k = ns / t.scale
      return { scale: ns, x: cx - k * (cx - t.x), y: cy - k * (cy - t.y) }
    })
  }, [])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // ── Drag de nodos ──
  const onNodeDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    draggingId.current = id
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = (e.clientX - rect.left - transform.x) / transform.scale
    const sy = (e.clientY - rect.top - transform.y) / transform.scale
    const pos = positions[id]
    dragOffset.current = { x: sx - pos.x, y: sy - pos.y }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }, [positions, transform])

  const onNodeMove = useCallback((e: React.PointerEvent, id: string) => {
    if (draggingId.current !== id) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = (e.clientX - rect.left - transform.x) / transform.scale
    const sy = (e.clientY - rect.top - transform.y) / transform.scale
    setPositions((p) => ({ ...p, [id]: { x: sx - dragOffset.current.x, y: sy - dragOffset.current.y } }))
  }, [transform])

  const onNodeUp = useCallback(() => { draggingId.current = null }, [])

  const nodeMap = getNodeMap(positions)

  const btnStyle: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 'var(--r-md)', background: 'var(--bg-surface)',
    border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
    cursor: 'pointer', fontSize: 12, fontWeight: 600, boxShadow: 'var(--shadow-sm)',
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', gap: 0,
      background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-inset)',
      }}>
        <button onClick={fitView} style={btnStyle}>⊡ Centrar vista</button>
        <button onClick={handleRestore} style={btnStyle}>↺ Restaurar layout</button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
          Rueda: zoom · arrastrar fondo: desplazar · arrastrar nodo: reposicionar
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {NODES.length} nodos · {EDGES.length} aristas
        </span>
      </div>

      {/* Lienzo */}
      <div ref={wrapRef} style={{ flex: 1, minHeight: 0 }}>
        <svg ref={svgRef} className="tta-flow-canvas"
          style={{ width: '100%', height: '100%', cursor: 'grab', userSelect: 'none', fontFamily: 'var(--font-sans)' }}
          onPointerDown={onBgPointerDown} onPointerMove={onBgPointerMove}
          onPointerUp={onBgPointerUp} onPointerCancel={onBgPointerUp}>

          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
              <polygon points="0 0, 9 3.5, 0 7" fill="var(--dead)" />
            </marker>
          </defs>

          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {/* Aristas */}
            {EDGES.map((edge) => {
              const src = nodeMap.get(edge.source)
              const tgt = nodeMap.get(edge.target)
              if (!src || !tgt) return null
              const x1 = src.x + src.w / 2, y1 = src.y + src.h / 2
              const x2 = tgt.x + tgt.w / 2, y2 = tgt.y + tgt.h / 2
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
              const label = edge.label || CONNECTOR_LABELS[edge.target] || ''
              return (
                <g key={edge.id}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--dead)" strokeWidth={2.5} markerEnd="url(#arrow)" />
                  {label && (
                    <g>
                      <rect x={mx - 16} y={my - 11} width={32} height={20} rx={5}
                        fill="var(--bg-surface)" stroke="var(--border-strong)" strokeWidth={1} />
                      <text x={mx} y={my + 4} textAnchor="middle" fontSize={13} fontWeight={700}
                        fill="var(--text-secondary)" fontFamily="var(--font-mono)">{label}</text>
                    </g>
                  )}
                </g>
              )
            })}

            {/* Nodos */}
            {NODES.map((n) => {
              const pos = positions[n.id] ?? { x: n.x, y: n.y }
              const isAnnotation = n.kind === 'annotation'
              const isDiamond = n.shape === 'decision'
              const fill = isAnnotation ? 'var(--warn-tint)' : isDiamond ? 'var(--brand-tint)' : 'var(--bg-surface)'
              const stroke = isAnnotation ? 'var(--warn)' : isDiamond ? 'var(--brand)' : 'var(--border-strong)'
              const text = isAnnotation ? 'var(--warn)' : 'var(--text-primary)'
              return (
                <g key={n.id} transform={`translate(${pos.x}, ${pos.y})`} style={{ cursor: 'move' }}
                  data-nodeid={n.id}
                  onPointerDown={(e) => onNodeDown(e, n.id)}
                  onPointerMove={(e) => onNodeMove(e, n.id)}
                  onPointerUp={onNodeUp} onPointerCancel={onNodeUp}>
                  {isDiamond
                    ? <g style={{ pointerEvents: 'all' }}><DiamondPath w={n.w} h={n.h} /></g>
                    : <rect width={n.w} height={n.h} rx={isAnnotation ? 4 : 8} />}
                  <style>{`
                    g[data-nodeid="${n.id}"] > rect, g[data-nodeid="${n.id}"] path {
                      fill: ${fill}; stroke: ${stroke}; stroke-width: 2;
                    }
                  `}</style>
                  <foreignObject x={6} y={4} width={n.w - 12} height={n.h - 8} style={{ pointerEvents: 'none' }}>
                    <div style={{
                      width: '100%', height: '100%',
                      display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: isDiamond ? 14 : 12.5, fontWeight: isDiamond ? 700 : 500,
                      color: text, textAlign: 'center', lineHeight: 1.2, overflow: 'hidden',
                      fontFamily: 'var(--font-sans)',
                    } as React.CSSProperties}>
                      {cleanLabel(n.label)}
                    </div>
                  </foreignObject>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}
