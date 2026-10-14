import React, { useState, useEffect } from 'react'
import {
  Droplet,
  Plus,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  Info,
  Trash2,
  Calendar,
  Sparkles,
  PhoneCall,
  MapPin,
  Utensils,
  Moon,
  Sun,
  Activity,
} from 'lucide-react'
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
  blood_glucose: number | null
  blood_glucose_mmol: number | null
  glucose_unit: string
  glucose_context: string | null
  glucose_category: string | null
  measurement_source: string
  device_name: string | null
  notes: string | null
  is_patient_entered: boolean
  is_sample: boolean
}

export default function BloodGlucoseTracking() {
  const [readings, setReadings] = useState<VitalReading[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPeriod, setFilterPeriod] = useState<number>(30)
  const [displayUnit, setDisplayUnit] = useState<'mg/dL' | 'mmol/L'>('mg/dL')
  const [showLogModal, setShowLogModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [alertBanner, setAlertBanner] = useState<{
    severity: string
    title: string
    message: string
    recommendation: string
  } | null>(null)

  // Log Form State
  const [formData, setFormData] = useState({
    glucose_value: '',
    unit: 'mg/dL',
    context: 'fasting',
    recorded_at: new Date().toISOString().slice(0, 16),
    measurement_source: 'manual',
    device_name: '',
    notes: '',
  })

  const fetchReadings = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/vitals/history', {
        params: { limit: 100 },
      })
      const glucoseList = (res.data || []).filter(
        (r: VitalReading) => r.blood_glucose != null || r.blood_glucose_mmol != null
      )
      setReadings(glucoseList)
    } catch (err) {
      console.error('Failed to fetch blood glucose history:', err)
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

    const val = parseFloat(formData.glucose_value)
    if (isNaN(val) || val <= 0) {
      setErrorMsg('Please enter a valid glucose value.')
      return
    }

    if (formData.unit === 'mg/dL' && (val < 20 || val > 600)) {
      setErrorMsg('Glucose value in mg/dL should typically be between 20 and 600.')
      return
    }

    if (formData.unit === 'mmol/L' && (val < 1.1 || val > 33.3)) {
      setErrorMsg('Glucose value in mmol/L should typically be between 1.1 and 33.3.')
      return
    }

    try {
      setSubmitting(true)
      const res = await api.post('/api/v1/vitals/blood-glucose', {
        glucose_value: val,
        unit: formData.unit,
        context: formData.context,
        recorded_at: new Date(formData.recorded_at).toISOString(),
        measurement_source: formData.measurement_source,
        device_name: formData.device_name || undefined,
        notes: formData.notes || undefined,
      })

      // Check if an immediate alert was generated
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
        glucose_value: '',
        unit: displayUnit,
        context: 'fasting',
        recorded_at: new Date().toISOString().slice(0, 16),
        measurement_source: 'manual',
        device_name: '',
        notes: '',
      })
      await fetchReadings()
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to record blood glucose reading.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this glucose record?')) return
    try {
      await api.delete(`/api/v1/vitals/${id}`)
      setReadings((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      alert('Failed to delete reading.')
    }
  }

  // Filter by period
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - filterPeriod)
  const filteredReadings = readings.filter(
    (r) => new Date(r.recorded_at) >= cutoffDate
  )

  // Chart data sorted chronologically
  const chartData = [...filteredReadings]
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((r) => {
      const mgdl = r.blood_glucose ?? (r.blood_glucose_mmol ? Math.round(r.blood_glucose_mmol * 18.0182) : null)
      const mmol = r.blood_glucose_mmol ?? (r.blood_glucose ? Math.round((r.blood_glucose / 18.0182) * 10) / 10 : null)
      return {
        time: format(new Date(r.recorded_at), 'MM/dd HH:mm'),
        value: displayUnit === 'mg/dL' ? mgdl : mmol,
        context: r.glucose_context,
        source: r.measurement_source,
      }
    })

  // Summary Metrics
  const latest = readings[0]
  const latestVal =
    latest != null
      ? displayUnit === 'mg/dL'
        ? latest.blood_glucose ?? (latest.blood_glucose_mmol ? Math.round(latest.blood_glucose_mmol * 18.0182) : null)
        : latest.blood_glucose_mmol ?? (latest.blood_glucose ? Math.round((latest.blood_glucose / 18.0182) * 10) / 10 : null)
      : null

  // Time in range calculations (ADA 70 - 180 mg/dL target)
  const totalCount = filteredReadings.length
  const inRangeCount = filteredReadings.filter((r) => {
    const val = r.blood_glucose ?? (r.blood_glucose_mmol ? r.blood_glucose_mmol * 18.0182 : 0)
    return val >= 70 && val <= 180
  }).length
  const tirPercent = totalCount > 0 ? Math.round((inRangeCount / totalCount) * 100) : null

  const hypoCount = filteredReadings.filter((r) => {
    const val = r.blood_glucose ?? (r.blood_glucose_mmol ? r.blood_glucose_mmol * 18.0182 : 0)
    return val > 0 && val < 70
  }).length

  const hyperCount = filteredReadings.filter((r) => {
    const val = r.blood_glucose ?? (r.blood_glucose_mmol ? r.blood_glucose_mmol * 18.0182 : 0)
    return val > 250
  }).length

  const getGlucoseCategoryBadge = (category?: string | null) => {
    switch (category) {
      case 'Normal':
        return { text: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' }
      case 'Pre-Diabetes':
      case 'Elevated':
        return { text: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' }
      case 'Hyperglycemia':
        return { text: '#f87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)' }
      case 'Hypoglycemia':
        return { text: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)' }
      case 'Severe Hypoglycemia':
        return { text: '#ef4444', bg: 'rgba(239,68,68,0.25)', border: 'rgba(239,68,68,0.6)' }
      default:
        return { text: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)' }
    }
  }

  const getContextIcon = (context?: string | null) => {
    switch (context) {
      case 'fasting':
        return <Sun size={13} color="#f59e0b" />
      case 'before_meal':
      case 'after_meal':
        return <Utensils size={13} color="#10b981" />
      case 'bedtime':
        return <Moon size={13} color="#818cf8" />
      default:
        return <Clock size={13} color="#94a3b8" />
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', marginBottom: 6 }}>
            <Droplet size={12} color="#38bdf8" />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#38bdf8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              MediCare VitalSense
            </span>
          </div>
          <h1 className="page-title">Blood Glucose Monitoring & Glycemic Analysis</h1>
          <p className="page-subtitle">
            ADA 2024 Standards of Care glycemic tracking, Time-in-Range (TIR) metrics, and hypoglycemic alerts.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Unit Toggle */}
          <div style={{ display: 'flex', background: 'rgba(10,22,40,0.6)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setDisplayUnit('mg/dL')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: displayUnit === 'mg/dL' ? 'rgba(56,189,248,0.2)' : 'transparent',
                color: displayUnit === 'mg/dL' ? '#38bdf8' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              mg/dL
            </button>
            <button
              onClick={() => setDisplayUnit('mmol/L')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: displayUnit === 'mmol/L' ? 'rgba(56,189,248,0.2)' : 'transparent',
                color: displayUnit === 'mmol/L' ? '#38bdf8' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              mmol/L
            </button>
          </div>

          <button
            onClick={() => {
              setFormData((prev) => ({ ...prev, unit: displayUnit }))
              setShowLogModal(true)
            }}
            className="btn-primary"
            style={{ fontSize: '0.85rem' }}
          >
            <Plus size={16} />
            <span>Record Glucose</span>
          </button>
        </div>
      </div>

      {/* Safety & Medical Device Policy */}
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
          <strong>Verified Glucose Ingestion:</strong> Readings are imported from FDA/CE cleared CGMs (Dexcom G7, Abbott FreeStyle Libre 3, Contour Next) or manual meter logs. We <em>never</em> claim that optical camera sensors or touchscreens measure blood sugar without clinical hardware.
        </div>
      </div>

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
                  <strong>Clinical Protocol:</strong> {alertBanner.recommendation}
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
                  <span>Emergency Facilities</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Glycemic Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {/* Latest Reading Card */}
        <div className="stat-card">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Latest Blood Glucose
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#f8fafc' }}>
              {latestVal != null ? latestVal : '--'}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>{displayUnit}</span>
          </div>
          {latest && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {(() => {
                const badge = getGlucoseCategoryBadge(latest.glucose_category)
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
                    {latest.glucose_category || 'Normal'}
                  </span>
                )
              })()}
              <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'capitalize' }}>
                {latest.glucose_context ? latest.glucose_context.replace('_', ' ') : 'Random'}
              </span>
            </div>
          )}
        </div>

        {/* Time-in-Range (TIR) */}
        <div className="stat-card">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Time in Target Range (TIR)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '2.1rem', fontWeight: 800, color: tirPercent && tirPercent >= 70 ? '#10b981' : '#f59e0b' }}>
              {tirPercent != null ? `${tirPercent}%` : '--'}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>
              (70-180 mg/dL)
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 10 }}>
            {tirPercent && tirPercent >= 70 ? 'ADA Clinical Target Met (≥ 70%)' : 'Below ADA guideline target'}
          </div>
        </div>

        {/* Hypoglycemia Events */}
        <div className="stat-card">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Hypoglycemia Events ({filterPeriod}d)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '2.1rem', fontWeight: 800, color: hypoCount > 0 ? '#ef4444' : '#10b981' }}>
              {hypoCount}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>&lt; 70 mg/dL</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 10 }}>
            {hypoCount > 0 ? 'Requires clinical attention & rule of 15' : 'Zero low glucose events detected'}
          </div>
        </div>

        {/* Hyperglycemia Events */}
        <div className="stat-card">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Hyperglycemia Events ({filterPeriod}d)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '2.1rem', fontWeight: 800, color: hyperCount > 0 ? '#f59e0b' : '#10b981' }}>
              {hyperCount}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>&gt; 250 mg/dL</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 10 }}>
            {hyperCount > 0 ? 'Follow clinical regimen & hydration' : 'Optimal glycemic management'}
          </div>
        </div>
      </div>

      {/* Longitudinal Trend Chart */}
      <div className="glass" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Glycemic Longitudinal Trajectory
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0' }}>
              Values displayed in {displayUnit} across {filterPeriod} days
            </p>
          </div>

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
                <YAxis
                  domain={displayUnit === 'mg/dL' ? [40, 300] : [2, 17]}
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  unit={` ${displayUnit}`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10,22,40,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                    color: '#f8fafc',
                  }}
                />
                {/* Target Range Shading */}
                <ReferenceArea
                  y1={displayUnit === 'mg/dL' ? 70 : 3.9}
                  y2={displayUnit === 'mg/dL' ? 180 : 10.0}
                  fill="#10b981"
                  fillOpacity={0.06}
                />
                {/* Hypo Line */}
                <ReferenceLine
                  y={displayUnit === 'mg/dL' ? 70 : 3.9}
                  stroke="#38bdf8"
                  strokeDasharray="4 4"
                  label={{ value: 'Hypo (70)', fill: '#38bdf8', fontSize: 10 }}
                />
                {/* Hyper Line */}
                <ReferenceLine
                  y={displayUnit === 'mg/dL' ? 250 : 13.9}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: 'Hyper (250)', fill: '#ef4444', fontSize: 10 }}
                />

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2dd4bf"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2dd4bf' }}
                  name={`Glucose (${displayUnit})`}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            No glucose records found in the last {filterPeriod} days.
          </div>
        )}
      </div>

      {/* ADA 2024 Reference Benchmarks */}
      <div className="glass" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: 14 }}>
          ADA 2024 Standards of Care Glycemic Targets
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>Fasting Target</div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 4 }}>70 – 130 mg/dL (3.9 – 7.2 mmol/L)</div>
          </div>
          <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>Postprandial (1-2h)</div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 4 }}>&lt; 180 mg/dL (&lt; 10.0 mmol/L)</div>
          </div>
          <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>Level 1 Hypoglycemia</div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 4 }}>54 – 69 mg/dL (Rule of 15 fast-acting carb)</div>
          </div>
          <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>Severe Hypoglycemia</div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 4 }}>&lt; 54 mg/dL (Immediate assistance/glucagon)</div>
          </div>
        </div>
      </div>

      {/* Measurement Records Table */}
      <div className="glass" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: 16 }}>
          Blood Glucose Measurement Records
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Value</th>
                <th>Context</th>
                <th>Category</th>
                <th>Source / Device</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReadings.map((r) => {
                const badge = getGlucoseCategoryBadge(r.glucose_category)
                const val =
                  displayUnit === 'mg/dL'
                    ? r.blood_glucose ?? (r.blood_glucose_mmol ? Math.round(r.blood_glucose_mmol * 18.0182) : '--')
                    : r.blood_glucose_mmol ?? (r.blood_glucose ? Math.round((r.blood_glucose / 18.0182) * 10) / 10 : '--')

                return (
                  <tr key={r.id}>
                    <td style={{ fontSize: '0.825rem', whiteSpace: 'nowrap' }}>
                      {format(new Date(r.recorded_at), 'MMM dd, yyyy h:mm a')}
                    </td>
                    <td style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                      {val} {displayUnit}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'capitalize', fontSize: '0.8rem' }}>
                        {getContextIcon(r.glucose_context)}
                        <span>{r.glucose_context ? r.glucose_context.replace('_', ' ') : 'Random'}</span>
                      </div>
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
                        {r.glucose_category || 'Normal'}
                      </span>
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
                    <td style={{ textAlign: 'right' }}>
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
                    No readings found. Click "Record Glucose" above to add your first reading.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Glucose Modal */}
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
                <Droplet size={22} color="#38bdf8" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Record Blood Glucose
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
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                    Glucose Value *
                  </label>
                  <input
                    type="number"
                    step={formData.unit === 'mmol/L' ? '0.1' : '1'}
                    placeholder={formData.unit === 'mg/dL' ? 'e.g. 105' : 'e.g. 5.8'}
                    required
                    value={formData.glucose_value}
                    onChange={(e) => setFormData({ ...formData, glucose_value: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                    Unit
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="mg/dL">mg/dL</option>
                    <option value="mmol/L">mmol/L</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Measurement Context
                </label>
                <select
                  value={formData.context}
                  onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <option value="fasting">Fasting (8+ hours no food)</option>
                  <option value="before_meal">Preprandial (Before Meal)</option>
                  <option value="after_meal">Postprandial (1-2h After Meal)</option>
                  <option value="bedtime">Bedtime</option>
                  <option value="random">Random / Casual</option>
                </select>
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
                    <option value="manual">Manual Meter Log</option>
                    <option value="dexcom">Dexcom G7 CGM</option>
                    <option value="freestyle_libre">Abbott FreeStyle Libre 3</option>
                    <option value="contour_next">Contour Next One</option>
                    <option value="apple_health">Apple Health Sync</option>
                    <option value="health_connect">Google Health Connect</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                    Device Model (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dexcom G7"
                    value={formData.device_name}
                    onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Feeling mild shakiness, tested fingerstick"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                />
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
    </div>
  )
}
