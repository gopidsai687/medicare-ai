import React, { useState } from 'react'
import {
  Bell,
  Share2,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  UserCheck,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import { api } from '@/lib/api'

export interface VitalReminderItem {
  id: string
  reminder_type: string
  label: string
  time_of_day: string
  frequency: string
  days_of_week?: string | null
  is_active: boolean
}

export interface SharingConsentItem {
  id: string
  doctor_id: string
  doctor_name?: string
  doctor_specialty?: string
  is_active: boolean
  consented_at: string
  notes?: string | null
}

export interface RemindersConsentModalProps {
  isOpen: boolean
  onClose: () => void
  reminders: VitalReminderItem[]
  consents: SharingConsentItem[]
  onRefreshReminders: () => void
  onRefreshConsents: () => void
}

export const RemindersConsentModal: React.FC<RemindersConsentModalProps> = ({
  isOpen,
  onClose,
  reminders = [],
  consents = [],
  onRefreshReminders,
  onRefreshConsents,
}) => {
  const [activeTab, setActiveTab] = useState<'reminders' | 'consent'>('reminders')

  // New reminder state
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState('blood_pressure')
  const [newTime, setNewTime] = useState('08:00')
  const [newFrequency, setNewFrequency] = useState('daily')
  const [submittingReminder, setSubmittingReminder] = useState(false)
  const [reminderError, setReminderError] = useState<string | null>(null)

  // New consent state
  const [doctorEmail, setDoctorEmail] = useState('sarah.chen@medicare.ai')
  const [submittingConsent, setSubmittingConsent] = useState(false)
  const [consentError, setConsentError] = useState<string | null>(null)
  const [consentSuccess, setConsentSuccess] = useState<string | null>(null)

  if (!isOpen) return null

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim()) return

    setReminderError(null)
    try {
      setSubmittingReminder(true)
      await api.post('/api/v1/vitals/reminders', {
        reminder_type: newType,
        label: newLabel.trim(),
        time_of_day: newTime,
        frequency: newFrequency,
        is_active: true,
      })
      setNewLabel('')
      onRefreshReminders()
    } catch (err: any) {
      setReminderError(err?.response?.data?.detail || 'Failed to create reminder.')
    } finally {
      setSubmittingReminder(false)
    }
  }

  const handleDeleteReminder = async (id: string) => {
    try {
      await api.delete(`/api/v1/vitals/reminders/${id}`)
      onRefreshReminders()
    } catch (err) {
      console.error('Failed to delete reminder:', err)
    }
  }

  const handleToggleReminder = async (reminder: VitalReminderItem) => {
    try {
      await api.put(`/api/v1/vitals/reminders/${reminder.id}`, {
        is_active: !reminder.is_active,
        time_of_day: reminder.time_of_day,
        label: reminder.label,
        frequency: reminder.frequency,
      })
      onRefreshReminders()
    } catch (err) {
      console.error('Failed to toggle reminder:', err)
    }
  }

  const handleGrantConsent = async (e: React.FormEvent) => {
    e.preventDefault()
    setConsentError(null)
    setConsentSuccess(null)

    try {
      setSubmittingConsent(true)
      await api.post('/api/v1/vitals/consent', {
        doctor_email: doctorEmail.trim(),
        notes: 'Patient authorized VitalSense telemetry access for clinical oversight',
      })
      setConsentSuccess('Physician telemetry sharing consent updated successfully.')
      onRefreshConsents()
    } catch (err: any) {
      setConsentError(err?.response?.data?.detail || 'Failed to authorize doctor sharing.')
    } finally {
      setSubmittingConsent(false)
    }
  }

  const handleRevokeConsent = async (id: string) => {
    try {
      await api.delete(`/api/v1/vitals/consent/${id}`)
      onRefreshConsents()
    } catch (err) {
      console.error('Failed to revoke consent:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="rounded-2xl border border-slate-700 bg-slate-900 max-w-lg w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Measurement Schedules &amp; Clinical Sharing</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigator */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('reminders')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'reminders'
                ? 'bg-slate-800 text-teal-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell size={14} />
            <span>Telemetry Reminders ({reminders.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('consent')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'consent'
                ? 'bg-slate-800 text-teal-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Share2 size={14} />
            <span>Doctor Sharing ({consents.length})</span>
          </button>
        </div>

        {/* ── Tab 1: Reminders ────────────────────────────────────────────── */}
        {activeTab === 'reminders' && (
          <div className="space-y-4 text-xs">
            {reminderError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                {reminderError}
              </div>
            )}

            {/* Existing Reminders List */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {reminders.length > 0 ? (
                reminders.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => handleToggleReminder(r)}
                        className={`w-4 h-4 rounded flex items-center justify-center border cursor-pointer transition-colors ${
                          r.is_active
                            ? 'bg-teal-600 border-teal-500 text-white'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {r.is_active && <CheckCircle2 size={12} />}
                      </button>
                      <div>
                        <h4 className={`font-semibold ${r.is_active ? 'text-white' : 'text-slate-500 line-through'}`}>
                          {r.label}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {r.time_of_day} • {r.frequency}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteReminder(r.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                      title="Delete reminder"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-500 text-xs">
                  No scheduled reminders configured. Add your first reminder below.
                </div>
              )}
            </div>

            {/* Add New Reminder Form */}
            <form onSubmit={handleCreateReminder} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
              <span className="font-semibold text-white block">Add Schedule</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="e.g., Morning Fasting Glucose"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full bg-slate-900 p-2 rounded-lg border border-slate-800 text-white focus:outline-none focus:border-teal-500"
                />
                <input
                  type="time"
                  required
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full bg-slate-900 p-2 rounded-lg border border-slate-800 text-white font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submittingReminder}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold cursor-pointer transition-colors disabled:opacity-50"
                >
                  {submittingReminder ? 'Adding...' : '+ Add Schedule'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tab 2: Physician Sharing Consent ────────────────────────────── */}
        {activeTab === 'consent' && (
          <div className="space-y-4 text-xs">
            {consentError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                {consentError}
              </div>
            )}
            {consentSuccess && (
              <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300">
                {consentSuccess}
              </div>
            )}

            {/* Active Consents */}
            <div className="space-y-2">
              <span className="font-semibold text-slate-300 block">Authorized Physicians</span>
              {consents.length > 0 ? (
                consents.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
                        <UserCheck size={16} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">
                          {c.doctor_name || 'Dr. Sarah Chen'}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {c.doctor_specialty || 'Cardiology & Internal Medicine'} • Consented
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevokeConsent(c.id)}
                      className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-[11px] font-medium cursor-pointer transition-colors"
                    >
                      Revoke Access
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-center">
                  No doctor sharing consents currently authorized. Authorize your doctor below to allow them to review your VitalSense trends.
                </div>
              )}
            </div>

            {/* Grant Consent Form */}
            <form onSubmit={handleGrantConsent} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
              <span className="font-semibold text-white block">Authorize Physician Access</span>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Doctor Email / System ID
                </label>
                <input
                  type="email"
                  required
                  value={doctorEmail}
                  onChange={(e) => setDoctorEmail(e.target.value)}
                  className="w-full bg-slate-900 p-2 rounded-lg border border-slate-800 text-white focus:outline-none focus:border-teal-500"
                  placeholder="doctor@medicare.ai"
                />
              </div>

              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-[10px] text-slate-400">
                Granting access allows your physician to review telemetry trends, view guideline classifications, and annotate clinical notes.
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submittingConsent}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold cursor-pointer transition-colors disabled:opacity-50"
                >
                  {submittingConsent ? 'Authorizing...' : 'Grant Access'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
