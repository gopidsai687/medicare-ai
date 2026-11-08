import React, { useState } from 'react'
import { X, Trash2, ShieldAlert, CheckCircle, AlertCircle, Filter, EyeOff, Archive } from 'lucide-react'
import api from '@/lib/api'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (mode: string) => void
}

export const ClearRecordHistoryModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'clear_filters' | 'hide_archived' | 'request_archival'>('clear_filters')
  const [confirmed, setConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleClear = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!confirmed) {
      setErrorMessage('Please confirm acknowledgment of the electronic health record policy.')
      return
    }

    setIsSubmitting(true)

    try {
      await api.post('/api/v1/records/clear-history', {
        mode,
        confirmation: confirmed,
      })
      onSuccess(mode)
      onClose()
    } catch (err: any) {
      console.error('Failed to clear records history:', err)
      const msg = err.response?.data?.detail || err.message || 'Operation failed.'
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="glass w-full max-w-lg rounded-3xl p-6 relative border border-white/10 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Manage & Clear Record View</h2>
              <p className="text-xs text-slate-400">Filter resets, archived record management & retention</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Regulatory Protection Callout */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-1">
            <span className="font-semibold text-white">EHR Medical Record Retention Mandate:</span>
            <p className="leading-relaxed text-[11px] text-amber-300/90">
              Federal law (HIPAA 45 CFR § 164.526) prohibits the destruction of documented electronic health records and clinical audit logs. You may reset active search filters, toggle the visibility of archived records, or request formal HIM archival review.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleClear} className="space-y-3 text-xs">
          <div className="space-y-2">
            <label className="block text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
              Select Action
            </label>

            {/* Option 1: Reset Filters */}
            <label
              className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                mode === 'clear_filters'
                  ? 'bg-blue-500/10 border-blue-500/40 text-white'
                  : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <input
                type="radio"
                name="clear_mode"
                checked={mode === 'clear_filters'}
                onChange={() => setMode('clear_filters')}
                className="mt-0.5 text-blue-500"
              />
              <div>
                <div className="font-semibold flex items-center gap-1.5 text-blue-400">
                  <Filter size={13} /> Reset Active Filters & Search
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Clears the active search query, category filters, and restores the full standard view.
                </p>
              </div>
            </label>

            {/* Option 2: Hide Archived */}
            <label
              className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                mode === 'hide_archived'
                  ? 'bg-amber-500/10 border-amber-500/40 text-white'
                  : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <input
                type="radio"
                name="clear_mode"
                checked={mode === 'hide_archived'}
                onChange={() => setMode('hide_archived')}
                className="mt-0.5 text-amber-500"
              />
              <div>
                <div className="font-semibold flex items-center gap-1.5 text-amber-400">
                  <EyeOff size={13} /> Hide Archived Records from View
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Filters out all archived records so only current, active clinical records are displayed.
                </p>
              </div>
            </label>

            {/* Option 3: Request HIM Archival Review */}
            <label
              className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                mode === 'request_archival'
                  ? 'bg-rose-500/10 border-rose-500/40 text-white'
                  : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <input
                type="radio"
                name="clear_mode"
                checked={mode === 'request_archival'}
                onChange={() => setMode('request_archival')}
                className="mt-0.5 text-rose-500"
              />
              <div>
                <div className="font-semibold flex items-center gap-1.5 text-rose-400">
                  <Archive size={13} /> Request HIM Archival Review
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Submits a ticket to Health Information Management for review under statutory data retention policies.
                </p>
              </div>
            </label>
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-black/30 border border-white/5 text-[11px] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded text-blue-500"
            />
            <span>
              I understand that official clinical records and HIPAA audit trails are immutable and cannot be permanently destroyed.
            </span>
          </label>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !confirmed}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : 'Apply Selection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
