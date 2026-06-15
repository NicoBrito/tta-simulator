// Persistencia de posiciones de nodos de la Vista de Flujo en localStorage.
// Toda lectura/escritura va dentro de try/catch con fallback silencioso (CLAUDE.md §4.8).

export type NodePositions = Record<string, { x: number; y: number }>

const KEY = (diagramId: string) => `tta_layout_${diagramId}`

export function saveLayout(diagramId: string, positions: NodePositions): void {
  try {
    localStorage.setItem(KEY(diagramId), JSON.stringify(positions))
  } catch (e) {
    console.warn('[layoutStorage] no se pudo guardar el layout', e)
  }
}

export function loadLayout(diagramId: string): NodePositions | null {
  try {
    const raw = localStorage.getItem(KEY(diagramId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as NodePositions
    return null
  } catch (e) {
    console.warn('[layoutStorage] layout corrupto, se ignora', e)
    return null
  }
}

export function clearLayout(diagramId: string): void {
  try {
    localStorage.removeItem(KEY(diagramId))
  } catch (e) {
    console.warn('[layoutStorage] no se pudo limpiar el layout', e)
  }
}
