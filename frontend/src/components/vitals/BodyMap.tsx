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
  Sparkles,
  FlaskConical,
  FileText,
  Download,
  Plus,
} from 'lucide-react'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { DigitalTwinHUD } from './DigitalTwinHUD'

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
  const [viewMode, setViewMode] = useState<'standard' | 'digital_twin'>('standard')

  const fetchBodyMap = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/vitals/body-map', {
        params: patientId ? { patient_id: patientId } : {},
      })
      setData(res.data)
      if (res.data?.indicators) {
        // Prioritize selecting urgent or attention system if present
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

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'urgent':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
            Urgent Review
          </span>
        )
      case 'attention':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Attention State
          </span>
        )
      case 'normal':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            Within Target Band
          </span>
        )
      case 'stale':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
            Stale Telemetry (&gt;7d)
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-slate-800 text-slate-500 border border-slate-700">
            No Telemetry Recorded
          </span>
        )
    }
  }

  const getStatusColorTokens = (status?: string) => {
    switch (status) {
      case 'urgent':
        return { text: '#f43f5e', bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.4)', dot: '#f43f5e' }
      case 'attention':
        return { text: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', dot: '#f59e0b' }
      case 'normal':
        return { text: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', dot: '#10b981' }
      default:
        return { text: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)', dot: '#64748b' }
    }
  }

  const getSystemIcon = (system: string) => {
    switch (system) {
      case 'cardiovascular':
        return <Activity size={18} className="text-teal-400" />
      case 'heart':
        return <Heart size={18} className="text-rose-400" />
      case 'metabolic':
        return <Droplet size={18} className="text-cyan-400" />
      case 'respiratory':
        return <Wind size={18} className="text-blue-400" />
      case 'biometrics':
        return <Scale size={18} className="text-amber-400" />
      default:
        return <Activity size={18} className="text-slate-400" />
    }
  }

  const indicators = data?.indicators || {}
  const activeIndicator: BodyMapIndicator | undefined = indicators[selectedSystem]
  const activeTokens = getStatusColorTokens(activeIndicator?.status)

  // Hotspot coordinates on the SVG coordinate system (300 x 440)
  const hotspots: Record<string, { x: number; y: number; label: string; side: 'left' | 'right' }> = {
    heart: { x: 158, y: 142, label: 'Cardiac', side: 'right' },
    cardiovascular: { x: 88, y: 185, label: 'Blood Pressure', side: 'left' },
    metabolic: { x: 145, y: 220, label: 'Blood Glucose', side: 'right' },
    respiratory: { x: 135, y: 130, label: 'Respiratory', side: 'left' },
    biometrics: { x: 150, y: 285, label: 'Body Mass', side: 'right' },
  }

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/90 shadow-xl overflow-hidden p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-teal-400" />
            <h2 className="text-base font-bold text-white tracking-wide">
              Patient Body Map &amp; Anatomical Status
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Interactive physiological model reflecting recorded numerical telemetry across body systems.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950/80 border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('standard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'standard'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Anatomical Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode('digital_twin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'digital_twin'
                  ? 'bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity size={13} className="text-cyan-400" />
              <span>Diagnostics HUD</span>
            </button>
          </div>

          <button
            onClick={fetchBodyMap}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-teal-400' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {viewMode === 'digital_twin' ? (
        <DigitalTwinHUD />
      ) : (
        <>

      {/* Mandatory Clinical Transparency Disclaimer */}
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
        <Info size={15} className="text-teal-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-200">Educational Anatomical Model:</strong> This graphic visualizes verified clinical records (Home cuff, fingerstick strips, Bluetooth monitors, or test records) mapped to physiological organ regions. This is an educational numerical visualizer — <em>not</em> an optical body scan, radiological image, or diagnostic procedure. Organ status reflects only direct metrics recorded for that system.
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Anatomical SVG Silhouette (5 cols on lg) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5 flex flex-col items-center justify-center relative shadow-inner">
          {/* Status legend chips */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-4 text-[11px] font-mono">
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Target Band
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Attention
            </span>
            <span className="inline-flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-400" /> Urgent
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-600" /> No Data
            </span>
          </div>

          {/* SVG Canvas Container */}
          <div className="relative w-64 h-96">
            <svg
              viewBox="0 0 300 440"
              className="w-full h-full drop-shadow-2xl"
              aria-label="Interactive anatomical body map"
            >
              <defs>
                <linearGradient id="bodyMesh" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="50%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#020617" />
                </linearGradient>
                <radialGradient id="urgentPulse" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Grid Lines */}
              <pattern id="bodyGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
              </pattern>
              <rect width="300" height="440" fill="url(#bodyGrid)" />

              {/* Head */}
              <ellipse cx="150" cy="52" rx="28" ry="34" fill="url(#bodyMesh)" stroke="rgba(56,189,248,0.25)" strokeWidth="1.5" />
              {/* Neck */}
              <rect x="142" y="85" width="16" height="18" rx="4" fill="url(#bodyMesh)" stroke="rgba(56,189,248,0.25)" strokeWidth="1.5" />

              {/* Torso & Shoulders */}
              <path
                d="M 100 102 C 120 98, 180 98, 200 102 C 220 108, 224 135, 220 170 L 210 240 C 205 255, 195 265, 182 270 L 118 270 C 105 265, 95 255, 90 240 L 80 170 C 76 135, 80 108, 100 102 Z"
                fill="url(#bodyMesh)"
                stroke="rgba(56,189,248,0.28)"
                strokeWidth="1.5"
              />

              {/* Arms */}
              <path
                d="M 80 115 C 68 140, 58 175, 52 215 C 48 240, 44 265, 42 285 C 40 295, 46 300, 52 298 C 58 295, 66 270, 70 240 L 76 180"
                fill="none"
                stroke="rgba(56,189,248,0.25)"
                strokeWidth="13"
                strokeLinecap="round"
              />
              <path
                d="M 220 115 C 232 140, 242 175, 248 215 C 252 240, 256 265, 258 285 C 260 295, 254 300, 248 298 C 242 295, 234 270, 230 240 L 224 180"
                fill="none"
                stroke="rgba(56,189,248,0.25)"
                strokeWidth="13"
                strokeLinecap="round"
              />

              {/* Hips & Pelvis */}
              <path
                d="M 118 270 L 182 270 C 195 272, 202 288, 198 305 L 192 315 L 108 315 L 102 305 C 98 288, 105 272, 118 270 Z"
                fill="url(#bodyMesh)"
                stroke="rgba(56,189,248,0.22)"
                strokeWidth="1.5"
              />

              {/* Legs */}
              <path
                d="M 112 315 L 108 370 C 106 395, 104 415, 102 430"
                fill="none"
                stroke="rgba(56,189,248,0.22)"
                strokeWidth="15"
                strokeLinecap="round"
              />
              <path
                d="M 188 315 L 192 370 C 194 395, 196 415, 198 430"
                fill="none"
                stroke="rgba(56,189,248,0.22)"
                strokeWidth="15"
                strokeLinecap="round"
              />

              {/* Vascular pathways */}
              <path
                d="M 150 90 L 150 240 M 150 145 L 88 185 M 150 145 L 210 185"
                fill="none"
                stroke="rgba(45,212,191,0.2)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Callout Lines */}
              {Object.entries(hotspots).map(([key, spot]) => {
                const ind = indicators[key]
                const colorTokens = getStatusColorTokens(ind?.status)
                const isSelected = selectedSystem === key
                return (
                  <line
                    key={`line-${key}`}
                    x1={spot.x}
                    y1={spot.y}
                    x2={spot.side === 'left' ? 24 : 276}
                    y2={spot.y}
                    stroke={isSelected ? colorTokens.text : 'rgba(148,163,184,0.25)'}
                    strokeWidth={isSelected ? 1.5 : 0.75}
                    strokeDasharray={isSelected ? 'none' : '2 2'}
                  />
                )
              })}

              {/* Interactive Hotspot Nodes */}
              {Object.entries(hotspots).map(([key, spot]) => {
                const ind = indicators[key]
                const colorTokens = getStatusColorTokens(ind?.status)
                const isSelected = selectedSystem === key
                const isUrgent = ind?.status === 'urgent'

                return (
                  <g
                    key={`node-${key}`}
                    onClick={() => setSelectedSystem(key)}
                    className="cursor-pointer"
                  >
                    {isUrgent && (
                      <circle cx={spot.x} cy={spot.y} r={22} fill="url(#urgentPulse)">
                        <animate attributeName="r" values="14;26;14" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {isSelected && (
                      <circle
                        cx={spot.x}
                        cy={spot.y}
                        r={16}
                        fill="none"
                        stroke={colorTokens.text}
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      />
                    )}

                    <circle
                      cx={spot.x}
                      cy={spot.y}
                      r={10}
                      fill={colorTokens.bg}
                      stroke={colorTokens.border}
                      strokeWidth="2"
                    />

                    <circle cx={spot.x} cy={spot.y} r={4.5} fill={colorTokens.dot} />
                  </g>
                )
              })}
            </svg>

            {/* Clickable Floating Side Labels */}
            {Object.entries(hotspots).map(([key, spot]) => {
              const ind = indicators[key]
              const colorTokens = getStatusColorTokens(ind?.status)
              const isSelected = selectedSystem === key

              return (
                <button
                  key={`btn-${key}`}
                  onClick={() => setSelectedSystem(key)}
                  className={`absolute -translate-y-1/2 px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer z-10 ${
                    spot.side === 'left' ? '-left-2' : '-right-2'
                  } ${
                    isSelected
                      ? 'bg-slate-800 text-white border border-teal-500/50 shadow-md shadow-teal-500/10'
                      : 'bg-slate-900/90 text-slate-300 border border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                  style={{ top: spot.y }}
                >
                  {spot.label}
                </button>
              )
            })}
          </div>

          <span className="text-[11px] text-slate-500 text-center mt-3">
            Click any anatomical node to inspect recorded physiological records.
          </span>
        </div>

        {/* Right: Detailed Organ Status Drawer (7 cols on lg) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6 flex flex-col justify-between shadow-xl space-y-5">
          {activeIndicator ? (
            <div className="space-y-5">
              {/* Top Drawer Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border"
                    style={{ backgroundColor: activeTokens.bg, borderColor: activeTokens.border }}
                  >
                    {getSystemIcon(selectedSystem)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-wide">
                      {activeIndicator.label}
                    </h3>
                    <span className="text-xs text-slate-400 capitalize">
                      Physiological System: {activeIndicator.system_name}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {getStatusBadge(activeIndicator.status)}
                  <span className="text-[10px] text-slate-500 font-mono">
                    {activeIndicator.history_count} total measurements logged
                  </span>
                </div>
              </div>

              {/* Metric & Value Panel or Empty State */}
              {activeIndicator.latest_value != null ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Latest Telemetry Card */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Latest Recorded Telemetry
                    </span>
                    <div className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-2xl font-extrabold text-white">
                        {activeIndicator.latest_value}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {activeIndicator.latest_unit}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-slate-500" />
                        {activeIndicator.recorded_at
                          ? format(new Date(activeIndicator.recorded_at), 'MMM d, h:mm a')
                          : 'Recorded'}
                      </span>
                      <span className="text-slate-400 capitalize">
                        Trend: {activeIndicator.trend.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Provenance Card */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                        Measurement Provenance
                      </span>
                      <div>
                        {activeIndicator.is_sample ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <FlaskConical size={10} /> DEMO DATA
                          </span>
                        ) : activeIndicator.measurement_source?.includes('device') ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <ShieldCheck size={10} /> REAL DEVICE DATA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            <FileText size={10} /> Manual Entry — Not Device Verified
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono">
                      Attribution: {activeIndicator.measurement_source || 'Manual patient input'}
                    </span>
                  </div>
                </div>
              ) : (
                /* Empty state for this organ */
                <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 text-center space-y-2.5">
                  <div className="w-9 h-9 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                    <Activity size={18} />
                  </div>
                  <p className="text-xs font-semibold text-slate-300">
                    No Telemetry Recorded for {activeIndicator.label}
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Log a measurement using Mode B (Manual Entry) or connect a compatible medical monitor to populate this physiological indicator.
                  </p>
                </div>
              )}

              {/* Clinical Summary */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
                <span className="font-semibold text-white block">
                  Guideline Interpretation &amp; Physiological Scope
                </span>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {activeIndicator.clinical_summary}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              Select an anatomical region on the body silhouette to inspect recorded metrics.
            </div>
          )}

          {/* Drawer Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 text-[10px] italic">
              Organ status evaluated from recorded parameters • Not an optical scan
            </span>

            {onLogClick && (
              <button
                onClick={() => onLogClick(activeIndicator?.measurement_type || 'bp')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold cursor-pointer transition-colors"
              >
                <Plus size={13} />
                <span>Log {activeIndicator?.label || 'Reading'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  )
}
