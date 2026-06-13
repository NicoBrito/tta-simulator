# 01 — Glosario y Señales

Vocabulario obligatorio. Usa estos identificadores **literalmente** en el código
(nombres de variables, claves de estado, etiquetas de UI), tal como aparecen en el
diagrama de flujo y el unifilar.

---

## Entradas de energía (fuentes)

| ID | Nombre | Origen | Breaker | Relé asimetría barra entrada |
|----|--------|--------|---------|------------------------------|
| **P** / F1 / P1 | PRINCIPAL | Ducto Barra Territoria | CB1 | R-AS-P |
| **A** / F2 / P2 | DB A | Ducto Barra A (Enel) | CB2 | R-AS-A |
| **B** / F3 / P3 | DB B | Ducto Barra B (Enel) | CB3 | R-AS-B |

> El diagrama usa indistintamente `F1/F2/F3` (preferencias) y `P1/P2/P3` (entradas
> físicas). En este proyecto, la **fuente** se identifica con `P | A | B`. `F1/F2/F3`
> son **posiciones de preferencia** que apuntan a una de esas fuentes.

## Salidas

| ID | Tablero alimentado | Corriente | Relé asimetría barra salida | Fuentes admitidas |
|----|--------------------|-----------|-----------------------------|-------------------|
| **S1** | TDAF y COMP. | 100 A | R-AS-BP | P, A, B |
| **S2** | COMPUTACIÓN RESPALDADA | 25 A | R-AS-BA | P, A, B |
| **S3** | ILUMINACIÓN EMERGENCIA | 10 A | R-AS-BB | P, A, B |

> **S3 admite las tres fuentes (P, A, B).** Según el documento "Modo funcionamiento TTA",
> la salida ILUMINACIÓN EMERGENCIA puede tomar PRINCIPAL, DB A o DB B (3 preferencias).

## Interruptores automáticos (breakers)

| ID | Entrada | Señales de estado (contactos auxiliares) |
|----|---------|-------------------------------------------|
| CB1 | PRINCIPAL | `C-AUX CB1 CERRADO` (1/0), `C-AUX CB1 FALLA/TRIP` (1/0) |
| CB2 | DB A | `C-AUX CB2 CERRADO` (1/0), `C-AUX CB2 FALLA/TRIP` (1/0) |
| CB3 | DB B | `C-AUX CB3 CERRADO` (1/0), `C-AUX CB3 FALLA/TRIP` (1/0) |

- `CERRADO = 1` → breaker cerrado (conduce). `CERRADO = 0` → abierto.
- `FALLA/TRIP = 1` → breaker disparado/en falla. `FALLA/TRIP = 0` → normal.

## Contactores (matriz salida × fuente)

Cada salida se conecta a una fuente cerrando su contactor KM. Comandados por relés KA,
confirmados por contacto auxiliar `ESTADO KM`.

|        | → PRINCIPAL (P) | → DB A (A) | → DB B (B) |
|--------|-----------------|------------|------------|
| **S1** | KM1-P | KM1-A | KM1-B |
| **S2** | KM2-P | KM2-A | KM2-B |
| **S3** | KM3-P | KM3-A | KM3-B |

- `ESTADO KMx-y = 1` → contactor cerrado (confirmado). `= 0` → abierto.

## Relés de asimetría

| Relé | Barra | Tipo |
|------|-------|------|
| R-AS-P | BARRA PRINCIPAL | entrada |
| R-AS-A | BARRA DB A | entrada |
| R-AS-B | BARRA DB B | entrada |
| R-AS-BP | BARRA TDAF y COMP. (S1) | salida |
| R-AS-BA | BARRA COMPUTACIÓN RESPALDADA (S2) | salida |
| R-AS-BB | BARRA ILUMINACIÓN EMERGENCIA (S3) | salida |

- `R-AS-x = 1` → energía OK en la barra (sin asimetría). `= 0` → falla asimétrica.
- **Asimetría** agrupa: voltaje fuera de rango, desfase angular entre fases,
  frecuencia fuera de rango, o ausencia de voltaje (ver `04-modelo-electrico.md`).

## Relés de control (salidas KA)

| Relé | Función |
|------|---------|
| KA-1 … KA-8 | Comandan cierre/apertura de los contactores KM (según unilineal). |
| **KA-9** | Control de carga de clima. `KA-9 = 1` (DO15 MOXA 2) bota la carga de clima no crítica cuando hay BLACKOUT. |

## Selección de modo (MOXA 2)

| DI12 | DI13 | Modo |
|------|------|------|
| 1 | 0 | **AUTO** (control por Experion) |
| 0 | 1 | **MANUAL** (operador comanda KM por selectores frontales) |
| 0 | 0 | **FALLA SELECTOR** → alarma visual, se asume MANUAL |
| 1 | 1 | **FALLA SELECTOR** → alarma visual, se asume MANUAL |

## Otras señales

| Señal | Descripción |
|-------|-------------|
| **BLACKOUT** | Dato de lectura remota (otro proceso de Experion). `=1` activa KA-9. |
| **Fuente OK** | Salida del Subproceso DISP: 1 = fuente disponible, 0 = no disponible. |
| **CONTACTOR OK** | Salida del Subproceso CONT: 1 = maniobra confirmada, 0 = falla de contactor. |
| MOXA 1 / MOXA 2 | Unidades de E/S que mapean señales físicas a Experion. |

## Subprocesos lógicos

| Subproceso | Entrada | Salida | Función |
|------------|---------|--------|---------|
| **DISP** | (Salida, Entrada) | `Fuente OK = 0/1` | Verifica disponibilidad de una fuente para una salida. |
| **CONT** | (Salida, Entrada) | `CONTACTOR OK = 0/1` | Cierra el contactor de la fuente elegida, **abriendo los demás de esa salida**, y confirma cada maniobra. |
