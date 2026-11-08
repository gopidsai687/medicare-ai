import React, { useState } from 'react'
import {
  X,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  RotateCcw,
  EyeOff,
  FileCheck,
} from 'lucide-react'
import api from '@/lib/api'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (mode: string) => void
}

export const ClearPrescriptionHistoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'clear_filters' | 'hide_archived' | 'request_retention_review'>('hide_archived')
  const [confirmed, setConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleClear = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!confirmed) {
      setError('Please acknowledge the clinical record policy to proceed.')
      return
    }

    setIsSubmitting(true)
    try {
      await api.post('/api/v1/prescriptions/clear-history', {
        mode,
        confirmation: true,
      })
      onSuccess(mode)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to process request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Trash2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Clear Prescription History</h2>
              <p className="text-xs text-slate-400">View management & data hygiene controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleClear} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Compliance Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <ShieldAlert size={16} />
              HIPAA & Medical Record Retention Notice
            </div>
            <p className="leading-relaxed text-[11px] text-amber-200/80">
              Healthcare regulations strictly prohibit permanent deletion of verified prescription histories and audit trails. To protect your patient safety and maintain physician accountability, historical data is retained. You can choose how your view is managed below:
            </p>
          </div>

          {/* Radio Options */}
          <div className="space-y-2.5 pt-1">
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                mode === 'hide_archived'
                  ? 'bg-violet-500/10 border-violet-500/40 text-white'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="clear_mode"
                checked={mode === 'hide_archived'}
                onChange={() => setMode('hide_archived')}
                className="mt-1 accent-violet-500"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <EyeOff size={14} className="text-violet-400" />
                  Hide Archived Prescriptions (Recommended)
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Hides archived and discontinued prescriptions from your primary timeline while keeping active medications visible.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                mode === 'clear_filters'
                  ? 'bg-violet-500/10 border-violet-500/40 text-white'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="clear_mode"
                checked={mode === 'clear_filters'}
                onChange={() => setMode('clear_filters')}
                className="mt-1 accent-violet-500"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <RotateCcw size={14} className="text-blue-400" />
                  Reset Active View & Search Filters
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Clears all current search keywords, date range filters, and category selections.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                mode === 'request_retention_review'
                  ? 'bg-violet-500/10 border-violet-500/40 text-white'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="clear_mode"
                checked={mode === 'request_retention_review'}
                onChange={() => setMode('request_retention_review')}
                className="mt-1 accent-violet-500"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <FileCheck size={14} className="text-emerald-400" />
                  Request Clinical Record Retention Review
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  File a formal compliance ticket to your health network’s Medical Records Officer for data review.
                </p>
              </div>
            </label>
          </div>

          {/* Confirmation Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="rounded border-slate-700 text-violet-600 focus:ring-violet-500/20"
              />
              <span>
                I understand that statutory health data is preserved for clinical continuity.
              </span>
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !confirmed}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Updating View...
                </>
              ) : (
                'Apply View Management'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

