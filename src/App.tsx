import { motion, AnimatePresence } from 'framer-motion'
import { useSimulatorStore } from './store/simulatorStore'
import Navbar from './components/Navbar/Navbar'
import SingleLineDiagram from './components/SingleLineDiagram/SingleLineDiagram'
import FlowDiagram from './components/FlowDiagram/FlowDiagram'
import AlarmPanel from './components/AlarmPanel/AlarmPanel'
import ControlPanel from './components/ControlPanel/ControlPanel'

const SRC_NAMES: Record<string, string> = { P: 'PRINCIPAL', A: 'DB A', B: 'DB B' }

// Toasts efímeros que anuncian transferencias del motor
function TransferToasts() {
  const notes = useSimulatorStore((s) => s.transferNotes)
  return (
    <div style={{
      position: 'absolute', top: 18, left: 18,
      display: 'flex', flexDirection: 'column', gap: 8, zIndex: 30, pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {notes.map((n) => {
          const energ = n.outcome === 'energizada'
          const fg = energ ? 'var(--energized-deep)' : 'var(--fault-deep)'
          const bg = energ ? 'var(--energized-tint)' : 'var(--fault-tint)'
          const bd = energ ? 'var(--energized)' : 'var(--fault)'
          return (
            <motion.div key={`${n.out}-${n.to}-${n.outcome}`}
              initial={{ opacity: 0, x: -24, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -24, scale: 0.96 }} transition={{ duration: 0.28, ease: 'easeOut' }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px',
                borderRadius: 'var(--r-md)', background: bg, color: fg,
                borderLeft: `3px solid ${bd}`, border: `1px solid ${bd}`,
                boxShadow: 'var(--shadow-md)', fontSize: 12.5, fontWeight: 600,
              }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: bd,
              }} className={energ ? undefined : 'tta-fault-blink'} />
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{n.out}</span>
              {energ && n.to
                ? <>transfirió a <strong style={{ fontFamily: 'var(--font-mono)' }}>{SRC_NAMES[n.to]}</strong></>
                : <>quedó desenergizada</>}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  const activeTab = useSimulatorStore((s) => s.activeTab)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-app)' }}>
      <Navbar />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Área de diagrama */}
        <main style={{ flex: 1, position: 'relative', padding: 14, minWidth: 0, overflow: 'hidden' }}>
          <TransferToasts />
          <AnimatePresence mode="wait">
            <motion.div key={activeTab}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ width: '100%', height: '100%' }}>
              {activeTab === 'unifilar' ? <SingleLineDiagram /> : <FlowDiagram />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Sidebar de control */}
        <ControlPanel />
      </div>

      <AlarmPanel />
    </div>
  )
}
