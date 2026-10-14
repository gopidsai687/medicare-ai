import { useState } from 'react'
import { Bell, Search, ChevronRight } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { getRoleLabel } from '@/lib/utils'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'

function getBreadcrumb(pathname: string): string[] {
  const map: Record<string, string> = {
    '/patient': 'Dashboard',
    '/patient/vitalsense': 'MediCare VitalSense',
    '/patient/vitalsense/blood-pressure': 'Blood Pressure',
    '/patient/vitalsense/blood-glucose': 'Blood Glucose',
    '/patient/hospitals': 'Emergency & Hospitals',
    '/patient/profile': 'Health Timeline',
    '/patient/appointments': 'Appointments',
    '/patient/records': 'Medical Records',
    '/patient/medications': 'Medications',
    '/patient/labs': 'Lab Results',
    '/patient/ai': 'AI Assistant',
    '/doctor': 'Dashboard',
    '/doctor/vitalsense': 'VitalSense Clinical',
    '/doctor/alerts': 'Clinical Alerts Queue',
    '/doctor/patients': 'My Patients',
    '/doctor/schedule': 'Schedule',
    '/doctor/encounters': 'Encounters',
    '/doctor/labs': 'Labs',
    '/doctor/analytics': 'Analytics',
    '/admin': 'Dashboard',
    '/admin/patients': 'Patients',
    '/admin/doctors': 'Doctors',
    '/admin/departments': 'Departments',
    '/admin/appointments': 'Appointments',
    '/admin/audit-logs': 'Audit Logs',
    '/admin/settings': 'System Settings',
  }
  return ['MediCare', map[pathname] ?? 'Page']
}

export function TopBar() {
  const { user } = useAuth()
  const location = useLocation()
  const breadcrumbs = getBreadcrumb(location.pathname)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  return (
    <header className="topbar">
      {/* Breadcrumb */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <ChevronRight size={13} style={{ color: '#3a5070' }} />}
            <span style={{
              fontSize: '0.875rem',
              color: i === breadcrumbs.length - 1 ? '#c0d4ed' : '#3a5070',
              fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
            }}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(15,32,64,0.6)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: '7px 14px', width: 220,
      }}>
        <Search size={14} style={{ color: '#3a5070', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search…"
          style={{
            background: 'none', border: 'none', outline: 'none',
            color: '#c0d4ed', fontSize: '0.8rem', width: '100%',
            fontFamily: 'Inter, sans-serif',
          }}
        />
      </div>

      {/* Notifications */}
      <button
        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
        title="Notifications & Health Alerts"
        style={{
          width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
          background: isNotificationsOpen ? 'rgba(56,189,248,0.2)' : 'rgba(15,32,64,0.6)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', position: 'relative', marginLeft: 8,
          color: isNotificationsOpen ? '#38bdf8' : '#5a7a9e',
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 ? (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16,
            background: '#ef4444', color: 'white', borderRadius: 8,
            fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '0 3px', border: '2px solid #0a1628',
          }}>
            {unreadCount}
          </span>
        ) : (
          <span style={{
            position: 'absolute', top: 6, right: 6, width: 7, height: 7,
            background: '#3182f4', borderRadius: '50%', border: '1.5px solid #0a1628',
          }} />
        )}
      </button>

      {/* Role badge */}
      {user && (
        <div style={{
          marginLeft: 12, padding: '5px 12px', borderRadius: 20,
          background: 'rgba(49,130,244,0.1)', border: '1px solid rgba(49,130,244,0.2)',
          fontSize: '0.75rem', fontWeight: 600, color: '#57a3f9',
        }}>
          {getRoleLabel(user.role)}
        </div>
      )}

      {/* In-App Notification Center Popover */}
      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onAlertCountChange={setUnreadCount}
      />
    </header>
  )
}
