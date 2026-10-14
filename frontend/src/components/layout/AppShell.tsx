import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import {
  Home,
  Heart,
  MapPin,
  User,
  AlertCircle,
  Download,
  X,
  Stethoscope,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'

export function AppShell() {
  const { user } = useAuth()
  const location = useLocation()
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Check if user dismissed banner previously this session
      if (!sessionStorage.getItem('pwa_banner_dismissed')) {
        setShowInstallBanner(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
    }
    setDeferredPrompt(null)
  }

  const dismissBanner = () => {
    setShowInstallBanner(false)
    sessionStorage.setItem('pwa_banner_dismissed', 'true')
  }

  // Patient Mobile Nav Items
  const patientBottomNav = [
    { to: '/patient', icon: Home, label: 'Home' },
    { to: '/patient/vitalsense', icon: Heart, label: 'VitalSense' },
    { to: '/patient/hospitals', icon: MapPin, label: 'Emergency' },
    { to: '/patient/profile', icon: User, label: 'Timeline' },
  ]

  // Doctor Mobile Nav Items
  const doctorBottomNav = [
    { to: '/doctor', icon: Home, label: 'Home' },
    { to: '/doctor/vitalsense', icon: Heart, label: 'VitalSense' },
    { to: '/doctor/alerts', icon: AlertCircle, label: 'Alerts' },
    { to: '/doctor/patients', icon: Stethoscope, label: 'Patients' },
  ]

  const activeMobileNav = user?.role === 'patient' ? patientBottomNav : doctorBottomNav

  return (
    <div className="bg-animated" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Sidebar />
      <div className="page-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* PWA Install Banner */}
        {showInstallBanner && (
          <div
            style={{
              background: 'linear-gradient(90deg, #0284c7, #0d9488)',
              color: 'white',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              zIndex: 35,
              fontSize: '0.825rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: '#071120',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Heart size={16} color="#38bdf8" fill="#38bdf8" />
              </div>
              <span>
                <strong>Install MediCare AI App:</strong> Fast mobile health tracking and instant emergency alerts.
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleInstallClick}
                style={{
                  background: 'white',
                  color: '#0369a1',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Download size={13} />
                <span>Install</span>
              </button>
              <button
                onClick={dismissBanner}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <TopBar />

        <main className="page-body">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation Bar (Visible on screens <= 768px) */}
        {user && (
          <nav
            className="mobile-bottom-nav"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: 60,
              background: 'rgba(10,22,40,0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'space-around',
              zIndex: 40,
              padding: '0 8px',
            }}
          >
            {activeMobileNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/patient' || item.to === '/doctor'}
                style={({ isActive }) => ({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  textDecoration: 'none',
                  color: isActive ? '#38bdf8' : '#64748b',
                  fontSize: '0.68rem',
                  fontWeight: isActive ? 700 : 500,
                  padding: '6px 12px',
                  borderRadius: 8,
                  transition: 'color 0.15s ease',
                })}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
