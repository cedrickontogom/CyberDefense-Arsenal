import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'auto'

export interface ThemeState {
  theme: Theme
  collapsed: boolean
  sidebarWidth: number
  collapsedWidth: number

  // Actions
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setCollapsed: (collapsed: boolean) => void
  toggleCollapsed: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'auto',
      collapsed: false,
      sidebarWidth: 256,
      collapsedWidth: 80,

      setTheme: (theme) => {
        set({ theme })
        // Apply theme to document
        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else if (theme === 'light') {
          document.documentElement.classList.remove('dark')
        } else {
          // Auto - check system preference
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          if (prefersDark) {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
        }
      },

      toggleTheme: () => {
        const { theme } = get()
        const themes: Theme[] = ['light', 'dark', 'auto']
        const currentIndex = themes.indexOf(theme)
        const nextIndex = (currentIndex + 1) % themes.length
        get().setTheme(themes[nextIndex])
      },

      setCollapsed: (collapsed) => set({ collapsed }),
      toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

// Initialize theme on app start
if (typeof window !== 'undefined') {
  useThemeStore.getState().setTheme(useThemeStore.getState().theme)

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const { theme } = useThemeStore.getState()
    if (theme === 'auto') {
      if (e.matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  })
}