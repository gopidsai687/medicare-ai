import React, { useState } from 'react'
import { X, Stethoscope, Check, AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { DoctorProfileItem } from '@/pages/patient/Appointments'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newDoctor: DoctorProfileItem) => void
  departments: { name: string; id?: string }[]
}

export const DoctorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  departments,
}) => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [specialty, setSpecialty] = useState(departments[0]?.name || 'Cardiology')
  const [department, setDepartment] = useState(departments[0]?.name || 'Cardiology')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [qualifications, setQualifications] = useState('MD, Board Certified')
  const [experienceYears, setExperienceYears] = useState(12)
  const [consultationFee, setConsultationFee] = useState(150)
  const [languages, setLanguages] = useState('English')
  const [hospitalAffiliation, setHospitalAffiliation] = useState('MediCare Central Hospital')
  const [officeLocation, setOfficeLocation] = useState('North Pavilion, Suite 300')
  const [phone, setPhone] = useState('(555) 019-2800')
  const [bio, setBio] = useState('Dedicated physician committed to patient-centered evidence-based clinical care.')
  const [isVerified, setIsVerified] = useState(true)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || !licenseNumber.trim()) {
      setErrorMessage('Please fill in Doctor Name, Email, and Medical License Number.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        specialty: specialty.trim(),
        department: department.trim() || specialty.trim(),
        license_number: licenseNumber.trim().toUpperCase(),
        qualifications: qualifications.trim(),
        experience_years: Number(experienceYears),
        consultation_fee: Number(consultationFee),
        languages: languages.trim(),
        hospital_affiliation: hospitalAffiliation.trim(),
        office_location: officeLocation.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        is_accepting_patients: true,
        is_verified: isVerified,
      }

      const res = await api.post('/api/v1/appointments/doctors', payload)
      onSuccess(res.data)
      onClose()
    } catch (err: any) {
      console.error('Failed to register doctor:', err)
      const detail = err.response?.data?.detail
      setErrorMessage(
        typeof detail === 'string'
          ? detail
          : 'Failed to register physician. Ensure license number and email are unique and you are logged in as an Administrator.'
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
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Register Attending Doctor</h2>
              <p className="text-xs text-slate-400">
                Enroll clinical staff, board certifications, institutional affiliation, and shift parameters.
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
                Full Physician Name *
              </label>
              <input
                type="text"
                required
                placeholder="Dr. Full Name, MD"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Institutional Email *
              </label>
              <input
                type="email"
                required
                placeholder="doctor.name@medicare.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Specialty / Department *
              </label>
              <select
                value={specialty}
                onChange={(e) => {
                  setSpecialty(e.target.value)
                  setDepartment(e.target.value)
                }}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {departments.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Medical License Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. LIC-NY-491028"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Qualifications
              </label>
              <input
                type="text"
                placeholder="MD, FACS, Board Certified"
                value={qualifications}
                onChange={(e) => setQualifications(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Experience (Years)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={experienceYears}
                onChange={(e) => setExperienceYears(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Consultation Fee ($)
              </label>
              <input
                type="number"
                min={0}
                step={5}
                value={consultationFee}
                onChange={(e) => setConsultationFee(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Hospital Affiliation
              </label>
              <input
                type="text"
                placeholder="MediCare Central Hospital"
                value={hospitalAffiliation}
                onChange={(e) => setHospitalAffiliation(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Languages Spoken
              </label>
              <input
                type="text"
                placeholder="English, Spanish"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Office / Clinic Location
              </label>
              <input
                type="text"
                placeholder="Suite 300, North Wing"
                value={officeLocation}
                onChange={(e) => setOfficeLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Phone Contact
              </label>
              <input
                type="text"
                placeholder="(555) 019-2800"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Clinical Statement / Bio
            </label>
            <textarea
              rows={3}
              placeholder="Clinical focus, fellowship details, specialized patient care approach..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          <div className="p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-white block">Institutional Credential Verification</span>
                <span className="text-[11px] text-slate-400">Mark license and medical board standing as pre-verified</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isVerified}
              onChange={(e) => setIsVerified(e.target.checked)}
              className="w-4 h-4 rounded text-cyan-600 bg-slate-950 border-slate-700"
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
              className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Registering...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Register Doctor
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

