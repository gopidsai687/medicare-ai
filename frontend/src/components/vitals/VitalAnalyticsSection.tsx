import React, { useState, useMemo } from 'react'
import {
  Calendar,
  Filter,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Info,
  CheckCircle2,
  ShieldAlert,
  Heart,
  Droplets,
  Activity,
  Scale,
  FileSpreadsheet,
  FileJson,
  Layers,
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
import { format } from 'date-fns'

export interface AnalyticsVitalRecord {
  id: string
  recorded_at: string
  systolic_bp?: number | null
  diastolic_bp?: number | null
  heart_rate?: number | null
  blood_glucose?: number | null
  blood_glucose_mmol?: number | null
  weight?: number | null
  measurement_source: string
  is_sample: boolean
  notes?: string | null
  bp_category?: string | null
  glucose_category?: string | null
  mean_arterial_pressure?: number | null
}

export interface VitalAnalyticsSectionProps {
  vitals: AnalyticsVitalRecord[]
  timeFilterDays: number
  onTimeFilterChange: (days: number) => void
  provenanceFilter: 'all' | 'actual' | 'manual' | 'device' | 'demo'
  onProvenanceFilterChange: (filter: 'all' | 'actual' | 'manual' | 'device' | 'demo') => void
  onExport: (format: 'csv' | 'json') => void
  trendAnalysis?: any
  analyzingTrends?: boolean
  onRunTrendAnalysis?: () => void
}

export const VitalAnalyticsSection: React.FC<VitalAnalyticsSectionProps> = ({
  vitals = [],
  timeFilterDays,
  onTimeFilterChange,
  provenanceFilter,
  onProvenanceFilterChange,
  onExport,
  trendAnalysis,
  analyzingTrends = false,
  onRunTrendAnalysis,
}) => {
  const [activeMetricTab, setActiveMetricTab] = useState<'overview' | 'bp' | 'glucose' | 'hr' | 'weight'>('overview')

  // Filter vitals by provenance
  const filteredByProvenance = useMemo(() => {
    return vitals.filter((v) => {
      if (provenanceFilter === 'actual') return !v.is_sample
      if (provenanceFilter === 'demo') return v.is_sample
      if (provenanceFilter === 'manual') return !v.is_sample && v.measurement_source?.startsWith('manual')
      if (provenanceFilter === 'device')
        return (
          !v.is_sample &&
          (v.measurement_source === 'measured_device' ||
            v.measurement_source?.includes('ble') ||
            v.measurement_source === 'omron_connect' ||
            v.measurement_source === 'dexcom_cgm')
        )
      return true
    })
  }, [vitals, provenanceFilter])

  // Filter vitals by time window (days)
  const filteredData = useMemo(() => {
    if (timeFilterDays <= 0) return filteredByProvenance
    const cutoff = Date.now() - timeFilterDays * 24 * 60 * 60 * 1000
    return filteredByProvenance.filter((v) => new Date(v.recorded_at).getTime() >= cutoff)
  }, [filteredByProvenance, timeFilterDays])

  // Format Recharts data (chronological)
  const chartPoints = useMemo(() => {
    return [...filteredData]
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .map((v) => ({
        timestamp: v.recorded_at,
        date: format(new Date(v.recorded_at), timeFilterDays <= 2 ? 'HH:mm' : 'MM/dd HH:mm'),
        fullDate: format(new Date(v.recorded_at), 'yyyy-MM-dd HH:mm'),
        systolic: v.systolic_bp != null ? v.systolic_bp : null,
        diastolic: v.diastolic_bp != null ? v.diastolic_bp : null,
        glucose: v.blood_glucose != null ? v.blood_glucose : null,
        heartRate: v.heart_rate != null ? v.heart_rate : null,
        weight: v.weight != null ? v.weight : null,
        source: v.measurement_source,
        isSample: v.is_sample,
      }))
  }, [filteredData, timeFilterDays])

  // Summary statistics
  const stats = useMemo(() => {
    const bpReadings = filteredData.filter((v) => v.systolic_bp != null && v.diastolic_bp != null)
    const glucoseReadings = filteredData.filter((v) => v.blood_glucose != null)
    const hrReadings = filteredData.filter((v) => v.heart_rate != null)

    const avgSys =
      bpReadings.length > 0
        ? Math.round(bpReadings.reduce((sum, v) => sum + v.systolic_bp!, 0) / bpReadings.length)
        : null
    const avgDia =
      bpReadings.length > 0
        ? Math.round(bpReadings.reduce((sum, v) => sum + v.diastolic_bp!, 0) / bpReadings.length)
        : null

    const avgMap =
      avgSys && avgDia ? Math.round(avgDia + (avgSys - avgDia) / 3) : null

    const avgGlu =
      glucoseReadings.length > 0
        ? Math.round(glucoseReadings.reduce((sum, v) => sum + v.blood_glucose!, 0) / glucoseReadings.length)
        : null

    const tirCount = glucoseReadings.filter(
      (v) => v.blood_glucose! >= 70 && v.blood_glucose! <= 180
    ).length
    const tirPercent =
      glucoseReadings.length > 0 ? Math.round((tirCount / glucoseReadings.length) * 100) : null

    const avgHr =
      hrReadings.length > 0
        ? Math.round(hrReadings.reduce((sum, v) => sum + v.heart_rate!, 0) / hrReadings.length)
        : null

    return {
      total: filteredData.length,
      avgSys,
      avgDia,
      avgMap,
      avgGlu,
      tirPercent,
      avgHr,
    }
  }, [filteredData])

  // Custom Dark Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null
    const pt = payload[0]?.payload
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md text-xs space-y-1.5 z-50">
        <div className="font-mono text-slate-400 text-[11px] pb-1 border-b border-slate-800">
          {pt?.fullDate || label}
        </div>
        {payload.map((item: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4 font-mono">
            <span style={{ color: item.color }} className="font-semibold">
              {item.name}:
            </span>
            <span className="font-bold text-white">
              {item.value} {item.name.includes('Pressure') ? 'mmHg' : item.name.includes('Glucose') ? 'mg/dL' : item.name.includes('Heart') ? 'bpm' : 'kg'}
            </span>
          </div>
        ))}
        {pt?.source && (
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
            Source: <span className="font-mono text-slate-300">{pt.source}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/90 shadow-xl overflow-hidden space-y-6 p-6">
      {/* Analytics Header & Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-teal-400" />
            <h2 className="text-base font-bold text-white tracking-wide">
              Longitudinal Clinical Analytics &amp; Trends
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            High-fidelity trend visualization, guideline reference target bands, and statistical telemetry summaries.
          </p>
        </div>

        {/* Global Toolbar: Time Window & Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Window Buttons */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <span className="px-2 text-slate-500 flex items-center gap-1 text-[11px]">
              <Calendar size={12} /> Range:
            </span>
            {[
              { label: '24H', days: 1 },
              { label: '7D', days: 7 },
              { label: '30D', days: 30 },
              { label: '90D', days: 90 },
              { label: 'All', days: 0 },
            ].map((opt) => (
              <button
                key={opt.days}
                onClick={() => onTimeFilterChange(opt.days)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  timeFilterDays === opt.days
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onExport('csv')}
              title="Export CSV"
              className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-xs flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet size={13} className="text-teal-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => onExport('json')}
              title="Export JSON"
              className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-xs flex items-center gap-1 cursor-pointer"
            >
              <FileJson size={13} className="text-cyan-400" />
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Controls: Metric Tabs & Provenance Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Metric Selector Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'overview', label: 'All Telemetry' },
            { id: 'bp', label: 'Blood Pressure' },
            { id: 'glucose', label: 'Blood Glucose' },
            { id: 'hr', label: 'Heart Rate' },
            { id: 'weight', label: 'Weight' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveMetricTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeMetricTab === tab.id
                  ? 'bg-slate-800 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Provenance Filter */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Filter size={13} className="text-teal-400" />
          <span>Source:</span>
          <select
            value={provenanceFilter}
            onChange={(e) => onProvenanceFilterChange(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
          >
            <option value="all">All Data Sources</option>
            <option value="actual">Genuine Patient Records (Real &amp; Manual)</option>
            <option value="manual">Manual Entry Only</option>
            <option value="device">Real Medical Devices Only</option>
            <option value="demo">Demo Data Only</option>
          </select>
        </div>
      </div>

      {/* Statistical Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">Total Ingested</span>
          <span className="text-lg font-bold text-white font-mono">{stats.total}</span>
          <span className="text-[10px] text-slate-500 block">entries in window</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">Average BP</span>
          <span className="text-lg font-bold text-teal-400 font-mono">
            {stats.avgSys ? `${stats.avgSys}/${stats.avgDia}` : '--'}
          </span>
          <span className="text-[10px] text-slate-500 block">mmHg</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">Mean Art. Pressure</span>
          <span className="text-lg font-bold text-cyan-400 font-mono">
            {stats.avgMap ? `${stats.avgMap}` : '--'}
          </span>
          <span className="text-[10px] text-slate-500 block">mmHg (MAP)</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">Average Glucose</span>
          <span className="text-lg font-bold text-emerald-400 font-mono">
            {stats.avgGlu ? `${stats.avgGlu}` : '--'}
          </span>
          <span className="text-[10px] text-slate-500 block">mg/dL</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">Glucose TIR (70-180)</span>
          <span className="text-lg font-bold text-emerald-400 font-mono">
            {stats.tirPercent != null ? `${stats.tirPercent}%` : '--'}
          </span>
          <span className="text-[10px] text-slate-500 block">ADA Time in Range</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">Resting Pulse</span>
          <span className="text-lg font-bold text-rose-400 font-mono">
            {stats.avgHr ? `${stats.avgHr}` : '--'}
          </span>
          <span className="text-[10px] text-slate-500 block">bpm average</span>
        </div>
      </div>

      {/* Main Interactive Charts Grid */}
      <div className="space-y-6">
        {/* Blood Pressure Chart */}
        {(activeMetricTab === 'overview' || activeMetricTab === 'bp') && (
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart size={15} className="text-teal-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Blood Pressure Trajectory (mmHg)
                </h3>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  AHA 2017 Guidelines (Normal &lt;120/80)
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Systolic
                </span>
                <span className="flex items-center gap-1.5 text-teal-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" /> Diastolic
                </span>
              </div>
            </div>

            <div className="h-64">
              {chartPoints.filter((p) => p.systolic != null).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartPoints.filter((p) => p.systolic != null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis domain={[50, 195]} stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip />} />
                    {/* AHA Standard Guidelines reference lines */}
                    <ReferenceLine
                      y={120}
                      stroke="#10b981"
                      strokeDasharray="3 3"
                      label={{ value: 'AHA SBP 120 Target', fill: '#10b981', fontSize: 10, position: 'insideTopLeft' }}
                    />
                    <ReferenceLine
                      y={80}
                      stroke="#10b981"
                      strokeDasharray="3 3"
                      label={{ value: 'AHA DBP 80 Target', fill: '#10b981', fontSize: 10, position: 'insideBottomLeft' }}
                    />
                    <Line
                      type="monotone"
                      name="Systolic"
                      dataKey="systolic"
                      stroke="#38bdf8"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#38bdf8' }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      name="Diastolic"
                      dataKey="diastolic"
                      stroke="#14b8a6"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#14b8a6' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No blood pressure measurements recorded in this time range.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Blood Glucose Chart */}
        {(activeMetricTab === 'overview' || activeMetricTab === 'glucose') && (
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplets size={15} className="text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Glycemic Control &amp; Blood Glucose (mg/dL)
                </h3>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  ADA Target Window: 70 - 180 mg/dL
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Target: <span className="text-emerald-400 font-bold">70 – 180 mg/dL</span>
              </div>
            </div>

            <div className="h-64">
              {chartPoints.filter((p) => p.glucose != null).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartPoints.filter((p) => p.glucose != null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis domain={[40, 240]} stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip />} />
                    {/* ADA Target Band */}
                    <ReferenceArea y1={70} y2={180} fill="rgba(16, 185, 129, 0.06)" />
                    <ReferenceLine
                      y={70}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      label={{ value: 'Hypo Threshold 70', fill: '#ef4444', fontSize: 10, position: 'insideBottomLeft' }}
                    />
                    <ReferenceLine
                      y={100}
                      stroke="#10b981"
                      strokeDasharray="2 2"
                      label={{ value: 'Normal Fasting <100', fill: '#10b981', fontSize: 10, position: 'insideTopLeft' }}
                    />
                    <ReferenceLine
                      y={180}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      label={{ value: 'Hyperglycemia Threshold 180', fill: '#f59e0b', fontSize: 10, position: 'insideTopLeft' }}
                    />
                    <Line
                      type="monotone"
                      name="Blood Glucose"
                      dataKey="glucose"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#06b6d4' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No blood glucose measurements recorded in this time range.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pulse & Weight Charts */}
        {(activeMetricTab === 'overview' || activeMetricTab === 'hr' || activeMetricTab === 'weight') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Heart Rate */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={15} className="text-rose-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Resting Heart Rate (bpm)
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">Normal 60 - 100</span>
              </div>
              <div className="h-52">
                {chartPoints.filter((p) => p.heartRate != null).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartPoints.filter((p) => p.heartRate != null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis domain={[40, 140]} stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceArea y1={60} y2={100} fill="rgba(251, 113, 133, 0.05)" />
                      <Line
                        type="monotone"
                        name="Heart Rate"
                        dataKey="heartRate"
                        stroke="#fb7185"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#fb7185' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                    No pulse readings recorded in this range.
                  </div>
                )}
              </div>
            </div>

            {/* Body Weight */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale size={15} className="text-amber-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Body Weight Trajectory (kg)
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">Calibrated Scale</span>
              </div>
              <div className="h-52">
                {chartPoints.filter((p) => p.weight != null).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartPoints.filter((p) => p.weight != null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis domain={['dataMin - 3', 'dataMax + 3']} stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        name="Weight"
                        dataKey="weight"
                        stroke="#fbbf24"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#fbbf24' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                    No weight records logged in this range.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Health Trend Analyzer Integration */}
      <div className="p-5 rounded-xl border border-teal-500/20 bg-slate-950/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-teal-400" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Grounded Clinical Trend Assessment
              </h3>
              <p className="text-[11px] text-slate-400">
                Statistical interpretation of longitudinal telemetry with physician preparation questions.
              </p>
            </div>
          </div>

          {onRunTrendAnalysis && (
            <button
              onClick={onRunTrendAnalysis}
              disabled={analyzingTrends}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={analyzingTrends ? 'animate-spin' : ''} />
              <span>{analyzingTrends ? 'Evaluating Telemetry...' : 'Run Trend Assessment'}</span>
            </button>
          )}
        </div>

        {trendAnalysis ? (
          <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 leading-relaxed whitespace-pre-line">
              {trendAnalysis.trend_explanation}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {trendAnalysis.observations?.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <h4 className="font-semibold text-teal-300 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Documented Observations
                  </h4>
                  <ul className="space-y-1 text-slate-400 list-disc list-inside">
                    {trendAnalysis.observations.map((obs: string, idx: number) => (
                      <li key={idx}>{obs}</li>
                    ))}
                  </ul>
                </div>
              )}

              {trendAnalysis.suggested_doctor_questions?.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <h4 className="font-semibold text-cyan-300 mb-1.5 flex items-center gap-1.5">
                    <Info size={13} /> Questions to Discuss With Your Doctor
                  </h4>
                  <ul className="space-y-1 text-slate-400 list-disc list-inside">
                    {trendAnalysis.suggested_doctor_questions.map((q: string, idx: number) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {trendAnalysis.clinical_safety_notice && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
                <ShieldAlert size={14} className="text-amber-400 shrink-0" />
                <span>{trendAnalysis.clinical_safety_notice}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-2 text-[11px] text-slate-500">
            Click "Run Trend Assessment" to evaluate trends over the selected {timeFilterDays > 0 ? `${timeFilterDays}-day` : 'complete'} time window.
          </div>
        )}
      </div>
    </div>
  )
}
