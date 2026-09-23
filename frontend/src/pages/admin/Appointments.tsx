import { useState, useEffect } from 'react'
import api from '@/lib/api'
import {
  Calendar,
  Search,
  Filter,
  Clock,
  User,
  Stethoscope,
  Video,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Building2,
  ChevronRight,
  MoreVertical,
  X,
  Edit2,
} from 'lucide-react'

interface AdminAppointment {
  id: string
  patientName: string
  mrn: string
  doctorName: string
  department: string
  dateTime: string
  type: 'IN_PERSON' | 'TELEHEALTH'
  room: string
  status: 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED'
  reason: string
}

const INITIAL_APPOINTMENTS: AdminAppointment[] = [
  {
    id: 'apt-101',
    patientName: 'Alice Johnson',
    mrn: 'MRN-00000012',
    doctorName: 'Dr. Sarah Chen',
    department: 'Cardiology',
    dateTime: '2026-09-22 09:00',
    type: 'IN_PERSON',
    room: 'Exam Room 4B',
    status: 'COMPLETED',
    reason: 'Hypertension 3-month follow-up and ACEi evaluation',
  },
  {
    id: 'apt-102',
    patientName: 'David Kim',
    mrn: 'MRN-00000068',
    doctorName: 'Dr. Sarah Chen',
    department: 'Cardiology',
    dateTime: '2026-09-22 10:30',
    type: 'IN_PERSON',
    room: 'Exam Room 4A',
    status: 'COMPLETED',
    reason: 'HFrEF acute symptom check and biomarker review',
  },
  {
    id: 'apt-103',
    patientName: 'Robert Chen',
    mrn: 'MRN-00000034',
    doctorName: 'Dr. James Kim',
    department: 'Endocrinology',
    dateTime: '2026-09-22 11:15',
    type: 'TELEHEALTH',
    room: 'Virtual Clinic Room 1',
    status: 'CHECKED_IN',
    reason: 'Continuous glucose monitor data review and titration',
  },
  {
    id: 'apt-104',
    patientName: 'Maria Santos',
    mrn: 'MRN-00000051',
    doctorName: 'Dr. Maria Lopez',
    department: 'General Practice',
    dateTime: '2026-09-22 13:00',
    type: 'IN_PERSON',
    room: 'East Wing Suite 201',
    status: 'CONFIRMED',
    reason: 'Annual wellness exam and CBC lab evaluation',
  },
  {
    id: 'apt-105',
    patientName: 'Emma Wilson',
    mrn: 'MRN-00000082',
    doctorName: 'Dr. Elena Rostova',
    department: 'Neurology',
    dateTime: '2026-09-22 14:30',
    type: 'TELEHEALTH',
    room: 'Virtual Clinic Room 3',
    status: 'SCHEDULED',
    reason: 'Migraine prophylactic medication adjustment',
  },
  {
    id: 'apt-106',
    patientName: 'Frank Gallagher',
    mrn: 'MRN-00000104',
    doctorName: 'Dr. Alex Taylor',
    department: 'Pulmonology',
    dateTime: '2026-09-22 15:45',
    type: 'IN_PERSON',
    room: 'North Tower 512',
    status: 'SCHEDULED',
    reason: 'COPD spirometry and inhaler technique review',
  },
]

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState<AdminAppointment[]>(INITIAL_APPOINTMENTS)
  const [searchQuery, setSearchQuery] = useState('')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get('/api/v1/appointments')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const mapped: AdminAppointment[] = data.map((a: any) => ({
            id: a.id,
            patientName: a.patient?.user?.full_name ?? 'Unknown Patient',
            mrn: a.patient?.mrn ?? '',
            doctorName: a.doctor?.user?.full_name ?? 'Unknown Doctor',
            department: a.doctor?.department ?? 'General',
            dateTime: new Date(a.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            type: a.appointment_type === 'telehealth' ? 'TELEHEALTH' : 'IN_PERSON',
            room: a.room ?? '—',
            status: a.status.toUpperCase() as AdminAppointment['status'],
            reason: a.reason,
          }))
          setAppointments(mapped)
          setIsLive(true)
        }
      })
      .catch(() => { /* silently fall back to demo data */ })
      .finally(() => setIsLoading(false))
  }, [])
  
  // Reschedule / Reassign Modal
  const [editingApt, setEditingApt] = useState<AdminAppointment | null>(null)
  const [newDoctor, setNewDoctor] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newStatus, setNewStatus] = useState<AdminAppointment['status']>('SCHEDULED')

  const handleUpdateAppointment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingApt) return
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === editingApt.id
          ? {
              ...apt,
              doctorName: newDoctor || apt.doctorName,
              dateTime: newTime || apt.dateTime,
              status: newStatus,
            }
          : apt
      )
    )
    setEditingApt(null)
  }

  const handleStatusQuickChange = (id: string, newSt: AdminAppointment['status']) => {
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === id ? { ...apt, status: newSt } : apt))
    )
  }

  const filteredApts = appointments.filter((apt) => {
    const matchesSearch =
      apt.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.reason.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDept = deptFilter === 'ALL' || apt.department === deptFilter
    const matchesStatus = statusFilter === 'ALL' || apt.status === statusFilter
    return matchesSearch && matchesDept && matchesStatus
  })

  const totalCount = appointments.length
  const completedCount = appointments.filter((a) => a.status === 'COMPLETED').length
  const checkedInCount = appointments.filter((a) => a.status === 'CHECKED_IN').length
  const scheduledCount = appointments.filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED').length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20">
              <Calendar size={22} />
            </span>
            Master Hospital Appointment Operations
          </h1>
          <p className="page-subtitle flex items-center gap-2">
            Enterprise clinical schedule governance, cross-specialty coordination, and room allocation
            {isLive && <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>}
          </p>
        </div>
        {isLoading && <div className="w-5 h-5 rounded-full border-2 border-t-transparent border-blue-400 animate-spin" />}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Today's Total Schedule</span>
          <p className="text-2xl font-bold text-white font-display">{totalCount}</p>
          <span className="text-[11px] text-teal-400 font-medium">Cross-departmental census</span>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-emerald-400 font-medium">Completed Encounters</span>
          <p className="text-2xl font-bold text-emerald-400 font-display">{completedCount}</p>
          <span className="text-[11px] text-slate-400">Signed SOAP notes filed</span>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-amber-400 font-medium">Checked-In / In Waiting</span>
          <p className="text-2xl font-bold text-amber-400 font-display">{checkedInCount}</p>
          <span className="text-[11px] text-amber-300">Avg wait time: 8 mins</span>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-blue-400 font-medium">Upcoming Sessions</span>
          <p className="text-2xl font-bold text-blue-400 font-display">{scheduledCount}</p>
          <span className="text-[11px] text-slate-400">Next available slots filled</span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient, doctor, MRN, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Dept Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-surface-800 border border-white/10 text-white rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-blue-500/50"
          >
            <option value="ALL">All Departments</option>
            <option value="Cardiology">Cardiology</option>
            <option value="Endocrinology">Endocrinology</option>
            <option value="Pulmonology">Pulmonology</option>
            <option value="General Practice">General Practice</option>
            <option value="Neurology">Neurology</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-surface-800 border border-white/10 text-white rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-blue-500/50"
          >
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CHECKED_IN">Checked-In</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Master Appointments Table */}
      <div className="glass rounded-2xl overflow-hidden border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            <tr>
              <th className="py-3.5 px-5">Time</th>
              <th className="py-3.5 px-5">Patient Name</th>
              <th className="py-3.5 px-5">Attending Physician & Dept</th>
              <th className="py-3.5 px-5">Modality & Room</th>
              <th className="py-3.5 px-5">Clinical Reason</th>
              <th className="py-3.5 px-5">Status</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredApts.map((apt) => (
              <tr key={apt.id} className="hover:bg-white/5 transition-colors">
                <td className="py-4 px-5 font-mono text-slate-300 font-semibold whitespace-nowrap">
                  {apt.dateTime}
                </td>
                <td className="py-4 px-5">
                  <span className="font-semibold text-white block text-sm">{apt.patientName}</span>
                  <span className="font-mono text-[10px] text-slate-400">{apt.mrn}</span>
                </td>
                <td className="py-4 px-5">
                  <span className="font-medium text-slate-200 block">{apt.doctorName}</span>
                  <span className="text-[10px] text-blue-400 font-semibold">{apt.department}</span>
                </td>
                <td className="py-4 px-5">
                  <span className="flex items-center gap-1.5 font-medium text-slate-300">
                    {apt.type === 'TELEHEALTH' ? (
                      <Video size={13} className="text-teal-400" />
                    ) : (
                      <Building2 size={13} className="text-blue-400" />
                    )}
                    {apt.type === 'TELEHEALTH' ? 'Video Telehealth' : 'In-Person'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{apt.room}</span>
                </td>
                <td className="py-4 px-5 text-slate-300 max-w-xs">{apt.reason}</td>
                <td className="py-4 px-5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      apt.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : apt.status === 'CHECKED_IN'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : apt.status === 'CONFIRMED'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : apt.status === 'CANCELLED'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-white/5 text-slate-400 border border-white/10'
                    }`}
                  >
                    {apt.status}
                  </span>
                </td>
                <td className="py-4 px-5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    {apt.status === 'CONFIRMED' && (
                      <button
                        onClick={() => handleStatusQuickChange(apt.id, 'CHECKED_IN')}
                        className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-[10px]"
                        title="Check In Patient"
                      >
                        Check-In
                      </button>
                    )}
                    {apt.status === 'CHECKED_IN' && (
                      <button
                        onClick={() => handleStatusQuickChange(apt.id, 'COMPLETED')}
                        className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-[10px]"
                        title="Complete Encounter"
                      >
                        Complete
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingApt(apt)
                        setNewDoctor(apt.doctorName)
                        setNewTime(apt.dateTime)
                        setNewStatus(apt.status)
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title="Reschedule / Reassign"
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reschedule / Reassign Modal */}
      {editingApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="glass w-full max-w-md rounded-2xl p-6 relative border border-white/10 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar size={18} className="text-blue-400" /> Reschedule or Reassign Appointment
              </h2>
              <button
                onClick={() => setEditingApt(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <p className="font-semibold text-white">{editingApt.patientName} ({editingApt.mrn})</p>
              <p className="text-slate-400">Clinical Reason: {editingApt.reason}</p>
            </div>

            <form onSubmit={handleUpdateAppointment} className="space-y-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Attending Physician:</label>
                <select
                  value={newDoctor}
                  onChange={(e) => setNewDoctor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                >
                  <option value="Dr. Sarah Chen">Dr. Sarah Chen (Cardiology)</option>
                  <option value="Dr. James Kim">Dr. James Kim (Endocrinology)</option>
                  <option value="Dr. Maria Lopez">Dr. Maria Lopez (General Practice)</option>
                  <option value="Dr. Alex Taylor">Dr. Alex Taylor (Pulmonology)</option>
                  <option value="Dr. Elena Rostova">Dr. Elena Rostova (Neurology)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Date & Time Slot:</label>
                <input
                  type="text"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  placeholder="2026-09-22 14:00"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Status:</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                >
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CHECKED_IN">Checked-In</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingApt(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary px-5 py-2">
                  Update Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
