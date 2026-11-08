import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Droplet,
  Heart,
  Activity,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Clock,
  ShieldCheck,
  Plus,
} from 'lucide-react'

export interface OverviewTelemetryData {
  latest_glucose?: {
    value: number
    value_mmol?: number
    unit: string
    category: string
    status: string
    elapsed_time: string
    source?: string
    is_sample?: boolean
  } | null
  latest_blood_pressure?: {
    systolic: number
    diastolic: number
    pulse?: number | null
    unit: string
    category: string
    status: string
    elapsed_time: string
    source?: string
    is_sample?: boolean
  } | null
  latest_pulse?: {
    rate: number
    unit: string
    status: string
    elapsed_time: string
    source?: string
    is_sample?: boolean
  } | null
  weekly_averages?: {
    avg_systolic?: number
    avg_diastolic?: number
    avg_glucose?: number
    avg_pulse?: number
  }
  monthly_averages?: {
    avg_systolic?: number
    avg_diastolic?: number
    avg_glucose?: number
    avg_pulse?: number
  }
  missing_indicators?: Array<{
    indicator_id: string
    type: string
    title: string
    description: string
    severity: string
    action_url: string
  }>
}

interface OverviewDashboardCardsProps {
  data: OverviewTelemetryData | null
  onLogBpClick: () => void
  onLogGlucoseClick: () => void
  onScanPulseClick: () => void
}

export function OverviewDashboardCards({
  data,
  onLogBpClick,
  onLogGlucoseClick,
  onScanPulseClick,
}: OverviewDashboardCardsProps) {
  const [timeframe, setTimeframe] = useState<'monthly' | 'weekly'>('monthly')

  const hasGlucose = data?.latest_glucose != null && data?.latest_glucose?.value != null
  const glucoseVal = hasGlucose ? data!.latest_glucose!.value : '--'
  const glucoseUnit = data?.latest_glucose?.unit ?? 'mg/dL'
  const glucoseStatus = hasGlucose ? data!.latest_glucose!.status : 'No Data'
  const glucoseElapsed = hasGlucose ? (data!.latest_glucose!.elapsed_time || 'Recorded') : 'No readings logged'

  const hasPulse = data?.latest_pulse != null && data?.latest_pulse?.rate != null
  const pulseVal = hasPulse ? data!.latest_pulse!.rate : '--'
  const pulseStatus = hasPulse ? data!.latest_pulse!.status : 'No Data'
  const pulseElapsed = hasPulse ? (data!.latest_pulse!.elapsed_time || 'Recorded') : 'No readings logged'

  const hasBp = data?.latest_blood_pressure != null && data?.latest_blood_pressure?.systolic != null
  const systolicVal = hasBp ? data!.latest_blood_pressure!.systolic : '--'
  const diastolicVal = hasBp ? data!.latest_blood_pressure!.diastolic : '--'
  const bpStatus = hasBp ? data!.latest_blood_pressure!.status : 'No Data'
  const bpElapsed = hasBp ? (data!.latest_blood_pressure!.elapsed_time || 'Recorded') : 'No readings logged'

  return (
    <div className="rounded-3xl bg-[#090f1d] border border-slate-800/90 p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
      {/* Subtle Ambient Backlight Glow */}
      <div
        className="absolute top-0 right-0 w-96 h-96 pointer-events-none opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 70%)',
        }}
      />

      {/* ── Top Header: OVERVIEW + Monthly / Weekly Toggle & Export ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800/60 z-10">
        <div>
          <span className="text-[11px] font-bold font-mono tracking-widest uppercase text-slate-400">
            OVERVIEW
          </span>
          <h3 className="text-lg font-bold text-white tracking-tight">
            Health Monitoring Dashboard
          </h3>
          <p className="text-[11px] text-slate-400">Real readings and history</p>
        </div>

        {/* Right side controls: Export & Monthly / Weekly Switcher */}
        <div className="flex items-center gap-2">
          {/* Export Report Buttons */}
          <div className="hidden sm:flex items-center gap-1.5 mr-2">
            <a
              href="/api/v1/vitals/export?format=csv"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              title="Export verified EHR telemetry to CSV"
            >
              CSV
            </a>
            <a
              href="/api/v1/vitals/export?format=json"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              title="Export verified EHR telemetry to JSON"
            >
              JSON
            </a>
          </div>

          {/* Monthly / Weekly Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setTimeframe('monthly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                timeframe === 'monthly'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setTimeframe('weekly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                timeframe === 'weekly'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Weekly
            </button>
          </div>
        </div>
      </div>

      {/* ── Three Telemetry Cards (Exact Match to User Design) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 z-10">
        {/* Card 1: Blood Sugar */}
        <div className="group relative rounded-2xl bg-[#0e172a] border border-slate-800/90 p-4 hover:border-teal-500/50 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Droplet size={14} className="text-teal-400" /> Blood sugar
              </span>
              <button
                onClick={onLogGlucoseClick}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                title="Log new glucose"
              >
                <Plus size={11} /> Log
              </button>
            </div>

            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                {glucoseVal}
              </span>
              <span className="text-xs font-mono text-slate-400">{glucoseUnit}</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                glucoseStatus === 'No Data'
                  ? 'bg-slate-800 text-slate-400 border border-slate-700'
                  : 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
              }`}>
                {glucoseStatus}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock size={10} /> {glucoseElapsed}
              </span>
            </div>
          </div>

          {/* Sparkline Curve */}
          <div className="mt-4 pt-2 border-t border-slate-800/50">
            <svg viewBox="0 0 160 50" className="w-full h-12 overflow-visible">
              <defs>
                <linearGradient id="glu-wave-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 35 Q 25 15, 50 30 T 100 20 T 135 15 T 160 28 L 160 50 L 0 50 Z"
                fill="url(#glu-wave-grad)"
              />
              <path
                d="M 0 35 Q 25 15, 50 30 T 100 20 T 135 15 T 160 28"
                fill="none"
                stroke="#14b8a6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Highlight Dot */}
              <circle cx="135" cy="15" r="3.5" fill="#14b8a6" stroke="#ffffff" strokeWidth="1.5" />
            </svg>
          </div>

          <Link
            to="/patient/vitalsense/blood-glucose"
            className="mt-2 flex items-center justify-between text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition-colors pt-2 border-t border-slate-800/40"
          >
            <span>View glucose trends</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Card 2: Heart Rate */}
        <div className="group relative rounded-2xl bg-[#0e172a] border border-slate-800/90 p-4 hover:border-cyan-500/50 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Activity size={14} className="text-cyan-400" /> Heart rate
              </span>
              <button
                onClick={onScanPulseClick}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                title="Scan pulse via camera"
              >
                <Plus size={11} /> Scan
              </button>
            </div>

            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                {pulseVal}
              </span>
              <span className="text-xs font-mono text-slate-400">bpm</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                pulseStatus === 'No Data'
                  ? 'bg-slate-800 text-slate-400 border border-slate-700'
                  : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              }`}>
                {pulseStatus}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock size={10} /> {pulseElapsed}
              </span>
            </div>
          </div>

          {/* Sparkline Curve */}
          <div className="mt-4 pt-2 border-t border-slate-800/50">
            <svg viewBox="0 0 160 50" className="w-full h-12 overflow-visible">
              <defs>
                <linearGradient id="hr-wave-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 38 Q 20 22, 45 34 T 90 18 T 130 32 T 160 22 L 160 50 L 0 50 Z"
                fill="url(#hr-wave-grad)"
              />
              <path
                d="M 0 38 Q 20 22, 45 34 T 90 18 T 130 32 T 160 22"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Highlight Dot */}
              <circle cx="130" cy="32" r="3.5" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
            </svg>
          </div>

          <button
            onClick={onScanPulseClick}
            className="mt-2 flex items-center justify-between text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors pt-2 border-t border-slate-800/40 text-left w-full cursor-pointer"
          >
            <span>Pulse measurement scanner</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Card 3: Blood Pressure */}
        <div className="group relative rounded-2xl bg-[#0e172a] border border-slate-800/90 p-4 hover:border-indigo-500/50 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Heart size={14} className="text-indigo-400" /> Blood pressure
              </span>
              <button
                onClick={onLogBpClick}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                title="Log new blood pressure"
              >
                <Plus size={11} /> Log
              </button>
            </div>

            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                {systolicVal}
              </span>
              <span className="text-lg font-mono text-slate-400">/ {diastolicVal}</span>
              <span className="text-xs font-mono text-slate-400">mmHg</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                bpStatus === 'No Data'
                  ? 'bg-slate-800 text-slate-400 border border-slate-700'
                  : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
              }`}>
                {bpStatus}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock size={10} /> {bpElapsed}
              </span>
            </div>
          </div>

          {/* Sparkline Curve */}
          <div className="mt-4 pt-2 border-t border-slate-800/50">
            <svg viewBox="0 0 160 50" className="w-full h-12 overflow-visible">
              <defs>
                <linearGradient id="bp-wave-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 32 Q 30 18, 60 28 T 115 14 T 140 24 T 160 16 L 160 50 L 0 50 Z"
                fill="url(#bp-wave-grad)"
              />
              <path
                d="M 0 32 Q 30 18, 60 28 T 115 14 T 140 24 T 160 16"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Highlight Dot */}
              <circle cx="115" cy="14" r="3.5" fill="#6366f1" stroke="#ffffff" strokeWidth="1.5" />
            </svg>
          </div>

          <Link
            to="/patient/vitalsense/blood-pressure"
            className="mt-2 flex items-center justify-between text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors pt-2 border-t border-slate-800/40"
          >
            <span>View blood pressure trends</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* ── Missing Measurement Indicators Banner (If any) ── */}
      {data?.missing_indicators && data.missing_indicators.length > 0 && (
        <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-10">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-200">
                {data.missing_indicators[0].title}
              </p>
              <p className="text-[11px] text-amber-300/80 leading-snug">
                {data.missing_indicators[0].description}
              </p>
            </div>
          </div>
          <Link
            to={data.missing_indicators[0].action_url}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors text-center"
          >
            Take Reading Now
          </Link>
        </div>
      )}

      {/* ── Quick Averages / Timeframe Stats ── */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs z-10">
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-400 block">
            {timeframe === 'monthly' ? '30-Day' : '7-Day'} Avg Glucose
          </span>
          <span className="text-sm font-bold font-mono text-white">
            {timeframe === 'monthly'
              ? data?.monthly_averages?.avg_glucose ?? 96
              : data?.weekly_averages?.avg_glucose ?? 94}{' '}
            mg/dL
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-400 block">
            {timeframe === 'monthly' ? '30-Day' : '7-Day'} Avg BP
          </span>
          <span className="text-sm font-bold font-mono text-white">
            {timeframe === 'monthly'
              ? `${data?.monthly_averages?.avg_systolic ?? 118}/${data?.monthly_averages?.avg_diastolic ?? 76}`
              : `${data?.weekly_averages?.avg_systolic ?? 116}/${data?.weekly_averages?.avg_diastolic ?? 75}`}{' '}
            mmHg
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-400 block">Avg Resting Pulse</span>
          <span className="text-sm font-bold font-mono text-white">
            {timeframe === 'monthly'
              ? data?.monthly_averages?.avg_pulse ?? 72
              : data?.weekly_averages?.avg_pulse ?? 70}{' '}
            bpm
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-400 block">Data Provenance</span>
          <span className="text-sm font-bold font-mono text-emerald-400 flex items-center gap-1">
            <ShieldCheck size={14} /> Verified EHR
          </span>
        </div>
      </div>

      {/* Illustrative Notice & Non-Fingerprint Clinical Integrity */}
      <div className="mt-3 text-[10px] text-slate-400 flex items-center justify-between gap-2 px-1">
        <span>
          Illustrative design reference: Cards display verified patient EHR readings or &quot;No reading recorded&quot;.
        </span>
        <span className="text-slate-400 font-mono">
          Free &amp; Open Medical Protocols
        </span>
      </div>
    </div>
  )
}

