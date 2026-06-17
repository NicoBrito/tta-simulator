import type { EngineInputs, OutputId, SourceId, ContactorId, ContactorState, Alarm } from './types'

// Tabla de contactores por (salida, fuente) — docs/01 y docs/03 tabla C
// Matriz salida × fuente. Las tres salidas admiten las tres fuentes
// (según "Modo funcionamiento TTA": Iluminación Emergencia también puede tomar PRINCIPAL).
// S3 (Ilum. Emergencia) NO admite PRINCIPAL: su matriz solo contempla A y B.
const CONTACTORES: Record<OutputId, Partial<Record<SourceId, ContactorId>>> = {
  S1: { P: 'KM1-P', A: 'KM1-A', B: 'KM1-B' },
  S2: { P: 'KM2-P', A: 'KM2-A', B: 'KM2-B' },
  S3: { A: 'KM3-A', B: 'KM3-B' },
}

export function getContactorId(out: OutputId, src: SourceId): ContactorId | null {
  return CONTACTORES[out][src] ?? null
}

export function getOtherContactors(out: OutputId, src: SourceId): ContactorId[] {
  return (Object.entries(CONTACTORES[out]) as [SourceId, ContactorId][])
    .filter(([s]) => s !== src)
    .map(([, km]) => km)
}

// Subproceso CONT: exclusividad + confirmación de apertura/cierre (docs/03, sección C)
// REGLA: RN-30 a RN-34
export function maneuver(
  inputs: EngineInputs,
  out: OutputId,
  src: SourceId,
  contactors: Record<ContactorId, ContactorState>,
  alarms: Alarm[],
): boolean {
  const kmToClose = getContactorId(out, src)
  if (!kmToClose) return false

  const others = getOtherContactors(out, src)
  let contactorOk = true

  // REGLA: RN-30 — abrir otros contactores de la misma salida (exclusividad)
  for (const km of others) {
    if (inputs.contactorFaults[km]) {
      contactors[km] = 'falla'
      // REGLA: RN-31 — no confirmó apertura
      pushAlarm(alarms, {
        id: 'AL-05',
        mensaje: `Falla Contactor ${km} (no abrió)`,
        key: `AL-05-${km}-open`,
      })
      contactorOk = false
    } else {
      contactors[km] = 'abierto' // REGLA: RN-31 — apertura confirmada
    }
  }

  if (contactorOk) {
    // REGLA: RN-32 — cerrar el contactor elegido
    if (inputs.contactorFaults[kmToClose]) {
      contactors[kmToClose] = 'falla'
      pushAlarm(alarms, {
        id: 'AL-05',
        mensaje: `Falla Contactor ${kmToClose} (no cerró)`,
        key: `AL-05-${kmToClose}-close`,
      })
      contactorOk = false
    } else {
      contactors[kmToClose] = 'cerrado' // REGLA: RN-33 — cierre confirmado
    }
  }

  return contactorOk // REGLA: RN-33/34
}

function pushAlarm(alarms: Alarm[], alarm: Alarm): void {
  if (!alarms.some((a) => a.key === alarm.key)) {
    alarms.push(alarm)
  }
}
