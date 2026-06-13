import { useMvpStore } from '../../store/mvpStore'

interface ToggleProps {
  label: string
  active: boolean
  onToggle: () => void
  colorActive?: string
}

function Toggle({ label, active, onToggle, colorActive = 'var(--color-fault)' }: ToggleProps) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        padding: '6px 0',
        userSelect: 'none',
      }}
    >
      {/* Switch */}
      <button
        type="button"
        role="switch"
        aria-checked={active}
        onClick={onToggle}
        style={{
          width: 38,
          height: 20,
          borderRadius: 10,
          border: 'none',
          background: active ? colorActive : 'var(--color-dead)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.25s',
          flexShrink: 0,
          padding: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: active ? 20 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#f3f4f6',
            transition: 'left 0.2s',
          }}
        />
      </button>
      <span
        style={{
          fontSize: 12,
          color: active ? colorActive : 'var(--color-text-muted)',
          fontWeight: active ? 700 : 400,
          transition: 'color 0.2s',
        }}
      >
        {label}
      </span>
    </label>
  )
}

export default function ControlPanel() {
  const {
    principalCortado,
    cb1Trip,
    asimetriaPrincipal,
    togglePrincipalCortado,
    toggleCb1Trip,
    toggleAsimetriaPrincipal,
  } = useMvpStore()

  return (
    <div
      style={{
        background: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '14px 16px',
        minWidth: 220,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          marginBottom: 12,
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 8,
        }}
      >
        Entradas — PRINCIPAL
      </div>

      <Toggle
        label="Cortar energía PRINCIPAL"
        active={principalCortado}
        onToggle={togglePrincipalCortado}
      />
      <Toggle
        label="CB1 Trip"
        active={cb1Trip}
        onToggle={toggleCb1Trip}
      />
      <Toggle
        label="Asimetría PRINCIPAL"
        active={asimetriaPrincipal}
        onToggle={toggleAsimetriaPrincipal}
      />

      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border)',
          fontSize: 10,
          color: 'var(--color-text-muted)',
          lineHeight: 1.5,
        }}
      >
        Fase 0 — MVP de validación.
        <br />
        DB A y DB B siempre disponibles.
      </div>
    </div>
  )
}
