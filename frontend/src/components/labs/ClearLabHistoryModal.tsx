import React, { useState } from 'react'
import { X, Trash2, AlertTriangle, ShieldCheck, Check } from 'lucide-react'
import api from '@/lib/api'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (message: string) => void
  onClearFilters: () => void
  onHideArchived: () => void
}

export const ClearLabHistoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  onClearFilters,
  onHideArchived,
}) => {
  const [selectedOption, setSelectedOption] = useState<'clear_filters' | 'hide_archived' | 'request_archival'>('clear_filters')
  const [confirmed, setConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleExecute = async () => {
    if (!confirmed) {
      setErrorMessage('Please confirm your acknowledgment before proceeding.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await api.post('/api/v1/labs/clear-history', {
        mode: selectedOption,
        confirmation: true,
      })

      if (selectedOption === 'clear_filters') {
        onClearFilters()
      } else if (selectedOption === 'hide_archived') {
        onHideArchived()
      }

      onSuccess(res.data.message)
      onClose()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to clear history.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 md:p-8 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600/20 text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Clear History & Retention Options</h3>
              <p className="text-xs text-slate-400">Select what history criteria to clear or conceal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legal Warning Notice */}
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Clinical Governance & Statutory Retention Disclosure
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            In compliance with state and federal healthcare data protection standards, official diagnostic laboratory
            records and immutable security audit logs cannot be permanently purged merely through a patient UI action.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Options Radios */}
        <div className="space-y-3 text-xs text-slate-300">
          <label
            onClick={() => setSelectedOption('clear_filters')}
            className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
              selectedOption === 'clear_filters'
                ? 'bg-blue-600/10 border-blue-500/50 text-white'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <input
              type="radio"
              name="clear_mode"
              checked={selectedOption === 'clear_filters'}
              onChange={() => setSelectedOption('clear_filters')}
              className="mt-0.5 accent-blue-500"
            />
            <div>
              <strong className="block text-white text-xs mb-0.5">Reset Active Search & Filters</strong>
              <p className="text-slate-400 text-[11px]">
                Clears any active search keywords, date filters, and category selections, returning your portal to the complete diagnostic overview.
              </p>
            </div>
          </label>

          <label
            onClick={() => setSelectedOption('hide_archived')}
            className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
              selectedOption === 'hide_archived'
                ? 'bg-blue-600/10 border-blue-500/50 text-white'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <input
              type="radio"
              name="clear_mode"
              checked={selectedOption === 'hide_archived'}
              onChange={() => setSelectedOption('hide_archived')}
              className="mt-0.5 accent-blue-500"
            />
            <div>
              <strong className="block text-white text-xs mb-0.5">Hide Archived Entries from View</strong>
              <p className="text-slate-400 text-[11px]">
                Conceals previously archived records from your main diagnostic dashboard while retaining them in your viewable audit trail.
              </p>
            </div>
          </label>

          <label
            onClick={() => setSelectedOption('request_archival')}
            className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
              selectedOption === 'request_archival'
                ? 'bg-blue-600/10 border-blue-500/50 text-white'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <input
              type="radio"
              name="clear_mode"
              checked={selectedOption === 'request_archival'}
              onChange={() => setSelectedOption('request_archival')}
              className="mt-0.5 accent-blue-500"
            />
            <div>
              <strong className="block text-white text-xs mb-0.5">Request Retention Review for Patient Entries</strong>
              <p className="text-slate-400 text-[11px]">
                Submits eligible manual entries for clinical retention review. Certified hospital lab panels remain preserved.
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
              className="w-4 h-4 rounded accent-emerald-500"
            />
            <span>
              I understand that official clinical records and legal audit trails will remain preserved.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-700 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!confirmed || isSubmitting}
            onClick={handleExecute}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            {isSubmitting ? 'Processing...' : 'Apply Selection'}
          </button>
        </div>
      </div>
    </div>
  )
}
