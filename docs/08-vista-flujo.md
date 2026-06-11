# 08 — Especificación de la Vista de Flujo (Vista 1)

El simulador tiene **dos vistas del mismo sistema**, conmutables por **pestañas**:

- **Vista Unifilar (Vista 2)** — el tablero eléctrico interactivo (ver `06`).
- **Vista de Flujo (Vista 1)** — el diagrama de flujo lógico "tipo draw.io",
  interactivo, especificado en este documento.

Ambas vistas leen del **mismo motor** y del mismo `TtaState`. Cambiar de pestaña no
recalcula nada: solo cambia la representación.

---

## 1. Propósito

Mientras la Vista Unifilar muestra **qué** pasa (energía moviéndose), la Vista de
Flujo muestra **por qué** pasa: ilumina el **camino lógico** que el motor recorrió
(qué decisión tomó cada rombo, en qué rama cayó, en qué nodo terminó cada salida).
Es el puente directo con la lógica que luego se programa en Experion.

---

## 2. Fuente del dibujo y diagramas múltiples

### Diagrama base
El layout **reusa las posiciones exactas del `.drawio` original**. Vive en
`src/data/flowLayout.json` (en el repo, cargado desde el bundle) con `id = 'default'`.

```jsonc
{
  "meta": { "source": "Diagrama_Flujo_TTA_Ver_05.drawio", "units": "px" },
  "nodes": [
    { "id": "10", "label": "INICIO DEL SISTEMA", "shape": "process",
      "x": 1159.67, "y": -930, "w": 250, "h": 60, "kind": "node" }
  ],
  "edges": [
    { "id": "...", "source": "<nodeId>", "target": "<nodeId>", "label": "SÍ" }
  ]
}
```

Campos de `kind`:
- `node` — nodo del flujo lógico (224). Se dibuja y participa en el resaltado.
- `annotation` — leyenda/nota lateral (22). Estilo distinto; no participa en el flujo ejecutable.
- `connector-label` — etiqueta "SÍ"/"NO" suelta (136). No se dibuja como caja; su texto se usa como etiqueta de la arista correspondiente.

### Diagramas extra (flujo de trabajo)
El usuario puede agregar diagramas adicionales de otros proyectos o versiones:

1. Exportar el draw.io como **XML** (File → Export → XML uncompressed).
2. Convertir a `flowLayout.json` con el script de conversión (ver `docs/` para
   referencia del parseador).
3. Subir el JSON desde la app mediante **`<DiagramUploader>`** (input file `accept=".json"`).
4. La app lo guarda en `localStorage` bajo `tta_diagram_<uuid>` y lo agrega al índice
   `tta_diagrams_index`.
5. El selector `<DiagramSelector>` permite conmutar entre diagramas cargados.

**El diagrama base siempre está disponible** aunque se borre el localStorage (viene
en el bundle). Los diagramas extra solo persisten mientras localStorage esté íntegro.

---

## 3. Persistencia de posiciones

Las posiciones que el usuario arrastra se guardan en
`localStorage` bajo `tta_layout_<diagramId>` (gestionado por `services/layoutStorage.ts`):

```ts
// layoutStorage.ts
export function saveLayout(diagramId: string, positions: Record<string, {x:number, y:number}>): void
export function loadLayout(diagramId: string): Record<string, {x:number, y:number}> | null
export function clearLayout(diagramId: string): void
```

**Prioridad de posiciones al cargar:**
1. Posiciones guardadas en `localStorage` para ese `diagramId` (si existen).
2. Posiciones originales del JSON (semilla del `.drawio`).

**Botón "Restaurar layout":** llama a `clearLayout(diagramId)` y recarga desde el JSON.
Las posiciones restauradas se muestran inmediatamente pero no se guardan hasta el
próximo drag (lazy save).

---

## 4. Interacción requerida

- **Pan y zoom** del lienzo (el diagrama base abarca aprox. `x ∈ [-533, 3806]`,
  `y ∈ [-930, 10531]` — es grande y vertical).
- **Arrastrar nodos:** cada nodo `kind: 'node'` es reposicionable. Las aristas se
  recalculan al mover. Al soltar, se guarda la nueva posición en `localStorage`.
- **Botón "Restaurar layout":** vuelve a posiciones originales del JSON.
- **Selector de diagrama:** desplegable con los diagramas disponibles (base + extras).
- **Uploader de diagrama:** input file para subir un JSON nuevo.
- **Las mismas condiciones del panel de control** afectan esta vista porque ambas leen
  del mismo store.

---

## 5. Tecnología de render

SVG a medida (coherente con la Vista Unifilar). **No** React Flow ni mxGraph.

- Drag con `onPointerDown/Move/Up` sobre cada nodo SVG; posición en `uiStore`.
- Aristas como paths SVG ortogonales calculados desde los bordes de nodos.
- Pan/zoom con transform SVG (`translate` + `scale`) controlado por gestos de rueda y
  arrastre del lienzo (no de un nodo).

---

## 6. Resaltado del camino activo

El motor expone `trace(state): FlowTrace` (puro, derivado del mismo estado):

```ts
export interface FlowTrace {
  visited: string[];                           // ids en orden de recorrido
  decisions: Record<string, 'SI' | 'NO'>;     // id de rombo → rama tomada
  perOutput: Record<OutputId, {
    path: string[];
    outcome: 'energizada' | 'desenergizada' | 'alarma';
  }>;
}
```

La Vista de Flujo usa `FlowTrace` para:
- pintar en **verde** los nodos/aristas `visited`.
- marcar en cada rombo la rama tomada.
- resaltar en **rojo** nodos de alarma alcanzados.
- atenuar en **gris** los nodos no recorridos.

> El resaltado solo aplica al diagrama base (TTA). Diagramas extra se visualizan
> estáticamente (pan/zoom/drag) sin resaltado lógico — iteración futura.

---

## 7. Correspondencia nodo ↔ lógica

| id | Nodo | Lógica asociada |
|----|------|-----------------| 
| `10` | INICIO DEL SISTEMA | arranque del ciclo |
| `11` | Leer modo de operación | `resolveMode` |
| `12` | ¿MODO AUTOMÁTICO? | decisión modo (RN-01) |
| `17` | ¿BLACKOUT = 1? | `blackout` / KA-9 (RN-05) |
| `23/25/27` | ¿Fuente PREF 1/2/3 disponible? (S1) | `isAvailable` + cascada (RN-23) |
| `wAwO...-389` | ¿CONTACTOR OK = 1? (S1) | resultado de `maneuver` (RN-33) |
| `33` | ¿R-AS-BP = 1? (S1) | asimetría barra salida (RN-40/41/42) |
| `90` | SUBPROCESO DISP | `isAvailable` |
| `_QdE...-408` | SUBPROCESO CONT | `maneuver` |

La tabla completa se deriva de `flowLayout.json` + `03`. Comentar con `// NODE: <id>`
en el código del motor donde corresponda.

---

## 8. Navegación entre vistas

- Pestañas superiores: **[ Unifilar ] [ Flujo ]**.
- Panel de control y alarmas: compartidos, visibles en ambas pestañas.
- Estado de pestaña activa y diagrama activo: en `uiStore`, no en el engine.

---

## 9. Criterio de aceptación

- Carga con las posiciones exactas del `.drawio` (comparables a la imagen original).
- Posiciones arrastradas persisten al recargar la página.
- "Restaurar layout" vuelve a las posiciones originales.
- El usuario puede subir un JSON extra y conmutar entre diagramas.
- Al inyectar una condición, el camino lógico se resalta coherentemente con la Vista Unifilar.
- Los diagramas extra se visualizan (pan/zoom/drag) sin errores aunque no tengan resaltado lógico.
