# 04 — Modelo Eléctrico

Define cómo el simulador representa la realidad eléctrica. Hay **dos modos** que
operan sobre el mismo motor de lógica (ver `00` y `02`).

Sistema nominal: **220 V fase-neutro, 50 Hz, trifásico** (Chile / Enel).

---

## 1. Dos modos de entrada

### Modo simple (demo, por defecto)
La asimetría y la presencia de energía se controlan con **toggles** booleanos:
- `energía aguas arriba` (presente / ausente)
- `CB` (cerrado / abierto / trip)
- `asimetría de barra` (OK / falla) → mapea directo a `R-AS-x = 1/0`

Es el modo principal para presentar al cliente: marcar "falla" y ver la transferencia.

### Modo avanzado (físico)
Cada fuente se define como un **conjunto trifásico de fasores** y el estado
`R-AS-x` se **calcula** a partir de magnitudes físicas. Permite sustentar la demo
con números reales.

> Ambos modos producen el mismo tipo de salida hacia la lógica: un valor
> `R-AS-x ∈ {0,1}` y la disponibilidad de la fuente. La lógica de transferencia
> (`02`, `03`) no cambia entre modos.

---

## 2. Representación fasorial

Cada fase es un fasor complejo `V = |V|∠θ`. Conjunto trifásico nominal balanceado:

```
Va = 220 ∠   0°
Vb = 220 ∠ -120°
Vc = 220 ∠ +120°
```

Implementar con `mathjs` (`math.complex`). Helpers sugeridos en `engine/physics/phasor.ts`:
- `fromPolar(mag, angleDeg) → Complex`
- `toPolar(c) → { mag, angleDeg }`
- operador `a = 1∠120°`.

---

## 3. Componentes simétricas y VUF

La asimetría se evalúa con la transformada de componentes simétricas
(`engine/physics/symmetrical.ts`). Con `a = 1∠120°`:

```
V0 = (Va + Vb + Vc) / 3              # secuencia cero
V1 = (Va + a·Vb + a²·Vc) / 3         # secuencia positiva
V2 = (Va + a²·Vb + a·Vc) / 3         # secuencia negativa

VUF (Voltage Unbalance Factor) = |V2| / |V1| · 100   [%]
```

---

## 4. Criterio de asimetría (cálculo de R-AS-x)

En modo avanzado, `R-AS-x = 0` (falla asimétrica) si se cumple **cualquiera** de las
cuatro condiciones (corresponden a las definiciones del documento de funcionamiento):

| Condición | Criterio (parámetro configurable) |
|-----------|-----------------------------------|
| Ausencia de voltaje | `|V1| < V_min_presencia` (p. ej. < 50% nominal) |
| Voltaje fuera de rango | `|V1|` fuera de `[V_min, V_max]` (p. ej. ±10% de 220 V) |
| Desfase angular entre fases | desviación angular respecto a 120° > `Δθ_max` (p. ej. > 5°) |
| Frecuencia fuera de rango | `f` fuera de `[f_min, f_max]` (p. ej. 50 Hz ±1%) |
| Desbalance | `VUF > VUF_max` (p. ej. > 2%) |

En caso contrario `R-AS-x = 1`.

> **Umbrales:** todos los valores anteriores son **parámetros configurables**
> centralizados en `engine/physics/config.ts`. Los valores entre paréntesis son
> sugerencias iniciales razonables; **confírmalos con el responsable del proyecto
> antes de tratarlos como definitivos** (déjalos como constantes nombradas, no mágicas).

---

## 5. Caídas de tensión y capacidad (Fase 5, opcional)

Corrientes nominales por salida: S1=100 A, S2=25 A, S3=10 A.

- Caída aproximada por tramo: `ΔV = I · (R·cosφ + X·senφ) · L`.
- Validación de capacidad: advertir cuando la suma de cargas conectadas a una misma
  entrada supere su capacidad nominal (refleja la nota del unifilar:
  *"limitación de capacidad por potencia, controlar clima"*).

Estos cálculos son del modo avanzado y no condicionan la lógica de transferencia
salvo que se decida lo contrario (decisión pendiente; no asumir).

---

## 6. Conexión física → lógica

El motor de física expone, por barra de entrada, una medición:

```ts
interface BusMeasurement {
  v1: number;        // magnitud secuencia positiva
  v2: number;        // magnitud secuencia negativa
  vuf: number;       // %
  freqHz: number;
  presente: boolean; // |V1| >= V_min_presencia
}
```

La función de disponibilidad (`02`, RN-10) consume el `R-AS-x` derivado de esta
medición (modo avanzado) o el toggle directo (modo simple). El resto de la lógica
es idéntica.
