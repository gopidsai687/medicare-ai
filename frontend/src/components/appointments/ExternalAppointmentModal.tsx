import React, { useState, useEffect } from 'react'
import { X, CalendarPlus, Check, AlertCircle, Loader2, Hospital, ShieldAlert } from 'lucide-react'
import { api } from '@/lib/api'

export interface ExternalAppointmentItem {
  id: string
  patient_id: string
  doctor_name: string
  hospital_name: string
  appointment_reference: string
  scheduled_at: string
  duration_minutes: number
  reason: string
  department: string
  contact_phone?: string
  contact_email?: string
  status: string
  verification_status: string
  is_external: boolean
  notes?: string
  created_at: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newExtAppt: ExternalAppointmentItem) => void
  apptToEdit?: ExternalAppointmentItem | null
}

export const ExternalAppointmentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  apptToEdit,
}) => {
  const [doctorName, setDoctorName] = useState('')
  const [hospitalName, setHospitalName] = useState('Mayo Clinic')
  const [appointmentReference, setAppointmentReference] = useState('')
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })
  const [timeStr, setTimeStr] = useState('10:00')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [reason, setReason] = useState('')
  const [department, setDepartment] = useState('Endocrinology')
  const [contactPhone, setContactPhone] = useState('(555) 019-3300')
  const [contactEmail, setContactEmail] = useState('')
  const [status, setStatus] = useState('scheduled')
  const [notes, setNotes] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (apptToEdit) {
      setDoctorName(apptToEdit.doctor_name || '')
      setHospitalName(apptToEdit.hospital_name || '')
      setAppointmentReference(apptToEdit.appointment_reference || '')
      if (apptToEdit.scheduled_at) {
        const dt = new Date(apptToEdit.scheduled_at)
        setDate(dt.toISOString().split('T')[0])
        setTimeStr(dt.toTimeString().substring(0, 5))
      }
      setDurationMinutes(apptToEdit.duration_minutes || 30)
      setReason(apptToEdit.reason || '')
      setDepartment(apptToEdit.department || 'General Medicine')
      setContactPhone(apptToEdit.contact_phone || '')
      setContactEmail(apptToEdit.contact_email || '')
      setStatus(apptToEdit.status || 'scheduled')
      setNotes(apptToEdit.notes || '')
    } else {
      setDoctorName('')
      setHospitalName('Mayo Clinic - Rochester')
      setAppointmentReference(`EXT-${Math.floor(100000 + Math.random() * 900000)}`)
      const d = new Date()
      d.setDate(d.getDate() + 3)
      setDate(d.toISOString().split('T')[0])
      setTimeStr('10:00')
      setDurationMinutes(30)
      setReason('')
      setDepartment('Endocrinology')
      setContactPhone('')
      setContactEmail('')
      setStatus('scheduled')
      setNotes('')
    }
    setErrorMessage(null)
  }, [apptToEdit, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!doctorName.trim() || !hospitalName.trim() || !reason.trim() || !date) {
      setErrorMessage('Please provide Physician Name, Hospital/Clinic, Date, and Reason for visit.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const scheduledIso = new Date(`${date}T${timeStr}:00`).toISOString()
      const payload = {
        doctor_name: doctorName.trim(),
        hospital_name: hospitalName.trim(),
        appointment_reference: appointmentReference.trim() || undefined,
        scheduled_at: scheduledIso,
        duration_minutes: Number(durationMinutes),
        reason: reason.trim(),
        department: department.trim(),
        contact_phone: contactPhone.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
      }

      let res
      if (apptToEdit && apptToEdit.id) {
        res = await api.put(`/api/v1/appointments/external/${apptToEdit.id}`, payload)
      } else {
        res = await api.post('/api/v1/appointments/external', payload)
      }

      onSuccess(res.data)
      onClose()
    } catch (err: any) {
      console.error('Failed to log external appointment:', err)
      const detail = err.response?.data?.detail
      setErrorMessage(
        typeof detail === 'string'
          ? detail
          : 'Failed to record external appointment. Please verify details and try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  {apptToEdit ? 'Edit External Appointment' : 'Record External Appointment'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Patient-Entered
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Track consultations booked with external hospitals, regional specialists, or private clinics.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clinical Integrity Notice */}
        <div className="px-6 py-2.5 bg-amber-950/20 border-b border-amber-500/20 flex items-center gap-2 text-xs text-amber-200/90">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Clinical Integrity Notice:</strong> This appointment is logged as a patient self-reported record and will appear with an explicit <em>Patient-entered / External appointment</em> tag.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Hospital / Clinic / Medical Center *
              </label>
              <div className="relative">
                <Hospital className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Mayo Clinic, Cleveland Clinic"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Attending Physician / Specialist *
              </label>
              <input
                type="text"
                required
                placeholder="Dr. Specialist Name, MD"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Appointment Reference Code
              </label>
              <input
                type="text"
                placeholder="EXT-2026-XXXXXX"
                value={appointmentReference}
                onChange={(e) => setAppointmentReference(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Scheduled Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Scheduled Time
              </label>
              <input
                type="time"
                required
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Department / Specialty *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Endocrinology, Oncology, Cardiology"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Current Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 capitalize"
              >
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed with Clinic</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Primary Reason / Clinical Objective *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Thyroid nodule evaluation, blood pressure follow-up, second opinion..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                External Clinic Phone
              </label>
              <input
                type="text"
                placeholder="(555) 019-3300"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                External Clinic Email / Portal
              </label>
              <input
                type="text"
                placeholder="appointments@mayo.edu"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Patient Instructions / Lab Preparation Notes
            </label>
            <textarea
              rows={2}
              placeholder="Bring previous lab results, fasting 12 hours prior, medication list..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> {apptToEdit ? 'Save Changes' : 'Record External Appointment'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

