# CLAUDE.md — Simulador TTA (Tablero de Transferencia Automática)

> Este archivo orquesta el trabajo de **Claude Code** sobre este repositorio.
> Léelo completo antes de escribir una sola línea de código y vuelve a él ante
> cualquier duda de alcance o de regla de negocio.

---

## 1. Qué es este proyecto

Un **dashboard interactivo** que simula, en el navegador, la lógica de control de un
**Tablero de Transferencia Automática (TTA) trifásico**. No controla hardware real:
es una **herramienta de demostración a cliente**, paso previo a programar esa misma
lógica en un sistema **Honeywell Experion**.

El simulador tiene **dos vistas conmutables por pestañas**, ambas alimentadas por el
mismo motor y el mismo estado:
- **Vista Unifilar** — el tablero eléctrico con el flujo de energía animado (qué pasa). Ver `docs/06`.
- **Vista de Flujo** — el diagrama de flujo lógico "tipo draw.io", interactivo,
  que ilumina el camino lógico recorrido (por qué pasa). Ver `docs/08`.

- **Alcance:** 100% navegador. Sin backend, sin base de datos, sin PLC real.
- **Auth:** password simple por variable de entorno Vite (`VITE_APP_PASSWORD`). Ver `docs/05`, sección 3.
- **Persistencia:** `localStorage` para posiciones de nodos y diagramas extra. Ver `docs/05`, sección 4.
- **Idioma de código y comentarios:** español con términos técnicos en inglés.
- **Idioma de UI:** español.
- **Sistema eléctrico:** 220 V / 50 Hz (Chile / Enel).

---

## 2. Regla de oro de la arquitectura

> **El motor decide. La UI refleja. El SVG nunca calcula nada.**

Dirección de dependencias (no invertir nunca):

```
components/ (React)  →  store/ (Zustand)  →  engine/ (TypeScript puro)
```

`engine/` no importa React, Zustand, ni nada de UI. Es testeable de forma aislada.

Si te encuentras escribiendo lógica de selección de fuente, evaluación de
disponibilidad o cálculo de asimetría dentro de un componente de React, **detente**:
eso va en el motor.

---

## 3. Orden de lectura de la documentación

Lee los documentos de `docs/` **en este orden**:

1. `docs/00-vision-y-alcance.md` — propósito, contexto de negocio, qué NO hacer.
2. `docs/01-glosario-y-senales.md` — vocabulario obligatorio.
3. `docs/02-reglas-de-negocio.md` — **las reglas invariantes**. El documento más importante.
4. `docs/03-diagrama-de-flujo.md` — lógica transcrita rama a rama. **Fuente de verdad.**
5. `docs/04-modelo-electrico.md` — fasores, VUF, modos simple y avanzado.
6. `docs/05-arquitectura-tecnica.md` — stack, auth, persistencia, estructura, tipos, API.
7. `docs/06-especificacion-ui.md` — Vista Unifilar: SVG, colores, panel de control.
8. `docs/07-estrategia-de-pruebas.md` — cada rama del flujo = un test.
9. `docs/08-vista-flujo.md` — Vista de Flujo: diagrama interactivo, persistencia, múltiples diagramas.

---

## 4. Invariantes que NUNCA debes romper

1. **Exclusividad de contactores:** solo un KM cerrado por salida a la vez.
2. **Preferencias distintas:** sin repetir fuente. S3 solo admite DB A y DB B.
3. **Modo excluyente:** `DI12 ≠ DI13` siempre que el modo sea válido.
4. **Confirmación obligatoria:** toda maniobra de KM se confirma por contacto auxiliar.
5. **Disponibilidad de fuente:** `CB cerrado ∧ ¬trip ∧ R-AS=1` (RN-10).
6. **Motor determinista:** `step(state)` puro. Sin `Date.now()`, `Math.random()` ni efectos.
7. **Motor sin UI:** `engine/` no importa React, Zustand ni nada de presentación.
8. **localStorage con try/catch:** toda escritura/lectura tiene fallback silencioso.

---

## 5. Stack tecnológico (no cambiar sin justificación)

- **Build/runtime:** Vite + React 18 + TypeScript (`strict`).
- **Estado:** Zustand.
- **Estilos:** Tailwind CSS.
- **Animación:** Framer Motion.
- **Física:** mathjs.
- **Pruebas:** Vitest.
- **Render:** SVG a medida. **No** React Flow, mxGraph ni canvas/WebGL.
- **Auth:** `VITE_APP_PASSWORD` en env var + sessionStorage. Sin librerías de auth.
- **Persistencia:** `localStorage`. Sin backend ni base de datos.

---

## 6. Orden de implementación (fases)

Respeta el orden. La corrección se valida antes de invertir en lo visual.

- **Fase 0 — Scaffold:** Vite + React + TS + Tailwind + Zustand + Framer Motion +
  Vitest + `LoginGate` + `.env.example`. Build verde.
- **Fase 1 — Motor + tests (camino crítico):** `types`, `model`, `physics`, `disp`,
  `transfer`, `cont`, `alarms`, `blackout`, `step`, `trace`. Tests contra cada rama
  de `docs/03`. **No avanzar a Fase 2 hasta suite verde.**
- **Fase 2 — Vista Unifilar (SVG):** componentes que pintan por estado (sin animación). Ver `docs/06`.
- **Fase 3 — Panel de control + binding al store** (compartido entre vistas).
- **Fase 4 — Animación y pulido UX + panel de alarmas** (Vista Unifilar).
- **Fase 5 — Vista de Flujo:** SVG sembrado desde `flowLayout.json`, drag/drop,
  pan/zoom, persistencia en localStorage, `DiagramUploader`, `DiagramSelector`,
  resaltado con `trace`. Pestañas entre vistas. Ver `docs/08`.
- **Fase 6 — Física avanzada:** entrada fasorial, VUF calculado, caídas de tensión.

---

## 7. Convenciones de código

- TypeScript `strict`. Nada de `any` salvo justificación escrita en comentario.
- Estados del dominio como uniones discriminadas, no strings sueltos.
- Nombres de señales **idénticos al diagrama**: `KM1-P`, `CB1`, `R-AS-BP`, `KA-9`.
- Reglas de negocio comentadas con `// REGLA: RN-xx`.
- Nodos del diagrama comentados con `// NODE: <id>` donde aplique en el motor.
- Commits pequeños y temáticos por fase.
- `.env.local` en `.gitignore`. Commitear solo `.env.example` (sin valor real).

---

## 8. Definición de "terminado" por fase

- Compila con `tsc --noEmit` sin errores.
- (Fase 1+) `vitest run` verde, cubriendo las ramas de `docs/07`.
- Comportamiento coincide con `docs/03` (trazabilidad explícita).
- No se viola ningún invariante de la sección 4.

---

## 9. Ante la duda

No inventes reglas de negocio ni umbrales eléctricos. Marca
`// TODO(decisión-pendiente): <pregunta>` y sigue con lo definido.
Fuente de verdad de la lógica: `docs/03`. De las reglas: `docs/02`.
