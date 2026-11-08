import React, { useState, useEffect } from 'react'
import { X, Building, Check, AlertCircle, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

export interface DepartmentItem {
  id?: string
  name: string
  code: string
  description: string
  doctor_count: number
  icon: string
  location?: string
  phone?: string
  email?: string
  head_of_department?: string
  is_active?: boolean
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newSpecialty: DepartmentItem) => void
  specialtyToEdit?: DepartmentItem | null
}

export const SpecialtyModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  specialtyToEdit,
}) => {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('Main Hospital Pavilion')
  const [phone, setPhone] = useState('(555) 019-2800')
  const [email, setEmail] = useState('')
  const [headOfDepartment, setHeadOfDepartment] = useState('')
  const [icon, setIcon] = useState('Stethoscope')
  const [isActive, setIsActive] = useState(true)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (specialtyToEdit) {
      setName(specialtyToEdit.name || '')
      setCode(specialtyToEdit.code || '')
      setDescription(specialtyToEdit.description || '')
      setLocation(specialtyToEdit.location || 'Main Hospital Pavilion')
      setPhone(specialtyToEdit.phone || '(555) 019-2800')
      setEmail(specialtyToEdit.email || '')
      setHeadOfDepartment(specialtyToEdit.head_of_department || '')
      setIcon(specialtyToEdit.icon || 'Stethoscope')
      setIsActive(specialtyToEdit.is_active ?? true)
    } else {
      setName('')
      setCode('')
      setDescription('')
      setLocation('Main Hospital Pavilion')
      setPhone('(555) 019-2800')
      setEmail('')
      setHeadOfDepartment('')
      setIcon('Stethoscope')
      setIsActive(true)
    }
    setErrorMessage(null)
  }, [specialtyToEdit, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim() || !description.trim()) {
      setErrorMessage('Please fill in Specialty Name, Department Code, and Description.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        location: location.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        head_of_department: headOfDepartment.trim() || undefined,
        icon,
        is_active: isActive,
      }

      let res
      if (specialtyToEdit && specialtyToEdit.id) {
        res = await api.put(`/api/v1/appointments/specialties/${specialtyToEdit.id}`, payload)
      } else {
        res = await api.post('/api/v1/appointments/specialties', payload)
      }

      onSuccess(res.data)
      onClose()
    } catch (err: any) {
      console.error('Failed to save specialty:', err)
      const detail = err.response?.data?.detail
      setErrorMessage(
        typeof detail === 'string'
          ? detail
          : 'Failed to save specialty. Ensure code/name are unique and you have administrator privileges.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {specialtyToEdit ? 'Edit Medical Specialty' : 'Add New Medical Specialty'}
              </h2>
              <p className="text-xs text-slate-400">
                Configure clinical department catalog, service description, and assigned clinic location.
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
                Specialty Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Pediatric Oncology"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Department Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PED-ONC"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Department Description *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Comprehensive clinical scope, specialized equipment, tertiary care services..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Hospital / Clinic Location
              </label>
              <input
                type="text"
                placeholder="e.g. Main Pavilion, Floor 3"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Department Contact Phone
              </label>
              <input
                type="text"
                placeholder="(555) 019-2800"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Department Email
              </label>
              <input
                type="email"
                placeholder="dept@medicare.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Head of Department / Chief Clinician
              </label>
              <input
                type="text"
                placeholder="Dr. Full Name, MD"
                value={headOfDepartment}
                onChange={(e) => setHeadOfDepartment(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-700"
              />
              <span>Specialty Active & Accepting Bookings</span>
            </label>

            <span className="text-[11px] text-slate-500">
              Role requirement: Administrator or Medical Staff
            </span>
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
              className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> {specialtyToEdit ? 'Save Changes' : 'Create Specialty'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

