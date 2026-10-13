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
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const DEMO_ACCOUNTS: Record<string, { id: string; email: string; full_name: string; role: UserRole; password: string }> = {
  'admin@medicare.ai': {
    id: 'demo-admin-1',
    email: 'admin@medicare.ai',
    full_name: 'Dr. Arthur Vance (Chief Admin)',
    role: 'admin',
    password: 'AdminPass123!',
  },
  'sarah.chen@medicare.ai': {
    id: 'demo-doctor-1',
    email: 'sarah.chen@medicare.ai',
    full_name: 'Dr. Sarah Chen, MD',
    role: 'doctor',
    password: 'DoctorPass123!',
  },
  'alice.johnson@medicare.ai': {
    id: 'demo-patient-1',
    email: 'alice.johnson@medicare.ai',
    full_name: 'Alice Johnson',
    role: 'patient',
    password: 'PatientPass123!',
  },
}

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

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await api.post('/api/v1/auth/login', { email, password })
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user_role', data.role)
      localStorage.removeItem('demo_user')
      await fetchMe()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (typeof detail === 'string') {
        throw new Error(detail)
      }
      throw err
    }
  }, [fetchMe])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_role')
    localStorage.removeItem('demo_user')
    setUser(null)
    window.location.href = '/login'
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isAuthenticated: !!user, login, logout, refreshUser: fetchMe }),
    [user, isLoading, login, logout, fetchMe]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
