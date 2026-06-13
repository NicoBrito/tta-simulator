import { motion, AnimatePresence } from 'framer-motion'
import { useMvpStore } from '../../store/mvpStore'

interface Alarm {
  id: string
  mensaje: string
}

export default function AlarmPanel() {
  const { principalCortado, cb1Trip, asimetriaPrincipal } = useMvpStore()

  const alarmas: Alarm[] = []
  if (principalCortado) {
    alarmas.push({ id: 'AL-01', mensaje: 'PRINCIPAL sin tensión en aguas arriba' })
  }
  if (cb1Trip) {
    alarmas.push({ id: 'AL-02', mensaje: 'CB1 (PRINCIPAL) en estado TRIP' })
  }
  if (asimetriaPrincipal) {
    alarmas.push({ id: 'AL-03', mensaje: 'Asimetría de tensión detectada en PRINCIPAL' })
  }

  return (
    <div
      className="border-t"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-bg-panel)',
        padding: '10px 16px',
        minHeight: 48,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          marginRight: 12,
        }}
      >
        Alarmas activas:
      </span>

      <AnimatePresence>
        {alarmas.length === 0 ? (
          <motion.span
            key="nominal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ color: 'var(--color-energized)', fontSize: 12 }}
          >
            Sistema nominal — sin alarmas
          </motion.span>
        ) : (
          alarmas.map((a) => (
            <motion.span
              key={a.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'inline-block',
                marginRight: 16,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(239,68,68,0.15)',
                color: 'var(--color-fault)',
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid var(--color-fault)',
              }}
            >
              ⚠ {a.id}: {a.mensaje}
            </motion.span>
          ))
        )}
      </AnimatePresence>
    </div>
  )
}
