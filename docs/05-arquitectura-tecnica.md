# 05 — Arquitectura Técnica

## 1. Principio rector

> **El motor decide. La UI refleja. El SVG nunca calcula.**

Dirección de dependencias (no invertir nunca):

```
components/ (React)  →  store/ (Zustand)  →  engine/ (TypeScript puro)
                                              │
                                              └─ physics/ (mathjs)
```

`engine/` no importa React, Zustand, ni nada de UI. Es testeable de forma aislada.

## 2. Stack

| Capa | Tecnología |
|------|------------|
| Build/runtime | Vite + React 18 |
| Lenguaje | TypeScript (`strict`) |
| Estado | Zustand |
| Estilos | Tailwind CSS |
| Animación | Framer Motion |
| Física | mathjs |
| Pruebas | Vitest + @testing-library/react |
| Render unifilar | SVG a medida (sin React Flow / canvas) |

## 3. Estructura de carpetas

```
tta-sim/
  CLAUDE.md
  docs/                         ← esta documentación (reglas de negocio)
  src/
    engine/                     ← motor puro, CERO React
      types.ts                  uniones discriminadas del dominio
      model.ts                  estado completo + nominalState()
      config.ts                 constantes (mapeos salida→KM, etc.)
      trace.ts                  traza de ejecución para la Vista de Flujo (FlowTrace)
      physics/
        phasor.ts               fasores, operador a
        symmetrical.ts          V0/V1/V2, VUF
        asymmetry.ts            criterio R-AS-x (modo avanzado)
        physicsConfig.ts        umbrales configurables (V_min, VUF_max, ...)
      disp.ts                   Subproceso DISP: isAvailable(state, salida, fuente)
      cont.ts                   Subproceso CONT: maniobra + confirmación + exclusividad
      transfer.ts               selección por preferencias (cascada) por salida
      blackout.ts               KA-9
      mode.ts                   resolución de modo AUTO/MANUAL/falla selector
      alarms.ts                 construcción de alarmas (catálogo AL-0x)
      step.ts                   orquestador determinista del ciclo completo
      index.ts                  API pública
    data/
      flowLayout.json           posiciones de nodos/aristas del .drawio (semilla Vista 1)
    store/
      simulatorStore.ts         Zustand; acciones del usuario → engine.step
      uiStore.ts                pestaña activa, posiciones arrastradas de la Vista 1
    components/
      AppTabs.tsx               pestañas [ Unifilar | Flujo ]
      SingleLineDiagram/        ← Vista Unifilar (ver 06)
        SingleLineDiagram.tsx
        Source.tsx  Breaker.tsx  Bus.tsx
        Contactor.tsx  Conductor.tsx  Output.tsx
      FlowDiagram/              ← Vista de Flujo (ver 08)
        FlowDiagram.tsx         lienzo SVG con pan/zoom
        FlowNode.tsx            nodo arrastrable (process/decision/terminal/annotation)
        FlowEdge.tsx            arista SVG con etiqueta SÍ/NO
        useFlowLayout.ts        carga flowLayout.json + posiciones del usuario
      ControlPanel/            ← compartido por ambas vistas
        ModeSwitch.tsx  InputToggles.tsx
        PreferenceSelectors.tsx  FaultToggles.tsx  BlackoutToggle.tsx
      AlarmPanel/AlarmPanel.tsx
      Legend.tsx
    hooks/
      useEnergyFlow.ts          deriva colores/animación del estado
    styles/ tokens.css
    App.tsx
    main.tsx
  tests/
    disp.test.ts  transfer.test.ts  cont.test.ts
    symmetrical.test.ts  mode.test.ts  blackout.test.ts
    flow-branches.test.ts         cubre ramas de docs/03
```

## 4. Tipos del dominio (esbozo, ver `01` para identificadores)

```ts
export type Mode = 'AUTO' | 'MANUAL' | 'FALLA_SELECTOR';
export type SourceId = 'P' | 'A' | 'B';
export type OutputId = 'S1' | 'S2' | 'S3';

export type BreakerState =
  | { cerrado: true;  fallaTrip: false }   // único estado "OK"
  | { cerrado: false; fallaTrip: false }   // abierto
  | { cerrado: boolean; fallaTrip: true }; // trip/falla

export type ContactorState = 'abierto' | 'cerrado' | 'falla';

export interface Phasor { mag: number; angleDeg: number; }

export interface SourceInput {
  id: SourceId;
  upstreamEnergized: boolean;          // energía aguas arriba (modo simple)
  breaker: BreakerState;               // CBn
  asymmetryOk: boolean;                // R-AS-x (modo simple: toggle; avanzado: calculado)
  phases?: [Phasor, Phasor, Phasor];   // modo avanzado
}

export interface OutputConfig {
  id: OutputId;
  currentA: number;                    // 100 / 25 / 10
  prefs: SourceId[];                   // [F1,F2,F3]; S3 => 2 elementos, sin 'P'
  outputAsymmetryOk: boolean;          // R-AS-Bx
}

export type AlarmId =
  | 'AL-01' | 'AL-02' | 'AL-03' | 'AL-04' | 'AL-05' | 'AL-06';

export interface Alarm { id: AlarmId; mensaje: string; ref?: string; }

export interface TtaState {
  di12: 0 | 1; di13: 0 | 1;            // selección de modo
  blackout: boolean;
  ka9: boolean;
  sources: Record<SourceId, SourceInput>;
  outputs: Record<OutputId, OutputConfig>;
  contactors: Record<string, ContactorState>;   // 'KM1-P', 'KM3-B', ...
  // Resultado calculado por el motor:
  connected: Record<OutputId, SourceId | null>;  // fuente conectada por salida
  energized: Record<OutputId, boolean>;
  alarms: Alarm[];
  mode: Mode;
}
```

## 5. API pública del motor (`engine/index.ts`)

```ts
export function nominalState(): TtaState;
export function step(state: TtaState): TtaState;     // determinista, puro

// helpers (también usados por los tests):
export function resolveMode(di12: 0|1, di13: 0|1): Mode;          // RN-01/02
export function isAvailable(s: TtaState, out: OutputId, src: SourceId): boolean; // DISP / RN-10
export function selectSource(s: TtaState, out: OutputId): SourceId | null;       // transfer / RN-23
export function validatePrefs(out: OutputId, prefs: SourceId[]): boolean;        // RN-21/22
export function maneuver(s: TtaState, out: OutputId, src: SourceId): { ok: boolean; alarms: Alarm[] }; // CONT / RN-30..33

// Vista de Flujo (ver 08): traza de ejecución derivada del MISMO estado, pura.
export function trace(state: TtaState): FlowTrace;
```

## 6. Flujo de datos

```
Usuario interactúa (toggle / dropdown)
        │
        ▼
acción del store (Zustand) actualiza las ENTRADAS del estado
        │
        ▼
store llama engine.step(state)  →  nuevo estado (connected, energized, alarms, ka9, ...)
        │
        ▼
componentes suscritos re-renderizan y pintan color/animación según el estado
```

- El store guarda el `TtaState` y expone acciones (`setBreaker`, `setAsymmetry`,
  `setBlackout`, `setMode`, `setPreference`, `setContactorFault`, `reset`).
- Cada acción muta solo las **entradas**, luego invoca `step` para recalcular las
  **salidas**. Los componentes nunca calculan estado derivado.

## 7. Reglas de implementación

- Usar **selectores granulares** de Zustand para evitar re-renders globales.
- `step` no debe tener efectos secundarios ni dependencias de tiempo/aleatoriedad.
- Identificadores de señales **idénticos al glosario** (`01`).
- Comentar reglas con `// REGLA: RN-xx`.
