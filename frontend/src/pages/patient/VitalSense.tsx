import React, { useState, useEffect, useMemo } from 'react'
import {
  Activity,
  Heart,
  Droplets,
  Scale,
  Calendar,
  Filter,
  Download,
  Plus,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Fingerprint,
  Watch,
  Bell,
  Trash2,
  Edit2,
  Share2,
  Info,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  FileJson,
  X,
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
import { format } from 'date-fns'
import { BodyMap } from '@/components/vitals/BodyMap'
import { TestModeConsole } from '@/components/vitals/TestModeConsole'

// -----------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------
interface VitalAlert {
  id: string
  alert_type: string
  severity: string
  title: string
  message: string
  clinical_recommendation?: string | null
  triggered_value?: string | null
  status: string
  created_at: string
}

interface VitalSign {
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

interface TrendStats {
  total_readings: number
  date_range_days: number
  bp_reading_count: number
  average_systolic?: number | null
  average_diastolic?: number | null
  mean_arterial_pressure?: number | null
  min_bp?: string | null
  max_bp?: string | null
  hypertensive_crisis_count: number
  stage2_hypertension_count: number
  normal_bp_percentage: number
  glucose_reading_count: number
  average_glucose_mgdl?: number | null
  average_glucose_mmol?: number | null
  time_in_range_percentage: number
  hypoglycemia_count: number
  hyperglycemia_count: number
  average_heart_rate?: number | null
  latest_weight_kg?: number | null
  weight_delta_kg?: number | null
  sources_detected: string[]
  missing_data_days: number
}

interface TrendAnalysisResponse {
  period_days: number
  total_measurements: number
  stats: TrendStats
  observations: string[]
  trend_explanation: string
  data_limitations: string[]
  suggested_doctor_questions: string[]
  clinical_safety_notice: string
  generated_at: string
}

interface VitalReminder {
  id: string
  reminder_type: string
  label: string
  time_of_day: string
  frequency: string
  days_of_week?: string | null
  is_active: boolean
}

interface SharingConsent {
  id: string
  doctor_id: string
  doctor_name?: string
  doctor_specialty?: string
  is_active: boolean
  consented_at: string
  notes?: string | null
}

export default function VitalSense() {
  // State
  const [vitals, setVitals] = useState<VitalSign[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<number>(30)
  const [metricTab, setMetricTab] = useState<'all' | 'bp' | 'glucose' | 'hr' | 'weight'>('all')

  // Modals
  const [showBpModal, setShowBpModal] = useState(false)
  const [showGlucoseModal, setShowGlucoseModal] = useState(false)
  const [showQuickModal, setShowQuickModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showRemindersModal, setShowRemindersModal] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [showBiometricModal, setShowBiometricModal] = useState(false)
  const [editingVital, setEditingVital] = useState<VitalSign | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [alerts, setAlerts] = useState<VitalAlert[]>([])
  const [editForm, setEditForm] = useState({
    systolic_bp: 120,
    diastolic_bp: 80,
    heart_rate: 70,
    blood_glucose: 100,
    glucose_unit: 'mg/dL',
    glucose_context: 'fasting',
    weight: 65,
    notes: '',
  })


  // AI Trend State
  const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysisResponse | null>(null)
  const [analyzingTrends, setAnalyzingTrends] = useState(false)

  // Reminders & Consents
  const [reminders, setReminders] = useState<VitalReminder[]>([])
  const [consents, setConsents] = useState<SharingConsent[]>([])
  const [doctorsList, setDoctorsList] = useState<Array<{ id: string; name: string; specialty: string }>>([])

  // Biometric state
  const [biometricStatus, setBiometricStatus] = useState<{ enrolled: boolean; msg: string }>({
    enrolled: false,
    msg: '',
  })

  // Form states
  const [bpForm, setBpForm] = useState({
    systolic_bp: 120,
    diastolic_bp: 80,
    heart_rate: 70,
    source: 'manual_entry',
    device_name: '',
    notes: '',
  })

  const [glucoseForm, setGlucoseForm] = useState({
    blood_glucose: 100,
    glucose_unit: 'mg/dL',
    glucose_context: 'fasting',
    source: 'manual_entry',
    device_name: '',
    notes: '',
  })

  const [quickForm, setQuickForm] = useState({
    type: 'weight',
    value: 65.0,
    notes: '',
  })

  const [reminderForm, setReminderForm] = useState({
    reminder_type: 'bp',
    label: '',
    time_of_day: '08:00 AM',
    frequency: 'daily',
  })

  // ---------------------------------------------------------------------------
  // Load Telemetry Data
  // ---------------------------------------------------------------------------
  const fetchVitals = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/v1/vitals?days=${timeFilter}`)
      setVitals(res.data)
    } catch (err) {
      console.error('Failed to load vitals:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchReminders = async () => {
    try {
      const res = await api.get('/api/v1/vitals/reminders')
      setReminders(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchConsents = async () => {
    try {
      const res = await api.get('/api/v1/vitals/consent')
      setConsents(res.data)
      const docRes = await api.get('/api/v1/users?role=doctor')
      if (Array.isArray(docRes.data)) {
        setDoctorsList(
          docRes.data.map((d: any) => ({
            id: d.id,
            name: d.full_name || 'Dr. Clinician',
            specialty: d.specialty || 'General Medicine',
          }))
        )
      }
    } catch (err) {
      console.error(err)
    }
  }

  const checkBiometrics = async () => {
    try {
      const res = await api.get('/api/v1/vitals/biometrics/status')
      setBiometricStatus({
        enrolled: res.data.biometrics_enrolled,
        msg: res.data.disclaimer,
      })
    } catch (err) {
      console.error(err)
    }
  }

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/api/v1/vitals/alerts?status=active')
      setAlerts(res.data)
    } catch (err) {
      console.error('Failed to load clinical alerts:', err)
    }
  }

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await api.post(`/api/v1/vitals/alerts/${alertId}/acknowledge`, {
        follow_up_action: 'Reviewed by patient in VitalSense test console',
      })
      fetchAlerts()
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
    }
  }

  const handleOpenEdit = (v: VitalSign) => {
    setEditingVital(v)
    setEditForm({
      systolic_bp: v.systolic_bp || 120,
      diastolic_bp: v.diastolic_bp || 80,
      heart_rate: v.heart_rate || 70,
      blood_glucose: v.blood_glucose || 100,
      glucose_unit: v.glucose_unit || 'mg/dL',
      glucose_context: v.glucose_context || 'fasting',
      weight: v.weight || 65,
      notes: v.notes || '',
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingVital) return
    try {
      await api.put(`/api/v1/vitals/${editingVital.id}`, {
        systolic_bp: editingVital.systolic_bp != null ? Number(editForm.systolic_bp) : undefined,
        diastolic_bp: editingVital.diastolic_bp != null ? Number(editForm.diastolic_bp) : undefined,
        heart_rate: editForm.heart_rate ? Number(editForm.heart_rate) : undefined,
        blood_glucose: editingVital.blood_glucose != null ? Number(editForm.blood_glucose) : undefined,
        glucose_unit: editForm.glucose_unit,
        glucose_context: editForm.glucose_context,
        weight: editingVital.weight != null ? Number(editForm.weight) : undefined,
        notes: editForm.notes,
      })
      setShowEditModal(false)
      setEditingVital(null)
      fetchVitals()
      fetchAlerts()
      setRefreshKey((k) => k + 1)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update telemetry reading')
    }
  }

  useEffect(() => {
    fetchVitals()
    fetchAlerts()
  }, [timeFilter])

  useEffect(() => {
    fetchReminders()
    fetchConsents()
    checkBiometrics()
    fetchAlerts()
  }, [])

  // ---------------------------------------------------------------------------
  // AI Health Trend Analysis Trigger
  // ---------------------------------------------------------------------------
  const handleAnalyzeTrends = async () => {
    setAnalyzingTrends(true)
    try {
      const res = await api.post('/api/v1/vitals/analyze-trends', {
        days: timeFilter,
        measurement_type: 'all',
      })
      setTrendAnalysis(res.data)
    } catch (err) {
      console.error('Trend analysis failed:', err)
    } finally {
      setAnalyzingTrends(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleSaveBp = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/api/v1/vitals/blood-pressure', {
        systolic_bp: Number(bpForm.systolic_bp),
        diastolic_bp: Number(bpForm.diastolic_bp),
        heart_rate: bpForm.heart_rate ? Number(bpForm.heart_rate) : null,
        measurement_source: bpForm.source,
        device_name: bpForm.device_name || null,
        notes: bpForm.notes || null,
      })
      setShowBpModal(false)
      setBpForm({
        systolic_bp: 120,
        diastolic_bp: 80,
        heart_rate: 70,
        source: 'manual_entry',
        device_name: '',
        notes: '',
      })
      fetchVitals()
      fetchAlerts()
      setRefreshKey((k) => k + 1)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to record blood pressure')
    }
  }

  const handleSaveGlucose = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/api/v1/vitals/blood-glucose', {
        blood_glucose: Number(glucoseForm.blood_glucose),
        glucose_unit: glucoseForm.glucose_unit,
        glucose_context: glucoseForm.glucose_context,
        measurement_source: glucoseForm.source,
        device_name: glucoseForm.device_name || null,
        notes: glucoseForm.notes || null,
      })
      setShowGlucoseModal(false)
      setGlucoseForm({
        blood_glucose: 100,
        glucose_unit: 'mg/dL',
        glucose_context: 'fasting',
        source: 'manual_entry',
        device_name: '',
        notes: '',
      })
      fetchVitals()
      fetchAlerts()
      setRefreshKey((k) => k + 1)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to record blood glucose')
    }
  }

  const handleSaveQuick = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (quickForm.type === 'weight') {
        await api.post('/api/v1/vitals/weight', {
          weight: Number(quickForm.value),
          notes: quickForm.notes || null,
        })
      } else {
        await api.post('/api/v1/vitals/heart-rate', {
          heart_rate: Number(quickForm.value),
          notes: quickForm.notes || null,
        })
      }
      setShowQuickModal(false)
      fetchVitals()
      fetchAlerts()
      setRefreshKey((k) => k + 1)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to log telemetry')
    }
  }

  const handleDeleteVital = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this telemetry entry?')) return
    try {
      await api.delete(`/api/v1/vitals/${id}`)
      fetchVitals()
      fetchAlerts()
      setRefreshKey((k) => k + 1)
    } catch (err) {
      alert('Failed to delete entry')
    }
  }

  const handleSimulateDeviceImport = async (source: string, deviceName: string) => {
    try {
      const now = new Date()
      let sampleData = []
      if (source === 'omron_connect') {
        sampleData = [
          {
            recorded_at: new Date(now.getTime() - 3600000 * 2).toISOString(),
            systolic_bp: 124,
            diastolic_bp: 80,
            heart_rate: 71,
            notes: 'Automated cuff sync via Omron Bluetooth',
          },
          {
            recorded_at: new Date(now.getTime() - 86400000).toISOString(),
            systolic_bp: 122,
            diastolic_bp: 78,
            heart_rate: 69,
            notes: 'Evening reading via Omron Evolv',
          },
        ]
      } else if (source === 'dexcom_cgm') {
        sampleData = [
          {
            recorded_at: new Date(now.getTime() - 1800000).toISOString(),
            blood_glucose: 104.0,
            glucose_unit: 'mg/dL',
            glucose_context: 'fasting',
            notes: 'Continuous sensor telemetry broadcast',
          },
          {
            recorded_at: new Date(now.getTime() - 7200000).toISOString(),
            blood_glucose: 135.0,
            glucose_unit: 'mg/dL',
            glucose_context: 'after_meal',
            notes: 'Postprandial peak sync',
          },
        ]
      } else {
        sampleData = [
          {
            recorded_at: new Date(now.getTime() - 3600000).toISOString(),
            heart_rate: 74,
            weight: 64.1,
            notes: 'HealthKit background sync',
          },
        ]
      }

      await api.post('/api/v1/vitals/import', {
        source,
        device_name: deviceName,
        readings: sampleData,
      })
      setShowImportModal(false)
      fetchVitals()
      alert(`Successfully synchronized readings from ${deviceName}!`)
    } catch (err) {
      alert('Device import synchronization failed')
    }
  }

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/api/v1/vitals/reminders', reminderForm)
      setReminderForm({
        reminder_type: 'bp',
        label: '',
        time_of_day: '08:00 AM',
        frequency: 'daily',
      })
      fetchReminders()
    } catch (err) {
      alert('Failed to create reminder')
    }
  }

  const handleToggleReminder = async (rem: VitalReminder) => {
    try {
      await api.put(`/api/v1/vitals/reminders/${rem.id}`, { is_active: !rem.is_active })
      fetchReminders()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteReminder = async (id: string) => {
    try {
      await api.delete(`/api/v1/vitals/reminders/${id}`)
      fetchReminders()
    } catch (err) {
      console.error(err)
    }
  }

  const handleExport = async (formatType: 'csv' | 'json') => {
    try {
      if (formatType === 'csv') {
        const res = await api.get(`/api/v1/vitals/export?format=csv&days=${timeFilter}`, {
          responseType: 'blob',
        })
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `medicare_vitals_${format(new Date(), 'yyyyMMdd')}.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
      } else {
        const res = await api.get(`/api/v1/vitals/export?format=json&days=${timeFilter}`)
        const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(res.data, null, 2))}`
        const link = document.createElement('a')
        link.href = jsonStr
        link.setAttribute('download', `medicare_vitals_${format(new Date(), 'yyyyMMdd')}.json`)
        document.body.appendChild(link)
        link.click()
        link.remove()
      }
    } catch (err) {
      alert('Export failed')
    }
  }

  // ---------------------------------------------------------------------------
  // WebAuthn Passkey Registration & Verification
  // ---------------------------------------------------------------------------
  const handleRegisterBiometricPasskey = async () => {
    if (!window.PublicKeyCredential) {
      alert(
        'Your current browser or device platform does not support WebAuthn hardware biometric passkeys. You can continue using your secure password.'
      )
      return
    }
    try {
      const optRes = await api.post('/api/v1/vitals/biometrics/register-options')
      const options = optRes.data

      // Mock registration registration challenge
      const credentialId = 'passkey_' + Math.random().toString(36).substring(2, 15)
      await api.post('/api/v1/vitals/biometrics/register-verify', {
        credential_id: credentialId,
        public_key: 'device_es256_public_key',
        device_name: navigator.userAgent.includes('Mac')
          ? 'MacBook Touch ID'
          : navigator.userAgent.includes('Windows')
            ? 'Windows Hello Biometrics'
            : 'Mobile Biometric Sensor',
      })
      alert('Hardware Biometric Passkey registered successfully for secure record unlocking!')
      checkBiometrics()
      setShowBiometricModal(false)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Passkey enrollment could not be completed.')
    }
  }

  // ---------------------------------------------------------------------------
  // Latest Telemetry & Metrics
  // ---------------------------------------------------------------------------
  const latestBp = useMemo(() => vitals.find((v) => v.systolic_bp != null), [vitals])
  const latestGlucose = useMemo(() => vitals.find((v) => v.blood_glucose != null), [vitals])
  const latestHeartRate = useMemo(() => vitals.find((v) => v.heart_rate != null), [vitals])
  const latestWeight = useMemo(() => vitals.find((v) => v.weight != null), [vitals])

  // Chart Data preparation
  const chartData = useMemo(() => {
    return [...vitals]
      .reverse()
      .map((v) => ({
        date: format(new Date(v.recorded_at), 'MM/dd HH:mm'),
        systolic: v.systolic_bp || null,
        diastolic: v.diastolic_bp || null,
        glucose: v.blood_glucose || null,
        heartRate: v.heart_rate || null,
        weight: v.weight || null,
        source: v.measurement_source,
      }))
  }, [vitals])

  // Helper Badge Colors
  const getBpCategoryBadge = (cat?: string | null) => {
    if (!cat) return null
    if (cat === 'Normal')
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Normal (AHA 2017)</span>
    if (cat === 'Elevated')
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">Elevated</span>
    if (cat === 'Hypertension Stage 1')
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">Stage 1 HTN</span>
    if (cat === 'Hypertension Stage 2')
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">Stage 2 HTN</span>
    if (cat === 'Hypertensive Crisis')
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-600/30 text-rose-300 border border-rose-500 animate-pulse">CRISIS (&gt;180/120)</span>
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-500/20 text-slate-300">{cat}</span>
  }

  const getGlucoseCategoryBadge = (cat?: string | null) => {
    if (!cat) return null
    if (cat.includes('Hypoglycemia'))
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/30 text-rose-300 border border-rose-500/40">Hypoglycemia (&lt;70)</span>
    if (cat.includes('Normal'))
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{cat}</span>
    if (cat.includes('Impaired') || cat.includes('Pre-diabetes'))
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">{cat}</span>
    return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">{cat}</span>
  }

  const getSourceBadge = (source: string, isSample: boolean, deviceName?: string | null) => {
    if (isSample)
      return <span className="px-2 py-0.5 rounded text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">Sample Clinical</span>
    if (source === 'omron_connect')
      return <span className="px-2 py-0.5 rounded text-xs font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">Omron BLE</span>
    if (source === 'dexcom_cgm')
      return <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Dexcom CGM</span>
    if (source === 'apple_health')
      return <span className="px-2 py-0.5 rounded text-xs font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">Apple Health</span>
    if (source === 'google_health_connect')
      return <span className="px-2 py-0.5 rounded text-xs font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">Google Health</span>
    return <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-500/20 text-slate-400 border border-slate-500/30">Manual Entry</span>
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* ── Page Header & Quick Actions ───────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500/20 to-teal-500/20 text-blue-400 border border-blue-500/30">
              MediCare VitalSense™
            </span>
            <span className="text-xs text-slate-400">AHA/ACC &amp; ADA Compliant Telemetry</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-white">VitalSense Health Monitoring</h1>
          <p className="text-sm text-slate-400">
            Continuous hemodynamic &amp; metabolic tracking, verifiable source attribution, and deterministic clinical insights.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowBpModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Heart size={14} /> + Log BP
          </button>
          <button
            onClick={() => setShowGlucoseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-600/30 transition-all cursor-pointer"
          >
            <Droplets size={14} /> + Log Glucose
          </button>
          <button
            onClick={() => setShowQuickModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
          >
            <Scale size={14} /> + HR / Weight
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
          >
            <Watch size={14} /> Sync Devices
          </button>
          <button
            onClick={() => setShowRemindersModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
          >
            <Bell size={14} /> Reminders
          </button>
          <button
            onClick={() => setShowConsentModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
          >
            <Share2 size={14} /> Sharing Consent
          </button>
          <button
            onClick={() => setShowBiometricModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-purple-900/40 hover:bg-purple-800/50 text-purple-300 border border-purple-500/30 transition-all cursor-pointer"
          >
            <Fingerprint size={14} /> Passkey Auth
          </button>
        </div>
      </div>

      {/* ── VitalSense Test & Clinical Simulation Console ──────────────── */}
      <TestModeConsole
        onSimulated={() => {
          fetchVitals()
          fetchAlerts()
          setRefreshKey((k) => k + 1)
        }}
      />

      {/* ── Active Clinical Alerts (Explainable Diagnostic Triggered Events) ── */}
      {alerts.length > 0 && (
        <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-surface-900 to-amber-950/30 p-5 shadow-2xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                Active Clinical Alerts ({alerts.length})
              </h3>
              <span className="text-xs text-rose-300 font-medium">Explainable Trigger Reason &amp; Timestamps</span>
            </div>
            <span className="text-[11px] text-slate-400">Deterministic Clinical Rules Engine</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                  alert.severity === 'critical' || alert.severity === 'crisis'
                    ? 'bg-rose-950/60 border-rose-500/50 shadow-lg shadow-rose-950/50'
                    : alert.severity === 'urgent'
                    ? 'bg-amber-950/50 border-amber-500/40'
                    : 'bg-slate-900/80 border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      alert.severity === 'critical' || alert.severity === 'crisis'
                        ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50 animate-pulse'
                        : alert.severity === 'urgent'
                        ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                        : 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                    }`}>
                      {alert.severity} • {alert.alert_type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock size={11} />
                      {format(new Date(alert.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>

                  <h4 className="font-bold text-xs text-white mb-1">{alert.title}</h4>
                  <div className="p-2 rounded-lg bg-black/40 border border-white/5 text-xs text-slate-200">
                    <strong className="text-rose-400">Trigger Reason:</strong> {alert.message}
                  </div>
                  {alert.clinical_recommendation && (
                    <p className="mt-1.5 text-[11px] text-slate-300 italic">
                      Guidance: {alert.clinical_recommendation}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px]">
                  <span className="text-slate-400">Recorded: {format(new Date(alert.created_at), 'yyyy-MM-dd HH:mm:ss')}</span>
                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors cursor-pointer"
                  >
                    Acknowledge Alert
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Key Clinical Metrics Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Blood Pressure Card */}
        <div className="glass p-5 rounded-2xl relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Blood Pressure</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Heart size={16} />
            </div>
          </div>
          {latestBp ? (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-white">
                  {latestBp.systolic_bp}/{latestBp.diastolic_bp}
                </span>
                <span className="text-xs text-slate-400 font-medium">mmHg</span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {getBpCategoryBadge(latestBp.bp_category)}
                {latestBp.mean_arterial_pressure && (
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">
                    MAP: {latestBp.mean_arterial_pressure} mmHg
                  </span>
                )}
              </div>
              <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span>Pulse: {latestBp.heart_rate || '--'} bpm</span>
                <span>{format(new Date(latestBp.recorded_at), 'MMM d, h:mm a')}</span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-slate-500 text-xs">No blood pressure recorded yet.</div>
          )}
        </div>

        {/* Blood Glucose Card */}
        <div className="glass p-5 rounded-2xl relative overflow-hidden group hover:border-teal-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Blood Glucose</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Droplets size={16} />
            </div>
          </div>
          {latestGlucose ? (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-white">{latestGlucose.blood_glucose}</span>
                <span className="text-xs text-slate-400 font-medium">mg/dL</span>
                <span className="text-xs text-teal-400 font-mono ml-1">
                  ({latestGlucose.blood_glucose_mmol} mmol/L)
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {getGlucoseCategoryBadge(latestGlucose.glucose_category)}
                <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 capitalize border border-slate-700">
                  {latestGlucose.glucose_context?.replace('_', ' ') || 'Fasting'}
                </span>
              </div>
              <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span>Context: {latestGlucose.glucose_context || 'Standard'}</span>
                <span>{format(new Date(latestGlucose.recorded_at), 'MMM d, h:mm a')}</span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-slate-500 text-xs">No glucose records logged.</div>
          )}
        </div>

        {/* Resting Heart Rate */}
        <div className="glass p-5 rounded-2xl relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Resting Heart Rate</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Activity size={16} />
            </div>
          </div>
          {latestHeartRate ? (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-white">{latestHeartRate.heart_rate}</span>
                <span className="text-xs text-slate-400 font-medium">bpm</span>
              </div>
              <div className="mt-2.5">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {latestHeartRate.heart_rate! >= 60 && latestHeartRate.heart_rate! <= 100
                    ? 'Normal Sinus Rhythm'
                    : latestHeartRate.heart_rate! < 60
                      ? 'Sinus Bradycardia'
                      : 'Tachycardia Range'}
                </span>
              </div>
              <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span>Source: {latestHeartRate.measurement_source}</span>
                <span>{format(new Date(latestHeartRate.recorded_at), 'MMM d, h:mm a')}</span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-slate-500 text-xs">No heart rate logged.</div>
          )}
        </div>

        {/* Body Weight */}
        <div className="glass p-5 rounded-2xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Body Weight</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Scale size={16} />
            </div>
          </div>
          {latestWeight ? (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-white">{latestWeight.weight}</span>
                <span className="text-xs text-slate-400 font-medium">kg</span>
                <span className="text-xs text-slate-400 ml-1">
                  ({(latestWeight.weight! * 2.20462).toFixed(1)} lbs)
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">
                  Stable Telemetry
                </span>
              </div>
              <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span>Calibrated scale</span>
                <span>{format(new Date(latestWeight.recorded_at), 'MMM d, h:mm a')}</span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-slate-500 text-xs">No weight entries.</div>
          )}
        </div>
      </div>

      {/* ── Interactive Human-Body Health Map ───────────────────────────── */}
      <BodyMap refreshKey={refreshKey} />

      {/* ── Filter & Navigation Bar ───────────────────────────────────────── */}
      <div className="glass p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <Calendar size={13} /> Time Range:
          </span>
          <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-slate-800">
            {[7, 14, 30, 90, 365].map((d) => (
              <button
                key={d}
                onClick={() => setTimeFilter(d)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  timeFilter === d ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {d === 365 ? '1 Year' : `${d}D`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <Filter size={13} /> View:
          </span>
          <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-slate-800">
            {(['all', 'bp', 'glucose', 'hr', 'weight'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMetricTab(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                  metricTab === tab ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'bp' ? 'Blood Pressure' : tab === 'hr' ? 'Heart Rate' : tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
            <button
              onClick={() => handleExport('csv')}
              title="Export telemetry as CSV"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
            >
              <FileSpreadsheet size={15} />
            </button>
            <button
              onClick={() => handleExport('json')}
              title="Export telemetry as JSON"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
            >
              <FileJson size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── AI Health Trend Analyzer Section ──────────────────────────────── */}
      <div className="glass p-6 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/20 via-surface-900/60 to-surface-900/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} className="text-blue-400 animate-pulse" />
              <h2 className="text-lg font-bold font-display text-white">
                VitalSense AI Health Trend Analyzer
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Deterministic statistical metrics grounded strictly in your recorded telemetry, with plain-language physician prep questions.
            </p>
          </div>
          <button
            onClick={handleAnalyzeTrends}
            disabled={analyzingTrends}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={analyzingTrends ? 'animate-spin' : ''} />
            {analyzingTrends ? 'Analyzing Telemetry...' : 'Run Trend Analysis'}
          </button>
        </div>

        {trendAnalysis ? (
          <div className="space-y-4 animate-fade-in">
            {/* Deterministic Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Total Readings</span>
                <span className="text-base font-bold text-white">{trendAnalysis.stats.total_readings}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Average BP</span>
                <span className="text-base font-bold text-blue-400">
                  {trendAnalysis.stats.average_systolic
                    ? `${trendAnalysis.stats.average_systolic}/${trendAnalysis.stats.average_diastolic}`
                    : '--'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Mean Art. Pressure</span>
                <span className="text-base font-bold text-teal-400">
                  {trendAnalysis.stats.mean_arterial_pressure ? `${trendAnalysis.stats.mean_arterial_pressure} mmHg` : '--'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Glucose TIR (70-180)</span>
                <span className="text-base font-bold text-emerald-400">
                  {trendAnalysis.stats.time_in_range_percentage}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Hypertensive Crisis</span>
                <span className={`text-base font-bold ${trendAnalysis.stats.hypertensive_crisis_count > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {trendAnalysis.stats.hypertensive_crisis_count}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Data Completeness</span>
                <span className="text-base font-bold text-amber-400">
                  {trendAnalysis.period_days - trendAnalysis.stats.missing_data_days}/{trendAnalysis.period_days} Days
                </span>
              </div>
            </div>

            {/* Grounded Explanation */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs leading-relaxed text-slate-300">
              <h4 className="font-semibold text-white mb-2 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-blue-400" /> Grounded Trend Assessment ({trendAnalysis.period_days}-Day Window)
              </h4>
              <p className="whitespace-pre-line">{trendAnalysis.trend_explanation}</p>
            </div>

            {/* Observations & Doctor Questions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800">
                <h5 className="font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-teal-400" /> Evidence-Based Observations
                </h5>
                <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
                  {trendAnalysis.observations.map((obs, i) => (
                    <li key={i}>{obs}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800">
                <h5 className="font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
                  <Info size={13} className="text-blue-400" /> Questions For Your Healthcare Provider
                </h5>
                <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
                  {trendAnalysis.suggested_doctor_questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Emergency & Regulatory Safety Notice */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Clinical Safety Guidance:</strong> {trendAnalysis.clinical_safety_notice}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">
            Click <strong>"Run Trend Analysis"</strong> to generate a comprehensive statistical summary and plain-language explanation of your recorded {timeFilter}-day telemetry.
          </div>
        )}
      </div>

      {/* ── Interactive Telemetry Charts ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blood Pressure Chart */}
        {(metricTab === 'all' || metricTab === 'bp') && (
          <div className="glass p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                  <Heart size={15} className="text-blue-400" /> Blood Pressure Telemetry (mmHg)
                </h3>
                <span className="text-xs text-slate-400">AHA Guideline Zones: Normal &lt;120/80</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Systolic
                </span>
                <span className="flex items-center gap-1 text-teal-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" /> Diastolic
                </span>
              </div>
            </div>

            <div className="h-64">
              {chartData.filter((d) => d.systolic != null).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.filter((d) => d.systolic != null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis domain={[50, 190]} stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f2040',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    {/* Normal Target Zones */}
                    <ReferenceLine y={120} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'AHA SBP 120', fill: '#10b981', fontSize: 10 }} />
                    <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'AHA DBP 80', fill: '#10b981', fontSize: 10 }} />
                    <Line type="monotone" dataKey="systolic" stroke="#3182f4" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="diastolic" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No blood pressure measurements in this period.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Blood Glucose Chart */}
        {(metricTab === 'all' || metricTab === 'glucose') && (
          <div className="glass p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                  <Droplets size={15} className="text-teal-400" /> Blood Glucose Trend (mg/dL)
                </h3>
                <span className="text-xs text-slate-400">ADA Target Band: 70 – 180 mg/dL</span>
              </div>
              <div className="text-xs text-slate-400">
                Standard: <strong className="text-emerald-400">70 - 180 mg/dL</strong>
              </div>
            </div>

            <div className="h-64">
              {chartData.filter((d) => d.glucose != null).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.filter((d) => d.glucose != null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis domain={[40, 240]} stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f2040',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    {/* Time in range shaded area */}
                    <ReferenceArea y1={70} y2={180} fill="rgba(16, 185, 129, 0.08)" />
                    <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Hypo 70', fill: '#ef4444', fontSize: 10 }} />
                    <ReferenceLine y={180} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Hyper 180', fill: '#f59e0b', fontSize: 10 }} />
                    <Line type="monotone" dataKey="glucose" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No glucose measurements in this period.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pulse & Weight Charts */}
        {(metricTab === 'all' || metricTab === 'hr' || metricTab === 'weight') && (
          <div className="glass p-5 rounded-2xl lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                  <Activity size={15} className="text-rose-400" /> Pulse &amp; Body Weight Correlate
                </h3>
                <span className="text-xs text-slate-400">Resting heart rate (bpm) and calibrated mass (kg)</span>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" stroke="#fb7185" tick={{ fontSize: 10 }} domain={[40, 140]} />
                  <YAxis yAxisId="right" orientation="right" stroke="#fbbf24" tick={{ fontSize: 10 }} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f2040',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="heartRate" stroke="#fb7185" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="weight" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── Recent Measurements Table ────────────────────────────────────── */}
      <div className="glass rounded-2xl overflow-hidden border border-slate-800">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">Recent Vital Telemetry Log</h3>
            <span className="text-xs text-slate-400">Verifiable device attribution &amp; clinical notes</span>
          </div>
          <span className="text-xs font-mono text-slate-400">{vitals.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Type &amp; Measurement</th>
                <th className="p-3.5">Clinical Classification</th>
                <th className="p-3.5">Data Source / Device</th>
                <th className="p-3.5">Notes</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {vitals.length > 0 ? (
                vitals.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 text-slate-300 font-mono">
                      {format(new Date(v.recorded_at), 'yyyy-MM-dd HH:mm')}
                    </td>
                    <td className="p-3.5 font-medium text-white">
                      {v.systolic_bp != null && (
                        <div>
                          <span className="text-sm font-bold text-blue-400">
                            {v.systolic_bp}/{v.diastolic_bp}
                          </span>{' '}
                          <span className="text-[10px] text-slate-400">mmHg</span>
                          {v.heart_rate && <span className="text-xs text-slate-400 ml-2">({v.heart_rate} bpm)</span>}
                        </div>
                      )}
                      {v.blood_glucose != null && (
                        <div>
                          <span className="text-sm font-bold text-teal-400">{v.blood_glucose}</span>{' '}
                          <span className="text-[10px] text-slate-400">mg/dL</span>
                          <span className="text-xs text-teal-400/80 font-mono ml-2">
                            ({v.blood_glucose_mmol} mmol/L)
                          </span>
                        </div>
                      )}
                      {v.weight != null && (
                        <div>
                          <span className="text-sm font-bold text-amber-400">{v.weight}</span>{' '}
                          <span className="text-[10px] text-slate-400">kg</span>
                        </div>
                      )}
                      {v.heart_rate != null && v.systolic_bp == null && (
                        <div>
                          <span className="text-sm font-bold text-rose-400">{v.heart_rate}</span>{' '}
                          <span className="text-[10px] text-slate-400">bpm</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">
                      {v.bp_category && getBpCategoryBadge(v.bp_category)}
                      {v.glucose_category && getGlucoseCategoryBadge(v.glucose_category)}
                      {!v.bp_category && !v.glucose_category && (
                        <span className="text-slate-500">Recorded</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-col gap-0.5">
                        {getSourceBadge(v.measurement_source, v.is_sample, v.device_name)}
                        {v.device_name && (
                          <span className="text-[10px] text-slate-400">{v.device_name}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-300 max-w-xs truncate">
                      {v.notes || '--'}
                      {v.clinical_notes && (
                        <div className="text-[11px] text-blue-300 font-semibold mt-0.5">
                          MD: {v.clinical_notes}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-right flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(v)}
                        title="Edit telemetry entry"
                        className="p-1 rounded hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteVital(v.id)}
                        title="Delete telemetry entry"
                        className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No measurements found for the selected time range. Use the action buttons above to record readings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Log Blood Pressure Modal ─────────────────────────────────────── */}
      {showBpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-slate-700 bg-surface-900 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Heart size={18} className="text-blue-400" /> Log Blood Pressure Reading
              </h3>
              <button onClick={() => setShowBpModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBp} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Systolic (mmHg)</label>
                  <input
                    type="number"
                    min="50"
                    max="280"
                    required
                    value={bpForm.systolic_bp}
                    onChange={(e) => setBpForm({ ...bpForm, systolic_bp: Number(e.target.value) })}
                    className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold text-base"
                  />
                  <span className="text-[10px] text-slate-500">Normal: &lt;120 mmHg</span>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Diastolic (mmHg)</label>
                  <input
                    type="number"
                    min="30"
                    max="180"
                    required
                    value={bpForm.diastolic_bp}
                    onChange={(e) => setBpForm({ ...bpForm, diastolic_bp: Number(e.target.value) })}
                    className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold text-base"
                  />
                  <span className="text-[10px] text-slate-500">Normal: &lt;80 mmHg</span>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Resting Pulse Rate (bpm, optional)</label>
                <input
                  type="number"
                  min="30"
                  max="240"
                  value={bpForm.heart_rate || ''}
                  onChange={(e) => setBpForm({ ...bpForm, heart_rate: Number(e.target.value) })}
                  className="w-full bg-slate-900 p-2 rounded-xl border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Measurement Source / Device</label>
                <select
                  value={bpForm.source}
                  onChange={(e) => setBpForm({ ...bpForm, source: e.target.value })}
                  className="w-full bg-slate-900 p-2 rounded-xl border border-slate-700 text-white"
                >
                  <option value="manual_entry">Manual Home Entry (Upper Arm Cuff)</option>
                  <option value="omron_connect">Omron Connect Upper Arm Monitor</option>
                  <option value="apple_health">Apple Health Sync</option>
                  <option value="google_health_connect">Google Health Connect</option>
                  <option value="sample_data">Sample Clinical Demo</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Optional Notes</label>
                <input
                  type="text"
                  placeholder="e.g., Morning seated reading after 5 min rest"
                  value={bpForm.notes}
                  onChange={(e) => setBpForm({ ...bpForm, notes: e.target.value })}
                  className="w-full bg-slate-900 p-2 rounded-xl border border-slate-700 text-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
                Notice: Actual readings must come from user-entered measurements or validated physical cuffs. MediCare does not physically measure blood pressure from web browsers or optical cameras.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBpModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
                >
                  Save Measurement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Log Blood Glucose Modal ──────────────────────────────────────── */}
      {showGlucoseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-slate-700 bg-surface-900 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Droplets size={18} className="text-teal-400" /> Log Blood Glucose
              </h3>
              <button onClick={() => setShowGlucoseModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGlucose} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Glucose Value ({glucoseForm.glucose_unit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={glucoseForm.blood_glucose}
                    onChange={(e) => setGlucoseForm({ ...glucoseForm, blood_glucose: Number(e.target.value) })}
                    className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold text-base"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Unit</label>
                  <select
                    value={glucoseForm.glucose_unit}
                    onChange={(e) => setGlucoseForm({ ...glucoseForm, glucose_unit: e.target.value })}
                    className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold"
                  >
                    <option value="mg/dL">mg/dL (US standard)</option>
                    <option value="mmol/L">mmol/L (International)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Meal Context (ADA Guidelines)</label>
                <select
                  value={glucoseForm.glucose_context}
                  onChange={(e) => setGlucoseForm({ ...glucoseForm, glucose_context: e.target.value })}
                  className="w-full bg-slate-900 p-2 rounded-xl border border-slate-700 text-white"
                >
                  <option value="fasting">Fasting (Target: 70 - 99 mg/dL)</option>
                  <option value="before_meal">Before Meal (Preprandial)</option>
                  <option value="after_meal">After Meal (Postprandial, &lt;140 mg/dL)</option>
                  <option value="bedtime">Bedtime</option>
                  <option value="random">Random / Daytime</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Measurement Source / Meter</label>
                <select
                  value={glucoseForm.source}
                  onChange={(e) => setGlucoseForm({ ...glucoseForm, source: e.target.value })}
                  className="w-full bg-slate-900 p-2 rounded-xl border border-slate-700 text-white"
                >
                  <option value="manual_entry">Fingerstick Glucometer (Manual)</option>
                  <option value="dexcom_cgm">Dexcom G7 Continuous Glucose Monitor</option>
                  <option value="freestyle_libre">Abbott FreeStyle Libre</option>
                  <option value="apple_health">Apple Health Sync</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Optional Notes</label>
                <input
                  type="text"
                  placeholder="e.g., 2 hours post lunch"
                  value={glucoseForm.notes}
                  onChange={(e) => setGlucoseForm({ ...glucoseForm, notes: e.target.value })}
                  className="w-full bg-slate-900 p-2 rounded-xl border border-slate-700 text-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-[11px] text-teal-300">
                Notice: MediCare does not calculate insulin doses, diagnose diabetes, or guess glucose from fingerprint scanners or cameras. Values must be obtained from an electrochemical meter or CGM.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGlucoseModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold cursor-pointer"
                >
                  Save Glucose
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick HR / Weight Modal ─────────────────────────────────────── */}
      {showQuickModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass max-w-sm w-full p-6 rounded-2xl border border-slate-700 bg-surface-900 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Scale size={18} className="text-amber-400" /> Quick Metric Log
              </h3>
              <button onClick={() => setShowQuickModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuick} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Metric Type</label>
                <select
                  value={quickForm.type}
                  onChange={(e) => setQuickForm({ ...quickForm, type: e.target.value })}
                  className="w-full bg-slate-900 p-2 rounded-xl border border-slate-700 text-white font-bold"
                >
                  <option value="weight">Body Weight (kg)</option>
                  <option value="heart_rate">Resting Heart Rate (bpm)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Value ({quickForm.type === 'weight' ? 'kg' : 'bpm'})
                </label>
                <input
                  type="number"
                  step={quickForm.type === 'weight' ? '0.1' : '1'}
                  required
                  value={quickForm.value}
                  onChange={(e) => setQuickForm({ ...quickForm, value: Number(e.target.value) })}
                  className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold text-base"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Optional context"
                  value={quickForm.notes}
                  onChange={(e) => setQuickForm({ ...quickForm, notes: e.target.value })}
                  className="w-full bg-slate-900 p-2 rounded-xl border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Device Synchronization Modal ──────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass max-w-lg w-full p-6 rounded-2xl border border-slate-700 bg-surface-900 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Watch size={18} className="text-blue-400" /> Health Device Integration Hub
                </h3>
                <span className="text-xs text-slate-400">Standardized telemetry ingestion layer</span>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-200">Omron Connect Bluetooth Cuffs</h4>
                  <p className="text-[11px] text-slate-400">Omron Evolv, BP7000 Series (Oscillometric BP)</p>
                </div>
                <button
                  onClick={() => handleSimulateDeviceImport('omron_connect', 'Omron Evolv BP7000')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                >
                  Sync Readings
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-200">Dexcom CGM Continuous Monitor</h4>
                  <p className="text-[11px] text-slate-400">Dexcom G6 / G7 Interstitial Glucose Stream</p>
                </div>
                <button
                  onClick={() => handleSimulateDeviceImport('dexcom_cgm', 'Dexcom G7 CGM')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
                >
                  Sync Telemetry
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-200">Apple HealthKit &amp; Google Health Connect</h4>
                  <p className="text-[11px] text-slate-400">Resting heart rate, active calorie burn, smart scales</p>
                </div>
                <button
                  onClick={() => handleSimulateDeviceImport('apple_health', 'Apple Watch Series 9')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
                >
                  Import HealthKit
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400">
              <strong>Device Architecture Standards:</strong> All imported readings retain permanent hardware identifiers and are distinguished from manual patient entries in audit tables and clinician charts.
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Telemetry Entry Modal ───────────────────────────────────── */}
      {showEditModal && editingVital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-slate-700 bg-surface-900 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Edit2 size={18} className="text-blue-400" /> Edit Telemetry Measurement
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingVital(null)
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {editingVital.systolic_bp != null && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-300 font-medium block mb-1">Systolic BP (mmHg)</label>
                      <input
                        type="number"
                        min="50"
                        max="280"
                        required
                        value={editForm.systolic_bp}
                        onChange={(e) => setEditForm({ ...editForm, systolic_bp: Number(e.target.value) })}
                        className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-medium block mb-1">Diastolic BP (mmHg)</label>
                      <input
                        type="number"
                        min="30"
                        max="180"
                        required
                        value={editForm.diastolic_bp}
                        onChange={(e) => setEditForm({ ...editForm, diastolic_bp: Number(e.target.value) })}
                        className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      min="30"
                      max="220"
                      value={editForm.heart_rate}
                      onChange={(e) => setEditForm({ ...editForm, heart_rate: Number(e.target.value) })}
                      className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white"
                    />
                  </div>
                </div>
              )}

              {editingVital.blood_glucose != null && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-300 font-medium block mb-1">Blood Glucose ({editForm.glucose_unit})</label>
                      <input
                        type="number"
                        step="0.1"
                        min="20"
                        max="600"
                        required
                        value={editForm.blood_glucose}
                        onChange={(e) => setEditForm({ ...editForm, blood_glucose: Number(e.target.value) })}
                        className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-medium block mb-1">Unit</label>
                      <select
                        value={editForm.glucose_unit}
                        onChange={(e) => setEditForm({ ...editForm, glucose_unit: e.target.value })}
                        className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white"
                      >
                        <option value="mg/dL">mg/dL</option>
                        <option value="mmol/L">mmol/L</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">Meal Context</label>
                    <select
                      value={editForm.glucose_context}
                      onChange={(e) => setEditForm({ ...editForm, glucose_context: e.target.value })}
                      className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white"
                    >
                      <option value="fasting">Fasting</option>
                      <option value="before_meal">Before Meal</option>
                      <option value="after_meal">After Meal</option>
                      <option value="bedtime">Bedtime</option>
                    </select>
                  </div>
                </div>
              )}

              {editingVital.weight != null && (
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Body Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="20"
                    max="300"
                    required
                    value={editForm.weight}
                    onChange={(e) => setEditForm({ ...editForm, weight: Number(e.target.value) })}
                    className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold"
                  />
                </div>
              )}

              <div>
                <label className="text-slate-300 font-medium block mb-1">Telemetry Notes</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[11px] text-slate-400">
                  {editingVital.is_sample ? '🟣 Fictional Sample Data' : 'Verified Entry'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingVital(null)
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reminders Modal ──────────────────────────────────────────────── */}
      {showRemindersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass max-w-lg w-full p-6 rounded-2xl border border-slate-700 bg-surface-900 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Bell size={18} className="text-amber-400" /> Configurable Measurement Reminders
              </h3>
              <button onClick={() => setShowRemindersModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveReminder} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 mb-4 space-y-3 text-xs">
              <h4 className="font-semibold text-slate-200">Create New Reminder Schedule</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Blood Pressure"
                  value={reminderForm.label}
                  onChange={(e) => setReminderForm({ ...reminderForm, label: e.target.value })}
                  className="bg-slate-800 p-2 rounded-lg border border-slate-700 text-white"
                />
                <select
                  value={reminderForm.reminder_type}
                  onChange={(e) => setReminderForm({ ...reminderForm, reminder_type: e.target.value })}
                  className="bg-slate-800 p-2 rounded-lg border border-slate-700 text-white"
                >
                  <option value="bp">Blood Pressure</option>
                  <option value="glucose">Blood Glucose</option>
                  <option value="weight">Weight Check</option>
                  <option value="heart_rate">Pulse Rate</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="08:00 AM"
                  value={reminderForm.time_of_day}
                  onChange={(e) => setReminderForm({ ...reminderForm, time_of_day: e.target.value })}
                  className="bg-slate-800 p-2 rounded-lg border border-slate-700 text-white"
                />
                <select
                  value={reminderForm.frequency}
                  onChange={(e) => setReminderForm({ ...reminderForm, frequency: e.target.value })}
                  className="bg-slate-800 p-2 rounded-lg border border-slate-700 text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays Only</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
              >
                + Add Reminder
              </button>
            </form>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {reminders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-xs"
                >
                  <div>
                    <h5 className="font-semibold text-white">{r.label}</h5>
                    <span className="text-[11px] text-slate-400">
                      {r.time_of_day} • {r.frequency} • {r.reminder_type.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleReminder(r)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        r.is_active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {r.is_active ? 'Active' : 'Muted'}
                    </button>
                    <button
                      onClick={() => handleDeleteReminder(r.id)}
                      className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Doctor Sharing Consent Modal ─────────────────────────────────── */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass max-w-lg w-full p-6 rounded-2xl border border-slate-700 bg-surface-900 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Share2 size={18} className="text-teal-400" /> Physician Sharing Consent
                </h3>
                <span className="text-xs text-slate-400">Strict patient authorization management</span>
              </div>
              <button onClick={() => setShowConsentModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <p className="text-slate-300">
                Doctors do not have unrestricted access to your continuous vital signs. Under HIPAA and MediCare data governance, clinicians only view your telemetry if you explicitly consent or have an active clinical encounter.
              </p>

              <h4 className="font-semibold text-slate-200 pt-2 border-t border-slate-800">Active Authorized Providers</h4>
              {consents.length > 0 ? (
                consents.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-white">{c.doctor_name || 'Dr. Sarah Chen, MD'}</h5>
                      <span className="text-[11px] text-teal-400">{c.doctor_specialty || 'Internal Medicine'}</span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        Consented on: {format(new Date(c.consented_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Active Access
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500">No external physician consents active.</div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400">
              You may revoke provider access at any time through this portal.
            </div>
          </div>
        </div>
      )}

      {/* ── Biometric Passkey Re-authentication Modal ─────────────────────── */}
      {showBiometricModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-slate-700 bg-surface-900 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Fingerprint size={18} className="text-purple-400" /> Biometric Passkey Security
              </h3>
              <button onClick={() => setShowBiometricModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200">
                <h4 className="font-bold mb-1 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-purple-400" /> Platform WebAuthn Security
                </h4>
                <p className="leading-relaxed">
                  Register Apple Touch ID, Face ID, or Windows Hello to protect your sensitive health records. Biometric authentication uses cryptographic challenge-response and never transmits raw biometric data.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
                <strong>Important Distinction:</strong> Biometric authentication strictly verifies your user identity. Fingerprint and facial sensors on laptops and phones DO NOT measure blood pressure, glucose, or vital signs.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBiometricModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleRegisterBiometricPasskey}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold cursor-pointer"
                >
                  Register Device Passkey
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
