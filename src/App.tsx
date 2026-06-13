import { useMvpStore } from './store/mvpStore'
import SingleLineDiagram from './components/SingleLineDiagram/SingleLineDiagram'
import FlowDiagram from './components/FlowDiagram/FlowDiagram'
import AlarmPanel from './components/AlarmPanel/AlarmPanel'
import ControlPanel from './components/ControlPanel/ControlPanel'

function TabButton({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 24px',
        border: 'none',
        borderBottom: active ? '2px solid var(--color-energized)' : '2px solid transparent',
        background: 'transparent',
        color: active ? 'var(--color-energized)' : 'var(--color-text-muted)',
        fontWeight: active ? 700 : 400,
        fontSize: 13,
        cursor: 'pointer',
        letterSpacing: 0.5,
        transition: 'color 0.2s, border-color 0.2s',
      }}
    >
      {label}
    </button>
  )
}

export default function App() {
  const { activeTab, setActiveTab } = useMvpStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg-surface)' }}>
      {/* ── Header ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '8px 20px 0',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-panel)',
          flexShrink: 0,
        }}
      >
        <div style={{ marginRight: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: 0.5 }}>
            SIMULADOR TTA
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 1 }}>
            TRANSFERENCIA AUTOMÁTICA — 220V / 50Hz
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0 }}>
          <TabButton
            label="⚡ Unifilar"
            active={activeTab === 'unifilar'}
            onClick={() => setActiveTab('unifilar')}
          />
          <TabButton
            label="◈ Flujo"
            active={activeTab === 'flujo'}
            onClick={() => setActiveTab('flujo')}
          />
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>
          Fase 0 — MVP
        </div>
      </header>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Diagrama (ocupa el espacio disponible) */}
        <div style={{ flex: 1, padding: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'unifilar' ? (
            <SingleLineDiagram />
          ) : (
            <FlowDiagram />
          )}
        </div>

        {/* Panel de control (solo visible con el unifilar, pero los toggles afectan ambas vistas) */}
        <div
          style={{
            padding: 12,
            flexShrink: 0,
            overflowY: 'auto',
          }}
        >
          <ControlPanel />
        </div>
      </div>

      {/* ── Alarmas ── */}
      <AlarmPanel />
    </div>
  )
}
