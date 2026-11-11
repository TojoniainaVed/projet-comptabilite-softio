import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError, setUnauthorizedHandler } from '@/lib/api-client'
import { authStorage } from '@/lib/auth-storage'
import { retournerVersSoftio } from '@/lib/softio'
import type { AuthUser } from '@/types/api'

interface AuthContextValue {
  user: AuthUser | null
  /** true tant que la session stockée est en cours de vérification auprès de l'API. */
  loading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  /** Connexion depuis Softio avec le code temporaire reçu dans l'URL. */
  loginWithSoftio: (code: string) => Promise<AuthUser>
  logout: () => Promise<void>
  /** Aide d'affichage uniquement : l'API contrôle chaque opération côté serveur. */
  can: (permission: string) => boolean
  /** Compte de plateforme (super administrateur) : sans entreprise, sans accès comptable. */
  isPlatformAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState<boolean>(() => authStorage.get() !== null)

  const reset = useCallback(() => {
    authStorage.clear()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(reset)
    return () => setUnauthorizedHandler(null)
  }, [reset])

  useEffect(() => {
    if (authStorage.get() === null) return
    let cancelled = false
    api
      .get<{ data: AuthUser }>('/auth/me')
      .then((result) => {
        if (!cancelled) setUser(result.data)
      })
      .catch((error: unknown) => {
        if (!cancelled && error instanceof ApiError && error.status === 401) authStorage.clear()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
      email,
      password,
      device_name: 'web',
    })
    authStorage.set(result.token)
    setUser(result.user)
    return result.user
  }, [])

  const loginWithSoftio = useCallback(async (code: string) => {
    const result = await api.post<{ token: string; user: AuthUser }>('/auth/sso', { code })
    authStorage.set(result.token)
    setUser(result.user)
    return result.user
  }, [])

  const logout = useCallback(async () => {
    const venuDeSoftio = user?.from_softio ?? false
    try {
      await api.post('/auth/logout')
    } catch {
      /* le jeton est de toute façon supprimé localement */
    }
    reset()
    if (venuDeSoftio) retournerVersSoftio()
  }, [reset, user])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      loginWithSoftio,
      logout,
      can: (permission) => user?.permissions.includes(permission) ?? false,
      isPlatformAdmin: user?.role.scope === 'platform',
    }),
    [user, loading, login, loginWithSoftio, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans un AuthProvider.')
  return context
}
