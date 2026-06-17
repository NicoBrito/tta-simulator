import { useSimulatorStore } from '../../store/simulatorStore'
import type { ActiveTab } from '../../store/simulatorStore'

const TABS: { id: ActiveTab; label: string; hint: string }[] = [
  { id: 'unifilar', label: 'Vista Unifilar', hint: 'Qué pasa' },
  { id: 'flujo', label: 'Vista de Flujo', hint: 'Por qué pasa' },
]

// Acentos legibles sobre el chrome navy
const BRAND_LIGHT = '#5b8def'
const GREEN_LIGHT = '#34d399'
const RED_LIGHT = '#f87171'
const AMBER_LIGHT = '#fbbf24'

export default function Navbar() {
  const activeTab = useSimulatorStore((s) => s.activeTab)
  const setActiveTab = useSimulatorStore((s) => s.setActiveTab)
  const mode = useSimulatorStore((s) => s.derived.mode)
  const ka9 = useSimulatorStore((s) => s.derived.ka9)
  const alarmCount = useSimulatorStore((s) => s.derived.alarms.length)

  const ok = alarmCount === 0
  const statusColor = ok ? GREEN_LIGHT : RED_LIGHT

  return (
    <header style={{
      background: 'var(--ink)',
      boxShadow: 'var(--shadow-md)',
      flexShrink: 0,
      position: 'relative',
      zIndex: 20,
    }}>
      {/* Acento superior de marca (sin verde, reservado para "energizado") */}
      <div style={{ height: 3, background: `linear-gradient(90deg, var(--brand), ${BRAND_LIGHT})` }} />

      {/* Fila única: tabs + estado */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 18px' }}>
        {TABS.map((t) => {
          const active = activeTab === t.id
          return (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              style={{
                position: 'relative', border: 'none', background: 'transparent',
                padding: '10px 18px 11px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
              }}>
              <span style={{
                fontSize: 13.5, fontWeight: active ? 700 : 500,
                color: active ? 'var(--on-ink)' : 'var(--on-ink-muted)',
                transition: 'color 0.18s',
              }}>{t.label}</span>
              <span style={{ fontSize: 10, color: 'var(--on-ink-muted)', opacity: active ? 0.9 : 0.6 }}>{t.hint}</span>
              <span style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, height: 3,
                borderRadius: '3px 3px 0 0',
                background: active ? BRAND_LIGHT : 'transparent',
                transition: 'background 0.18s',
              }} />
            </button>
          )
        })}

        {/* Estado a la derecha */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 8 }}>
          {ka9 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 'var(--r-pill)', fontSize: 11.5, fontWeight: 700,
              background: 'rgba(217,119,6,0.18)', color: AMBER_LIGHT, border: '1px solid rgba(217,119,6,0.5)',
              fontFamily: 'var(--font-mono)',
            }}>
              ● KA-9 ACTIVO
            </span>
          )}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 14px', borderRadius: 'var(--r-pill)', fontSize: 12, fontWeight: 600,
            background: 'var(--ink-soft)', color: 'var(--on-ink-muted)',
            border: '1px solid var(--ink-line)',
          }}>
            Modo
            <strong style={{ fontFamily: 'var(--font-mono)', color: mode === 'AUTO' ? GREEN_LIGHT : AMBER_LIGHT }}>
              {mode === 'FALLA_SELECTOR' ? 'FALLA SEL.' : mode}
            </strong>
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 14px', borderRadius: 'var(--r-pill)', fontSize: 12, fontWeight: 600,
            background: ok ? 'rgba(15,157,88,0.18)' : 'rgba(224,36,36,0.18)',
            color: statusColor, border: `1px solid ${ok ? 'rgba(15,157,88,0.5)' : 'rgba(224,36,36,0.55)'}`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }}
              className={ok ? undefined : 'tta-fault-blink'} />
            {ok ? 'Sistema nominal' : `${alarmCount} alarma${alarmCount > 1 ? 's' : ''}`}
          </span>
        </div>
      </div>
    </header>
  )
}
