import { motion, AnimatePresence } from 'framer-motion'
import { useSimulatorStore } from '../../store/simulatorStore'
import type { AlarmId } from '../../engine'

const ALARM_TONE: Record<AlarmId, 'fault' | 'warn'> = {
  'AL-01': 'warn',
  'AL-02': 'fault',
  'AL-03': 'fault',
  'AL-04': 'fault',
  'AL-05': 'fault',
  'AL-06': 'warn',
}

export default function AlarmPanel() {
  const alarms = useSimulatorStore((s) => s.derived.alarms)
  const empty = alarms.length === 0

  return (
    <footer style={{
      flexShrink: 0, background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
      boxShadow: '0 -1px 3px rgba(15,29,51,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '9px 18px' }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--text-muted)',
          textTransform: 'uppercase', flexShrink: 0, paddingTop: 4,
        }}>
          Alarmas
        </span>

        <div className="tta-scroll" style={{
          flex: 1, display: 'flex', flexWrap: 'wrap', gap: 7,
          maxHeight: 64, overflowY: 'auto', alignItems: 'flex-start',
        }}>
          <AnimatePresence mode="popLayout">
            {empty ? (
              <motion.span key="nominal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px',
                  borderRadius: 'var(--r-pill)', background: 'var(--energized-tint)',
                  color: 'var(--energized-deep)', fontSize: 12, fontWeight: 600,
                }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--energized)' }} />
                Sistema nominal — sin alarmas
              </motion.span>
            ) : (
              alarms.map((a) => {
                const tone = ALARM_TONE[a.id]
                const fg = tone === 'fault' ? 'var(--fault-deep)' : 'var(--warn)'
                const bg = tone === 'fault' ? 'var(--fault-tint)' : 'var(--warn-tint)'
                const bd = tone === 'fault' ? 'var(--fault)' : 'var(--warn)'
                return (
                  <motion.span key={a.key} layout
                    initial={{ opacity: 0, scale: 0.92, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.18 }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px',
                      borderRadius: 'var(--r-pill)', background: bg, color: fg,
                      border: `1px solid ${bd}`, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 10 }}>{a.id}</span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    {a.mensaje}
                  </motion.span>
                )
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </footer>
  )
}
