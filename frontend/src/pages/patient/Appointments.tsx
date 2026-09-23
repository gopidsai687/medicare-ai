import { useState, useEffect } from 'react'
import { Calendar, Clock, Plus, Search, Video, X, CheckCircle, AlertCircle, MapPin, User, Stethoscope } from 'lucide-react'
import api from '@/lib/api'

interface AppointmentItem {
  id: string
  doctor: string
  specialty: string
  date: string
  time: string
  type: 'In-Person' | 'Telehealth' | 'Follow-up' | 'Annual Checkup'
  location: string
  reason: string
  status: 'Confirmed' | 'Scheduled' | 'Completed' | 'Cancelled'
}

const INITIAL_APPOINTMENTS: AppointmentItem[] = [
  {
    id: 'apt-1',
    doctor: 'Dr. Sarah Chen',
    specialty: 'Cardiology',
    date: '2026-09-25',
    time: '10:00 AM',
    type: 'Telehealth',
    location: 'Virtual Room #402',
    reason: 'Hypertension 6-month checkup and ECG review',
    status: 'Confirmed',
  },
  {
    id: 'apt-2',
    doctor: 'Dr. James Kim',
    specialty: 'Endocrinology',
    date: '2026-10-03',
    time: '02:30 PM',
    type: 'In-Person',
    location: 'Suite 310, Building B',
    reason: 'HbA1c quarterly review & insulin dosage adjustment',
    status: 'Scheduled',
  },
  {
    id: 'apt-3',
    doctor: 'Dr. Maria Lopez',
    specialty: 'General Practice',
    date: '2026-08-20',
    time: '11:00 AM',
    type: 'In-Person',
    location: 'Clinic 2A, Main Pavilion',
    reason: 'Annual preventive physical exam & lipid screening',
    status: 'Completed',
  },
  {
    id: 'apt-4',
    doctor: 'Dr. Alex Taylor',
    specialty: 'Neurology',
    date: '2026-07-15',
    time: '09:15 AM',
    type: 'Follow-up',
    location: 'Suite 505, West Wing',
    reason: 'Migraine management follow-up',
    status: 'Cancelled',
  },
]

const DOCTORS = [
  { name: 'Dr. Sarah Chen', specialty: 'Cardiology', location: 'Suite 401, Heart Center' },
  { name: 'Dr. James Kim', specialty: 'Endocrinology', location: 'Suite 310, Building B' },
  { name: 'Dr. Maria Lopez', specialty: 'General Practice', location: 'Clinic 2A, Main Pavilion' },
  { name: 'Dr. Alex Taylor', specialty: 'Neurology', location: 'Suite 505, West Wing' },
]

export default function PatientAppointments() {
  const [appointments, setAppointments] = useState<AppointmentItem[]>(INITIAL_APPOINTMENTS)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState(DOCTORS[0].name)
  const [selectedType, setSelectedType] = useState<'In-Person' | 'Telehealth' | 'Follow-up' | 'Annual Checkup'>('In-Person')
  const [bookDate, setBookDate] = useState('2026-09-30')
  const [bookTime, setBookTime] = useState('11:00 AM')
  const [bookReason, setBookReason] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    api.get('/api/v1/appointments')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const mapped: AppointmentItem[] = data.map((a: any) => ({
            id: a.id,
            doctor: a.doctor?.user?.full_name ?? 'Your Doctor',
            specialty: a.doctor?.specialty ?? 'General Practice',
            date: new Date(a.scheduled_at).toLocaleDateString('en-CA'),
            time: new Date(a.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: a.appointment_type === 'telehealth' ? 'Telehealth' : a.appointment_type === 'annual_checkup' ? 'Annual Checkup' : a.appointment_type === 'follow_up' ? 'Follow-up' : 'In-Person',
            location: a.room ?? (a.appointment_type === 'telehealth' ? 'Virtual Room' : 'Clinic'),
            reason: a.reason,
            status: a.status === 'scheduled' ? 'Scheduled' : a.status === 'confirmed' ? 'Confirmed' : a.status === 'completed' ? 'Completed' : 'Cancelled',
          }))
          setAppointments(mapped)
          setIsLive(true)
        }
      })
      .catch(() => { /* fall back to demo */ })
  }, [])

  const handleBookSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const docObj = DOCTORS.find((d) => d.name === selectedDoctor) || DOCTORS[0]
    const newApt: AppointmentItem = {
      id: `apt-${Date.now()}`,
      doctor: docObj.name,
      specialty: docObj.specialty,
      date: bookDate,
      time: bookTime,
      type: selectedType,
      location: selectedType === 'Telehealth' ? 'Virtual Care Room' : docObj.location,
      reason: bookReason || 'Routine consultation',
      status: 'Confirmed',
    }

    setAppointments([newApt, ...appointments])
    setIsBookModalOpen(false)
    setBookReason('')
    setSuccessMessage(`Appointment booked with ${docObj.name} for ${bookDate} at ${bookTime}!`)
    setTimeout(() => setSuccessMessage(''), 4500)
  }

  const handleCancel = (id: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Cancelled' as const } : a))
    )
  }

  const filteredAppointments = appointments.filter((a) => {
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'upcoming'
        ? a.status === 'Confirmed' || a.status === 'Scheduled'
        : a.status.toLowerCase() === filterStatus.toLowerCase()

    const matchesSearch =
      a.doctor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.reason.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-subtitle flex items-center gap-2">
            Schedule visits, join telehealth sessions, and manage appointments
            {isLive && <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>}
          </p>
        </div>
        <button
          onClick={() => setIsBookModalOpen(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} /> Book New Appointment
        </button>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-fade-in">
          <CheckCircle size={18} />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {['all', 'upcoming', 'completed', 'cancelled'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                filterStatus === tab
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search doctor or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Appointment Cards / Table */}
      <div className="grid grid-cols-1 gap-4">
        {filteredAppointments.length === 0 ? (
          <div className="glass p-12 text-center rounded-2xl text-slate-400">
            <Calendar size={36} className="mx-auto mb-3 opacity-30 text-blue-400" />
            <p className="font-medium text-slate-300">No appointments found</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or book a new appointment.</p>
          </div>
        ) : (
          filteredAppointments.map((apt) => (
            <div
              key={apt.id}
              className="glass p-5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all hover:border-blue-500/30"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {apt.type === 'Telehealth' ? <Video size={22} /> : <Stethoscope size={22} />}
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-white text-base">{apt.doctor}</h3>
                    <span className="text-xs text-slate-400 font-medium">({apt.specialty})</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        apt.status === 'Confirmed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : apt.status === 'Scheduled'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : apt.status === 'Completed'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {apt.status}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                      {apt.type}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1 font-medium">{apt.reason}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-blue-400" />
                      {apt.date}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={13} className="text-blue-400" />
                      {apt.time}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-slate-500" />
                      {apt.location}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                {apt.type === 'Telehealth' && (apt.status === 'Confirmed' || apt.status === 'Scheduled') && (
                  <button
                    onClick={() => alert(`Connecting to virtual room: ${apt.location}`)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 flex items-center gap-1.5 transition-all"
                  >
                    <Video size={14} /> Join Call
                  </button>
                )}
                {(apt.status === 'Confirmed' || apt.status === 'Scheduled') && (
                  <button
                    onClick={() => handleCancel(apt.id)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Book Appointment Modal */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass w-full max-w-lg rounded-2xl p-6 relative border border-white/10 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar size={18} className="text-blue-400" /> Book an Appointment
              </h2>
              <button
                onClick={() => setIsBookModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBookSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Physician
                </label>
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  {DOCTORS.map((d) => (
                    <option key={d.name} value={d.name} className="bg-slate-900 text-white">
                      {d.name} — {d.specialty}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Appointment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['In-Person', 'Telehealth', 'Follow-up', 'Annual Checkup'] as const).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setSelectedType(t)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all ${
                        selectedType === t
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    value={bookDate}
                    onChange={(e) => setBookDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Time Slot
                  </label>
                  <select
                    value={bookTime}
                    onChange={(e) => setBookTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="09:00 AM" className="bg-slate-900 text-white">09:00 AM</option>
                    <option value="10:00 AM" className="bg-slate-900 text-white">10:00 AM</option>
                    <option value="11:00 AM" className="bg-slate-900 text-white">11:00 AM</option>
                    <option value="02:00 PM" className="bg-slate-900 text-white">02:00 PM</option>
                    <option value="03:30 PM" className="bg-slate-900 text-white">03:30 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Reason for Visit / Symptoms
                </label>
                <textarea
                  rows={3}
                  value={bookReason}
                  onChange={(e) => setBookReason(e.target.value)}
                  placeholder="Describe your primary reason for visiting or any acute symptoms..."
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
