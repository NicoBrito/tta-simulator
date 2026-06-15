import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSimulatorStore } from '../../store/simulatorStore'
import type { OutputId, ContactorId } from '../../engine'

const RAS_OUT: Record<OutputId, string> = { S1: 'R-AS-BP', S2: 'R-AS-BA', S3: 'R-AS-BB' }

type Tone = 'good' | 'danger' | 'warn'

function tonePalette(tone: Tone) {
  if (tone === 'danger') return { bg: 'var(--fault-tint)', fg: 'var(--fault-deep)', bd: 'var(--fault)', dot: 'var(--fault)' }
  if (tone === 'warn') return { bg: 'var(--warn-tint)', fg: 'var(--warn)', bd: 'var(--warn)', dot: 'var(--warn)' }
  return { bg: 'var(--energized-tint)', fg: 'var(--energized-deep)', bd: 'var(--energized)', dot: 'var(--energized)' }
}

// ── Sección colapsable ─────────────────────────────────────────────────────────
function Section({ title, icon, badge, defaultOpen = true, children }: {
  title: string; icon: string; badge?: { text: string; tone: Tone }
  defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', marginBottom: 10, overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        padding: '11px 13px', border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.2, flex: 1 }}>
          {title}
        </span>
        {badge && (
          <span style={{
            fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--r-pill)',
            background: tonePalette(badge.tone).bg, color: tonePalette(badge.tone).fg,
            fontFamily: 'var(--font-mono)',
          }}>{badge.text}</span>
        )}
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.18 }}
          style={{ fontSize: 10, color: 'var(--text-muted)' }}>▼</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '2px 13px 13px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Chip de fila (full width) ───────────────────────────────────────────────────
function RowToggle({ label, mono, value, onChange, tone = 'good', activeText, inactiveText }: {
  label: string; mono?: boolean; value: boolean; onChange: (v: boolean) => void
  tone?: Tone; activeText?: string; inactiveText?: string
}) {
  const p = tonePalette(tone)
  const on = value
  return (
    <button type="button" onClick={() => onChange(!on)} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 11px', marginBottom: 6, borderRadius: 'var(--r-md)',
      border: `1px solid ${on ? p.bd : 'var(--border)'}`,
      background: on ? p.bg : 'var(--bg-inset)',
      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease',
    }}>
      <span style={{
        width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
        background: on ? p.dot : 'var(--dead-soft)',
      }} />
      <span style={{
        flex: 1, fontSize: 11.5, fontWeight: on ? 600 : 500,
        color: on ? p.fg : 'var(--text-secondary)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      }}>{label}</span>
      <span style={{
        fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--font-mono)',
        color: on ? p.fg : 'var(--text-muted)',
      }}>{on ? (activeText ?? 'ON') : (inactiveText ?? 'OFF')}</span>
    </button>
  )
}

// ── Pill compacto (inline) ──────────────────────────────────────────────────────
function PillToggle({ label, value, onChange, tone = 'danger' }: {
  label: string; value: boolean; onChange: (v: boolean) => void; tone?: Tone
}) {
  const p = tonePalette(tone)
  return (
    <button type="button" onClick={() => onChange(!value)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 10px', borderRadius: 'var(--r-pill)',
      border: `1px solid ${value ? p.bd : 'var(--border)'}`,
      background: value ? p.bg : 'var(--bg-inset)',
      color: value ? p.fg : 'var(--text-muted)',
      cursor: 'pointer', fontSize: 10.5, fontWeight: 600, fontFamily: 'var(--font-mono)',
      transition: 'all 0.15s ease',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: value ? p.dot : 'var(--dead-soft)' }} />
      {label}
    </button>
  )
}


const CONTACTORS_BY_OUTPUT: Record<OutputId, ContactorId[]> = {
  S1: ['KM1-P', 'KM1-A', 'KM1-B'],
  S2: ['KM2-P', 'KM2-A', 'KM2-B'],
  S3: ['KM3-P', 'KM3-A', 'KM3-B'],
}

// ── Panel principal ────────────────────────────────────────────────────────────
export default function ControlPanel() {
  const inputs = useSimulatorStore((s) => s.inputs)
  const derived = useSimulatorStore((s) => s.derived)
  const setMode = useSimulatorStore((s) => s.setMode)
  const setBlackout = useSimulatorStore((s) => s.setBlackout)
  const setOutputAsymmetry = useSimulatorStore((s) => s.setOutputAsymmetry)
  const setContactorFault = useSimulatorStore((s) => s.setContactorFault)
  const reset = useSimulatorStore((s) => s.reset)

  const mode = inputs.modeSelector
  const isFalla = mode === 'FALLA_SELECTOR'

  const faultCount = Object.values(inputs.contactorFaults).filter(Boolean).length

  return (
    <aside className="tta-scroll" style={{
      width: 308, flexShrink: 0, height: '100%', overflowY: 'auto',
      padding: '12px 10px', background: 'var(--bg-app)',
    }}>
      {/* ── RESET ── accesible en la parte superior */}
      <button type="button" onClick={reset} style={{
        width: '100%', padding: '11px 0', borderRadius: 'var(--r-md)',
        border: '1.5px solid var(--brand)', background: 'var(--brand-tint)',
        color: 'var(--brand)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        boxShadow: 'var(--shadow-sm)', transition: 'all 0.15s',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#d4e2fc' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand-tint)' }}>
        ↺ Reiniciar estado nominal
      </button>

      {/* ── MODO ── */}
      <Section title="Modo de operación" icon="⚙️"
        badge={isFalla ? { text: 'FALLA SELECTOR', tone: 'warn' } : undefined}>
        <div style={{
          display: 'flex', gap: 4, padding: 3, background: 'var(--bg-subtle)',
          borderRadius: 'var(--r-md)', marginBottom: 8,
        }}>
          {(['AUTO', 'MANUAL'] as const).map((m) => {
            const active = mode === m
            return (
              <button key={m} type="button" onClick={() => setMode(m)} style={{
                flex: 1, padding: '9px 0', borderRadius: 'var(--r-sm)', border: 'none',
                background: active ? 'var(--bg-surface)' : 'transparent',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                color: active ? 'var(--brand)' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
              }}>{m}</button>
            )
          })}
        </div>
        <RowToggle label="Simular falla de selector (DI12 = DI13)" tone="warn"
          value={isFalla} onChange={(v) => setMode(v ? 'FALLA_SELECTOR' : 'AUTO')}
          activeText="ALARMA" inactiveText="OK" />
        {mode === 'MANUAL' && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            En MANUAL el operador comanda los KM; el motor no ejecuta transferencia automática.
          </div>
        )}
      </Section>

      {/* ── BLACKOUT ── */}
      <Section title="Blackout / clima" icon="🌩️"
        badge={derived.ka9 ? { text: 'KA-9 ON', tone: 'warn' } : undefined}>
        <RowToggle label="Señal BLACKOUT activa" tone="warn"
          value={inputs.blackout} onChange={setBlackout} activeText="ON" inactiveText="OFF" />
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {derived.ka9
            ? 'KA-9 energizado: bota la carga de clima no crítica (RN-05).'
            : 'Sin blackout: KA-9 desactivado.'}
        </div>
      </Section>

      {/* ── ASIMETRÍA SALIDAS ── */}
      <Section title="Asimetría barras de salida" icon="📊" defaultOpen={false}>
        {(['S1', 'S2', 'S3'] as OutputId[]).map((out) => (
          <RowToggle key={out} mono label={`${RAS_OUT[out]} · ${out}`}
            value={inputs.outputs[out].outputAsymmetryOk}
            onChange={(v) => setOutputAsymmetry(out, v)}
            activeText="OK" inactiveText="FALLA"
            tone={inputs.outputs[out].outputAsymmetryOk ? 'good' : 'warn'} />
        ))}
      </Section>

      {/* ── FALLA CONTACTORES ── */}
      <Section title="Falla de contactores" icon="⚠️" defaultOpen={false}
        badge={faultCount > 0 ? { text: `${faultCount}`, tone: 'danger' } : undefined}>
        {(['S1', 'S2', 'S3'] as OutputId[]).map((out) => (
          <div key={out} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, fontFamily: 'var(--font-mono)' }}>{out}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {CONTACTORS_BY_OUTPUT[out].map((km) => (
                <PillToggle key={km} label={km} value={inputs.contactorFaults[km] ?? false}
                  onChange={(v) => setContactorFault(km, v)} />
              ))}
            </div>
          </div>
        ))}
      </Section>

    </aside>
  )
}
