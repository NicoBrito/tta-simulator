# 09 — Estado actual del proyecto

> Documento vivo. Resume **lo que ya está hecho**, **lo que está en duda / pendiente de
> confirmar con el cliente** y **lo que falta por hacer**. Última actualización tras la
> validación contra el documento fuente "Modo funcionamiento TTA.docx" y la decisión de
> respetarlo (S3 admite PRINCIPAL).

---

## 1. Contexto de la última revisión

Se validó la implementación contra el documento **"Modo funcionamiento TTA.docx"** (texto +
imagen de la tabla de preferencias). Decisión tomada: **respetar el documento adjunto**.

Consecuencia principal: la salida **S3 (Iluminación Emergencia) ahora admite las tres
fuentes (P, A, B)**, existe el contactor **KM3-P** y S3 pasa a tener **3 preferencias**,
igual que S1 y S2. Esto revierte la antigua restricción RN-22 ("S3 solo A/B").

---

## 2. Lo que YA se tiene (hecho y verificado)

### Motor (`src/engine/`) — TypeScript puro, sin React
- ✅ `nominalInputs()` — estado nominal (todo energizado, modo AUTO, prefs [P,A,B] en las 3 salidas).
- ✅ `isAvailable` / `isAvailablePure` — disponibilidad de fuente (RN-10/11/12): requiere
  energía aguas arriba **y** breaker cerrado **y** sin trip **y** sin asimetría.
- ✅ `maneuver` (Subproceso CONT) — exclusividad (RN-30): abre los otros KM de la salida y
  cierra el elegido; confirma apertura/cierre y emite **AL-05** si un KM no obedece (RN-31/32/33).
- ✅ `step` — ciclo determinista S1→S2→S3 con cascada de preferencias (RN-23), alarma
  AL-04 si ninguna fuente disponible, verificación de asimetría de barra de salida (RN-40/41/42),
  KA-9 por blackout (RN-05) y resolución de modo (RN-01/02).
- ✅ Matriz de contactores **completa, incluido KM3-P**.

### Store (`src/store/simulatorStore.ts`)
- ✅ Zustand: guarda `inputs`, recalcula `derived = step(inputs)` en cada acción.
- ✅ Acciones directas para el SVG: `toggleSourceUpstream`, `toggleBreaker`, `toggleOutputAsymmetry`.
- ✅ Estado transitorio de UI: `transitioning` (pulso de maniobra ~1.6 s) y
  `transferNotes` (notificaciones que "se guardan" ~4.5 s).

### Vista Unifilar (`SingleLineDiagram.tsx`)
- ✅ Tema claro industrial, tipografía IBM Plex Sans/Mono.
- ✅ Refleja el estado real del motor: fuentes, breakers, **9 contactores (incluido KM3-P)**, barras y salidas.
- ✅ Corriente animada (dash) en conductores energizados.
- ✅ Resaltado de alarma (anillo pulsante) sobre el elemento afectado.
- ✅ Pulso de maniobra en el contactor que se cierra durante una transferencia.
- ✅ **Interacción directa**: click sobre fuente (cortar/restaurar energía), breaker (abrir/cerrar),
  barra de salida (simular asimetría).

### Panel de control (`ControlPanel.tsx`)
- ✅ Secciones colapsables con chips grandes.
- ✅ Modo AUTO/MANUAL (segmented) + falla de selector como toggle de alarma.
- ✅ Entradas P/A/B (energía / breaker / asimetría), blackout/KA-9, asimetría de salidas.
- ✅ Preferencias por pills con las 3 fuentes en las 3 salidas; impide repetir fuente (RN-21).
- ✅ Falla de contactores por KM, **incluido KM3-P**.
- ✅ Botón Reiniciar a estado nominal.

### Vista de Flujo (`FlowDiagram.tsx`)
- ✅ Carga `flowLayout.json`, pan/zoom/drag, ajuste automático de vista, "Restaurar layout".
- ✅ Tema claro con grilla de puntos; rombos/proceso/anotaciones diferenciados.

### Navbar / alarmas
- ✅ Navbar con marca "Simulador TTA", tabs (Unifilar / Flujo) y píldoras de estado en vivo.
- ✅ Panel de alarmas inferior (AL-01…AL-06) con scroll.
- ✅ Notificaciones de transferencia a la **izquierda**, que permanecen unos segundos.

### Conformidad con "Modo funcionamiento TTA.docx"
- ✅ 3 entradas / 3 salidas con nombres correctos.
- ✅ Cascada de preferencias y condiciones de falla de entrada.
- ✅ Confirmación de contactores por contacto auxiliar.
- ✅ Asimetrías de entrada y de salida.
- ✅ BLACKOUT → KA-9.
- ✅ Modos AUTO/MANUAL por DI12/DI13 (no pueden ser iguales).
- ✅ No repetir fuentes preferentes.
- ✅ **S3 admite PRINCIPAL** (corregido según el documento).

---

## 3. Dudas / a confirmar con el cliente

1. **Orden de preferencias por defecto de S3.** Se asumió [P, A, B] (como la imagen del
   documento). Confirmar si el cliente quiere otro orden nominal para Iluminación Emergencia.
2. ~~**CB "abierto" vs "falla/trip".**~~ ✅ **Resuelto:** el panel ya tiene **dos toggles
   independientes** por breaker (`CBn cerrado (C-AUX)` y `CBn Falla/Trip`), fieles a los dos
   contactos auxiliares del documento. La alarma AL-02 diferencia "Abierto" de "Falla/Trip".
   Click en el breaker del unifilar: lo abre/cierra, o lo resetea si está en trip.
3. **Modo MANUAL.** El documento solo dice que existe; no detalla el comportamiento del
   simulador. Hoy en MANUAL el motor no maniobra (queda desenergizado). ¿Se requiere operación
   manual de los KM desde la UI?
4. **Relés KA-1…KA-8.** El documento describe que cada KM se comanda por un KA. Hoy se
   abstrae (se cierra el contactor directo). ¿Hace falta mostrar/modelar los KA en el unifilar?

---

## 4. Lo que falta por hacer (pendiente)

### Prioritario
- [x] **`trace(inputs)` en el motor + resaltado del camino lógico** (`src/engine/trace.ts`).
      La Vista de Flujo pinta en verde los nodos recorridos, marca la rama SÍ/NO de cada
      rombo y resalta en rojo los nodos de alarma alcanzados; barra de estado por salida
      (S1/S2/S3 ✓/⚠). _Limitación: ver §5 — el diagrama dibuja S3 con solo 2 preferencias._
- [x] **Operación manual de contactores** en modo MANUAL: click sobre cada KM en el unifilar
      para abrir/cerrar (selector excluyente por salida). Al pasar de AUTO a MANUAL se
      "congela" el estado actual. Se mantiene la confirmación de contactor (AL-05) y la
      asimetría de barra de salida (AL-06) según RN-04.

### Importante
- [x] **Persistencia de posiciones** del FlowDiagram en `localStorage` (`services/layoutStorage.ts`).
      Carga al montar, guarda al soltar un nodo, "Restaurar layout" limpia y vuelve al JSON.
- [ ] **Tests del motor (Vitest)** cubriendo cada rama de `docs/07` — pendiente (excluido por ahora a pedido).
- [x] **Separar CB abierto vs trip** en el panel: dos contactos auxiliares independientes
      (`breakerClosed` y `breakerTrip`), con alarma AL-02 diferenciada.

### Deseable
- [ ] **Múltiples diagramas**: `DiagramUploader` + `DiagramSelector` (subir JSON extra).
- [ ] **Física avanzada (Fase 6)**: VUF, fasores, caídas de tensión, desglose de asimetría
      (voltaje / desfase / frecuencia / ausencia).
- [ ] **LoginGate** por `VITE_APP_PASSWORD` (diferido a una segunda etapa).
- [ ] Mostrar relés KA en el unifilar (ver duda #4).

---

## 5. ~~Discrepancia conocida: `flowLayout.json` vs lógica~~ ✅ Resuelta

> **Resuelto:** se decidió que **S3 (Ilum. Emergencia) NO se alimenta de PRINCIPAL**:
> sus únicas fuentes son **DB A y DB B**. Con esto el motor, el unifilar y el diagrama de
> flujo quedan alineados: `flowLayout.json` ya dibujaba S3 con solo 2 ramas (`63`, `65`),
> que ahora coinciden con `prefs S3 = [A, B]`. El resaltado (`trace`) de S3 es exacto.
>
> Cambios asociados:
> - `model.ts`: `S3.prefs = ['A','B']`.
> - `cont.ts`: matriz S3 = `{A: KM3-A, B: KM3-B}` (sin KM3-P; el tipo conserva `KM3-P` pero no se usa).
> - Unifilar: la barra S3 arranca en la columna DB A; no baja desde la columna PRINCIPAL.
> - Selector `-S4` (S3): posiciones **OFF / DBA / DBB**.

---

## 6. Cambios recientes de UI / topología

- **Selectores rotatorios** muestran etiquetas representativas (**OFF / P / DBA / DBB**) en
  lugar de números y arrancan en **OFF** al cargar la app.
- **Modo MANUAL ↔ AUTO:** la selección manual **nunca se sobrescribe** al cambiar de modo
  (MANUAL→AUTO→MANUAL restaura la última configuración). En MANUAL una falla respeta el
  selector (no conmuta automáticamente a otra fuente).
- **KA-9 / Clima:** ahora es un **sistema independiente** (marco aparte, alimentación propia),
  sin conexión eléctrica ni visual con la red TTA.
- **Visual:** barras energizadas **sin animación**; verde distinto para barras verticales
  (`#0f9d58`) y horizontales (`#046c46`); gris = sin energía, rojo = solo falla.
- **Panel derecho** sin scroll: se quitaron las secciones redundantes *Blackout* y
  *Asimetría de salida* (operables desde el unifilar: bobina KA-9 y relés R-AS).
- Se eliminaron el **modo oscuro** y el **título principal** para maximizar el área del diagrama.
