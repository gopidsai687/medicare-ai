import React, { useState } from 'react'
import {
  X,
  Archive,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Info,
} from 'lucide-react'
import api from '@/lib/api'
import { PrescriptionItem } from './AddPrescriptionModal'

interface Props {
  isOpen: boolean
  onClose: () => void
  prescription: PrescriptionItem | null
  onSuccess: (archivedId: string) => void
}

const COMMON_REASONS = [
  'Course completed / expired',
  'Physician changed medication or dosage',
  'Adverse reaction / side effects',
  'Duplicate entry',
  'Entered by mistake',
  'Patient discontinued per clinical advice',
  'Other clinical / administrative reason',
]

export const ArchivePrescriptionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  prescription,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState(COMMON_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !prescription) return null

  const handleArchive = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const finalReason = selectedReason === 'Other clinical / administrative reason'
      ? customReason.trim()
      : selectedReason

    if (!finalReason) {
      setError('Please provide or select a reason for archiving.')
      return
    }

    setIsSubmitting(true)
    try {
      await api.patch(`/api/v1/prescriptions/${prescription.id}/archive`, {
        reason: finalReason,
      })
      onSuccess(prescription.id)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to archive prescription.')
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
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Archive size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Archive Prescription</h2>
              <p className="text-xs text-slate-400">Soft delete & legal retention workflow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleArchive} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Item details */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="text-xs text-slate-400">Selected Item</div>
            <div className="text-sm font-semibold text-white mt-0.5">
              {prescription.medication_name} ({prescription.dosage})
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Prescriber: {prescription.prescribing_doctor_name || 'N/A'} • Frequency: {prescription.frequency}
            </div>
          </div>

          {/* Compliance Notice */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-blue-500/20 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-blue-400">
              <ShieldCheck size={16} />
              HIPAA & Medical Record Retention Notice
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              In accordance with electronic medical record compliance regulations, prescription entries cannot be completely expunged. Archiving will hide this item from your active medication routines and analyzer lists, while preserving the record and audit log in your longitudinal EHR history. You can restore it at any time from View History.
            </p>
          </div>

          {/* Reason selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Reason for Archiving <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500 transition"
            >
              {COMMON_REASONS.map((r) => (
                <option key={r} value={r} className="bg-slate-900">
                  {r}
                </option>
              ))}
            </select>
          </div>

          {selectedReason === 'Other clinical / administrative reason' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Custom Reason Details</label>
              <textarea
                rows={2}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Explain the reason for archiving..."
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          )}

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
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 shadow-md shadow-amber-600/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive size={14} />
                  Confirm Archive
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

