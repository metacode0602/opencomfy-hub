import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AuthMode = 'phone' | 'email'

interface AuthState {
  // Auth mode state
  authMode: AuthMode
  setAuthMode: (mode: AuthMode) => void

  // Form states
  isPending: boolean
  setIsPending: (pending: boolean) => void

  // Error and success states
  error: string | undefined
  setError: (error: string | undefined) => void
  success: string | undefined
  setSuccess: (success: string | undefined) => void

  // Phone login specific states
  isSendingCode: boolean
  setIsSendingCode: (sending: boolean) => void
  countdown: number
  setCountdown: (countdown: number) => void
  codeSent: boolean
  setCodeSent: (sent: boolean) => void

  // Email login specific states
  showPassword: boolean
  setShowPassword: (show: boolean) => void

  // Reset all states
  resetStates: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Auth mode state
      authMode: 'email',
      setAuthMode: (mode) => {
        set({ authMode: mode })
        // Reset states when switching modes
        get().resetStates()
      },

      // Form states
      isPending: false,
      setIsPending: (pending) => set({ isPending: pending }),

      // Error and success states
      error: undefined,
      setError: (error) => set({ error }),
      success: undefined,
      setSuccess: (success) => set({ success }),

      // Phone login specific states
      isSendingCode: false,
      setIsSendingCode: (sending) => set({ isSendingCode: sending }),
      countdown: 0,
      setCountdown: (countdown) => set({ countdown }),
      codeSent: false,
      setCodeSent: (sent) => set({ codeSent: sent }),

      // Email login specific states
      showPassword: false,
      setShowPassword: (show) => set({ showPassword: show }),

      // Reset all states
      resetStates: () =>
        set({
          error: undefined,
          success: undefined,
          isPending: false,
          isSendingCode: false,
          countdown: 0,
          codeSent: false,
          showPassword: false,
        }),
    }),
    {
      name: 'auth-store',
      // Only persist auth mode, not form states
      partialize: (state) => ({ authMode: state.authMode }),
    }
  )
)
