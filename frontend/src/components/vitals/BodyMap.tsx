import React, { useState, useEffect } from 'react'
import {
  Heart,
  Activity,
  Droplet,
  Wind,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'

export interface BodyMapIndicator {
  system_name: string
  label: string
  status: 'normal' | 'attention' | 'urgent' | 'stale' | 'unavailable'
  status_label: string
  measurement_type: string
  latest_value: string | null
  latest_unit: string | null
  recorded_at: string | null
  measurement_source: string | null
  is_sample: boolean
  clinical_summary: string
  trend: 'improving' | 'stable' | 'deteriorating' | 'insufficient_data'
  history_count: number
  urgency_level: 'none' | 'low' | 'moderate' | 'high' | 'critical'
}

interface BodyMapProps {
  patientId?: string
  compact?: boolean
  onLogClick?: (measurementType: string) => void
  refreshKey?: number
}

export function BodyMap({ patientId, compact = false, onLogClick, refreshKey }: BodyMapProps) {
  const [data, setData] = useState<{
    evaluated_at: string
    indicators: Record<string, BodyMapIndicator>
    overall_status: string
    disclaimer: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSystem, setSelectedSystem] = useState<string>('cardiovascular')
  const [activeTab, setActiveTab] = useState<'map' | 'cards'>('map')

  const fetchBodyMap = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/vitals/body-map', {
        params: patientId ? { patient_id: patientId } : {},
      })
      setData(res.data)
      if (res.data?.indicators) {
        // Default to urgent/attention indicator if exists
        const urgentKey = Object.keys(res.data.indicators).find(
          (k) => res.data.indicators[k].status === 'urgent'
        )
        const attentionKey = Object.keys(res.data.indicators).find(
          (k) => res.data.indicators[k].status === 'attention'
        )
        if (urgentKey) setSelectedSystem(urgentKey)
        else if (attentionKey) setSelectedSystem(attentionKey)
      }
    } catch (err) {
      console.error('Failed to load body map data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBodyMap()
  }, [patientId, refreshKey])

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'urgent':
        return { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', glow: '#ef4444' }
      case 'attention':
        return { text: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', glow: '#f59e0b' }
      case 'normal':
        return { text: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', glow: '#10b981' }
      case 'stale':
        return { text: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.25)', glow: '#94a3b8' }
      default:
        return { text: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.2)', glow: '#475569' }
    }
  }

  const getSystemIcon = (system: string) => {
    switch (system) {
      case 'cardiovascular':
        return <Activity size={18} />
      case 'heart':
        return <Heart size={18} />
      case 'metabolic':
        return <Droplet size={18} />
      case 'respiratory':
        return <Wind size={18} />
      case 'biometrics':
        return <Scale size={18} />
      default:
        return <Activity size={18} />
    }
  }

  const indicators = data?.indicators || {}
  const activeIndicator: BodyMapIndicator | undefined = indicators[selectedSystem]
  const activeColor = getStatusColor(activeIndicator?.status)

  // Hotspot coordinates on the SVG coordinate system (300 x 440)
  const hotspots: Record<string, { x: number; y: number; label: string; side: 'left' | 'right' }> = {
    heart: { x: 158, y: 142, label: 'Cardiac', side: 'right' },
    cardiovascular: { x: 88, y: 185, label: 'Blood Pressure', side: 'left' },
    metabolic: { x: 145, y: 220, label: 'Blood Glucose', side: 'right' },
    respiratory: { x: 135, y: 130, label: 'Respiratory', side: 'left' },
    biometrics: { x: 150, y: 285, label: 'Biometrics', side: 'right' },
  }

  return (
    <div className="glass" style={{ padding: compact ? '20px' : '28px', position: 'relative', overflow: 'hidden' }}>
      {/* Background ambient medical glow */}
      <div
        style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', marginBottom: 6 }}>
            <Sparkles size={12} color="#38bdf8" />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#38bdf8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Interactive Health Map
            </span>
          </div>
          <h2 style={{ fontSize: compact ? '1.25rem' : '1.5rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Patient Body Map & Anatomical Status
          </h2>
          <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: '4px 0 0' }}>
            Exploratory visual representation of verified vital telemetry mapped to anatomical organ systems.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={fetchBodyMap}
            disabled={loading}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(15,32,64,0.6)',
              color: '#94a3b8',
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Strict Medical Disclaimer Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(15,23,42,0.7)',
          border: '1px solid rgba(148,163,184,0.15)',
          borderRadius: 10,
          padding: '8px 14px',
          marginBottom: 20,
        }}
      >
        <Info size={15} color="#38bdf8" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.4 }}>
          <strong>Educational Telemetry Map:</strong> This anatomical graphic visualizes recorded patient measurements (Manual entries, Omron, Dexcom, or test data). It is an educational visual map of recorded numbers, <em>never</em> a real-time body scan, camera sensor, or diagnostic imaging device.
        </span>
      </div>

      {/* Main Body Map Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(280px, 320px) 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left: Interactive SVG Body Map */}
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(10,22,40,0.85) 0%, rgba(5,12,26,0.95) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: '20px 16px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Status legend chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 4, color: '#10b981' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} /> Normal
            </span>
            <span style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} /> Attention
            </span>
            <span style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} /> Urgent
            </span>
            <span style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8' }} /> Stale / None
            </span>
          </div>

          {/* SVG Silhouette and Hotspots */}
          <div style={{ position: 'relative', width: 280, height: 420 }}>
            <svg
              viewBox="0 0 300 440"
              style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))' }}
            >
              <defs>
                <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="50%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#020617" />
                </linearGradient>
                <linearGradient id="glowLine" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.2" />
                </linearGradient>
                <radialGradient id="radarPulse" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Grid backdrop */}
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
              </pattern>
              <rect width="300" height="440" fill="url(#grid)" />

              {/* Head */}
              <ellipse cx="150" cy="52" rx="28" ry="34" fill="url(#bodyGrad)" stroke="rgba(56,189,248,0.25)" strokeWidth="1.5" />
              {/* Neck */}
              <rect x="142" y="85" width="16" height="18" rx="4" fill="url(#bodyGrad)" stroke="rgba(56,189,248,0.25)" strokeWidth="1.5" />

              {/* Torso & Shoulders */}
              <path
                d="M 100 102 C 120 98, 180 98, 200 102 C 220 108, 224 135, 220 170 L 210 240 C 205 255, 195 265, 182 270 L 118 270 C 105 265, 95 255, 90 240 L 80 170 C 76 135, 80 108, 100 102 Z"
                fill="url(#bodyGrad)"
                stroke="rgba(56,189,248,0.28)"
                strokeWidth="1.5"
              />

              {/* Left Arm (Patient Right) */}
              <path
                d="M 80 115 C 68 140, 58 175, 52 215 C 48 240, 44 265, 42 285 C 40 295, 46 300, 52 298 C 58 295, 66 270, 70 240 L 76 180"
                fill="none"
                stroke="rgba(56,189,248,0.25)"
                strokeWidth="14"
                strokeLinecap="round"
              />

              {/* Right Arm (Patient Left) */}
              <path
                d="M 220 115 C 232 140, 242 175, 248 215 C 252 240, 256 265, 258 285 C 260 295, 254 300, 248 298 C 242 295, 234 270, 230 240 L 224 180"
                fill="none"
                stroke="rgba(56,189,248,0.25)"
                strokeWidth="14"
                strokeLinecap="round"
              />

              {/* Hips & Pelvis */}
              <path
                d="M 118 270 L 182 270 C 195 272, 202 288, 198 305 L 192 315 L 108 315 L 102 305 C 98 288, 105 272, 118 270 Z"
                fill="url(#bodyGrad)"
                stroke="rgba(56,189,248,0.22)"
                strokeWidth="1.5"
              />

              {/* Left Leg */}
              <path
                d="M 112 315 L 108 370 C 106 395, 104 415, 102 430"
                fill="none"
                stroke="rgba(56,189,248,0.22)"
                strokeWidth="16"
                strokeLinecap="round"
              />

              {/* Right Leg */}
              <path
                d="M 188 315 L 192 370 C 194 395, 196 415, 198 430"
                fill="none"
                stroke="rgba(56,189,248,0.22)"
                strokeWidth="16"
                strokeLinecap="round"
              />

              {/* Internal Vascular Lines (Aesthetics) */}
              <path
                d="M 150 90 L 150 240 M 150 145 L 88 185 M 150 145 L 210 185"
                fill="none"
                stroke="rgba(56,189,248,0.15)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Hotspot connection callout lines */}
              {Object.entries(hotspots).map(([key, spot]) => {
                const ind = indicators[key]
                const color = getStatusColor(ind?.status)
                const isSelected = selectedSystem === key
                return (
                  <g key={`line-${key}`}>
                    <line
                      x1={spot.x}
                      y1={spot.y}
                      x2={spot.side === 'left' ? 30 : 270}
                      y2={spot.y}
                      stroke={isSelected ? color.text : 'rgba(148,163,184,0.2)'}
                      strokeWidth={isSelected ? 1.5 : 0.75}
                      strokeDasharray={isSelected ? 'none' : '2 2'}
                    />
                  </g>
                )
              })}

              {/* Interactive Hotspot Nodes */}
              {Object.entries(hotspots).map(([key, spot]) => {
                const ind = indicators[key]
                const color = getStatusColor(ind?.status)
                const isSelected = selectedSystem === key
                const isUrgent = ind?.status === 'urgent'

                return (
                  <g
                    key={`node-${key}`}
                    onClick={() => setSelectedSystem(key)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Urgent animated pulse halo */}
                    {isUrgent && (
                      <circle cx={spot.x} cy={spot.y} r={22} fill="url(#radarPulse)">
                        <animate attributeName="r" values="14;28;14" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Selection halo */}
                    {isSelected && (
                      <circle
                        cx={spot.x}
                        cy={spot.y}
                        r={16}
                        fill="none"
                        stroke={color.text}
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      >
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          from={`0 ${spot.x} ${spot.y}`}
                          to={`360 ${spot.x} ${spot.y}`}
                          dur="12s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    {/* Outer indicator circle */}
                    <circle
                      cx={spot.x}
                      cy={spot.y}
                      r={10}
                      fill={color.bg}
                      stroke={color.border}
                      strokeWidth="2"
                    />

                    {/* Core node dot */}
                    <circle cx={spot.x} cy={spot.y} r={4.5} fill={color.text} />
                  </g>
                )
              })}
            </svg>

            {/* Clickable Floating Side Labels */}
            {Object.entries(hotspots).map(([key, spot]) => {
              const ind = indicators[key]
              const color = getStatusColor(ind?.status)
              const isSelected = selectedSystem === key

              return (
                <button
                  key={`btn-${key}`}
                  onClick={() => setSelectedSystem(key)}
                  style={{
                    position: 'absolute',
                    top: spot.y - 14,
                    ...(spot.side === 'left' ? { left: -6 } : { right: -6 }),
                    background: isSelected ? color.bg : 'rgba(15,23,42,0.85)',
                    border: `1px solid ${isSelected ? color.border : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 6,
                    padding: '3px 7px',
                    color: isSelected ? color.text : '#cbd5e1',
                    fontSize: '0.68rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    boxShadow: isSelected ? `0 0 12px ${color.glow}44` : 'none',
                    transition: 'all 0.2s ease',
                    zIndex: 10,
                  }}
                >
                  {spot.label}
                </button>
              )
            })}
          </div>

          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 12, textAlign: 'center' }}>
            Tap any anatomical hotspot or organ label to inspect recorded telemetry.
          </div>
        </div>

        {/* Right: Detailed Flyout Telemetry Inspector */}
        <div
          style={{
            background: 'rgba(15,32,64,0.4)',
            border: `1px solid ${activeColor.border}`,
            borderRadius: 16,
            padding: '24px',
            position: 'relative',
            boxShadow: `0 8px 32px rgba(0,0,0,0.25)`,
          }}
        >
          {activeIndicator ? (
            <div>
              {/* Top System Banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: activeColor.bg,
                      border: `1px solid ${activeColor.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: activeColor.text,
                    }}
                  >
                    {getSystemIcon(selectedSystem)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                      {activeIndicator.label}
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      System: <span style={{ textTransform: 'capitalize', color: '#cbd5e1' }}>{activeIndicator.system_name}</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 20,
                    background: activeColor.bg,
                    border: `1px solid ${activeColor.border}`,
                    color: activeColor.text,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {activeIndicator.status === 'urgent' && <AlertTriangle size={13} />}
                  {activeIndicator.status === 'normal' && <CheckCircle2 size={13} />}
                  {activeIndicator.status === 'stale' && <Clock size={13} />}
                  <span>{activeIndicator.status_label}</span>
                </div>
              </div>

              {/* Main Metric Value Card */}
              <div
                style={{
                  background: 'rgba(10,22,40,0.6)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 14,
                  padding: '18px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                    Latest Recorded Telemetry
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: '2.1rem', fontWeight: 800, color: activeIndicator.latest_value ? '#f8fafc' : '#64748b', letterSpacing: '-0.02em' }}>
                      {activeIndicator.latest_value || 'No Data'}
                    </span>
                    {activeIndicator.latest_unit && (
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#94a3b8' }}>
                        {activeIndicator.latest_unit}
                      </span>
                    )}
                  </div>
                </div>

                {activeIndicator.recorded_at && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Timestamp</div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500 }}>
                      {new Date(activeIndicator.recorded_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Provenance & Source Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                  }}
                >
                  <ShieldCheck size={13} color="#38bdf8" />
                  <span>
                    Source:{' '}
                    <strong style={{ color: activeIndicator.is_sample ? '#f59e0b' : '#cbd5e1' }}>
                      {activeIndicator.is_sample
                        ? 'DEMO DATA'
                        : activeIndicator.measurement_source === 'measured_device' || activeIndicator.measurement_source?.includes('ble')
                        ? 'REAL DEVICE DATA'
                        : activeIndicator.measurement_source === 'webcam_rppg_experimental'
                        ? 'WEBCAM EXPERIMENTAL'
                        : activeIndicator.measurement_source?.startsWith('manual')
                        ? 'Manual Entry — Not Device Verified'
                        : activeIndicator.measurement_source || 'Not Recorded'}
                    </strong>
                  </span>
                </div>

                {activeIndicator.is_sample && (
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: 'rgba(245,158,11,0.15)',
                      border: '1px solid rgba(245,158,11,0.3)',
                      color: '#fbbf24',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    DEMO DATA
                  </span>
                )}

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                  }}
                >
                  <span>Readings on File: <strong style={{ color: '#cbd5e1' }}>{activeIndicator.history_count}</strong></span>
                </div>
              </div>

              {/* Clinical Summary & Guidelines */}
              <div
                style={{
                  background: 'rgba(10,22,40,0.5)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                  Clinical Evaluation Summary
                </div>
                <p style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5, margin: 0 }}>
                  {activeIndicator.clinical_summary}
                </p>
              </div>

              {/* Navigation Action Links */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {selectedSystem === 'cardiovascular' && (
                  <Link
                    to="/patient/vitalsense/blood-pressure"
                    className="btn-primary"
                    style={{ textDecoration: 'none', fontSize: '0.825rem', padding: '8px 16px' }}
                  >
                    <span>Open Blood Pressure Portal</span>
                    <ChevronRight size={14} />
                  </Link>
                )}

                {selectedSystem === 'metabolic' && (
                  <Link
                    to="/patient/vitalsense/blood-glucose"
                    className="btn-primary"
                    style={{ textDecoration: 'none', fontSize: '0.825rem', padding: '8px 16px' }}
                  >
                    <span>Open Blood Glucose Portal</span>
                    <ChevronRight size={14} />
                  </Link>
                )}

                <Link
                  to="/patient/vitalsense"
                  className="btn-secondary"
                  style={{ textDecoration: 'none', fontSize: '0.825rem', padding: '8px 16px' }}
                >
                  <span>Full VitalSense Dashboard</span>
                </Link>

                {activeIndicator.status === 'urgent' && (
                  <Link
                    to="/patient/hospitals"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: 'white',
                      fontWeight: 600,
                      padding: '8px 16px',
                      borderRadius: 10,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.825rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      textDecoration: 'none',
                      boxShadow: '0 4px 14px rgba(239,68,68,0.4)',
                    }}
                  >
                    <AlertTriangle size={14} />
                    <span>Nearby Emergency Care</span>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              Select an anatomical hotspot to inspect recorded vitals telemetry.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
