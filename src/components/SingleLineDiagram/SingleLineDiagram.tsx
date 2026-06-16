import { useSimulatorStore } from '../../store/simulatorStore'
import { isAvailablePure, getContactorId } from '../../engine'
import type { SourceId, OutputId, ContactorState, EngineInputs } from '../../engine'

// ── Tokens ──────────────────────────────────────────────────────────────────
const C_ON      = 'var(--energized)'
const C_ON_FLOW = '#bdf0d3'
const C_DEAD    = 'var(--dead)'
const C_FAULT   = 'var(--fault)'
const C_WARN    = 'var(--warn)'
const C_SURFACE = 'var(--bg-surface)'
const C_INSET   = 'var(--bg-inset)'
const C_TEXT    = 'var(--text-primary)'
const C_MUTED   = 'var(--text-muted)'
const C_SEC     = 'var(--text-secondary)'
const C_BORDER  = 'var(--border)'
const C_BRAND   = 'var(--brand)'

// ── Layout ───────────────────────────────────────────────────────────────────
// viewBox: 960 × 720  (ampliado para KA-9 abajo y relés de asimetría)
const COL: Record<SourceId, number> = { P: 170, A: 390, B: 610 }
const ROW: Record<OutputId, number> = { S1: 300, S2: 400, S3: 500 }
const BUS_Y   = 190   // bus principal de entrada
const OUT_OFF = 32    // offset barra salida respecto al centro del KM
const CB_Y    = 78    // top del rectángulo del CB

// Barra de entrada: de xBusL a xBusR
const xBusL = 90
const xBusR = 680

// Etiquetas de salida (caja S1/S2/S3): centradas en xOutBox
const xOutBox = 718

// Separador y selectores manuales
const xSep  = 760
const SEL_X = 800

// KA-9 / CLIMA — fila debajo de S3
const KA9_Y = 620   // Y de la línea del circuito KA-9

// Nombres
const SOURCE_NAMES: Record<SourceId, string> = { P: 'PRINCIPAL', A: 'DB A', B: 'DB B' }
const SOURCE_SUB:   Record<SourceId, string> = { P: 'Ducto Territoria', A: 'Enel — Ducto A', B: 'Enel — Ducto B' }
const CB_NAMES:     Record<SourceId, string> = { P: 'CB1', A: 'CB2', B: 'CB3' }
const OUTPUT_AMPS:  Record<OutputId, string> = { S1: '100 A', S2: '25 A', S3: '10 A' }
const OUTPUT_NAME:  Record<OutputId, string> = { S1: 'TDAF y Comp.', S2: 'Comp. Respaldada', S3: 'Ilum. Emergencia' }
const SEL_NAMES:    Record<OutputId, string> = { S1: '-S2', S2: '-S3', S3: '-S4' }

// Posiciones del selector: 0=OFF, 1=P, 2=A, 3=B
const SEL_SRCS: Array<SourceId | null> = [null, 'P', 'A', 'B']
const SEL_LABELS = ['0', '1', '2', '3']

const FONT_MONO = "'IBM Plex Mono', monospace"

// ── Primitivos ───────────────────────────────────────────────────────────────
type WireStatus = 'on' | 'off' | 'fault'
function wireColor(s: WireStatus) {
  return s === 'on' ? C_ON : s === 'fault' ? C_FAULT : C_DEAD
}

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

// ── Relé de asimetría R-AS ───────────────────────────────────────────────────
// Símbolo: pequeño rectángulo con etiqueta, posicionado sobre/bajo una barra
function RelayAS({ x, y, label, ok, onClick }: {
  x: number; y: number; label: string; ok: boolean; onClick: () => void
}) {
  const color = ok ? C_ON : C_WARN
  const fill  = ok ? 'rgba(15,157,88,0.08)' : 'rgba(217,119,6,0.12)'
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <title>{ok ? `Simular asimetría ${label}` : `Restaurar simetría ${label}`}</title>
      {/* Hit area */}
      <rect x={x - 20} y={y - 12} width={40} height={24} rx={5} fill="transparent" className="tta-hit" />
      {/* Cuerpo */}
      <rect x={x - 18} y={y - 10} width={36} height={20} rx={4} fill={fill} stroke={color} strokeWidth={1.5}
        className={ok ? undefined : 'tta-fault-blink'} />
      <text x={x} y={y - 1} textAnchor="middle" fontSize={6.5} fontWeight={700}
        fill={color} fontFamily={FONT_MONO}>{label}</text>
      <text x={x} y={y + 7} textAnchor="middle" fontSize={5.5} fontWeight={600}
        fill={color} fontFamily={FONT_MONO}>{ok ? 'OK' : 'FALLA'}</text>
      {!ok && <AlarmRing cx={x} cy={y} r={14} />}
    </g>
  )
}

// ── Selector rotatorio (-S2/-S3/-S4) ─────────────────────────────────────────
function RotarySelector({ cx, cy, out, selection, active, onSelect }: {
  cx: number; cy: number; out: OutputId
  selection: SourceId | null
  active: boolean
  onSelect: (src: SourceId | null) => void
}) {
  const R = 20
  const armLen = R - 4
  const angles = [-150, -90, -30, 30]
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const selIdx = SEL_SRCS.indexOf(selection)
  const armAngle = toRad(angles[selIdx < 0 ? 0 : selIdx])
  const tipX = cx + Math.cos(armAngle) * armLen
  const tipY = cy + Math.sin(armAngle) * armLen
  return (
    <g style={{ cursor: active ? 'pointer' : 'default' }}>
      <text x={cx} y={cy - R - 8} textAnchor="middle" fontSize={8} fontWeight={700}
        fill={active ? C_BRAND : C_MUTED} fontFamily={FONT_MONO}>{SEL_NAMES[out]}</text>
      <circle cx={cx} cy={cy} r={R} fill={active ? 'var(--brand-tint)' : C_INSET}
        stroke={active ? C_BRAND : C_MUTED} strokeWidth={active ? 2 : 1.5} />
      {angles.map((deg, i) => {
        const rad = toRad(deg)
        const px = cx + Math.cos(rad) * (R - 5)
        const py = cy + Math.sin(rad) * (R - 5)
        const lx = cx + Math.cos(rad) * (R + 7)
        const ly = cy + Math.sin(rad) * (R + 7)
        const isSel = (selIdx < 0 ? 0 : selIdx) === i
        const src = SEL_SRCS[i]
        return (
          <g key={i} onClick={active ? () => onSelect(src) : undefined}
            style={{ cursor: active ? 'pointer' : 'default' }}>
            {active && <circle cx={px} cy={py} r={7} fill="transparent" className="tta-hit" />}
            <circle cx={px} cy={py} r={isSel ? 3.5 : 2}
              fill={isSel ? (active ? C_BRAND : C_SEC) : C_MUTED} />
            <text x={lx} y={ly + 3} textAnchor="middle" fontSize={6.5} fontWeight={700}
              fill={isSel ? (active ? C_BRAND : C_SEC) : C_MUTED}
              fontFamily={FONT_MONO}>{SEL_LABELS[i]}</text>
          </g>
        )
      })}
      <line x1={cx} y1={cy} x2={tipX} y2={tipY}
        stroke={active ? C_BRAND : C_SEC} strokeWidth={active ? 2.5 : 2}
        strokeLinecap="round" style={{ transition: 'all 0.3s ease' }} />
      <circle cx={cx} cy={cy} r={4} fill={active ? C_BRAND : C_SEC} />
      <text x={cx} y={cy + R + 10} textAnchor="middle" fontSize={7} fontWeight={700}
        fill={active ? C_BRAND : C_MUTED} fontFamily={FONT_MONO}>
        {selection ? SOURCE_NAMES[selection].replace('PRINCIPAL', 'PRINC.') : 'OFF'}
      </text>
    </g>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function SingleLineDiagram() {
  const inputs              = useSimulatorStore((s) => s.inputs)
  const derived             = useSimulatorStore((s) => s.derived)
  const transitioning       = useSimulatorStore((s) => s.transitioning)
  const toggleSourceUpstream   = useSimulatorStore((s) => s.toggleSourceUpstream)
  const toggleBreaker          = useSimulatorStore((s) => s.toggleBreaker)
  const toggleOutputAsymmetry  = useSimulatorStore((s) => s.toggleOutputAsymmetry)
  const toggleManualContactor  = useSimulatorStore((s) => s.toggleManualContactor)
  const setSourceAsymmetry     = useSimulatorStore((s) => s.setSourceAsymmetry)
  const setBlackout            = useSimulatorStore((s) => s.setBlackout)

  const { contactors, connected, energized, ka9 } = derived
  const manual = inputs.modeSelector !== 'AUTO'

  const srcAvailable = (src: SourceId) => isAvailablePure(inputs, src)
  const srcFault     = (src: SourceId) => inputs.sources[src].breakerTrip || !inputs.sources[src].asymmetryOk
  const srcStatus    = (src: SourceId): WireStatus => {
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

  // Fuente conectada a S1 para el circuito KA-9
  const ka9SrcStatus: WireStatus = (['P','A','B'] as SourceId[]).some(srcAvailable) ? 'on' : 'off'

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: C_SURFACE, borderRadius: 'var(--r-lg)', border: `1px solid ${C_BORDER}`,
      boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
    }}>
      {/* Encabezado */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 18px', borderBottom: `1px solid ${C_BORDER}`, background: C_INSET, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C_TEXT, letterSpacing: 0.2 }}>Diagrama unifilar</div>
          <div style={{ fontSize: 11, color: manual ? C_BRAND : C_MUTED, fontWeight: manual ? 600 : 400 }}>
            {manual
              ? 'MODO MANUAL · gire los selectores -S2/-S3/-S4 para conectar cada salida'
              : 'Click sobre fuentes, breakers o barras de salida para intervenir · Click en R-AS para simular asimetría'}
          </div>
        </div>
        <Legend />
      </div>

      {/* SVG — viewBox ampliado a 960×720 */}
      <div style={{ flex: 1, minHeight: 0, padding: 8 }}>
        <svg viewBox="0 0 960 720" width="100%" height="100%"
          preserveAspectRatio="xMidYMid meet" role="img" aria-label="Diagrama unifilar TTA"
          style={{ fontFamily: FONT_MONO }}>

          {/* ══ FUENTES ══ */}
          {(['P', 'A', 'B'] as SourceId[]).map((src) => {
            const status = srcStatus(src)
            const color  = wireColor(status)
            const s      = inputs.sources[src]
            const x      = COL[src]
            return (
              <g key={src}>
                <g className="tta-hit" onClick={() => toggleSourceUpstream(src)} style={{ cursor: 'pointer' }}>
                  <title>{s.upstreamEnergized ? `Cortar energía ${SOURCE_NAMES[src]}` : `Restaurar energía ${SOURCE_NAMES[src]}`}</title>
                  <rect x={x - 62} y={20} width={124} height={48} rx={8} />
                </g>
                <rect x={x - 58} y={24} width={116} height={40} rx={8}
                  fill={C_INSET} stroke={color} strokeWidth={1.5} pointerEvents="none" />
                <circle cx={x - 44} cy={44} r={5} fill={color}
                  className={!s.asymmetryOk ? 'tta-fault-blink' : undefined} pointerEvents="none" />
                <text x={x - 30} y={41} fontSize={12} fontWeight={700} fill={C_TEXT} pointerEvents="none">{SOURCE_NAMES[src]}</text>
                <text x={x - 30} y={54} fontSize={8} fill={C_MUTED} fontFamily="var(--font-sans)" pointerEvents="none">{SOURCE_SUB[src]}</text>
                {!s.asymmetryOk && <AlarmRing cx={x - 44} cy={44} r={9} />}

                <Wire x1={x} y1={64} x2={x} y2={CB_Y} status={status} />
                <Breaker x={x} y={CB_Y} src={src} inputs={inputs} status={status} onClick={() => toggleBreaker(src)} />
                <Wire x1={x} y1={CB_Y + 36} x2={x} y2={BUS_Y} status={status} />
              </g>
            )
          })}

          {/* ══ BUS PRINCIPAL ══ */}
          <Wire x1={xBusL} y1={BUS_Y} x2={xBusR} y2={BUS_Y}
            status={(['P','A','B'] as SourceId[]).some(srcAvailable) ? 'on' : 'off'} w={5} />
          <text x={xBusL - 6} y={BUS_Y - 8} textAnchor="end" fontSize={8} fill={C_MUTED} fontFamily="var(--font-sans)">BUS DE ENTRADA</text>

          {/* R-AS de barras de ENTRADA — sobre el bus principal */}
          {(['P', 'A', 'B'] as SourceId[]).map((src) => (
            <RelayAS key={src}
              x={COL[src]} y={BUS_Y - 26}
              label={`R-AS-${src}`}
              ok={inputs.sources[src].asymmetryOk}
              onClick={() => setSourceAsymmetry(src, !inputs.sources[src].asymmetryOk)} />
          ))}

          {/* ══ COLUMNAS BUS → KM ══ */}
          {(['S1', 'S2', 'S3'] as OutputId[]).map((out, i) => {
            const prevRow = i === 0 ? BUS_Y : ROW[(['S1','S2','S3'] as OutputId[])[i-1]] + OUT_OFF
            return (
              <g key={out}>
                {(['P','A','B'] as SourceId[]).map((src) => (
                  <Wire key={src} x1={COL[src]} y1={prevRow} x2={COL[src]} y2={ROW[out] - 15} status={colStatus(out, src)} />
                ))}
              </g>
            )
          })}

          {/* ══ CONTACTORES ══ */}
          {(['S1','S2','S3'] as OutputId[]).map((out) => {
            const maneuvering = transitioning.includes(out)
            return (
              <g key={out}>
                {(['P','A','B'] as SourceId[]).map((src) => {
                  const km = getContactorId(out, src)!
                  const isConnected = connected[out] === src
                  const faultPending = (inputs.contactorFaults[km] ?? false) && contactors[km] !== 'falla'
                  return (
                    <Contactor key={src} x={COL[src]} y={ROW[out]} label={km}
                      state={contactors[km]} maneuvering={maneuvering && isConnected}
                      faultPending={faultPending} clickable={false} />
                  )
                })}
              </g>
            )
          })}

          {/* ══ BARRAS DE SALIDA ══ */}
          {(['S1','S2','S3'] as OutputId[]).map((out) => {
            const status    = outStatus(out)
            const busY      = ROW[out] + OUT_OFF
            const asymFault = !inputs.outputs[out].outputAsymmetryOk
            return (
              <g key={out}>
                {(['P','A','B'] as SourceId[]).map((src) => {
                  const isConn = connected[out] === src && energized[out]
                  return <Wire key={src} x1={COL[src]} y1={ROW[out]+15} x2={COL[src]} y2={busY} status={isConn ? 'on' : 'off'} />
                })}

                {/* Hit-area barra salida: simular asimetría */}
                <g className="tta-hit" onClick={() => toggleOutputAsymmetry(out)} style={{ cursor: 'pointer' }}>
                  <title>{asymFault ? `Restaurar barra ${out}` : `Simular falla asimétrica en barra ${out}`}</title>
                  <rect x={xBusL - 6} y={busY - 8} width={xBusR - xBusL + 12} height={16} rx={5} />
                </g>

                <Wire x1={xBusL} y1={busY} x2={xBusR} y2={busY} status={status} w={4.5} />
                {asymFault && connected[out] !== null && (
                  <rect x={xBusL} y={busY - 6} width={xBusR - xBusL} height={12} rx={6}
                    className="tta-alarm-ring" pointerEvents="none" />
                )}
                <text x={xBusL - 6} y={ROW[out] + 4} textAnchor="end" fontSize={11} fontWeight={700}
                  fill={C_SEC} pointerEvents="none">{out}</text>
              </g>
            )
          })}

          {/* R-AS de barras de SALIDA — a la derecha de cada barra */}
          {(['S1','S2','S3'] as OutputId[]).map((out) => {
            const busY   = ROW[out] + OUT_OFF
            const rasId  = out === 'S1' ? 'R-AS-BP' : out === 'S2' ? 'R-AS-BA' : 'R-AS-BB'
            const ok     = inputs.outputs[out].outputAsymmetryOk
            return (
              <RelayAS key={out}
                x={xBusR + 22} y={busY}
                label={rasId}
                ok={ok}
                onClick={() => toggleOutputAsymmetry(out)} />
            )
          })}

          {/* ══ ETIQUETAS DE SALIDA (cajas S1/S2/S3) ══ */}
          {(['S1','S2','S3'] as OutputId[]).map((out) => {
            const status = outStatus(out)
            const color  = wireColor(status)
            const src    = connected[out]
            const busY   = ROW[out] + OUT_OFF
            return (
              <g key={out} pointerEvents="none">
                <rect x={xOutBox - 2} y={busY - 22} width={58} height={44} rx={8}
                  fill={C_INSET} stroke={color} strokeWidth={1.5} />
                <text x={xOutBox + 27} y={busY - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill={C_TEXT}>{out}</text>
                <text x={xOutBox + 27} y={busY + 4} textAnchor="middle" fontSize={8} fill={C_SEC}>{OUTPUT_AMPS[out]}</text>
                <text x={xOutBox + 27} y={busY + 16} textAnchor="middle" fontSize={7} fontWeight={600} fill={color}>
                  {src ? `◄ ${src}` : 'SIN FTE'}
                </text>
              </g>
            )
          })}
          {(['S1','S2','S3'] as OutputId[]).map((out) => (
            <text key={out} x={xOutBox + 27} y={ROW[out] + OUT_OFF + 30} textAnchor="middle" fontSize={7}
              fill={C_MUTED} fontFamily="var(--font-sans)" pointerEvents="none">{OUTPUT_NAME[out]}</text>
          ))}

          {/* ══ SELECTORES ROTATORIOS (-S2/-S3/-S4) ══ */}
          <line x1={xSep} y1={BUS_Y - 20} x2={xSep} y2={ROW.S3 + OUT_OFF + 36}
            stroke={manual ? C_BRAND : C_BORDER} strokeWidth={1}
            strokeDasharray={manual ? undefined : '4 3'} opacity={0.5} />
          <text x={SEL_X} y={BUS_Y - 30} textAnchor="middle" fontSize={8} fontWeight={700}
            fill={manual ? C_BRAND : C_MUTED} fontFamily={FONT_MONO}>
            {manual ? 'CTRL MANUAL' : 'SEL. MANUAL'}
          </text>
          {(['S1','S2','S3'] as OutputId[]).map((out) => (
            <RotarySelector key={out}
              cx={SEL_X} cy={ROW[out] + OUT_OFF / 2}
              out={out}
              selection={inputs.manualSelection[out]}
              active={manual}
              onSelect={(src) => toggleManualContactor(out, src)} />
          ))}

          {/* ══ CIRCUITO KA-9 / CONTROL CARGA NO ESENCIAL – CLIMA ══ */}
          {(() => {
            const Y     = KA9_Y          // línea de circuito
            const xL    = xBusL          // inicio izquierda
            const xCoil = xL + 80        // centro de la bobina KA-9
            const xC1   = xCoil + 18     // salida bobina → inicio contacto
            const xC2   = xC1 + 80       // fin contacto (KA-9)
            const xBox  = xC2 + 20       // inicio caja CLIMA
            const boxW  = 90
            const colLine = ka9SrcStatus === 'on' ? C_ON : C_DEAD
            const colKa9  = ka9 ? C_WARN : C_MUTED

            return (
              <g>
                {/* Título */}
                <text x={xL} y={Y - 32} fontSize={8} fontWeight={700}
                  fill={C_MUTED} fontFamily="var(--font-sans)">
                  CONTROL DE CARGA NO ESENCIAL – CLIMA
                </text>

                {/* Etiqueta "BARRA PRINCIPAL" */}
                <text x={xL} y={Y - 12} fontSize={7} fill={C_MUTED} fontFamily="var(--font-sans)">BARRA PRINCIPAL</text>

                {/* ─── Conductor: inicio → bobina KA-9 ─── */}
                <Wire x1={xL} y1={Y} x2={xCoil - 12} y2={Y} status={ka9SrcStatus} />

                {/* Bobina KA-9 (círculo IEC) — clickeable */}
                <g onClick={() => setBlackout(!inputs.blackout)} style={{ cursor: 'pointer' }}>
                  <title>{inputs.blackout ? 'Desactivar BLACKOUT' : 'Activar BLACKOUT (energiza KA-9)'}</title>
                  <circle cx={xCoil} cy={Y} r={12}
                    fill={ka9 ? 'rgba(217,119,6,0.12)' : C_INSET}
                    stroke={colKa9} strokeWidth={2}
                    className={ka9 ? 'tta-fault-blink' : undefined} />
                  <text x={xCoil} y={Y - 2} textAnchor="middle" fontSize={6} fontWeight={700}
                    fill={colKa9} fontFamily={FONT_MONO}>KA-9</text>
                  <text x={xCoil} y={Y + 7} textAnchor="middle" fontSize={5.5} fontWeight={600}
                    fill={colKa9} fontFamily={FONT_MONO}>{ka9 ? 'ON' : 'OFF'}</text>
                </g>

                {/* ─── Conductor: bobina → contacto ─── */}
                <Wire x1={xCoil + 12} y1={Y} x2={xC1} y2={Y} status={ka9SrcStatus} />

                {/* Contacto NA del relé KA-9 (normalmente abierto — cierra con blackout) */}
                {/* Punto izquierdo */}
                <circle cx={xC1} cy={Y} r={2.5} fill={colKa9} />
                {/* Punto derecho */}
                <circle cx={xC2} cy={Y} r={2.5} fill={colKa9} />
                {/* Blade: horizontal (cerrado=blackout) o diagonal (abierto=normal) */}
                <line
                  x1={xC1 + 3} y1={Y}
                  x2={ka9 ? xC2 - 3 : xC2 - 5}
                  y2={ka9 ? Y : Y - 10}
                  stroke={colKa9} strokeWidth={2.5} strokeLinecap="round"
                  style={{ transition: 'all 0.25s ease' }} />
                {/* Etiqueta del contacto */}
                <text x={(xC1 + xC2) / 2} y={Y - 15} textAnchor="middle" fontSize={7} fontWeight={700}
                  fill={colKa9} fontFamily={FONT_MONO}>KA-9</text>
                <text x={(xC1 + xC2) / 2} y={Y + 16} textAnchor="middle" fontSize={6.5} fontWeight={600}
                  fill={colKa9} fontFamily={FONT_MONO}>{ka9 ? 'CERR.' : 'ABIERTO'}</text>

                {/* ─── Conductor: contacto → caja CLIMA ─── */}
                <Wire x1={xC2} y1={Y} x2={xBox} y2={Y} status={ka9 ? 'on' : 'off'} />

                {/* Caja CLIMA */}
                <rect x={xBox} y={Y - 18} width={boxW} height={36} rx={7}
                  fill={ka9 ? 'rgba(217,119,6,0.10)' : C_INSET}
                  stroke={ka9 ? C_WARN : C_MUTED} strokeWidth={2} />
                <text x={xBox + boxW / 2} y={Y - 3} textAnchor="middle" fontSize={12} fontWeight={700}
                  fill={ka9 ? C_WARN : C_MUTED} fontFamily={FONT_MONO}>CLIMA</text>
                <text x={xBox + boxW / 2} y={Y + 12} textAnchor="middle" fontSize={7} fontWeight={600}
                  fill={ka9 ? C_WARN : C_MUTED} fontFamily={FONT_MONO}>
                  {ka9 ? 'DESCONECTADO' : 'CONECTADO'}
                </text>

                {/* Punto de derivación (nodo •) en el bus principal, columna P */}
                <circle cx={COL.P} cy={BUS_Y} r={5} fill={colLine} />
                {/* Bajada vertical desde bus → nivel KA-9 */}
                <Wire x1={COL.P} y1={BUS_Y} x2={COL.P} y2={Y} status={ka9SrcStatus} />
                {/* Horizontal: bajada → inicio del circuito */}
                <Wire x1={xL} y1={Y} x2={COL.P} y2={Y} status={ka9SrcStatus} />
              </g>
            )
          })()}
        </svg>
      </div>
    </div>
  )
}

// ── Breaker IEC ──────────────────────────────────────────────────────────────
function Breaker({ x, y, src, inputs, status, onClick }: {
  x: number; y: number; src: SourceId; inputs: EngineInputs; status: WireStatus; onClick: () => void
}) {
  const s = inputs.sources[src]
  const trip   = s.breakerTrip
  const closed = s.breakerClosed && !trip
  const stateText = trip ? 'TRIP' : closed ? 'CERR.' : 'ABIERTO'
  const color = closed ? C_ON : C_FAULT
  const W = 22; const H = 36
  const rx_ = x - W / 2; const ry_ = y
  const cx_ = x; const midY = y + H / 2
  const bladeTop = closed
    ? { x: cx_,     y: midY - 10 }
    : { x: cx_ + 9, y: midY - 12 }
  return (
    <g className="tta-hit-group" onClick={onClick} style={{ cursor: 'pointer' }}>
      <title>{trip ? `Resetear ${CB_NAMES[src]}` : closed ? `Abrir ${CB_NAMES[src]}` : `Cerrar ${CB_NAMES[src]}`}</title>
      <rect x={rx_} y={ry_} width={W} height={H} rx={4}
        fill={closed ? 'rgba(15,157,88,0.10)' : 'rgba(224,36,36,0.08)'}
        stroke={color} strokeWidth={2} className={trip ? 'tta-fault-blink' : undefined} />
      <circle cx={cx_} cy={ry_}     r={2.5} fill={color} />
      <circle cx={cx_} cy={ry_ + H} r={2.5} fill={color} />
      <line x1={cx_} y1={midY + 10} x2={bladeTop.x} y2={bladeTop.y}
        stroke={color} strokeWidth={2.5} strokeLinecap="round" style={{ transition: 'all 0.25s ease' }} />
      <text x={cx_} y={ry_ + H + 13} textAnchor="middle" fontSize={8} fontWeight={700}
        fill={color} fontFamily={FONT_MONO}>{CB_NAMES[src]}</text>
      <text x={cx_} y={ry_ + H + 22} textAnchor="middle" fontSize={7} fontWeight={600}
        fill={color} fontFamily={FONT_MONO}>{stateText}</text>
      {trip && <AlarmRing cx={cx_} cy={midY} r={22} />}
    </g>
  )
}

// ── Contactor IEC ────────────────────────────────────────────────────────────
function Contactor({ x, y, label, state, maneuvering, faultPending, clickable, title, onClick }: {
  x: number; y: number; label: string; state: ContactorState; maneuvering: boolean
  faultPending?: boolean; clickable?: boolean; title?: string; onClick?: () => void
}) {
  const closed = state === 'cerrado'
  const fault  = state === 'falla'
  const color  = fault ? C_FAULT : closed ? C_ON : C_DEAD
  const W = 18; const H = 30
  const rx_ = x - W / 2; const ry_ = y - H / 2
  const cx_ = x; const midY = y
  const bladeTop = closed
    ? { x: cx_,     y: midY - 9 }
    : { x: cx_ + 7, y: midY - 11 }
  return (
    <g pointerEvents={clickable ? 'auto' : 'none'} onClick={onClick}
      style={clickable ? { cursor: 'pointer' } : undefined}>
      {title && <title>{title}</title>}
      {faultPending && !fault && (
        <rect x={rx_ - 4} y={ry_ - 4} width={W + 8} height={H + 8} rx={6}
          fill="none" stroke={C_WARN} strokeWidth={1.5} strokeDasharray="3 2" opacity={0.75} />
      )}
      {clickable && (
        <rect x={rx_ - 6} y={ry_ - 6} width={W + 12} height={H + 12} rx={8} className="tta-hit" />
      )}
      <rect x={rx_} y={ry_} width={W} height={H} rx={4}
        fill={closed ? 'rgba(15,157,88,0.10)' : fault ? 'rgba(224,36,36,0.08)' : C_INSET}
        stroke={color} strokeWidth={1.8} className={maneuvering ? 'tta-maneuver' : undefined} />
      <circle cx={cx_} cy={ry_}     r={2} fill={color} />
      <circle cx={cx_} cy={ry_ + H} r={2} fill={color} />
      {fault ? (
        <g className="tta-fault-blink">
          <line x1={cx_ - 5} y1={midY - 5} x2={cx_ + 5} y2={midY + 5} stroke={C_FAULT} strokeWidth={2} strokeLinecap="round" />
          <line x1={cx_ + 5} y1={midY - 5} x2={cx_ - 5} y2={midY + 5} stroke={C_FAULT} strokeWidth={2} strokeLinecap="round" />
        </g>
      ) : (
        <line x1={cx_} y1={midY + 7} x2={bladeTop.x} y2={bladeTop.y}
          stroke={color} strokeWidth={2} strokeLinecap="round" style={{ transition: 'all 0.25s ease' }} />
      )}
      <text x={cx_} y={ry_ + H + 11} textAnchor="middle" fontSize={7} fontWeight={600}
        fill={C_MUTED} fontFamily={FONT_MONO}>{label}</text>
      {fault && <AlarmRing cx={cx_} cy={midY} r={18} />}
    </g>
  )
}

// ── Leyenda ──────────────────────────────────────────────────────────────────
function Legend() {
  const items: [string, string][] = [
    [C_ON,   'Energizado / Cerrado'],
    [C_DEAD, 'Sin energía / Abierto'],
    [C_FAULT,'Falla'],
    [C_WARN, 'Alerta / KA-9'],
  ]
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {items.map(([c, label]) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: C_SEC }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
          {label}
        </span>
      ))}
    </div>
  )
}