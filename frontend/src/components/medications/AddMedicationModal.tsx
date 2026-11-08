import React, { useState } from 'react'
import {
  X,
  Plus,
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
  onSuccess: (newMed: PrescriptionItem) => void
  existingPrescriptions?: PrescriptionItem[]
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

export const AddMedicationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  existingPrescriptions = [],
}) => {
  const [useExistingRx, setUseExistingRx] = useState(false)
  const [selectedRxId, setSelectedRxId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    medication_name: '',
    brand_name: '',
    generic_name: '',
    strength: '',
    dosage_form: 'Oral Tablet',
    dosage: '1 tablet',
    frequency: 'Once daily',
    route: 'Oral',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    prescription_date: new Date().toISOString().slice(0, 10),
    prescribing_doctor_name: '',
    pharmacy: '',
    refills_remaining: 3,
    refills_total: 3,
    instructions: '',
    notes: '',
  })

  if (!isOpen) return null

  const handleSelectExisting = (rxId: string) => {
    setSelectedRxId(rxId)
    const rx = existingPrescriptions.find((p) => p.id === rxId)
    if (rx) {
      setFormData({
        medication_name: rx.medication_name,
        brand_name: rx.brand_name || '',
        generic_name: rx.generic_name || '',
        strength: rx.strength || '',
        dosage_form: rx.dosage_form || 'Oral Tablet',
        dosage: rx.dosage,
        frequency: rx.frequency,
        route: rx.route || 'Oral',
        start_date: rx.start_date || new Date().toISOString().slice(0, 10),
        end_date: rx.end_date || '',
        prescription_date: rx.prescription_date || new Date().toISOString().slice(0, 10),
        prescribing_doctor_name: rx.prescribing_doctor_name || '',
        pharmacy: rx.pharmacy || '',
        refills_remaining: rx.refills_remaining ?? 0,
        refills_total: rx.refills_total ?? rx.refills_remaining ?? 0,
        instructions: rx.instructions || '',
        notes: rx.notes || '',
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.medication_name.trim()) {
      setError('Medication name is required')
      return
    }
    if (!formData.dosage.trim()) {
      setError('Prescribed dose is required')
      return
    }
    if (!formData.frequency.trim()) {
      setError('Frequency is required')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await api.post('/api/v1/prescriptions', {
        medication_name: formData.medication_name.trim(),
        brand_name: formData.brand_name.trim() || null,
        generic_name: formData.generic_name.trim() || null,
        strength: formData.strength.trim() || null,
        dosage_form: formData.dosage_form,
        dosage: formData.dosage.trim(),
        frequency: formData.frequency.trim(),
        route: formData.route,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        prescription_date: formData.prescription_date || null,
        prescribing_doctor_name: formData.prescribing_doctor_name.trim() || null,
        pharmacy: formData.pharmacy.trim() || null,
        refills_remaining: Number(formData.refills_remaining) || 0,
        refills_total: Number(formData.refills_total) || 0,
        instructions: formData.instructions.trim() || null,
        notes: formData.notes.trim() || null,
        status: 'active',
      })

      onSuccess(res.data)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to add medication. Please verify inputs.')
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
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Plus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Add Medication to Regimen
              </h2>
              <p className="text-xs text-slate-400">
                Connected with Prescription Analyzer and Electronic Health Record
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Link to existing prescription option */}
          {existingPrescriptions.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Pill size={14} className="text-teal-400" />
                  Link to Recorded Prescription
                </span>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useExistingRx}
                    onChange={(e) => setUseExistingRx(e.target.checked)}
                    className="rounded border-slate-700 text-teal-600 focus:ring-teal-500/20"
                  />
                  <span>Select from Prescriptions</span>
                </label>
              </div>

              {useExistingRx && (
                <select
                  value={selectedRxId}
                  onChange={(e) => handleSelectExisting(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-500 transition"
                >
                  <option value="">-- Choose a recorded prescription to auto-fill --</option>
                  {existingPrescriptions.map((rx) => (
                    <option key={rx.id} value={rx.id}>
                      {rx.medication_name} ({rx.dosage}) — Dr. {rx.prescribing_doctor_name || 'N/A'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Clinical Regimen Notice */}
          <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-200/90 text-xs flex items-center gap-2">
            <Info size={15} className="shrink-0 text-teal-400" />
            <span>
              This medication will appear in your daily dosage checklist, safety screening engine, and cross-reference your medical documents.
            </span>
          </div>

          {/* Grid Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                Medication Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.medication_name}
                onChange={(e) => setFormData({ ...formData, medication_name: e.target.value })}
                placeholder="e.g. Metformin Hydrochloride"
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Brand Name</label>
              <input
                type="text"
                value={formData.brand_name}
                onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                placeholder="e.g. Glucophage"
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Generic Name</label>
              <input
                type="text"
                value={formData.generic_name}
                onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                placeholder="e.g. Metformin"
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Strength</label>
              <input
                type="text"
                value={formData.strength}
                onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                placeholder="e.g. 500 mg"
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Dosage Form</label>
              <select
                value={formData.dosage_form}
                onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
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
                Dose Amount <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                placeholder="e.g. 1 tablet"
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                Frequency / Routine <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                placeholder="e.g. Twice daily with meals"
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Route</label>
              <select
                value={formData.route}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              >
                {ROUTES.map((r) => (
                  <option key={r} value={r} className="bg-slate-900">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Prescribing Clinician</label>
              <input
                type="text"
                value={formData.prescribing_doctor_name}
                onChange={(e) => setFormData({ ...formData, prescribing_doctor_name: e.target.value })}
                placeholder="e.g. Dr. Sarah Chen"
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Pharmacy</label>
              <input
                type="text"
                value={formData.pharmacy}
                onChange={(e) => setFormData({ ...formData, pharmacy: e.target.value })}
                placeholder="e.g. Walgreens #4829"
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Refills Authorized</label>
              <input
                type="number"
                min="0"
                value={formData.refills_remaining}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0
                  setFormData({ ...formData, refills_remaining: val, refills_total: val })
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Instructions / Advisory</label>
            <textarea
              rows={2}
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="e.g. Take with food. Avoid grapefruit juice."
              className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Footer */}
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
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving Medication...
                </>
              ) : (
                <>
                  <Plus size={14} /> Add to Regimen
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

