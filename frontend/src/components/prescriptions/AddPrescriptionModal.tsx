import React, { useState, useRef } from 'react'
import {
  X,
  Upload,
  FileText,
  Plus,
  AlertCircle,
  Check,
  Calendar,
  Pill,
  Sparkles,
  Loader2,
  Edit2,
  Trash2,
  Info,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import api from '@/lib/api'

export interface PrescriptionItem {
  id: string
  medication_name: string
  brand_name?: string
  generic_name?: string
  strength?: string
  dosage_form?: string
  dosage: string
  frequency: string
  route?: string
  start_date: string
  end_date?: string
  prescription_date?: string
  prescribing_doctor_name?: string
  pharmacy?: string
  refills_remaining: number
  refills_total?: number
  instructions?: string
  notes?: string
  status: string
  source?: string
  is_patient_reported?: boolean
  is_verified?: boolean
  document_url?: string
  document_name?: string
  analysis_report_id?: string
  is_amended?: boolean
  is_archived?: boolean
  discontinued_reason?: string
  archived_reason?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newRx: PrescriptionItem) => void
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

export const AddPrescriptionModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload & Verification states
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccessInfo, setUploadSuccessInfo] = useState<{ upload_id: string; file_name: string } | null>(null)
  const [extractedItems, setExtractedItems] = useState<any[]>([])
  const [isVerifying, setIsVerifying] = useState(false)

  // Manual Form states
  const [medicationName, setMedicationName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [genericName, setGenericName] = useState('')
  const [strength, setStrength] = useState('')
  const [dosageForm, setDosageForm] = useState(DOSAGE_FORMS[0])
  const [dosage, setDosage] = useState('1 tablet')
  const [frequency, setFrequency] = useState('Once daily in the morning')
  const [route, setRoute] = useState('Oral')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [prescriptionDate, setPrescriptionDate] = useState(new Date().toISOString().split('T')[0])
  const [doctorName, setDoctorName] = useState('')
  const [pharmacy, setPharmacy] = useState('')
  const [refillsRemaining, setRefillsRemaining] = useState(2)
  const [refillsTotal, setRefillsTotal] = useState(3)
  const [instructions, setInstructions] = useState('')
  const [notes, setNotes] = useState('')
  const [manualDocumentName, setManualDocumentName] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  // ── Upload Workflow ────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
      if (!validTypes.includes(f.type) && !f.name.match(/\.(pdf|jpe?g|png)$/i)) {
        setUploadError('Supported file formats: PDF, JPG, JPEG, PNG')
        return
      }
      setSelectedFile(f)
      setUploadError(null)
    }
  }

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      setUploadError('Please select a prescription document to upload.')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await api.post('/api/v1/prescription-analysis/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const data = res.data
      setUploadSuccessInfo({ upload_id: data.upload_id, file_name: data.file_name })
      setExtractedItems(data.extracted_items || [])
      setIsVerifying(true)
    } catch (err: any) {
      console.error('Upload failed:', err)
      const msg = err.response?.data?.detail || err.message || 'Prescription OCR upload failed.'
      setUploadError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpdateExtractedItem = (index: number, field: string, val: any) => {
    const updated = [...extractedItems]
    updated[index] = { ...updated[index], [field]: val }
    setExtractedItems(updated)
  }

  const handleConfirmVerification = async () => {
    if (!uploadSuccessInfo) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      // 1. Confirm items with prescription-analysis
      await api.post(`/api/v1/prescription-analysis/uploads/${uploadSuccessInfo.upload_id}/confirm-items`, {
        items: extractedItems.map(it => ({
          medication_name: it.medication_name,
          strength: it.strength,
          dosage: it.dosage,
          route: it.route || 'Oral',
          frequency: it.frequency,
          duration: it.duration,
          instructions: it.instructions,
          patient_verified: true,
          patient_notes: it.patient_notes,
        })),
      })

      // 2. Fetch the newly created prescription from /prescriptions
      const rxRes = await api.get('/api/v1/prescriptions', {
        params: { status: 'all' },
      })
      if (Array.isArray(rxRes.data) && rxRes.data.length > 0) {
        onSuccess(rxRes.data[0])
      }
      onClose()
    } catch (err: any) {
      console.error('Confirmation failed:', err)
      const msg = err.response?.data?.detail || err.message || 'Verification save failed.'
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Manual Entry Workflow ──────────────────────────────────────────────────
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!medicationName.trim()) {
      setErrorMessage('Medication name is required.')
      return
    }
    if (!dosage.trim()) {
      setErrorMessage('Prescribed dosage amount is required.')
      return
    }

    setIsSubmitting(true)

    try {
      const payload: any = {
        medication_name: medicationName.trim(),
        brand_name: brandName.trim() || undefined,
        generic_name: genericName.trim() || undefined,
        strength: strength.trim() || undefined,
        dosage_form: dosageForm,
        dosage: dosage.trim(),
        frequency: frequency.trim(),
        route: route,
        start_date: startDate,
        end_date: endDate || undefined,
        prescription_date: prescriptionDate || undefined,
        prescribing_doctor_name: doctorName.trim() || undefined,
        pharmacy: pharmacy.trim() || undefined,
        refills_remaining: Number(refillsRemaining) || 0,
        refills_total: Number(refillsTotal) || Number(refillsRemaining) || 0,
        instructions: instructions.trim() || undefined,
        notes: notes.trim() || undefined,
        status: 'active',
        document_name: manualDocumentName.trim() || undefined,
        document_url: manualDocumentName.trim() ? `/documents/${encodeURIComponent(manualDocumentName.trim())}` : undefined,
      }

      const res = await api.post('/api/v1/prescriptions', payload)
      onSuccess(res.data)
      onClose()
    } catch (err: any) {
      console.error('Failed to create manual prescription:', err)
      const msg = err.response?.data?.detail || err.message || 'Failed to save prescription.'
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="glass w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7 relative border border-white/10 shadow-2xl space-y-5 custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Add Prescription</h2>
              <p className="text-xs text-slate-400">
                Upload official Rx documents for OCR or enter complete prescription details
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

        {/* Tab Switcher (Option A vs Option B) */}
        {!isVerifying && (
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload size={14} /> Option A: Upload Prescription Document
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Plus size={14} /> Option B: Enter Prescription Manually
            </button>
          </div>
        )}

        {/* Error Callouts */}
        {(uploadError || errorMessage) && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError || errorMessage}</span>
          </div>
        )}

        {/* ── OPTION A: UPLOAD PRESCRIPTION ──────────────────────────────────── */}
        {activeTab === 'upload' && !isVerifying && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                selectedFile
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-white/15 bg-white/5 hover:border-blue-500/40 hover:bg-white/10'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3 text-blue-400">
                <Upload size={22} />
              </div>
              <p className="text-sm font-semibold text-white">
                {selectedFile ? selectedFile.name : 'Click to select prescription file'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports PDF, JPG, JPEG, PNG (Medical OCR text extraction engine)
              </p>
              {selectedFile && (
                <div className="mt-2 text-xs text-emerald-400 font-medium">
                  {(selectedFile.size / 1024).toFixed(1)} KB — Ready for OCR processing
                </div>
              )}
            </div>

            {/* Regulatory Safeguard Notice */}
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
              <p className="leading-relaxed">
                <strong className="text-white">Safety Verification Mandate:</strong> MediCare AI will never automatically activate a medication based solely on unverified OCR text. You will review and verify all extracted fields before saving.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedFile || isUploading}
                onClick={handleUploadSubmit}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Processing OCR Extraction...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Extract & Verify Details →
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── EDITABLE VERIFICATION SCREEN (Part 1.2) ─────────────────────────── */}
        {activeTab === 'upload' && isVerifying && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-teal-400" />
              <div>
                <span className="font-bold text-white">OCR Extraction Verification Screen:</span> Review all extracted details below. Correct any fields that appear uncertain or unreadable before confirming.
              </div>
            </div>

            <div className="space-y-3">
              {extractedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Pill size={13} className="text-teal-400" />
                      Medication #{idx + 1}
                    </span>
                    {item.is_uncertain && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                        Uncertain / Review Needed
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 uppercase text-[10px] font-semibold mb-1">
                        Medication Name *
                      </label>
                      <input
                        type="text"
                        value={item.medication_name}
                        onChange={(e) => handleUpdateExtractedItem(idx, 'medication_name', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 uppercase text-[10px] font-semibold mb-1">
                        Strength
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 500 mg, 10 mg"
                        value={item.strength || ''}
                        onChange={(e) => handleUpdateExtractedItem(idx, 'strength', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 uppercase text-[10px] font-semibold mb-1">
                        Dosage / Quantity
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1 tablet, 10 ml"
                        value={item.dosage || ''}
                        onChange={(e) => handleUpdateExtractedItem(idx, 'dosage', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 uppercase text-[10px] font-semibold mb-1">
                        Frequency
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Twice daily with meals"
                        value={item.frequency || ''}
                        onChange={(e) => handleUpdateExtractedItem(idx, 'frequency', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-400 uppercase text-[10px] font-semibold mb-1">
                        Instructions / Special Directions
                      </label>
                      <input
                        type="text"
                        value={item.instructions || ''}
                        onChange={(e) => handleUpdateExtractedItem(idx, 'instructions', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsVerifying(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                ← Back to Upload
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmVerification}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>Saving Verified Prescription...</>
                ) : (
                  <>
                    <CheckCircle2 size={14} /> Confirm & Save Shared Prescription
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── OPTION B: MANUAL PRESCRIPTION FORM ──────────────────────────────── */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4 text-xs">
            {/* Medication Name */}
            <div>
              <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                Medication Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Metformin Hydrochloride, Lisinopril, Atorvastatin"
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
              />
            </div>

            {/* Brand Name & Generic Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Brand Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Glucophage, Prinivil, Lipitor"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Generic Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Metformin HCl, Lisinopril"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
                />
              </div>
            </div>

            {/* Strength & Dosage Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Strength
                </label>
                <input
                  type="text"
                  placeholder="e.g. 500 mg, 10 mg, 25 mcg"
                  value={strength}
                  onChange={(e) => setStrength(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Dosage Form
                </label>
                <select
                  value={dosageForm}
                  onChange={(e) => setDosageForm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                >
                  {DOSAGE_FORMS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prescribed Dose, Frequency, Route */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Prescribed Dose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1 tablet, 10 ml"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Frequency *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Twice daily with meals"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Route
                </label>
                <select
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                >
                  {ROUTES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Prescription Date
                </label>
                <input
                  type="date"
                  value={prescriptionDate}
                  onChange={(e) => setPrescriptionDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            {/* Prescribing Doctor & Pharmacy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Prescribing Doctor
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Sarah Chen, MD"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Dispensing Pharmacy
                </label>
                <input
                  type="text"
                  placeholder="e.g. MetroHealth Clinic Pharmacy"
                  value={pharmacy}
                  onChange={(e) => setPharmacy(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
                />
              </div>
            </div>

            {/* Refills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Refills Remaining
                </label>
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={refillsRemaining}
                  onChange={(e) => setRefillsRemaining(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                  Total Refills Authorized
                </label>
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={refillsTotal}
                  onChange={(e) => setRefillsTotal(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            {/* Instructions & Supporting Document */}
            <div>
              <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                Additional Instructions
              </label>
              <textarea
                rows={2}
                placeholder="Take with breakfast, avoid potassium supplements..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
                Supporting Document Reference (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. rx_chen_clinic_note.pdf"
                value={manualDocumentName}
                onChange={(e) => setManualDocumentName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving Prescription...' : 'Save Prescription'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
