import type { EngineInputs } from './types'

// Estado nominal: todas las fuentes disponibles, modo AUTO, sin fallas
// Es el estado de referencia (docs/06, sección 7) y el que produce el botón Reiniciar
export function nominalInputs(): EngineInputs {
  return {
    modeSelector: 'AUTO',
    blackout: false,
    sources: {
      P: { upstreamEnergized: true, breakerClosed: true, breakerTrip: false, asymmetryOk: true },
      A: { upstreamEnergized: true, breakerClosed: true, breakerTrip: false, asymmetryOk: true },
      B: { upstreamEnergized: true, breakerClosed: true, breakerTrip: false, asymmetryOk: true },
    },
    outputs: {
      // Orden de preferencias por defecto según la imagen del documento: Principal, DB A, DB B
      S1: { prefs: ['P', 'A', 'B'], outputAsymmetryOk: true },
      S2: { prefs: ['P', 'A', 'B'], outputAsymmetryOk: true },
      S3: { prefs: ['P', 'A', 'B'], outputAsymmetryOk: true },
    },
    contactorFaults: {},
  }
}
