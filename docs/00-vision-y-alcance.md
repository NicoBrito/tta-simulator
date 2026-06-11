# 00 — Visión y Alcance

## Propósito

Este proyecto es un **simulador interactivo** de la lógica de control de un
**Tablero de Transferencia Automática (TTA) trifásico**, ejecutado íntegramente
en el navegador.

Su función es **demostrativa y de validación**: permite mostrar a un cliente, de
forma visual y en tiempo real, cómo se comporta la lógica de transferencia de fuentes
diseñada para el tablero, **antes** de programarla en el sistema de control real.

## Contexto de negocio

- La lógica aquí simulada se implementará posteriormente en un sistema
  **Honeywell Experion** (control industrial). Este simulador **no es** ese sistema
  ni un gemelo digital del PLC: es una maqueta de la lógica para comunicar y validar
  el diseño.
- El usuario final del simulador es quien **presenta la solución al cliente**. Carga
  la aplicación en cualquier computador y la usa como apoyo visual:
  *"esta es la lógica; así se comportará el sistema; esto es lo que luego se programa en Experion"*.
- El modo de interacción esperado (según el diseño): el presentador marca una **falla**
  o **normal** en una entrada eléctrica mediante un control (toggle/checkbox), y el
  dashboard muestra cómo el control **busca la segunda o tercera fuente** de energía.

## Qué hace el simulador

- Representa el unifilar del TTA: 3 entradas, 3 salidas y la matriz de contactores.
- Permite al usuario inyectar condiciones: falla de energía, breaker abierto/trip,
  asimetría de barra, falla de contactor, blackout, y cambiar preferencias y modo.
- Ejecuta la **lógica de transferencia** (idéntica al diagrama de flujo de referencia)
  y refleja el resultado: qué fuente quedó conectada en cada salida, qué contactores
  están cerrados, qué alarmas se activaron.
- Anima el **flujo de energía** sobre el unifilar para que el comportamiento sea legible.

## Qué NO hace (fuera de alcance)

- **No** se comunica con hardware, PLC, MOXA ni Experion reales.
- **No** persiste datos (no hay backend ni base de datos). Todo el estado vive en memoria.
- **No** pretende ser un estudio eléctrico certificable; el modelo físico es
  representativo y didáctico (ver `04-modelo-electrico.md`).
- **No** implementa autenticación, usuarios ni multi-sesión.

## Dos vistas del mismo sistema

El simulador ofrece **dos vistas conmutables por pestañas**, ambas alimentadas por el
mismo motor y el mismo estado:

1. **Vista Unifilar** — el tablero eléctrico interactivo: entradas, breakers, barras,
   contactores y salidas, con el flujo de energía animado. Muestra **qué** pasa.
   Especificada en `06-especificacion-ui.md`.
2. **Vista de Flujo** — el diagrama de flujo lógico "tipo draw.io", interactivo, que
   ilumina el **camino lógico** recorrido por el control. Muestra **por qué** pasa.
   Especificada en `08-vista-flujo.md`.

Al inyectar una condición, ambas vistas reflejan la misma verdad: la Unifilar muestra
la energía redirigida y la de Flujo muestra la rama lógica que se activó.

## Modos de uso del simulador

1. **Modo simple (demo):** las condiciones de falla/normal y asimetría se controlan
   con toggles. Es el modo principal para presentar al cliente.
2. **Modo avanzado (físico):** las entradas se definen como fasores trifásicos y la
   asimetría se **calcula** (VUF, rangos de tensión/frecuencia). Permite mostrar el
   sustento físico detrás de los toggles.

Ambos modos operan sobre **el mismo motor de lógica**; cambian solo la forma de
ingresar las condiciones de entrada.

## Criterio de éxito

El simulador es exitoso si, al inyectar cualquier combinación de condiciones, el
estado mostrado (fuente conectada por salida, contactores y alarmas) **coincide
exactamente** con lo que prescribe el diagrama de flujo (`03-diagrama-de-flujo.md`),
y el comportamiento es claro de seguir visualmente.
