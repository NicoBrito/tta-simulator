import type { EngineInputs, FlowTrace, OutputId, SourceId } from './types'
import { step } from './step'
import { isAvailablePure } from './disp'

// ── Mapeo de la lógica a IDs de nodo de flowLayout.json (docs/08 §7) ──
// IDs verificados contra el JSON del .drawio Ver 05.

const N = {
  inicio: '10',
  leerModo: '11',
  esAuto: '12',          // ¿MODO AUTOMÁTICO?
  modoAuto: '14',
  esManual: 'wAwO7pTqmTZ5cJB01p8_-98',   // ¿MODO MANUAL?
  errorSelector: 'wAwO7pTqmTZ5cJB01p8_-103',
  asumeManual: 'wAwO7pTqmTZ5cJB01p8_-104',
  modoManual: '13',
  leerEntradas: '15',
  leerBlackout: '16',
  esBlackout: '17',      // ¿BLACKOUT = 1?
  ka9On: '18',
  ka9Off: 'wAwO7pTqmTZ5cJB01p8_-262',
} as const

// Nodos de decisión de preferencia por salida (en orden de cascada).
// NOTA: el .drawio dibuja S3 con solo 2 decisiones (no tiene rama hacia PRINCIPAL).
// Ver docs/09 — discrepancia conocida pendiente de regenerar el diagrama.
const PREF_NODES: Record<OutputId, string[]> = {
  S1: ['23', '25', '27'],
  S2: ['43', '45', '47'],
  S3: ['63', '65'],
}

const CONT_OK: Record<OutputId, string> = {
  S1: 'wAwO7pTqmTZ5cJB01p8_-389',
  S2: '_QdEOQcB5nZz9vFoksUz-108',
  S3: '_QdEOQcB5nZz9vFoksUz-186',
}
const RASB: Record<OutputId, string> = {
  S1: '33',
  S2: '_QdEOQcB5nZz9vFoksUz-115',
  S3: '_QdEOQcB5nZz9vFoksUz-193',
}
const ENERG: Record<OutputId, string> = {
  S1: '35',
  S2: '_QdEOQcB5nZz9vFoksUz-118',
  S3: '_QdEOQcB5nZz9vFoksUz-196',
}
const ASIM_ALARM: Record<OutputId, string> = {
  S1: '34',
  S2: '_QdEOQcB5nZz9vFoksUz-117',
  S3: '_QdEOQcB5nZz9vFoksUz-195',
}
const SIN_ENERGIA: Record<OutputId, string> = {
  S1: 'wAwO7pTqmTZ5cJB01p8_-455',
  S2: '_QdEOQcB5nZz9vFoksUz-156',
  S3: '_QdEOQcB5nZz9vFoksUz-234',
}

// Conjunto de nodos terminales de alarma (se pintan en rojo cuando se alcanzan)
export const ALARM_NODE_IDS = new Set<string>([
  N.errorSelector,
  ...Object.values(ASIM_ALARM),
  ...Object.values(SIN_ENERGIA),
])

const OUTPUTS: OutputId[] = ['S1', 'S2', 'S3']

// trace(inputs): deriva el camino lógico recorrido. Puro; usa el mismo step() que la UI.
export function trace(inputs: EngineInputs): FlowTrace {
  const derived = step(inputs)
  const visited: string[] = []
  const decisions: Record<string, 'SI' | 'NO'> = {}
  const perOutput = {} as FlowTrace['perOutput']

  // ── Tramo global ──
  visited.push(N.inicio, N.leerModo, N.esAuto)
  if (inputs.modeSelector === 'AUTO') {
    decisions[N.esAuto] = 'SI'
    visited.push(N.modoAuto)
  } else {
    decisions[N.esAuto] = 'NO'
    visited.push(N.esManual)
    if (inputs.modeSelector === 'FALLA_SELECTOR') {
      decisions[N.esManual] = 'NO'
      visited.push(N.errorSelector, N.asumeManual)
    } else {
      decisions[N.esManual] = 'SI'
      visited.push(N.modoManual)
    }
  }
  visited.push(N.leerEntradas, N.leerBlackout, N.esBlackout)
  decisions[N.esBlackout] = inputs.blackout ? 'SI' : 'NO'
  visited.push(inputs.blackout ? N.ka9On : N.ka9Off)

  // ── Subárbol por salida (solo el flujo AUTO tiene representación en el diagrama) ──
  for (const out of OUTPUTS) {
    if (inputs.modeSelector === 'AUTO') {
      traceOutput(inputs, out, derived.connected[out], derived.energized[out], visited, decisions)
    }
    // outcome (sirve para AUTO y MANUAL)
    const hasAlarm = derived.alarms.some((a) => a.key.includes(out))
    perOutput[out] = {
      outcome: derived.energized[out] ? 'energizada' : hasAlarm ? 'alarma' : 'desenergizada',
    }
  }

  return { visited, decisions, perOutput }
}

function traceOutput(
  inputs: EngineInputs,
  out: OutputId,
  connected: SourceId | null,
  energized: boolean,
  visited: string[],
  decisions: Record<string, 'SI' | 'NO'>,
): void {
  const prefs = inputs.outputs[out].prefs
  const prefNodes = PREF_NODES[out]
  let selected: SourceId | null = null

  // Cascada de preferencias (RN-23)
  for (let i = 0; i < prefs.length; i++) {
    const nodeId = prefNodes[i]
    const avail = isAvailablePure(inputs, prefs[i])
    if (nodeId) {
      visited.push(nodeId)
      decisions[nodeId] = avail ? 'SI' : 'NO'
    }
    if (avail) { selected = prefs[i]; break }
  }

  if (selected === null) {
    visited.push(SIN_ENERGIA[out]) // RN-24
    return
  }

  // CONTACTOR OK: en step, connected solo se fija si la maniobra confirmó
  const contOk = connected !== null
  visited.push(CONT_OK[out])
  decisions[CONT_OK[out]] = contOk ? 'SI' : 'NO'
  if (!contOk) {
    visited.push(SIN_ENERGIA[out]) // RN-43
    return
  }

  // R-AS-Bx
  visited.push(RASB[out])
  const rasbOk = inputs.outputs[out].outputAsymmetryOk
  decisions[RASB[out]] = rasbOk ? 'SI' : 'NO'
  visited.push(energized ? ENERG[out] : ASIM_ALARM[out]) // RN-41 / RN-42
}
