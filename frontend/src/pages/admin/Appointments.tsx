import { useState, useEffect, useMemo, useCallback } from 'react'
import api from '@/lib/api'
import { cleanDoctorName } from '../patient/Appointments'
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
  Download,
  Star,
  RefreshCw,
  FileText,
  ShieldCheck,
  Check,
  AlertTriangle,
  Layers,
  Phone,
  Mail,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts'
import { useToast } from '@/lib/toast'

interface AdminAppointmentItem {
  id: string
  booking_reference: string
  doctor_id: string
  doctor_name: string
  doctor_specialty: string
  doctor_department: string
  patient_name: string
  patient_mrn?: string
  patient_phone?: string
  patient_email?: string
  scheduled_at: string
  duration_minutes: number
  appointment_type: 'in_person' | 'telehealth' | 'follow_up' | 'emergency'
  room: string
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  reason: string
  notes?: string
  consultation_fee?: number
  existing_conditions?: string
  current_medications?: string
  allergies?: string
  referral_source?: string
  referring_doctor_name?: string
  cancellation_reason?: string | null
}

interface AnalyticsData {
  total_appointments: number
  today_appointments: number
  upcoming_appointments: number
  completed_appointments: number
  cancelled_appointments: number
  total_doctors: number
  total_departments: number
  average_doctor_rating: number
  appointments_by_department: Array<{ name: string; count: number }>
  appointments_by_status: Array<{ name: string; value: number }>
  appointments_by_month: Array<{ month: string; appointments: number }>
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#06b6d4', '#f43f5e', '#8b5cf6']

export default function AdminAppointments() {
  const { success, error: toastError } = useToast()

  // State
  const [appointments, setAppointments] = useState<AdminAppointmentItem[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming' | 'completed' | 'cancelled'>('all')

  // Search and Filtering
  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  // Modals
  const [selectedAppt, setSelectedAppt] = useState<AdminAppointmentItem | null>(null)
  const [editingStatusAppt, setEditingStatusAppt] = useState<AdminAppointmentItem | null>(null)
  const [newStatus, setNewStatus] = useState<string>('confirmed')
  const [statusNotes, setStatusNotes] = useState<string>('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // Cancellation Modal
  const [cancellingAppt, setCancellingAppt] = useState<AdminAppointmentItem | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  // Fetch Data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [apptsRes, analyticsRes] = await Promise.all([
        api.get('/api/v1/appointments'),
        api.get('/api/v1/appointments/admin/analytics').catch(() => ({ data: null })),
      ])
      setAppointments(apptsRes.data)
      if (analyticsRes?.data) {
        setAnalytics(analyticsRes.data)
      }
    } catch (err) {
      console.warn('Failed to load admin appointments:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    return appointments.filter((a) => {
      // Tab filter
      const apptDateStr = a.scheduled_at ? a.scheduled_at.split('T')[0] : ''
      const isUpcoming = new Date(a.scheduled_at) >= now && a.status !== 'cancelled'

      if (activeTab === 'today' && apptDateStr !== todayStr) return false
      if (activeTab === 'upcoming' && !isUpcoming) return false
      if (activeTab === 'completed' && a.status !== 'completed') return false
      if (activeTab === 'cancelled' && a.status !== 'cancelled') return false

      // Department filter
      if (departmentFilter !== 'all') {
        const dMatch =
          (a.doctor_department || '').toLowerCase() === departmentFilter.toLowerCase() ||
          (a.doctor_specialty || '').toLowerCase() === departmentFilter.toLowerCase()
        if (!dMatch) return false
      }

      // Status filter
      if (statusFilter !== 'all' && a.status !== statusFilter) return false

      // Type filter
      if (typeFilter !== 'all' && a.appointment_type !== typeFilter) return false

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesPatient = (a.patient_name || '').toLowerCase().includes(q)
        const matchesDoc = (a.doctor_name || '').toLowerCase().includes(q)
        const matchesRef = (a.booking_reference || '').toLowerCase().includes(q)
        const matchesReason = (a.reason || '').toLowerCase().includes(q)
        const matchesDept = (a.doctor_specialty || a.doctor_department || '').toLowerCase().includes(q)
        return matchesPatient || matchesDoc || matchesRef || matchesReason || matchesDept
      }

      return true
    })
  }, [appointments, activeTab, departmentFilter, statusFilter, typeFilter, searchQuery])

  // Unique departments for filter dropdown
  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>()
    appointments.forEach((a) => {
      if (a.doctor_department) set.add(a.doctor_department)
      if (a.doctor_specialty) set.add(a.doctor_specialty)
    })
    return Array.from(set).sort()
  }, [appointments])

  // Export to CSV
  const exportToCSV = () => {
    if (filteredAppointments.length === 0) {
      toastError('No appointments available to export.')
      return
    }

    const headers = [
      'Reference',
      'Patient Name',
      'Patient MRN',
      'Patient Phone',
      'Doctor Name',
      'Department',
      'Date & Time',
      'Type',
      'Status',
      'Fee',
      'Reason',
      'Location / Suite',
    ]

    const rows = filteredAppointments.map((a) => [
      a.booking_reference,
      `"${a.patient_name || 'Patient'}"`,
      `"${a.patient_mrn || ''}"`,
      `"${a.patient_phone || ''}"`,
      `"${cleanDoctorName(a.doctor_name)}"`,
      `"${a.doctor_specialty || a.doctor_department}"`,
      `"${new Date(a.scheduled_at).toLocaleString()}"`,
      a.appointment_type,
      a.status,
      a.consultation_fee || 120,
      `"${(a.reason || '').replace(/"/g, '""')}"`,
      `"${a.room || ''}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `medicare_appointments_export_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    success('Exported appointments CSV file successfully.')
  }

  // Update Status handler
  const handleUpdateStatus = async () => {
    if (!editingStatusAppt) return
    setIsUpdatingStatus(true)
    try {
      await api.patch(`/api/v1/appointments/${editingStatusAppt.id}`, {
        status: newStatus,
        notes: statusNotes.trim() ? statusNotes.trim() : undefined,
      })
      success(`Appointment status updated to ${newStatus}.`)
      setEditingStatusAppt(null)
      loadData()
    } catch (err: any) {
      toastError(err.response?.data?.detail || 'Failed to update appointment status.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Cancel Handler
  const handleCancelAppointment = async () => {
    if (!cancellingAppt) return
    setIsCancelling(true)
    try {
      await api.post(`/api/v1/appointments/${cancellingAppt.id}/cancel`, {
        cancellation_reason: cancelReason.trim() || 'Administrative schedule cancellation',
      })
      success('Appointment successfully cancelled.')
      setCancellingAppt(null)
      setCancelReason('')
      loadData()
    } catch (err: any) {
      toastError(err.response?.data?.detail || 'Failed to cancel appointment.')
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070e1b] text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                <Building2 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white">
                Hospital Appointment & Doctor Management Dashboard
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-400">
              Institutional administrative control for 28 medical departments, scheduling analytics, doctor allocation, and status lifecycle.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-md"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              Export CSV
            </button>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        </div>

        {/* ── Key Metrics Cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            {
              label: 'Total Bookings',
              value: analytics?.total_appointments ?? appointments.length,
              icon: Calendar,
              color: 'text-blue-400',
              bg: 'bg-blue-500/10 border-blue-500/20',
            },
            {
              label: "Today's Consults",
              value: analytics?.today_appointments ?? 0,
              icon: Clock,
              color: 'text-cyan-400',
              bg: 'bg-cyan-500/10 border-cyan-500/20',
            },
            {
              label: 'Upcoming Active',
              value: analytics?.upcoming_appointments ?? appointments.filter((a) => a.status === 'confirmed').length,
              icon: CheckCircle2,
              color: 'text-emerald-400',
              bg: 'bg-emerald-500/10 border-emerald-500/20',
            },
            {
              label: 'Completed',
              value: analytics?.completed_appointments ?? appointments.filter((a) => a.status === 'completed').length,
              icon: ShieldCheck,
              color: 'text-indigo-400',
              bg: 'bg-indigo-500/10 border-indigo-500/20',
            },
            {
              label: 'Cancelled',
              value: analytics?.cancelled_appointments ?? appointments.filter((a) => a.status === 'cancelled').length,
              icon: XCircle,
              color: 'text-rose-400',
              bg: 'bg-rose-500/10 border-rose-500/20',
            },
            {
              label: 'Doctors',
              value: analytics?.total_doctors ?? 28,
              icon: Stethoscope,
              color: 'text-amber-400',
              bg: 'bg-amber-500/10 border-amber-500/20',
            },
            {
              label: 'Departments',
              value: analytics?.total_departments ?? 28,
              icon: Building2,
              color: 'text-purple-400',
              bg: 'bg-purple-500/10 border-purple-500/20',
            },
            {
              label: 'Avg Rating',
              value: `${analytics?.average_doctor_rating ?? 4.9}★`,
              icon: Star,
              color: 'text-yellow-400',
              bg: 'bg-yellow-500/10 border-yellow-500/20',
            },
          ].map((metric, idx) => {
            const IconComp = metric.icon
            return (
              <div
                key={idx}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg backdrop-blur-md flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-1.5 rounded-lg border ${metric.bg} ${metric.color}`}>
                    <IconComp className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <span className="text-xl font-extrabold text-white block">{metric.value}</span>
                  <span className="text-[11px] text-slate-400 font-medium leading-tight">
                    {metric.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Visual Analytics Charts ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Appointments by Department */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  Appointments by Department (Top Volume)
                </h3>
                <p className="text-xs text-slate-400">Distribution across hospital medical specialties.</p>
              </div>
            </div>

            <div className="h-64 w-full">
              {analytics?.appointments_by_department && analytics.appointments_by_department.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.appointments_by_department} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0b1527',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Sufficient appointment volume required to render graph.
                </div>
              )}
            </div>
          </div>

          {/* Chart 2: Status Distribution */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Appointment Status Lifecycle</h3>
              <p className="text-xs text-slate-400 mb-4">Real-time status breakdown.</p>
            </div>

            <div className="h-52 w-full">
              {analytics?.appointments_by_status && analytics.appointments_by_status.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.appointments_by_status}
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {analytics.appointments_by_status.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0b1527',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No status data available.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-3 border-t border-slate-800">
              {analytics?.appointments_by_status?.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="truncate">{item.name}:</span>
                  <strong className="text-white ml-auto">{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Appointments Management Table ───────────────────────────── */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md overflow-hidden">
          {/* Controls Bar */}
          <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* View tabs */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar">
              {(['all', 'today', 'upcoming', 'completed', 'cancelled'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all shrink-0 ${
                    activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">All Departments</option>
                {uniqueDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="in_person">In-Person</option>
                <option value="telehealth">Telehealth</option>
                <option value="follow_up">Follow-Up</option>
              </select>

              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[11px] font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Reference Code</th>
                  <th className="py-3.5 px-4">Patient Name & MRN</th>
                  <th className="py-3.5 px-4">Physician & Specialty</th>
                  <th className="py-3.5 px-4">Scheduled Date & Time</th>
                  <th className="py-3.5 px-4">Modality</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading hospital appointments...
                    </td>
                  </tr>
                ) : filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      No matching appointment records found.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        {appt.booking_reference}
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-white block">{appt.patient_name || 'Patient'}</strong>
                        <span className="text-[11px] text-slate-500">
                          {appt.patient_mrn || appt.patient_phone || 'No MRN'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-white block">{cleanDoctorName(appt.doctor_name)}</strong>
                        <span className="text-[11px] text-blue-400">
                          {appt.doctor_specialty || appt.doctor_department}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-200 block">
                          {new Date(appt.scheduled_at).toLocaleDateString()}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {new Date(appt.scheduled_at).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {appt.appointment_type === 'telehealth' ? (
                          <span className="flex items-center gap-1.5 text-cyan-300">
                            <Video className="w-3.5 h-3.5" /> Telehealth
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" /> In-Person
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            appt.status === 'confirmed'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : appt.status === 'scheduled'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : appt.status === 'completed'
                              ? 'bg-slate-700/20 text-slate-300 border-slate-700'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {appt.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedAppt(appt)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                            title="Inspect Details"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingStatusAppt(appt)
                              setNewStatus(appt.status)
                              setStatusNotes(appt.notes || '')
                            }}
                            className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 transition-all"
                            title="Update Status / Notes"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {appt.status !== 'cancelled' && (
                            <button
                              onClick={() => setCancellingAppt(appt)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 transition-all"
                              title="Cancel Consultation"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Status Lifecycle Modal ─────────────────────────────────────── */}
      {editingStatusAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-400" />
                Update Appointment Lifecycle
              </h3>
              <button
                onClick={() => setEditingStatusAppt(null)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Appointment Status:</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Administrative / Clinical Notes:
                </label>
                <textarea
                  rows={3}
                  placeholder="Record patient triage notes, intake findings, or rescheduled reason..."
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setEditingStatusAppt(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={isUpdatingStatus}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl"
              >
                {isUpdatingStatus ? 'Saving...' : 'Save Lifecycle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin View Details Modal ─────────────────────────────────────── */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="font-mono text-cyan-400 font-bold text-xs">
                  {selectedAppt.booking_reference}
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">Clinical Consultation Record</h3>
              </div>
              <button
                onClick={() => setSelectedAppt(null)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 block">Patient Name:</span>
                  <strong className="text-white text-sm">{selectedAppt.patient_name || 'Patient'}</strong>
                  <span className="text-[11px] text-slate-400 block">{selectedAppt.patient_phone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Attending Doctor:</span>
                  <strong className="text-white text-sm">{cleanDoctorName(selectedAppt.doctor_name)}</strong>
                  <span className="text-[11px] text-blue-400 block">{selectedAppt.doctor_specialty}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div>
                  <span className="text-slate-500">Reason for Consultation:</span>
                  <p className="text-slate-200 italic">"{selectedAppt.reason}"</p>
                </div>
                {selectedAppt.notes && (
                  <div>
                    <span className="text-slate-500">Clinical Notes:</span>
                    <p className="text-slate-300">{selectedAppt.notes}</p>
                  </div>
                )}
                {selectedAppt.referring_doctor_name && (
                  <div>
                    <span className="text-slate-500">Referring Physician:</span>
                    <p className="text-slate-200">{selectedAppt.referring_doctor_name}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedAppt(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Cancel Modal ───────────────────────────────────────────── */}
      {cancellingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-[#0b1527] border border-rose-500/30 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Administrative Cancellation</h3>
            </div>

            <p className="text-xs text-slate-400">
              Are you sure you want to cancel appointment{' '}
              <strong className="text-white font-mono">{cancellingAppt.booking_reference}</strong> for patient{' '}
              <strong className="text-white">{cancellingAppt.patient_name || 'Patient'}</strong>?
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cancellation Reason:
              </label>
              <textarea
                rows={2}
                placeholder="Doctor emergency leave, clinic maintenance..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCancellingAppt(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Keep Record
              </button>
              <button
                onClick={handleCancelAppointment}
                disabled={isCancelling}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
