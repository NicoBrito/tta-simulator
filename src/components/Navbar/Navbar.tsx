import { useSimulatorStore } from '../../store/simulatorStore'
import type { ActiveTab } from '../../store/simulatorStore'

const TABS: { id: ActiveTab; label: string; hint: string }[] = [
  { id: 'unifilar', label: 'Vista Unifilar', hint: 'Qué pasa' },
  { id: 'flujo', label: 'Vista de Flujo', hint: 'Por qué pasa' },
]

export default function Navbar() {
  const activeTab = useSimulatorStore((s) => s.activeTab)
  const setActiveTab = useSimulatorStore((s) => s.setActiveTab)
  const mode = useSimulatorStore((s) => s.derived.mode)
  const ka9 = useSimulatorStore((s) => s.derived.ka9)
  const alarmCount = useSimulatorStore((s) => s.derived.alarms.length)

  const ok = alarmCount === 0
  const statusColor = ok ? 'var(--energized)' : 'var(--fault)'

  return (
    <header style={{
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)',
      flexShrink: 0,
    }}>
      {/* Acento superior */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, var(--brand), var(--energized))' }} />

      {/* Fila única: tabs + estado */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 18px' }}>
        {TABS.map((t) => {
          const active = activeTab === t.id
          return (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              style={{
                position: 'relative', border: 'none', background: 'transparent',
                padding: '9px 18px 10px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
              }}>
              <span style={{
                fontSize: 13.5, fontWeight: active ? 700 : 500,
                color: active ? 'var(--brand)' : 'var(--text-secondary)',
                transition: 'color 0.18s',
              }}>{t.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.hint}</span>
              <span style={{
                position: 'absolute', left: 0, right: 0, bottom: -1, height: 2.5,
                borderRadius: '2px 2px 0 0',
                background: active ? 'var(--brand)' : 'transparent',
                transition: 'background 0.18s',
              }} />
            </button>
          )
        })}

        {/* Estado a la derecha */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8 }}>
          {ka9 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 'var(--r-pill)', fontSize: 11.5, fontWeight: 600,
              background: 'var(--warn-tint)', color: 'var(--warn)', border: '1px solid var(--warn)',
              fontFamily: 'var(--font-mono)',
            }}>
              ● KA-9 ACTIVO
            </span>
          )}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 14px', borderRadius: 'var(--r-pill)', fontSize: 12, fontWeight: 600,
            background: 'var(--bg-subtle)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}>
            Modo
            <strong style={{ fontFamily: 'var(--font-mono)', color: mode === 'AUTO' ? 'var(--energized)' : 'var(--warn)' }}>
              {mode === 'FALLA_SELECTOR' ? 'FALLA SEL.' : mode}
            </strong>
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 14px', borderRadius: 'var(--r-pill)', fontSize: 12, fontWeight: 600,
            background: ok ? 'var(--energized-tint)' : 'var(--fault-tint)',
            color: statusColor, border: `1px solid ${statusColor}`,
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
