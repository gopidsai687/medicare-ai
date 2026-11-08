import React, { useState } from 'react'
import {
  X,
  Plus,
  AlertCircle,
  FlaskConical,
  Check,
  Upload,
  Calendar,
  Clock,
  Home,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Cpu,
} from 'lucide-react'
import api from '@/lib/api'

export interface LabResultItem {
  id: string
  name: string
  panel_name: string
  category: string
  result_type?: string
  value: number
  unit: string
  rangeMin: number
  rangeMax: number
  reference_range?: string
  status: string
  trend: string
  date: string
  measurement_time?: string
  measurement_type?: string
  fasting_status?: string
  device_name?: string
  repeat_value?: number
  repeat_time?: string
  repeat_notes?: string
  is_repeat_measurement?: boolean
  educational_notice?: string
  orderedBy: string
  laboratory_name?: string
  clinical_notes?: string
  report_url?: string
  source: string
  is_amended?: boolean
  amendment_reason?: string
  original_value?: number
  is_archived?: boolean
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newLab: LabResultItem) => void
}

type ModeType = 'lab_result' | 'home_monitoring' | 'patient_reported'

const LAB_CATEGORIES = [
  'Comprehensive Metabolic Panel (CMP)',
  'Complete Blood Count (CBC)',
  'Lipid Panel',
  'HbA1c',
  'Thyroid Function Tests',
  'Kidney Function Tests',
  'Liver Function Tests',
  'Urinalysis',
  'Other',
]

const HOME_CATEGORIES = [
  'Home Blood Glucose',
  'Blood Pressure Monitoring',
  'Home Telemetry',
]

const DEFAULT_LAB_SUGGESTIONS: Record<string, { name: string; unit: string; range: string }> = {
  'HbA1c': { name: 'Hemoglobin A1c (Venipuncture)', unit: '%', range: '4.0 – 5.6 %' },
  'Comprehensive Metabolic Panel (CMP)': { name: 'Fasting Plasma Glucose (CMP)', unit: 'mg/dL', range: '70 – 99 mg/dL' },
  'Lipid Panel': { name: 'Total Cholesterol', unit: 'mg/dL', range: '125 – 200 mg/dL' },
  'Thyroid Function Tests': { name: 'TSH (Thyroid Stimulating Hormone)', unit: 'uIU/mL', range: '0.4 – 4.0 uIU/mL' },
  'Complete Blood Count (CBC)': { name: 'White Blood Cell Count (WBC)', unit: 'K/uL', range: '4.5 – 11.0 K/uL' },
  'Kidney Function Tests': { name: 'Serum Creatinine', unit: 'mg/dL', range: '0.6 – 1.2 mg/dL' },
  'Liver Function Tests': { name: 'ALT (Alanine Aminotransferase)', unit: 'U/L', range: '7 – 56 U/L' },
  'Urinalysis': { name: 'Urine Specific Gravity', unit: '', range: '1.005 – 1.030' },
  'Other': { name: 'Diagnostic Biomarker', unit: 'mg/dL', range: 'Standard Range' },
}

const DEFAULT_HOME_SUGGESTIONS: Record<string, { name: string; unit: string; range: string; device: string }> = {
  'Home Blood Glucose': {
    name: 'Blood Glucose (Fasting Fingerstick)',
    unit: 'mg/dL',
    range: '70 – 99 mg/dL (Home Target: 80 – 130 mg/dL)',
    device: 'Contour Next Gen Meter',
  },
  'Blood Pressure Monitoring': {
    name: 'Blood Pressure (Home Digital Cuff)',
    unit: 'mmHg',
    range: '90/60 – 120/80 mmHg',
    device: 'Omron BP7450',
  },
  'Home Telemetry': {
    name: 'Capillary Glucose Check',
    unit: 'mg/dL',
    range: '70 – 130 mg/dL',
    device: 'Accu-Chek Guide',
  },
}

export const AddLabResultModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<ModeType>('lab_result')

  // Common Fields
  const [category, setCategory] = useState(LAB_CATEGORIES[0])
  const [testName, setTestName] = useState(DEFAULT_LAB_SUGGESTIONS[LAB_CATEGORIES[0]].name)
  const [value, setValue] = useState<string>('')
  const [unit, setUnit] = useState(DEFAULT_LAB_SUGGESTIONS[LAB_CATEGORIES[0]].unit)
  const [referenceRange, setReferenceRange] = useState(DEFAULT_LAB_SUGGESTIONS[LAB_CATEGORIES[0]].range)
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0])
  const [measurementTime, setMeasurementTime] = useState('08:00')

  // Provenance / Device Fields
  const [orderingPhysician, setOrderingPhysician] = useState('')
  const [laboratoryName, setLaboratoryName] = useState('MediCare Central Pathology')
  const [deviceName, setDeviceName] = useState('Contour Next Gen Meter')
  const [fastingStatus, setFastingStatus] = useState('Fasting (Overnight 8+ hrs)')
  const [measurementType, setMeasurementType] = useState('Fasting Blood Glucose (Fingerstick)')
  const [clinicalNotes, setClinicalNotes] = useState('')

  // Repeat Check Fields (Requirement 2)
  const [hasRepeatReading, setHasRepeatReading] = useState(false)
  const [repeatValue, setRepeatValue] = useState<string>('')
  const [repeatTime, setRepeatTime] = useState('08:05')
  const [repeatNotes, setRepeatNotes] = useState('Repeat check on second fingerstick to verify calibration')

  // Duplicate Detection State (Requirement 1)
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleModeChange = (newMode: ModeType) => {
    setMode(newMode)
    setDuplicateWarning(null)
    setErrorMessage(null)

    if (newMode === 'home_monitoring') {
      const defCat = HOME_CATEGORIES[0]
      const def = DEFAULT_HOME_SUGGESTIONS[defCat]
      setCategory(defCat)
      setTestName(def.name)
      setUnit(def.unit)
      setReferenceRange(def.range)
      setDeviceName(def.device)
      setOrderingPhysician(`Source: ${def.device}`)
      setLaboratoryName(def.device)
      setMeasurementType('Home Fasting Glucose (Capillary Fingerstick)')
      setFastingStatus('Fasting (Overnight 8+ hrs)')
    } else {
      const defCat = LAB_CATEGORIES[0]
      const def = DEFAULT_LAB_SUGGESTIONS[defCat]
      setCategory(defCat)
      setTestName(def.name)
      setUnit(def.unit)
      setReferenceRange(def.range)
      setOrderingPhysician(newMode === 'lab_result' ? 'Attending Physician' : 'Patient Self-Transcribed')
      setLaboratoryName(newMode === 'lab_result' ? 'MediCare Central Pathology' : 'Outside Clinical Lab')
      setDeviceName('')
      setMeasurementType('Laboratory Venipuncture Plasma')
    }
  }

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat)
    if (mode === 'home_monitoring') {
      const def = DEFAULT_HOME_SUGGESTIONS[newCat] || DEFAULT_HOME_SUGGESTIONS['Home Blood Glucose']
      setTestName(def.name)
      setUnit(def.unit)
      setReferenceRange(def.range)
      setDeviceName(def.device)
      setOrderingPhysician(`Source: ${def.device}`)
    } else {
      const def = DEFAULT_LAB_SUGGESTIONS[newCat] || DEFAULT_LAB_SUGGESTIONS['Other']
      setTestName(def.name)
      setUnit(def.unit)
      setReferenceRange(def.range)
    }
  }

  const submitRecord = async (isRepeatConfirmed: boolean = false) => {
    if (!testName.trim()) {
      setErrorMessage('Test analyte name is required.')
      return
    }
    const numVal = parseFloat(value)
    if (isNaN(numVal)) {
      setErrorMessage('Please enter a valid numerical result value.')
      return
    }

    const repVal = hasRepeatReading && repeatValue.trim() ? parseFloat(repeatValue) : undefined
    if (hasRepeatReading && repVal !== undefined && isNaN(repVal)) {
      setErrorMessage('Please enter a valid numerical repeat check value.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const isHome = mode === 'home_monitoring'
      const payload = {
        test_name: testName.trim(),
        category: isHome ? 'Home Monitoring' : category.split(' (')[0],
        panel_name: isHome ? (category === 'Home Blood Glucose' ? 'Home Glycemic Diary' : 'Home Telemetry') : category,
        result_type: mode,
        value: numVal,
        unit: unit.trim(),
        reference_range: referenceRange.trim() || undefined,
        test_date: testDate,
        measurement_time: measurementTime.trim() || undefined,
        measurement_type: isHome ? measurementType : 'Laboratory Analyte',
        fasting_status: isHome ? fastingStatus : undefined,
        device_name: isHome ? deviceName.trim() : undefined,
        repeat_value: repVal,
        repeat_time: hasRepeatReading ? repeatTime.trim() : undefined,
        repeat_notes: hasRepeatReading ? repeatNotes.trim() : undefined,
        is_repeat_measurement: isRepeatConfirmed || hasRepeatReading,
        allow_duplicate: isRepeatConfirmed,
        ordering_physician: isHome ? `Source: ${deviceName.trim() || 'Home Glucose Meter'}` : (orderingPhysician.trim() || undefined),
        laboratory_name: isHome ? (deviceName.trim() || 'Home Glucose Meter') : (laboratoryName.trim() || undefined),
        clinical_notes: clinicalNotes.trim() || undefined,
      }

      const res = await api.post('/api/v1/labs/results', payload)
      onSuccess(res.data)
      onClose()
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.detail?.code === 'DUPLICATE_MEASUREMENT_DETECTED') {
        setDuplicateWarning(err.response.data.detail)
      } else {
        const msg = err.response?.data?.detail
        setErrorMessage(typeof msg === 'string' ? msg : 'Failed to record diagnostic result.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitRecord(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl p-6 md:p-8 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${mode === 'home_monitoring' ? 'bg-cyan-600/20 text-cyan-400' : 'bg-emerald-600/20 text-emerald-400'}`}>
              {mode === 'home_monitoring' ? <Home className="w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add Diagnostic Measurement</h3>
              <p className="text-xs text-slate-400">Segregated laboratory panels and home monitoring telemetry</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Mode Selection Tabs (Requirement 3: Clear Category Segregation) ── */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950/60 rounded-2xl border border-slate-800/80">
          <button
            type="button"
            onClick={() => handleModeChange('lab_result')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'lab_result'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FlaskConical size={14} /> Certified Lab Result
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('home_monitoring')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'home_monitoring'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home size={14} /> Home Monitoring
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('patient_reported')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'patient_reported'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheck size={14} /> Patient-Reported
          </button>
        </div>

        {/* Clinical Integrity & Educational Notice (Requirement 8) */}
        {mode === 'home_monitoring' ? (
          <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-cyan-300">
              <AlertCircle size={15} /> Home Monitoring Integrity Notice
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Home glucose meter readings reflect capillary self-monitoring with standard ISO 15197 variance (±15%).
              They are classified as <strong>Home Monitoring</strong>, not certified diagnostic laboratory plasma glucose.
              A single home reading does not constitute a clinical diagnosis of diabetes.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong>Certified Diagnostic Entry:</strong> This record will be linked directly to your clinical EHR medical history with laboratory reference intervals.
            </div>
          </div>
        )}

        {/* ── Duplicate Review Warning (Requirement 1: Offer Review of Duplicates) ── */}
        {duplicateWarning && (
          <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 text-xs text-amber-200 space-y-3 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-300 text-sm">Potential Duplicate Measurement Detected</h4>
                <p className="text-[11px] text-slate-300 mt-0.5">{duplicateWarning.message}</p>
              </div>
            </div>

            {duplicateWarning.existing_record && (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/20 text-[11px] space-y-1 font-mono">
                <div><strong>Existing Analyte:</strong> {duplicateWarning.existing_record.test_name}</div>
                <div><strong>Value:</strong> {duplicateWarning.existing_record.value} {duplicateWarning.existing_record.unit} on {duplicateWarning.existing_record.test_date}</div>
                {duplicateWarning.existing_record.measurement_time && (
                  <div><strong>Time:</strong> {duplicateWarning.existing_record.measurement_time}</div>
                )}
                {duplicateWarning.existing_record.device_name && (
                  <div><strong>Device:</strong> {duplicateWarning.existing_record.device_name}</div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel / Edit Value
              </button>
              <button
                type="button"
                onClick={() => submitRecord(true)}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} /> Confirm as Legitimate Repeat Measurement
              </button>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-300">
          {/* Category Dropdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {mode === 'home_monitoring' ? 'Monitoring Category *' : 'Laboratory Category *'}
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {(mode === 'home_monitoring' ? HOME_CATEGORIES : LAB_CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Measurement Analyte Name *
              </label>
              <input
                type="text"
                required
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="e.g. Blood Glucose (Fasting Fingerstick), Serum Creatinine"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Primary Measurement Value & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {hasRepeatReading ? 'Initial Reading Value *' : 'Reading Value *'}
              </label>
              <input
                type="number"
                step="any"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. 108"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Unit of Measure *
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. mg/dL, %, mmol/L"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Measurement Date & Timestamp (Requirement 4) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {mode === 'home_monitoring' ? 'Measurement Date *' : 'Specimen Collection Date *'}
              </label>
              <input
                type="date"
                required
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                <Clock size={12} /> Measurement Time
              </label>
              <input
                type="time"
                value={measurementTime}
                onChange={(e) => setMeasurementTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Home Monitoring Metadata (Requirement 4) */}
          {mode === 'home_monitoring' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                  <Cpu size={12} /> Device Used (Source)
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => {
                    setDeviceName(e.target.value)
                    setOrderingPhysician(`Source: ${e.target.value}`)
                  }}
                  placeholder="e.g. Contour Next Gen Meter"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Fasting / Meal State
                </label>
                <select
                  value={fastingStatus}
                  onChange={(e) => setFastingStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Fasting (Overnight 8+ hrs)">Fasting (Overnight 8+ hrs)</option>
                  <option value="Post-Prandial (2 hrs post-meal)">Post-Prandial (2 hrs post-meal)</option>
                  <option value="Random / Pre-Meal">Random / Pre-Meal</option>
                  <option value="Bedtime Check">Bedtime Check</option>
                </select>
              </div>
            </div>
          )}

          {/* ── Repeat Check Feature (Requirement 2: Store Original & Repeat Readings) ── */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white">
                <input
                  type="checkbox"
                  checked={hasRepeatReading}
                  onChange={(e) => setHasRepeatReading(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-cyan-600 focus:ring-0 focus:ring-offset-0 bg-slate-950"
                />
                <span className="flex items-center gap-1.5">
                  <RotateCcw size={13} className="text-cyan-400" />
                  Record Immediate Repeat Verification Reading (e.g. 108 mg/dL vs 110 mg/dL check)
                </span>
              </label>
            </div>

            {hasRepeatReading && (
              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 space-y-3 animate-in fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Repeat Check Value ({unit}) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required={hasRepeatReading}
                      value={repeatValue}
                      onChange={(e) => setRepeatValue(e.target.value)}
                      placeholder="e.g. 110"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                      <Clock size={12} /> Repeat Check Time
                    </label>
                    <input
                      type="time"
                      value={repeatTime}
                      onChange={(e) => setRepeatTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Repeat Verification Note
                  </label>
                  <input
                    type="text"
                    value={repeatNotes}
                    onChange={(e) => setRepeatNotes(e.target.value)}
                    placeholder="e.g. Re-checked 5 min later on second fingerstick to verify meter calibration"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Reference Range */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Reference Interval / Target Range
            </label>
            <input
              type="text"
              value={referenceRange}
              onChange={(e) => setReferenceRange(e.target.value)}
              placeholder="e.g. 70 – 99 mg/dL"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Clinical / Patient Notes */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Patient Notes &amp; Observations
            </label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="e.g. Morning fasting check after 8 hours sleep. No symptoms."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                mode === 'home_monitoring'
                  ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
              } disabled:opacity-50`}
            >
              {isSubmitting ? (
                <>Recording...</>
              ) : (
                <>
                  <Plus size={15} /> Save Diagnostic Record
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
