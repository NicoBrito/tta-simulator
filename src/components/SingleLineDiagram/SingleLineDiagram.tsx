import { motion } from 'framer-motion'
import { useMvpStore } from '../../store/mvpStore'

// Paleta según estado
const C_OK = 'var(--color-energized)'
const C_DEAD = 'var(--color-dead)'
const C_FAULT = 'var(--color-fault)'
const C_BG = 'var(--color-bg-panel)'
const C_TEXT = 'var(--color-text-label)'
const C_BORDER = 'var(--color-border)'

// Columnas x-center para cada fuente
const COL = { P: 140, A: 340, B: 540 }
// Filas y para cada salida
const ROW = { S1: 310, S2: 430, S3: 550 }
// Y del bus principal
const BUS_Y = 200

function colorP(cortado: boolean, trip: boolean, asim: boolean): string {
  if (trip || asim) return C_FAULT
  if (cortado) return C_DEAD
  return C_OK
}

// Breaker dibujado como rectángulo rotulado
function Breaker({
  x, y, label, color, text,
}: { x: number; y: number; label: string; color: string; text: string }) {
  return (
    <g>
      <motion.rect
        x={x - 22} y={y} width={44} height={32}
        rx={4}
        fill={C_BG}
        stroke={color}
        strokeWidth={2}
        animate={{ stroke: color }}
        transition={{ duration: 0.4 }}
      />
      <text x={x} y={y + 12} textAnchor="middle" fontSize={8} fill={color} fontWeight="bold">
        {label}
      </text>
      <motion.text
        x={x} y={y + 25} textAnchor="middle" fontSize={7} fill={color}
        animate={{ fill: color }} transition={{ duration: 0.4 }}
      >
        {text}
      </motion.text>
    </g>
  )
}

// Contactor: cuadrado con indicador de estado
function Contactor({
  x, y, label, color, closed,
}: { x: number; y: number; label: string; color: string; closed: boolean }) {
  return (
    <g>
      <motion.circle
        cx={x} cy={y} r={13}
        fill={C_BG}
        stroke={color}
        strokeWidth={2}
        animate={{ stroke: color }}
        transition={{ duration: 0.4 }}
      />
      <motion.circle
        cx={x} cy={y} r={closed ? 7 : 3}
        fill={color}
        animate={{ fill: color, r: closed ? 7 : 3 }}
        transition={{ duration: 0.3 }}
      />
      <text x={x} y={y + 24} textAnchor="middle" fontSize={7.5} fill={C_TEXT}>
        {label}
      </text>
    </g>
  )
}

// Línea vertical animada
function VLine({
  x, y1, y2, color,
}: { x: number; y1: number; y2: number; color: string }) {
  return (
    <motion.line
      x1={x} y1={y1} x2={x} y2={y2}
      stroke={color}
      strokeWidth={2.5}
      animate={{ stroke: color }}
      transition={{ duration: 0.4 }}
    />
  )
}

// Línea horizontal animada
function HLine({
  x1, x2, y, color,
}: { x1: number; x2: number; y: number; color: string }) {
  return (
    <motion.line
      x1={x1} y1={y} x2={x2} y2={y}
      stroke={color}
      strokeWidth={2.5}
      animate={{ stroke: color }}
      transition={{ duration: 0.4 }}
    />
  )
}

export default function SingleLineDiagram() {
  const { principalCortado, cb1Trip, asimetriaPrincipal } = useMvpStore()

  const pColor = colorP(principalCortado, cb1Trip, asimetriaPrincipal)
  const aColor = C_OK
  const bColor = C_OK

  // Disponibilidad de cada fuente (simplificado para MVP)
  const pDisp = !principalCortado && !cb1Trip && !asimetriaPrincipal
  const aDisp = true
  const bDisp = true

  // Estado nominal: S1→P, S2→P, S3→A
  // Para MVP solo dibujamos estado nominal, el color de P refleja fallas
  const s1Color = pDisp ? C_OK : aDisp ? C_OK : C_DEAD
  const s2Color = pDisp ? C_OK : aDisp ? C_OK : C_DEAD
  const s3Color = aDisp ? C_OK : bDisp ? C_OK : C_DEAD

  // CB1 text
  const cb1Text = cb1Trip ? 'TRIP' : 'CERR.'
  const cb1Color = cb1Trip ? C_FAULT : pColor

  return (
    <svg
      viewBox="0 0 700 640"
      width="100%"
      style={{ background: C_BG, borderRadius: 8, border: `1px solid ${C_BORDER}` }}
      role="img"
      aria-label="Diagrama unifilar TTA"
    >
      {/* ── Título ── */}
      <text x={350} y={28} textAnchor="middle" fontSize={13} fill={C_TEXT} fontWeight="bold" letterSpacing={1}>
        TABLERO DE TRANSFERENCIA AUTOMÁTICA — TTA
      </text>

      {/* ══ FUENTES (etiquetas + conductor de llegada) ══ */}
      {/* PRINCIPAL */}
      <text x={COL.P} y={58} textAnchor="middle" fontSize={10} fill={pColor} fontWeight="bold">PRINCIPAL</text>
      <VLine x={COL.P} y1={62} y2={88} color={pColor} />

      {/* DB A */}
      <text x={COL.A} y={58} textAnchor="middle" fontSize={10} fill={aColor} fontWeight="bold">DB A</text>
      <VLine x={COL.A} y1={62} y2={88} color={aColor} />

      {/* DB B */}
      <text x={COL.B} y={58} textAnchor="middle" fontSize={10} fill={bColor} fontWeight="bold">DB B</text>
      <VLine x={COL.B} y1={62} y2={88} color={bColor} />

      {/* ══ BREAKERS ══ */}
      <Breaker x={COL.P} y={88} label="CB1" color={cb1Color} text={cb1Text} />
      <Breaker x={COL.A} y={88} label="CB2" color={aColor} text="CERR." />
      <Breaker x={COL.B} y={88} label="CB3" color={bColor} text="CERR." />

      {/* Conductores CB → bus */}
      <VLine x={COL.P} y1={120} y2={BUS_Y} color={cb1Color} />
      <VLine x={COL.A} y1={120} y2={BUS_Y} color={aColor} />
      <VLine x={COL.B} y1={120} y2={BUS_Y} color={bColor} />

      {/* ══ BUS PRINCIPAL ══ */}
      <HLine x1={80} x2={620} y={BUS_Y} color={C_BORDER} />
      <motion.line
        x1={80} y1={BUS_Y} x2={COL.P - 1} y2={BUS_Y}
        stroke={cb1Color} strokeWidth={5}
        animate={{ stroke: cb1Color }} transition={{ duration: 0.4 }}
      />
      <motion.line
        x1={COL.P + 1} y1={BUS_Y} x2={COL.A - 1} y2={BUS_Y}
        stroke={aColor} strokeWidth={5}
        animate={{ stroke: aColor }} transition={{ duration: 0.4 }}
      />
      <motion.line
        x1={COL.A + 1} y1={BUS_Y} x2={COL.B - 1} y2={BUS_Y}
        stroke={aColor} strokeWidth={5}
        animate={{ stroke: aColor }} transition={{ duration: 0.4 }}
      />
      <motion.line
        x1={COL.B + 1} y1={BUS_Y} x2={620} y2={BUS_Y}
        stroke={bColor} strokeWidth={5}
        animate={{ stroke: bColor }} transition={{ duration: 0.4 }}
      />

      {/* Etiqueta bus */}
      <text x={72} y={BUS_Y - 6} textAnchor="end" fontSize={8} fill={C_TEXT}>BUS</text>

      {/* ══ BAJADAS DEL BUS A CONTACTORES ══ */}
      {/* Columna P */}
      <VLine x={COL.P} y1={BUS_Y} y2={ROW.S1 - 14} color={cb1Color} />
      <VLine x={COL.P} y1={ROW.S1 + 14} y2={ROW.S2 - 14} color={cb1Color} />
      <VLine x={COL.P} y1={ROW.S2 + 14} y2={ROW.S3 - 14} color={C_DEAD} />
      {/* nota: no hay KM3-P, la columna P termina en S2 */}

      {/* Columna A */}
      <VLine x={COL.A} y1={BUS_Y} y2={ROW.S1 - 14} color={aColor} />
      <VLine x={COL.A} y1={ROW.S1 + 14} y2={ROW.S2 - 14} color={aColor} />
      <VLine x={COL.A} y1={ROW.S2 + 14} y2={ROW.S3 - 14} color={aColor} />

      {/* Columna B */}
      <VLine x={COL.B} y1={BUS_Y} y2={ROW.S1 - 14} color={bColor} />
      <VLine x={COL.B} y1={ROW.S1 + 14} y2={ROW.S2 - 14} color={bColor} />
      <VLine x={COL.B} y1={ROW.S2 + 14} y2={ROW.S3 - 14} color={bColor} />

      {/* ══ CONTACTORES (estado nominal: S1→KM1-P, S2→KM2-P, S3→KM3-A) ══ */}
      {/* S1: KM1-P cerrado, KM1-A y KM1-B abiertos */}
      <Contactor x={COL.P} y={ROW.S1} label="KM1-P" color={pDisp ? C_OK : C_DEAD} closed={pDisp} />
      <Contactor x={COL.A} y={ROW.S1} label="KM1-A" color={C_DEAD} closed={false} />
      <Contactor x={COL.B} y={ROW.S1} label="KM1-B" color={C_DEAD} closed={false} />

      {/* S2: KM2-P cerrado, KM2-A y KM2-B abiertos */}
      <Contactor x={COL.P} y={ROW.S2} label="KM2-P" color={pDisp ? C_OK : C_DEAD} closed={pDisp} />
      <Contactor x={COL.A} y={ROW.S2} label="KM2-A" color={C_DEAD} closed={false} />
      <Contactor x={COL.B} y={ROW.S2} label="KM2-B" color={C_DEAD} closed={false} />

      {/* S3: sin KM3-P; KM3-A cerrado, KM3-B abierto */}
      {/* Marca de "sin contactor" en columna P para S3 */}
      <line x1={COL.P - 10} y1={ROW.S3 - 8} x2={COL.P + 10} y2={ROW.S3 + 8} stroke={C_BORDER} strokeWidth={1.5} />
      <line x1={COL.P + 10} y1={ROW.S3 - 8} x2={COL.P - 10} y2={ROW.S3 + 8} stroke={C_BORDER} strokeWidth={1.5} />
      <Contactor x={COL.A} y={ROW.S3} label="KM3-A" color={aDisp ? C_OK : C_DEAD} closed={aDisp} />
      <Contactor x={COL.B} y={ROW.S3} label="KM3-B" color={C_DEAD} closed={false} />

      {/* ══ BARRAS DE SALIDA (horizontales) ══ */}
      {/* S1 */}
      <HLine x1={COL.P} x2={620} y={ROW.S1 + 30} color={s1Color} />
      <VLine x={COL.P} y1={ROW.S1 + 14} y2={ROW.S1 + 30} color={pDisp ? C_OK : C_DEAD} />
      <VLine x={COL.A} y1={ROW.S1 + 14} y2={ROW.S1 + 30} color={C_DEAD} />
      <VLine x={COL.B} y1={ROW.S1 + 14} y2={ROW.S1 + 30} color={C_DEAD} />

      {/* S2 */}
      <HLine x1={COL.P} x2={620} y={ROW.S2 + 30} color={s2Color} />
      <VLine x={COL.P} y1={ROW.S2 + 14} y2={ROW.S2 + 30} color={pDisp ? C_OK : C_DEAD} />
      <VLine x={COL.A} y1={ROW.S2 + 14} y2={ROW.S2 + 30} color={C_DEAD} />
      <VLine x={COL.B} y1={ROW.S2 + 14} y2={ROW.S2 + 30} color={C_DEAD} />

      {/* S3 */}
      <HLine x1={COL.A} x2={620} y={ROW.S3 + 30} color={s3Color} />
      <VLine x={COL.A} y1={ROW.S3 + 14} y2={ROW.S3 + 30} color={aDisp ? C_OK : C_DEAD} />
      <VLine x={COL.B} y1={ROW.S3 + 14} y2={ROW.S3 + 30} color={C_DEAD} />

      {/* ══ ETIQUETAS DE SALIDA ══ */}
      <SalidaLabel x={628} y={ROW.S1 + 30} label="S1" amps="100A" fteLabel="FTE P" color={s1Color} />
      <SalidaLabel x={628} y={ROW.S2 + 30} label="S2" amps="25A" fteLabel="FTE P" color={s2Color} />
      <SalidaLabel x={628} y={ROW.S3 + 30} label="S3" amps="10A" fteLabel="FTE A" color={s3Color} />

      {/* ══ ETIQUETAS DE FILAS ══ */}
      <text x={72} y={ROW.S1 + 4} textAnchor="end" fontSize={8.5} fill={C_TEXT} fontWeight="bold">S1</text>
      <text x={72} y={ROW.S2 + 4} textAnchor="end" fontSize={8.5} fill={C_TEXT} fontWeight="bold">S2</text>
      <text x={72} y={ROW.S3 + 4} textAnchor="end" fontSize={8.5} fill={C_TEXT} fontWeight="bold">S3</text>

      {/* ══ LEYENDA ══ */}
      <g transform="translate(20, 610)">
        <circle cx={8} cy={8} r={5} fill={C_OK} />
        <text x={16} y={12} fontSize={9} fill={C_TEXT}>Con energía</text>
        <circle cx={100} cy={8} r={5} fill={C_DEAD} />
        <text x={108} y={12} fontSize={9} fill={C_TEXT}>Sin energía</text>
        <circle cx={195} cy={8} r={5} fill={C_FAULT} />
        <text x={203} y={12} fontSize={9} fill={C_TEXT}>Falla</text>
      </g>
    </svg>
  )
}

function SalidaLabel({
  x, y, label, amps, fteLabel, color,
}: { x: number; y: number; label: string; amps: string; fteLabel: string; color: string }) {
  return (
    <g>
      <motion.rect
        x={x} y={y - 18} width={68} height={36} rx={4}
        fill={C_BG} stroke={color} strokeWidth={1.5}
        animate={{ stroke: color }} transition={{ duration: 0.4 }}
      />
      <text x={x + 34} y={y - 6} textAnchor="middle" fontSize={9} fill={color} fontWeight="bold">
        {label} — {amps}
      </text>
      <motion.text
        x={x + 34} y={y + 8} textAnchor="middle" fontSize={8} fill={color}
        animate={{ fill: color }} transition={{ duration: 0.4 }}
      >
        ◄ {fteLabel}
      </motion.text>
    </g>
  )
}
