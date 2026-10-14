import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  ClipboardList,
  Activity,
  FlaskConical,
  ArrowRight,
  Heart,
  Pill,
  FileSearch,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'

const stats = [
  { label: 'Upcoming Appointments', value: '2', icon: Calendar, color: '#3182f4', bg: 'rgba(49,130,244,0.1)' },
  { label: 'Active Medications', value: '4', icon: Activity, color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
  { label: 'Recent Lab Results', value: '1', icon: FlaskConical, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  { label: 'Medical Documents', value: '12', icon: ClipboardList, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
]

const recentActivity = [
  { type: 'Lab Result', title: 'Complete Blood Count (CBC)', date: 'Sep 18, 2026', status: 'Normal', statusClass: 'badge-green' },
  { type: 'Appointment', title: 'Dr. Sarah Chen — Cardiology', date: 'Sep 25, 2026', status: 'Upcoming', statusClass: 'badge-blue' },
  { type: 'Prescription', title: 'Metformin 500mg — Refill', date: 'Sep 15, 2026', status: 'Active', statusClass: 'badge-teal' },
  { type: 'Visit', title: 'Annual Physical Examination', date: 'Aug 30, 2026', status: 'Completed', statusClass: 'badge-gray' },
]

const vitals = [
  { label: 'Blood Pressure', value: '118/76', unit: 'mmHg', status: 'Normal', color: '#34d399' },
  { label: 'Heart Rate', value: '72', unit: 'bpm', status: 'Normal', color: '#34d399' },
  { label: 'Blood Glucose', value: '94', unit: 'mg/dL', status: 'Normal', color: '#34d399' },
  { label: 'BMI', value: '23.4', unit: 'kg/m²', status: 'Normal', color: '#34d399' },
]

export default function PatientDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [dashboardStats, setDashboardStats] = useState(stats)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    async function loadPatientData() {
      try {
        const [apptsRes, rxRes, labsRes] = await Promise.allSettled([
          api.get('/api/v1/appointments'),
          api.get('/api/v1/prescriptions'),
          api.get('/api/v1/labs'),
        ])

        const apptCount = apptsRes.status === 'fulfilled' && Array.isArray(apptsRes.value.data)
          ? apptsRes.value.data.length : 2
        const rxCount = rxRes.status === 'fulfilled' && Array.isArray(rxRes.value.data)
          ? rxRes.value.data.length : 4
        const labsCount = labsRes.status === 'fulfilled' && Array.isArray(labsRes.value.data)
          ? labsRes.value.data.length : 1

        setDashboardStats([
          { label: 'Upcoming Appointments', value: String(apptCount), icon: Calendar, color: '#3182f4', bg: 'rgba(49,130,244,0.1)' },
          { label: 'Active Medications', value: String(rxCount), icon: Activity, color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
          { label: 'Recent Lab Results', value: String(labsCount), icon: FlaskConical, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Medical Documents', value: '12', icon: ClipboardList, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        ])
        setIsLive(true)
      } catch (err) {
        console.warn('Patient dashboard stats fallback:', err)
      }
    }
    loadPatientData()
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="page-header animate-fade-in-up">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(20,184,166,0.2), rgba(49,130,244,0.2))',
            border: '1px solid rgba(20,184,166,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={20} style={{ color: '#2dd4bf' }} />
          </div>
          <div>
            <h1 className="page-title flex items-center gap-3">
              Welcome back, {user?.full_name ? user.full_name.split(' ')[0] : 'Patient'}
              {isLive && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE HEALTH FEED
                </span>
              )}
            </h1>
            <p className="page-subtitle">Here's your personal health overview for today</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {dashboardStats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card animate-fade-in-up">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} style={{ color }} />
              </div>
              <ArrowRight size={14} style={{ color: '#3a5070' }} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#e2eaf4', lineHeight: 1, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: '0.8rem', color: '#5a7a9e' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* AI Clinical Intelligence Features */}
      <div className="animate-fade-in-up" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(49,130,244,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} style={{ color: '#3182f4' }} />
            </div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>
              AI Clinical Document Guidance
            </h2>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#5a7a9e' }}>
            Evidence-Based Analysis & Patient Guidance
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {/* Card 1: Prescription Analyzer */}
          <div
            onClick={() => navigate('/patient/prescriptions')}
            className="glass stat-card"
            style={{
              padding: '20px 22px',
              cursor: 'pointer',
              border: '1px solid rgba(49,130,244,0.2)',
              background: 'linear-gradient(135deg, rgba(15,32,64,0.7), rgba(49,130,244,0.08))',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(49,130,244,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Pill size={22} style={{ color: '#3182f4' }} />
              </div>
              <span className="badge badge-blue">Upload & OCR</span>
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', marginBottom: 6 }}>
              Prescription Analyzer
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#7a9ec2', lineHeight: 1.45, marginBottom: 14 }}>
              Upload prescription scans or PDFs. Extract medications, dosage, food precautions, safety interactions, and checklist.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: '#3182f4' }}>
              <span>Analyze Prescription</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 2: Medical Report Analyzer */}
          <div
            onClick={() => navigate('/patient/reports')}
            className="glass stat-card"
            style={{
              padding: '20px 22px',
              cursor: 'pointer',
              border: '1px solid rgba(20,184,166,0.2)',
              background: 'linear-gradient(135deg, rgba(15,32,64,0.7), rgba(20,184,166,0.08))',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileSearch size={22} style={{ color: '#14b8a6' }} />
              </div>
              <span className="badge badge-teal">Lab & Diagnostics</span>
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', marginBottom: 6 }}>
              Medical Report Analyzer
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#7a9ec2', lineHeight: 1.45, marginBottom: 14 }}>
              Upload lab results, blood panels, or imaging reports. Get plain-English explanations of flagged findings and reference ranges.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: '#14b8a6' }}>
              <span>Analyze Medical Report</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 3: Previous AI Analyses */}
          <div
            onClick={() => navigate('/patient/analyses')}
            className="glass stat-card"
            style={{
              padding: '20px 22px',
              cursor: 'pointer',
              border: '1px solid rgba(245,158,11,0.2)',
              background: 'linear-gradient(135deg, rgba(15,32,64,0.7), rgba(245,158,11,0.08))',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={22} style={{ color: '#f59e0b' }} />
              </div>
              <span className="badge badge-amber">Interactive Q&A</span>
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', marginBottom: 6 }}>
              Previous AI Analyses
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#7a9ec2', lineHeight: 1.45, marginBottom: 14 }}>
              Review past prescription and lab analyses, revisit your Personalized Next Steps, and ask document-grounded AI questions.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: '#f59e0b' }}>
              <span>View Analysis History</span>
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Recent activity */}
        <div className="glass animate-fade-in-up" style={{ animationDelay: '120ms', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>Recent Activity</h2>
            <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>View All</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((item) => (
                <tr key={item.title}>
                  <td style={{ color: '#5a7a9e', fontSize: '0.75rem' }}>{item.type}</td>
                  <td style={{ fontWeight: 500 }}>{item.title}</td>
                  <td style={{ color: '#5a7a9e', fontSize: '0.8rem' }}>{item.date}</td>
                  <td><span className={`badge ${item.statusClass}`}>{item.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Vitals */}
        <div className="glass animate-fade-in-up" style={{ animationDelay: '180ms', padding: 24 }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: '0 0 20px' }}>
            Latest Vitals
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {vitals.map(({ label, value, unit, status, color }) => (
              <div key={label} className="glass-sm" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: '#5a7a9e' }}>{label}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color, background: `${color}18`,
                    border: `1px solid ${color}30`, borderRadius: 20, padding: '1px 8px' }}>{status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e2eaf4' }}>{value}</span>
                  <span style={{ fontSize: '0.75rem', color: '#3a5070' }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/patient/vitalsense')}
            className="w-full mt-4 py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <Heart size={14} /> Open VitalSense Monitor →
          </button>
        </div>
      </div>
    </div>
  )
}
