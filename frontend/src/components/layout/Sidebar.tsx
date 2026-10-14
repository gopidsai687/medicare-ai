import { NavLink, useNavigate } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  Calendar,
  ClipboardList,
  FileText,
  Heart,
  Home,
  LogOut,
  Settings,
  Shield,
  Stethoscope,
  Users,
  UserCog,
  FlaskConical,
  Brain,
  Building2,
  FileSearch,
  Pill,
  Sparkles,
  Microscope,
  MapPin,
  AlertCircle,
  Gauge,
  Droplet,
  User,
  Cpu,
  LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getInitials } from '@/lib/utils'
import { BrandLogo } from '@/components/brand/BrandLogo'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

const PATIENT_NAV: NavItem[] = [
  { to: '/patient', icon: Home, label: 'Dashboard' },
  { to: '/patient/vitalsense', icon: Heart, label: 'MediCare VitalSense' },
  { to: '/patient/vitalsense/blood-pressure', icon: Gauge, label: 'Blood Pressure' },
  { to: '/patient/vitalsense/blood-glucose', icon: Droplet, label: 'Blood Glucose' },
  { to: '/patient/hospitals', icon: MapPin, label: 'Emergency & Hospitals' },
  { to: '/patient/profile', icon: User, label: 'Health Timeline' },
  { to: '/patient/vitalsense/research', icon: Microscope, label: 'PPG Research Lab' },
  { to: '/patient/devices', icon: Cpu, label: 'Device Station' },
  { to: '/patient/prescriptions', icon: Pill, label: 'Prescription Analyzer' },
  { to: '/patient/reports', icon: FileSearch, label: 'Medical Report Analyzer' },
  { to: '/patient/analyses', icon: Sparkles, label: 'Previous AI Analyses' },
  { to: '/patient/records', icon: ClipboardList, label: 'My Medical Documents' },
  { to: '/patient/appointments', icon: Calendar, label: 'Appointments' },
  { to: '/patient/medications', icon: Activity, label: 'Medications' },
  { to: '/patient/labs', icon: FlaskConical, label: 'Lab Results' },
  { to: '/patient/ai', icon: Brain, label: 'AI Health Assistant' },
  { to: '/patient/settings', icon: Settings, label: 'Settings' },
]

const DOCTOR_NAV: NavItem[] = [
  { to: '/doctor', icon: Home, label: 'Dashboard' },
  { to: '/doctor/vitalsense', icon: Heart, label: 'VitalSense Clinical' },
  { to: '/doctor/alerts', icon: AlertCircle, label: 'Clinical Alerts Queue' },
  { to: '/doctor/patients', icon: Users, label: 'My Patients' },
  { to: '/doctor/schedule', icon: Calendar, label: 'Schedule' },
  { to: '/doctor/encounters', icon: Stethoscope, label: 'Encounters' },
  { to: '/doctor/labs', icon: FlaskConical, label: 'Labs' },
  { to: '/doctor/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/doctor/ai', icon: Brain, label: 'AI Assistant' },
  { to: '/doctor/settings', icon: Settings, label: 'Settings' },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', icon: Home, label: 'Dashboard' },
  { to: '/admin/patients', icon: Users, label: 'Patients' },
  { to: '/admin/doctors', icon: Stethoscope, label: 'Doctors' },
  { to: '/admin/departments', icon: Building2, label: 'Departments' },
  { to: '/admin/appointments', icon: Calendar, label: 'Appointments' },
  { to: '/admin/audit-logs', icon: Shield, label: 'Audit Logs' },
  { to: '/admin/settings', icon: Settings, label: 'System Settings' },
]

const roleConfig = {
  patient: { nav: PATIENT_NAV, label: 'Patient Portal', color: 'role-patient' },
  doctor:  { nav: DOCTOR_NAV,  label: 'Doctor Portal',  color: 'role-doctor'  },
  nurse:   { nav: DOCTOR_NAV,  label: 'Nurse Portal',   color: 'role-nurse'   },
  admin:   { nav: ADMIN_NAV,   label: 'Admin Portal',   color: 'role-admin'   },
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const { nav, label, color } = roleConfig[user.role] ?? roleConfig.patient

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '18px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <BrandLogo size={36} showText={true} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(49,130,244,0.08)', border: '1px solid rgba(49,130,244,0.15)',
          borderRadius: 20, padding: '2px 10px', marginTop: 10 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#38bdf8' }}>{label}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split('/').length === 2}
            className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
          >
            <item.icon size={16} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User profile at bottom */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="sidebar-nav-item" style={{ marginBottom: 4, cursor: 'default' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #3182f4, #14b8a6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 700, color: 'white',
          }}>
            {getInitials(user.full_name)}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#c0d4ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.full_name}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#3a5070', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="sidebar-nav-item"
          style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
