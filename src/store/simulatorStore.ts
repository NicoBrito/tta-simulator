import { create } from 'zustand'
import { nominalInputs, step, trace } from '../engine'
import type { EngineInputs, TtaState, FlowTrace, SourceId, OutputId, ContactorId } from '../engine'

export type ActiveTab = 'unifilar' | 'flujo'

export interface TransferNote {
  out: OutputId
  from: SourceId | null
  to: SourceId | null
  outcome: 'energizada' | 'desenergizada'
}

interface SimulatorStore {
  inputs: EngineInputs
  derived: TtaState
  flowTrace: FlowTrace
  activeTab: ActiveTab

  // Estado transitorio (UI): salidas que acaban de cambiar de fuente/estado
  transitioning: OutputId[]
  transferNotes: TransferNote[]

  setActiveTab: (tab: ActiveTab) => void
  setMode: (mode: EngineInputs['modeSelector']) => void
  setBlackout: (v: boolean) => void
  setSourceUpstream: (src: SourceId, v: boolean) => void
  // Dos contactos auxiliares independientes del breaker (según "Modo funcionamiento TTA")
  setSourceBreakerClosed: (src: SourceId, closed: boolean) => void
  setSourceBreakerTrip: (src: SourceId, trip: boolean) => void
  setSourceAsymmetry: (src: SourceId, ok: boolean) => void
  setOutputPref: (out: OutputId, index: number, src: SourceId) => void
  setOutputAsymmetry: (out: OutputId, ok: boolean) => void
  setContactorFault: (km: ContactorId, fault: boolean) => void
  reset: () => void

  // Acciones de conveniencia para interacción directa en el SVG
  toggleSourceUpstream: (src: SourceId) => void
  toggleBreaker: (src: SourceId) => void
  toggleOutputAsymmetry: (out: OutputId) => void
  // Maniobra manual de contactores — src=null significa posición OFF (todos los KM abiertos)
  toggleManualContactor: (out: OutputId, src: SourceId | null) => void
}

let pulseTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

const OUTPUTS: OutputId[] = ['S1', 'S2', 'S3']

// Diferencia el estado previo y el nuevo para detectar transferencias
function diffTransitions(prev: TtaState, next: TtaState): {
  ids: OutputId[]
  notes: TransferNote[]
} {
  const ids: OutputId[] = []
  const notes: TransferNote[] = []
  for (const out of OUTPUTS) {
    const before = prev.connected[out]
    const after = next.connected[out]
    const wasEnergized = prev.energized[out]
    const isEnergized = next.energized[out]
    if (before !== after || wasEnergized !== isEnergized) {
      ids.push(out)
      notes.push({
        out,
        from: before,
        to: after,
        outcome: isEnergized ? 'energizada' : 'desenergizada',
      })
    }
  }
  return { ids, notes }
}

const INIT_INPUTS = nominalInputs()

export const useSimulatorStore = create<SimulatorStore>((set, get) => {
  // Aplica nuevos inputs, recalcula el motor y marca las transiciones
  function apply(inputs: EngineInputs) {
    const prev = get().derived
    const next = step(inputs)
    const { ids, notes } = diffTransitions(prev, next)

    set({ inputs, derived: next, flowTrace: trace(inputs), transitioning: ids, transferNotes: notes })

    if (pulseTimer) clearTimeout(pulseTimer)
    if (toastTimer) clearTimeout(toastTimer)
    if (ids.length > 0) {
      // El pulso del contactor dura poco; la notificación "se guarda" más tiempo
      pulseTimer = setTimeout(() => set({ transitioning: [] }), 1600)
      toastTimer = setTimeout(() => set({ transferNotes: [] }), 4500)
    }
  }

  return {
    inputs: INIT_INPUTS,
    derived: step(INIT_INPUTS),
    flowTrace: trace(INIT_INPUTS),
    activeTab: 'unifilar',
    transitioning: [],
    transferNotes: [],

    setActiveTab: (tab) => set({ activeTab: tab }),

    setMode: (mode) => {
      const cur = get()
      let manualSelection = cur.inputs.manualSelection
      // Al pasar de AUTO a MANUAL/FALLA, "congelar" el estado actual como punto de partida
      if (cur.inputs.modeSelector === 'AUTO' && mode !== 'AUTO') {
        manualSelection = { ...cur.derived.connected }
      }
      apply({ ...cur.inputs, modeSelector: mode, manualSelection })
    },

    setBlackout: (v) => apply({ ...get().inputs, blackout: v }),

    setSourceUpstream: (src, v) =>
      apply({
        ...get().inputs,
        sources: { ...get().inputs.sources, [src]: { ...get().inputs.sources[src], upstreamEnergized: v } },
      }),

    // Contacto auxiliar CERRADO (abrir/cerrar el breaker, sin tocar el trip)
    setSourceBreakerClosed: (src, closed) =>
      apply({
        ...get().inputs,
        sources: {
          ...get().inputs.sources,
          [src]: { ...get().inputs.sources[src], breakerClosed: closed },
        },
      }),

    // Contacto auxiliar FALLA/TRIP (independiente del estado abierto/cerrado)
    setSourceBreakerTrip: (src, trip) =>
      apply({
        ...get().inputs,
        sources: {
          ...get().inputs.sources,
          [src]: { ...get().inputs.sources[src], breakerTrip: trip },
        },
      }),

    setSourceAsymmetry: (src, ok) =>
      apply({
        ...get().inputs,
        sources: { ...get().inputs.sources, [src]: { ...get().inputs.sources[src], asymmetryOk: ok } },
      }),

    setOutputPref: (out, index, src) => {
      const prefs = [...get().inputs.outputs[out].prefs]
      prefs[index] = src
      apply({
        ...get().inputs,
        outputs: { ...get().inputs.outputs, [out]: { ...get().inputs.outputs[out], prefs } },
      })
    },

    setOutputAsymmetry: (out, ok) =>
      apply({
        ...get().inputs,
        outputs: { ...get().inputs.outputs, [out]: { ...get().inputs.outputs[out], outputAsymmetryOk: ok } },
      }),

    setContactorFault: (km, fault) =>
      apply({
        ...get().inputs,
        contactorFaults: { ...get().inputs.contactorFaults, [km]: fault },
      }),

    reset: () => {
      if (pulseTimer) clearTimeout(pulseTimer)
      if (toastTimer) clearTimeout(toastTimer)
      const inputs = nominalInputs()
      set({ inputs, derived: step(inputs), flowTrace: trace(inputs), transitioning: [], transferNotes: [] })
    },

    toggleSourceUpstream: (src) =>
      get().setSourceUpstream(src, !get().inputs.sources[src].upstreamEnergized),

    // Click en el breaker del unifilar: si está en trip, lo resetea (cierra + quita trip);
    // si no, simplemente abre/cierra.
    toggleBreaker: (src) => {
      const s = get().inputs.sources[src]
      if (s.breakerTrip) {
        apply({
          ...get().inputs,
          sources: {
            ...get().inputs.sources,
            [src]: { ...s, breakerClosed: true, breakerTrip: false },
          },
        })
      } else {
        get().setSourceBreakerClosed(src, !s.breakerClosed)
      }
    },

    toggleOutputAsymmetry: (out) =>
      get().setOutputAsymmetry(out, !get().inputs.outputs[out].outputAsymmetryOk),

    toggleManualContactor: (out, src) => {
      const cur = get().inputs.manualSelection[out]
      // Si src es null → posición OFF directo. Si es la misma fuente → toggle a null. Si es otra → seleccionar.
      const next = src === null ? null : cur === src ? null : src
      apply({
        ...get().inputs,
        manualSelection: { ...get().inputs.manualSelection, [out]: next },
      })
    },
  }
})