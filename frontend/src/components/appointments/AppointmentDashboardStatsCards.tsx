import React from 'react'
import {
  Building2,
  Stethoscope,
  Building,
  CalendarCheck,
  Clock,
  CheckCircle2,
} from 'lucide-react'

export interface DashboardStats {
  total_specialties: number
  total_doctors: number
  total_hospitals: number
  upcoming_appointments: number
  pending_appointments: number
  confirmed_appointments: number
}

interface Props {
  stats: DashboardStats | null
  isLoading?: boolean
}

export const AppointmentDashboardStatsCards: React.FC<Props> = ({ stats, isLoading }) => {
  const cards = [
    {
      title: 'Medical Specialties',
      value: stats?.total_specialties ?? '--',
      subtitle: 'Active Clinical Departments',
      icon: Building,
      color: 'text-blue-400',
      bgColor: 'bg-blue-600/10',
      borderColor: 'border-blue-500/20',
    },
    {
      title: 'Attending Doctors',
      value: stats?.total_doctors ?? '--',
      subtitle: 'Verified Physicians',
      icon: Stethoscope,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-600/10',
      borderColor: 'border-cyan-500/20',
    },
    {
      title: 'Affiliated Hospitals',
      value: stats?.total_hospitals ?? '--',
      subtitle: 'Medical Centers & ERs',
      icon: Building2,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-600/10',
      borderColor: 'border-indigo-500/20',
    },
    {
      title: 'Upcoming Consultations',
      value: stats?.upcoming_appointments ?? '--',
      subtitle: 'Scheduled & Confirmed',
      icon: CalendarCheck,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-600/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      title: 'Pending Appointments',
      value: stats?.pending_appointments ?? '--',
      subtitle: 'Awaiting Confirmation',
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-600/10',
      borderColor: 'border-amber-500/20',
    },
    {
      title: 'Confirmed Bookings',
      value: stats?.confirmed_appointments ?? '--',
      subtitle: 'Verified Hospital Slots',
      icon: CheckCircle2,
      color: 'text-teal-400',
      bgColor: 'bg-teal-600/10',
      borderColor: 'border-teal-500/20',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon
        return (
          <div
            key={idx}
            className={`bg-slate-900/80 border ${card.borderColor} rounded-2xl p-4 shadow-lg backdrop-blur-md flex flex-col justify-between transition-all hover:-translate-y-0.5`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold text-slate-400 leading-tight">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-lg ${card.bgColor} ${card.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-black text-white font-mono tracking-tight">
                {isLoading ? (
                  <span className="animate-pulse text-slate-600">--</span>
                ) : (
                  card.value
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">{card.subtitle}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

