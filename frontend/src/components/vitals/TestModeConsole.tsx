import React, { useState } from 'react'
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Trash2,
  RefreshCw,
  Plus,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  Heart,
  Droplets,
  ShieldCheck,
} from 'lucide-react'
import { api } from '@/lib/api'

interface TestModeConsoleProps {
  onSimulated?: () => void
  compact?: boolean
}

export function TestModeConsole({ onSimulated, compact = false }: TestModeConsoleProps) {
  const [isExpanded, setIsExpanded] = useState(!compact)
  const [loadingState, setLoadingState] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customForm, setCustomForm] = useState({
    systolic_bp: 120,
    diastolic_bp: 80,
    heart_rate: 72,
    blood_glucose: 95,
    glucose_context: 'fasting',
    notes: 'Custom fictional test reading',
  })

  const runSimulation = async (state: 'normal' | 'attention' | 'urgent' | 'stale' | 'clear_test_data') => {
    setLoadingState(state)
    setFeedback(null)
    try {
      const res = await api.post('/api/v1/vitals/test-mode/simulate', { state })
      const data = res.data
      setFeedback({
        type: 'success',
        text: data.message || `Simulated ${state.toUpperCase()} state successfully.`,
      })
      if (onSimulated) {
        onSimulated()
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || `Simulation for ${state} failed.`,
      })
    } finally {
      setLoadingState(null)
    }
  }

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingState('custom')
    try {
      // Log custom BP as sample
      await api.post('/api/v1/vitals/blood-pressure', {
        systolic_bp: Number(customForm.systolic_bp),
        diastolic_bp: Number(customForm.diastolic_bp),
        heart_rate: Number(customForm.heart_rate),
        measurement_source: 'SAMPLE_DATA',
        device_name: 'Custom Clinical Test Entry',
        notes: customForm.notes || 'Custom test telemetry',
        is_sample: true,
      })

      // Log custom Glucose as sample
      await api.post('/api/v1/vitals/blood-glucose', {
        blood_glucose: Number(customForm.blood_glucose),
        glucose_unit: 'mg/dL',
        glucose_context: customForm.glucose_context,
        measurement_source: 'SAMPLE_DATA',
        device_name: 'Custom Clinical Test Entry',
        notes: customForm.notes || 'Custom test telemetry',
        is_sample: true,
      })

      setShowCustomModal(false)
      setFeedback({
        type: 'success',
        text: `Custom test reading logged (${customForm.systolic_bp}/${customForm.diastolic_bp} mmHg, ${customForm.blood_glucose} mg/dL). Tagged as Sample Clinical.`,
      })
      if (onSimulated) {
        onSimulated()
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to record custom test reading.',
      })
    } finally {
      setLoadingState(null)
    }
  }

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-surface-900 to-indigo-950/40 p-4 shadow-xl backdrop-blur-md transition-all">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-inner">
            <FlaskConical size={18} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                VitalSense™ Clinical Test &amp; Demo Console
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Fictional Test Mode
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Inject deterministic clinical scenarios to verify alerts, thresholds, body map reactivity, and charts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCustomModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 transition-all cursor-pointer"
          >
            <Plus size={13} /> Custom Test Entry
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse test panel' : 'Expand test panel'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-purple-500/20 space-y-3">
          {/* Preset Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
            {/* 1. Normal Baseline */}
            <button
              onClick={() => runSimulation('normal')}
              disabled={loadingState !== null}
              className="p-3 rounded-xl bg-emerald-950/30 hover:bg-emerald-950/60 border border-emerald-500/30 text-left transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Normal Baseline
                </span>
                {loadingState === 'normal' && <RefreshCw size={12} className="animate-spin text-emerald-400" />}
              </div>
              <p className="text-[11px] text-slate-300 font-mono">BP 118/76 • 72 bpm</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Fasting Glucose 94 mg/dL</p>
              <div className="mt-2 text-[10px] text-emerald-300/80 font-medium">AHA / ADA Standard Band</div>
            </button>

            {/* 2. Attention / Stage 1 */}
            <button
              onClick={() => runSimulation('attention')}
              disabled={loadingState !== null}
              className="p-3 rounded-xl bg-amber-950/30 hover:bg-amber-950/60 border border-amber-500/30 text-left transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Attention State
                </span>
                {loadingState === 'attention' && <RefreshCw size={12} className="animate-spin text-amber-400" />}
              </div>
              <p className="text-[11px] text-slate-300 font-mono">BP 136/86 • 82 bpm</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Postprandial 168 mg/dL</p>
              <div className="mt-2 text-[10px] text-amber-300/80 font-medium">Stage 1 HTN &amp; Elevated</div>
            </button>

            {/* 3. Urgent Crisis */}
            <button
              onClick={() => runSimulation('urgent')}
              disabled={loadingState !== null}
              className="p-3 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-500/40 text-left transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <AlertOctagon size={14} /> Urgent Crisis
                </span>
                {loadingState === 'urgent' && <RefreshCw size={12} className="animate-spin text-rose-400" />}
              </div>
              <p className="text-[11px] text-rose-200 font-mono font-bold">BP 192/124 • 96 bpm</p>
              <p className="text-[10px] text-rose-300 mt-0.5">Severe Hypo 48 mg/dL</p>
              <div className="mt-2 text-[10px] text-rose-300/90 font-bold animate-pulse">AHA Crisis / ADA Level 2</div>
            </button>

            {/* 4. Stale Data */}
            <button
              onClick={() => runSimulation('stale')}
              disabled={loadingState !== null}
              className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700 text-left transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock size={14} /> Stale Telemetry
                </span>
                {loadingState === 'stale' && <RefreshCw size={12} className="animate-spin text-slate-400" />}
              </div>
              <p className="text-[11px] text-slate-300 font-mono">14 Days Old Reading</p>
              <p className="text-[10px] text-slate-400 mt-0.5">&gt;7 Day Lapsed Threshold</p>
              <div className="mt-2 text-[10px] text-slate-400 font-medium">Tests Stale Alert Trigger</div>
            </button>

            {/* 5. Clear Test Data */}
            <button
              onClick={() => runSimulation('clear_test_data')}
              disabled={loadingState !== null}
              className="p-3 rounded-xl bg-purple-950/30 hover:bg-purple-950/60 border border-purple-500/30 text-left transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Trash2 size={14} /> Reset Test Data
                </span>
                {loadingState === 'clear_test_data' && <RefreshCw size={12} className="animate-spin text-purple-400" />}
              </div>
              <p className="text-[11px] text-slate-300 font-mono">Purge Fictional Logs</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Missing-Data Validation</p>
              <div className="mt-2 text-[10px] text-purple-300/80 font-medium">Preserves Real History</div>
            </button>
          </div>

          {/* Feedback Toast */}
          {feedback && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border animate-fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : feedback.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Info size={14} />
                <span>{feedback.text}</span>
              </div>
              <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Clinical Integrity Disclaimers */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 text-purple-300">
              <ShieldCheck size={13} />
              <span>All test readings are explicitly tagged with <code>is_sample=True</code> and purple badge indicators.</span>
            </div>
            <div className="text-slate-400 italic">
              Touchscreens, phone cameras, or fingerprint sensors do NOT physically measure blood pressure or glucose.
            </div>
          </div>
        </div>
      )}

      {/* Custom Test Entry Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-purple-500/40 bg-surface-900 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-500/20">
              <h3 className="font-bold text-white flex items-center gap-2">
                <FlaskConical size={18} className="text-purple-400" /> Log Custom Test Reading
              </h3>
              <button onClick={() => setShowCustomModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Enter custom vital sign measurements to test specific thresholds. Readings will be isolated and tagged as <strong>Sample Clinical Data</strong>.
            </p>

            <form onSubmit={handleCustomSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    min="50"
                    max="280"
                    required
                    value={customForm.systolic_bp}
                    onChange={(e) => setCustomForm({ ...customForm, systolic_bp: Number(e.target.value) })}
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
                    value={customForm.diastolic_bp}
                    onChange={(e) => setCustomForm({ ...customForm, diastolic_bp: Number(e.target.value) })}
                    className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    min="30"
                    max="220"
                    required
                    value={customForm.heart_rate}
                    onChange={(e) => setCustomForm({ ...customForm, heart_rate: Number(e.target.value) })}
                    className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Blood Glucose (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="20"
                    max="600"
                    required
                    value={customForm.blood_glucose}
                    onChange={(e) => setCustomForm({ ...customForm, blood_glucose: Number(e.target.value) })}
                    className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Meal Context (ADA Standard)</label>
                <select
                  value={customForm.glucose_context}
                  onChange={(e) => setCustomForm({ ...customForm, glucose_context: e.target.value })}
                  className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white"
                >
                  <option value="fasting">Fasting (&lt;100 Normal, &gt;126 Diabetic)</option>
                  <option value="before_meal">Before Meal (Preprandial 70-130)</option>
                  <option value="after_meal">After Meal (Postprandial &lt;140 Normal)</option>
                  <option value="bedtime">Bedtime (100-140)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Test Simulation Notes</label>
                <input
                  type="text"
                  value={customForm.notes}
                  onChange={(e) => setCustomForm({ ...customForm, notes: e.target.value })}
                  className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white"
                  placeholder="e.g., Evaluation of hypertensive threshold"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300">
                Notice: This entry will be saved with <code>is_sample = true</code> and <code>source = "SAMPLE_DATA"</code>. Real measurements must come from a validated home cuff or glucose meter.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingState !== null}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-50"
                >
                  {loadingState === 'custom' ? 'Saving...' : 'Record Test Reading'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
