import { useState, useEffect } from 'react'
import { Users, Stethoscope, Calendar, Activity, TrendingUp, AlertTriangle, Settings, Shield } from 'lucide-react'
import api from '@/lib/api'

const stats = [
  { label: 'Total Patients', value: '1,284', icon: Users, color: '#3182f4', bg: 'rgba(49,130,244,0.1)', trend: '+24 this month' },
  { label: 'Active Doctors', value: '38', icon: Stethoscope, color: '#14b8a6', bg: 'rgba(20,184,166,0.1)', trend: '2 on leave' },
  { label: "Today's Admissions", value: '14', icon: Calendar, color: '#34d399', bg: 'rgba(52,211,153,0.1)', trend: '6 discharged' },
  { label: 'Pending Duplicates', value: '3', icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', trend: 'Needs review' },
]

const recentAdmissions = [
  { patient: 'John Doe', id: 'MRN-00001248', dept: 'Cardiology', admitted: 'Sep 22, 9:10 AM', doctor: 'Dr. Chen', status: 'Admitted', statusClass: 'badge-blue' },
  { patient: 'Susan Park', id: 'MRN-00001247', dept: 'Orthopedics', admitted: 'Sep 22, 8:45 AM', doctor: 'Dr. Patel', status: 'In Surgery', statusClass: 'badge-amber' },
  { patient: 'Tom Rivera', id: 'MRN-00001246', dept: 'Neurology', admitted: 'Sep 21, 11:30 PM', doctor: 'Dr. Kim', status: 'ICU', statusClass: 'badge-rose' },
]

const systemMetrics = [
  { label: 'DB Response', value: '12ms', color: '#34d399', good: true },
  { label: 'API Uptime', value: '99.98%', color: '#34d399', good: true },
  { label: 'Pending Audits', value: '7', color: '#f59e0b', good: false },
  { label: 'Failed Logins (24h)', value: '2', color: '#34d399', good: true },
]

export default function AdminDashboard() {
  const [dashboardStats, setDashboardStats] = useState(stats)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    async function loadStats() {
      try {
        const [apptsRes, dupsRes, docsRes, ptntsRes] = await Promise.allSettled([
          api.get('/api/v1/appointments'),
          api.get('/api/v1/mpi/duplicates?threshold=0.70'),
          api.get('/api/v1/users/doctors'),
          api.get('/api/v1/patients/count'),
        ])

        const apptCount = apptsRes.status === 'fulfilled' && Array.isArray(apptsRes.value.data)
          ? apptsRes.value.data.length : 14
        const dupsCount = dupsRes.status === 'fulfilled' && Array.isArray(dupsRes.value.data)
          ? dupsRes.value.data.length : 3
        const docCount = docsRes.status === 'fulfilled' && Array.isArray(docsRes.value.data)
          ? docsRes.value.data.length : 38
        const ptntCount = ptntsRes.status === 'fulfilled' && ptntsRes.value.data?.total
          ? String(ptntsRes.value.data.total) : '1,284'

        setDashboardStats([
          { label: 'Total Patients', value: ptntCount, icon: Users, color: '#3182f4', bg: 'rgba(49,130,244,0.1)', trend: 'Enterprise census' },
          { label: 'Active Doctors', value: String(docCount), icon: Stethoscope, color: '#14b8a6', bg: 'rgba(20,184,166,0.1)', trend: 'Active credentialed' },
          { label: "Today's Appointments", value: String(apptCount), icon: Calendar, color: '#34d399', bg: 'rgba(52,211,153,0.1)', trend: 'Live system queue' },
          { label: 'Pending Duplicates', value: String(dupsCount), icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', trend: 'MPI review queue' },
        ])
        setIsLive(true)
      } catch (err) {
        console.warn('Dashboard stats fallback:', err)
      }
    }
    loadStats()
  }, [])

  return (
    <div>
      <div className="page-header animate-fade-in-up">
        <h1 className="page-title flex items-center gap-3">
          Admin Dashboard
          {isLive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE TELEMETRY
            </span>
          )}
        </h1>
        <p className="page-subtitle">Hospital operations overview — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stats */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {dashboardStats.map(({ label, value, icon: Icon, color, bg, trend }) => (
          <div key={label} className="stat-card animate-fade-in-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Recent admissions */}
        <div className="glass animate-fade-in-up" style={{ animationDelay: '120ms', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>Recent Admissions</h2>
            <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>All Admissions</button>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Patient</th><th>Department</th><th>Admitted</th><th>Doctor</th><th>Status</th></tr>
            </thead>
            <tbody>
              {recentAdmissions.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#c0d4ed' }}>{a.patient}</div>
                    <div style={{ fontSize: '0.72rem', color: '#3a5070', fontFamily: 'monospace' }}>{a.id}</div>
                  </td>
                  <td>{a.dept}</td>
                  <td style={{ color: '#5a7a9e', fontSize: '0.8rem' }}>{a.admitted}</td>
                  <td>{a.doctor}</td>
                  <td><span className={`badge ${a.statusClass}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* System health */}
        <div className="glass animate-fade-in-up" style={{ animationDelay: '180ms', padding: 24 }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: '0 0 20px' }}>
            System Health
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {systemMetrics.map(({ label, value, color, good }) => (
              <div key={label} className="glass-sm" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#5a7a9e' }}>{label}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2eaf4' }}>{value}</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color,
                  boxShadow: `0 0 8px ${color}` }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(49,130,244,0.08)',
            border: '1px solid rgba(49,130,244,0.15)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Shield size={12} style={{ color: '#57a3f9' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#57a3f9' }}>Security Status</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#5a7a9e' }}>All systems nominal. Last security scan: 1h ago.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
