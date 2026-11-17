import React, { useState, useEffect } from 'react'
import {
  Cpu,
  Activity,
  Heart,
  Smartphone,
  Watch,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Shield,
  Layers,
  Sparkles,
  QrCode,
  Sliders,
  Clock,
  Trash2,
  ChevronRight,
  Info,
  X,
  Play,
  ArrowRight,
  Bluetooth,
  Gauge,
  Droplet,
  Thermometer,
  Wind,
  Footprints,
  Moon,
} from 'lucide-react'
import { api } from '@/lib/api'
import { format } from 'date-fns'

interface PermissionItem {
  category: string
  label: string
  description: string
  is_granted: boolean
}

interface EcosystemStatus {
  integration_type: string
  name: string
  brand: string
  status: string
  is_connected: boolean
  last_synced_at: string | null
  supported_devices: string[]
  available_data_types: string[]
  device_id: string | null
  pairing_code: string | null
  qr_code_payload: string | null
  permissions: PermissionItem[]
}

interface DeviceStationSummary {
  patient_id: string
  patient_name: string
  ecosystems: EcosystemStatus[]
  is_demo_mode: boolean
  active_device_count: number
  last_overall_sync: string | null
}

interface SyncHistoryItem {
  id: string
  sync_source: string
  sync_status: string
  records_received: number
  records_synced: number
  records_skipped_duplicate: number
  error_message: string | null
  sync_started_at: string
  sync_completed_at: string | null
  client_info: string | null
}

export default function DeviceStation() {
  const [summary, setSummary] = useState<DeviceStationSummary | null>(null)
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingType, setSyncingType] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null)

  // Modals
  const [activeModal, setActiveModal] = useState<'apple' | 'android' | 'mobile' | 'demo' | null>(null)
  const [activeTab, setActiveTab] = useState<'ecosystems' | 'history' | 'mobile_guide'>('ecosystems')

  // Selected permissions for modal
  const [permissionToggles, setPermissionToggles] = useState<Record<string, boolean>>({
    heart_rate: true,
    resting_heart_rate: true,
    blood_pressure: true,
    blood_glucose: true,
    spo2: true,
    steps: true,
    sleep_duration: true,
    respiratory_rate: true,
    body_temperature: true,
  })

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/device-station/status')
      setSummary(res.data)
      const histRes = await api.get('/api/v1/device-station/sync-history')
      setSyncHistory(histRes.data || [])
    } catch (err) {
      console.error('Failed to load device station status:', err)
      setActionNotice({ type: 'error', message: 'Unable to communicate with the Device Station service.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleConnect = async (integrationType: string) => {
    try {
      setSyncingType(integrationType)
      const grantedList = Object.entries(permissionToggles)
        .filter(([_, granted]) => granted)
        .map(([cat]) => cat)

      await api.post('/api/v1/device-station/connect', {
        integration_type: integrationType,
        granted_categories: grantedList,
        client_platform: 'Web Companion',
      })

      setActionNotice({
        type: 'success',
        message: `Successfully connected ${integrationType.replace('_', ' ').toUpperCase()}. Synchronization initialized.`,
      })
      setActiveModal(null)
      fetchStatus()
    } catch (err) {
      setActionNotice({ type: 'error', message: 'Failed to complete connection. Please check network connection.' })
    } finally {
      setSyncingType(null)
    }
  }

  const handleDisconnect = async (integrationType: string) => {
    if (!confirm(`Are you sure you want to disconnect ${integrationType.replace('_', ' ')}?`)) return
    try {
      setSyncingType(integrationType)
      await api.post('/api/v1/device-station/disconnect', {
        integration_type: integrationType,
        revoke_permissions: false,
      })
      setActionNotice({
        type: 'info',
        message: `${integrationType.replace('_', ' ').toUpperCase()} has been disconnected.`,
      })
      fetchStatus()
    } catch (err) {
      setActionNotice({ type: 'error', message: 'Failed to disconnect integration.' })
    } finally {
      setSyncingType(null)
    }
  }

  const handleTriggerDemoSeed = async () => {
    try {
      setSyncingType('demo')
      const res = await api.post('/api/v1/device-station/demo-seed')
      setActionNotice({
        type: 'success',
        message: res.data.message || 'Synthetic test telemetry successfully generated across 9 metrics!',
      })
      setActiveModal(null)
      fetchStatus()
    } catch (err) {
      setActionNotice({ type: 'error', message: 'Failed to generate demo telemetry.' })
    } finally {
      setSyncingType(null)
    }
  }

  const handleClearDemoSeed = async () => {
    if (!confirm('Clear all synthetic demo measurements? Real device data will remain unaffected.')) return
    try {
      setSyncingType('demo')
      await api.delete('/api/v1/device-station/demo-seed')
      setActionNotice({ type: 'info', message: 'Demo telemetry cleared successfully.' })
      fetchStatus()
    } catch (err) {
      setActionNotice({ type: 'error', message: 'Failed to clear demo data.' })
    } finally {
      setSyncingType(null)
    }
  }

  const appleEcosystem = summary?.ecosystems.find((e) => e.integration_type === 'apple_health')
  const androidEcosystem = summary?.ecosystems.find((e) => e.integration_type === 'android_health_connect')
  const mobileEcosystem = summary?.ecosystems.find((e) => e.integration_type === 'medicare_mobile_app')

  return (
    <div className="space-y-6 pb-12 animate-fade-in text-slate-100">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-cyan-500/5 blur-3xl pointer-events-none" />
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              Device Station
            </span>
            {summary?.is_demo_mode && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Demo Testbench Active
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Connected Devices & Health Integrations
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Authorize Apple Health, Samsung Galaxy Watch, Android Health Connect, or your MediCare Mobile App to securely synchronize your vitals and smartwatch telemetry.
          </p>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setActiveModal('demo')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Hardware Simulator & Demo Data
          </button>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 transition-all cursor-pointer"
            title="Refresh device state"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications Alert */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
            actionNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : actionNotice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : actionNotice.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <Info className="w-4 h-4 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('ecosystems')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-2 ${
            activeTab === 'ecosystems'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Ecosystems & Smartwatches
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Clock className="w-4 h-4" />
          Synchronization History ({syncHistory.length})
        </button>
        <button
          onClick={() => setActiveTab('mobile_guide')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-2 ${
            activeTab === 'mobile_guide'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          Mobile App Pairing & QR
        </button>
      </div>

      {/* MAIN VIEW: Three Core Ecosystem Cards */}
      {activeTab === 'ecosystems' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 1. APPLE ECOSYSTEM */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
                  <Heart className="w-6 h-6 fill-rose-500/30" />
                </div>
                {appleEcosystem?.is_connected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    Disconnected
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Apple Ecosystem
              </h2>
              <p className="text-xs text-rose-300/80 font-medium mt-0.5">
                Apple Health & Apple Watch
              </p>

              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                Connect your iPhone and Apple Watch (Series 9, Ultra 2, SE) to stream verified heart rate, resting HR, SpO2, sleep architecture, and pedometry into MediCare VitalSense.
              </p>

              {/* Supported Devices List */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Watch className="w-3.5 h-3.5 text-cyan-400" />
                  Supported Hardware
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Apple Watch Ultra 2', 'Series 9', 'Series 8', 'Apple Watch SE', 'Apple HealthKit'].map((dev) => (
                    <span key={dev} className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 border border-slate-700/60">
                      {dev}
                    </span>
                  ))}
                </div>
              </div>

              {/* Available Data Types */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-rose-400" />
                  Available Health Data
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Heart Rate', 'Resting HR', 'SpO2', 'Daily Steps', 'Sleep Stages', 'Wrist Temp'].map((dt) => (
                    <span key={dt} className="px-2 py-0.5 rounded-md text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/20">
                      {dt}
                    </span>
                  ))}
                </div>
              </div>

              {/* Last Sync Info */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Last synchronization:</span>
                <span className="font-semibold text-slate-200">
                  {appleEcosystem?.last_synced_at
                    ? format(new Date(appleEcosystem.last_synced_at), 'MMM d, h:mm a')
                    : 'Never synced'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2">
              {appleEcosystem?.is_connected ? (
                <>
                  <button
                    onClick={() => handleDisconnect('apple_health')}
                    disabled={syncingType === 'apple_health'}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
                  >
                    Disconnect
                  </button>
                  <button
                    onClick={() => setActiveModal('apple')}
                    className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                    title="Manage Permissions"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setActiveModal('apple')}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white shadow-md shadow-rose-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer font-medium"
                >
                  <Heart className="w-4 h-4 fill-white" />
                  Connect Apple Health
                </button>
              )}
            </div>
          </div>

          {/* 2. ANDROID ECOSYSTEM */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                  <Activity className="w-6 h-6" />
                </div>
                {androidEcosystem?.is_connected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    Disconnected
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Android Ecosystem
              </h2>
              <p className="text-xs text-emerald-300/80 font-medium mt-0.5">
                Android Health Connect, Galaxy Watch & Wear OS
              </p>

              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                Connect Samsung Galaxy Watch 6, Google Pixel Watch 2, and Wear OS via Android Health Connect for continuous biometric tracking, sleep stages, and calibrated cardiovascular vitals.
              </p>

              {/* Supported Devices List */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Watch className="w-3.5 h-3.5 text-emerald-400" />
                  Supported Hardware
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Galaxy Watch 6', 'Galaxy Watch 5', 'Pixel Watch 2', 'OnePlus Watch 2', 'Wear OS 4'].map((dev) => (
                    <span key={dev} className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 border border-slate-700/60">
                      {dev}
                    </span>
                  ))}
                </div>
              </div>

              {/* Available Data Types */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-teal-400" />
                  Available Health Data
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Heart Rate', 'Resting HR', 'Blood Pressure (Calibrated)', 'SpO2', 'Daily Steps', 'Sleep Duration'].map((dt) => (
                    <span key={dt} className="px-2 py-0.5 rounded-md text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      {dt}
                    </span>
                  ))}
                </div>
              </div>

              {/* Last Sync Info */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Last synchronization:</span>
                <span className="font-semibold text-slate-200">
                  {androidEcosystem?.last_synced_at
                    ? format(new Date(androidEcosystem.last_synced_at), 'MMM d, h:mm a')
                    : 'Never synced'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2">
              {androidEcosystem?.is_connected ? (
                <>
                  <button
                    onClick={() => handleDisconnect('android_health_connect')}
                    disabled={syncingType === 'android_health_connect'}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
                  >
                    Disconnect
                  </button>
                  <button
                    onClick={() => setActiveModal('android')}
                    className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                    title="Manage Permissions"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setActiveModal('android')}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer font-medium"
                >
                  <Activity className="w-4 h-4" />
                  Connect Android Health
                </button>
              )}
            </div>
          </div>

          {/* 3. MEDICARE MOBILE APP */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
                  <Smartphone className="w-6 h-6" />
                </div>
                {mobileEcosystem?.is_connected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    Paired & Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    Ready to Pair
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                MediCare Mobile App
              </h2>
              <p className="text-xs text-cyan-300/80 font-medium mt-0.5">
                iOS & Android Companion Application
              </p>

              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                Install the React Native + Expo native companion on your smartphone. Connects directly to Apple Health and Health Connect while providing biometric passkeys and AI chat.
              </p>

              {/* Pairing Token Code */}
              <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Your Pairing Code</div>
                  <div className="text-sm font-mono font-bold text-cyan-300 tracking-wider">
                    {mobileEcosystem?.pairing_code || `MC-${summary?.patient_id.slice(0, 8).toUpperCase()}`}
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('mobile_guide')}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  View QR
                </button>
              </div>

              {/* Features List */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Companion Capabilities
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Background Wearable Sync', 'Push Vital Alerts', 'AI Clinical Assistant', 'Camera Rx Scanner'].map((cap) => (
                    <span key={cap} className="px-2 py-0.5 rounded-md text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* Status footer */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Account Synchronization:</span>
                <span className="font-semibold text-slate-200">
                  {summary?.patient_name || 'Active'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2">
              <button
                onClick={() => setActiveTab('mobile_guide')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                Mobile Pairing & Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Synchronization Audit History */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                Device Synchronization Audit Trail
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Every sync session with Apple HealthKit, Android Health Connect, and mobile clients is cryptographically recorded with deduplication counts.
              </p>
            </div>
            <button
              onClick={fetchStatus}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Logs
            </button>
          </div>

          {syncHistory.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-300">No synchronization sessions yet</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Connect Apple Health, Android Health Connect, or generate test measurements in Demo Mode to initiate synchronization.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Source Ecosystem</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Records Received</th>
                    <th className="py-3 px-4 font-semibold">New Synced</th>
                    <th className="py-3 px-4 font-semibold">Duplicates Skipped</th>
                    <th className="py-3 px-4 font-semibold">Client Agent</th>
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {syncHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-sans font-medium text-white flex items-center gap-2">
                        {item.sync_source.includes('apple') ? (
                          <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : item.sync_source.includes('android') ? (
                          <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        {item.sync_source.replace('_', ' ').toUpperCase()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans ${
                            item.sync_status === 'SUCCESS'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {item.sync_status}
                        </span>
                      </td>
                      <td className="py-3 px-4">{item.records_received}</td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">+{item.records_synced}</td>
                      <td className="py-3 px-4 text-slate-500">{item.records_skipped_duplicate}</td>
                      <td className="py-3 px-4 font-sans text-slate-400 truncate max-w-[180px]">
                        {item.client_info || 'Ingest Engine'}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-400">
                        {format(new Date(item.sync_started_at), 'MMM d, h:mm:ss a')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Mobile App Pairing & Instructions */}
      {activeTab === 'mobile_guide' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              MediCare Mobile Application
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              To connect your physical Apple Watch or Samsung Galaxy Watch, pair your mobile phone with MediCare AI. The native companion communicates with Apple HealthKit and Android Health Connect to automatically sync measurements.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Open Expo Go or the MediCare Mobile App</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Launch the mobile client on iOS (TestFlight / Expo) or Android.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Scan Patient Pairing QR</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Scan the QR code on the right, or enter your pairing code:{' '}
                    <span className="font-mono text-cyan-300 font-bold">
                      {mobileEcosystem?.pairing_code || `MC-${summary?.patient_id.slice(0, 8).toUpperCase()}`}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Authorize Apple Health or Health Connect</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Grant read permissions in iOS Settings or Android Health Connect to begin continuous synchronization.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <div className="p-4 bg-white rounded-2xl shadow-2xl mb-4 border border-slate-200">
              {/* Clean SVG QR Code Representation */}
              <svg className="w-48 h-48" viewBox="0 0 100 100" fill="none">
                <rect width="100" height="100" fill="white" />
                <path
                  d="M10 10h30v30H10zM15 15v20h20V15H15zm5 5h10v10H20zM60 10h30v30H60zM65 15v20h20V15H65zm5 5h10v10H70zM10 60h30v30H10zM15 65v20h20V65H15zm5 5h10v10H20zM45 10h10v10H45zM45 25h10v10H45zM45 40h10v20H45zM60 45h15v10H60zM80 45h10v10H80zM60 60h10v15H60zM75 60h15v10H75zM75 75h10v15H75zM60 80h10v10H60zM45 75h10v15H45z"
                  fill="#071120"
                />
                <circle cx="50" cy="50" r="6" fill="#0891b2" />
              </svg>
            </div>
            <div className="text-xs font-semibold text-white">Scan with MediCare Mobile</div>
            <div className="text-[11px] font-mono text-cyan-400 mt-1">
              {mobileEcosystem?.pairing_code || `MC-${summary?.patient_id.slice(0, 8).toUpperCase()}`}
            </div>
            <p className="text-[10px] text-slate-500 mt-2 max-w-xs">
              Linked to patient: {summary?.patient_name} ({summary?.patient_id})
            </p>
          </div>
        </div>
      )}

      {/* MODAL 1: Connect Apple Health Authorization */}
      {activeModal === 'apple' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" />
                <h3 className="text-base font-bold text-white">Connect Apple Health & Apple Watch</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              MediCare AI requires read access to Apple HealthKit on your paired iOS device. Select the health data categories you authorize MediCare AI to synchronize:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {[
                { cat: 'heart_rate', label: 'Heart Rate', desc: 'Realtime and active pulse readings (BPM)' },
                { cat: 'resting_heart_rate', label: 'Resting Heart Rate', desc: 'Cardiovascular resting baseline (BPM)' },
                { cat: 'spo2', label: 'Blood Oxygen (SpO2)', desc: 'Capillary oxygen saturation percentages' },
                { cat: 'steps', label: 'Daily Steps', desc: 'Pedometry and mobility activity count' },
                { cat: 'sleep_duration', label: 'Sleep Analysis', desc: 'Sleep duration and sleep stage classification' },
                { cat: 'respiratory_rate', label: 'Respiratory Rate', desc: 'Resting respiratory cycles (breaths/min)' },
                { cat: 'body_temperature', label: 'Wrist Temperature', desc: 'Skin temperature variations during sleep (°C)' },
              ].map((item) => (
                <label
                  key={item.cat}
                  className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={permissionToggles[item.cat] ?? true}
                    onChange={(e) =>
                      setPermissionToggles((prev) => ({ ...prev, [item.cat]: e.target.checked }))
                    }
                    className="mt-0.5 rounded text-cyan-500 focus:ring-cyan-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">{item.label}</div>
                    <div className="text-[10px] text-slate-400">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Web Browser Notice:</strong> Apple HealthKit APIs require native iOS execution. Authorizing below registers your consent on your MediCare AI account. You can complete native pairing through the MediCare iOS Companion app.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConnect('apple_health')}
                disabled={syncingType === 'apple_health'}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {syncingType === 'apple_health' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Authorize & Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Connect Android Health Connect Authorization */}
      {activeModal === 'android' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Connect Android Health Connect</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              MediCare AI will request permissions via Android Health Connect on your phone to synchronize smartwatch telemetry (Samsung Galaxy Watch & Wear OS). Select authorized metrics:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {[
                { cat: 'heart_rate', label: 'Heart Rate', desc: 'Realtime and resting pulse (BPM)' },
                { cat: 'blood_pressure', label: 'Blood Pressure', desc: 'Calibrated cuff / optical surrogate readings (mmHg)' },
                { cat: 'blood_glucose', label: 'Blood Glucose', desc: 'Continuous or fingerstick blood glucose (mg/dL)' },
                { cat: 'spo2', label: 'Blood Oxygen (SpO2)', desc: 'Capillary oxygen saturation percentages' },
                { cat: 'steps', label: 'Daily Steps', desc: 'Pedometry and mobility activity count' },
                { cat: 'sleep_duration', label: 'Sleep Stages', desc: 'Sleep duration and deep/REM cycles' },
                { cat: 'body_temperature', label: 'Body Temperature', desc: 'Skin temperature readings (°C)' },
              ].map((item) => (
                <label
                  key={item.cat}
                  className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={permissionToggles[item.cat] ?? true}
                    onChange={(e) =>
                      setPermissionToggles((prev) => ({ ...prev, [item.cat]: e.target.checked }))
                    }
                    className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">{item.label}</div>
                    <div className="text-[10px] text-slate-400">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Android Health Connect:</strong> Android 14 includes native Health Connect. For Android 9-13, the Health Connect app can be installed from Google Play.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConnect('android_health_connect')}
                disabled={syncingType === 'android_health_connect'}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {syncingType === 'android_health_connect' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Authorize & Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Hardware Simulator / Synthetic Demo Testbench */}
      {activeModal === 'demo' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Hardware Simulator & Demo Mode</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              If physical smartwatches (Apple Watch, Galaxy Watch) are unavailable in your development or evaluation environment, you can generate realistic, clinically labeled synthetic measurements across all 9 VitalSense metrics.
            </p>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
              <div className="font-semibold flex items-center gap-1">
                <Info className="w-4 h-4" />
                Synthetic Testbench Standards:
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-200/80 space-y-0.5">
                <li>Clearly labeled with provenance: <code>SIMULATED_DEMO</code></li>
                <li>Generates realistic 7-day trend history for all 9 metrics</li>
                <li>Uses SHA-256 idempotent hashes to test duplicate prevention</li>
                <li>Can be safely cleared at any time with one click</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              {summary?.is_demo_mode && (
                <button
                  onClick={handleClearDemoSeed}
                  disabled={syncingType === 'demo'}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Demo Data
                </button>
              )}
              <button
                onClick={handleTriggerDemoSeed}
                disabled={syncingType === 'demo'}
                className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {syncingType === 'demo' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white" />
                )}
                Generate 7-Day Test Wearable Telemetry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
