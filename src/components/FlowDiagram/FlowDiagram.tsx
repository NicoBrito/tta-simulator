import { useCallback, useEffect, useRef, useState } from 'react'
import flowData from '../../data/flowLayout.json'
import { useSimulatorStore } from '../../store/simulatorStore'
import { ALARM_NODE_IDS } from '../../engine'
import type { OutputId } from '../../engine'
import { saveLayout, loadLayout, clearLayout, type NodePositions } from '../../services/layoutStorage'

interface FlowNode {
  id: string; label: string; shape: string
  x: number; y: number; w: number; h: number
  kind: 'node' | 'annotation' | 'connector-label'
}
interface FlowEdge { id: string; source: string; target: string; label: string }

const DIAGRAM_ID = 'default'

const NODES = (flowData.nodes as FlowNode[]).filter((n) => n.kind !== 'connector-label')
const EDGES = flowData.edges as FlowEdge[]

const CONNECTOR_LABELS: Record<string, string> = {}
for (const n of flowData.nodes as FlowNode[]) {
  if (n.kind === 'connector-label') CONNECTOR_LABELS[n.id] = n.label
}

const ORIGINAL_POSITIONS: NodePositions = {}
for (const n of NODES) ORIGINAL_POSITIONS[n.id] = { x: n.x, y: n.y }

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

const OUTCOME_STYLE: Record<string, { icon: string; color: string }> = {
  energizada: { icon: '✓', color: 'var(--energized-deep)' },
  alarma: { icon: '⚠', color: 'var(--fault-deep)' },
  desenergizada: { icon: '○', color: 'var(--text-muted)' },
}

export default function FlowDiagram() {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const flowTrace = useSimulatorStore((s) => s.flowTrace)
  const mode = useSimulatorStore((s) => s.derived.mode)
  const visited = new Set(flowTrace.visited)

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.15 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  const [positions, setPositions] = useState<NodePositions>(
    () => ({ ...ORIGINAL_POSITIONS, ...(loadLayout(DIAGRAM_ID) ?? {}) }),
  )
  const draggingId = useRef<string | null>(null)
  const dragMoved = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

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

  const handleRestore = useCallback(() => {
    clearLayout(DIAGRAM_ID)
    setPositions({ ...ORIGINAL_POSITIONS })
  }, [])

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

  // ── Drag de nodos (con persistencia al soltar) ──
  const onNodeDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    draggingId.current = id
    dragMoved.current = false
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
    dragMoved.current = true
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = (e.clientX - rect.left - transform.x) / transform.scale
    const sy = (e.clientY - rect.top - transform.y) / transform.scale
    setPositions((p) => ({ ...p, [id]: { x: sx - dragOffset.current.x, y: sy - dragOffset.current.y } }))
  }, [transform])

  const onNodeUp = useCallback(() => {
    if (draggingId.current && dragMoved.current) {
      // Guardado perezoso al soltar (docs/08 §3)
      setPositions((p) => { saveLayout(DIAGRAM_ID, p); return p })
    }
    draggingId.current = null
    dragMoved.current = false
  }, [])

  const nodeMap = getNodeMap(positions)

  const btnStyle: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 'var(--r-md)', background: 'var(--bg-surface)',
    border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
    cursor: 'pointer', fontSize: 12, fontWeight: 600, boxShadow: 'var(--shadow-sm)',
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
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

        {/* Estado por salida (camino lógico) */}
        <div style={{ display: 'flex', gap: 10, marginLeft: 8 }}>
          {(['S1', 'S2', 'S3'] as OutputId[]).map((out) => {
            const oc = flowTrace.perOutput[out]?.outcome ?? 'desenergizada'
            const st = OUTCOME_STYLE[oc]
            return (
              <span key={out} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5,
                fontFamily: 'var(--font-mono)', fontWeight: 600, color: st.color,
              }}>
                <span>{st.icon}</span>{out}
              </span>
            )
          })}
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          {mode === 'AUTO'
            ? 'Verde = camino recorrido · Rojo = alarma alcanzada'
            : 'En MANUAL solo se resalta el tramo de modo (el flujo modela la lógica AUTO)'}
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
            <marker id="arrow-on" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
              <polygon points="0 0, 9 3.5, 0 7" fill="var(--energized)" />
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
              const active = visited.has(edge.source) && visited.has(edge.target)
              return (
                <g key={edge.id} opacity={active ? 1 : 0.3}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={active ? 'var(--energized)' : 'var(--dead)'}
                    strokeWidth={active ? 4 : 2.5}
                    markerEnd={active ? 'url(#arrow-on)' : 'url(#arrow)'} />
                  {label && (
                    <g>
                      <rect x={mx - 16} y={my - 11} width={32} height={20} rx={5}
                        fill="var(--bg-surface)" stroke={active ? 'var(--energized)' : 'var(--border-strong)'} strokeWidth={1} />
                      <text x={mx} y={my + 4} textAnchor="middle" fontSize={13} fontWeight={700}
                        fill={active ? 'var(--energized-deep)' : 'var(--text-secondary)'} fontFamily="var(--font-mono)">{label}</text>
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
              const isVisited = visited.has(n.id)
              const isAlarm = isVisited && ALARM_NODE_IDS.has(n.id)

              let fill: string, stroke: string, text: string, opacity = 1
              if (isAnnotation) {
                fill = 'var(--warn-tint)'; stroke = 'var(--warn)'; text = 'var(--warn)'
              } else if (isAlarm) {
                fill = 'var(--fault-tint)'; stroke = 'var(--fault)'; text = 'var(--fault-deep)'
              } else if (isVisited) {
                fill = 'var(--energized-tint)'; stroke = 'var(--energized)'; text = 'var(--energized-deep)'
              } else {
                fill = 'var(--bg-surface)'; stroke = 'var(--border-strong)'; text = 'var(--text-secondary)'
                opacity = 0.4
              }

              return (
                <g key={n.id} transform={`translate(${pos.x}, ${pos.y})`} style={{ cursor: 'move' }}
                  opacity={opacity} data-nodeid={n.id}
                  onPointerDown={(e) => onNodeDown(e, n.id)}
                  onPointerMove={(e) => onNodeMove(e, n.id)}
                  onPointerUp={onNodeUp} onPointerCancel={onNodeUp}>
                  {isDiamond
                    ? <g style={{ pointerEvents: 'all' }}><DiamondPath w={n.w} h={n.h} /></g>
                    : <rect width={n.w} height={n.h} rx={isAnnotation ? 4 : 8} />}
                  <style>{`
                    g[data-nodeid="${n.id}"] > rect, g[data-nodeid="${n.id}"] path {
                      fill: ${fill}; stroke: ${stroke}; stroke-width: ${isVisited ? 3 : 2};
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
