import React, { useState } from 'react'
import { X, Trash2, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { LabResultItem } from './AddLabResultModal'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (archivedId: string) => void
  labToDelete: LabResultItem | null
}

export const DeleteLabResultModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  labToDelete,
}) => {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen || !labToDelete) return null

  const handleArchive = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setErrorMessage('Please state a reason for archiving this record.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await api.delete(`/api/v1/labs/results/${labToDelete.id}`, {
        data: { reason: reason.trim() },
      })
      onSuccess(labToDelete.id)
      onClose()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to archive lab result.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 md:p-8 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600/20 text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Archive Laboratory Result</h3>
              <p className="text-xs text-slate-400">Soft deletion with clinical audit preservation</p>
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

        {/* Warning / Audit Notice */}
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <ShieldCheck className="w-4 h-4" />
            Clinical Records Preservation Policy
          </div>
          <p className="text-slate-300 leading-relaxed">
            To maintain medical accuracy and statutory EHR compliance, clinical records are not permanently wiped.
            Archiving removes{' '}
            <strong className="text-white">"{labToDelete.name}"</strong> ({labToDelete.value} {labToDelete.unit})
            from your active overview while safely retaining the historical data in your immutable audit trail.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleArchive} className="space-y-4 text-xs text-slate-300">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Reason for Archival *
            </label>
            <textarea
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate entry; superseded by newer hospital panel; patient cleanup..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500 placeholder-slate-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {isSubmitting ? 'Archiving...' : 'Confirm Archival'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
