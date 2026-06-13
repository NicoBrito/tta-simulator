import { create } from 'zustand'

export type ActiveTab = 'unifilar' | 'flujo'

interface MvpState {
  activeTab: ActiveTab
  principalCortado: boolean
  cb1Trip: boolean
  asimetriaPrincipal: boolean

  setActiveTab: (tab: ActiveTab) => void
  togglePrincipalCortado: () => void
  toggleCb1Trip: () => void
  toggleAsimetriaPrincipal: () => void
}

export const useMvpStore = create<MvpState>((set) => ({
  activeTab: 'unifilar',
  principalCortado: false,
  cb1Trip: false,
  asimetriaPrincipal: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  togglePrincipalCortado: () =>
    set((s) => ({ principalCortado: !s.principalCortado })),
  toggleCb1Trip: () => set((s) => ({ cb1Trip: !s.cb1Trip })),
  toggleAsimetriaPrincipal: () =>
    set((s) => ({ asimetriaPrincipal: !s.asimetriaPrincipal })),
}))
