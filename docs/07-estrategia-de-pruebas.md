# 07 — Estrategia de Pruebas

El motor puro permite cobertura sistemática. **Cada rama del diagrama de flujo
(`03`) se traduce en al menos un caso de prueba** con Vitest. Esta es la garantía de
que la lógica simulada coincide con el diseño.

---

## 1. Principio

- Probar el **motor** de forma aislada (sin React).
- Una rama del flujo = un test con nombre que la referencia (ej.
  `RN-23: cae F1, F2 disponible → conecta F2`).
- Tests deterministas: misma entrada → misma salida.

---

## 2. Suites y casos mínimos

### `mode.test.ts` — resolución de modo (RN-01/02)
- `(1,0) → AUTO`
- `(0,1) → MANUAL`
- `(0,0) → FALLA_SELECTOR` + alarma AL-01, se asume MANUAL
- `(1,1) → FALLA_SELECTOR` + alarma AL-01, se asume MANUAL

### `disp.test.ts` — disponibilidad / Subproceso DISP (RN-10/11/12)
Matriz por fuente:
- breaker cerrado + sin trip + R-AS=1 → `Fuente OK = 1`
- breaker abierto → `Fuente OK = 0` + AL-02
- breaker trip → `Fuente OK = 0` + AL-02
- breaker OK + R-AS=0 → `Fuente OK = 0` + AL-03
- repetir para P (CB1/R-AS-P), A (CB2/R-AS-A), B (CB3/R-AS-B) (RN-13)

### `transfer.test.ts` — cascada de preferencias (RN-23/24)
- F1 disponible → conecta F1
- F1 no, F2 sí → conecta F2
- F1 y F2 no, F3 sí → conecta F3
- las tres no disponibles → desenergizada + AL-04
- S3 con 3 preferencias [P, A, B]: igual que S1/S2 (incluye PRINCIPAL vía KM3-P)

### `cont.test.ts` — maniobra / Subproceso CONT (RN-30/31/32/33)
- **Exclusividad:** al conectar S1→A, KM1-P y KM1-B quedan abiertos y solo KM1-A cerrado
- cierre confirmado → `CONTACTOR OK = 1`
- cierre no confirma (falla KM) → `CONTACTOR OK = 0` + AL-05
- apertura no confirma → `CONTACTOR OK = 0` + AL-05
- recorrer la tabla de maniobras de `03` (S1/S2/S3 × P/A/B, incluida S3→P con KM3-P)
- **Invariante:** en ningún resultado hay dos KM cerrados en la misma salida

### `symmetrical.test.ts` — física (modo avanzado, `04`)
- conjunto balanceado (220∠0/-120/120) → `VUF ≈ 0`, `R-AS = 1`
- desbalance de magnitud → `VUF > umbral` → `R-AS = 0`
- ausencia de tensión (|V1| bajo) → `R-AS = 0`
- frecuencia fuera de rango → `R-AS = 0`
- desfase angular > umbral → `R-AS = 0`

### `blackout.test.ts` — KA-9 (RN-05)
- `blackout = true → KA-9 = 1`
- `blackout = false → KA-9 = 0`

### `trace.test.ts` — traza para la Vista de Flujo (`08`)
- La traza es **derivada y determinista**: `trace(state)` da el mismo resultado para el mismo estado.
- Estado nominal → `decisions` coherentes (modo AUTO, blackout NO) y `perOutput` con outcome `energizada` para S1/S2/S3.
- Falla PRINCIPAL → la decisión "¿Fuente PREF 1 disponible?" de S1/S2 cae en `NO` y el camino visita la verificación de PREF 2.
- Asimetría barra salida S1 → `perOutput.S1.outcome = 'alarma'` y el camino alcanza el nodo de alarma asimétrica.
- Todos los `id` de `visited`/`decisions` existen en `flowLayout.json` (consistencia layout↔traza).

### `flow-branches.test.ts` — integración por ciclo `step`
- Estado nominal → S1/S2 en P, S3 en A, sin alarmas
- Falla energía PRINCIPAL → S1 y S2 hacen failover según sus preferencias; verificar
  fuente conectada y contactores resultantes
- Asimetría en barra de salida S1 (R-AS-BP=0) tras conexión → AL-06 + abre contactor
  conectado + S1 desenergizada (RN-42)
- MANUAL → `step` no realiza transferencia automática (RN-04)
- Escenarios combinados (varias fallas simultáneas) verificando el orden S1→S2→S3

---

## 3. Pruebas de UI (ligeras)
Con @testing-library/react, solo lo esencial:
- Los dropdowns de preferencia impiden repetir fuente (RN-21).
- Las tres salidas ofrecen P/A/B en 3 niveles (RN-22); KM3-P aparece en falla de contactores.
- Al accionar un toggle, el elemento correspondiente del unifilar cambia de color
  acorde al estado del motor (no se prueba la animación, sí el estado visual).

---

## 4. Criterio de aceptación (Fase 1)
`vitest run` verde, con todas las suites anteriores presentes y cubriendo las ramas
citadas. Sin esto, **no se avanza a la Fase 2** (ver `CLAUDE.md`, sección 6).

---

## 5. Convención de nombres de test
```
describe('Subproceso DISP (RN-10)', () => {
  it('P: breaker trip → Fuente OK = 0 + AL-02', () => { ... });
});
```
El nombre cita la regla (`RN-xx`) y/o la alarma (`AL-0x`) para trazabilidad directa
con `02` y `03`.
