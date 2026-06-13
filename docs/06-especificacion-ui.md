# 06 — Especificación de UI (Vista Unifilar)

> Esta es la **Vista Unifilar (Vista 2)** de las dos vistas del simulador. La
> **Vista de Flujo (Vista 1)** se especifica en `08-vista-flujo.md`. Ambas se
> conmutan por pestañas y comparten motor, estado y panel de control.

La interfaz reproduce la **propuesta visual** (unifilar al centro, panel de control a
la derecha). La calidad visual es prioridad: los estados y transiciones son requisito,
no adorno. La UI **refleja** el estado del motor; no decide nada (ver `05`).

---

## 1. Layout general

```
┌─────────────────────────────────────────────┬───────────────────┐
│  SIMULADOR TTA   [Transferencia Automática]  │  MODO DE OPERACIÓN │
│  Leyenda: ● Con energía ● Sin energía ● Falla │  [ AUTO | MANUAL ] │
│                                               │                   │
│   ── UNIFILAR SVG ──                          │  ENTRADAS (P/A/B)  │
│   Entradas (CB1/2/3) → barras → matriz KM     │   Energía / CB Trip│
│   → salidas S1/S2/S3                          │   / Asim. bus      │
│                                               │  ASIMETRÍA SALIDAS │
│                                               │  FALLA CONTACTORES │
│                                               │  BLACKOUT / KA-9   │
│                                               │  PREFERENCIAS S1-3 │
│                                               │  [Reiniciar]       │
├───────────────────────────────────────────────────────────────────┤
│  ALARMAS ACTIVAS:  (lista; "Sistema nominal — sin alarmas")         │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Codificación de estados por color

| Estado | Color | Aplica a |
|--------|-------|----------|
| Con energía | Verde | conductores, barras y contactores en la trayectoria energizada |
| Sin energía | Gris | elementos desenergizados o tramos abiertos |
| En falla | Rojo | breaker trip, asimetría, contactor que no confirma |

Definir como design tokens en `styles/tokens.css` (variables CSS) y consumir en SVG.

## 3. Componentes del unifilar (SVG)

- **Source** — entrada (PRINCIPAL / DB A / DB B) con indicador ON/OFF.
- **Breaker** — CB1/CB2/CB3, estados `CERR.` / `ABIERTO` / `TRIP`.
- **Bus** — barras de entrada y de salida, con su relé de asimetría (OK / falla).
- **Contactor** — KMx-y, estado `ABIERTO` / `CERRADO`; el contacto se desplaza al maniobrar.
- **Conductor** — tramo de conexión; anima el flujo de corriente cuando está energizado.
- **Output** — salida con nombre, corriente nominal (100/25/10 A) y fuente activa (◄ FTE P/A/B).

Estructura visual de referencia: tres columnas de entrada (Principal, DB A, DB B),
barras horizontales, y filas por salida (S1, S2, S3) con los contactores en la
intersección salida × fuente. **Las tres salidas tienen contactor hacia las tres fuentes**
(S3 incluye KM3-P, según el documento "Modo funcionamiento TTA").

## 4. Panel de control

- **Selector de modo:** AUTO / MANUAL (refleja DI12/DI13; si el motor reporta
  `FALLA_SELECTOR`, mostrar el aviso correspondiente).
- **Entradas (P / A / B):** toggles `Energía`, `CB Trip`, `Asim. bus`.
- **Asimetría barras de salida:** toggles S1, S2, S3 (R-AS-BP/BA/BB).
- **Falla de contactores:** toggles por KM (KM1/KM2/KM3 × P/A/B, incluido KM3-P).
- **Blackout:** toggle; cuando está activo, mostrar `KA-9` energizado.
- **Preferencias del operador:** dropdowns 1ª/2ª/3ª por salida. Debe **impedir
  repetir fuente** (RN-21). Las tres salidas muestran 3 niveles con las fuentes P/A/B (RN-22).
- **Reiniciar a estado nominal:** botón que restaura `nominalState()`.

## 5. Panel de alarmas

- Lista de alarmas activas con su mensaje (catálogo AL-0x de `02`).
- Estado vacío: "Sistema nominal — sin alarmas".
- Cada alarma resalta en rojo el elemento afectado en el unifilar.

## 6. Animaciones (Framer Motion)

- Transición de color al energizar/desenergizar una trayectoria.
- Flujo de corriente animado (dash offset) sobre conductores activos.
- Apertura/cierre de contactor con desplazamiento del contacto.
- Parpadeo suave de elementos en falla y entrada de alarmas al panel.

## 7. Estado nominal de referencia

Las tres entradas con energía, CB1/2/3 cerrados, las tres salidas (S1, S2, S3) con
preferencia [P, A, B] tomando PRINCIPAL, sin alarmas, blackout NO, clima conectado.
Es el estado que produce `nominalState()` y al que vuelve el botón Reiniciar.

## 8. Accesibilidad y legibilidad

- No depender solo del color: acompañar con etiquetas de texto (`CERR.`, `ABIERTO`,
  `TRIP`, `OK`, `FTE P/A/B`).
- Contraste suficiente; tamaños legibles para presentación proyectada a un cliente.
