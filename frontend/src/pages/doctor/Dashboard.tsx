import { useState, useEffect } from 'react'
import { Users, Calendar, Stethoscope, TrendingUp, ArrowRight, Clock } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'

const stats = [
  { label: 'Active Patients', value: '47', icon: Users, color: '#3182f4', bg: 'rgba(49,130,244,0.1)', trend: '+3 this week' },
  { label: "Today's Appointments", value: '8', icon: Calendar, color: '#14b8a6', bg: 'rgba(20,184,166,0.1)', trend: '3 remaining' },
  { label: 'Pending Lab Reviews', value: '12', icon: Stethoscope, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', trend: '5 urgent' },
  { label: 'Encounters This Month', value: '134', icon: TrendingUp, color: '#34d399', bg: 'rgba(52,211,153,0.1)', trend: '+18 vs last month' },
]

const todayAppointments = [
  { patient: 'Alice Johnson', time: '9:00 AM', type: 'Follow-up', status: 'In Progress', statusClass: 'badge-teal' },
  { patient: 'Robert Chen', time: '10:00 AM', type: 'New Patient', status: 'Waiting', statusClass: 'badge-amber' },
  { patient: 'Maria Santos', time: '11:30 AM', type: 'Lab Review', status: 'Scheduled', statusClass: 'badge-blue' },
  { patient: 'David Kim', time: '2:00 PM', type: 'Follow-up', status: 'Scheduled', statusClass: 'badge-blue' },
  { patient: 'Emma Wilson', time: '3:30 PM', type: 'Consultation', status: 'Scheduled', statusClass: 'badge-blue' },
]

const pendingItems = [
  { label: 'Lab results to review', count: 5, color: '#f59e0b', urgent: true },
  { label: 'Prescriptions to sign', count: 3, color: '#3182f4', urgent: false },
  { label: 'Patient messages', count: 7, color: '#14b8a6', urgent: false },
  { label: 'Referral requests', count: 2, color: '#34d399', urgent: false },
]

export default function DoctorDashboard() {
  const { user } = useAuth()
  const [appointmentsList, setAppointmentsList] = useState(todayAppointments)
  const [dashboardStats, setDashboardStats] = useState(stats)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    async function loadDoctorData() {
      try {
        const [apptsRes, labsRes] = await Promise.allSettled([
          api.get('/api/v1/appointments'),
          api.get('/api/v1/labs'),
        ])

        if (apptsRes.status === 'fulfilled' && Array.isArray(apptsRes.value.data) && apptsRes.value.data.length > 0) {
          const apiAppts = apptsRes.value.data.slice(0, 5).map((a: any) => ({
            patient: a.patient_name || a.reason || 'Clinical Consultation',
            time: (a.start_time || '10:00').slice(0, 5),
            type: a.appointment_type || 'Follow-up',
            status: a.status === 'confirmed' ? 'Scheduled' : a.status === 'in_progress' ? 'In Progress' : 'Waiting',
            statusClass: a.status === 'in_progress' ? 'badge-teal' : a.status === 'confirmed' ? 'badge-blue' : 'badge-amber',
          }))
          setAppointmentsList(apiAppts)
          setIsLive(true)
        }

        const apptCount = apptsRes.status === 'fulfilled' && Array.isArray(apptsRes.value.data)
          ? apptsRes.value.data.length : 8
        const labCount = labsRes.status === 'fulfilled' && Array.isArray(labsRes.value.data)
          ? labsRes.value.data.length : 12

        setDashboardStats([
          { label: 'Active Patients', value: '47', icon: Users, color: '#3182f4', bg: 'rgba(49,130,244,0.1)', trend: '+3 this week' },
          { label: "Today's Appointments", value: String(apptCount), icon: Calendar, color: '#14b8a6', bg: 'rgba(20,184,166,0.1)', trend: 'Live schedule' },
          { label: 'Pending Lab Reviews', value: String(labCount), icon: Stethoscope, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', trend: 'Diagnostic queue' },
          { label: 'Encounters This Month', value: '134', icon: TrendingUp, color: '#34d399', bg: 'rgba(52,211,153,0.1)', trend: '+18 vs last month' },
        ])
      } catch (err) {
        console.warn('Doctor dashboard stats fallback:', err)
      }
    }
    loadDoctorData()
  }, [])

  return (
    <div>
      <div className="page-header animate-fade-in-up">
        <h1 className="page-title flex items-center gap-3">
          Good morning, {user?.full_name ? user.full_name.split(' ').slice(-1)[0] : 'Doctor'}
          {isLive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE CLINICAL
            </span>
          )}
        </h1>
        <p className="page-subtitle">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {dashboardStats.map(({ label, value, icon: Icon, color, bg, trend }) => (
          <div key={label} className="stat-card animate-fade-in-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#e2eaf4', lineHeight: 1, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: '0.8rem', color: '#5a7a9e', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: '0.72rem', color, background: `${color}15`, borderRadius: 20, padding: '2px 8px', display: 'inline-block' }}>{trend}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Today's schedule */}
        <div className="glass animate-fade-in-up" style={{ animationDelay: '120ms', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>
              Today's Schedule
            </h2>
            <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>Full Schedule</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {appointmentsList.map((a) => (
              <div key={a.patient + a.time} className="glass-sm" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ textAlign: 'center', minWidth: 60 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#5a7a9e', fontSize: '0.78rem' }}>
                    <Clock size={11} />{a.time}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#c0d4ed', fontSize: '0.875rem' }}>{a.patient}</div>
                  <div style={{ color: '#5a7a9e', fontSize: '0.75rem' }}>{a.type}</div>
                </div>
                <span className={`badge ${a.statusClass}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action items */}
        <div className="glass animate-fade-in-up" style={{ animationDelay: '180ms', padding: 24 }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: '0 0 20px' }}>
            Action Required
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingItems.map(({ label, count, color, urgent }) => (
              <div key={label} className="glass-sm" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.9rem', color, flexShrink: 0 }}>
                  {count}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', color: '#c0d4ed' }}>{label}</div>
                  {urgent && <div style={{ fontSize: '0.68rem', color: '#fb7185', marginTop: 1 }}>⚠ Urgent</div>}
                </div>
                <ArrowRight size={13} style={{ color: '#3a5070' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
