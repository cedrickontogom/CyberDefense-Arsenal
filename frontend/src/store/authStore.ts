import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { api } from '../services/api'

export interface User {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  timezone: string
  language: string
  is_active: boolean
  is_verified: boolean
  is_staff: boolean
  is_superuser: boolean
  mfa_enabled: boolean
  mfa_enforced: boolean
  roles: string[]
  permissions: string[]
  preferences: Record<string, any>
  dashboard_config: Record<string, any>
  last_login: string
  date_joined: string
  avatar?: string
}

export interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (email: string, password: string, mfaCode?: string) => Promise<void>
  logout: () => Promise<void>
  register: (data: RegisterData) => Promise<void>
  checkAuth: () => Promise<void>
  refreshAccessToken: () => Promise<void>
  updateUser: (data: Partial<User>) => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  setupMFA: () => Promise<MFASetupResponse>
  verifyMFA: (code: string, recoveryCode?: string) => Promise<void>
  disableMFA: (code: string, recoveryCode?: string) => Promise<void>
  clearError: () => void
}

export interface RegisterData {
  username: string
  email: string
  password: string
  password_confirm: string
  first_name?: string
  last_name?: string
}

export interface MFASetupResponse {
  secret: string
  qr_code: string
  recovery_codes: string[]
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password, mfaCode) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/token/', {
            email,
            password,
            ...(mfaCode && { mfa_code: mfaCode }),
          })

          const { access, refresh, user } = response.data
          api.defaults.headers.common['Authorization'] = `Bearer ${access}`

          set({
            user,
            accessToken: access,
            refreshToken: refresh,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error: any) {
          const message = error.response?.data?.error?.message || 'Erreur de connexion'
          set({ error: message, isLoading: false, isAuthenticated: false })
          throw error
        }
      },

      logout: async () => {
        const { refreshToken } = get()
        try {
          if (refreshToken) {
            await api.post('/auth/token/blacklist/', { refresh: refreshToken })
          }
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          delete api.defaults.headers.common['Authorization']
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          })
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null })
        try {
          await api.post('/users/users/', data)
          set({ isLoading: false })
        } catch (error: any) {
          const message = error.response?.data?.error?.message || 'Erreur d\'inscription'
          set({ error: message, isLoading: false })
          throw error
        }
      },

      checkAuth: async () => {
        const { accessToken, refreshToken } = get()
        if (!accessToken || !refreshToken) {
          set({ isAuthenticated: false, isLoading: false })
          return
        }

        set({ isLoading: true })
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
          const response = await api.get('/users/users/me/')
          set({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error: any) {
          if (error.response?.status === 401) {
            // Try to refresh token
            try {
              await get().refreshAccessToken()
              await get().checkAuth()
            } catch {
              set({ isAuthenticated: false, isLoading: false })
            }
          } else {
            set({ isAuthenticated: false, isLoading: false })
          }
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) throw new Error('No refresh token')

        try {
          const response = await api.post('/auth/token/refresh/', { refresh: refreshToken })
          const { access } = response.data
          api.defaults.headers.common['Authorization'] = `Bearer ${access}`
          set({ accessToken: access })
        } catch (error) {
          set({ accessToken: null, refreshToken: null, isAuthenticated: false })
          throw error
        }
      },

      updateUser: async (data) => {
        const { accessToken } = get()
        if (!accessToken) throw new Error('Not authenticated')

        try {
          const response = await api.patch('/users/users/me/', data)
          set({ user: response.data })
        } catch (error) {
          throw error
        }
      },

      changePassword: async (oldPassword, newPassword) => {
        try {
          await api.post('/users/users/change_password/', {
            old_password: oldPassword,
            new_password: newPassword,
            new_password_confirm: newPassword,
          })
        } catch (error) {
          throw error
        }
      },

      setupMFA: async () => {
        const response = await api.post('/users/users/mfa/')
        return response.data
      },

      verifyMFA: async (code, recoveryCode) => {
        await api.post('/users/users/mfa_verify/', { code, recovery_code: recoveryCode })
        // Refresh user to get updated MFA status
        await get().checkAuth()
      },

      disableMFA: async (code, recoveryCode) => {
        await api.post('/users/users/mfa_disable/', { code, recovery_code: recoveryCode })
        await get().checkAuth()
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Initialize auth on app start
if (typeof window !== 'undefined') {
  useAuthStore.getState().checkAuth()
}