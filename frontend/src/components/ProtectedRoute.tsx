import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, type UserRole } from '@/lib/auth'

interface ProtectedRouteProps {
  allowedRoles: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-animated">
        <div className="text-center animate-fade-in">
          <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4"
               style={{ borderColor: 'rgba(49,130,244,0.3)', borderTopColor: '#3182f4' }} />
          <p style={{ color: '#5a7a9e', fontSize: '0.875rem' }}>Loading MediCare…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to their own portal
    const portalMap: Record<UserRole, string> = {
      patient: '/patient',
      doctor: '/doctor',
      admin: '/admin',
      nurse: '/doctor',
    }
    return <Navigate to={portalMap[user.role]} replace />
  }

  return <Outlet />
}
