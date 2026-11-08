import React, { useState, useEffect } from 'react'
import { X, Plus, AlertCircle, FileText, Activity, ShieldAlert, Scissors, Syringe, Calendar, Check, Link2 } from 'lucide-react'
import api from '@/lib/api'

export interface MedicalRecordData {
  id: string
  category: string
  category_code?: string
  title: string
  description: string
  icd10?: string
  date: string
  provider: string
  status: string
  severity?: string
  notes?: string
  source?: string
  is_patient_reported?: boolean
  supporting_document_url?: string
  lab_result_id?: string
  is_amended?: boolean
  amendment_reason?: string
  original_value?: any
  is_archived?: boolean
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newRecord: MedicalRecordData) => void
}

const CATEGORY_OPTIONS = [
  { value: 'diagnosis', label: 'Diagnosis / Medical Condition', icon: Activity },
  { value: 'allergy', label: 'Allergy / Adverse Reaction', icon: ShieldAlert },
  { value: 'surgery', label: 'Surgery / Surgical Procedure', icon: Scissors },
  { value: 'immunization', label: 'Immunization / Vaccination', icon: Syringe },
  { value: 'note', label: 'Clinical Note / Consultation Summary', icon: FileText },
  { value: 'lab_result', label: 'Laboratory Result Reference', icon: FileText },
  { value: 'other', label: 'Other Health Document', icon: FileText },
]

export const AddRecordModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [category, setCategory] = useState('diagnosis')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0])
  const [provider, setProvider] = useState('')
  const [icd10Code, setIcd10Code] = useState('')
  const [status, setStatus] = useState('active')
  const [severity, setSeverity] = useState('Moderate')
  const [notes, setNotes] = useState('')
  const [documentUrl, setDocumentUrl] = useState('')
  const [labResultId, setLabResultId] = useState('')
  const [availableLabs, setAvailableLabs] = useState<Array<{ id: string; name: string; value: number; unit: string; date: string }>>([])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch available labs if category is lab_result
  useEffect(() => {
    if (isOpen && category === 'lab_result') {
      api.get('/api/v1/labs', { params: { flat: true } })
        .then(res => {
          if (Array.isArray(res.data)) {
            setAvailableLabs(res.data.map((l: any) => ({
              id: l.id,
              name: l.name,
              value: l.value,
              unit: l.unit,
              date: l.date,
            })))
          }
        })
        .catch(err => console.warn('Could not load labs for linking:', err))
    }
  }, [isOpen, category])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!title.trim()) {
      setErrorMessage('Record title or condition name is required.')
      return
    }

    setIsSubmitting(true)

    try {
      const payload: any = {
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        record_date: recordDate,
        provider: provider.trim() || 'Patient Self-Reported',
        icd10_code: icd10Code.trim() || undefined,
        status,
        severity: category === 'allergy' || category === 'diagnosis' ? severity : undefined,
        notes: notes.trim() || undefined,
        supporting_document_url: documentUrl.trim() || undefined,
        lab_result_id: (category === 'lab_result' && labResultId) ? labResultId : undefined,
      }

      const res = await api.post('/api/v1/records', payload)
      const data = res.data
      onSuccess({
        id: data.id,
        category: (data.category || category).charAt(0).toUpperCase() + (data.category || category).slice(1),
        category_code: data.category || category,
        title: data.title,
        description: data.description || '',
        icd10: data.icd10,
        date: data.date,
        provider: data.provider || 'Self-Reported / Patient Entered',
        status: (data.status || status).charAt(0).toUpperCase() + (data.status || status).slice(1),
        severity: data.severity,
        notes: data.notes,
        source: data.source || 'patient_reported',
        is_patient_reported: data.is_patient_reported ?? true,
        supporting_document_url: data.supporting_document_url,
        lab_result_id: data.lab_result_id,
        is_amended: false,
        is_archived: false,
      })
      onClose()
    } catch (err: any) {
      console.error('Failed to create medical record:', err)
      const msg = err.response?.data?.detail || err.message || 'Failed to save medical record.'
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
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Add Medical Record</h2>
              <p className="text-xs text-slate-400">
                Document medical conditions, allergies, procedures, or immunization events
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

        {/* Provenance Notice */}
        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
          <div>
            <span className="font-semibold text-white">HIPAA Patient-Reported Intake:</span> Records entered via the patient portal are logged with an immutable audit trail and labeled as <span className="underline font-medium">Patient-Reported</span> until reviewed by an attending clinician.
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Record Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Condition / Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Title / Condition Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Type 2 Diabetes, Penicillin Allergy, Appendectomy, Flu Vaccine"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
            />
          </div>

          {/* Date & Provider */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Record Date *
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  required
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Healthcare Provider / Clinic
              </label>
              <input
                type="text"
                placeholder="e.g. Dr. Sarah Chen, MetroHealth Clinic"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
              />
            </div>
          </div>

          {/* ICD-10 Code & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                ICD-10 Code (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. E11.9, I10, Z88.0"
                value={icd10Code}
                onChange={(e) => setIcd10Code(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
              />
            </div>

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
          </div>

          {(category === 'diagnosis' || category === 'allergy') && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Clinical Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="Mild" className="bg-slate-900 text-white">Mild — Minimal impact</option>
                <option value="Moderate" className="bg-slate-900 text-white">Moderate — Requires ongoing treatment</option>
                <option value="Severe" className="bg-slate-900 text-white">Severe — Significant symptoms / limitation</option>
                <option value="Critical" className="bg-slate-900 text-white">Critical — Life threatening or emergency risk</option>
              </select>
            </div>
          )}

          {/* Lab Result Intelligent Linkage */}
          {category === 'lab_result' && (
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <Link2 className="w-3.5 h-3.5 inline mr-1 text-teal-400" />
                Intelligent Link to Diagnostic Lab Result
              </label>
              <select
                value={labResultId}
                onChange={(e) => {
                  setLabResultId(e.target.value)
                  const chosen = availableLabs.find(l => l.id === e.target.value)
                  if (chosen && !title) {
                    setTitle(`Lab Result: ${chosen.name} (${chosen.value} ${chosen.unit})`)
                  }
                }}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="" className="bg-slate-900 text-white">-- Select existing laboratory result to link --</option>
                {availableLabs.map(l => (
                  <option key={l.id} value={l.id} className="bg-slate-900 text-white">
                    {l.name} — {l.value} {l.unit} ({l.date})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Links directly to your live Diagnostic Lab Results without creating duplicate disconnected data.
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Clinical Summary / Description
            </label>
            <textarea
              rows={3}
              placeholder="Symptoms, medication, treatment regimen, or diagnostic notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Additional Notes or Instructions
            </label>
            <input
              type="text"
              placeholder="e.g. Patient advised to monitor BP daily and adhere to low sodium diet"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
            />
          </div>

          {/* Footer Actions */}
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>Saving Record...</>
              ) : (
                <>
                  <Check size={14} /> Save Medical Record
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
