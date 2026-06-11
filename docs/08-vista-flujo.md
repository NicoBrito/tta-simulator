# 08 — Especificación de la Vista de Flujo (Vista 1)

El simulador tiene **dos vistas del mismo sistema**, conmutables por **pestañas**:

- **Vista Unifilar (Vista 2)** — el tablero eléctrico interactivo (ver `06`).
- **Vista de Flujo (Vista 1)** — el diagrama de flujo lógico "tipo draw.io",
  **interactivo**, especificado en este documento.

Ambas vistas leen del **mismo motor** (`engine/`) y del mismo `TtaState`. Una sola
ejecución de `step` actualiza las dos. Cambiar de pestaña no recalcula nada: solo
cambia la representación.

---

## 1. Propósito de la Vista de Flujo

Mientras la Vista Unifilar muestra **qué** pasa (la energía moviéndose), la Vista de
Flujo muestra **por qué** pasa: ilumina el **camino lógico** que el motor recorrió
para llegar al estado actual (qué decisión tomó cada rombo, en qué rama cayó, en qué
nodo terminó cada salida). Es el puente directo con la lógica que luego se programa en
Experion.

---

## 2. Fuente del dibujo: `src/data/flowLayout.json`

El layout **reusa las posiciones exactas del `.drawio` original**. Se exportó a
`src/data/flowLayout.json` con esta forma:

```jsonc
{
  "meta": { "source": "Diagrama_Flujo_TTA_Ver_05.drawio", "units": "px", "note": "..." },
  "nodes": [
    { "id": "10", "label": "INICIO DEL SISTEMA", "shape": "process",
      "x": 1159.67, "y": -930, "w": 250, "h": 60, "kind": "node" },
    // ...
  ],
  "edges": [
    { "id": "...", "source": "<nodeId>", "target": "<nodeId>", "label": "SÍ" },
    // ...
  ]
}
```

- **`shape`**: `process` (rectángulo), `decision` (rombo), `terminal` (inicio/fin).
- **`kind`**:
  - `node` — nodo del flujo lógico (224). Se dibuja y participa en el resaltado.
  - `annotation` — leyenda/nota lateral (22). Se dibuja con estilo distinto (nota),
    **no** participa en el flujo ejecutable. Son las definiciones tipo
    "S1 = Salida 1 = TDAF y COMP.", el bloque MODO AUTO/MANUAL/FALLA SELECTOR, etc.
  - `connector-label` — etiqueta suelta "SÍ"/"NO" (136). No se dibuja como caja; su
    texto, cuando aplica, se usa como etiqueta de la arista correspondiente.
- Coordenadas en px; el lienzo abarca aprox. `x ∈ [-533, 3806]`, `y ∈ [-930, 10531]`.

> El JSON es **semilla de posiciones**, no la lógica. La lógica es el motor (`engine/`)
> y su fuente de verdad es `03-diagrama-de-flujo.md`. El mapeo nodo↔lógica se hace por
> `id` (ver sección 5).

---

## 3. Interacción requerida

- **Pan y zoom** del lienzo (es grande y vertical).
- **Arrastrar cajas:** cada nodo es **reposicionable** por el usuario (drag &
  drop). Las aristas se reconectan visualmente al mover los nodos.
- **Persistencia de posiciones en sesión:** si el usuario reacomoda, se mantiene
  durante la sesión (en memoria / estado de React). **No** usar localStorage (ver
  restricción de artifacts en `05`); si se requiere persistencia entre sesiones, es
  decisión futura, no asumir.
- **Botón "Restaurar layout":** vuelve a las posiciones originales del JSON.
- **Las mismas condiciones del panel de control** (toggles, preferencias, modo)
  afectan esta vista igual que a la unifilar, porque ambas leen del mismo estado.

---

## 4. Tecnología de render

- SVG a medida (coherente con la Vista Unifilar). **No** React Flow ni mxGraph.
- El drag se implementa con manejadores de puntero sobre cada nodo SVG, actualizando
  su `{x,y}` en un estado local de la vista (no en el `engine`).
- Aristas como paths SVG (ortogonales tipo diagrama de flujo) calculados desde los
  bordes de los nodos origen/destino.

> Justificación: mantener un único enfoque de render (SVG) en ambas vistas evita
> introducir una librería de grafos solo para esto y conserva control total del estilo.

---

## 5. Resaltado del camino activo (lo que conecta la vista con el motor)

El motor debe exponer, además del estado, una **traza de ejecución**: la lista
ordenada de `id` de nodos que recorrió en el último `step`, y por cada decisión, la
rama tomada.

Propuesta de extensión del motor (no rompe el determinismo):

```ts
export interface FlowTrace {
  visited: string[];                 // ids de flowLayout.json en orden de recorrido
  decisions: Record<string, 'SI'|'NO'>; // id de rombo -> rama tomada
  perOutput: Record<OutputId, {      // dónde terminó cada salida
    path: string[];
    outcome: 'energizada' | 'desenergizada' | 'alarma';
  }>;
}

export function step(state: TtaState): TtaState;       // sigue igual
export function trace(state: TtaState): FlowTrace;     // deriva la traza del mismo estado
```

`trace` es **puro y derivado del mismo estado** que `step`; no introduce aleatoriedad
ni efectos. El mapeo nodo↔regla se documenta en una tabla de correspondencia (sección 6).

La Vista de Flujo usa `FlowTrace` para:
- pintar en **verde** los nodos/aristas `visited` (camino activo),
- marcar en cada rombo la rama tomada (`decisions`),
- resaltar en **rojo** los nodos de alarma alcanzados,
- atenuar en **gris** los nodos no recorridos en este ciclo.

Codificación de color idéntica a la Vista Unifilar (`06`, sección 2).

---

## 6. Correspondencia nodo ↔ lógica (trazabilidad)

Claude Code debe mantener un mapa explícito entre los `id` de `flowLayout.json` y los
puntos de la lógica del motor, para poder construir `FlowTrace`. Anclas principales
(por `id` del JSON; ver el archivo para el resto):

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

> La tabla completa se deriva del JSON + `03`. Mantener `// REGLA: RN-xx` en el código
> y un comentario con el `id` del nodo cuando aplique.

---

## 7. Navegación entre vistas

- Barra de pestañas superior: **[ Unifilar ] [ Flujo ]**.
- El panel de control (toggles, preferencias, modo, alarmas) es **compartido** y
  permanece visible o accesible en ambas pestañas.
- El estado de selección de pestaña vive en el store de UI, no en el `engine`.

---

## 8. Criterio de aceptación de la Vista 1

- Carga con las posiciones exactas del `.drawio` (comparables a la imagen original).
- Las anotaciones se distinguen visualmente de los nodos de proceso.
- Al inyectar una condición, el camino lógico se resalta coherentemente con el estado
  que muestra la Vista Unifilar (misma verdad, dos representaciones).
- Las cajas se pueden arrastrar y existe "Restaurar layout".
