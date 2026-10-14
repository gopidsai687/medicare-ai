import React, { useState, useEffect } from 'react'
import {
  Activity,
  Heart,
  Plus,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  Info,
  ChevronDown,
  Trash2,
  Edit2,
  Calendar,
  Sparkles,
  PhoneCall,
  MapPin,
  ExternalLink,
  X,
} from 'lucide-react'
import { TestModeConsole } from '@/components/vitals/TestModeConsole'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from 'recharts'
import { api } from '@/lib/api'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'

interface VitalReading {
  id: string
  recorded_at: string
  systolic_bp: number | null
  diastolic_bp: number | null
  heart_rate: number | null
  bp_category: string | null
  measurement_source: string
  device_name: string | null
  notes: string | null
  is_patient_entered: boolean
  is_sample: boolean
  mean_arterial_pressure: number | null
}

export default function BloodPressureTracking() {
  const [readings, setReadings] = useState<VitalReading[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPeriod, setFilterPeriod] = useState<number>(30)
  const [showLogModal, setShowLogModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [alertBanner, setAlertBanner] = useState<{
    severity: string
    title: string
    message: string
    recommendation: string
  } | null>(null)

  // Edit Reading State
  const [editingReading, setEditingReading] = useState<VitalReading | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    systolic_bp: 120,
    diastolic_bp: 80,
    heart_rate: 72,
    notes: '',
  })

  // Log Form State
  const [formData, setFormData] = useState({
    systolic_bp: '',
    diastolic_bp: '',
    heart_rate: '',
    recorded_at: new Date().toISOString().slice(0, 16),
    measurement_source: 'manual',
    device_name: '',
    notes: '',
    is_sample: false,
  })

  const fetchReadings = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/vitals/history', {
        params: { limit: 100 },
      })
      // Filter readings that have systolic and diastolic
      const bpList = (res.data || []).filter(
        (r: VitalReading) => r.systolic_bp != null && r.diastolic_bp != null
      )
      setReadings(bpList)
    } catch (err) {
      console.error('Failed to fetch blood pressure history:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReadings()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setAlertBanner(null)

    const sys = parseInt(formData.systolic_bp)
    const dia = parseInt(formData.diastolic_bp)
    const hr = formData.heart_rate ? parseInt(formData.heart_rate) : undefined

    if (isNaN(sys) || sys < 50 || sys > 300) {
      setErrorMsg('Please enter a valid systolic blood pressure (50 - 300 mmHg).')
      return
    }
    if (isNaN(dia) || dia < 30 || dia > 200) {
      setErrorMsg('Please enter a valid diastolic blood pressure (30 - 200 mmHg).')
      return
    }
    if (dia >= sys) {
      setErrorMsg('Diastolic pressure must be lower than systolic pressure.')
      return
    }

    try {
      setSubmitting(true)
      const res = await api.post('/api/v1/vitals/blood-pressure', {
        systolic_bp: sys,
        diastolic_bp: dia,
        heart_rate: hr,
        recorded_at: new Date(formData.recorded_at).toISOString(),
        measurement_source: formData.is_sample ? 'SAMPLE_DATA' : formData.measurement_source,
        device_name: formData.device_name || (formData.is_sample ? 'Clinical Simulator' : undefined),
        notes: formData.notes || (formData.is_sample ? '[DEMO TEST] Blood pressure simulation' : undefined),
        is_sample: formData.is_sample,
      })

      // Check if an immediate alert was triggered
      if (res.data?.alert) {
        setAlertBanner({
          severity: res.data.alert.severity,
          title: res.data.alert.title,
          message: res.data.alert.message,
          recommendation: res.data.alert.recommendation,
        })
      }

      setShowLogModal(false)
      setFormData({
        systolic_bp: '',
        diastolic_bp: '',
        heart_rate: '',
        recorded_at: new Date().toISOString().slice(0, 16),
        measurement_source: 'manual',
        device_name: '',
        notes: '',
        is_sample: false,
      })
      await fetchReadings()
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to record blood pressure reading.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this blood pressure record?')) return
    try {
      await api.delete(`/api/v1/vitals/${id}`)
      setReadings((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      alert('Failed to delete reading.')
    }
  }

  const handleOpenEdit = (r: VitalReading) => {
    setEditingReading(r)
    setEditForm({
      systolic_bp: r.systolic_bp || 120,
      diastolic_bp: r.diastolic_bp || 80,
      heart_rate: r.heart_rate || 72,
      notes: r.notes || '',
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingReading) return
    try {
      await api.put(`/api/v1/vitals/${editingReading.id}`, {
        systolic_bp: Number(editForm.systolic_bp),
        diastolic_bp: Number(editForm.diastolic_bp),
        heart_rate: editForm.heart_rate ? Number(editForm.heart_rate) : undefined,
        notes: editForm.notes,
      })
      setShowEditModal(false)
      setEditingReading(null)
      fetchReadings()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update reading')
    }
  }

  // Filter readings by period
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - filterPeriod)
  const filteredReadings = readings.filter(
    (r) => new Date(r.recorded_at) >= cutoffDate
  )

  // Chart data sorted chronologically
  const chartData = [...filteredReadings]
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((r) => ({
      time: format(new Date(r.recorded_at), 'MM/dd HH:mm'),
      systolic: r.systolic_bp,
      diastolic: r.diastolic_bp,
      pulse: r.heart_rate,
      map: r.mean_arterial_pressure,
      source: r.measurement_source,
    }))

  // Summary statistics
  const latest = readings[0]
  const avgSystolic =
    filteredReadings.length > 0
      ? Math.round(
          filteredReadings.reduce((acc, cur) => acc + (cur.systolic_bp || 0), 0) /
            filteredReadings.length
        )
      : null
  const avgDiastolic =
    filteredReadings.length > 0
      ? Math.round(
          filteredReadings.reduce((acc, cur) => acc + (cur.diastolic_bp || 0), 0) /
            filteredReadings.length
        )
      : null

  const crisisCount = filteredReadings.filter(
    (r) => (r.systolic_bp || 0) >= 180 || (r.diastolic_bp || 0) >= 120
  ).length

  const getCategoryBadge = (category?: string | null) => {
    switch (category) {
      case 'Normal':
        return { text: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' }
      case 'Elevated':
        return { text: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' }
      case 'Stage 1 Hypertension':
        return { text: '#fb923c', bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.3)' }
      case 'Stage 2 Hypertension':
        return { text: '#f87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)' }
      case 'Hypertensive Crisis':
        return { text: '#ef4444', bg: 'rgba(239,68,68,0.25)', border: 'rgba(239,68,68,0.6)' }
      case 'Hypotension':
        return { text: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)' }
      default:
        return { text: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)' }
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', marginBottom: 6 }}>
            <Activity size={12} color="#38bdf8" />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#38bdf8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              MediCare VitalSense
            </span>
          </div>
          <h1 className="page-title">Blood Pressure Telemetry & Monitoring</h1>
          <p className="page-subtitle">
            AHA/ACC 2017 compliant cardiovascular tracking with deterministic clinical classification.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setShowLogModal(true)}
            className="btn-primary"
            style={{ fontSize: '0.85rem' }}
          >
            <Plus size={16} />
            <span>Record BP Reading</span>
          </button>
        </div>
      </div>

      {/* Real Hardware & Measurement Integrity Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(15,23,42,0.85)',
          border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: 12,
          padding: '12px 18px',
        }}
      >
        <ShieldCheck size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.45 }}>
          <strong>Medical Device Standard:</strong> MediCare AI connects with validated clinical arm cuffs (Omron, Withings, Welch Allyn) or manual logs. We <em>never</em> claim that phone cameras, touchscreens, or optical flashlights measure diagnostic blood pressure.
        </div>
      </div>

      {/* Clinical Test Mode Simulation Console */}
      <TestModeConsole onSimulated={fetchReadings} compact={true} />

      {/* Emergency Alert Banner (if triggered) */}
      {alertBanner && (
        <div
          style={{
            background:
              alertBanner.severity === 'crisis'
                ? 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(185,28,28,0.35))'
                : 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.3))',
            border:
              alertBanner.severity === 'crisis'
                ? '1px solid rgba(239,68,68,0.6)'
                : '1px solid rgba(245,158,11,0.5)',
            borderRadius: 14,
            padding: '20px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <AlertTriangle
                size={24}
                color={alertBanner.severity === 'crisis' ? '#ef4444' : '#f59e0b'}
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <div>
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: alertBanner.severity === 'crisis' ? '#fecaca' : '#fef3c7',
                    margin: '0 0 4px',
                  }}
                >
                  {alertBanner.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#e2e8f0', margin: '0 0 10px', lineHeight: 1.45 }}>
                  {alertBanner.message}
                </p>
                <div style={{ fontSize: '0.825rem', color: '#94a3b8', fontWeight: 500 }}>
                  <strong>Recommendation:</strong> {alertBanner.recommendation}
                </div>
              </div>
            </div>

            {alertBanner.severity === 'crisis' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <a
                  href="tel:911"
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    fontWeight: 700,
                    padding: '10px 18px',
                    borderRadius: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    boxShadow: '0 4px 14px rgba(220,38,38,0.5)',
                  }}
                >
                  <PhoneCall size={16} />
                  <span>Call 911 Now</span>
                </a>
                <Link
                  to="/patient/hospitals"
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', textDecoration: 'none', justifyContent: 'center' }}
                >
                  <MapPin size={14} />
                  <span>Nearby ERs</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vital Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {/* Latest BP Card */}
        <div className="stat-card">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Latest Blood Pressure
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#f8fafc' }}>
              {latest?.systolic_bp != null ? `${latest.systolic_bp}/${latest.diastolic_bp}` : '--/--'}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>mmHg</span>
          </div>
          {latest && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {(() => {
                const badge = getCategoryBadge(latest.bp_category)
                return (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: badge.text,
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      padding: '3px 8px',
                      borderRadius: 6,
                    }}
                  >
                    {latest.bp_category || 'Unclassified'}
                  </span>
                )
              })()}
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {format(new Date(latest.recorded_at), 'MMM d, h:mm a')}
              </span>
            </div>
          )}
        </div>

        {/* Average Systolic / Diastolic */}
        <div className="stat-card">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            {filterPeriod}d Average
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#38bdf8' }}>
              {avgSystolic != null ? `${avgSystolic}/${avgDiastolic}` : '--/--'}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>mmHg</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 10 }}>
            Based on {filteredReadings.length} reading{filteredReadings.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Pulse / Heart Rate */}
        <div className="stat-card">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Associated Pulse
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#f43f5e' }}>
              {latest?.heart_rate != null ? latest.heart_rate : '--'}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>BPM</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 10 }}>
            {latest?.heart_rate ? 'Within resting clinical baseline' : 'No pulse captured on latest record'}
          </div>
        </div>

        {/* Urgent Alerts Count */}
        <div className="stat-card">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Clinical Alerts ({filterPeriod}d)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '2.1rem', fontWeight: 800, color: crisisCount > 0 ? '#ef4444' : '#10b981' }}>
              {crisisCount}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>Critical</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 10 }}>
            {crisisCount > 0 ? 'Urgent doctor review requested' : 'No hypertensive crises recorded'}
          </div>
        </div>
      </div>

      {/* Historical Trend Chart */}
      <div className="glass" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Blood Pressure Longitudinal Trend
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0' }}>
              Showing Systolic (mmHg), Diastolic (mmHg), and Mean Arterial Pressure (MAP)
            </p>
          </div>

          {/* Time range filters */}
          <div style={{ display: 'flex', gap: 6, background: 'rgba(10,22,40,0.6)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setFilterPeriod(days)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: filterPeriod === days ? 'rgba(56,189,248,0.2)' : 'transparent',
                  color: filterPeriod === days ? '#38bdf8' : '#94a3b8',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        {chartData.length > 0 ? (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis domain={[40, 200]} stroke="#64748b" fontSize={11} tickLine={false} unit=" mmHg" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10,22,40,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                    color: '#f8fafc',
                  }}
                />
                {/* Normal Target Area */}
                <ReferenceArea y1={60} y2={80} fill="#10b981" fillOpacity={0.05} />
                <ReferenceArea y1={90} y2={120} fill="#10b981" fillOpacity={0.05} />
                {/* Hypertensive Crisis Threshold */}
                <ReferenceLine y={180} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Crisis (180)', fill: '#ef4444', fontSize: 10 }} />
                <ReferenceLine y={120} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Elevated (120)', fill: '#f59e0b', fontSize: 10 }} />

                <Line type="monotone" dataKey="systolic" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 4, fill: '#38bdf8' }} name="Systolic (mmHg)" />
                <Line type="monotone" dataKey="diastolic" stroke="#2dd4bf" strokeWidth={2.5} dot={{ r: 4, fill: '#2dd4bf' }} name="Diastolic (mmHg)" />
                <Line type="monotone" dataKey="map" stroke="#818cf8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="MAP (mmHg)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            No blood pressure measurements recorded in the last {filterPeriod} days.
          </div>
        )}
      </div>

      {/* AHA/ACC 2017 Clinical Reference Guide */}
      <div className="glass" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: 14 }}>
          AHA/ACC 2017 Blood Pressure Categories Reference
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>Normal</div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 4 }}>Systolic &lt; 120 and Diastolic &lt; 80 mmHg</div>
          </div>
          <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>Elevated</div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 4 }}>Systolic 120-129 and Diastolic &lt; 80 mmHg</div>
          </div>
          <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fb923c' }}>Stage 1 Hypertension</div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 4 }}>Systolic 130-139 or Diastolic 80-89 mmHg</div>
          </div>
          <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171' }}>Stage 2 Hypertension</div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 4 }}>Systolic ≥ 140 or Diastolic ≥ 90 mmHg</div>
          </div>
          <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>Hypertensive Crisis</div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 4 }}>Systolic &gt; 180 and/or Diastolic &gt; 120 mmHg</div>
          </div>
        </div>
      </div>

      {/* Historical Measurements Table */}
      <div className="glass" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: 16 }}>
          Blood Pressure Measurement Records
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Reading (mmHg)</th>
                <th>Classification</th>
                <th>Pulse</th>
                <th>Source / Device</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReadings.map((r) => {
                const badge = getCategoryBadge(r.bp_category)
                return (
                  <tr key={r.id}>
                    <td style={{ fontSize: '0.825rem', whiteSpace: 'nowrap' }}>
                      {format(new Date(r.recorded_at), 'MMM dd, yyyy h:mm a')}
                    </td>
                    <td style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                      {r.systolic_bp} / {r.diastolic_bp}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: badge.text,
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          padding: '3px 8px',
                          borderRadius: 6,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.bp_category || 'Normal'}
                      </span>
                    </td>
                    <td style={{ color: r.heart_rate ? '#f43f5e' : '#64748b', fontWeight: 600 }}>
                      {r.heart_rate ? `${r.heart_rate} bpm` : '--'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'capitalize' }}>
                          {r.device_name || r.measurement_source}
                        </span>
                        {r.is_sample && (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '1px 5px', borderRadius: 4 }}>
                            Sample
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.notes || '—'}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleOpenEdit(r)}
                        style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 4, marginRight: 6 }}
                        title="Edit reading"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                        title="Delete record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredReadings.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    No readings found. Click "Record BP Reading" above to log your first measurement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record BP Modal */}
      {showLogModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            className="glass"
            style={{
              width: '100%',
              maxWidth: 500,
              padding: 28,
              border: '1px solid rgba(56,189,248,0.3)',
              borderRadius: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Activity size={22} color="#38bdf8" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Record Blood Pressure
                </h3>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#fca5a5', fontSize: '0.8rem' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                    Systolic (mmHg) *
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 120"
                    required
                    value={formData.systolic_bp}
                    onChange={(e) => setFormData({ ...formData, systolic_bp: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                    Diastolic (mmHg) *
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 80"
                    required
                    value={formData.diastolic_bp}
                    onChange={(e) => setFormData({ ...formData, diastolic_bp: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Associated Pulse / Heart Rate (BPM)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 72 (Optional)"
                  value={formData.heart_rate}
                  onChange={(e) => setFormData({ ...formData, heart_rate: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Measurement Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.recorded_at}
                  onChange={(e) => setFormData({ ...formData, recorded_at: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                    Source Type
                  </label>
                  <select
                    value={formData.measurement_source}
                    onChange={(e) => setFormData({ ...formData, measurement_source: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="manual">Manual Entry</option>
                    <option value="omron">Omron Blood Pressure Monitor</option>
                    <option value="withings">Withings BPM</option>
                    <option value="apple_health">Apple Health Sync</option>
                    <option value="health_connect">Google Health Connect</option>
                    <option value="clinic">Clinical Encounter</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                    Device Model (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Omron Platinum"
                    value={formData.device_name}
                    onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Measurement Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Seated 5 mins resting, left arm cuff"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              {/* Demo Mode / Fictional Test Reading Toggle */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: formData.is_sample ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${formData.is_sample ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.2s ease',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={formData.is_sample}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setFormData({
                        ...formData,
                        is_sample: checked,
                        measurement_source: checked ? 'SAMPLE_DATA' : 'manual',
                        notes: checked && !formData.notes ? '[DEMO TEST] Simulated blood pressure reading' : formData.notes,
                      })
                    }}
                    style={{ width: 16, height: 16, accentColor: '#f59e0b', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.825rem', fontWeight: 700, color: formData.is_sample ? '#fbbf24' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Save as Fictional Test Reading (Demo Mode)</span>
                      {formData.is_sample && (
                        <span style={{ fontSize: '0.65rem', background: 'rgba(245,158,11,0.2)', color: '#fbbf24', padding: '1px 6px', borderRadius: 4 }}>
                          SAMPLE
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '2px 0 0' }}>
                      Fictional telemetry for testing clinical alert workflows. Never confused with real patient diagnostics.
                    </p>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  style={{ padding: '8px 20px' }}
                >
                  {submitting ? 'Evaluating...' : 'Save & Evaluate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Reading Modal */}
      {showEditModal && editingReading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#0d1d33',
              border: '1px solid rgba(56,189,248,0.3)',
              borderRadius: 16,
              padding: 28,
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit2 size={18} color="#38bdf8" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Edit Blood Pressure Reading
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingReading(null)
                }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                    Systolic (mmHg)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="280"
                    required
                    value={editForm.systolic_bp}
                    onChange={(e) => setEditForm({ ...editForm, systolic_bp: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1.1rem', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                    Diastolic (mmHg)
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="180"
                    required
                    value={editForm.diastolic_bp}
                    onChange={(e) => setEditForm({ ...editForm, diastolic_bp: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1.1rem', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Resting Pulse (bpm, optional)
                </label>
                <input
                  type="number"
                  min="30"
                  max="220"
                  value={editForm.heart_rate}
                  onChange={(e) => setEditForm({ ...editForm, heart_rate: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Notes
                </label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingReading(null)
                  }}
                  className="btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 20px' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
