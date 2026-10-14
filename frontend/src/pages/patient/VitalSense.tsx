import React, { useState, useEffect, useMemo } from 'react'
import {
  Heart,
  Droplets,
  Activity,
  Scale,
  Cpu,
  Bell,
  Share2,
  Camera,
  Calendar,
  Filter,
  Download,
  Plus,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  FlaskConical,
  FileText,
  Clock,
  ChevronDown,
  Layers,
  Edit2,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { BodyMap } from '@/components/vitals/BodyMap'
import { TestModeConsole } from '@/components/vitals/TestModeConsole'
import { WebcamPulseModal } from '@/components/vitals/WebcamPulseModal'
import { VitalCard } from '@/components/vitals/VitalCard'
import { VitalAlertsCenter, VitalAlertItem, VitalReminderItem } from '@/components/vitals/VitalAlertsCenter'
import { VitalAnalyticsSection } from '@/components/vitals/VitalAnalyticsSection'
import { VitalHistoryTable, VitalLogRecord } from '@/components/vitals/VitalHistoryTable'
import {
  LogBpModal,
  LogGlucoseModal,
  LogOtherVitalsModal,
} from '@/components/vitals/LogVitalsModals'
import { DeviceConnectModal } from '@/components/vitals/DeviceConnectModal'
import { RemindersConsentModal, SharingConsentItem } from '@/components/vitals/RemindersConsentModal'

export interface VitalSignRecord {
  id: string
  patient_id: string
  recorded_at: string
  systolic_bp?: number | null
  diastolic_bp?: number | null
  heart_rate?: number | null
  blood_glucose?: number | null
  blood_glucose_mmol?: number | null
  glucose_unit: string
  glucose_context?: string | null
  weight?: number | null
  height?: number | null
  measurement_source: string
  device_name?: string | null
  notes?: string | null
  clinical_notes?: string | null
  is_patient_entered: boolean
  is_sample: boolean
  bp_category?: string | null
  glucose_category?: string | null
  mean_arterial_pressure?: number | null
}

export default function VitalSense() {
  // Data State
  const [vitals, setVitals] = useState<VitalSignRecord[]>([])
  const [alerts, setAlerts] = useState<VitalAlertItem[]>([])
  const [reminders, setReminders] = useState<VitalReminderItem[]>([])
  const [consents, setConsents] = useState<SharingConsentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Filters State
  const [timeFilterDays, setTimeFilterDays] = useState<number>(30)
  const [provenanceFilter, setProvenanceFilter] = useState<'all' | 'actual' | 'manual' | 'device' | 'demo'>('all')

  // Modals Visibility
  const [showBpModal, setShowBpModal] = useState(false)
  const [showGlucoseModal, setShowGlucoseModal] = useState(false)
  const [showOtherVitalsModal, setShowOtherVitalsModal] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [showRemindersModal, setShowRemindersModal] = useState(false)
  const [showWebcamModal, setShowWebcamModal] = useState(false)

  // Edit Vital Modal State
  const [editingVital, setEditingVital] = useState<VitalSignRecord | null>(null)
  const [editSystolic, setEditSystolic] = useState('')
  const [editDiastolic, setEditDiastolic] = useState('')
  const [editGlucose, setEditGlucose] = useState('')
  const [editHeartRate, setEditHeartRate] = useState('')
  const [editWeight, setEditWeight] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // AI Trend Analysis State
  const [trendAnalysis, setTrendAnalysis] = useState<any>(null)
  const [analyzingTrends, setAnalyzingTrends] = useState(false)

  // Active Device State
  const [pairedDeviceName, setPairedDeviceName] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------
  const fetchVitals = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/vitals/history', {
        params: { limit: 100 },
      })
      if (Array.isArray(res.data)) {
        setVitals(res.data)
      }
    } catch (err) {
      console.error('Failed to load vitals telemetry:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/api/v1/vitals/alerts')
      if (Array.isArray(res.data)) {
        setAlerts(res.data)
      }
    } catch (err) {
      console.error('Failed to load clinical alerts:', err)
    }
  }

  const fetchReminders = async () => {
    try {
      const res = await api.get('/api/v1/vitals/reminders')
      if (Array.isArray(res.data)) {
        setReminders(res.data)
      }
    } catch (err) {
      console.error('Failed to load reminders:', err)
    }
  }

  const fetchConsents = async () => {
    try {
      const res = await api.get('/api/v1/vitals/consent')
      if (Array.isArray(res.data)) {
        setConsents(res.data)
      }
    } catch (err) {
      console.error('Failed to load sharing consents:', err)
    }
  }

  useEffect(() => {
    fetchVitals()
    fetchAlerts()
    fetchReminders()
    fetchConsents()
  }, [refreshKey])

  // ---------------------------------------------------------------------------
  // Metrics & Latest Values
  // ---------------------------------------------------------------------------
  // Separate genuine patient records from demo data
  const actualVitals = useMemo(() => vitals.filter((v) => !v.is_sample), [vitals])
  const demoVitals = useMemo(() => vitals.filter((v) => v.is_sample), [vitals])

  // Active dataset based on provenance selection
  const activeDataset = useMemo(() => {
    if (provenanceFilter === 'actual') return actualVitals
    if (provenanceFilter === 'demo') return demoVitals
    if (provenanceFilter === 'manual') return actualVitals.filter((v) => v.measurement_source?.startsWith('manual'))
    if (provenanceFilter === 'device')
      return actualVitals.filter(
        (v) =>
          v.measurement_source === 'measured_device' ||
          v.measurement_source?.includes('ble') ||
          v.measurement_source === 'omron_connect' ||
          v.measurement_source === 'dexcom_cgm'
      )
    return vitals
  }, [vitals, actualVitals, demoVitals, provenanceFilter])

  // Latest measurements (prioritize genuine patient readings unless viewing demo filter)
  const latestBp = useMemo(() => {
    const list = provenanceFilter === 'demo' ? demoVitals : (actualVitals.length ? actualVitals : vitals)
    return list.find((v) => v.systolic_bp != null && v.diastolic_bp != null)
  }, [actualVitals, demoVitals, vitals, provenanceFilter])

  const latestGlucose = useMemo(() => {
    const list = provenanceFilter === 'demo' ? demoVitals : (actualVitals.length ? actualVitals : vitals)
    return list.find((v) => v.blood_glucose != null)
  }, [actualVitals, demoVitals, vitals, provenanceFilter])

  const latestHeartRate = useMemo(() => {
    const list = provenanceFilter === 'demo' ? demoVitals : (actualVitals.length ? actualVitals : vitals)
    return list.find((v) => v.heart_rate != null)
  }, [actualVitals, demoVitals, vitals, provenanceFilter])

  const latestWeight = useMemo(() => {
    const list = provenanceFilter === 'demo' ? demoVitals : (actualVitals.length ? actualVitals : vitals)
    return list.find((v) => v.weight != null)
  }, [actualVitals, demoVitals, vitals, provenanceFilter])

  // Sparkline history points (most recent 10 readings)
  const bpHistoryPoints = useMemo(() => {
    return activeDataset
      .filter((v) => v.systolic_bp != null)
      .slice(0, 10)
      .reverse()
      .map((v) => ({ date: v.recorded_at, value: v.systolic_bp! }))
  }, [activeDataset])

  const glucoseHistoryPoints = useMemo(() => {
    return activeDataset
      .filter((v) => v.blood_glucose != null)
      .slice(0, 10)
      .reverse()
      .map((v) => ({ date: v.recorded_at, value: v.blood_glucose! }))
  }, [activeDataset])

  const hrHistoryPoints = useMemo(() => {
    return activeDataset
      .filter((v) => v.heart_rate != null)
      .slice(0, 10)
      .reverse()
      .map((v) => ({ date: v.recorded_at, value: v.heart_rate! }))
  }, [activeDataset])

  const weightHistoryPoints = useMemo(() => {
    return activeDataset
      .filter((v) => v.weight != null)
      .slice(0, 10)
      .reverse()
      .map((v) => ({ date: v.recorded_at, value: v.weight! }))
  }, [activeDataset])

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await api.post(`/api/v1/vitals/alerts/${alertId}/acknowledge`, {})
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: 'resolved' } : a)))
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
    }
  }

  const handleDeleteVital = async (vitalId: string) => {
    if (!window.confirm('Are you sure you want to delete this vital sign record?')) return
    try {
      await api.delete(`/api/v1/vitals/${vitalId}`)
      setVitals((prev) => prev.filter((v) => v.id !== vitalId))
      setRefreshKey((k) => k + 1)
    } catch (err) {
      console.error('Failed to delete vital:', err)
    }
  }

  const handleOpenEdit = (record: VitalSignRecord) => {
    setEditingVital(record)
    setEditSystolic(record.systolic_bp != null ? String(record.systolic_bp) : '')
    setEditDiastolic(record.diastolic_bp != null ? String(record.diastolic_bp) : '')
    setEditGlucose(record.blood_glucose != null ? String(record.blood_glucose) : '')
    setEditHeartRate(record.heart_rate != null ? String(record.heart_rate) : '')
    setEditWeight(record.weight != null ? String(record.weight) : '')
    setEditNotes(record.notes || '')
    setEditError(null)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingVital) return

    setEditError(null)
    try {
      setSavingEdit(true)
      const payload: any = {
        notes: editNotes.trim() || undefined,
      }
      if (editSystolic) payload.systolic_bp = Number(editSystolic)
      if (editDiastolic) payload.diastolic_bp = Number(editDiastolic)
      if (editGlucose) payload.blood_glucose = Number(editGlucose)
      if (editHeartRate) payload.heart_rate = Number(editHeartRate)
      if (editWeight) payload.weight = Number(editWeight)

      await api.put(`/api/v1/vitals/${editingVital.id}`, payload)
      setEditingVital(null)
      setRefreshKey((k) => k + 1)
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || 'Failed to update vital sign entry.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleExport = (formatType: 'csv' | 'json') => {
    window.open(`/api/v1/vitals/export?format=${formatType}`, '_blank')
  }

  const handleRunTrendAnalysis = async () => {
    try {
      setAnalyzingTrends(true)
      const res = await api.post('/api/v1/vitals/analyze-trends', {
        days: timeFilterDays > 0 ? timeFilterDays : 30,
        measurement_type: 'all',
      })
      setTrendAnalysis(res.data)
    } catch (err) {
      console.error('Failed to run trend analysis:', err)
    } finally {
      setAnalyzingTrends(false)
    }
  }

  const scrollToAnalytics = () => {
    const el = document.getElementById('analytics-section')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="space-y-6 pb-16 animate-fade-in max-w-7xl mx-auto">
      {/* ── 1. Redesigned Premium Header & Global Action Toolbar ─────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono tracking-wider uppercase bg-teal-500/10 text-teal-400 border border-teal-500/25">
              Clinical Telemetry Platform
            </span>
            <span className="text-xs text-slate-500">AHA/ACC 2017 &amp; ADA 2024 Standards</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">
            VitalSense™ Health Telemetry
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
            Continuous cardiovascular &amp; metabolic tracking, verified data provenance, and longitudinal clinical analytics.
          </p>
        </div>

        {/* Header Right: Status Indicator & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Connection Status Pill */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center gap-2 shadow-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                pairedDeviceName ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-500'
              }`}
            />
            <span className="text-slate-400">Device Status:</span>
            <span className="font-semibold text-white">
              {pairedDeviceName ? pairedDeviceName : 'No hardware linked'}
            </span>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBpModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-600/20 cursor-pointer transition-all"
            >
              <Heart size={14} />
              <span>+ Log Blood Pressure</span>
            </button>

            <button
              onClick={() => setShowGlucoseModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 cursor-pointer transition-all"
            >
              <Droplets size={14} />
              <span>+ Log Glucose</span>
            </button>

            <button
              onClick={() => setShowOtherVitalsModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-colors"
            >
              <Scale size={14} />
              <span>+ Other Vitals</span>
            </button>

            <button
              onClick={() => setShowDeviceModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-colors"
            >
              <Cpu size={14} className="text-teal-400" />
              <span>Connect Device</span>
            </button>

            <button
              onClick={() => setShowRemindersModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-colors"
              title="Manage measurement schedules & doctor sharing"
            >
              <Bell size={14} className="text-teal-400" />
              <span>Reminders &amp; Consent</span>
            </button>

            <button
              onClick={() => setShowWebcamModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer transition-colors"
              title="Experimental non-diagnostic webcam pulse estimation"
            >
              <Camera size={14} />
              <span className="hidden sm:inline">Pulse Scanner</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Three Clearly Separated Measurement Modes Hub ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mode A: Real Device Data */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/90 p-5 flex flex-col justify-between space-y-3 shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold font-mono tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck size={14} /> Mode A — Real Device Data
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                Hardware Required
              </span>
            </div>
            <h4 className="text-xs font-bold text-white mb-1">
              Bluetooth &amp; USB Medical Peripherals
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              Direct telemetry from verified hardware: Omron upper-arm cuffs (GATT 0x1810), Dexcom CGMs (GATT 0x1808), or pulse oximeters.
            </p>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Hardware Status:</span>
                <span className="font-semibold text-rose-400 text-[11px]">
                  {pairedDeviceName ? `Linked: ${pairedDeviceName}` : 'No compatible device connected'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                Only authentic data is accepted • Power on device in pairing mode to link.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={() => setShowDeviceModal(true)}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <Cpu size={14} className="text-teal-400" /> Open Medical Device Hub
            </button>
          </div>
        </div>

        {/* Mode B: Manual Entry */}
        <div className="rounded-2xl border border-teal-500/30 bg-teal-950/15 p-5 flex flex-col justify-between space-y-3 shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold font-mono tracking-wider uppercase text-teal-400 flex items-center gap-1.5">
                <FileText size={14} /> Mode B — Manual Entry
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Fully Functional
              </span>
            </div>
            <h4 className="text-xs font-bold text-white mb-1">
              Manual Patient Telemetry Logging
            </h4>
            <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
              Use the equipment you already own: home blood pressure cuff, standard fingerstick test strips, or clinic lab reports.
            </p>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-teal-500/20 text-xs space-y-1 text-slate-300">
              <div className="text-[11px]">
                Provenanced Badge:{' '}
                <strong className="text-white font-mono">Manual Entry — Not Device Verified</strong>
              </div>
              <p className="text-[10px] text-slate-400">
                Zero fake sensor claims • Values saved directly to your authenticated health profile.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-teal-500/20 grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowBpModal(true)}
              className="py-2 px-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold cursor-pointer shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-1"
            >
              <Heart size={13} /> + Log BP
            </button>
            <button
              onClick={() => setShowGlucoseModal(true)}
              className="py-2 px-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer shadow-md shadow-cyan-600/20 transition-all flex items-center justify-center gap-1"
            >
              <Droplets size={13} /> + Log Glucose
            </button>
          </div>
        </div>

        {/* Mode C: Clinical Demo & Simulation */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/90 p-5 flex flex-col justify-between space-y-3 shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold font-mono tracking-wider uppercase text-amber-400 flex items-center gap-1.5">
                <FlaskConical size={14} /> Mode C — Demo &amp; Sim Console
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Testing Sandbox
              </span>
            </div>
            <h4 className="text-xs font-bold text-white mb-1">
              Deterministic Software Testbench
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              Safely test clinical alert triggers, threshold boundaries, and chart responses with fictional sample readings.
            </p>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1">
              <div className="text-[11px] text-slate-400">
                Simulated Badge: <strong className="text-amber-300 font-mono">DEMO DATA</strong>
              </div>
              <p className="text-[10px] text-slate-500">
                Safety Guarantee: Resetting demo data never touches your real patient records.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-mono">Controls in console below ↓</span>
            <button
              onClick={() => setShowWebcamModal(true)}
              className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1"
            >
              <Camera size={13} className="text-teal-400" /> Webcam Pulse Demo
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. Four Rebuilt Key Clinical Metric Cards ───────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Blood Pressure Card */}
        <VitalCard
          type="bp"
          title="Blood Pressure"
          subtitle="Systolic & Diastolic"
          value={latestBp ? `${latestBp.systolic_bp}/${latestBp.diastolic_bp}` : null}
          unit="mmHg"
          secondaryValue={latestBp?.mean_arterial_pressure ? `MAP ${latestBp.mean_arterial_pressure}` : null}
          secondaryUnit="mmHg"
          recordedAt={latestBp?.recorded_at}
          statusBadge={
            latestBp?.bp_category ? (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                latestBp.bp_category === 'Normal'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : latestBp.bp_category === 'Elevated'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {latestBp.bp_category}
              </span>
            ) : null
          }
          source={latestBp?.measurement_source}
          isSample={latestBp?.is_sample}
          deviceName={latestBp?.device_name}
          historyPoints={bpHistoryPoints}
          onLogClick={() => setShowBpModal(true)}
          onHistoryClick={scrollToAnalytics}
          emptyTitle="No Blood Pressure Logged"
          emptyDescription="Record a reading from your home cuff or clinical visit to initialize cardiovascular tracking."
          guidelineNote="AHA/ACC 2017 standard thresholds"
        />

        {/* Blood Glucose Card */}
        <VitalCard
          type="glucose"
          title="Blood Glucose"
          subtitle={latestGlucose?.glucose_context?.replace('_', ' ') || 'Glycemic Index'}
          value={latestGlucose?.blood_glucose}
          unit="mg/dL"
          secondaryValue={latestGlucose?.blood_glucose_mmol ? `${latestGlucose.blood_glucose_mmol}` : null}
          secondaryUnit="mmol/L"
          recordedAt={latestGlucose?.recorded_at}
          statusBadge={
            latestGlucose?.glucose_category ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {latestGlucose.glucose_category}
              </span>
            ) : null
          }
          source={latestGlucose?.measurement_source}
          isSample={latestGlucose?.is_sample}
          deviceName={latestGlucose?.device_name}
          historyPoints={glucoseHistoryPoints}
          onLogClick={() => setShowGlucoseModal(true)}
          onHistoryClick={scrollToAnalytics}
          emptyTitle="No Blood Glucose Logged"
          emptyDescription="Record a fasting or post-meal reading from your home test strip meter."
          guidelineNote="ADA 2024 Standards of Medical Care"
        />

        {/* Resting Heart Rate Card */}
        <VitalCard
          type="hr"
          title="Resting Heart Rate"
          subtitle="Sinus Rhythm / Pulse"
          value={latestHeartRate?.heart_rate}
          unit="bpm"
          recordedAt={latestHeartRate?.recorded_at}
          statusBadge={
            latestHeartRate?.heart_rate ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {latestHeartRate.heart_rate >= 60 && latestHeartRate.heart_rate <= 100
                  ? 'Normal Sinus Rhythm'
                  : latestHeartRate.heart_rate < 60
                  ? 'Sinus Bradycardia'
                  : 'Tachycardia Range'}
              </span>
            ) : null
          }
          source={latestHeartRate?.measurement_source}
          isSample={latestHeartRate?.is_sample}
          deviceName={latestHeartRate?.device_name}
          historyPoints={hrHistoryPoints}
          onLogClick={() => setShowOtherVitalsModal(true)}
          onHistoryClick={scrollToAnalytics}
          emptyTitle="No Heart Rate Logged"
          emptyDescription="Log your resting pulse or test our ambient-light webcam research tool."
          guidelineNote="Resting baseline: 60 - 100 bpm"
        />

        {/* Body Weight Card */}
        <VitalCard
          type="weight"
          title="Body Weight"
          subtitle="Calibrated Mass"
          value={latestWeight?.weight}
          unit="kg"
          secondaryValue={latestWeight?.weight ? (latestWeight.weight * 2.20462).toFixed(1) : null}
          secondaryUnit="lbs"
          recordedAt={latestWeight?.recorded_at}
          statusBadge={
            latestWeight?.weight ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Calibrated Record
              </span>
            ) : null
          }
          source={latestWeight?.measurement_source}
          isSample={latestWeight?.is_sample}
          deviceName={latestWeight?.device_name}
          historyPoints={weightHistoryPoints}
          onLogClick={() => setShowOtherVitalsModal(true)}
          onHistoryClick={scrollToAnalytics}
          emptyTitle="No Weight Logged"
          emptyDescription="Track body mass over time to assess hemodynamic volume and metabolic progress."
          guidelineNote="Standard calibrated scale reading"
        />
      </div>

      {/* ── 4. Clinical Alert Center & Reminders ────────────────────────────── */}
      <VitalAlertsCenter
        alerts={alerts}
        reminders={reminders}
        onAcknowledgeAlert={handleAcknowledgeAlert}
        onOpenRemindersModal={() => setShowRemindersModal(true)}
      />

      {/* ── 5. Mode C Software Testing Console ──────────────────────────────── */}
      <TestModeConsole
        onSimulated={() => {
          fetchVitals()
          fetchAlerts()
          setRefreshKey((k) => k + 1)
        }}
      />

      {/* ── 6. Interactive Patient Body Map & Anatomical Status ─────────────── */}
      <BodyMap
        refreshKey={refreshKey}
        onLogClick={(type) => {
          if (type === 'bp' || type === 'cardiovascular') setShowBpModal(true)
          else if (type === 'glucose' || type === 'metabolic') setShowGlucoseModal(true)
          else setShowOtherVitalsModal(true)
        }}
      />

      {/* ── 7. Longitudinal Clinical Analytics & Trends Section ─────────────── */}
      <div id="analytics-section">
        <VitalAnalyticsSection
          vitals={vitals}
          timeFilterDays={timeFilterDays}
          onTimeFilterChange={setTimeFilterDays}
          provenanceFilter={provenanceFilter}
          onProvenanceFilterChange={setProvenanceFilter}
          onExport={handleExport}
          trendAnalysis={trendAnalysis}
          analyzingTrends={analyzingTrends}
          onRunTrendAnalysis={handleRunTrendAnalysis}
        />
      </div>

      {/* ── 8. Telemetry Audit Log & Measurement History Table ──────────────── */}
      <VitalHistoryTable
        vitals={activeDataset}
        onEdit={handleOpenEdit}
        onDelete={handleDeleteVital}
        onExport={handleExport}
      />

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <LogBpModal
        isOpen={showBpModal}
        onClose={() => setShowBpModal(false)}
        onSuccess={() => {
          fetchVitals()
          fetchAlerts()
          setRefreshKey((k) => k + 1)
        }}
      />

      <LogGlucoseModal
        isOpen={showGlucoseModal}
        onClose={() => setShowGlucoseModal(false)}
        onSuccess={() => {
          fetchVitals()
          fetchAlerts()
          setRefreshKey((k) => k + 1)
        }}
      />

      <LogOtherVitalsModal
        isOpen={showOtherVitalsModal}
        onClose={() => setShowOtherVitalsModal(false)}
        onSuccess={() => {
          fetchVitals()
          fetchAlerts()
          setRefreshKey((k) => k + 1)
        }}
      />

      <DeviceConnectModal
        isOpen={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        onDeviceLinked={(name) => {
          setPairedDeviceName(name)
          fetchVitals()
        }}
      />

      <RemindersConsentModal
        isOpen={showRemindersModal}
        onClose={() => setShowRemindersModal(false)}
        reminders={reminders}
        consents={consents}
        onRefreshReminders={fetchReminders}
        onRefreshConsents={fetchConsents}
      />

      <WebcamPulseModal
        isOpen={showWebcamModal}
        onClose={() => setShowWebcamModal(false)}
        onSaved={() => {
          fetchVitals()
          setRefreshKey((k) => k + 1)
        }}
      />

      {/* Edit Vital Modal Dialog */}
      {editingVital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-teal-400" />
                <h3 className="text-sm font-bold text-white">Edit Telemetry Entry</h3>
              </div>
              <button
                onClick={() => setEditingVital(null)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3">
              {editingVital.systolic_bp != null && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">Systolic (mmHg)</label>
                    <input
                      type="number"
                      required
                      value={editSystolic}
                      onChange={(e) => setEditSystolic(e.target.value)}
                      className="w-full bg-slate-950 p-2 rounded-lg border border-slate-800 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">Diastolic (mmHg)</label>
                    <input
                      type="number"
                      required
                      value={editDiastolic}
                      onChange={(e) => setEditDiastolic(e.target.value)}
                      className="w-full bg-slate-950 p-2 rounded-lg border border-slate-800 text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {editingVital.blood_glucose != null && (
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Blood Glucose ({editingVital.glucose_unit || 'mg/dL'})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editGlucose}
                    onChange={(e) => setEditGlucose(e.target.value)}
                    className="w-full bg-slate-950 p-2 rounded-lg border border-slate-800 text-white font-mono"
                  />
                </div>
              )}

              {editingVital.heart_rate != null && (
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={editHeartRate}
                    onChange={(e) => setEditHeartRate(e.target.value)}
                    className="w-full bg-slate-950 p-2 rounded-lg border border-slate-800 text-white font-mono"
                  />
                </div>
              )}

              {editingVital.weight != null && (
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    className="w-full bg-slate-950 p-2 rounded-lg border border-slate-800 text-white font-mono"
                  />
                </div>
              )}

              <div>
                <label className="text-slate-300 font-medium block mb-1">Patient Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 p-2 rounded-lg border border-slate-800 text-white"
                  placeholder="Measurement context"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingVital(null)}
                  disabled={savingEdit}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Update Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
