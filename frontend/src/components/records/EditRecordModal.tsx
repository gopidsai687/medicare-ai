import React, { useState } from 'react'
import { X, Edit2, AlertCircle, ShieldAlert, Check, Calendar, History, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { MedicalRecordData } from './AddRecordModal'

interface Props {
  isOpen: boolean
  record: MedicalRecordData | null
  onClose: () => void
  onSuccess: (updatedRecord: MedicalRecordData) => void
}

export const EditRecordModal: React.FC<Props> = ({ isOpen, record, onClose, onSuccess }) => {
  if (!isOpen || !record) return null

  const isOfficial = !record.is_patient_reported && record.source !== 'patient_reported'

  // Editable fields
  const [title, setTitle] = useState(record.title)
  const [description, setDescription] = useState(record.description || '')
  const [status, setStatus] = useState((record.status || 'Active').toLowerCase())
  const [severity, setSeverity] = useState(record.severity || 'Moderate')
  const [provider, setProvider] = useState(record.provider || '')
  const [recordDate, setRecordDate] = useState(record.date || new Date().toISOString().split('T')[0])
  const [icd10, setIcd10] = useState(record.icd10 || '')
  const [notes, setNotes] = useState(record.notes || '')

  // Amendment reason (required for official clinical records)
  const [amendmentReason, setAmendmentReason] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (isOfficial && (!amendmentReason.trim() || amendmentReason.trim().length < 5)) {
      setErrorMessage('Clinical amendment justification is required (minimum 5 characters) to update official clinical records.')
      return
    }

    setIsSubmitting(true)

    try {
      if (isOfficial) {
        // Official clinical amendment workflow
        const res = await api.post(`/api/v1/records/${record.id}/amend`, {
          title: title.trim(),
          description: description.trim(),
          status: status,
          notes: notes.trim() || undefined,
          reason: amendmentReason.trim(),
        })
        const data = res.data
        onSuccess({
          ...record,
          title: data.title || title,
          description: data.description || description,
          status: (data.status || status).charAt(0).toUpperCase() + (data.status || status).slice(1),
          notes: data.notes || notes,
          is_amended: true,
          amendment_reason: amendmentReason.trim(),
        })
      } else {
        // Direct edit for patient-reported records
        const res = await api.put(`/api/v1/records/${record.id}`, {
          title: title.trim(),
          description: description.trim() || undefined,
          status: status,
          severity: severity,
          provider: provider.trim() || undefined,
          record_date: recordDate,
          icd10_code: icd10.trim() || undefined,
          notes: notes.trim() || undefined,
        })
        const data = res.data
        onSuccess({
          ...record,
          title: data.title || title,
          description: data.description || description,
          status: (data.status || status).charAt(0).toUpperCase() + (data.status || status).slice(1),
          severity: data.severity || severity,
          provider: data.provider || provider,
          date: data.date || recordDate,
          icd10: data.icd10 || icd10,
          notes: data.notes || notes,
        })
      }
      onClose()
    } catch (err: any) {
      console.error('Failed to update medical record:', err)
      const msg = err.response?.data?.detail || err.message || 'Failed to update record.'
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="glass w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7 relative border border-white/10 shadow-2xl space-y-5 custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isOfficial ? 'Clinical Record Amendment' : 'Edit Medical Record'}
              </h2>
              <p className="text-xs text-slate-400">
                {isOfficial
                  ? 'Official provider records require a documented justification'
                  : 'Update details for your self-reported health entry'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Clinical Attribution Notice */}
        {isOfficial ? (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-semibold text-white">Official Clinical Record:</span> This entry was verified by{' '}
              <span className="font-medium text-white">{record.provider}</span>. In accordance with clinical EHR governance, previous versions remain immutable in the audit trail.
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Patient-Reported Entry: Direct updates allowed for personal record tracking.</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Title / Condition Name *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Date & Provider (Editable if patient-reported) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Record Date
              </label>
              <input
                type="date"
                disabled={isOfficial}
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 ${
                  isOfficial ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Provider / Facility
              </label>
              <input
                type="text"
                disabled={isOfficial}
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 ${
                  isOfficial ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>

          {/* Status & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Clinical Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="active" className="bg-slate-900 text-white">Active</option>
                <option value="chronic" className="bg-slate-900 text-white">Chronic</option>
                <option value="resolved" className="bg-slate-900 text-white">Resolved</option>
                <option value="inactive" className="bg-slate-900 text-white">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Clinical Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="Mild" className="bg-slate-900 text-white">Mild</option>
                <option value="Moderate" className="bg-slate-900 text-white">Moderate</option>
                <option value="Severe" className="bg-slate-900 text-white">Severe</option>
                <option value="Critical" className="bg-slate-900 text-white">Critical</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Clinical Summary / Treatment Details
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Physician Notes & Instructions
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Mandatory Amendment Reason for Official Records */}
          {isOfficial && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider">
                <History className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                Amendment Justification Reason *
              </label>
              <textarea
                rows={2}
                required
                placeholder="Document clinical justification (e.g. Consult note update, patient medication change, or resolved condition review)..."
                value={amendmentReason}
                onChange={(e) => setAmendmentReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-amber-500/30 text-white text-xs focus:outline-none focus:border-amber-400 placeholder-slate-500"
              />
              <p className="text-[11px] text-amber-400/80">
                This amendment reason will be permanently attached to this EHR entry in compliance with HIPAA § 164.526.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>Saving Changes...</>
              ) : (
                <>
                  <Check size={14} /> {isOfficial ? 'Submit Amendment' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
