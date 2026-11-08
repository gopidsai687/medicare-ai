import React, { useState } from 'react'
import { X, Archive, AlertTriangle, Check } from 'lucide-react'
import api from '@/lib/api'
import { MedicalRecordData } from './AddRecordModal'

interface Props {
  isOpen: boolean
  record: MedicalRecordData | null
  onClose: () => void
  onSuccess: (archivedId: string) => void
}

export const DeleteRecordModal: React.FC<Props> = ({ isOpen, record, onClose, onSuccess }) => {
  if (!isOpen || !record) return null

  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleArchive = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMessage('Please provide an archival justification reason (minimum 3 characters).')
      return
    }

    setIsSubmitting(true)

    try {
      await api.patch(`/api/v1/records/${record.id}/archive`, {
        reason: reason.trim(),
      })
      onSuccess(record.id)
      onClose()
    } catch (err: any) {
      console.error('Failed to archive medical record:', err)
      const msg = err.response?.data?.detail || err.message || 'Failed to archive record.'
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="glass w-full max-w-md rounded-3xl p-6 relative border border-white/10 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Archive Medical Record</h2>
              <p className="text-xs text-slate-400">Soft archival with clinical audit logging</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Record Snapshot Card */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 uppercase tracking-wider font-semibold">Condition / Title:</span>
            <span className="font-bold text-white text-sm">{record.title}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Category:</span>
            <span className="text-slate-200">{record.category}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Documented Date:</span>
            <span className="text-slate-200">{record.date}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Provider:</span>
            <span className="text-slate-200">{record.provider}</span>
          </div>
        </div>

        {/* Regulatory Protection Notice */}
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <p className="leading-relaxed">
            <strong className="text-white">HIPAA Integrity Protection:</strong> Medical records are soft-archived rather than permanently deleted. This preserves historical EHR integrity while removing this entry from your active health view. You can review or restore it at any time in <strong className="text-white">View History</strong>.
          </p>
        </div>

        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleArchive} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Archival Justification Reason *
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Duplicate entry, Entered in error, Replaced by specialist consult, Condition fully resolved..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400 placeholder-slate-500"
            />
          </div>

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
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>Archiving...</>
              ) : (
                <>
                  <Check size={14} /> Confirm Archival
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
