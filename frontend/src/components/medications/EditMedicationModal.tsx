import React, { useState, useEffect } from 'react'
import {
  X,
  Edit3,
  Pill,
  Calendar,
  AlertCircle,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Info,
} from 'lucide-react'
import api from '@/lib/api'
import { PrescriptionItem } from '../prescriptions/AddPrescriptionModal'

interface Props {
  isOpen: boolean
  onClose: () => void
  medication: PrescriptionItem | null
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

export const EditMedicationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  medication,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<Partial<PrescriptionItem>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (medication) {
      setFormData({
        medication_name: medication.medication_name,
        brand_name: medication.brand_name || '',
        generic_name: medication.generic_name || '',
        strength: medication.strength || '',
        dosage_form: medication.dosage_form || 'Oral Tablet',
        dosage: medication.dosage,
        frequency: medication.frequency,
        route: medication.route || 'Oral',
        start_date: medication.start_date || '',
        end_date: medication.end_date || '',
        prescribing_doctor_name: medication.prescribing_doctor_name || '',
        pharmacy: medication.pharmacy || '',
        refills_remaining: medication.refills_remaining ?? 0,
        refills_total: medication.refills_total ?? medication.refills_remaining ?? 0,
        instructions: medication.instructions || '',
        status: medication.status || 'active',
      })
      setError(null)
    }
  }, [medication, isOpen])

  if (!isOpen || !medication) return null

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

    setIsSubmitting(true)
    try {
      const res = await api.put(`/api/v1/prescriptions/${medication.id}`, {
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
        prescribing_doctor_name: formData.prescribing_doctor_name?.trim() || null,
        pharmacy: formData.pharmacy?.trim() || null,
        refills_remaining: Number(formData.refills_remaining) || 0,
        refills_total: Number(formData.refills_total) || 0,
        instructions: formData.instructions?.trim() || null,
        status: formData.status,
      })

      onSuccess(res.data)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update medication.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Edit3 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Edit Medication
              </h2>
              <p className="text-xs text-slate-400">
                Adjust dosage routine, refills, or prescribing clinical information
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                Medication Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.medication_name || ''}
                onChange={(e) => setFormData({ ...formData, medication_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Strength</label>
              <input
                type="text"
                value={formData.strength || ''}
                onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Dosage Form</label>
              <select
                value={formData.dosage_form || 'Oral Tablet'}
                onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-500 transition"
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
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-500 transition"
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
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Route</label>
              <select
                value={formData.route || 'Oral'}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-500 transition"
              >
                {ROUTES.map((r) => (
                  <option key={r} value={r} className="bg-slate-900">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Prescribing Clinician</label>
              <input
                type="text"
                value={formData.prescribing_doctor_name || ''}
                onChange={(e) => setFormData({ ...formData, prescribing_doctor_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Pharmacy</label>
              <input
                type="text"
                value={formData.pharmacy || ''}
                onChange={(e) => setFormData({ ...formData, pharmacy: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Refills Remaining</label>
              <input
                type="number"
                min="0"
                value={formData.refills_remaining ?? 0}
                onChange={(e) => setFormData({ ...formData, refills_remaining: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-500 transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Instructions</label>
            <textarea
              rows={2}
              value={formData.instructions || ''}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-500 transition"
            />
          </div>

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
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 shadow-md shadow-teal-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
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

