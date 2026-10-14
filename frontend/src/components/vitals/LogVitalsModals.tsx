import React, { useState } from 'react'
import {
  Heart,
  Droplets,
  Activity,
  Scale,
  X,
  Clock,
  FileText,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import { api } from '@/lib/api'

// Helper for local ISO string for datetime-local input
const getLocalDatetimeString = (date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

// -----------------------------------------------------------------------------
// 1. Log Blood Pressure Modal
// -----------------------------------------------------------------------------
export interface LogBpModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const LogBpModal: React.FC<LogBpModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [systolic, setSystolic] = useState<string>('120')
  const [diastolic, setDiastolic] = useState<string>('80')
  const [pulse, setPulse] = useState<string>('72')
  const [source, setSource] = useState<string>('manual_home_cuff')
  const [recordedAt, setRecordedAt] = useState<string>(getLocalDatetimeString())
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const sys = Number(systolic)
    const dia = Number(diastolic)
    const hr = pulse ? Number(pulse) : null

    if (isNaN(sys) || sys < 60 || sys > 260) {
      setError('Systolic blood pressure must be between 60 and 260 mmHg.')
      return
    }
    if (isNaN(dia) || dia < 40 || dia > 160) {
      setError('Diastolic blood pressure must be between 40 and 160 mmHg.')
      return
    }
    if (sys <= dia) {
      setError('Systolic pressure must be greater than diastolic pressure.')
      return
    }

    try {
      setSubmitting(true)
      await api.post('/api/v1/vitals/blood-pressure', {
        systolic_bp: sys,
        diastolic_bp: dia,
        heart_rate: hr,
        measurement_source: source,
        recorded_at: recordedAt ? new Date(recordedAt).toISOString() : new Date().toISOString(),
        notes: notes.trim() || undefined,
        is_sample: false,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to record blood pressure reading.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="rounded-2xl border border-slate-700 bg-slate-900 max-w-md w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center">
              <Heart size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Record Blood Pressure</h3>
              <p className="text-[11px] text-slate-400">Manual entry from validated cuff</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Pressure inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Systolic (mmHg) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="60"
                max="260"
                required
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-white font-mono font-bold text-sm focus:outline-none focus:border-teal-500"
                placeholder="120"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Normal &lt; 120</span>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Diastolic (mmHg) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="40"
                max="160"
                required
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-white font-mono font-bold text-sm focus:outline-none focus:border-teal-500"
                placeholder="80"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Normal &lt; 80</span>
            </div>
          </div>

          {/* Pulse input */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Pulse / Heart Rate (bpm, optional)
            </label>
            <input
              type="number"
              min="30"
              max="220"
              value={pulse}
              onChange={(e) => setPulse(e.target.value)}
              className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-teal-500"
              placeholder="72"
            />
          </div>

          {/* Measurement Source */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Measurement Source / Device Method
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-200 focus:outline-none focus:border-teal-500"
            >
              <option value="manual_home_cuff">Home Inflatable Upper-Arm Cuff</option>
              <option value="manual_sphygmomanometer">Manual Sphygmomanometer (Clinical Desk)</option>
              <option value="manual_wrist">Wrist Blood Pressure Monitor</option>
              <option value="manual_clinic">Physician / Clinic Visit Reading</option>
            </select>
          </div>

          {/* Date & Time */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Date &amp; Time of Measurement
            </label>
            <input
              type="datetime-local"
              required
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Clinical Context / Patient Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Morning seated resting measurement"
              className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Provenance Disclosure */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <FileText size={12} className="text-teal-400" />
              <span>Data Provenance Guarantee:</span>
            </div>
            <p>
              This measurement will be permanently tagged as{' '}
              <strong className="text-teal-300 font-mono">Manual Entry — Not Device Verified</strong>{' '}
              with <code className="text-slate-300">is_sample=False</code>.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-md shadow-teal-600/30 cursor-pointer transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Blood Pressure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 2. Log Blood Glucose Modal
// -----------------------------------------------------------------------------
export interface LogGlucoseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const LogGlucoseModal: React.FC<LogGlucoseModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [glucoseUnit, setGlucoseUnit] = useState<'mg/dL' | 'mmol/L'>('mg/dL')
  const [glucoseValue, setGlucoseValue] = useState<string>('95')
  const [context, setContext] = useState<string>('fasting')
  const [source, setSource] = useState<string>('manual_fingerstick')
  const [recordedAt, setRecordedAt] = useState<string>(getLocalDatetimeString())
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  // Derived live conversion
  const numericVal = parseFloat(glucoseValue)
  const convertedPreview = !isNaN(numericVal) && numericVal > 0
    ? glucoseUnit === 'mg/dL'
      ? `${(numericVal / 18.0182).toFixed(2)} mmol/L`
      : `${(numericVal * 18.0182).toFixed(1)} mg/dL`
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const val = parseFloat(glucoseValue)
    if (isNaN(val) || val <= 0) {
      setError('Please provide a valid positive blood glucose value.')
      return
    }

    if (glucoseUnit === 'mg/dL' && (val < 20 || val > 600)) {
      setError('Blood glucose in mg/dL must fall within physiological range (20 - 600 mg/dL).')
      return
    }
    if (glucoseUnit === 'mmol/L' && (val < 1.1 || val > 33.3)) {
      setError('Blood glucose in mmol/L must fall within physiological range (1.1 - 33.3 mmol/L).')
      return
    }

    try {
      setSubmitting(true)
      await api.post('/api/v1/vitals/blood-glucose', {
        blood_glucose: val,
        glucose_unit: glucoseUnit,
        glucose_context: context,
        measurement_source: source,
        recorded_at: recordedAt ? new Date(recordedAt).toISOString() : new Date().toISOString(),
        notes: notes.trim() || undefined,
        is_sample: false,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to record blood glucose reading.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="rounded-2xl border border-slate-700 bg-slate-900 max-w-md w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <Droplets size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Record Blood Glucose</h3>
              <p className="text-[11px] text-slate-400">Manual entry from test strip or lab</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Unit Toggle & Value */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-medium">
                Glucose Reading <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setGlucoseUnit('mg/dL')}
                  className={`px-2 py-0.5 rounded font-mono font-medium transition-all cursor-pointer ${
                    glucoseUnit === 'mg/dL' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  mg/dL
                </button>
                <button
                  type="button"
                  onClick={() => setGlucoseUnit('mmol/L')}
                  className={`px-2 py-0.5 rounded font-mono font-medium transition-all cursor-pointer ${
                    glucoseUnit === 'mmol/L' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  mmol/L
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.1"
                required
                value={glucoseValue}
                onChange={(e) => setGlucoseValue(e.target.value)}
                className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-500"
                placeholder={glucoseUnit === 'mg/dL' ? '95' : '5.3'}
              />
              {convertedPreview && (
                <span className="absolute right-3 top-2.5 text-xs font-mono text-cyan-400/80">
                  ≈ {convertedPreview}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {glucoseUnit === 'mg/dL'
                ? 'Standard fasting normal: 70 - 99 mg/dL'
                : 'Standard fasting normal: 3.9 - 5.5 mmol/L'}
            </span>
          </div>

          {/* Metabolic Context */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Metabolic Context (ADA Guideline Standard)
            </label>
            <select
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="fasting">Fasting (&gt;8h without food)</option>
              <option value="before_meal">Pre-Meal / Preprandial (Before eating)</option>
              <option value="after_meal">Postprandial (1 to 2 hours after meal)</option>
              <option value="bedtime">Bedtime / Nocturnal</option>
              <option value="random">Random / Unspecified</option>
            </select>
          </div>

          {/* Measurement Source */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Measurement Source / Device Method
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="manual_fingerstick">Home Electrochemical Test Strip Meter</option>
              <option value="manual_lab">Laboratory Serum Venipuncture Report</option>
              <option value="manual_cgm">Continuous Glucose Monitor Transcribed Log</option>
            </select>
          </div>

          {/* Date & Time */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Date &amp; Time of Measurement
            </label>
            <input
              type="datetime-local"
              required
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Notes (Food, activity, or symptoms)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Morning fasting test strip check"
              className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Provenance Disclosure */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <FileText size={12} className="text-cyan-400" />
              <span>Data Provenance Guarantee:</span>
            </div>
            <p>
              This measurement will be permanently tagged as{' '}
              <strong className="text-cyan-300 font-mono">Manual Entry — Not Device Verified</strong>{' '}
              with <code className="text-slate-300">is_sample=False</code>.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-md shadow-cyan-600/30 cursor-pointer transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Blood Glucose'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 3. Log Other Vitals (Heart Rate & Body Weight) Modal
// -----------------------------------------------------------------------------
export interface LogOtherVitalsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const LogOtherVitalsModal: React.FC<LogOtherVitalsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [vitalType, setVitalType] = useState<'both' | 'hr' | 'weight'>('both')
  const [heartRate, setHeartRate] = useState<string>('72')
  const [weight, setWeight] = useState<string>('70')
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg')
  const [recordedAt, setRecordedAt] = useState<string>(getLocalDatetimeString())
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const dateIso = recordedAt ? new Date(recordedAt).toISOString() : new Date().toISOString()
    const promises: Promise<any>[] = []

    if (vitalType === 'both' || vitalType === 'hr') {
      const hr = Number(heartRate)
      if (isNaN(hr) || hr < 30 || hr > 220) {
        setError('Heart rate must be between 30 and 220 bpm.')
        return
      }
      promises.push(
        api.post('/api/v1/vitals/heart-rate', {
          heart_rate: hr,
          measurement_source: 'manual_pulse',
          recorded_at: dateIso,
          notes: notes.trim() || undefined,
          is_sample: false,
        })
      )
    }

    if (vitalType === 'both' || vitalType === 'weight') {
      let wt = parseFloat(weight)
      if (isNaN(wt) || wt <= 0) {
        setError('Please enter a valid body weight.')
        return
      }
      if (weightUnit === 'lbs') {
        wt = parseFloat((wt / 2.20462).toFixed(1))
      }
      if (wt < 20 || wt > 350) {
        setError('Body weight in kg must fall within 20 - 350 kg.')
        return
      }
      promises.push(
        api.post('/api/v1/vitals/weight', {
          weight: wt,
          measurement_source: 'manual_scale',
          recorded_at: dateIso,
          notes: notes.trim() || undefined,
          is_sample: false,
        })
      )
    }

    try {
      setSubmitting(true)
      await Promise.all(promises)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to record vitals.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="rounded-2xl border border-slate-700 bg-slate-900 max-w-md w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Scale size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Record Pulse &amp; Body Weight</h3>
              <p className="text-[11px] text-slate-400">Manual log from calibrated scale or pulse check</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Type Selector */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">Telemetry to Record</label>
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-center font-medium">
              <button
                type="button"
                onClick={() => setVitalType('both')}
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                  vitalType === 'both' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400'
                }`}
              >
                Pulse &amp; Weight
              </button>
              <button
                type="button"
                onClick={() => setVitalType('hr')}
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                  vitalType === 'hr' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400'
                }`}
              >
                Pulse Only
              </button>
              <button
                type="button"
                onClick={() => setVitalType('weight')}
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                  vitalType === 'weight' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400'
                }`}
              >
                Weight Only
              </button>
            </div>
          </div>

          {/* Heart Rate Input */}
          {(vitalType === 'both' || vitalType === 'hr') && (
            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Resting Heart Rate (bpm)
              </label>
              <input
                type="number"
                min="30"
                max="220"
                required={vitalType === 'hr'}
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-white font-mono font-bold text-sm focus:outline-none focus:border-rose-500"
                placeholder="72"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Normal resting: 60 - 100 bpm</span>
            </div>
          )}

          {/* Weight Input */}
          {(vitalType === 'both' || vitalType === 'weight') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">Body Weight</label>
                <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setWeightUnit('kg')}
                    className={`px-2 py-0.5 rounded font-mono font-medium transition-all cursor-pointer ${
                      weightUnit === 'kg' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeightUnit('lbs')}
                    className={`px-2 py-0.5 rounded font-mono font-medium transition-all cursor-pointer ${
                      weightUnit === 'lbs' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    lbs
                  </button>
                </div>
              </div>

              <input
                type="number"
                step="0.1"
                required={vitalType === 'weight'}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                placeholder={weightUnit === 'kg' ? '70' : '154'}
              />
            </div>
          )}

          {/* Date & Time */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Date &amp; Time of Measurement
            </label>
            <input
              type="datetime-local"
              required
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Post-workout or morning check"
              className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-md shadow-amber-600/30 cursor-pointer transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Vitals'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
