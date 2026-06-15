import { useSimulatorStore } from '../../store/simulatorStore'
import { isAvailablePure, getContactorId } from '../../engine'
import type { SourceId, OutputId, ContactorState, EngineInputs } from '../../engine'

// ── Tokens ──────────────────────────────────────────────────────────────────
const C_ON = 'var(--energized)'
const C_ON_FLOW = '#bdf0d3'
const C_DEAD = 'var(--dead)'
const C_FAULT = 'var(--fault)'
const C_SURFACE = 'var(--bg-surface)'
const C_INSET = 'var(--bg-inset)'
const C_TEXT = 'var(--text-primary)'
const C_MUTED = 'var(--text-muted)'
const C_SEC = 'var(--text-secondary)'
const C_BORDER = 'var(--border)'

// ── Layout ──────────────────────────────────────────────────────────────────
const COL: Record<SourceId, number> = { P: 165, A: 385, B: 605 }
const ROW: Record<OutputId, number> = { S1: 305, S2: 410, S3: 515 }
const BUS_Y = 195
const OUT_OFF = 34
const CB_Y = 78

const SOURCE_NAMES: Record<SourceId, string> = { P: 'PRINCIPAL', A: 'DB A', B: 'DB B' }
const SOURCE_SUB: Record<SourceId, string> = { P: 'Ducto Territoria', A: 'Enel — Ducto A', B: 'Enel — Ducto B' }
const CB_NAMES: Record<SourceId, string> = { P: 'CB1', A: 'CB2', B: 'CB3' }
const OUTPUT_AMPS: Record<OutputId, string> = { S1: '100 A', S2: '25 A', S3: '10 A' }
const OUTPUT_NAME: Record<OutputId, string> = { S1: 'TDAF y Comp.', S2: 'Comp. Respaldada', S3: 'Ilum. Emergencia' }

const FONT_MONO = "'IBM Plex Mono', monospace"

// ── Primitivos SVG ────────────────────────────────────────────────────────────

type WireStatus = 'on' | 'off' | 'fault'

function wireColor(s: WireStatus): string {
  return s === 'on' ? C_ON : s === 'fault' ? C_FAULT : C_DEAD
}

// Conductor con corriente animada cuando está energizado
function Wire({ x1, y1, x2, y2, status, w = 3 }: {
  x1: number; y1: number; x2: number; y2: number; status: WireStatus; w?: number
}) {
  const color = wireColor(status)
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" />
      {status === 'on' && (
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C_ON_FLOW} strokeWidth={w - 1}
          strokeLinecap="round" className="tta-conductor-flow" />
      )}
    </g>
  )
}

function AlarmRing({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <circle cx={cx} cy={cy} r={r} className="tta-alarm-ring" />
}

export default function SingleLineDiagram() {
  const inputs = useSimulatorStore((s) => s.inputs)
  const derived = useSimulatorStore((s) => s.derived)
  const transitioning = useSimulatorStore((s) => s.transitioning)
  const toggleSourceUpstream = useSimulatorStore((s) => s.toggleSourceUpstream)
  const toggleBreaker = useSimulatorStore((s) => s.toggleBreaker)
  const toggleOutputAsymmetry = useSimulatorStore((s) => s.toggleOutputAsymmetry)
  const toggleManualContactor = useSimulatorStore((s) => s.toggleManualContactor)

  const { contactors, connected, energized } = derived
  const manual = inputs.modeSelector !== 'AUTO'

  // ── Derivaciones de estado ──
  const srcAvailable = (src: SourceId) => isAvailablePure(inputs, src)
  const srcFault = (src: SourceId) => {
    const s = inputs.sources[src]
    return s.breakerTrip || !s.asymmetryOk
  }
  const srcStatus = (src: SourceId): WireStatus => {
    if (srcFault(src)) return 'fault'
    return srcAvailable(src) ? 'on' : 'off'
  }

  const colStatus = (out: OutputId, src: SourceId): WireStatus => {
    const km = getContactorId(out, src)
    if (!km) return 'off'
    if (contactors[km] === 'falla') return 'fault'
    return srcAvailable(src) ? 'on' : 'off'
  }

  const outStatus = (out: OutputId): WireStatus => {
    if (energized[out]) return 'on'
    if (!inputs.outputs[out].outputAsymmetryOk && connected[out] !== null) return 'fault'
    return 'off'
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: C_SURFACE, borderRadius: 'var(--r-lg)', border: `1px solid ${C_BORDER}`,
      boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
    }}>
      {/* Encabezado del diagrama */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px', borderBottom: `1px solid ${C_BORDER}`, background: C_INSET,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C_TEXT, letterSpacing: 0.2 }}>
            Diagrama unifilar
          </div>
          <div style={{ fontSize: 11, color: manual ? 'var(--brand)' : C_MUTED, fontWeight: manual ? 600 : 400 }}>
            {manual
              ? 'MODO MANUAL · click sobre los contactores KM para abrirlos/cerrarlos'
              : 'Click sobre fuentes, breakers o barras para intervenir'}
          </div>
        </div>
        <Legend />
      </div>

      {/* SVG */}
      <div style={{ flex: 1, minHeight: 0, padding: 8 }}>
        <svg viewBox="0 0 760 580" width="100%" height="100%"
          preserveAspectRatio="xMidYMid meet" role="img" aria-label="Diagrama unifilar TTA"
          style={{ fontFamily: FONT_MONO }}>

          {/* ════ FUENTES ════ */}
          {(['P', 'A', 'B'] as SourceId[]).map((src) => {
            const status = srcStatus(src)
            const color = wireColor(status)
            const s = inputs.sources[src]
            const noPower = !s.upstreamEnergized
            const asymFault = !s.asymmetryOk
            const x = COL[src]
            return (
              <g key={src}>
                {/* Hit-area: cortar/restaurar energía */}
                <g className="tta-hit" onClick={() => toggleSourceUpstream(src)}
                  style={{ cursor: 'pointer' }}>
                  <title>{noPower ? `Restaurar energía ${SOURCE_NAMES[src]}` : `Cortar energía ${SOURCE_NAMES[src]}`}</title>
                  <rect x={x - 62} y={20} width={124} height={48} rx={8} />
                </g>

                {/* Caja fuente */}
                <rect x={x - 58} y={24} width={116} height={40} rx={8}
                  fill={C_INSET} stroke={color} strokeWidth={1.5} pointerEvents="none" />
                <circle cx={x - 44} cy={44} r={5} fill={color}
                  className={asymFault ? 'tta-fault-blink' : undefined} pointerEvents="none" />
                <text x={x - 30} y={SOURCE_NAMES[src].length > 4 ? 41 : 41} fontSize={12}
                  fontWeight={700} fill={C_TEXT} pointerEvents="none">{SOURCE_NAMES[src]}</text>
                <text x={x - 30} y={54} fontSize={8} fill={C_MUTED} fontFamily="var(--font-sans)"
                  pointerEvents="none">{SOURCE_SUB[src]}</text>
                {asymFault && <AlarmRing cx={x - 44} cy={44} r={9} />}

                {/* Conductor fuente → CB */}
                <Wire x1={x} y1={64} x2={x} y2={CB_Y} status={status} />

                {/* Breaker (clickeable) */}
                <Breaker x={x} y={CB_Y} src={src} inputs={inputs} status={status}
                  onClick={() => toggleBreaker(src)} />

                {/* Conductor CB → bus */}
                <Wire x1={x} y1={CB_Y + 38} x2={x} y2={BUS_Y} status={status} />
              </g>
            )
          })}

          {/* ════ BUS PRINCIPAL (un solo nodo: energizado si cualquier fuente lo está) ════ */}
          <Wire x1={90} y1={BUS_Y} x2={672} y2={BUS_Y}
            status={(['P', 'A', 'B'] as SourceId[]).some(srcAvailable) ? 'on' : 'off'} w={5} />
          <text x={84} y={BUS_Y - 8} textAnchor="end" fontSize={8} fill={C_MUTED} fontFamily="var(--font-sans)">BUS DE ENTRADA</text>

          {/* ════ COLUMNAS BUS → KM ════ */}
          {(['S1', 'S2', 'S3'] as OutputId[]).map((out, i) => {
            const prevRow = i === 0 ? BUS_Y : ROW[(['S1', 'S2', 'S3'] as OutputId[])[i - 1]] + OUT_OFF
            return (
              <g key={out}>
                <Wire x1={COL.P} y1={prevRow} x2={COL.P} y2={ROW[out] - 16} status={colStatus(out, 'P')} />
                <Wire x1={COL.A} y1={prevRow} x2={COL.A} y2={ROW[out] - 16} status={colStatus(out, 'A')} />
                <Wire x1={COL.B} y1={prevRow} x2={COL.B} y2={ROW[out] - 16} status={colStatus(out, 'B')} />
              </g>
            )
          })}

          {/* ════ CONTACTORES ════ */}
          {(['S1', 'S2', 'S3'] as OutputId[]).map((out) => {
            const maneuvering = transitioning.includes(out)
            return (
              <g key={out}>
                {(['P', 'A', 'B'] as SourceId[]).map((src) => {
                  const km = getContactorId(out, src)!
                  const isConnected = connected[out] === src
                  // Falla registrada en inputs pero el motor no llegó a evaluar el cierre
                  // (ocurre cuando otro KM de la misma salida también tiene falla y aborta la maniobra)
                  const faultPending = (inputs.contactorFaults[km] ?? false) && contactors[km] !== 'falla'
                  return (
                    <Contactor key={src} x={COL[src]} y={ROW[out]} label={km}
                      state={contactors[km]} maneuvering={maneuvering && isConnected}
                      faultPending={faultPending}
                      clickable={manual}
                      title={manual
                        ? (contactors[km] === 'cerrado' ? `Abrir ${km}` : `Cerrar ${km} (conectar ${out} a ${src})`)
                        : undefined}
                      onClick={manual ? () => toggleManualContactor(out, src) : undefined} />
                  )
                })}
              </g>
            )
          })}

          {/* ════ BARRAS DE SALIDA ════ */}
          {(['S1', 'S2', 'S3'] as OutputId[]).map((out) => {
            const status = outStatus(out)
            const busY = ROW[out] + OUT_OFF
            const xStart = COL.P
            const asymFault = !inputs.outputs[out].outputAsymmetryOk
            return (
              <g key={out}>
                {/* Conductores KM → barra */}
                {(['P', 'A', 'B'] as SourceId[]).map((src) => {
                  const isConn = connected[out] === src && energized[out]
                  return (
                    <Wire key={src} x1={COL[src]} y1={ROW[out] + 16}
                      x2={COL[src]} y2={busY} status={isConn ? 'on' : 'off'} />
                  )
                })}

                {/* Hit-area barra: simular asimetría */}
                <g className="tta-hit" onClick={() => toggleOutputAsymmetry(out)} style={{ cursor: 'pointer' }}>
                  <title>{asymFault ? `Restaurar barra ${out}` : `Simular falla asimétrica en barra ${out}`}</title>
                  <rect x={xStart - 6} y={busY - 9} width={672 - xStart + 12} height={18} rx={6} />
                </g>

                <Wire x1={xStart} y1={busY} x2={668} y2={busY} status={status} w={4.5} />
                {asymFault && connected[out] !== null && (
                  <rect x={xStart} y={busY - 7} width={668 - xStart} height={14} rx={7}
                    className="tta-alarm-ring" pointerEvents="none" />
                )}

                {/* Etiqueta de fila */}
                <text x={84} y={ROW[out] + 4} textAnchor="end" fontSize={11} fontWeight={700}
                  fill={C_SEC} pointerEvents="none">{out}</text>
              </g>
            )
          })}

          {/* ════ ETIQUETAS DE SALIDA ════ */}
          {(['S1', 'S2', 'S3'] as OutputId[]).map((out) => {
            const status = outStatus(out)
            const color = wireColor(status)
            const src = connected[out]
            const busY = ROW[out] + OUT_OFF
            return (
              <g key={out} pointerEvents="none">
                <rect x={676} y={busY - 22} width={78} height={44} rx={9}
                  fill={C_INSET} stroke={color} strokeWidth={1.5} />
                <text x={715} y={busY - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill={C_TEXT}>{out}</text>
                <text x={715} y={busY + 4} textAnchor="middle" fontSize={9} fill={C_SEC}>{OUTPUT_AMPS[out]}</text>
                <text x={715} y={busY + 16} textAnchor="middle" fontSize={8} fontWeight={600} fill={color}>
                  {src ? `◄ FTE ${src}` : 'SIN FTE'}
                </text>
              </g>
            )
          })}

          {/* Nombres de tablero alimentado */}
          {(['S1', 'S2', 'S3'] as OutputId[]).map((out) => (
            <text key={out} x={715} y={ROW[out] + OUT_OFF + 33} textAnchor="middle" fontSize={7.5}
              fill={C_MUTED} fontFamily="var(--font-sans)" pointerEvents="none">{OUTPUT_NAME[out]}</text>
          ))}
        </svg>
      </div>
    </div>
  )
}

// ── Breaker ───────────────────────────────────────────────────────────────────
function Breaker({ x, y, src, inputs, status, onClick }: {
  x: number; y: number; src: SourceId
  inputs: EngineInputs
  status: WireStatus; onClick: () => void
}) {
  const s = inputs.sources[src]
  const trip = s.breakerTrip
  const closed = s.breakerClosed && !trip
  const stateText = trip ? 'TRIP' : closed ? 'CERR.' : 'ABIERTO'
  const color = wireColor(status)
  return (
    <g className="tta-hit-group" onClick={onClick} style={{ cursor: 'pointer' }}>
      <title>{trip ? `Resetear ${CB_NAMES[src]} (cerrar)` : closed ? `Abrir ${CB_NAMES[src]}` : `Cerrar ${CB_NAMES[src]}`}</title>
      <rect x={x - 28} y={y} width={56} height={38} rx={8} fill="var(--bg-surface)"
        stroke={color} strokeWidth={2} className={trip ? 'tta-fault-blink' : undefined} />
      {/* contacto del breaker (línea inclinada si abierto) */}
      <line x1={x - 8} y1={y + 14} x2={closed ? x + 8 : x + 6} y2={closed ? y + 14 : y + 9}
        stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={x - 8} cy={y + 14} r={2} fill={color} />
      <circle cx={x + 8} cy={y + 14} r={2} fill={color} />
      <text x={x} y={y + 30} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={color}>
        {CB_NAMES[src]} {stateText}
      </text>
      {trip && <AlarmRing cx={x} cy={y + 19} r={26} />}
    </g>
  )
}

// ── Contactor ──────────────────────────────────────────────────────────────────
function Contactor({ x, y, label, state, maneuvering, faultPending, clickable, title, onClick }: {
  x: number; y: number; label: string; state: ContactorState; maneuvering: boolean
  faultPending?: boolean; clickable?: boolean; title?: string; onClick?: () => void
}) {
  const closed = state === 'cerrado'
  const fault = state === 'falla'
  const color = fault ? C_FAULT : closed ? C_ON : C_DEAD
  return (
    <g pointerEvents={clickable ? 'auto' : 'none'} onClick={onClick}
      style={clickable ? { cursor: 'pointer' } : undefined}>
      {title && <title>{title}</title>}
      {/* Falla registrada en inputs pero no evaluada por el motor (otra falla abortó la maniobra antes) */}
      {faultPending && !fault && (
        <circle cx={x} cy={y} r={19} fill="none"
          stroke="var(--warn)" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.75} />
      )}
      {/* Zona clickeable ampliada en modo manual */}
      {clickable && <circle cx={x} cy={y} r={17} className="tta-hit" />}
      <circle cx={x} cy={y} r={15} fill="var(--bg-surface)" stroke={color} strokeWidth={2}
        className={maneuvering ? 'tta-maneuver' : undefined}
        strokeDasharray={clickable && !closed && !fault ? '3 2' : undefined} />
      {fault ? (
        <g className="tta-fault-blink">
          <line x1={x - 7} y1={y - 7} x2={x + 7} y2={y + 7} stroke={C_FAULT} strokeWidth={2.5} strokeLinecap="round" />
          <line x1={x + 7} y1={y - 7} x2={x - 7} y2={y + 7} stroke={C_FAULT} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      ) : (
        <circle cx={x} cy={y} r={closed ? 8 : 3.5} fill={color}
          style={{ transition: 'r 0.25s ease' }} />
      )}
      <text x={x} y={y + 28} textAnchor="middle" fontSize={8} fontWeight={600} fill={C_MUTED}>{label}</text>
      {fault && <AlarmRing cx={x} cy={y} r={18} />}
    </g>
  )
}

// ── Leyenda ──────────────────────────────────────────────────────────────────
function Legend() {
  const items: [string, string][] = [
    [C_ON, 'Energizado'],
    [C_DEAD, 'Sin energía'],
    [C_FAULT, 'Falla'],
  ]
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      {items.map(([c, label]) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C_SEC }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
          {label}
        </span>
      ))}
    </div>
  )
}
