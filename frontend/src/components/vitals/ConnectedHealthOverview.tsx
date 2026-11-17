import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Heart,
  Gauge,
  Droplet,
  Wind,
  Footprints,
  Moon,
  Thermometer,
  Cpu,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronRight,
  Info,
  TrendingUp,
  AlertCircle,
  Activity,
  CheckCircle2,
} from 'lucide-react'
import { api } from '@/lib/api'

interface TrendPoint {
  timestamp: string
  value: number
  secondary_value?: number | null
  source: string
}

interface VitalOverviewCardData {
  key: string
  title: string
  latest_value: number | null
  latest_secondary_value: number | null
  unit: string
  formatted_value: string
  timestamp: string | null
  formatted_timestamp: string
  source_device: string
  provenance: string
  status: 'normal' | 'attention' | 'urgent' | 'no_data'
  has_data: boolean
  trend: TrendPoint[]
  clinical_note?: string | null
}

interface VitalSenseOverviewResponse {
  title: string
  connected_device_count: number
  connected_devices_list: string[]
  synchronization_status: string
  last_updated_time: string | null
  formatted_last_updated: string
  cards: VitalOverviewCardData[]
  is_demo_active: boolean
}

const METRIC_ICONS: Record<string, React.ReactNode> = {
  heart_rate: <Heart className="w-5 h-5 text-rose-400" />,
  resting_heart_rate: <Activity className="w-5 h-5 text-orange-400" />,
  blood_pressure: <Gauge className="w-5 h-5 text-cyan-400" />,
  blood_glucose: <Droplet className="w-5 h-5 text-teal-400" />,
  spo2: <Wind className="w-5 h-5 text-blue-400" />,
  steps: <Footprints className="w-5 h-5 text-emerald-400" />,
  sleep_duration: <Moon className="w-5 h-5 text-indigo-400" />,
  respiratory_rate: <Wind className="w-5 h-5 text-purple-400" />,
  body_temperature: <Thermometer className="w-5 h-5 text-amber-400" />,
}

const METRIC_BORDER_ACCENTS: Record<string, string> = {
  heart_rate: 'hover:border-rose-500/40',
  resting_heart_rate: 'hover:border-orange-500/40',
  blood_pressure: 'hover:border-cyan-500/40',
  blood_glucose: 'hover:border-teal-500/40',
  spo2: 'hover:border-blue-500/40',
  steps: 'hover:border-emerald-500/40',
  sleep_duration: 'hover:border-indigo-500/40',
  respiratory_rate: 'hover:border-purple-500/40',
  body_temperature: 'hover:border-amber-500/40',
}

export function ConnectedHealthOverview() {
  const [data, setData] = useState<VitalSenseOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchOverview = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/device-station/vitalsense-overview')
      setData(res.data)
    } catch (err) {
      console.error('Failed to load connected health overview:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOverview()
  }, [])

  return (
    <div className="space-y-6">
      {/* Top Banner: Your Connected Health Overview */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 fill-cyan-400/30" />
                Live Wearable Telemetry
              </span>
              {data?.is_demo_active && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Synthetic Test Data
                </span>
              )}
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Your Connected Health Overview
            </h2>
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                Connected Devices:{' '}
                <strong className="text-slate-200">{data?.connected_device_count ?? 0} active</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Sync Status:{' '}
                <strong className="text-emerald-300">{data?.synchronization_status || 'Awaiting Device'}</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Last Updated:{' '}
                <strong className="text-slate-300">{data?.formatted_last_updated || 'Never'}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchOverview}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <Link
              to="/patient/devices"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/40 transition-all flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <Cpu className="w-3.5 h-3.5" />
              Manage in Device Station
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Connected devices badge chips */}
        {data && data.connected_devices_list.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium">Active Sources:</span>
            {data.connected_devices_list.map((devName) => (
              <span
                key={devName}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/80 text-cyan-300 border border-slate-700/80 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                {devName}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 9 Individual Measurement Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {data?.cards.map((card) => {
          const accentHover = METRIC_BORDER_ACCENTS[card.key] || 'hover:border-slate-700'
          const icon = METRIC_ICONS[card.key] || <Activity className="w-5 h-5 text-cyan-400" />

          return (
            <div
              key={card.key}
              className={`p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col justify-between transition-all duration-200 ${accentHover}`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 shadow-inner">
                      {icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{card.title}</h3>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="truncate max-w-[140px]">{card.source_device}</span>
                      </div>
                    </div>
                  </div>

                  {/* Provenance Badge */}
                  {card.has_data && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                        card.provenance === 'SIMULATED_DEMO'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {card.provenance === 'SIMULATED_DEMO' ? 'Demo Mode' : 'Verified Device'}
                    </span>
                  )}
                </div>

                {/* Value Body */}
                <div className="my-3">
                  {card.has_data ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
                        {card.formatted_value}
                      </span>
                      <span className="text-xs font-semibold text-slate-400 uppercase">
                        {card.unit}
                      </span>
                    </div>
                  ) : (
                    <div className="py-2">
                      <div className="text-sm font-semibold text-slate-500">No data available</div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Awaiting telemetry from Apple Health or Health Connect
                      </p>
                    </div>
                  )}
                </div>

                {/* Mini Historical Trend Chart (SVG Sparkline) */}
                {card.has_data && card.trend.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                      <span className="flex items-center gap-1 font-medium">
                        <TrendingUp className="w-3 h-3 text-cyan-400" />
                        7-Day Historical Trend
                      </span>
                      <span className="font-mono text-slate-500">{card.trend.length} samples</span>
                    </div>
                    {/* SVG Sparkline */}
                    <div className="h-10 w-full flex items-end">
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 30">
                        {(() => {
                          const vals = card.trend.map((t) => t.value)
                          const min = Math.min(...vals)
                          const max = Math.max(...vals)
                          const range = max - min || 1
                          const points = vals
                            .map((v, i) => {
                              const x = (i / (vals.length - 1)) * 100
                              const y = 28 - ((v - min) / range) * 24
                              return `${x},${y}`
                            })
                            .join(' ')
                          return (
                            <>
                              <polyline
                                fill="none"
                                stroke="rgba(6, 182, 212, 0.8)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={points}
                              />
                              {vals.map((v, i) => {
                                const x = (i / (vals.length - 1)) * 100
                                const y = 28 - ((v - min) / range) * 24
                                return (
                                  <circle
                                    key={i}
                                    cx={x}
                                    cy={y}
                                    r="2.5"
                                    className="fill-cyan-400"
                                  />
                                )
                              })}
                            </>
                          )
                        })()}
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Timestamp Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-[10px]">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {card.formatted_timestamp}
                </span>
                {!card.has_data && (
                  <Link
                    to="/patient/devices"
                    className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                  >
                    Connect <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
