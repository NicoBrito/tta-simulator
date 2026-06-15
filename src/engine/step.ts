import type {
  EngineInputs, TtaState, ContactorId, ContactorState, OutputId, SourceId, Alarm,
} from './types'
import { isAvailable, isAvailablePure } from './disp'
import { maneuver, getContactorId } from './cont'

// Motor TTA — función pura: sin efectos secundarios, sin Date.now(), sin Math.random()
// REGLA: RN-00 — ciclo de control determinista
export function step(inputs: EngineInputs): TtaState {
  // REGLA: RN-01/02 — resolución de modo
  const mode = inputs.modeSelector

  // REGLA: RN-05 — KA-9 se activa cuando hay BLACKOUT
  const ka9 = inputs.blackout

  const contactors: Record<ContactorId, ContactorState> = {
    'KM1-P': 'abierto', 'KM1-A': 'abierto', 'KM1-B': 'abierto',
    'KM2-P': 'abierto', 'KM2-A': 'abierto', 'KM2-B': 'abierto',
    'KM3-P': 'abierto', 'KM3-A': 'abierto', 'KM3-B': 'abierto',
  }

  const connected: Record<OutputId, SourceId | null> = { S1: null, S2: null, S3: null }
  const energized: Record<OutputId, boolean> = { S1: false, S2: false, S3: false }
  const alarms: Alarm[] = []

  if (mode === 'FALLA_SELECTOR') {
    // REGLA: RN-02 — alarma visual + se asume MANUAL
    alarms.push({ id: 'AL-01', mensaje: 'Error de selector de modo (DI12 = DI13)', key: 'AL-01' })
  }

  // REGLA: RN-00 — orden de procesamiento: S1 → S2 → S3
  for (const outId of ['S1', 'S2', 'S3'] as OutputId[]) {
    if (mode === 'AUTO') {
      // REGLA: RN-03 — Experion ejecuta la transferencia automática
      processOutput(inputs, outId, contactors, connected, energized, alarms)
    } else {
      // REGLA: RN-04 — MANUAL (o FALLA_SELECTOR que se asume MANUAL): el operador
      // comanda los KM; sin transferencia automática, pero se mantiene la confirmación.
      processOutputManual(inputs, outId, contactors, connected, energized, alarms)
    }
  }

  return { mode, blackout: inputs.blackout, ka9, contactors, connected, energized, alarms }
}

// REGLA: RN-04 — procesamiento en modo MANUAL según el comando del operador
function processOutputManual(
  inputs: EngineInputs,
  outId: OutputId,
  contactors: Record<ContactorId, ContactorState>,
  connected: Record<OutputId, SourceId | null>,
  energized: Record<OutputId, boolean>,
  alarms: Alarm[],
): void {
  const src = inputs.manualSelection[outId]
  if (!src) return // selector frontal en OFF: todos los KM de la salida abiertos

  // REGLA: RN-30/31/32 — exclusividad y confirmación de maniobra (también en manual)
  const contactorOk = maneuver(inputs, outId, src, contactors, alarms)
  if (!contactorOk) return // falla de contactor → AL-05 (la emite maneuver)

  connected[outId] = src

  // La salida se energiza si la fuente tiene energía y la barra de salida no tiene asimetría.
  // No hay alarmas de transferencia (AL-02/03/04) en manual: el operador eligió la fuente.
  if (!inputs.outputs[outId].outputAsymmetryOk) {
    // REGLA: RN-42 — asimetría de barra de salida: alarma; en manual el KM queda según el operador
    alarms.push({
      id: 'AL-06',
      mensaje: `Falla asimétrica en BARRA de salida ${outId}`,
      key: `AL-06-${outId}`,
    })
    energized[outId] = false
  } else {
    // KM cerrado: energizado solo si la fuente realmente tiene energía disponible
    energized[outId] = isAvailablePure(inputs, src)
  }
}

function processOutput(
  inputs: EngineInputs,
  outId: OutputId,
  contactors: Record<ContactorId, ContactorState>,
  connected: Record<OutputId, SourceId | null>,
  energized: Record<OutputId, boolean>,
  alarms: Alarm[],
): void {
  const prefs = inputs.outputs[outId].prefs
  let selectedSrc: SourceId | null = null

  // REGLA: RN-23 — cascada de selección por preferencias
  for (const src of prefs) {
    if (isAvailable(inputs, src, alarms)) {
      selectedSrc = src
      break
    }
  }

  if (!selectedSrc) {
    // REGLA: RN-24 — ninguna preferencia disponible
    alarms.push({ id: 'AL-04', mensaje: `Sin energía disponible para ${outId}`, key: `AL-04-${outId}` })
    return
  }

  // REGLA: RN-25 — invocar subproceso CONT con (Salida, Fuente elegida)
  const contactorOk = maneuver(inputs, outId, selectedSrc, contactors, alarms)

  if (!contactorOk) {
    alarms.push({
      id: 'AL-04',
      mensaje: `Sin energía disponible para ${outId} (falla maniobra)`,
      key: `AL-04-${outId}-cont`,
    })
    return
  }

  connected[outId] = selectedSrc

  // REGLA: RN-40 — leer R-AS-Bx después de confirmar contactores
  if (inputs.outputs[outId].outputAsymmetryOk) {
    energized[outId] = true // REGLA: RN-41 — salida energizada
  } else {
    // REGLA: RN-42 — asimetría en barra de salida → abrir contactor y desenergizar
    alarms.push({
      id: 'AL-06',
      mensaje: `Falla asimétrica en BARRA de salida ${outId}`,
      key: `AL-06-${outId}`,
    })
    const kmConnected = getContactorId(outId, selectedSrc)
    if (kmConnected) {
      if (inputs.contactorFaults[kmConnected]) {
        contactors[kmConnected] = 'falla'
        alarms.push({
          id: 'AL-05',
          mensaje: `Falla Contactor ${kmConnected} (no abrió post-asimetría)`,
          key: `AL-05-${kmConnected}-rasb`,
        })
      } else {
        contactors[kmConnected] = 'abierto'
      }
    }
    connected[outId] = null
    energized[outId] = false
  }
}
