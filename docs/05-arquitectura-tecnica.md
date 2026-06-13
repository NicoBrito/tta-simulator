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

---

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
| Render unifilar y flujo | SVG a medida (sin React Flow / canvas) |
| Auth | Variable de entorno Vite (`VITE_APP_PASSWORD`) |
| Persistencia | `localStorage` (posiciones de nodos + diagramas cargados) |

**Sin backend, sin base de datos.** Todo vive en el navegador o en el repo.

---

## 3. Auth — LoginGate

Protección mínima suficiente para demo a cliente. Funciona así:

- La clave vive en la variable de entorno `VITE_APP_PASSWORD` (Vercel env var en
  producción, `.env.local` en desarrollo). **Nunca commitear `.env.local`.**
- `<LoginGate>` envuelve toda la app. Compara lo que escribe el usuario con
  `import.meta.env.VITE_APP_PASSWORD`.
- Si es correcto, guarda `tta_auth=1` en `sessionStorage` (se limpia al cerrar la
  pestaña) y renderiza la app.
- Si la variable de entorno no está definida (entorno de desarrollo sin `.env.local`),
  `LoginGate` deja pasar sin preguntar — para no bloquear el desarrollo local.

```ts
// src/components/LoginGate.tsx  (esbozo)
const stored = sessionStorage.getItem('tta_auth');
const pwd = import.meta.env.VITE_APP_PASSWORD;
if (!pwd || stored === '1') return <>{children}</>;
// mostrar formulario de password
```

> **Limitación conocida y aceptada:** esta protección es frontend-only. Cualquiera
> que sepa buscar en el bundle puede ver la clave. Para una demo a cliente sin datos
> sensibles esto es suficiente. Si en el futuro se requiere auth real, se añade un
> backend (iteración futura, fuera del alcance actual).

---

## 4. Persistencia — qué, dónde y cómo

Todo el estado del simulador vive en memoria (Zustand). Lo que sí persiste entre
sesiones vive en `localStorage`, bajo las claves prefijadas `tta_`:

| Qué | Clave localStorage | Cuándo se escribe |
|-----|--------------------|-------------------|
| Posiciones de nodos (Vista de Flujo) | `tta_layout_<diagramId>` | al soltar un nodo arrastrado |
| Diagrama activo (id) | `tta_active_diagram` | al cambiar de diagrama |
| Lista de diagramas cargados por el usuario | `tta_diagrams_index` | al subir un nuevo JSON |
| Datos de cada diagrama extra | `tta_diagram_<id>` | al subir un nuevo JSON |

El diagrama que viene con el repo (`src/data/flowLayout.json`) es el **diagrama base**
con id `default`. No se guarda en `localStorage`; siempre se carga desde el bundle.
Los diagramas extra que el usuario suba sí se guardan en `localStorage`.

**Límites de localStorage:** ~5 MB por origen. Un `flowLayout.json` pesa ~130 KB, así
que hay margen para varios diagramas sin problema.

**Manejo de errores:** siempre usar try/catch al leer/escribir localStorage. Si la
lectura falla o el JSON está corrupto, caer al diagrama base sin error visible (log
en consola). Si el almacenamiento está lleno, mostrar aviso al usuario.

---

## 5. Gestión de múltiples diagramas

Esta es la ruta de crecimiento principal de la app. El flujo de trabajo es:

1. El usuario exporta su diagrama de draw.io como **XML** (File → Export → XML).
2. Un script externo (o futuro botón en la app) convierte ese XML al formato
   `flowLayout.json` (el mismo parseador Python ya existe en `docs/` como referencia).
3. El usuario sube el JSON desde la app (input file) o lo agrega al repo.
4. La app lo carga, lo guarda en `localStorage` y lo muestra en la Vista de Flujo.

**Selector de diagrama:** en la Vista de Flujo, un selector desplegable permite
cambiar entre el diagrama base y los diagramas extra cargados. El motor de lógica
TTA sigue siendo el mismo; solo cambia el diagrama visual que se anima.

> Nota: diagramas de flujos distintos al TTA (otros proyectos) usarán la Vista de
> Flujo pura (solo visualización + resaltado). El motor TTA solo se aplica al
> diagrama base. Para diagramas de otros sistemas, el resaltado se implementa en
> una iteración futura.

---

## 6. Estructura de carpetas

```
tta-simulator/
  CLAUDE.md
  docs/                           ← documentación (reglas de negocio)
  .env.local                      ← VITE_APP_PASSWORD (NO commitear)
  .env.example                    ← plantilla sin valor real (sí commitear)
  src/
    engine/                       ← motor puro, CERO React
      types.ts
      model.ts
      config.ts
      trace.ts
      physics/
        phasor.ts
        symmetrical.ts
        asymmetry.ts
        physicsConfig.ts
      disp.ts
      cont.ts
      transfer.ts
      blackout.ts
      mode.ts
      alarms.ts
      step.ts
      index.ts
    data/
      flowLayout.json             ← diagrama base (del .drawio original)
    services/
      diagramStorage.ts           ← leer/escribir diagramas en localStorage
      layoutStorage.ts            ← leer/escribir posiciones de nodos en localStorage
    store/
      simulatorStore.ts           ← Zustand: estado TTA + acciones
      uiStore.ts                  ← pestaña activa, diagrama activo, posiciones UI
    components/
      LoginGate.tsx               ← auth por password
      AppTabs.tsx                 ← pestañas [ Unifilar | Flujo ]
      SingleLineDiagram/          ← Vista Unifilar (ver 06)
        SingleLineDiagram.tsx
        Source.tsx  Breaker.tsx  Bus.tsx
        Contactor.tsx  Conductor.tsx  Output.tsx
      FlowDiagram/                ← Vista de Flujo (ver 08)
        FlowDiagram.tsx
        FlowNode.tsx
        FlowEdge.tsx
        DiagramSelector.tsx       ← selector de diagrama activo
        DiagramUploader.tsx       ← input file para subir JSON
        useFlowLayout.ts
      ControlPanel/               ← compartido por ambas vistas
        ModeSwitch.tsx
        InputToggles.tsx
        PreferenceSelectors.tsx
        FaultToggles.tsx
        BlackoutToggle.tsx
      AlarmPanel/
        AlarmPanel.tsx
      Legend.tsx
    hooks/
      useEnergyFlow.ts
    styles/
      tokens.css
    App.tsx
    main.tsx
  tests/
    disp.test.ts
    transfer.test.ts
    cont.test.ts
    symmetrical.test.ts
    mode.test.ts
    blackout.test.ts
    trace.test.ts
    flow-branches.test.ts
    diagramStorage.test.ts
```

---

## 7. Tipos del dominio (esbozo, ver `01` para identificadores)

```ts
export type Mode = 'AUTO' | 'MANUAL' | 'FALLA_SELECTOR';
export type SourceId = 'P' | 'A' | 'B';
export type OutputId = 'S1' | 'S2' | 'S3';

export type BreakerState =
  | { cerrado: true;  fallaTrip: false }
  | { cerrado: false; fallaTrip: false }
  | { cerrado: boolean; fallaTrip: true };

export type ContactorState = 'abierto' | 'cerrado' | 'falla';

export interface Phasor { mag: number; angleDeg: number; }

export interface SourceInput {
  id: SourceId;
  upstreamEnergized: boolean;
  breaker: BreakerState;
  asymmetryOk: boolean;
  phases?: [Phasor, Phasor, Phasor];
}

export interface OutputConfig {
  id: OutputId;
  currentA: number;
  prefs: SourceId[];
  outputAsymmetryOk: boolean;
}

export type AlarmId =
  | 'AL-01' | 'AL-02' | 'AL-03' | 'AL-04' | 'AL-05' | 'AL-06';

export interface Alarm { id: AlarmId; mensaje: string; ref?: string; }

export interface TtaState {
  di12: 0 | 1; di13: 0 | 1;
  blackout: boolean;
  ka9: boolean;
  sources: Record<SourceId, SourceInput>;
  outputs: Record<OutputId, OutputConfig>;
  contactors: Record<string, ContactorState>;
  connected: Record<OutputId, SourceId | null>;
  energized: Record<OutputId, boolean>;
  alarms: Alarm[];
  mode: Mode;
}

// Diagrama cargado (base o extra)
export interface DiagramMeta {
  id: string;             // 'default' o uuid generado al subir
  name: string;           // nombre para el selector
  source: string;         // nombre del archivo original
  loadedAt: string;       // ISO timestamp
}
```

---

## 8. API pública del motor (`engine/index.ts`)

```ts
export function nominalState(): TtaState;
export function step(state: TtaState): TtaState;
export function resolveMode(di12: 0|1, di13: 0|1): Mode;
export function isAvailable(s: TtaState, out: OutputId, src: SourceId): boolean;
export function selectSource(s: TtaState, out: OutputId): SourceId | null;
export function validatePrefs(out: OutputId, prefs: SourceId[]): boolean;
export function maneuver(s: TtaState, out: OutputId, src: SourceId): { ok: boolean; alarms: Alarm[] };
export function trace(state: TtaState): FlowTrace;
```

---

## 9. Flujo de datos

```
Usuario interactúa (toggle / dropdown / subir JSON)
        │
        ▼
acción del store (Zustand) actualiza las ENTRADAS del estado
        │
        ▼
store llama engine.step(state) → nuevo estado
store llama engine.trace(state) → FlowTrace para Vista de Flujo
        │
        ▼
componentes re-renderizan y pintan según el estado
        │
        ▼ (si hay cambio de posición o nuevo diagrama)
services/layoutStorage o services/diagramStorage persisten en localStorage
```

---

## 10. Reglas de implementación

- TypeScript `strict`. Nada de `any` salvo justificación escrita.
- `step` y `trace` son puros: sin efectos secundarios, sin `Date.now()`, sin `Math.random()`.
- Toda escritura a `localStorage` va dentro de try/catch con fallback silencioso.
- Identificadores de señales idénticos al glosario (`01`).
- Comentar reglas con `// REGLA: RN-xx`.
- Selectores granulares de Zustand para evitar re-renders globales.
