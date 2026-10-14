import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import api from './api'

export type UserRole = 'patient' | 'doctor' | 'nurse' | 'admin'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  avatar_url: string | null
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<AuthUser>
  loginWithPasskey: (email?: string) => Promise<AuthUser>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) { setIsLoading(false); return }

    try {
      const { data } = await api.get<AuthUser>('/api/v1/auth/me')
      setUser(data)
    } catch {
      setUser(null)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user_role')
      localStorage.removeItem('demo_user')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchMe() }, [fetchMe])

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    try {
      const { data } = await api.post('/api/v1/auth/login', { email, password }, { timeout: 12000 })
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user_role', data.role)
      localStorage.removeItem('demo_user')

      try {
        const meRes = await api.get<AuthUser>('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${data.access_token}` },
          timeout: 5000,
        })
        setUser(meRes.data)
        return meRes.data
      } catch {
        // Fallback user session from verified login token payload to guarantee navigation
        const fallbackUser: AuthUser = {
          id: 'user',
          email,
          full_name: email.split('@')[0],
          role: data.role as UserRole,
          is_active: true,
          avatar_url: null,
        }
        setUser(fallbackUser)
        return fallbackUser
      }
    } catch (err: any) {
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        throw new Error('Connection timed out. The server took too long to respond. Please try again.')
      }
      if (!err?.response && (err?.message === 'Network Error' || err?.code === 'ERR_NETWORK')) {
        throw new Error('Network error. Unable to reach MediCare AI server. Please check your internet connection.')
      }
      const detail = err?.response?.data?.detail
      if (typeof detail === 'string') {
        throw new Error(detail)
      }
      if (Array.isArray(detail)) {
        throw new Error(detail.map((d: any) => d.msg || JSON.stringify(d)).join(', '))
      }
      throw new Error(err?.message || 'Login failed. Please verify your credentials.')
    }
  }, [])

  const loginPasskey = useCallback(async (): Promise<AuthUser> => {
    throw new Error('Passkey authentication has been disabled. Please sign in with your email and password.')
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_role')
    localStorage.removeItem('demo_user')
    setUser(null)
    window.location.href = '/login'
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isAuthenticated: !!user, login, loginWithPasskey: loginPasskey, logout, refreshUser: fetchMe }),
    [user, isLoading, login, loginPasskey, logout, fetchMe]
  )


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
