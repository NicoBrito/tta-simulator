# Documentación — Simulador TTA

Reglas de negocio y especificación del proyecto. **Punto de entrada para Claude Code:**
el archivo `../CLAUDE.md` en la raíz.

Orden de lectura:

1. [`00-vision-y-alcance.md`](00-vision-y-alcance.md) — propósito y alcance.
2. [`01-glosario-y-senales.md`](01-glosario-y-senales.md) — vocabulario y señales.
3. [`02-reglas-de-negocio.md`](02-reglas-de-negocio.md) — reglas invariantes (RN-xx).
4. [`03-diagrama-de-flujo.md`](03-diagrama-de-flujo.md) — lógica transcrita (fuente de verdad).
5. [`04-modelo-electrico.md`](04-modelo-electrico.md) — fasores, VUF, modos.
6. [`05-arquitectura-tecnica.md`](05-arquitectura-tecnica.md) — stack, estructura, tipos, API.
7. [`06-especificacion-ui.md`](06-especificacion-ui.md) — Vista Unifilar (SVG y panel).
8. [`07-estrategia-de-pruebas.md`](07-estrategia-de-pruebas.md) — tests por rama del flujo.
9. [`08-vista-flujo.md`](08-vista-flujo.md) — Vista de Flujo interactiva (diagrama "tipo draw.io").

Datos: `../src/data/flowLayout.json` contiene las posiciones exactas de nodos y aristas
exportadas del `.drawio` original; es la semilla del layout de la Vista de Flujo.

Fuentes originales: documento "Modo de funcionamiento TTA", unifilar proyectado,
propuesta visual del simulador, dos notas de voz del autor y el diagrama
`Diagrama_Flujo_TTA_Ver_05.drawio` (del cual se transcribió `03`).
