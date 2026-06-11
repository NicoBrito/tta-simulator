# CLAUDE.md — Simulador TTA (Tablero de Transferencia Automática)

> Este archivo orquesta el trabajo de **Claude Code** sobre este repositorio.
> Léelo completo antes de escribir una sola línea de código y vuelve a él ante cualquier duda de alcance o de regla de negocio.

---

## 1. Qué es este proyecto

Un **dashboard interactivo** que simula, en el navegador, la lógica de control de un
**Tablero de Transferencia Automática (TTA) trifásico**. No controla hardware real:
es una **herramienta de demostración a cliente**, paso previo a programar esa misma
lógica en un sistema **Honeywell Experion**.

El objetivo es que el cliente vea, en tiempo real, cómo el control selecciona entre
tres fuentes de energía cuando el operador inyecta fallas (toggles), y poder **validar
visualmente que la lógica coincide con el diagrama de flujo de referencia**.

El simulador tiene **dos vistas conmutables por pestañas**, ambas alimentadas por el
mismo motor y el mismo estado:
- **Vista Unifilar** — el tablero eléctrico con el flujo de energía (qué pasa). Ver `docs/06`.
- **Vista de Flujo** — el diagrama de flujo "tipo draw.io", interactivo, que ilumina el
  camino lógico recorrido (por qué pasa). Ver `docs/08`.

- **Alcance:** 100% navegador. Sin backend, sin base de datos, sin PLC real.
- **Idioma de código y comentarios:** español con términos técnicos en inglés (ej. `breaker`, `contactor`, `state`, `store`).
- **Idioma de UI:** español.
- **Sistema eléctrico:** 220 V / 50 Hz (Chile / Enel).

---

## 2. Regla de oro de la arquitectura

> **El motor decide. La UI refleja. El SVG nunca calcula nada.**

Toda la lógica de transferencia y toda la física eléctrica viven en `src/engine/`,
un módulo de **TypeScript puro, determinista y sin ninguna dependencia de React**.
La interfaz solo envía eventos al motor y pinta el estado que el motor devuelve.

Si te encuentras escribiendo lógica de selección de fuente, evaluación de
disponibilidad o cálculo de asimetría dentro de un componente de React, **detente**:
eso va en el motor.

---

## 3. Orden de lectura de la documentación

Lee los documentos de `docs/` **en este orden**. Son la fuente de verdad; este
`CLAUDE.md` solo coordina.

1. `docs/00-vision-y-alcance.md` — propósito, contexto de negocio, qué NO hacer.
2. `docs/01-glosario-y-senales.md` — vocabulario obligatorio: entradas, salidas, CB, KM, KA, R-AS, MOXA, contactos auxiliares.
3. `docs/02-reglas-de-negocio.md` — **las reglas invariantes**. Es el documento más importante.
4. `docs/03-diagrama-de-flujo.md` — la lógica transcrita rama por rama desde el `.drawio` original. Es la **fuente de verdad** de la lógica.
5. `docs/04-modelo-electrico.md` — fasores, componentes simétricas, VUF, modo simple vs. avanzado.
6. `docs/05-arquitectura-tecnica.md` — stack, estructura de carpetas, tipos, API del motor, flujo de datos.
7. `docs/06-especificacion-ui.md` — **Vista Unifilar**: unifilar SVG, codificación por color, panel de control, mapeo a la propuesta visual.
8. `docs/07-estrategia-de-pruebas.md` — cómo cada rama del flujo se traduce en un test.
9. `docs/08-vista-flujo.md` — **Vista de Flujo**: diagrama interactivo "tipo draw.io", layout sembrado desde el `.drawio`, resaltado del camino lógico.

---

## 4. Invariantes que NUNCA debes romper

Estas reglas son no negociables. Cualquier código que las viole está mal,
aunque "funcione".

1. **Exclusividad de contactores:** para una misma salida, **solo un contactor KM
   puede estar cerrado a la vez**. Antes de cerrar uno, los demás de esa salida deben abrirse.
   Las fuentes nunca se acoplan.
2. **Preferencias distintas:** las 3 preferencias de una salida deben ser fuentes
   **distintas entre sí**. La salida S3 (Iluminación Emergencia) solo admite **DB A (F2) y DB B (F3)**, nunca PRINCIPAL.
3. **Modo de operación excluyente:** `DI12` y `DI13` (MOXA 2) **nunca pueden ser iguales**.
   AUTO = (1,0); MANUAL = (0,1); cualquier otra combinación = **falla de selector → se asume MANUAL**.
4. **Confirmación obligatoria:** toda orden de cierre o apertura de un KM debe
   verificarse leyendo su contacto auxiliar (`ESTADO KM`). Si no confirma → **alarma de falla de contactor**, sin reintentos infinitos.
5. **Disponibilidad de fuente (Subproceso DISP):** una fuente está disponible **solo si**
   `C-AUX CBn CERRADO = 1` **Y** `C-AUX CBn FALLA/TRIP = 0` **Y** `R-AS de su barra de entrada = 1`.
6. **Determinismo del motor:** `step(state)` siempre produce el mismo resultado para
   el mismo estado de entrada. Nada de `Date.now()`, `Math.random()` ni efectos secundarios dentro del motor.
7. **El motor no importa React, ni Zustand, ni nada de UI.** Dirección de dependencia: `UI → store → engine`. Nunca al revés.

---

## 5. Stack tecnológico (no cambiar sin justificación)

- **Build/runtime:** Vite + React 18 + TypeScript (modo `strict`).
- **Estado:** Zustand (envuelve el motor).
- **Estilos:** Tailwind CSS.
- **Animación:** Framer Motion.
- **Física:** mathjs (números complejos para fasores).
- **Pruebas:** Vitest.
- **Render del unifilar:** SVG a medida vía React. **No** usar React Flow, mxGraph ni canvas/WebGL.

---

## 6. Orden de implementación (fases)

Respeta el orden. La corrección se valida antes de invertir en lo visual.

- **Fase 0 — Scaffold:** Vite + React + TS + Tailwind + Zustand + Framer Motion + Vitest. Build verde.
- **Fase 1 — Motor + tests (camino crítico):** `types`, `model`, `physics`, `sources` (DISP), `transfer`, `contactors` (CONT), `alarms`, `blackout`, `step`, `trace`. Tests contra cada rama de `docs/03-diagrama-de-flujo.md`. **No avances a la Fase 2 hasta que la suite esté verde.**
- **Fase 2 — Vista Unifilar (SVG):** componentes que pintan color por estado (sin animación). Ver `docs/06`.
- **Fase 3 — Panel de control + binding al store** (compartido por ambas vistas).
- **Fase 4 — Animación y pulido UX + panel de alarmas** (Vista Unifilar).
- **Fase 5 — Vista de Flujo:** lienzo SVG sembrado desde `src/data/flowLayout.json`, nodos arrastrables, pan/zoom, resaltado del camino activo usando `trace`. Pestañas entre vistas. Ver `docs/08`.
- **Fase 6 — Física avanzada:** entrada fasorial, VUF calculado, caídas de tensión y validación de capacidad.

---

## 7. Convenciones de código

- TypeScript `strict`. Nada de `any` salvo justificación escrita.
- Estados del dominio como **uniones discriminadas**, no strings sueltos ni booleanos ambiguos.
- Nombres de señales **idénticos al diagrama**: `KM1-P`, `CB1`, `R-AS-BP`, `KA-9`, etc. Usa esos identificadores literalmente.
- Funciones del motor: puras, tipadas, una responsabilidad.
- Cada regla de negocio relevante lleva un comentario `// REGLA: <id>` referenciando `docs/02-reglas-de-negocio.md`.
- Commits pequeños y temáticos por fase.

---

## 8. Definición de "terminado" por fase

Una fase está terminada cuando:
- El código compila con `tsc --noEmit` sin errores.
- (Fase 1+) `vitest run` está verde y cubre las ramas indicadas en `docs/07-estrategia-de-pruebas.md`.
- El comportamiento coincide con `docs/03-diagrama-de-flujo.md` (trazabilidad explícita).
- No se violó ningún invariante de la sección 4.

---

## 9. Ante la duda

Si una decisión no está cubierta por la documentación: **no inventes reglas de negocio
ni umbrales eléctricos**. Marca un `// TODO(decisión-pendiente): <pregunta>` y sigue
con lo que sí está definido. La fuente de verdad de la lógica es `docs/03`; la de las
reglas es `docs/02`.
