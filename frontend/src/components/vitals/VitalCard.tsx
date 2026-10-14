import React from 'react'
import {
  Heart,
  Droplets,
  Activity,
  Scale,
  Clock,
  AlertTriangle,
  ChevronRight,
  Plus,
  ShieldCheck,
  Download,
  FlaskConical,
  FileText,
} from 'lucide-react'
import { format } from 'date-fns'

export interface VitalCardProps {
  type: 'bp' | 'glucose' | 'hr' | 'weight'
  title: string
  subtitle?: string
  value?: string | number | null
  unit: string
  secondaryValue?: string | null
  secondaryUnit?: string | null
  recordedAt?: string | null
  statusBadge?: React.ReactNode
  source?: string | null
  isSample?: boolean
  deviceName?: string | null
  historyPoints?: { date: string; value: number }[]
  onLogClick: () => void
  onHistoryClick?: () => void
  emptyTitle: string
  emptyDescription: string
  guidelineNote?: string
}

export const VitalCard: React.FC<VitalCardProps> = ({
  type,
  title,
  subtitle,
  value,
  unit,
  secondaryValue,
  secondaryUnit,
  recordedAt,
  statusBadge,
  source = 'manual_entry',
  isSample = false,
  deviceName,
  historyPoints = [],
  onLogClick,
  onHistoryClick,
  emptyTitle,
  emptyDescription,
  guidelineNote,
}) => {
  // Determine card accent styles
  const getAccent = () => {
    switch (type) {
      case 'bp':
        return {
          icon: <Heart size={18} className="text-teal-400" />,
          iconBg: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
          hoverBorder: 'hover:border-teal-500/40',
          sparkColor: '#14b8a6',
          btnBg: 'bg-teal-600 hover:bg-teal-500',
        }
      case 'glucose':
        return {
          icon: <Droplets size={18} className="text-cyan-400" />,
          iconBg: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
          hoverBorder: 'hover:border-cyan-500/40',
          sparkColor: '#06b6d4',
          btnBg: 'bg-cyan-600 hover:bg-cyan-500',
        }
      case 'hr':
        return {
          icon: <Activity size={18} className="text-rose-400" />,
          iconBg: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
          hoverBorder: 'hover:border-rose-500/40',
          sparkColor: '#fb7185',
          btnBg: 'bg-rose-600 hover:bg-rose-500',
        }
      case 'weight':
        return {
          icon: <Scale size={18} className="text-amber-400" />,
          iconBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
          hoverBorder: 'hover:border-amber-500/40',
          sparkColor: '#f59e0b',
          btnBg: 'bg-amber-600 hover:bg-amber-500',
        }
    }
  }

  const accent = getAccent()

  // Format Provenance Badge
  const renderSourceBadge = () => {
    if (isSample || source === 'SAMPLE_DATA' || source === 'sample_data') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <FlaskConical size={10} /> DEMO DATA
        </span>
      )
    }
    if (
      source === 'measured_device' ||
      source === 'omron_connect' ||
      source === 'dexcom_cgm' ||
      source?.includes('ble')
    ) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <ShieldCheck size={10} /> REAL DEVICE
        </span>
      )
    }
    if (
      source === 'apple_health' ||
      source === 'google_health_connect' ||
      source === 'ehr_import' ||
      source === 'import'
    ) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          <Download size={10} /> IMPORTED
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
        <FileText size={10} /> Manual Entry — Not Device Verified
      </span>
    )
  }

  // Check if reading is stale (> 24 hours)
  const isStale = recordedAt
    ? Date.now() - new Date(recordedAt).getTime() > 24 * 60 * 60 * 1000
    : false

  // Render SVG Sparkline if 2+ data points exist
  const renderSparkline = () => {
    if (!historyPoints || historyPoints.length < 2) return null

    const validPoints = historyPoints.filter((p) => p.value != null && !isNaN(p.value))
    if (validPoints.length < 2) return null

    const values = validPoints.map((p) => p.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1

    const width = 120
    const height = 34
    const padding = 4

    const points = values
      .map((val, idx) => {
        const x = padding + (idx / (values.length - 1)) * (width - 2 * padding)
        const y = height - padding - ((val - min) / range) * (height - 2 * padding)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

    return (
      <div className="flex flex-col items-end">
        <svg
          width={width}
          height={height}
          className="overflow-visible"
          aria-label="Recent measurement trend trajectory"
        >
          <title>Recent measurement trend trajectory</title>
          <polyline
            fill="none"
            stroke={accent.sparkColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
          {values.length > 0 && (
            <circle
              cx={width - padding}
              cy={height - padding - ((values[values.length - 1] - min) / range) * (height - 2 * padding)}
              r="3"
              fill={accent.sparkColor}
            />
          )}
        </svg>
        <span className="text-[9px] text-slate-500 font-mono mt-0.5">
          {values.length} readings trend
        </span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl border border-slate-800/80 bg-slate-900/90 p-5 flex flex-col justify-between shadow-lg shadow-black/20 transition-all ${accent.hoverBorder}`}
    >
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent.iconBg}`}>
              {accent.icon}
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {title}
              </h3>
              {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
            </div>
          </div>

          <button
            onClick={onLogClick}
            title={`Log ${title}`}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Value Area or Empty State */}
        {value != null ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                  {value}
                </span>
                <span className="text-xs font-semibold text-slate-400">{unit}</span>
                {secondaryValue && (
                  <span className="text-xs font-mono text-teal-400/90 ml-1">
                    ({secondaryValue} {secondaryUnit})
                  </span>
                )}
              </div>

              {/* Sparkline */}
              {renderSparkline()}
            </div>

            {/* Status Badges & Category */}
            <div className="flex flex-wrap items-center gap-1.5">
              {statusBadge}
              {renderSourceBadge()}
              {isStale && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  <AlertTriangle size={10} /> &gt;24h Old
                </span>
              )}
            </div>

            {/* Metadata Timestamp & Device */}
            <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate max-w-[150px]">
                {deviceName || (source?.startsWith('manual') ? 'Manual Log' : 'Pneumatic / Sensor')}
              </span>
              {recordedAt && (
                <span className="flex items-center gap-1 font-mono text-slate-400">
                  <Clock size={11} className="text-slate-500" />
                  {format(new Date(recordedAt), 'MMM d, h:mm a')}
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="py-5 px-1 text-center space-y-2.5">
            <p className="text-xs font-semibold text-slate-300">{emptyTitle}</p>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
              {emptyDescription}
            </p>
            <button
              onClick={onLogClick}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-md cursor-pointer ${accent.btnBg}`}
            >
              <Plus size={13} /> Log Measurement
            </button>
          </div>
        )}
      </div>

      {/* Card Footer: Clinical Guideline & Navigation */}
      <div className="mt-4 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
        <span className="text-slate-500 italic text-[10px] truncate max-w-[180px]">
          {guidelineNote || 'Informational guidance • Not a clinical diagnosis'}
        </span>
        {onHistoryClick && (
          <button
            onClick={onHistoryClick}
            className="text-teal-400 hover:text-teal-300 font-medium inline-flex items-center gap-0.5 cursor-pointer transition-colors"
          >
            History <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
