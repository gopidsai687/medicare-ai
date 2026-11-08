import React, { useState } from 'react'
import {
  X,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import api from '@/lib/api'
import { PrescriptionItem } from '../prescriptions/AddPrescriptionModal'

interface Props {
  isOpen: boolean
  onClose: () => void
  medication: PrescriptionItem | null
  onSuccess: (discontinued: PrescriptionItem) => void
}

const DISCONTINUE_REASONS = [
  'Adverse drug reaction / side effects',
  'Condition resolved / course completed',
  'Switched to alternative medication by doctor',
  'Ineffective therapeutic response',
  'Patient intolerance / allergy concern',
  'Cost / insurance coverage barrier',
  'Other clinical / physician advice',
]

export const DiscontinueMedicationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  medication,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState(DISCONTINUE_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !medication) return null

  const handleDiscontinue = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const finalReason = selectedReason === 'Other clinical / physician advice'
      ? customReason.trim()
      : selectedReason

    if (!finalReason) {
      setError('Please provide a reason for discontinuing this medication.')
      return
    }

    if (!acknowledged) {
      setError('Please confirm that you have consulted or intend to notify your physician.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await api.patch(`/api/v1/prescriptions/${medication.id}/discontinue`, {
        reason: finalReason,
      })
      onSuccess(res.data)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to discontinue medication.')
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
              <XCircle size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Discontinue Medication</h2>
              <p className="text-xs text-slate-400">Clinical cessation workflow & safety check</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleDiscontinue} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Target Med */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="text-xs text-slate-400">Medication to Discontinue</div>
            <div className="text-sm font-semibold text-white mt-0.5">
              {medication.medication_name} ({medication.dosage})
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Prescribed by: {medication.prescribing_doctor_name || 'Assigned Clinician'} • {medication.frequency}
            </div>
          </div>

          {/* Safety Advisory */}
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200/90 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-rose-300">
              <ShieldAlert size={16} />
              Important Medical Advisory
            </div>
            <p className="leading-relaxed text-[11px] text-rose-200/80">
              Never abruptly cease maintenance medications (such as blood pressure agents, insulin, cardiac drugs, or antibiotics) without first consulting your doctor or pharmacist. Stopping without medical supervision could cause serious rebound symptoms or health complications.
            </p>
          </div>

          {/* Reason Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Reason for Discontinuation <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-rose-500 transition"
            >
              {DISCONTINUE_REASONS.map((r) => (
                <option key={r} value={r} className="bg-slate-900">
                  {r}
                </option>
              ))}
            </select>
          </div>

          {selectedReason === 'Other clinical / physician advice' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Specific Clinical Details</label>
              <textarea
                rows={2}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Explain the clinical reason..."
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
              />
            </div>
          )}

          {/* Physician acknowledgment */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-rose-500/20"
              />
              <span>
                I have consulted with my healthcare team or am recording a physician-directed medication discontinuation.
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
              disabled={isSubmitting || !acknowledged}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Updating Regimen...
                </>
              ) : (
                <>
                  <XCircle size={14} /> Confirm Discontinue
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

