import React, { useState, useEffect, useMemo } from 'react'
import {
  Activity,
  Heart,
  Droplets,
  Scale,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
  Search,
  FileText,
  Clock,
  Sparkles,
  MessageSquare,
  X,
  Stethoscope,
  RefreshCw,
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

interface ConsentedPatient {
  patient_id: string
  mrn: string
  name: string
  email: string
  gender: string
  date_of_birth?: string | null
  has_active_consent: boolean
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

export default function VitalSenseClinical() {
  const [patients, setPatients] = useState<ConsentedPatient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
  const [vitals, setVitals] = useState<VitalSign[]>([])
  const [loadingPatients, setLoadingPatients] = useState(true)
  const [loadingVitals, setLoadingVitals] = useState(false)
  const [timeFilter, setTimeFilter] = useState<number>(90)
  const [vitalType, setVitalType] = useState<string>('all')

  // Note Modal
  const [noteModalVital, setNoteModalVital] = useState<VitalSign | null>(null)
  const [clinicalNoteText, setClinicalNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // 1. Fetch authorized patients
  useEffect(() => {
    const fetchPatients = async () => {
      setLoadingPatients(true)
      try {
        const res = await api.get('/api/v1/vitals/doctor/patients')
        setPatients(res.data)
        if (res.data.length > 0) {
          setSelectedPatientId(res.data[0].patient_id)
        }
      } catch (err) {
        console.error('Failed to load doctor consented patients:', err)
      } finally {
        setLoadingPatients(false)
      }
    }
    fetchPatients()
  }, [])

  // 2. Fetch patient vitals when selected
  const fetchPatientVitals = async () => {
    if (!selectedPatientId) return
    setLoadingVitals(true)
    try {
      const typeParam = vitalType !== 'all' ? `&vital_type=${vitalType}` : ''
      const res = await api.get(
        `/api/v1/vitals/doctor/patients/${selectedPatientId}?days=${timeFilter}${typeParam}`
      )
      setVitals(res.data)
    } catch (err) {
      console.error('Failed to load patient vitals:', err)
    } finally {
      setLoadingVitals(false)
    }
  }

  useEffect(() => {
    fetchPatientVitals()
  }, [selectedPatientId, timeFilter, vitalType])

  const selectedPatient = useMemo(
    () => patients.find((p) => p.patient_id === selectedPatientId),
    [patients, selectedPatientId]
  )

  // 3. Clinical metrics computation
  const metrics = useMemo(() => {
    const bpList = vitals.filter((v) => v.systolic_bp != null)
    const glucList = vitals.filter((v) => v.blood_glucose != null)

    const avgSbp =
      bpList.length > 0
        ? Math.round(bpList.reduce((acc, v) => acc + (v.systolic_bp || 0), 0) / bpList.length)
        : null
    const avgDbp =
      bpList.length > 0
        ? Math.round(bpList.reduce((acc, v) => acc + (v.diastolic_bp || 0), 0) / bpList.length)
        : null
    const mapVal = avgSbp && avgDbp ? Math.round(avgDbp + (avgSbp - avgDbp) / 3.0) : null

    const avgGluc =
      glucList.length > 0
        ? Math.round(glucList.reduce((acc, v) => acc + (v.blood_glucose || 0), 0) / glucList.length)
        : null
    const inRange = glucList.filter((v) => v.blood_glucose! >= 70 && v.blood_glucose! <= 180).length
    const tirPct = glucList.length > 0 ? Math.round((inRange / glucList.length) * 100) : 0
    const hypoCount = glucList.filter((v) => v.blood_glucose! < 70).length
    const crisisCount = bpList.filter(
      (v) => (v.systolic_bp || 0) > 180 || (v.diastolic_bp || 0) > 120
    ).length

    return { avgSbp, avgDbp, mapVal, avgGluc, tirPct, hypoCount, crisisCount, total: vitals.length }
  }, [vitals])

  // Chart data
  const chartData = useMemo(() => {
    return [...vitals]
      .reverse()
      .map((v) => ({
        date: format(new Date(v.recorded_at), 'MM/dd'),
        systolic: v.systolic_bp || null,
        diastolic: v.diastolic_bp || null,
        glucose: v.blood_glucose || null,
        weight: v.weight || null,
      }))
  }, [vitals])

  // 4. Save clinical follow-up note
  const handleSaveClinicalNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteModalVital || !selectedPatientId) return
    setSavingNote(true)
    try {
      await api.post(
        `/api/v1/vitals/doctor/patients/${selectedPatientId}/vitals/${noteModalVital.id}/notes`,
        { clinical_notes: clinicalNoteText }
      )
      setNoteModalVital(null)
      setClinicalNoteText('')
      fetchPatientVitals()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to document clinical note')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
              <Stethoscope size={13} /> Doctor Portal • VitalSense Clinical Review
            </span>
            <span className="text-xs text-slate-400">Strict Patient-Consented Access</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-white">Physician Telemetry Review</h1>
          <p className="text-sm text-slate-400">
            Inspect patient-shared home measurements, review longitudinal AHA/ADA trends, and document follow-up clinical instructions.
          </p>
        </div>

        {/* Patient Selection Bar */}
        <div className="flex items-center gap-3 bg-surface-900 p-2.5 rounded-2xl border border-slate-800">
          <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 pl-1">
            <UserCheck size={14} className="text-teal-400" /> Patient Chart:
          </label>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            disabled={loadingPatients || patients.length === 0}
            className="bg-slate-800 text-white font-semibold text-xs px-3 py-1.5 rounded-xl border border-slate-700 outline-none cursor-pointer min-w-[220px]"
          >
            {patients.map((p) => (
              <option key={p.patient_id} value={p.patient_id}>
                {p.name} ({p.mrn})
              </option>
            ))}
            {patients.length === 0 && <option>No consented patients found</option>}
          </select>
          <button
            onClick={fetchPatientVitals}
            title="Refresh patient telemetry"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
          >
            <RefreshCw size={14} className={loadingVitals ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Active Consent & Patient Banner ───────────────────────────────── */}
      {selectedPatient && (
        <div className="glass p-4 rounded-2xl border border-teal-500/30 bg-teal-950/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
              {selectedPatient.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">{selectedPatient.name}</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  MRN: {selectedPatient.mrn}
                </span>
                <span className="text-xs text-slate-400 capitalize">{selectedPatient.gender}</span>
              </div>
              <span className="text-xs text-slate-400">
                Email: {selectedPatient.email} {selectedPatient.date_of_birth && `• DOB: ${selectedPatient.date_of_birth}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <ShieldCheck size={16} className="text-emerald-400" />
            Verified Patient Consent Active (HIPAA Telemetry Protocol)
          </div>
        </div>
      )}

      {/* ── Clinician Summary Metric Cards ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-2xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400 block mb-1">Average Blood Pressure</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-blue-400">
              {metrics.avgSbp ? `${metrics.avgSbp}/${metrics.avgDbp}` : '--'}
            </span>
            <span className="text-xs text-slate-400">mmHg</span>
          </div>
          <span className="text-[11px] text-teal-400 mt-1 block">
            MAP: {metrics.mapVal ? `${metrics.mapVal} mmHg` : '--'}
          </span>
        </div>

        <div className="glass p-4 rounded-2xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400 block mb-1">Glucose Time in Range</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-emerald-400">{metrics.tirPct}%</span>
            <span className="text-xs text-slate-400">target (70-180)</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Mean: {metrics.avgGluc ? `${metrics.avgGluc} mg/dL` : '--'}
          </span>
        </div>

        <div className="glass p-4 rounded-2xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400 block mb-1">Clinical Safety Flags</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${metrics.crisisCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
              {metrics.crisisCount}
            </span>
            <span className="text-xs text-slate-400">Crisis BP (&gt;180/120)</span>
          </div>
          <span className="text-[11px] text-rose-400 mt-1 block">
            Hypoglycemia Events: {metrics.hypoCount}
          </span>
        </div>

        <div className="glass p-4 rounded-2xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400 block mb-1">Telemetry Cohort</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white">{metrics.total}</span>
            <span className="text-xs text-slate-400">readings ({timeFilter}D window)</span>
          </div>
          <span className="text-[11px] text-amber-400 mt-1 block">
            Source: Home Cuffs &amp; Continuous CGM
          </span>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="glass p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <Calendar size={13} /> Evaluation Period:
          </span>
          <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-slate-800">
            {[30, 60, 90, 180, 365].map((d) => (
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
            <Filter size={13} /> Modality:
          </span>
          <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'all', label: 'All Telemetry' },
              { id: 'bp', label: 'Blood Pressure' },
              { id: 'glucose', label: 'Glucose' },
              { id: 'weight', label: 'Weight' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setVitalType(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  vitalType === tab.id ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Longitudinal Trend Charts ─────────────────────────────────────── */}
      <div className="glass p-5 rounded-2xl">
        <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
          <Activity size={16} className="text-blue-400" /> Longitudinal Telemetry Trend
        </h3>

        <div className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[50, 200]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f2040',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine y={120} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'SBP 120', fill: '#10b981', fontSize: 10 }} />
                <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'DBP 80', fill: '#10b981', fontSize: 10 }} />
                <Line type="monotone" dataKey="systolic" stroke="#3182f4" strokeWidth={2} dot={{ r: 2 }} name="Systolic BP" />
                <Line type="monotone" dataKey="diastolic" stroke="#14b8a6" strokeWidth={2} dot={{ r: 2 }} name="Diastolic BP" />
                <Line type="monotone" dataKey="glucose" stroke="#06b6d4" strokeWidth={2} dot={{ r: 2 }} name="Blood Glucose" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              No telemetry available for this filter.
            </div>
          )}
        </div>
      </div>

      {/* ── Patient Telemetry Table & Document Notes ──────────────────────── */}
      <div className="glass rounded-2xl overflow-hidden border border-slate-800">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">Patient Telemetry Records</h3>
            <span className="text-xs text-slate-400">Click "+ Document Note" to affix a physician follow-up note</span>
          </div>
          <span className="text-xs font-mono text-slate-400">{vitals.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Telemetry Measurement</th>
                <th className="p-3.5">Guideline Classification</th>
                <th className="p-3.5">Hardware / Source</th>
                <th className="p-3.5">Physician Clinical Follow-up Notes</th>
                <th className="p-3.5 text-right">Clinical Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {vitals.map((v) => (
                <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-3.5 text-slate-300 font-mono">
                    {format(new Date(v.recorded_at), 'yyyy-MM-dd HH:mm')}
                  </td>
                  <td className="p-3.5 font-medium text-white">
                    {v.systolic_bp != null && (
                      <span className="text-blue-400 font-bold text-sm">
                        {v.systolic_bp}/{v.diastolic_bp} mmHg
                      </span>
                    )}
                    {v.blood_glucose != null && (
                      <span className="text-teal-400 font-bold text-sm">
                        {v.blood_glucose} mg/dL ({v.blood_glucose_mmol} mmol/L)
                      </span>
                    )}
                    {v.weight != null && (
                      <span className="text-amber-400 font-bold text-sm">{v.weight} kg</span>
                    )}
                  </td>
                  <td className="p-3.5">
                    {v.bp_category && (
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-200 border border-slate-700">
                        {v.bp_category}
                      </span>
                    )}
                    {v.glucose_category && (
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-200 border border-slate-700">
                        {v.glucose_category}
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-400 border border-slate-700">
                      {v.device_name || v.measurement_source}
                    </span>
                  </td>
                  <td className="p-3.5 max-w-sm">
                    {v.clinical_notes ? (
                      <span className="text-blue-300 font-medium">{v.clinical_notes}</span>
                    ) : (
                      <span className="text-slate-500 italic">No physician note documented yet</span>
                    )}
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => {
                        setNoteModalVital(v)
                        setClinicalNoteText(v.clinical_notes || '')
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 cursor-pointer transition-all"
                    >
                      + Document Note
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Document Clinical Note Modal ──────────────────────────────────── */}
      {noteModalVital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-slate-700 bg-surface-900 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2">
                <FileText size={18} className="text-blue-400" /> Document Physician Follow-up Note
              </h3>
              <button onClick={() => setNoteModalVital(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveClinicalNote} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300">
                <div>Patient: <strong>{selectedPatient?.name}</strong> (MRN: {selectedPatient?.mrn})</div>
                <div>Measurement: {noteModalVital.systolic_bp ? `${noteModalVital.systolic_bp}/${noteModalVital.diastolic_bp} mmHg` : `${noteModalVital.blood_glucose} mg/dL`}</div>
                <div>Timestamp: {format(new Date(noteModalVital.recorded_at), 'yyyy-MM-dd HH:mm UTC')}</div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Physician Assessment / Follow-up Instructions
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="e.g. Telemetry reviewed. Blood pressure well controlled on current regimen. Continue morning home logs twice weekly."
                  value={clinicalNoteText}
                  onChange={(e) => setClinicalNoteText(e.target.value)}
                  className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white text-xs leading-relaxed"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
                Notice: Saving will append your electronic physician signature, clinical specialty, and audit timestamp.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNoteModalVital(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNote}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {savingNote ? 'Signing Note...' : 'Save & Sign Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
