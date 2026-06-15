// Identificadores de dominio — iguales al glosario (docs/01)
export type Mode = 'AUTO' | 'MANUAL' | 'FALLA_SELECTOR'
export type SourceId = 'P' | 'A' | 'B'
export type OutputId = 'S1' | 'S2' | 'S3'

export type ContactorId =
  | 'KM1-P' | 'KM1-A' | 'KM1-B'
  | 'KM2-P' | 'KM2-A' | 'KM2-B'
  | 'KM3-P' | 'KM3-A' | 'KM3-B'

export type ContactorState = 'abierto' | 'cerrado' | 'falla'

export type AlarmId = 'AL-01' | 'AL-02' | 'AL-03' | 'AL-04' | 'AL-05' | 'AL-06'

export interface Alarm {
  id: AlarmId
  mensaje: string
  key: string // clave de deduplicación
}

// Estado de una fuente de energía (entradas del usuario)
export interface SourceInput {
  upstreamEnergized: boolean // energía aguas arriba presente
  breakerClosed: boolean     // C-AUX CBn CERRADO = 1
  breakerTrip: boolean       // C-AUX CBn FALLA/TRIP = 1
  asymmetryOk: boolean       // R-AS-x = 1 (sin asimetría)
}

// Configuración de una salida (entradas del usuario)
export interface OutputConfig {
  prefs: SourceId[]          // orden de preferencias (S3: solo [A,B])
  outputAsymmetryOk: boolean // R-AS-Bx = 1
}

// Todas las entradas controladas por el usuario — el motor nunca las modifica
export interface EngineInputs {
  modeSelector: 'AUTO' | 'MANUAL' | 'FALLA_SELECTOR'
  blackout: boolean
  sources: Record<SourceId, SourceInput>
  outputs: Record<OutputId, OutputConfig>
  contactorFaults: Partial<Record<ContactorId, boolean>>
  // MODO MANUAL: fuente cuyo KM el operador comanda cerrado por salida (null = todos abiertos).
  // El selector frontal es excluyente por construcción, así que respeta RN-30.
  manualSelection: Record<OutputId, SourceId | null>
}

// Traza del camino lógico recorrido, para resaltar la Vista de Flujo (docs/08 §6)
export interface FlowTrace {
  visited: string[]                          // ids de nodo en orden de recorrido
  decisions: Record<string, 'SI' | 'NO'>     // id de rombo → rama tomada
  perOutput: Record<OutputId, {
    outcome: 'energizada' | 'desenergizada' | 'alarma'
  }>
}

// Estado completo derivado por el motor — nunca lo modifica la UI directamente
export interface TtaState {
  mode: Mode
  blackout: boolean
  ka9: boolean
  contactors: Record<ContactorId, ContactorState>
  connected: Record<OutputId, SourceId | null>
  energized: Record<OutputId, boolean>
  alarms: Alarm[]
}
