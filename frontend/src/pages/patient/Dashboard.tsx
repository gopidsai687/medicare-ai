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
  RefreshCw,
  Clock,
  FileText,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { BodyMap } from '@/components/vitals/BodyMap'

interface VitalItemData {
  has_data: boolean
  label: string
  value: string
  unit: string
  status: string
  status_label: string
  category: string
  color: string
  recorded_at: string | null
  elapsed_time: string
  source: string | null
  device_name: string | null
  verification_status: string
  path: string
}

interface DashboardPayload {
  patient_id: string
  patient_name: string
  mrn: string
  evaluated_at: string
  stats: {
    upcoming_appointments: number
    active_medications: number
    recent_lab_results: number
    medical_documents: number
  }
  vitals: {
    blood_pressure: VitalItemData
    heart_rate: VitalItemData
    blood_glucose: VitalItemData
    bmi: VitalItemData
  }
  recent_activity: Array<{
    type: string
    title: string
    date: string
    relative_time: string
    status: string
    status_class: string
    path: string
  }>
  diagnostics_hud?: any
  educational_disclaimer?: string
}

export default function PatientDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/patients/dashboard')
      setData(res.data)
    } catch (err) {
      console.error('Failed to load patient dashboard telemetry:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [refreshKey])

  const statsCards = [
    {
      label: 'Upcoming Appointments',
      value: String(data?.stats?.upcoming_appointments ?? 0),
      icon: Calendar,
      color: '#3182f4',
      bg: 'rgba(49,130,244,0.1)',
      path: '/patient/appointments',
    },
    {
      label: 'Active Medications',
      value: String(data?.stats?.active_medications ?? 0),
      icon: Activity,
      color: '#14b8a6',
      bg: 'rgba(20,184,166,0.1)',
      path: '/patient/medications',
    },
    {
      label: 'Recent Lab Results',
      value: String(data?.stats?.recent_lab_results ?? 0),
      icon: FlaskConical,
      color: '#34d399',
      bg: 'rgba(52,211,153,0.1)',
      path: '/patient/labs',
    },
    {
      label: 'Medical Documents',
      value: String(data?.stats?.medical_documents ?? 0),
      icon: ClipboardList,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
      path: '/patient/records',
    },
  ]

  const vitalsCards: VitalItemData[] = [
    data?.vitals?.blood_pressure || {
      has_data: false,
      label: 'Blood Pressure',
      value: '--',
      unit: 'mmHg',
      status: 'No Data',
      status_label: 'NO DATA',
      category: 'No Telemetry Recorded',
      color: '#64748b',
      recorded_at: null,
      elapsed_time: 'Never recorded',
      source: null,
      device_name: null,
      verification_status: 'No Data Recorded',
      path: '/patient/vitalsense/blood-pressure',
    },
    data?.vitals?.heart_rate || {
      has_data: false,
      label: 'Heart Rate',
      value: '--',
      unit: 'bpm',
      status: 'No Data',
      status_label: 'NO DATA',
      category: 'No Telemetry Recorded',
      color: '#64748b',
      recorded_at: null,
      elapsed_time: 'Never recorded',
      source: null,
      device_name: null,
      verification_status: 'No Data Recorded',
      path: '/patient/vitalsense',
    },
    data?.vitals?.blood_glucose || {
      has_data: false,
      label: 'Blood Glucose',
      value: '--',
      unit: 'mg/dL',
      status: 'No Data',
      status_label: 'NO DATA',
      category: 'No Telemetry Recorded',
      color: '#64748b',
      recorded_at: null,
      elapsed_time: 'Never recorded',
      source: null,
      device_name: null,
      verification_status: 'No Data Recorded',
      path: '/patient/vitalsense/blood-glucose',
    },
    data?.vitals?.bmi || {
      has_data: false,
      label: 'BMI',
      value: '--',
      unit: 'kg/m²',
      status: 'No Data',
      status_label: 'NO DATA',
      category: 'No Telemetry Recorded',
      color: '#64748b',
      recorded_at: null,
      elapsed_time: 'Never recorded',
      source: null,
      device_name: null,
      verification_status: 'No Data Recorded',
      path: '/patient/profile',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="page-header animate-fade-in-up">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(20,184,166,0.2), rgba(49,130,244,0.2))',
              border: '1px solid rgba(20,184,166,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={20} style={{ color: '#2dd4bf' }} />
            </div>
            <div>
              <h1 className="page-title flex items-center gap-3">
                Welcome back, {user?.full_name ? user.full_name.split(' ')[0] : (data?.patient_name ? data.patient_name.split(' ')[0] : 'Patient')}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE HEALTH FEED
                </span>
              </h1>
              <p className="page-subtitle">Personal health records &amp; telemetry overview {data?.mrn ? `• MRN: ${data.mrn}` : ''}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer transition-all flex items-center gap-2"
              title="Refresh live patient telemetry"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-teal-400' : ''} />
              <span>Refresh Feed</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {statsCards.map(({ label, value, icon: Icon, color, bg, path }) => (
          <div
            key={label}
            onClick={() => navigate(path)}
            className="stat-card animate-fade-in-up cursor-pointer hover:border-blue-500/40 hover:scale-[1.01] transition-all"
            title={`Navigate to ${label}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} style={{ color }} />
              </div>
              <ArrowRight size={14} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
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

      {/* Body Map Anatomical Status */}
      <div className="animate-fade-in-up" style={{ marginBottom: 28 }}>
        <BodyMap refreshKey={refreshKey} />
      </div>

      {/* Quick Navigation Cards: VitalSense Specific Portals */}
      <div className="animate-fade-in-up" style={{ marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div
            onClick={() => navigate('/patient/vitalsense/blood-pressure')}
            className="glass stat-card"
            style={{ padding: '16px 18px', cursor: 'pointer', border: '1px solid rgba(56,189,248,0.2)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Activity size={20} color="#38bdf8" />
              <ArrowRight size={13} color="#38bdf8" />
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>Blood Pressure Tracker</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>AHA/ACC stages, MAP, Omron sync</div>
          </div>

          <div
            onClick={() => navigate('/patient/vitalsense/blood-glucose')}
            className="glass stat-card"
            style={{ padding: '16px 18px', cursor: 'pointer', border: '1px solid rgba(45,212,191,0.2)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Heart size={20} color="#2dd4bf" />
              <ArrowRight size={13} color="#2dd4bf" />
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>Blood Glucose Tracker</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>mg/dL &amp; mmol/L, TIR, CGM sync</div>
          </div>

          <div
            onClick={() => navigate('/patient/hospitals')}
            className="glass stat-card"
            style={{ padding: '16px 18px', cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Zap size={20} color="#ef4444" />
              <ArrowRight size={13} color="#ef4444" />
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fca5a5' }}>Emergency &amp; Hospitals</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>Instant 911, verified ER facilities</div>
          </div>

          <div
            onClick={() => navigate('/patient/profile')}
            className="glass stat-card"
            style={{ padding: '16px 18px', cursor: 'pointer', border: '1px solid rgba(167,139,250,0.2)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <ClipboardList size={20} color="#a78bfa" />
              <ArrowRight size={13} color="#a78bfa" />
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>Health Timeline</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>Consolidated longitudinal chart</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Recent activity */}
        <div className="glass animate-fade-in-up" style={{ animationDelay: '120ms', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>
                Recent Activity
              </h2>
              <span style={{ fontSize: '0.72rem', color: '#5a7a9e' }}>
                Chronological timeline of clinical records &amp; events
              </span>
            </div>
            <button
              onClick={() => navigate('/patient/records')}
              className="btn-secondary cursor-pointer hover:bg-slate-700/50 transition-colors"
              style={{ padding: '6px 14px', fontSize: '0.75rem' }}
            >
              View All Records
            </button>
          </div>

          {data?.recent_activity && data.recent_activity.length > 0 ? (
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
                {data.recent_activity.map((item, idx) => (
                  <tr
                    key={idx}
                    onClick={() => item.path && navigate(item.path)}
                    className="cursor-pointer hover:bg-white/[0.04] transition-colors"
                    title={`Open ${item.type}`}
                  >
                    <td style={{ color: '#5a7a9e', fontSize: '0.75rem' }}>{item.type}</td>
                    <td style={{ fontWeight: 500 }}>{item.title}</td>
                    <td style={{ color: '#5a7a9e', fontSize: '0.8rem' }}>
                      <span title={item.date}>{item.relative_time || item.date}</span>
                    </td>
                    <td><span className={`badge ${item.status_class}`}>{item.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <div className="w-9 h-9 rounded-full bg-slate-800 text-slate-500 mx-auto flex items-center justify-center">
                <ClipboardList size={18} />
              </div>
              <p className="font-semibold text-slate-300">No Recent Activity</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                No clinical events recorded yet. Scheduled visits, prescriptions, and lab results will appear here.
              </p>
            </div>
          )}
        </div>

        {/* Vitals */}
        <div className="glass animate-fade-in-up" style={{ animationDelay: '180ms', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>
              Latest Vitals
            </h2>
            <span style={{ fontSize: '0.7rem', color: '#5a7a9e' }}>
              Live Telemetry
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {vitalsCards.map((vital) => (
              <div
                key={vital.label}
                onClick={() => vital.path && navigate(vital.path)}
                className="glass-sm cursor-pointer hover:border-blue-500/40 hover:bg-white/[0.03] transition-all group"
                style={{ padding: '14px 16px' }}
                title={`View ${vital.label} details`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: '#5a7a9e' }}>{vital.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: vital.color,
                        background: `${vital.color}18`,
                        border: `1px solid ${vital.color}30`,
                        borderRadius: 20,
                        padding: '1px 8px',
                      }}
                    >
                      {vital.status}
                    </span>
                    <ArrowRight size={12} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e2eaf4' }}>{vital.value}</span>
                  <span style={{ fontSize: '0.75rem', color: '#5a7a9e' }}>{vital.unit}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'monospace' }}>
                    {vital.verification_status}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                    {vital.elapsed_time}
                  </span>
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
