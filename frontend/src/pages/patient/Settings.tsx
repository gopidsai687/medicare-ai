import { useState } from 'react'
import {
  User,
  Shield,
  Bell,
  CreditCard,
  Lock,
  Save,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Heart,
  Key,
  Smartphone,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'

export default function PatientSettings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'insurance' | 'notifications' | 'security'>('profile')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Profile fields
  const [fullName, setFullName] = useState(user?.full_name || 'Alice Johnson')
  const [dob, setDob] = useState('1978-03-14')
  const [bloodType, setBloodType] = useState('A+')
  const [phone, setPhone] = useState('(555) 234-5678')
  const [email, setEmail] = useState(user?.email || 'alice.johnson@example.com')
  const [address, setAddress] = useState('742 Evergreen Terrace, Springfield, OR 97477')
  const [emergencyName, setEmergencyName] = useState('Mark Johnson (Spouse)')
  const [emergencyPhone, setEmergencyPhone] = useState('(555) 987-6543')

  // Insurance fields
  const [insuranceProvider, setInsuranceProvider] = useState('BlueCross BlueShield Premier PPO')
  const [policyNumber, setPolicyNumber] = useState('BCBS-984210394')
  const [groupNumber, setGroupNumber] = useState('GRP-88219')
  const [primaryInsured, setPrimaryInsured] = useState('Alice Johnson (Self)')

  // Notifications
  const [smsAppointments, setSmsAppointments] = useState(true)
  const [smsLabs, setSmsLabs] = useState(true)
  const [emailSummaries, setEmailSummaries] = useState(true)
  const [refillReminders, setRefillReminders] = useState(true)

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
      setSaveSuccess('Your health profile and preferences have been updated and synchronized with your medical chart.')
      setTimeout(() => setSaveSuccess(''), 6000)
    }, 600)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 text-white shadow-lg shadow-blue-500/20">
              <User size={22} />
            </span>
            Patient Profile & Account Settings
          </h1>
          <p className="page-subtitle">
            Manage your personal demographics, health insurance coverage, alerts, and security credentials
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto"
        >
          {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
          <span>{isSaving ? 'Saving Changes...' : 'Save Profile'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <User size={14} /> Personal Profile
        </button>
        <button
          onClick={() => setActiveTab('insurance')}
          className={`px-4 py-2 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'insurance'
              ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <CreditCard size={14} /> Insurance & Coverage
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'notifications'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Bell size={14} /> Notifications
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'security'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Lock size={14} /> Security & Privacy
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <div className="glass p-6 rounded-2xl border border-white/10 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <User size={18} className="text-blue-400" /> Personal Identity & Clinical Demographics
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Your identity information is verified against the Master Patient Index (MPI).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Full Legal Name:</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Date of Birth:</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Blood Type:</label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                >
                  <option value="A+">A+ Positive</option>
                  <option value="A-">A- Negative</option>
                  <option value="B+">B+ Positive</option>
                  <option value="B-">B- Negative</option>
                  <option value="AB+">AB+ Positive</option>
                  <option value="AB-">AB- Negative</option>
                  <option value="O+">O+ Positive</option>
                  <option value="O-">O- Negative</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Primary Phone Number:</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Email Address:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-slate-300 font-semibold block">Residential Street Address:</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Emergency Contact Person & Relationship:</label>
              <input
                type="text"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Emergency Contact Phone Number:</label>
              <input
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Insurance */}
      {activeTab === 'insurance' && (
        <div className="glass p-6 rounded-2xl border border-white/10 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard size={18} className="text-teal-400" /> Health Insurance & Benefits Verification
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Active primary medical coverage on file with hospital billing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Insurance Provider / Carrier:</label>
              <input
                type="text"
                value={insuranceProvider}
                onChange={(e) => setInsuranceProvider(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-teal-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Subscriber / Policy ID:</label>
              <input
                type="text"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono focus:outline-none focus:border-teal-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Group Number:</label>
              <input
                type="text"
                value={groupNumber}
                onChange={(e) => setGroupNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono focus:outline-none focus:border-teal-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Primary Insured Person:</label>
              <input
                type="text"
                value={primaryInsured}
                onChange={(e) => setPrimaryInsured(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-teal-500/50"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-300 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Real-Time Eligibility Verified</span>
              <span className="text-[11px] text-teal-300/80">Electronic claims status: Active in-network copay ($25 Specialist / $15 Primary).</span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 font-bold text-[10px] uppercase">
              Verified
            </span>
          </div>
        </div>
      )}

      {/* Tab 3: Notifications */}
      {activeTab === 'notifications' && (
        <div className="glass p-6 rounded-2xl border border-white/10 space-y-6 text-xs">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bell size={18} className="text-indigo-400" /> Communication Channels & Notification Preferences
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Choose how you wish to receive clinical alerts, appointment reminders, and lab result notifications.
            </p>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
              <div>
                <span className="font-semibold text-white block">SMS Appointment Reminders</span>
                <span className="text-slate-400 text-[11px]">Receive text message reminders 48h and 2h before your scheduled visits.</span>
              </div>
              <input
                type="checkbox"
                checked={smsAppointments}
                onChange={(e) => setSmsAppointments(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-white/5 border-white/10"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
              <div>
                <span className="font-semibold text-white block">Immediate Laboratory Results Alerts</span>
                <span className="text-slate-400 text-[11px]">Get instant SMS alerts when new lab results are signed off by your doctor.</span>
              </div>
              <input
                type="checkbox"
                checked={smsLabs}
                onChange={(e) => setSmsLabs(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-white/5 border-white/10"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
              <div>
                <span className="font-semibold text-white block">Prescription Refill & Schedule Alerts</span>
                <span className="text-slate-400 text-[11px]">Timely notifications when medications need authorization or refills.</span>
              </div>
              <input
                type="checkbox"
                checked={refillReminders}
                onChange={(e) => setRefillReminders(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-white/5 border-white/10"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
              <div>
                <span className="font-semibold text-white block">Monthly Health & Telemetry Digest</span>
                <span className="text-slate-400 text-[11px]">Email summary of vital signs trends, wellness milestones, and preventive care reminders.</span>
              </div>
              <input
                type="checkbox"
                checked={emailSummaries}
                onChange={(e) => setEmailSummaries(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-white/5 border-white/10"
              />
            </label>
          </div>
        </div>
      )}

      {/* Tab 4: Security */}
      {activeTab === 'security' && (
        <div className="glass p-6 rounded-2xl border border-white/10 space-y-6 text-xs">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock size={18} className="text-purple-400" /> Account Security & Privacy Credentials
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Update password credentials and manage two-factor authentication safeguards.
            </p>
          </div>

          <div className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Current Password:</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">New Password:</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Confirm New Password:</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <label className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
              <div className="flex items-center gap-3">
                <Smartphone size={18} className="text-purple-400 shrink-0" />
                <div>
                  <span className="font-semibold text-white block">Two-Factor Authentication (2FA)</span>
                  <span className="text-slate-400 text-[11px]">Require biometric or authenticator app passkey when signing in.</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={twoFactorEnabled}
                onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 bg-white/5 border-white/10"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
