import { useState } from 'react'
import {
  User,
  Shield,
  Bell,
  Stethoscope,
  Lock,
  Save,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Key,
  Smartphone,
  FileText,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { PasskeySettingsCard } from '@/components/auth/PasskeySettingsCard'

export default function DoctorSettings() {
  const { user } = useAuth()
  const { success } = useToast()
  const [activeTab, setActiveTab] = useState<'profile' | 'clinical' | 'notifications' | 'security'>('profile')
  const [isSaving, setIsSaving] = useState(false)

  // Profile fields
  const [fullName, setFullName] = useState(user?.full_name || 'Dr. Sarah Chen')
  const [specialty, setSpecialty] = useState('Cardiology')
  const [npi, setNpi] = useState('1234567890')
  const [licenseNumber, setLicenseNumber] = useState('CA-MED-99214')
  const [phone, setPhone] = useState('(555) 100-2000')
  const [email, setEmail] = useState(user?.email || 'sarah.chen@medicare.ai')
  const [officeLocation, setOfficeLocation] = useState('Suite 401, Heart Center, Main Campus')
  const [bio, setBio] = useState('Attending Cardiologist with 14 years of clinical experience specializing in interventional cardiology and heart failure management.')

  // Clinical preferences
  const [defaultEncounterType, setDefaultEncounterType] = useState('Outpatient Consultation')
  const [signatureText, setSignatureText] = useState(`Dr. ${user?.full_name || 'Sarah Chen'}, MD — Cardiology`)
  const [autoSaveSoap, setAutoSaveSoap] = useState(true)
  const [soapTemplate, setSoapTemplate] = useState('Cardiology Standard SOAP')

  // Notifications
  const [emailApptReminders, setEmailApptReminders] = useState(true)
  const [smsUrgentAlerts, setSmsUrgentAlerts] = useState(true)
  const [criticalLabAlerts, setCriticalLabAlerts] = useState(true)
  const [mpiMergeAlerts, setMpiMergeAlerts] = useState(false)

  // Security
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      success('Settings saved', 'Your physician profile and clinical preferences have been updated.')
    }, 600)
  }

  const tabs = [
    { id: 'profile' as const, label: 'Physician Profile', icon: User },
    { id: 'clinical' as const, label: 'Clinical Preferences', icon: Stethoscope },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'security' as const, label: 'Security', icon: Shield },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
              <User size={22} />
            </span>
            Physician Profile & Settings
          </h1>
          <p className="page-subtitle">
            Manage your clinical profile, SOAP preferences, notifications, and security credentials
          </p>
        </div>

        <button
          form="settings-form"
          type="submit"
          disabled={isSaving}
          className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto"
        >
          {isSaving
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
            : <><Save size={15} /> Save Changes</>
          }
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-2xl bg-white/5 border border-white/10 self-start">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <form id="settings-form" onSubmit={handleSave} className="space-y-6">

        {/* ── Physician Profile ── */}
        {activeTab === 'profile' && (
          <div className="glass p-6 rounded-2xl border border-white/10 space-y-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <User size={16} className="text-blue-400" /> Physician Demographics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">Full Name (as it appears on credentials)</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">Medical Specialty</label>
                <input value={specialty} onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <FileText size={12} /> NPI Number
                </label>
                <input value={npi} onChange={(e) => setNpi(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">State Medical License</label>
                <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Phone size={12} /> Office Phone
                </label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Mail size={12} /> Clinical Email
                </label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <MapPin size={12} /> Office Location
                </label>
                <input value={officeLocation} onChange={(e) => setOfficeLocation(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 block">Clinical Biography</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50 resize-none" />
              </div>
            </div>
          </div>
        )}

        {/* ── Clinical Preferences ── */}
        {activeTab === 'clinical' && (
          <div className="space-y-5">
            <div className="glass p-6 rounded-2xl border border-white/10 space-y-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Stethoscope size={16} className="text-blue-400" /> SOAP & Encounter Defaults
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">Default Encounter Type</label>
                  <select value={defaultEncounterType} onChange={(e) => setDefaultEncounterType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50">
                    <option>Outpatient Consultation</option>
                    <option>Follow-up Visit</option>
                    <option>Emergency Consult</option>
                    <option>Telehealth Encounter</option>
                    <option>Annual Physical</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">SOAP Template</label>
                  <select value={soapTemplate} onChange={(e) => setSoapTemplate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50">
                    <option>Cardiology Standard SOAP</option>
                    <option>General Practice SOAP</option>
                    <option>Endocrinology SOAP</option>
                    <option>Pulmonology SOAP</option>
                    <option>Neurology SOAP</option>
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-400 block">Electronic Signature Text</label>
                  <input value={signatureText} onChange={(e) => setSignatureText(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-sm font-semibold text-white">Auto-save SOAP Notes</p>
                  <p className="text-xs text-slate-400 mt-0.5">Automatically draft-save every 30 seconds while composing</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoSaveSoap(!autoSaveSoap)}
                  className={`w-10 h-5.5 rounded-full relative transition-all duration-200 ${autoSaveSoap ? 'bg-blue-500' : 'bg-white/10'}`}
                  style={{ width: 40, height: 22 }}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${autoSaveSoap ? 'left-5' : 'left-0.5'}`} style={{ width: 18, height: 18, top: 2, left: autoSaveSoap ? 19 : 3 }} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Notifications ── */}
        {activeTab === 'notifications' && (
          <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Bell size={16} className="text-blue-400" /> Clinical Alert Preferences
            </h2>
            {[
              { label: 'Email appointment reminders', sub: 'Daily digest of upcoming scheduled patients', value: emailApptReminders, set: setEmailApptReminders },
              { label: 'SMS urgent clinical alerts', sub: 'Text message for critical lab results and emergencies', value: smsUrgentAlerts, set: setSmsUrgentAlerts },
              { label: 'Critical lab value notifications', sub: 'Instant alert when a patient\'s lab value exceeds critical threshold', value: criticalLabAlerts, set: setCriticalLabAlerts },
              { label: 'MPI patient merge notifications', sub: 'Notify when a patient in your panel is involved in a merge event', value: mpiMergeAlerts, set: setMpiMergeAlerts },
            ].map(({ label, sub, value, set }) => (
              <div key={label} className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
                </div>
                <button
                  type="button"
                  onClick={() => set(!value)}
                  style={{ width: 40, height: 22, position: 'relative', borderRadius: 20, background: value ? '#3182f4' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                >
                  <span style={{ position: 'absolute', top: 2, left: value ? 19 : 3, width: 18, height: 18, background: 'white', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Security ── */}
        {activeTab === 'security' && (
          <div className="space-y-5">
            <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock size={16} className="text-blue-400" /> Change Password
              </h2>
              {[
                { label: 'Current Password', value: currentPassword, set: setCurrentPassword, placeholder: 'Enter current password' },
                { label: 'New Password', value: newPassword, set: setNewPassword, placeholder: 'Min. 8 characters with uppercase, number, symbol' },
                { label: 'Confirm New Password', value: confirmPassword, set: setConfirmPassword, placeholder: 'Re-enter new password' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label} className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">{label}</label>
                  <input type="password" value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
                </div>
              ))}
            </div>

            <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone size={16} className="text-blue-400" /> Two-Factor Authentication
              </h2>
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-sm font-semibold text-white">TOTP Authenticator App</p>
                  <p className="text-xs text-slate-400 mt-0.5">Required for HIPAA-compliant provider access. Cannot be disabled.</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 size={15} /> Active
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
                <Key size={16} className="shrink-0 text-amber-400 mt-0.5" />
                <p>As a licensed provider, HIPAA Security Rule (45 CFR § 164.312) requires MFA on all EHR systems. Contact IT Security to manage MFA device enrollment.</p>
              </div>
            </div>

            {/* Biometric Passkey / Fingerprint Authentication */}
            <PasskeySettingsCard />
          </div>
        )}

      </form>
    </div>
  )
}
