import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Video,
  User,
  CheckCircle,
  Stethoscope,
  MapPin,
  AlertCircle,
} from 'lucide-react'

interface ScheduleSlot {
  id: string
  time: string
  patient: string | null
  type: string
  reason?: string
  room?: string
  isTelehealth?: boolean
  status: 'Scheduled' | 'Checked In' | 'In Progress' | 'Completed' | 'Break'
  color: string
}

const INITIAL_SLOTS: ScheduleSlot[] = [
  {
    id: 'slot-1',
    time: '09:00 AM',
    patient: 'Alice Johnson',
    type: 'Follow-up',
    reason: 'Hypertension 6-month evaluation',
    room: 'Exam Room 3',
    status: 'Checked In',
    color: '#3182f4',
  },
  {
    id: 'slot-2',
    time: '10:00 AM',
    patient: 'Robert Chen',
    type: 'Telehealth Consult',
    reason: 'Post-discharge recovery check',
    room: 'Virtual Room #2',
    isTelehealth: true,
    status: 'Scheduled',
    color: '#10b981',
  },
  {
    id: 'slot-3',
    time: '11:15 AM',
    patient: 'Maria Santos',
    type: 'Urgent Add-on',
    reason: 'Acute asthma exacerbation & wheezing',
    room: 'Exam Room 1',
    status: 'Scheduled',
    color: '#f59e0b',
  },
  {
    id: 'slot-4',
    time: '12:30 PM',
    patient: null,
    type: 'Clinical Documentation & Lunch',
    status: 'Break',
    color: '#64748b',
  },
  {
    id: 'slot-5',
    time: '02:00 PM',
    patient: 'David Kim',
    type: 'Comprehensive Exam',
    reason: 'Annual COPD spirometry assessment',
    room: 'Exam Room 2',
    status: 'Scheduled',
    color: '#3182f4',
  },
  {
    id: 'slot-6',
    time: '03:30 PM',
    patient: 'Emma Wilson',
    type: 'Specialist Consult',
    reason: 'Refractory migraine protocol review',
    room: 'Exam Room 3',
    status: 'Scheduled',
    color: '#8b5cf6',
  },
]

export default function DoctorSchedule() {
  const navigate = useNavigate()
  const [slots, setSlots] = useState<ScheduleSlot[]>(INITIAL_SLOTS)
  const [currentDateIndex, setCurrentDateIndex] = useState(0)
  const [isLive, setIsLive] = useState(false)

  const dates = ['Today, Sep 22, 2026', 'Tomorrow, Sep 23, 2026', 'Thursday, Sep 24, 2026']

  useEffect(() => {
    api.get('/api/v1/appointments')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const statusColorMap: Record<string, string> = {
            scheduled: '#3182f4', confirmed: '#10b981', in_progress: '#f59e0b',
            completed: '#34d399', cancelled: '#64748b', no_show: '#f43f5e',
          }
          const mapped: ScheduleSlot[] = data.map((a: any) => ({
            id: a.id,
            time: new Date(a.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            patient: a.patient?.user?.full_name ?? null,
            type: a.appointment_type === 'telehealth' ? 'Telehealth Consult' : a.appointment_type === 'follow_up' ? 'Follow-up' : a.appointment_type === 'urgent' ? 'Urgent Add-on' : 'In-Person Consult',
            reason: a.reason,
            room: a.room ?? undefined,
            isTelehealth: a.appointment_type === 'telehealth',
            status: a.status === 'in_progress' ? 'In Progress' : a.status === 'completed' ? 'Completed' : a.status === 'confirmed' ? 'Checked In' : 'Scheduled',
            color: statusColorMap[a.status] ?? '#3182f4',
          }))
          setSlots(mapped)
          setIsLive(true)
        }
      })
      .catch(() => { /* fall back to demo */ })
  }, [])

  const updateStatus = (id: string, newStatus: ScheduleSlot['status']) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Physician Clinical Schedule</h1>
          <p className="page-subtitle flex items-center gap-2">
            {dates[currentDateIndex]} • {slots.filter(s => s.patient).length} Scheduled Consultations
            {isLive && <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDateIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentDateIndex === 0}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-40 border border-white/10 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentDateIndex(0)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white shadow-lg shadow-blue-500/20 flex items-center gap-2"
          >
            <Calendar size={14} /> Today
          </button>
          <button
            onClick={() => setCurrentDateIndex((prev) => Math.min(dates.length - 1, prev + 1))}
            disabled={currentDateIndex === dates.length - 1}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-40 border border-white/10 transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Schedule Timeline */}
      <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
        {slots.map((slot) => {
          if (!slot.patient) {
            return (
              <div
                key={slot.id}
                className="flex items-center gap-4 py-3 px-4 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-slate-500 text-xs italic"
              >
                <span className="w-20 font-mono text-slate-400 not-italic font-semibold">{slot.time}</span>
                <span>— {slot.type} —</span>
              </div>
            )
          }

          return (
            <div
              key={slot.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/20 gap-4 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-20 shrink-0 font-mono text-xs font-bold text-blue-400 mt-1">
                  {slot.time}
                </div>
                <div className="w-1.5 h-12 rounded-full self-stretch" style={{ backgroundColor: slot.color }} />
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-bold text-white text-base">{slot.patient}</h3>
                    <span
                      className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${slot.color}15`, color: slot.color }}
                    >
                      {slot.type}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        slot.status === 'Checked In'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : slot.status === 'In Progress'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                          : slot.status === 'Completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}
                    >
                      {slot.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-1 font-medium">{slot.reason}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-1.5">
                    {slot.isTelehealth ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Video size={13} /> Telehealth Virtual Consult
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-400">
                        <MapPin size={13} /> {slot.room}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                {slot.status === 'Scheduled' && (
                  <button
                    onClick={() => updateStatus(slot.id, 'Checked In')}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20 transition-all"
                  >
                    Check In
                  </button>
                )}
                {slot.status === 'Checked In' && (
                  <button
                    onClick={() => {
                      updateStatus(slot.id, 'In Progress')
                      navigate('/doctor/encounters')
                    }}
                    className="btn-primary text-xs inline-flex items-center gap-1.5"
                  >
                    <Stethoscope size={14} /> Start Encounter
                  </button>
                )}
                {slot.status === 'In Progress' && (
                  <button
                    onClick={() => updateStatus(slot.id, 'Completed')}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 inline-flex items-center gap-1 transition-all"
                  >
                    <CheckCircle size={14} /> Mark Completed
                  </button>
                )}
                {slot.isTelehealth && slot.status !== 'Completed' && (
                  <button
                    onClick={() => alert(`Launching doctor telehealth video portal for ${slot.patient}`)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 inline-flex items-center gap-1 transition-all"
                  >
                    <Video size={14} /> Launch Video
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
