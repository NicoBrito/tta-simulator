import { useSimulatorStore } from '../../store/simulatorStore'
import { isAvailablePure, getContactorId } from '../../engine'
import type { SourceId, OutputId, ContactorState, EngineInputs } from '../../engine'

// ── Tokens ──────────────────────────────────────────────────────────────────
// Dos verdes distintos para diferenciar barras verticales (alimentación) de
// horizontales (barras de bus). El gris = sin energía; el rojo = solo falla.
const C_ON      = '#0f9d58'   // verde de columnas verticales (alimentación) y trazos de elementos
const C_ON_V    = '#0f9d58'   // verde barras VERTICALES
const C_ON_H    = '#046c46'   // verde barras HORIZONTALES (más profundo)
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

// Etiqueta representativa de cada posición del selector
const SEL_TEXT: Record<string, string> = { OFF: 'OFF', P: 'P', A: 'DBA', B: 'DBB' }
const posLabel = (s: SourceId | null) => (s === null ? SEL_TEXT.OFF : SEL_TEXT[s])

// Posiciones por salida. S3 NO incluye P (solo OFF, DBA, DBB).
const SEL_POSITIONS: Record<OutputId, Array<SourceId | null>> = {
  S1: [null, 'P', 'A', 'B'],
  S2: [null, 'P', 'A', 'B'],
  S3: [null, 'A', 'B'],
}

const FONT_MONO = "'IBM Plex Mono', monospace"

// ── Primitivos ───────────────────────────────────────────────────────────────
type WireStatus = 'on' | 'off' | 'fault'
function wireColor(s: WireStatus) {
  return s === 'on' ? C_ON : s === 'fault' ? C_FAULT : C_DEAD
}

// Conductor estático (sin animación). `onColor` permite distinguir verde vertical/horizontal.
function Wire({ x1, y1, x2, y2, status, w = 3, onColor = C_ON_V }: {
  x1: number; y1: number; x2: number; y2: number; status: WireStatus; w?: number; onColor?: string
}) {
  const color = status === 'on' ? onColor : status === 'fault' ? C_FAULT : C_DEAD
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" />
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
  const positions = SEL_POSITIONS[out]
  const n = positions.length
  const toRad = (deg: number) => (deg * Math.PI) / 180
  // Arco de -150° a 30° repartido entre las posiciones disponibles
  const angleOf = (i: number) => -150 + (i * 180) / (n - 1)
  const rawIdx = positions.indexOf(selection)
  const selIdx = rawIdx < 0 ? 0 : rawIdx
  const armAngle = toRad(angleOf(selIdx))
  const tipX = cx + Math.cos(armAngle) * armLen
  const tipY = cy + Math.sin(armAngle) * armLen
  return (
    <g style={{ cursor: active ? 'pointer' : 'default' }}>
      <text x={cx} y={cy - R - 8} textAnchor="middle" fontSize={8} fontWeight={700}
        fill={active ? C_BRAND : C_MUTED} fontFamily={FONT_MONO}>{SEL_NAMES[out]}</text>
      <circle cx={cx} cy={cy} r={R} fill={active ? 'var(--brand-tint)' : C_INSET}
        stroke={active ? C_BRAND : C_MUTED} strokeWidth={active ? 2 : 1.5} />
      {positions.map((src, i) => {
        const rad = toRad(angleOf(i))
        const px = cx + Math.cos(rad) * (R - 5)
        const py = cy + Math.sin(rad) * (R - 5)
        const lx = cx + Math.cos(rad) * (R + 9)
        const ly = cy + Math.sin(rad) * (R + 9)
        const isSel = selIdx === i
        return (
          <g key={i} onClick={active ? () => onSelect(src) : undefined}
            style={{ cursor: active ? 'pointer' : 'default' }}>
            {active && <circle cx={px} cy={py} r={7} fill="transparent" className="tta-hit" />}
            <circle cx={px} cy={py} r={isSel ? 3.5 : 2}
              fill={isSel ? (active ? C_BRAND : C_SEC) : C_MUTED} />
            <text x={lx} y={ly + 3} textAnchor="middle" fontSize={6.5} fontWeight={700}
              fill={isSel ? (active ? C_BRAND : C_SEC) : C_MUTED}
              fontFamily={FONT_MONO}>{posLabel(src)}</text>
          </g>
        )
      })}
      <line x1={cx} y1={cy} x2={tipX} y2={tipY}
        stroke={active ? C_BRAND : C_SEC} strokeWidth={active ? 2.5 : 2}
        strokeLinecap="round" style={{ transition: 'all 0.3s ease' }} />
      <circle cx={cx} cy={cy} r={4} fill={active ? C_BRAND : C_SEC} />
      <text x={cx} y={cy + R + 10} textAnchor="middle" fontSize={7} fontWeight={700}
        fill={active ? C_BRAND : C_MUTED} fontFamily={FONT_MONO}>
        {posLabel(selection)}
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
                <Breaker x={x} y={CB_Y} src={src} inputs={inputs} onClick={() => toggleBreaker(src)} />
                <Wire x1={x} y1={CB_Y + 36} x2={x} y2={BUS_Y} status={status} />
              </g>
            )
          })}

          {/* ══ BUS PRINCIPAL (horizontal → verde H; gris si OFF, nunca rojo) ══ */}
          <Wire x1={xBusL} y1={BUS_Y} x2={xBusR} y2={BUS_Y}
            status={(['P','A','B'] as SourceId[]).some(srcAvailable) ? 'on' : 'off'} w={5} onColor={C_ON_H} />
          <text x={xBusL - 6} y={BUS_Y - 8} textAnchor="end" fontSize={8} fill={C_MUTED} fontFamily="var(--font-sans)">BUS DE ENTRADA</text>

          {/* R-AS de barras de ENTRADA — sobre el bus principal */}
          {(['P', 'A', 'B'] as SourceId[]).map((src) => (
            <RelayAS key={src}
              x={COL[src]} y={BUS_Y - 26}
              label={`R-AS-${src}`}
              ok={inputs.sources[src].asymmetryOk}
              onClick={() => setSourceAsymmetry(src, !inputs.sources[src].asymmetryOk)} />
          ))}

          {/* ══ COLUMNAS BUS → KM (verticales → verde V). S3 NO baja desde P ══ */}
          {(['S1', 'S2', 'S3'] as OutputId[]).map((out, i) => {
            const prevRow = i === 0 ? BUS_Y : ROW[(['S1','S2','S3'] as OutputId[])[i-1]] + OUT_OFF
            const srcs: SourceId[] = out === 'S3' ? ['A','B'] : ['P','A','B']
            return (
              <g key={out}>
                {srcs.map((src) => (
                  <Wire key={src} x1={COL[src]} y1={prevRow} x2={COL[src]} y2={ROW[out] - 15} status={colStatus(out, src)} onColor={C_ON_V} />
                ))}
              </g>
            )
          })}

          {/* ══ CONTACTORES (S3 sin KM3-P) ══ */}
          {(['S1','S2','S3'] as OutputId[]).map((out) => {
            const maneuvering = transitioning.includes(out)
            const srcs: SourceId[] = out === 'S3' ? ['A','B'] : ['P','A','B']
            return (
              <g key={out}>
                {srcs.map((src) => {
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

          {/* ══ BARRAS DE SALIDA (horizontales → verde H). S3 arranca en columna A ══ */}
          {(['S1','S2','S3'] as OutputId[]).map((out) => {
            const status    = outStatus(out)
            const busY      = ROW[out] + OUT_OFF
            const asymFault = !inputs.outputs[out].outputAsymmetryOk
            const srcs: SourceId[] = out === 'S3' ? ['A','B'] : ['P','A','B']
            // S3 sólo se relaciona con A y B: su barra no llega bajo la columna PRINCIPAL.
            const busL = out === 'S3' ? COL.A - 28 : xBusL
            return (
              <g key={out}>
                {srcs.map((src) => {
                  const isConn = connected[out] === src && energized[out]
                  return <Wire key={src} x1={COL[src]} y1={ROW[out]+15} x2={COL[src]} y2={busY} status={isConn ? 'on' : 'off'} onColor={C_ON_V} />
                })}

                {/* Hit-area barra salida: simular asimetría */}
                <g className="tta-hit" onClick={() => toggleOutputAsymmetry(out)} style={{ cursor: 'pointer' }}>
                  <title>{asymFault ? `Restaurar barra ${out}` : `Simular falla asimétrica en barra ${out}`}</title>
                  <rect x={busL - 6} y={busY - 8} width={xBusR - busL + 12} height={16} rx={5} />
                </g>

                <Wire x1={busL} y1={busY} x2={xBusR} y2={busY} status={status} w={4.5} onColor={C_ON_H} />
                {asymFault && connected[out] !== null && (
                  <rect x={busL} y={busY - 6} width={xBusR - busL} height={12} rx={6}
                    className="tta-alarm-ring" pointerEvents="none" />
                )}
                <text x={busL - 8} y={ROW[out] + 4} textAnchor="end" fontSize={11} fontWeight={700}
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

          {/* ══ SISTEMA INDEPENDIENTE · CONTROL DE CLIMA (KA-9) ══ */}
          {/* Sin ninguna conexión eléctrica ni visual con la red principal: alimentación propia. */}
          {(() => {
            const Y      = KA9_Y
            const fx     = 76                  // x marco
            const fy     = Y - 52              // y marco
            const fw     = 470                 // ancho marco
            const fh     = 104                 // alto marco
            const xSup   = fx + 36             // alimentación propia
            const xCoil  = xSup + 86           // bobina KA-9
            const xC1    = xCoil + 40          // inicio contacto NC
            const xC2    = xC1 + 70            // fin contacto NC
            const xBox   = xC2 + 26            // caja CLIMA
            const boxW   = 96
            const colKa9 = ka9 ? C_WARN : C_MUTED
            const climaOn = !ka9               // contacto NC: clima conectado salvo blackout

            return (
              <g>
                {/* Marco del sistema independiente */}
                <rect x={fx} y={fy} width={fw} height={fh} rx={10}
                  fill="rgba(120,130,150,0.04)" stroke={C_BORDER} strokeWidth={1.2} strokeDasharray="6 4" />
                <text x={fx + 12} y={fy + 16} fontSize={8.5} fontWeight={700}
                  fill={C_SEC} fontFamily="var(--font-sans)">
                  SISTEMA INDEPENDIENTE · CONTROL DE CLIMA (CARGA NO ESENCIAL)
                </text>
                <text x={fx + 12} y={fy + 28} fontSize={7} fontWeight={500}
                  fill={C_MUTED} fontFamily="var(--font-sans)">
                  Alimentación propia · sin conexión a la red TTA
                </text>

                {/* ── Alimentación propia (no proviene del bus principal) ── */}
                <rect x={xSup - 22} y={Y - 16} width={44} height={32} rx={6}
                  fill={C_INSET} stroke={C_SEC} strokeWidth={1.5} />
                <text x={xSup} y={Y - 2} textAnchor="middle" fontSize={7} fontWeight={700}
                  fill={C_SEC} fontFamily={FONT_MONO}>ALIM.</text>
                <text x={xSup} y={Y + 8} textAnchor="middle" fontSize={6.5} fontWeight={600}
                  fill={C_MUTED} fontFamily={FONT_MONO}>24Vdc</text>

                {/* alim. → contacto: siempre con tensión propia (verde H) */}
                <Wire x1={xSup + 22} y1={Y} x2={xC1} y2={Y} status="on" onColor={C_ON_H} />

                {/* Bobina KA-9 (la energiza el BLACKOUT) — clickeable */}
                <g onClick={() => setBlackout(!inputs.blackout)} style={{ cursor: 'pointer' }}>
                  <title>{inputs.blackout ? 'Desactivar BLACKOUT' : 'Activar BLACKOUT (energiza KA-9)'}</title>
                  <circle cx={xCoil} cy={Y - 34} r={12}
                    fill={ka9 ? 'rgba(217,119,6,0.12)' : C_INSET}
                    stroke={colKa9} strokeWidth={2}
                    className={ka9 ? 'tta-fault-blink' : undefined} />
                  <text x={xCoil} y={Y - 36} textAnchor="middle" fontSize={6} fontWeight={700}
                    fill={colKa9} fontFamily={FONT_MONO}>KA-9</text>
                  <text x={xCoil} y={Y - 28} textAnchor="middle" fontSize={5.5} fontWeight={600}
                    fill={colKa9} fontFamily={FONT_MONO}>{ka9 ? 'ON' : 'OFF'}</text>
                  <text x={xCoil} y={Y - 50} textAnchor="middle" fontSize={6} fontWeight={600}
                    fill={C_MUTED} fontFamily={FONT_MONO}>BLACKOUT</text>
                </g>
                {/* Vínculo de control (línea punteada): la bobina acciona el contacto */}
                <line x1={xCoil} y1={Y - 22} x2={(xC1 + xC2) / 2} y2={Y - 9}
                  stroke={colKa9} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.8} />

                {/* Contacto NC del relé KA-9: cerrado normal, ABRE con blackout (deslastre) */}
                <circle cx={xC1} cy={Y} r={2.5} fill={colKa9} />
                <circle cx={xC2} cy={Y} r={2.5} fill={colKa9} />
                <line
                  x1={xC1 + 3} y1={Y}
                  x2={climaOn ? xC2 - 3 : xC2 - 5}
                  y2={climaOn ? Y : Y - 10}
                  stroke={colKa9} strokeWidth={2.5} strokeLinecap="round"
                  style={{ transition: 'all 0.25s ease' }} />
                <text x={(xC1 + xC2) / 2} y={Y + 16} textAnchor="middle" fontSize={6.5} fontWeight={600}
                  fill={colKa9} fontFamily={FONT_MONO}>{climaOn ? 'CERR.' : 'ABIERTO'}</text>

                {/* contacto → CLIMA: energizado solo si el contacto está cerrado */}
                <Wire x1={xC2} y1={Y} x2={xBox} y2={Y} status={climaOn ? 'on' : 'off'} onColor={C_ON_H} />

                {/* Caja CLIMA */}
                <rect x={xBox} y={Y - 18} width={boxW} height={36} rx={7}
                  fill={climaOn ? 'rgba(15,157,88,0.08)' : C_INSET}
                  stroke={climaOn ? C_ON : C_MUTED} strokeWidth={2} />
                <text x={xBox + boxW / 2} y={Y - 3} textAnchor="middle" fontSize={12} fontWeight={700}
                  fill={climaOn ? C_ON : C_MUTED} fontFamily={FONT_MONO}>CLIMA</text>
                <text x={xBox + boxW / 2} y={Y + 12} textAnchor="middle" fontSize={7} fontWeight={600}
                  fill={climaOn ? C_ON : C_MUTED} fontFamily={FONT_MONO}>
                  {climaOn ? 'CONECTADO' : 'DESLASTRADO'}
                </text>
              </g>
            )
          })()}
        </svg>
      </div>
    </div>
  )
}

// ── Breaker IEC ──────────────────────────────────────────────────────────────
function Breaker({ x, y, src, inputs, onClick }: {
  x: number; y: number; src: SourceId; inputs: EngineInputs; onClick: () => void
}) {
  const s = inputs.sources[src]
  const trip   = s.breakerTrip
  const closed = s.breakerClosed && !trip
  const stateText = trip ? 'TRIP' : closed ? 'CERR.' : 'ABIERTO'
  // Gris = abierto/sin energía · Verde = cerrado · Rojo = solo falla (trip)
  const color = trip ? C_FAULT : closed ? C_ON : C_DEAD
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