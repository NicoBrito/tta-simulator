# 02 — Reglas de Negocio

Documento normativo. Cada regla tiene un identificador `RN-xx` para referenciarla
desde el código (`// REGLA: RN-xx`). Estas reglas derivan del documento
"Modo de funcionamiento TTA" y del diagrama de flujo (`03-diagrama-de-flujo.md`),
que es la fuente de verdad ante cualquier ambigüedad.

---

## Ciclo de control (RN-00)

El sistema opera en un **ciclo continuo**:

1. Leer modo de operación (AUTO / MANUAL / falla selector).
2. Leer estado de entradas (CB1/2/3 y R-AS-P/A/B).
3. Leer señal BLACKOUT y actuar KA-9.
4. Procesar Salida 1 (S1), luego Salida 2 (S2), luego Salida 3 (S3).
5. Volver al paso 1 (↺).

En el simulador, cada cambio de entrada del usuario dispara una ejecución del ciclo
(`step`), de forma determinista.

---

## Modo de operación

- **RN-01 — Selección de modo:** el modo se determina por `DI12`/`DI13` (MOXA 2):
  `(1,0)=AUTO`, `(0,1)=MANUAL`. Modelar el modo como un único valor y derivar ambas
  señales de él para garantizar el invariante.
- **RN-02 — Falla de selector:** si `DI12 == DI13` (ambos 0 o ambos 1) → **alarma
  visual de error de selector** y **se asume MODO MANUAL**.
- **RN-03 — Comportamiento AUTO:** Experion ejecuta la transferencia automática
  (RN-10 y siguientes).
- **RN-04 — Comportamiento MANUAL:** Experion **no** controla el tablero; el operador
  comanda las bobinas KM mediante los selectores frontales. El simulador, en MANUAL,
  no realiza transferencia automática, pero mantiene la lectura de estados y las
  alarmas de confirmación de contactor.

---

## Blackout y clima

- **RN-05 — KA-9 por blackout:** si `BLACKOUT = 1` → `KA-9 = 1` (DO15 MOXA 2), botando
  la carga de clima no crítica. Si `BLACKOUT = 0` → `KA-9 = 0`.

---

## Disponibilidad de fuente — Subproceso DISP

- **RN-10 — Condición de disponibilidad:** una fuente (P/A/B) está **disponible**
  (`Fuente OK = 1`) para una salida **solo si se cumplen las tres condiciones**:
  1. `C-AUX CBn CERRADO = 1` (breaker cerrado), **y**
  2. `C-AUX CBn FALLA/TRIP = 0` (breaker sin disparo), **y**
  3. `R-AS de su barra de entrada = 1` (sin asimetría).
  Si falla cualquiera → `Fuente OK = 0`.
- **RN-11 — Alarma de breaker:** si el breaker está abierto o en falla/trip
  (`CERRADO=0` o `FALLA/TRIP=1`) → **alarma visual** "Estado CBn Abierto/Falla/Trip".
- **RN-12 — Alarma de barra de entrada:** si el breaker está OK pero `R-AS-x = 0`
  → **alarma visual** "BARRA … sin energía".
- **RN-13 — Mapeo salida→breaker:** P usa CB1, A usa CB2, B usa CB3 (independiente
  de la salida que consulte).

---

## Selección por preferencias (lógica principal AUTO)

- **RN-20 — Preferencias del operador:** cada salida tiene un orden de preferencias
  (1ª, 2ª, 3ª) que apuntan a fuentes P/A/B.
- **RN-21 — Preferencias distintas:** las preferencias de una salida **no se pueden
  repetir**; deben ser fuentes distintas entre sí. La UI debe impedir configurar repetidos.
- **RN-22 — S3 restringida:** la salida S3 (Iluminación Emergencia) **solo** admite
  DB A (F2) y DB B (F3); tiene **2 preferencias**, no 3. Nunca PRINCIPAL.
- **RN-23 — Cascada de selección:** para cada salida, evaluar la 1ª preferencia con DISP;
  si `Fuente OK = 1`, seleccionarla; si no, evaluar la 2ª; si no, la 3ª (cuando exista).
- **RN-24 — Sin fuente disponible:** si ninguna preferencia está disponible →
  **alarma visual** "Sin energía disponible para la Salida Sx" y la salida queda
  desenergizada (todos sus KM abiertos).
- **RN-25 — Conexión de la fuente elegida:** una vez elegida la fuente, se invoca el
  Subproceso CONT con `(Salida, Entrada)` para cerrar su contactor.

---

## Maniobra de contactores — Subproceso CONT

- **RN-30 — Exclusividad (CRÍTICA):** antes de cerrar el contactor de la fuente
  elegida, **abrir los otros contactores de esa misma salida**. Nunca pueden quedar
  dos KM cerrados en una salida (las fuentes no se acoplan). Ejemplos del diagrama:
  - S1 → P: abre KM1-A y KM1-B, cierra KM1-P.
  - S1 → A: abre KM1-P y KM1-B, cierra KM1-A.
  - S1 → B: abre KM1-P y KM1-A, cierra KM1-B.
  - S2 → P: abre KM2-A y KM2-B, cierra KM2-P. (análogo para A, B)
  - S3 → A: abre KM3-B, cierra KM3-A.
  - S3 → B: abre KM3-A, cierra KM3-B.
- **RN-31 — Confirmación de apertura:** tras ordenar abrir un KM, leer su `ESTADO KM`;
  si no pasó a 0 → **alarma visual** "Falla Contactor KMx-y" y `CONTACTOR OK = 0`.
- **RN-32 — Confirmación de cierre:** tras ordenar cerrar el KM elegido, leer su
  `ESTADO KM`; si no pasó a 1 → **alarma visual** "Falla Contactor KMx-y" y
  `CONTACTOR OK = 0`.
- **RN-33 — Éxito de maniobra:** si todas las aperturas y el cierre confirman →
  `CONTACTOR OK = 1`.
- **RN-34 — Sin reintentos infinitos:** una falla de contactor genera alarma y se
  reporta; el motor no entra en bucle de reintento.

---

## Verificación de barra de salida (post-CONT)

- **RN-40 — Lectura de asimetría de salida:** si `CONTACTOR OK = 1`, leer el relé de
  asimetría de la barra de salida correspondiente (R-AS-BP para S1, R-AS-BA para S2,
  R-AS-BB para S3).
- **RN-41 — Salida energizada:** si `R-AS-Bx = 1` → **Salida Sx energizada**
  (fuente conectada y barra sin falla asimétrica). Estado final exitoso.
- **RN-42 — Asimetría en barra de salida:** si `R-AS-Bx = 0` → **alarma visual**
  "Falla Asimétrica en la BARRA …", y **abrir el contactor de la fuente conectada**
  (según cuál fuente F1/F2/F3 estaba conectada). La salida queda desenergizada.
- **RN-43 — CONTACTOR OK = 0:** si la maniobra no confirmó (RN-31/32), no se energiza
  la salida y prevalece la alarma de falla de contactor.

---

## Catálogo de alarmas (resumen)

| ID | Alarma | Disparador | Regla |
|----|--------|------------|-------|
| AL-01 | Error de selector de modo | `DI12 == DI13` | RN-02 |
| AL-02 | Estado CBn Abierto/Falla/Trip | breaker abierto o en trip | RN-11 |
| AL-03 | BARRA (entrada) sin energía | `R-AS-x = 0` con breaker OK | RN-12 |
| AL-04 | Sin energía disponible para Sx | ninguna preferencia disponible | RN-24 |
| AL-05 | Falla Contactor KMx-y | apertura/cierre no confirmado | RN-31/32 |
| AL-06 | Falla Asimétrica en BARRA de salida | `R-AS-Bx = 0` | RN-42 |

Todas las alarmas son **visuales** (el sistema real es Experion). En el simulador se
muestran en el panel de alarmas y resaltan el elemento afectado en el unifilar.

---

## Invariantes (resumen para validación rápida)

1. Un solo KM cerrado por salida (RN-30).
2. Preferencias distintas; S3 solo A/B (RN-21, RN-22).
3. `DI12 != DI13` siempre que el modo sea válido (RN-01, RN-02).
4. Toda maniobra de KM se confirma (RN-31, RN-32).
5. `Fuente OK` requiere breaker cerrado + sin trip + sin asimetría (RN-10).
6. El motor es determinista y puro.
