import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FirstLoginState {
  /**
   * 是否应该显示首次登录提示
   */
  shouldShowPrompt: boolean | null
  /**
   * 用户ID，用于判断缓存是否有效
   */
  userId: string | null
  /**
   * 是否已手动关闭提示
   */
  dismissed: boolean
  /**
   * 最后检查时间戳
   */
  lastChecked: number | null

  /**
   * 设置首次登录状态
   */
  setFirstLoginStatus: (userId: string, shouldShow: boolean) => void
  /**
   * 关闭提示
   */
  dismissPrompt: () => void
  /**
   * 重置状态（用于用户切换时）
   */
  reset: () => void
  /**
   * 检查缓存是否有效
   */
  isCacheValid: (currentUserId: string | null) => boolean
}

/**
 * 首次登录提示状态管理
 * 使用 Zustand persist 将状态缓存到 localStorage
 */
export const useFirstLoginStore = create<FirstLoginState>()(
  persist(
    (set, get) => ({
      shouldShowPrompt: null,
      userId: null,
      dismissed: false,
      lastChecked: null,

      setFirstLoginStatus: (userId, shouldShow) => {
        set({
          shouldShowPrompt: shouldShow,
          userId,
          lastChecked: Date.now(),
          // 如果设置为 false，自动标记为已关闭
          dismissed: !shouldShow,
        })
      },

      dismissPrompt: () => {
        set({ dismissed: true, shouldShowPrompt: false })
      },

      reset: () => {
        set({
          shouldShowPrompt: null,
          userId: null,
          dismissed: false,
          lastChecked: null,
        })
      },

      isCacheValid: (currentUserId) => {
        const state = get()
        // 如果用户ID不匹配，缓存无效
        if (currentUserId !== state.userId) {
          return false
        }
        // 如果已经手动关闭，缓存有效但不再显示
        if (state.dismissed) {
          return true
        }
        // 如果缓存超过 1 小时，需要重新检查
        if (state.lastChecked && Date.now() - state.lastChecked > 60 * 60 * 1000) {
          return false
        }
        return true
      },
    }),
    {
      name: 'first-login-store',
      // 只持久化关键状态
      partialize: (state) => ({
        dismissed: state.dismissed,
        userId: state.userId,
        lastChecked: state.lastChecked,
      }),
    }
  )
)

