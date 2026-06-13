import type { EngineInputs, SourceId, Alarm } from './types'

// Subproceso DISP: verifica disponibilidad de una fuente (docs/03, sección B)
// REGLA: RN-10 — condición compuesta: upstream + breaker + sin asimetría
export function isAvailable(inputs: EngineInputs, src: SourceId, alarms: Alarm[]): boolean {
  const s = inputs.sources[src]
  const cbNum = src === 'P' ? 1 : src === 'A' ? 2 : 3
  const busName = src === 'P' ? 'PRINCIPAL' : `DB ${src}`

  // REGLA: RN-11 — breaker abierto o en trip → Fuente OK = 0
  if (!s.breakerClosed || s.breakerTrip) {
    pushAlarm(alarms, {
      id: 'AL-02',
      mensaje: `Estado CB${cbNum} (${busName}) Abierto/Falla/Trip`,
      key: `AL-02-${src}`,
    })
    return false
  }

  // REGLA: RN-12 — breaker OK pero sin tensión/asimetría → Fuente OK = 0
  if (!s.upstreamEnergized || !s.asymmetryOk) {
    pushAlarm(alarms, {
      id: 'AL-03',
      mensaje: `BARRA ${busName} sin energía`,
      key: `AL-03-${src}`,
    })
    return false
  }

  return true
}

// Versión pura sin efectos — para colorear el SVG sin acumular alarmas
export function isAvailablePure(inputs: EngineInputs, src: SourceId): boolean {
  const s = inputs.sources[src]
  return s.upstreamEnergized && s.breakerClosed && !s.breakerTrip && s.asymmetryOk
}

function pushAlarm(alarms: Alarm[], alarm: Alarm): void {
  if (!alarms.some((a) => a.key === alarm.key)) {
    alarms.push(alarm)
  }
}
