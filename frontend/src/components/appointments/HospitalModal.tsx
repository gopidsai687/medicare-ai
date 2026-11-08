import React, { useState } from 'react'
import { X, Building2, Check, AlertCircle, Loader2, PhoneCall } from 'lucide-react'
import { api } from '@/lib/api'

export interface HospitalContactItem {
  id: string
  hospital_id: string
  contact_type: string
  label: string
  phone: string
  email?: string
  available_hours: string
  is_emergency: boolean
  is_verified: boolean
}

export interface HospitalItem {
  id: string
  name: string
  hospital_type: string
  address: string
  city: string
  state: string
  zip_code: string
  phone: string
  emergency_phone: string
  departments_available?: string
  operating_hours: string
  website?: string
  is_verified: boolean
  is_active: boolean
  contacts: HospitalContactItem[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newHospital: HospitalItem) => void
}

export const HospitalModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('')
  const [hospitalType, setHospitalType] = useState('Academic Medical Center & Level 1 Trauma')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('NY')
  const [zipCode, setZipCode] = useState('')
  const [phone, setPhone] = useState('(555) 019-2000')
  const [emergencyPhone, setEmergencyPhone] = useState('911 / (555) 019-9911')
  const [departmentsAvailable, setDepartmentsAvailable] = useState('Emergency & Trauma, Cardiology, Oncology, Neurology, Orthopedics')
  const [operatingHours, setOperatingHours] = useState('Emergency: 24/7/365 | Outpatient: Mon-Fri 8am-6pm')
  const [website, setWebsite] = useState('https://')

  // Initial Emergency Hotline
  const [emergencyLabel, setEmergencyLabel] = useState('24/7 Level 1 Trauma & Resuscitation Center')
  const [emergencyHotline, setEmergencyHotline] = useState('(555) 019-9911')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !address.trim() || !city.trim() || !phone.trim() || !emergencyPhone.trim()) {
      setErrorMessage('Please fill in Hospital Name, Address, City, Main Phone, and Emergency Hotline.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const payload = {
        name: name.trim(),
        hospital_type: hospitalType.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zip_code: zipCode.trim(),
        phone: phone.trim(),
        emergency_phone: emergencyPhone.trim(),
        departments_available: departmentsAvailable.trim(),
        operating_hours: operatingHours.trim(),
        website: website.trim() || undefined,
        contacts: [
          {
            contact_type: 'Emergency Department',
            label: emergencyLabel.trim() || '24/7 Emergency Department',
            phone: emergencyHotline.trim() || emergencyPhone.trim(),
            available_hours: '24/7/365',
            is_emergency: true,
            is_verified: true,
          },
        ],
      }

      const res = await api.post('/api/v1/appointments/hospitals', payload)
      onSuccess(res.data)
      onClose()
    } catch (err: any) {
      console.error('Failed to register hospital:', err)
      const detail = err.response?.data?.detail
      setErrorMessage(
        typeof detail === 'string'
          ? detail
          : 'Failed to create hospital record. Ensure you have administrator or medical staff permissions.'
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
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Add Hospital Facility & Emergency Contact</h2>
              <p className="text-xs text-slate-400">
                Register regional hospital campus, trauma designation, emergency switchboard, and triage services.
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
                Hospital / Facility Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Northwestern Memorial Hospital"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Facility & Trauma Classification
              </label>
              <input
                type="text"
                placeholder="e.g. Academic Medical Center & Level 1 Trauma"
                value={hospitalType}
                onChange={(e) => setHospitalType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Street Address *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 500 Healthcare Blvd, Pavilion North"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">City *</label>
              <input
                type="text"
                required
                placeholder="New York"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">State (2 letters)</label>
              <input
                type="text"
                maxLength={2}
                placeholder="NY"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono uppercase text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">ZIP Code</label>
              <input
                type="text"
                placeholder="10001"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Main Switchboard Phone *
              </label>
              <input
                type="text"
                required
                placeholder="(555) 019-2000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Primary Emergency Hotline *
              </label>
              <div className="relative">
                <PhoneCall className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-rose-400" />
                <input
                  type="text"
                  required
                  placeholder="911 / (555) 019-9911"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-rose-500/30 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Available Tertiary & Specialty Departments
            </label>
            <input
              type="text"
              placeholder="e.g. Emergency, Cardiology, Neurology, Oncology, Trauma, Orthopedics"
              value={departmentsAvailable}
              onChange={(e) => setDepartmentsAvailable(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Operating Hours
              </label>
              <input
                type="text"
                placeholder="Emergency: 24/7/365 | Outpatient: Mon-Fri 8am-6pm"
                value={operatingHours}
                onChange={(e) => setOperatingHours(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Hospital Website
              </label>
              <input
                type="text"
                placeholder="https://hospital.org"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs font-bold text-slate-300 block">Initial Emergency Unit Contact</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Unit Label (e.g. 24/7 Acute Trauma Hotline)"
                value={emergencyLabel}
                onChange={(e) => setEmergencyLabel(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
              />
              <input
                type="text"
                placeholder="Direct Phone (e.g. (555) 019-9911)"
                value={emergencyHotline}
                onChange={(e) => setEmergencyHotline(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
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
              className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Register Hospital Facility
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

