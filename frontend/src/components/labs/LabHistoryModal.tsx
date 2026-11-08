import React, { useState, useEffect } from 'react'
import {
  X,
  Clock,
  TrendingUp,
  Activity,
  Calendar,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  Home,
  FlaskConical,
  Cpu,
} from 'lucide-react'
import api from '@/lib/api'

interface TrendPoint {
  id: string
  test_name: string
  date: string
  measurement_time?: string
  value: number
  unit: string
  repeat_value?: number
  repeat_time?: string
  device_name?: string
  status: string
  source: string
  result_type?: string
  is_amended?: boolean
  amendment_reason?: string
  orderedBy?: string
  notes?: string
}

interface TrendData {
  test_name: string
  result_type?: string
  unit: string
  range_min: number
  range_max: number
  reference_range?: string
  educational_notice?: string
  points: TrendPoint[]
}

interface AuditEvent {
  id: string
  lab_result_id: string
  test_name: string
  unit: string
  action: string
  performed_by_name: string
  reason?: string
  previous_value?: string
  new_value?: string
  timestamp: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onRestored?: () => void
  initialBiomarker?: string
}

const BIOMARKER_PRESETS = [
  { label: '🧪 HbA1c (Certified Venipuncture, %)', query: 'HbA1c', type: 'lab_result' },
  { label: '🧪 Fasting Plasma Glucose (CMP, mg/dL)', query: 'Fasting Plasma Glucose', type: 'lab_result' },
  { label: '🏠 Home Fasting Glucose (Fingerstick, mg/dL)', query: 'Blood Glucose (Fasting Fingerstick)', type: 'home_monitoring' },
  { label: '🧪 Total Cholesterol (Lipid Panel, mg/dL)', query: 'Total Cholesterol', type: 'lab_result' },
  { label: '🧪 Serum Creatinine (Kidney Panel, mg/dL)', query: 'Serum Creatinine', type: 'lab_result' },
]

export const LabHistoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onRestored,
  initialBiomarker = 'HbA1c',
}) => {
  const [activeTab, setActiveTab] = useState<'trends' | 'audit'>('trends')
  const [selectedBiomarker, setSelectedBiomarker] = useState(initialBiomarker)
  const [selectedResultType, setSelectedResultType] = useState<string>('all')
  const [trendData, setTrendData] = useState<TrendData | null>(null)
  const [isLoadingTrends, setIsLoadingTrends] = useState(false)

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [isLoadingAudit, setIsLoadingAudit] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadTrends(selectedBiomarker, selectedResultType)
      loadAuditLog()
    }
  }, [isOpen, selectedBiomarker, selectedResultType])

  const loadTrends = async (biomarker: string, rType: string = 'all') => {
    setIsLoadingTrends(true)
    try {
      const params = rType !== 'all' ? `?result_type=${encodeURIComponent(rType)}` : ''
      const res = await api.get(`/api/v1/labs/trends/${encodeURIComponent(biomarker)}${params}`)
      setTrendData(res.data)
    } catch (err) {
      console.warn('Failed to fetch biomarker trends:', err)
    } finally {
      setIsLoadingTrends(false)
    }
  }

  const loadAuditLog = async () => {
    setIsLoadingAudit(true)
    try {
      const res = await api.get('/api/v1/labs/history')
      setAuditEvents(res.data)
    } catch (err) {
      console.warn('Failed to fetch audit log:', err)
    } finally {
      setIsLoadingAudit(false)
    }
  }

  const handleRestore = async (labResultId: string) => {
    setRestoringId(labResultId)
    try {
      await api.patch(`/api/v1/labs/results/${labResultId}/restore`)
      await loadAuditLog()
      await loadTrends(selectedBiomarker, selectedResultType)
      if (onRestored) onRestored()
    } catch (err) {
      console.warn('Failed to restore result:', err)
    } finally {
      setRestoringId(null)
    }
  }

  if (!isOpen) return null

  // Calculate SVG dimensions for the trend chart
  const points = trendData?.points || []
  const values = points.map((p) => p.value)
  const rMin = trendData?.range_min ?? 0
  const rMax = trendData?.range_max ?? 10
  const minVal = values.length > 0 ? Math.min(...values, rMin) * 0.9 : 0
  const maxVal = values.length > 0 ? Math.max(...values, rMax) * 1.1 : 10
  const valRange = maxVal - minVal || 1

  const chartW = 550
  const chartH = 190
  const padX = 45
  const padY = 25

  const getX = (idx: number) => {
    if (points.length <= 1) return chartW / 2
    return padX + (idx / (points.length - 1)) * (chartW - padX * 2)
  }

  const getY = (v: number) => {
    return chartH - padY - ((v - minVal) / valRange) * (chartH - padY * 2)
  }

  const svgPath = points.map((p, i) => `${getX(i)},${getY(p.value)}`).join(' ')

  const isHomeMonitoring = trendData?.result_type === 'home_monitoring' || (trendData?.test_name || '').toLowerCase().includes('fingerstick')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl p-6 md:p-8 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Diagnostic Laboratory &amp; Telemetry History</h3>
              <p className="text-xs text-slate-400">Segregated biomarker trajectories, original vs repeat readings, and legal audit trail</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-800/80 pb-2">
          <button
            onClick={() => setActiveTab('trends')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'trends'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Biomarker Trajectory Charts
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Audit &amp; Legal Activity Trail ({auditEvents.length})
          </button>
        </div>

        {/* Tab 1: Biomarker Trends */}
        {activeTab === 'trends' && (
          <div className="space-y-4">
            {/* Biomarker Selector Pills (Requirement 7: Do not combine different measurement types) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-slate-400 font-semibold">Select Segregated Biomarker Series:</span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Certified Labs &amp; Home Telemetry plotted on distinct series
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {BIOMARKER_PRESETS.map((b) => (
                  <button
                    key={b.query}
                    onClick={() => {
                      setSelectedBiomarker(b.query)
                      setSelectedResultType(b.type)
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedBiomarker === b.query
                        ? b.type === 'home_monitoring'
                          ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                          : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingTrends ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                Loading chronological trend data...
              </div>
            ) : points.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs bg-slate-950/60 rounded-2xl border border-slate-800">
                No historical readings found for {selectedBiomarker}.
              </div>
            ) : (
              <div className="space-y-4">
                {/* SVG Line Chart Box */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 relative space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {isHomeMonitoring ? <Home size={15} className="text-cyan-400" /> : <FlaskConical size={15} className="text-emerald-400" />}
                        {trendData?.test_name} Chronological Trajectory
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Target Interval: {trendData?.reference_range || `${trendData?.range_min} – ${trendData?.range_max} ${trendData?.unit}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                        isHomeMonitoring ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {isHomeMonitoring ? 'Home Telemetry Series' : 'Certified Diagnostic Series'}
                      </span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Unit: {trendData?.unit}
                      </span>
                    </div>
                  </div>

                  {/* SVG Chart */}
                  <div className="w-full overflow-x-auto">
                    <svg
                      viewBox={`0 0 ${chartW} ${chartH}`}
                      className="w-full h-48 overflow-visible"
                    >
                      {/* Normal Green Zone Shading */}
                      {trendData?.range_min !== undefined && trendData?.range_max !== undefined && (
                        <rect
                          x={padX}
                          y={getY(trendData.range_max)}
                          width={chartW - padX * 2}
                          height={Math.max(4, getY(trendData.range_min) - getY(trendData.range_max))}
                          fill="#10b981"
                          fillOpacity={0.08}
                          rx={4}
                        />
                      )}

                      {/* Reference line labels */}
                      {trendData?.range_max !== undefined && (
                        <line
                          x1={padX}
                          y1={getY(trendData.range_max)}
                          x2={chartW - padX}
                          y2={getY(trendData.range_max)}
                          stroke="#10b981"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                          strokeOpacity={0.4}
                        />
                      )}

                      {/* Line Plot */}
                      <polyline
                        fill="none"
                        stroke={isHomeMonitoring ? '#06b6d4' : '#38bdf8'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={svgPath}
                      />

                      {/* Data Point Dots & Labels */}
                      {points.map((p, idx) => {
                        const cx = getX(idx)
                        const cy = getY(p.value)
                        return (
                          <g key={p.id}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={5}
                              className={`${isHomeMonitoring ? 'fill-cyan-400' : 'fill-blue-500'} stroke-[#0b1527] stroke-2 hover:r-7 transition-all cursor-pointer`}
                            />
                            <text
                              x={cx}
                              y={cy - 10}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="10"
                              fontWeight="bold"
                            >
                              {p.value} {p.unit}
                            </text>
                            <text
                              x={cx}
                              y={chartH - 6}
                              textAnchor="middle"
                              fill="#94a3b8"
                              fontSize="9"
                            >
                              {p.measurement_time ? `${p.date} ${p.measurement_time}` : p.date}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>

                  {/* Educational Clinical Disclaimer Notice (Requirement 8) */}
                  {trendData?.educational_notice && (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                      <AlertCircle size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                      <span>{trendData.educational_notice}</span>
                    </div>
                  )}
                </div>

                {/* Data Points Breakdown Table (Requirement 2 & 7: Original, Repeat, Device, Source) */}
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Measurement Date &amp; Time</th>
                        <th className="py-2.5 px-3">Analyte Reading</th>
                        <th className="py-2.5 px-3">Repeat Verification</th>
                        <th className="py-2.5 px-3">Device / Laboratory</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-medium">
                      {points.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-slate-200">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              <span>{p.date}</span>
                              {p.measurement_time && (
                                <span className="text-slate-400 font-mono text-[11px]">
                                  • {p.measurement_time}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-white">
                            {p.value} {p.unit}
                            {p.is_amended && (
                              <span className="ml-1.5 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20" title={p.amendment_reason}>
                                Amended
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[11px]">
                            {p.repeat_value !== undefined && p.repeat_value !== null ? (
                              <div className="flex items-center gap-1.5 text-cyan-300 font-mono">
                                <RotateCcw size={11} className="text-cyan-400" />
                                <span>{p.repeat_value} {p.unit}</span>
                                {p.repeat_time && <span className="text-slate-400 text-[10px]">({p.repeat_time})</span>}
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                            <div className="flex items-center gap-1">
                              {p.result_type === 'home_monitoring' ? (
                                <Cpu size={12} className="text-cyan-400 shrink-0" />
                              ) : (
                                <FlaskConical size={12} className="text-emerald-400 shrink-0" />
                              )}
                              <span>{p.device_name || p.orderedBy || 'Clinical Facility'}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              p.status === 'Normal'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Audit Trail */}
        {activeTab === 'audit' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-blue-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                Immutable legal audit trail tracks all record creation, amendments, deduplication consolidations, and archival actions.
              </span>
            </div>

            {isLoadingAudit ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                Loading audit trail...
              </div>
            ) : auditEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs bg-slate-950/60 rounded-2xl border border-slate-800">
                No audit events recorded yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {auditEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                            evt.action === 'created'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : evt.action === 'amended'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                              : evt.action === 'consolidated_duplicate'
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                              : evt.action === 'archived'
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                              : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                          }`}
                        >
                          {evt.action.replace('_', ' ')}
                        </span>
                        <span className="font-bold text-white">{evt.test_name}</span>
                        <span className="text-[11px] text-slate-500">
                          by {evt.performed_by_name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        {evt.previous_value && (
                          <span className="line-through text-slate-500 mr-2">{evt.previous_value}</span>
                        )}
                        <span className="font-semibold text-emerald-300">{evt.new_value}</span>
                      </div>
                      {evt.reason && (
                        <p className="text-[11px] text-slate-400 italic">
                          Reason: {evt.reason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                      {evt.action === 'archived' && (
                        <button
                          onClick={() => handleRestore(evt.lab_result_id)}
                          disabled={restoringId === evt.lab_result_id}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <RotateCcw size={11} /> Restore
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
