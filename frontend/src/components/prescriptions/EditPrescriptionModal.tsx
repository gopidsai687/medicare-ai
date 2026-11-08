import React, { useState, useEffect } from 'react'
import {
  X,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Pill,
  ShieldAlert,
  Loader2,
  Info,
  Clock,
} from 'lucide-react'
import api from '@/lib/api'
import { PrescriptionItem } from './AddPrescriptionModal'

interface Props {
  isOpen: boolean
  onClose: () => void
  prescription: PrescriptionItem | null
  onSuccess: (updated: PrescriptionItem) => void
}

const DOSAGE_FORMS = [
  'Oral Tablet',
  'Oral Capsule',
  'Liquid / Oral Solution',
  'Subcutaneous Injection',
  'Inhaler / Aerosol',
  'Topical Ointment / Cream',
  'Eye / Ear Drops',
  'Transdermal Patch',
  'Other',
]

const ROUTES = [
  'Oral',
  'Topical',
  'Inhalation',
  'Subcutaneous',
  'Intramuscular',
  'Intravenous',
  'Ophthalmic',
  'Other',
]

export const EditPrescriptionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  prescription,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<Partial<PrescriptionItem>>({})
  const [amendmentReason, setAmendmentReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (prescription) {
      setFormData({
        medication_name: prescription.medication_name,
        brand_name: prescription.brand_name || '',
        generic_name: prescription.generic_name || '',
        strength: prescription.strength || '',
        dosage_form: prescription.dosage_form || 'Oral Tablet',
        dosage: prescription.dosage || '',
        frequency: prescription.frequency || '',
        route: prescription.route || 'Oral',
        start_date: prescription.start_date || '',
        end_date: prescription.end_date || '',
        prescription_date: prescription.prescription_date || '',
        prescribing_doctor_name: prescription.prescribing_doctor_name || '',
        pharmacy: prescription.pharmacy || '',
        refills_remaining: prescription.refills_remaining ?? 0,
        refills_total: prescription.refills_total ?? prescription.refills_remaining ?? 0,
        instructions: prescription.instructions || '',
        notes: prescription.notes || '',
        status: prescription.status || 'active',
      })
      setAmendmentReason('')
      setError(null)
    }
  }, [prescription, isOpen])

  if (!isOpen || !prescription) return null

  const isClinicianOrVerified = Boolean(
    prescription.is_verified || prescription.source === 'clinician'
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.medication_name?.trim()) {
      setError('Medication name is required')
      return
    }
    if (!formData.dosage?.trim()) {
      setError('Prescribed dose is required')
      return
    }
    if (!formData.frequency?.trim()) {
      setError('Frequency is required')
      return
    }

    if (isClinicianOrVerified && (!amendmentReason || amendmentReason.trim().length < 5)) {
      setError('Clinical amendment reason (minimum 5 characters) is required for verified prescriptions.')
      return
    }

    setIsSubmitting(true)
    try {
      let res
      if (isClinicianOrVerified) {
        // Formal EHR Amendment
        res = await api.post(`/api/v1/prescriptions/${prescription.id}/amend`, {
          medication_name: formData.medication_name.trim(),
          dosage: formData.dosage.trim(),
          frequency: formData.frequency.trim(),
          instructions: formData.instructions?.trim() || null,
          status: formData.status,
          reason: amendmentReason.trim(),
        })
      } else {
        // Direct Edit
        res = await api.put(`/api/v1/prescriptions/${prescription.id}`, {
          medication_name: formData.medication_name.trim(),
          brand_name: formData.brand_name?.trim() || null,
          generic_name: formData.generic_name?.trim() || null,
          strength: formData.strength?.trim() || null,
          dosage_form: formData.dosage_form || 'Oral Tablet',
          dosage: formData.dosage.trim(),
          frequency: formData.frequency.trim(),
          route: formData.route || 'Oral',
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          prescription_date: formData.prescription_date || null,
          prescribing_doctor_name: formData.prescribing_doctor_name?.trim() || null,
          pharmacy: formData.pharmacy?.trim() || null,
          refills_remaining: Number(formData.refills_remaining) || 0,
          refills_total: Number(formData.refills_total) || 0,
          instructions: formData.instructions?.trim() || null,
          notes: formData.notes?.trim() || null,
          status: formData.status,
        })
      }

      onSuccess(res.data)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update prescription. Please check your inputs.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Edit3 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Edit Prescription
                {isClinicianOrVerified ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Verified / Clinician Record
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    Patient Reported
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Update medication regimen or record clinical amendments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertTriangle size={16} className="text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isClinicianOrVerified ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <ShieldAlert size={16} />
                Statutory Clinical Amendment Notice
              </div>
              <p className="leading-relaxed">
                This prescription was verified or issued by a licensed clinician. In compliance with Electronic Health Record (EHR) regulations, modifications require a formal amendment justification. Previous values will be permanently archived in the immutable version history.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200/90 text-xs flex items-center gap-2">
              <Info size={15} className="shrink-0 text-blue-400" />
              <span>
                As this is a patient-reported prescription, you can modify any details directly. An updated audit version snapshot will be saved.
              </span>
            </div>
          )}

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                Medication Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.medication_name || ''}
                onChange={(e) => setFormData({ ...formData, medication_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Brand Name</label>
              <input
                type="text"
                disabled={isClinicianOrVerified}
                value={formData.brand_name || ''}
                onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Generic Name</label>
              <input
                type="text"
                disabled={isClinicianOrVerified}
                value={formData.generic_name || ''}
                onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Strength</label>
              <input
                type="text"
                disabled={isClinicianOrVerified}
                value={formData.strength || ''}
                onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Dosage Form</label>
              <select
                disabled={isClinicianOrVerified}
                value={formData.dosage_form || 'Oral Tablet'}
                onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-violet-500 transition disabled:opacity-60"
              >
                {DOSAGE_FORMS.map((form) => (
                  <option key={form} value={form} className="bg-slate-900">
                    {form}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                Prescribed Dose <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.dosage || ''}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                Frequency <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.frequency || ''}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Route</label>
              <select
                disabled={isClinicianOrVerified}
                value={formData.route || 'Oral'}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-violet-500 transition disabled:opacity-60"
              >
                {ROUTES.map((r) => (
                  <option key={r} value={r} className="bg-slate-900">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Status</label>
              <select
                value={formData.status || 'active'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-violet-500 transition"
              >
                <option value="active" className="bg-slate-900">Active</option>
                <option value="completed" className="bg-slate-900">Completed</option>
                <option value="discontinued" className="bg-slate-900">Discontinued</option>
                <option value="pending_refill" className="bg-slate-900">Pending Refill</option>
                <option value="on_hold" className="bg-slate-900">On Hold</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Start Date</label>
              <input
                type="date"
                disabled={isClinicianOrVerified}
                value={formData.start_date || ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-violet-500 transition disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">End Date</label>
              <input
                type="date"
                disabled={isClinicianOrVerified}
                value={formData.end_date || ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-violet-500 transition disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Prescribing Clinician</label>
              <input
                type="text"
                disabled={isClinicianOrVerified}
                value={formData.prescribing_doctor_name || ''}
                onChange={(e) => setFormData({ ...formData, prescribing_doctor_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Pharmacy</label>
              <input
                type="text"
                disabled={isClinicianOrVerified}
                value={formData.pharmacy || ''}
                onChange={(e) => setFormData({ ...formData, pharmacy: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Refills Remaining</label>
              <input
                type="number"
                min="0"
                disabled={isClinicianOrVerified}
                value={formData.refills_remaining ?? 0}
                onChange={(e) => setFormData({ ...formData, refills_remaining: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-violet-500 transition disabled:opacity-60"
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Instructions / Administration Directions</label>
            <textarea
              rows={2}
              value={formData.instructions || ''}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          {/* Clinical Amendment Justification (Mandatory for verified/clinician) */}
          {isClinicianOrVerified && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-amber-500/30 space-y-2">
              <label className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                EHR Clinical Amendment Reason <span className="text-rose-400">*</span>
              </label>
              <p className="text-[11px] text-slate-400">
                Please specify why this clinician-verified prescription is being updated (e.g., dosage titration by MD, side effect management, pharmacy correction).
              </p>
              <textarea
                rows={2}
                value={amendmentReason}
                onChange={(e) => setAmendmentReason(e.target.value)}
                placeholder="Document clinical justification for amendment (min 5 characters)..."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
              />
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
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
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 shadow-md shadow-violet-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving Changes...
                </>
              ) : isClinicianOrVerified ? (
                'Save Clinical Amendment'
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

