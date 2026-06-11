# TTA Simulator

Simulador interactivo del **Tablero de Transferencia Automática (TTA) trifásico** 
con dos vistas sincronizadas del mismo sistema:

- **Vista Unifilar** — tablero eléctrico interactivo (entradas, breakers, 
  contactores, salidas) con flujo de energía animado.
- **Vista de Flujo** — diagrama de lógica de control "tipo draw.io", interactivo, 
  que ilumina el camino lógico recorrido.

## Propósito

Herramienta de demostración y validación de la lógica de transferencia de fuentes 
diseñada para un Tablero de Transferencia Automática, previo a su programación en 
sistemas de control como Honeywell Experion.

## Cómo usar

1. Clona este repositorio.
2. `npm install` y `npm run dev`.
3. Alterna entre las dos vistas (pestañas).
4. Inyecta condiciones: corta energía, abre breakers, fuerza asimetrías.
5. Observa cómo la lógica de transferencia responde en ambas vistas.

## Documentación

Ver `docs/` para especificación completa:
- `CLAUDE.md` — punto de entrada para desarrolladores.
- `docs/00-vision-y-alcance.md` — alcance y propósito.
- `docs/03-diagrama-de-flujo.md` — lógica de transferencia (fuente de verdad).
- `docs/06-especificacion-ui.md` — Vista Unifilar.
- `docs/08-vista-flujo.md` — Vista de Flujo.

## Stack

- **Engine:** TypeScript (puro, determinista, sin dependencias de UI).
- **Frontend:** React 18 + Vite + Tailwind CSS + Framer Motion.
- **Render:** SVG a medida (no canvas, no librerías de grafos genéricas).
- **Física:** mathjs (fasores trifásicos, componentes simétricas).
- **Pruebas:** Vitest.

## Estado

En desarrollo. Arquitectura y documentación completas; implementación en progreso.
