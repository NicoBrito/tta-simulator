import { useSimulatorStore } from '../../store/simulatorStore'
import { isAvailablePure } from '../../engine'
import type { SourceId } from '../../engine'

const SOURCE_NAMES: Record<SourceId, string> = { P: 'PRINCIPAL', A: 'DB A', B: 'DB B' }
const SOURCE_SUB: Record<SourceId, string> = { P: 'Ducto Territorio', A: 'Enel · Ducto A', B: 'Enel · Ducto B' }
const CB_NUMS: Record<SourceId, string> = { P: 'CB1', A: 'CB2', B: 'CB3' }

// Símbolo esquemático del contacto del breaker
function BreakerSVG({ closed, color }: { closed: boolean; color: string }) {
  return (
    <svg width="26" height="16" viewBox="0 0 26 16" style={{ display: 'block' }}>
      <circle cx={2} cy={8} r={2.5} fill={color} />
      <circle cx={24} cy={8} r={2.5} fill={color} />
      <line x1={4.5} y1={8} x2={closed ? 21.5 : 21} y2={closed ? 8 : 2.5}
        stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  )
}

interface CtrlBtnProps {
  topLabel: string
  icon: React.ReactNode
  stateLabel: string
  isActive: boolean
  isFault?: boolean
  isWarn?: boolean
  title: string
  onClick: () => void
}

function CtrlBtn({ topLabel, icon, stateLabel, isActive, isFault, isWarn, title, onClick }: CtrlBtnProps) {
  const borderColor = isFault ? 'var(--fault)'
    : isWarn ? 'var(--warn)'
    : isActive ? 'var(--energized)'
    : 'var(--border)'
  const bgColor = isFault ? 'var(--fault-tint)'
    : isWarn ? 'var(--warn-tint)'
    : isActive ? 'var(--energized-tint)'
    : 'var(--bg-inset)'
  const iconColor = isFault ? 'var(--fault)'
    : isWarn ? 'var(--warn)'
    : isActive ? 'var(--energized)'
    : 'var(--dead)'
  const stateColor = isFault ? 'var(--fault-deep)'
    : isWarn ? 'var(--warn)'
    : isActive ? 'var(--energized-deep)'
    : 'var(--text-muted)'

  return (
    <button type="button" title={title} onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      gap: 2, padding: '5px 4px', flex: 1, height: 54, minWidth: 0,
      border: `1.5px solid ${borderColor}`,
      borderRadius: 'var(--r-md)',
      background: bgColor,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    }}>
      <span style={{
        fontSize: 7.5, fontWeight: 700, color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)', letterSpacing: 0.2,
      }}>
        {topLabel}
      </span>
      <span style={{
        color: iconColor, fontSize: 15, lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </span>
      <span style={{
        fontSize: 7.5, fontWeight: 700, color: stateColor,
        fontFamily: 'var(--font-mono)', letterSpacing: 0.1,
      }}>
        {stateLabel}
      </span>
    </button>
  )
}

export default function SourceInputPanel() {
  const inputs = useSimulatorStore((s) => s.inputs)
  const setSourceUpstream = useSimulatorStore((s) => s.setSourceUpstream)
  const setSourceBreakerClosed = useSimulatorStore((s) => s.setSourceBreakerClosed)
  const setSourceBreakerTrip = useSimulatorStore((s) => s.setSourceBreakerTrip)
  const setSourceAsymmetry = useSimulatorStore((s) => s.setSourceAsymmetry)

  return (
    <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
      {(['P', 'A', 'B'] as SourceId[]).map((src) => {
        const s = inputs.sources[src]
        const available = isAvailablePure(inputs, src)
        const cbNum = CB_NUMS[src]
        const cbIconColor = s.breakerClosed ? 'var(--energized)' : 'var(--dead)'

        return (
          <div key={src} style={{
            flex: 1, padding: '7px 10px',
            background: 'var(--bg-surface)',
            border: `1.5px solid ${available ? 'var(--energized)' : s.breakerTrip ? 'var(--fault)' : 'var(--border)'}`,
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {/* Encabezado de fuente */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                background: available ? 'var(--energized)' : s.breakerTrip ? 'var(--fault)' : 'var(--dead)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)', letterSpacing: 0.3,
                }}>
                  {SOURCE_NAMES[src]}
                </div>
                <div style={{
                  fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {SOURCE_SUB[src]}
                </div>
              </div>
              <span style={{
                fontSize: 8.5, fontWeight: 700, fontFamily: 'var(--font-mono)',
                padding: '2px 8px', borderRadius: 'var(--r-pill)', flexShrink: 0,
                background: available ? 'var(--energized-tint)' : 'var(--bg-subtle)',
                color: available ? 'var(--energized-deep)' : 'var(--text-muted)',
                border: `1px solid ${available ? 'var(--energized)' : 'var(--border)'}`,
              }}>
                {available ? '✓ DISPON.' : '✗ NO DISP.'}
              </span>
            </div>

            {/* Botones de control */}
            <div style={{ display: 'flex', gap: 5 }}>
              {/* 1 — Energía aguas arriba */}
              <CtrlBtn
                topLabel="ENERGÍA"
                icon="⚡"
                stateLabel={s.upstreamEnergized ? 'ALIM.' : 'CORTADO'}
                isActive={s.upstreamEnergized}
                isFault={!s.upstreamEnergized}
                title={s.upstreamEnergized
                  ? `Cortar energía ${SOURCE_NAMES[src]}`
                  : `Restaurar energía ${SOURCE_NAMES[src]}`}
                onClick={() => setSourceUpstream(src, !s.upstreamEnergized)}
              />

              {/* 2 — Breaker cerrado / abierto (C-AUX) */}
              <CtrlBtn
                topLabel={cbNum}
                icon={<BreakerSVG closed={s.breakerClosed} color={cbIconColor} />}
                stateLabel={s.breakerClosed ? 'CERR.' : 'ABIERTO'}
                isActive={s.breakerClosed}
                title={s.breakerClosed ? `Abrir ${cbNum}` : `Cerrar ${cbNum}`}
                onClick={() => setSourceBreakerClosed(src, !s.breakerClosed)}
              />

              {/* 3 — Falla / Trip */}
              <CtrlBtn
                topLabel="TRIP"
                icon="⚠"
                stateLabel={s.breakerTrip ? 'ACTIVO' : 'NORMAL'}
                isActive={false}
                isFault={s.breakerTrip}
                title={s.breakerTrip ? `Quitar falla ${cbNum}` : `Simular trip ${cbNum}`}
                onClick={() => setSourceBreakerTrip(src, !s.breakerTrip)}
              />

              {/* 4 — Asimetría de barra de entrada (R-AS) */}
              <CtrlBtn
                topLabel="R-AS"
                icon={s.asymmetryOk ? '≈' : '≠'}
                stateLabel={s.asymmetryOk ? 'SIM. OK' : 'ASIM.'}
                isActive={s.asymmetryOk}
                isWarn={!s.asymmetryOk}
                title={s.asymmetryOk
                  ? `Simular asimetría ${SOURCE_NAMES[src]}`
                  : `Restaurar simetría ${SOURCE_NAMES[src]}`}
                onClick={() => setSourceAsymmetry(src, !s.asymmetryOk)}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
