import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Video,
  X,
  CheckCircle,
  AlertCircle,
  MapPin,
  User,
  Stethoscope,
  ChevronRight,
  ChevronLeft,
  CalendarCheck,
  CalendarX,
  RefreshCw,
  FileText,
  Building,
  Download,
  AlertTriangle,
  ShieldCheck,
  Check,
} from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/lib/toast'

export interface AppointmentItem {
  id: string
  doctor_id: string
  doctor_name: string
  doctor_specialty: string
  doctor_department: string
  doctor_location: string
  doctor_phone: string
  scheduled_at: string
  duration_minutes: number
  appointment_type: 'in_person' | 'telehealth' | 'follow_up' | 'annual_checkup'
  room: string
  reason: string
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  booking_reference: string
  cancellation_reason?: string | null
  rescheduled_from_id?: string | null
  clinic_timezone: string
  is_upcoming: boolean
}

export interface SpecialtyItem {
  id: string
  name: string
  icon: string
  description: string
  doctor_count: number
}

export interface DoctorItem {
  id: string
  user_id?: string
  name?: string
  full_name?: string
  title?: string
  specialty?: string
  department?: string
  office_location?: string
  phone?: string
  phone_number?: string
  consultation_duration?: number
  accepts_telehealth?: boolean
  has_schedule?: boolean
  working_days?: string[]
  earliest_available_date?: string
}

export interface TimeSlot {
  start_time: string
  end_time: string
  is_available: boolean
  duration_minutes: number
  label: string
  time_display?: string
  iso_datetime?: string
  reason?: string
}

export interface AvailabilityData {
  doctor_id: string
  doctor_name: string
  date: string
  clinic_timezone: string
  status: 'available' | 'booked' | 'fully_booked' | 'off_duty' | 'unconfigured' | 'time_off' | 'unsupported_type'
  message: string
  slots: TimeSlot[]
  suggested_dates: string[]
  available_count?: number
  total_count?: number
  slot_duration_minutes?: number
}

// Helper to safely format doctor display names and prevent "Dr. Dr." repetition
export function cleanDoctorName(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') return 'Dr. Physician'
  let name = rawName.trim()
  while (/^dr\.?\s+/i.test(name)) {
    name = name.replace(/^dr\.?\s+/i, '').trim()
  }
  return `Dr. ${name}`
}

// Helper to safely extract initials without crashing on undefined/null
function getDoctorInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'MD'
  const cleaned = cleanDoctorName(name).replace(/^dr\.?\s+/i, '').trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'MD'
  return parts.map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

// Helper to safely extract date string (YYYY-MM-DD)
function safeDateOnly(isoString?: string | null): string {
  if (!isoString || typeof isoString !== 'string') {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }
  return isoString.includes('T') ? isoString.split('T')[0] : isoString.slice(0, 10)
}

// Helper to generate a download .ics calendar file
function downloadCalendarInvite(appt: {
  reference: string
  doctorName: string
  specialty: string
  scheduledAt: string
  durationMinutes: number
  location: string
  reason: string
}) {
  try {
    const start = new Date(appt.scheduledAt)
    const validStart = isNaN(start.getTime()) ? new Date() : start
    const duration = appt.durationMinutes || 30
    const end = new Date(validStart.getTime() + duration * 60000)

    const formatICSDate = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MediCare AI//Appointment Scheduling//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${appt.reference || 'REF-MC'}@medicare-ai.health`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(validStart)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:Medical Consult: ${appt.doctorName || 'Physician'} (${appt.specialty || 'General'})`,
      `DESCRIPTION:Appointment Reference: ${appt.reference || 'REF'}\\nPhysician: ${appt.doctorName || 'Doctor'}\\nReason: ${appt.reason || 'Medical Consult'}`,
      `LOCATION:${appt.location || 'Clinic'}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `medicare-appointment-${appt.reference || 'schedule'}.ics`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.warn('Failed to generate calendar invite:', err)
  }
}

export default function PatientAppointments() {
  const { success, error: toastError } = useToast()

  // State: Appointments List
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'all' | 'past' | 'cancelled'>('upcoming')
  const [searchQuery, setSearchQuery] = useState('')

  // State: Selected Appointment for Details modal
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null)

  // State: Rescheduling
  const [reschedulingAppt, setReschedulingAppt] = useState<AppointmentItem | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleSlot, setRescheduleSlot] = useState<TimeSlot | null>(null)
  const [rescheduleAvailability, setRescheduleAvailability] = useState<AvailabilityData | null>(null)
  const [isLoadingRescheduleSlots, setIsLoadingRescheduleSlots] = useState(false)
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false)

  // State: Cancellation Modal
  const [cancellingAppt, setCancellingAppt] = useState<AppointmentItem | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  // State: Booking Wizard
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<number>(1) // 1: Specialty, 2: Doctor, 3: Type, 4: Date & Slot, 5: Reason, 6: Review, 7: Confirmed

  // Wizard Selections
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([])
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('')
  const [doctors, setDoctors] = useState<DoctorItem[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorItem | null>(null)
  const [visitType, setVisitType] = useState<'in_person' | 'telehealth'>('in_person')
  const [bookingDate, setBookingDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [availability, setAvailability] = useState<AvailabilityData | null>(null)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [visitReason, setVisitReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
  const [confirmedBooking, setConfirmedBooking] = useState<{
    reference: string
    doctorName: string
    specialty: string
    department: string
    location: string
    date: string
    time: string
    type: string
    reason: string
    scheduledAt: string
    durationMinutes: number
  } | null>(null)

  // ── Normalize appointment record for safe presentation ──────────────────
  const normalizeAppointment = useCallback((raw: any): AppointmentItem => {
    const fallbackId = `apt-${Math.random().toString(36).substring(2, 9)}`
    const scheduledAt = raw?.scheduled_at || raw?.start_time || new Date().toISOString()
    const apptDate = new Date(scheduledAt)
    const isFuture = !isNaN(apptDate.getTime()) ? apptDate >= new Date() : true

    return {
      id: String(raw?.id || fallbackId),
      doctor_id: String(raw?.doctor_id || ''),
      doctor_name: cleanDoctorName(raw?.doctor_name || raw?.doctor?.user?.full_name || raw?.doctor?.name || 'Assigned Physician'),
      doctor_specialty: raw?.doctor_specialty || raw?.doctor?.specialty || 'General Practice',
      doctor_department: raw?.doctor_department || raw?.doctor?.department || 'Outpatient Clinic',
      doctor_location: raw?.doctor_location || raw?.room || raw?.doctor?.office_location || 'Main Clinic Pavilion',
      doctor_phone: raw?.doctor_phone || raw?.doctor?.phone || '(555) 234-1100',
      scheduled_at: scheduledAt,
      duration_minutes: Number(raw?.duration_minutes || 30),
      appointment_type: raw?.appointment_type === 'telehealth' ? 'telehealth' : 'in_person',
      room: raw?.room || (raw?.appointment_type === 'telehealth' ? 'Virtual Care Room' : 'Clinic Room 3A'),
      reason: raw?.reason || 'Clinical consultation and review',
      status: (raw?.status || 'scheduled').toLowerCase() as any,
      booking_reference: raw?.booking_reference || (raw?.id ? `MC-2026-${String(raw.id).slice(0, 4).toUpperCase()}` : 'MC-2026-REF'),
      cancellation_reason: raw?.cancellation_reason || null,
      rescheduled_from_id: raw?.rescheduled_from_id || null,
      clinic_timezone: raw?.clinic_timezone || 'America/New_York',
      is_upcoming: raw?.is_upcoming !== undefined ? Boolean(raw.is_upcoming) : isFuture,
    }
  }, [])

  // ── Load Appointments from Backend ──────────────────────────────────────
  const fetchAppointments = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const res = await api.get('/api/v1/appointments')
      if (res.data && Array.isArray(res.data)) {
        const mapped = res.data.map(normalizeAppointment)
        setAppointments(mapped)
        setIsLive(true)
      } else {
        setAppointments([])
        setIsLive(true)
      }
    } catch (err: any) {
      console.warn('Live appointments fetch notice:', err)
      setIsLive(false)
      setFetchError(err?.response?.data?.detail || 'Unable to connect to live clinic server')
    } finally {
      setIsLoading(false)
    }
  }, [normalizeAppointment])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // ── Load Specialties and Doctors for Booking ────────────────────────────
  useEffect(() => {
    if (isBookingOpen) {
      api.get('/api/v1/appointments/specialties')
        .then((res) => {
          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            setSpecialties(res.data)
          }
        })
        .catch(() => {
          setSpecialties([
            { id: 'Cardiology', name: 'Cardiology', icon: 'Heart', description: 'Cardiovascular diagnostics, ECG, hypertension & lipid care', doctor_count: 1 },
            { id: 'Endocrinology', name: 'Endocrinology', icon: 'Activity', description: 'Metabolic disorders, type 1/2 diabetes, thyroid & hormone health', doctor_count: 1 },
            { id: 'General Practice', name: 'General Practice', icon: 'Stethoscope', description: 'Preventive health, annual wellness examinations & routine care', doctor_count: 1 },
            { id: 'Neurology', name: 'Neurology', icon: 'Brain', description: 'Neurological evaluation, migraines, stroke prevention & neuromuscular care', doctor_count: 1 },
            { id: 'Pulmonology', name: 'Pulmonology', icon: 'Wind', description: 'Respiratory diseases, COPD, asthma & pulmonary function testing', doctor_count: 1 },
          ])
        })
    }
  }, [isBookingOpen])

  // When specialty changes, fetch doctors for that specialty
  useEffect(() => {
    const params = selectedSpecialty ? { specialty: selectedSpecialty } : undefined
    api.get('/api/v1/appointments/doctors', { params })
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          const mappedDocs: DoctorItem[] = res.data.map((d: any) => ({
            id: String(d.id || ''),
            name: cleanDoctorName(d.name || d.full_name || 'Physician'),
            full_name: cleanDoctorName(d.full_name || d.name || 'Physician'),
            specialty: d.specialty || 'General Practice',
            department: d.department || 'Clinical Services',
            office_location: d.office_location || 'Main Pavilion',
            phone: d.phone || d.phone_number || '(555) 234-1100',
            phone_number: d.phone_number || d.phone || '(555) 234-1100',
            consultation_duration: Number(d.consultation_duration || 30),
            accepts_telehealth: d.accepts_telehealth ?? true,
            has_schedule: Boolean(d.has_schedule ?? true),
            working_days: Array.isArray(d.working_days) ? d.working_days : [],
            earliest_available_date: d.earliest_available_date || undefined,
          }))
          setDoctors(mappedDocs)
          if (mappedDocs.length > 0) {
            setSelectedDoctor(mappedDocs[0])
            if (mappedDocs[0].earliest_available_date) {
              setBookingDate(mappedDocs[0].earliest_available_date)
            }
          } else {
            setSelectedDoctor(null)
          }
        } else {
          setDoctors([])
          setSelectedDoctor(null)
        }
      })
      .catch(() => {
        setDoctors([])
        setSelectedDoctor(null)
      })
  }, [selectedSpecialty])

  // When doctor or bookingDate changes in Step 4, query genuine availability
  useEffect(() => {
    if (wizardStep === 4 && selectedDoctor && bookingDate) {
      setIsLoadingSlots(true)
      setSelectedSlot(null)
      api.get('/api/v1/appointments/availability', {
        params: {
          doctor_id: selectedDoctor.id,
          date: bookingDate,
        },
      })
        .then((res) => {
          const raw = res.data
          setAvailability({
            doctor_id: raw.doctor_id,
            doctor_name: cleanDoctorName(raw.doctor_name),
            date: raw.date,
            clinic_timezone: raw.clinic_timezone || 'America/New_York',
            status: raw.status,
            message: raw.message,
            available_count: raw.available_count,
            total_count: raw.total_count,
            slot_duration_minutes: raw.slot_duration_minutes || 30,
            slots: Array.isArray(raw.slots)
              ? raw.slots.map((s: any) => ({
                  start_time: s.start_time,
                  end_time: s.end_time,
                  is_available: Boolean(s.is_available),
                  duration_minutes: s.duration_minutes || raw.slot_duration_minutes || 30,
                  label: s.label || s.time_display || s.start_time,
                  time_display: s.time_display || s.label || s.start_time,
                  iso_datetime: s.iso_datetime,
                  reason: s.reason,
                }))
              : [],
            suggested_dates: Array.isArray(raw.suggested_dates) ? raw.suggested_dates : [],
          })
        })
        .catch((err) => {
          setAvailability({
            doctor_id: selectedDoctor.id,
            doctor_name: cleanDoctorName(selectedDoctor.full_name || selectedDoctor.name || 'Physician'),
            date: bookingDate,
            clinic_timezone: 'America/New_York',
            status: 'unconfigured',
            message: err.response?.data?.detail || 'Physician shift schedules not configured for this date.',
            slots: [],
            suggested_dates: [],
          })
        })
        .finally(() => {
          setIsLoadingSlots(false)
        })
    }
  }, [wizardStep, selectedDoctor, bookingDate])

  // Availability loader for Reschedule modal
  useEffect(() => {
    if (reschedulingAppt && rescheduleDate) {
      setIsLoadingRescheduleSlots(true)
      setRescheduleSlot(null)
      api.get('/api/v1/appointments/availability', {
        params: {
          doctor_id: reschedulingAppt.doctor_id,
          date: rescheduleDate,
        },
      })
        .then((res) => {
          const raw = res.data
          setRescheduleAvailability({
            doctor_id: raw.doctor_id,
            doctor_name: cleanDoctorName(raw.doctor_name),
            date: raw.date,
            clinic_timezone: raw.clinic_timezone || 'America/New_York',
            status: raw.status,
            message: raw.message,
            available_count: raw.available_count,
            total_count: raw.total_count,
            slot_duration_minutes: raw.slot_duration_minutes || 30,
            slots: Array.isArray(raw.slots)
              ? raw.slots.map((s: any) => ({
                  start_time: s.start_time,
                  end_time: s.end_time,
                  is_available: Boolean(s.is_available),
                  duration_minutes: s.duration_minutes || raw.slot_duration_minutes || 30,
                  label: s.label || s.time_display || s.start_time,
                  time_display: s.time_display || s.label || s.start_time,
                  iso_datetime: s.iso_datetime,
                  reason: s.reason,
                }))
              : [],
            suggested_dates: Array.isArray(raw.suggested_dates) ? raw.suggested_dates : [],
          })
        })
        .catch(() => setRescheduleAvailability(null))
        .finally(() => setIsLoadingRescheduleSlots(false))
    }
  }, [reschedulingAppt, rescheduleDate])

  // ── Filtered Appointments ───────────────────────────────────────────────
  const now = useMemo(() => new Date(), [])

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const apptDate = a.scheduled_at ? new Date(a.scheduled_at) : null
      const isValidDate = apptDate !== null && !isNaN(apptDate.getTime())
      const isPast = isValidDate ? apptDate < now : false
      const isFuture = isValidDate ? apptDate >= now : true
      const status = (a.status || 'scheduled').toLowerCase()

      // Tab filtering
      let matchesTab = true
      if (activeTab === 'upcoming') {
        matchesTab = (a.is_upcoming ?? isFuture) && status !== 'cancelled' && status !== 'completed'
      } else if (activeTab === 'past') {
        matchesTab = isPast || status === 'completed'
      } else if (activeTab === 'cancelled') {
        matchesTab = status === 'cancelled'
      }

      // Search filtering (null-safe)
      const q = (searchQuery || '').toLowerCase().trim()
      const matchesSearch =
        !q ||
        (a.doctor_name || '').toLowerCase().includes(q) ||
        (a.doctor_specialty || '').toLowerCase().includes(q) ||
        (a.doctor_department || '').toLowerCase().includes(q) ||
        (a.reason || '').toLowerCase().includes(q) ||
        (a.booking_reference || '').toLowerCase().includes(q)

      return matchesTab && matchesSearch
    }).sort((a, b) => {
      const timeA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
      const timeB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
      if (activeTab === 'upcoming') return timeA - timeB
      return timeB - timeA
    })
  }, [appointments, activeTab, searchQuery, now])

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const upcomingCount = appointments.filter((a) => {
      const apptDate = a.scheduled_at ? new Date(a.scheduled_at) : null
      const isFuture = apptDate && !isNaN(apptDate.getTime()) ? apptDate >= now : true
      const status = (a.status || 'scheduled').toLowerCase()
      return (a.is_upcoming ?? isFuture) && status !== 'cancelled' && status !== 'completed'
    }).length

    const pastCount = appointments.filter((a) => {
      const apptDate = a.scheduled_at ? new Date(a.scheduled_at) : null
      const isPast = apptDate && !isNaN(apptDate.getTime()) ? apptDate < now : false
      const status = (a.status || 'scheduled').toLowerCase()
      return isPast || status === 'completed'
    }).length

    const cancelledCount = appointments.filter((a) => (a.status || '').toLowerCase() === 'cancelled').length

    return {
      all: appointments.length,
      upcoming: upcomingCount,
      past: pastCount,
      cancelled: cancelledCount,
    }
  }, [appointments, now])

  // ── Handle Booking Submission ───────────────────────────────────────────
  const handleConfirmBooking = async () => {
    if (!selectedDoctor || !selectedSlot) {
      toastError('Booking Incomplete', 'Please select a physician and an available time slot.')
      return
    }

    if (visitReason.trim().length < 5) {
      setReasonError('Please provide a medical reason of at least 5 characters.')
      setWizardStep(5)
      return
    }

    setIsSubmittingBooking(true)
    try {
      const targetScheduledAt = selectedSlot.iso_datetime || `${bookingDate}T${selectedSlot.start_time}:00`
      const payload = {
        doctor_id: selectedDoctor.id,
        scheduled_at: targetScheduledAt,
        appointment_type: visitType,
        reason: visitReason.trim(),
        room: visitType === 'telehealth' ? 'Virtual Care Room' : selectedDoctor.office_location || 'Main Clinic',
      }

      const res = await api.post('/api/v1/appointments', payload)
      const newAppt = res.data

      const doctorDisplayName = cleanDoctorName(selectedDoctor.full_name || selectedDoctor.name || 'Physician')

      setConfirmedBooking({
        reference: newAppt.booking_reference || `MC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        doctorName: doctorDisplayName,
        specialty: selectedDoctor.specialty || 'General Practice',
        department: selectedDoctor.department || 'Outpatient Clinic',
        location: newAppt.room || selectedDoctor.office_location || 'Main Clinic Pavilion',
        date: bookingDate,
        time: selectedSlot.label || selectedSlot.time_display || selectedSlot.start_time,
        type: visitType === 'telehealth' ? 'Telehealth Consultation' : 'In-Person Consultation',
        reason: visitReason.trim(),
        scheduledAt: targetScheduledAt,
        durationMinutes: selectedSlot.duration_minutes || 30,
      })

      success(
        'Appointment Confirmed',
        `Booked with ${doctorDisplayName} for ${bookingDate}`
      )

      fetchAppointments()
      setWizardStep(7)
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Unable to confirm appointment slot.'
      toastError('Booking Conflict', detail)
      if (err.response?.status === 409) {
        setWizardStep(4)
        setSelectedSlot(null)
      }
    } finally {
      setIsSubmittingBooking(false)
    }
  }

  // ── Handle Reschedule Submission ────────────────────────────────────────
  const handleConfirmReschedule = async () => {
    if (!reschedulingAppt || !rescheduleSlot) {
      toastError('Reschedule Incomplete', 'Please pick a new available time slot.')
      return
    }

    setIsSubmittingReschedule(true)
    try {
      const targetRescheduleAt = rescheduleSlot.iso_datetime || `${rescheduleDate}T${rescheduleSlot.start_time}:00`
      await api.post(`/api/v1/appointments/${reschedulingAppt.id}/reschedule`, {
        new_scheduled_at: targetRescheduleAt,
      })

      success('Appointment Rescheduled', 'Your appointment has been successfully updated.')
      setReschedulingAppt(null)
      setRescheduleSlot(null)
      setRescheduleAvailability(null)
      fetchAppointments()
    } catch (err: any) {
      toastError('Reschedule Failed', err.response?.data?.detail || 'Could not reschedule appointment.')
    } finally {
      setIsSubmittingReschedule(false)
    }
  }

  // ── Handle Cancellation ─────────────────────────────────────────────────
  const handleConfirmCancel = async () => {
    if (!cancellingAppt) return

    setIsCancelling(true)
    try {
      await api.delete(`/api/v1/appointments/${cancellingAppt.id}/cancel`, {
        data: { cancellation_reason: cancelReason.trim() || 'Patient requested cancellation' },
      })
      success('Appointment Cancelled', 'The scheduled slot has been freed.')
      setCancellingAppt(null)
      setCancelReason('')
      fetchAppointments()
    } catch (err: any) {
      toastError('Cancellation Failed', err.response?.data?.detail || 'Could not cancel appointment.')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleCloseWizard = () => {
    setIsBookingOpen(false)
    setWizardStep(1)
    setSelectedSpecialty('')
    setSelectedDoctor(null)
    setSelectedSlot(null)
    setVisitReason('')
    setReasonError('')
    setConfirmedBooking(null)
  }

  const formatDateDisplay = (isoString?: string | null) => {
    if (!isoString) return 'Date Pending'
    try {
      const d = new Date(isoString)
      if (isNaN(d.getTime())) return 'Scheduled'
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return 'Scheduled'
    }
  }

  const formatTimeDisplay = (isoString?: string | null) => {
    if (!isoString) return 'Time Pending'
    try {
      const d = new Date(isoString)
      if (isNaN(d.getTime())) return 'Scheduled'
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Scheduled'
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            Appointments & Consultations
            {isLive && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Clinic API
              </span>
            )}
          </h1>
          <p className="page-subtitle">
            Schedule clinic visits, book telehealth consultations, and manage your medical care schedule.
          </p>
        </div>
        <button
          onClick={() => {
            setIsBookingOpen(true)
            setWizardStep(1)
          }}
          className="btn-primary inline-flex items-center gap-2 self-start sm:self-center shadow-lg shadow-blue-500/25"
        >
          <Plus size={18} /> Book Appointment
        </button>
      </div>

      {/* ── Error Banner with Real Retry Action ──────────────────────────── */}
      {fetchError && !isLoading && (
        <div className="p-4 rounded-2xl flex items-center justify-between bg-rose-500/10 border border-rose-500/20 text-rose-300 animate-fade-in text-xs gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-rose-400 shrink-0" />
            <div>
              <p className="font-semibold text-rose-200">Unable to sync appointments with server</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">{fetchError}</p>
            </div>
          </div>
          <button
            onClick={() => fetchAppointments()}
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold border border-rose-500/30 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
          >
            <RefreshCw size={12} /> Retry Now
          </button>
        </div>
      )}

      {/* ── Filter Tabs & Search Bar ─────────────────────────────────────── */}
      <div className="glass p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between border border-white/10">
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <CalendarCheck size={14} /> Upcoming ({tabCounts.upcoming})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Calendar size={14} /> All ({tabCounts.all})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'past'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <CheckCircle size={14} /> Past & Completed ({tabCounts.past})
          </button>
          <button
            onClick={() => setActiveTab('cancelled')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'cancelled'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <CalendarX size={14} /> Cancelled ({tabCounts.cancelled})
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search physician, specialty, ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* ── Appointments List ────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass p-6 rounded-2xl animate-pulse space-y-3 border border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-white/10 rounded w-1/4" />
                  <div className="h-3 bg-white/5 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="glass p-16 text-center rounded-2xl text-slate-400 border border-white/10">
          <Calendar size={44} className="mx-auto mb-4 opacity-30 text-blue-400" />
          <h3 className="font-semibold text-lg text-slate-200">No Appointments Found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            {activeTab === 'upcoming'
              ? 'You have no scheduled appointments in the future. Click "Book Appointment" above to schedule a clinic visit.'
              : 'No appointments match your current filter and search query.'}
          </p>
          {activeTab === 'upcoming' && (
            <button
              onClick={() => {
                setIsBookingOpen(true)
                setWizardStep(1)
              }}
              className="mt-5 btn-primary inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} /> Schedule Your Next Visit
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAppointments.map((apt) => {
            const isTelehealth = apt.appointment_type === 'telehealth'
            const status = (apt.status || 'scheduled').toLowerCase()
            const isConfirmed = status === 'confirmed' || status === 'scheduled'
            const apptDate = apt.scheduled_at ? new Date(apt.scheduled_at) : null
            const isFuture = apptDate && !isNaN(apptDate.getTime()) ? apptDate >= now : true
            const isUpcoming = (apt.is_upcoming ?? isFuture) && isConfirmed

            return (
              <div
                key={apt.id}
                className="glass p-6 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5 transition-all hover:border-blue-500/30 border border-white/10"
              >
                <div className="flex items-start gap-4">
                  {/* Icon Avatar */}
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isTelehealth
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}
                  >
                    {isTelehealth ? <Video size={24} /> : <Stethoscope size={24} />}
                  </div>

                  {/* Appointment Details */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-white/5 text-blue-300 border border-white/10">
                        {apt.booking_reference || 'REF-MC'}
                      </span>
                      <h3 className="font-bold text-white text-base">{apt.doctor_name || 'Assigned Physician'}</h3>
                      <span className="text-xs text-slate-400 font-medium">({apt.doctor_specialty || 'General Practice'})</span>
                      
                      {/* Status Badge */}
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          status === 'confirmed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : status === 'scheduled'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : status === 'completed'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>

                      {/* Type Badge */}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                        {isTelehealth ? 'Telehealth' : 'In-Person'}
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 font-medium line-clamp-1">{apt.reason || 'Consultation'}</p>

                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap pt-1">
                      <span className="flex items-center gap-1.5 text-slate-200 font-medium">
                        <Calendar size={14} className="text-blue-400" />
                        {formatDateDisplay(apt.scheduled_at)}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-200 font-medium">
                        <Clock size={14} className="text-blue-400" />
                        {formatTimeDisplay(apt.scheduled_at)} ({apt.clinic_timezone || 'America/New_York'})
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-slate-500" />
                        {isTelehealth ? 'Virtual Care Room' : apt.room || apt.doctor_location || 'Main Clinic Pavilion'}
                      </span>
                    </div>

                    {status === 'cancelled' && apt.cancellation_reason && (
                      <p className="text-xs text-rose-400/90 italic flex items-center gap-1.5 pt-1">
                        <AlertTriangle size={13} /> Cancelled: {apt.cancellation_reason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions Panel */}
                <div className="flex items-center gap-2 self-end lg:self-center shrink-0 flex-wrap">
                  <button
                    onClick={() => setSelectedAppointment(apt)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText size={13} /> View Details
                  </button>

                  {isTelehealth && isUpcoming && (
                    <button
                      onClick={() =>
                        success('Connecting to Telehealth', `Launching secure video session for ${apt.booking_reference}`)
                      }
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
                    >
                      <Video size={14} /> Join Telehealth
                    </button>
                  )}

                  {isUpcoming && (
                    <>
                      <button
                        onClick={() => {
                          setReschedulingAppt(apt)
                          setRescheduleDate(safeDateOnly(apt.scheduled_at))
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <RefreshCw size={13} /> Reschedule
                      </button>

                      <button
                        onClick={() => {
                          setCancellingAppt(apt)
                          setCancelReason('')
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── MODAL 1: MULTI-STEP BOOKING WIZARD ────────────────────────────── */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="glass w-full max-w-2xl rounded-3xl p-6 sm:p-8 relative border border-white/15 shadow-2xl space-y-6 my-8">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Calendar size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Book an Appointment</h2>
                  <p className="text-xs text-slate-400">
                    Step {wizardStep} of {wizardStep === 7 ? 7 : 6} •{' '}
                    {wizardStep === 1
                      ? 'Choose Medical Specialty'
                      : wizardStep === 2
                      ? 'Select Physician'
                      : wizardStep === 3
                      ? 'Appointment Type'
                      : wizardStep === 4
                      ? 'Date & Available Slot'
                      : wizardStep === 5
                      ? 'Clinical Reason'
                      : wizardStep === 6
                      ? 'Review & Confirm'
                      : 'Confirmed'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseWizard}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            {wizardStep < 7 && (
              <div className="flex items-center justify-between gap-1 px-1">
                {[1, 2, 3, 4, 5, 6].map((st) => (
                  <div key={st} className="flex-1 flex flex-col items-center gap-1.5">
                    <div
                      className={`h-1.5 w-full rounded-full transition-all ${
                        wizardStep >= st ? 'bg-blue-500 shadow-sm shadow-blue-500/50' : 'bg-white/10'
                      }`}
                    />
                    <span className="text-[10px] text-slate-400 hidden sm:block">
                      {st === 1
                        ? 'Specialty'
                        : st === 2
                        ? 'Doctor'
                        : st === 3
                        ? 'Type'
                        : st === 4
                        ? 'Schedule'
                        : st === 5
                        ? 'Reason'
                        : 'Review'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── STEP 1: Medical Specialty ────────────────────────────── */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  Select the medical specialty or department for your consultation:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {specialties.map((spec) => (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => {
                        setSelectedSpecialty(spec.name)
                        setWizardStep(2)
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                        selectedSpecialty === spec.name
                          ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/15'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-white">{spec.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {spec.doctor_count} {spec.doctor_count === 1 ? 'physician' : 'physicians'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2">{spec.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 2: Doctor Selection (Safe Initials) ─────────────── */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-300">
                    Choose a physician in <span className="font-bold text-blue-400">{selectedSpecialty || 'All Departments'}</span>:
                  </p>
                  <button
                    onClick={() => setSelectedSpecialty('')}
                    className="text-xs text-blue-400 hover:underline cursor-pointer"
                  >
                    View All Doctors
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {doctors.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border border-dashed border-white/10 rounded-2xl">
                      <User size={32} className="mx-auto mb-2 opacity-30 text-blue-400" />
                      <p className="text-sm">No physicians found for this specialty.</p>
                    </div>
                  ) : (
                    doctors.map((doc) => {
                      const docName = cleanDoctorName(doc.full_name || doc.name || 'Physician')
                      const isSelected = selectedDoctor?.id === doc.id

                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => {
                            setSelectedDoctor(doc)
                            if (doc.earliest_available_date) {
                              setBookingDate(doc.earliest_available_date)
                            }
                          }}
                          className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-4 cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 shadow-md shadow-blue-500/20'
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                              {getDoctorInitials(docName)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-white text-sm">{docName}</h4>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                                  {doc.specialty || 'General'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Building size={12} className="text-slate-500" /> {doc.office_location || 'Main Pavilion'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={12} className="text-slate-500" /> {doc.consultation_duration || 30} mins
                                </span>
                                {doc.working_days && doc.working_days.length > 0 && (
                                  <span className="flex items-center gap-1 text-[11px] text-blue-300/80">
                                    <Calendar size={11} className="text-blue-400" /> Shifts: {doc.working_days.join(', ')}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                              <Check size={14} />
                            </div>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 3: Visit Type ───────────────────────────────────── */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">Select consultation mode:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setVisitType('in_person')}
                    className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      visitType === 'in_person'
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <MapPin size={20} />
                      </div>
                      {visitType === 'in_person' && <Check size={18} className="text-blue-400" />}
                    </div>
                    <div className="mt-4">
                      <h4 className="font-bold text-white text-base">In-Person Clinic Visit</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Meet with {selectedDoctor?.full_name || selectedDoctor?.name || 'your physician'} at{' '}
                        {selectedDoctor?.office_location || 'the main clinic pavilion'}.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisitType('telehealth')}
                    className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      visitType === 'telehealth'
                        ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Video size={20} />
                      </div>
                      {visitType === 'telehealth' && <Check size={18} className="text-emerald-400" />}
                    </div>
                    <div className="mt-4">
                      <h4 className="font-bold text-white text-base">Virtual Telehealth</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Secure video consultation from any mobile or desktop browser. No clinic travel required.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 4: Date & Available Slots ───────────────────────── */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                {/* Doctor Practice & Shift Info Card */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">
                      {getDoctorInitials(selectedDoctor?.full_name || selectedDoctor?.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-white text-sm">
                          {cleanDoctorName(selectedDoctor?.full_name || selectedDoctor?.name)}
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                          {selectedDoctor?.specialty || 'General Practice'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                          Demo Provider
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                        <span>
                          Working Days:{' '}
                          <span className="text-slate-200 font-medium">
                            {selectedDoctor?.working_days && selectedDoctor.working_days.length > 0
                              ? selectedDoctor.working_days.join(', ')
                              : 'Mon, Tue, Wed, Thu, Fri, Sat'}
                          </span>
                        </span>
                        <span className="text-slate-500">•</span>
                        <span>{selectedDoctor?.office_location || 'East Pavilion Clinic 2A'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                    <div>
                      <span className="text-slate-400">Clinic Timezone:</span>{' '}
                      <span className="text-blue-300 font-semibold">
                        {availability?.clinic_timezone || 'America/New_York (EDT)'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Consultation: {availability?.slot_duration_minutes || selectedDoctor?.consultation_duration || 30} mins
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Choose Consultation Date
                    </label>
                    <input
                      type="date"
                      value={bookingDate}
                      min={safeDateOnly(new Date().toISOString())}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div className="text-xs text-slate-400 sm:text-right">
                    <span className="font-semibold text-slate-300">Selected Date:</span>{' '}
                    <span className="text-slate-200">
                      {new Date(bookingDate + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Slots Grid & States */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Available Time Slots
                    </label>
                    {availability?.slots && availability.slots.length > 0 && (
                      <span className="text-xs text-slate-400">
                        {availability.available_count ?? availability.slots.filter(s => s.is_available).length} of {availability.total_count ?? availability.slots.length} open
                      </span>
                    )}
                  </div>

                  {isLoadingSlots ? (
                    <div className="p-8 text-center text-slate-400 border border-white/5 rounded-2xl glass animate-pulse">
                      <Clock size={28} className="mx-auto mb-2 text-blue-400 animate-spin" />
                      <p className="text-xs">
                        Computing real available slots for {cleanDoctorName(selectedDoctor?.full_name || selectedDoctor?.name)} in America/New_York...
                      </p>
                    </div>
                  ) : availability?.status === 'unconfigured' ||
                      availability?.status === 'time_off' ||
                      availability?.status === 'fully_booked' ||
                      availability?.status === 'booked' ||
                      availability?.status === 'unsupported_type' ||
                      (availability && availability.available_count === 0 && availability.slots.length === 0) ? (
                    <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm space-y-3">
                      <div className="flex items-center gap-2 font-bold text-amber-300">
                        <AlertTriangle size={18} />
                        {availability?.status === 'unconfigured'
                          ? 'Availability Not Configured'
                          : availability?.status === 'time_off'
                          ? 'Doctor Unavailable (Time Off / Leave)'
                          : availability?.status === 'unsupported_type'
                          ? 'Consultation Mode Not Offered'
                          : 'No Slots Available On This Date'}
                      </div>
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        {availability?.message || 'This physician does not currently have active shifts on this date.'}
                      </p>
                      {availability?.suggested_dates && availability.suggested_dates.length > 0 && (
                        <div className="pt-2 border-t border-amber-500/20">
                          <p className="text-xs text-amber-200 font-semibold mb-2">
                            Suggested next available clinic dates:
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {availability.suggested_dates.map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setBookingDate(d)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <Calendar size={12} /> {d}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : availability && availability.slots && availability.slots.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto pr-1">
                      {availability.slots.map((slot) => {
                        const isSelected = selectedSlot?.start_time === slot.start_time
                        return (
                          <button
                            key={slot.start_time}
                            type="button"
                            disabled={!slot.is_available}
                            onClick={() => setSelectedSlot(slot)}
                            className={`p-2.5 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                              !slot.is_available
                                ? 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed line-through'
                                : isSelected
                                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/30 ring-2 ring-blue-400/50'
                                : 'bg-white/5 border-white/10 text-slate-200 hover:bg-blue-500/10 hover:border-blue-500/30'
                            }`}
                          >
                            <div className="font-bold">{slot.label || slot.time_display || slot.start_time}</div>
                            <span className="text-[10px] opacity-75 font-normal block mt-0.5">
                              {slot.is_available ? `${slot.duration_minutes || availability.slot_duration_minutes || 30} min` : (slot.reason || 'Booked')}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 border border-dashed border-white/10 rounded-2xl">
                      <p className="text-xs">No slots found for this date. Please choose another date.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 5: Reason for Visit (Validated) ──────────────────── */}
            {wizardStep === 5 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Reason for Medical Consultation / Symptoms
                  </label>
                  <textarea
                    rows={4}
                    value={visitReason}
                    maxLength={500}
                    onChange={(e) => {
                      setVisitReason(e.target.value)
                      if (e.target.value.trim().length >= 5) {
                        setReasonError('')
                      }
                    }}
                    placeholder="Describe your primary reason for visiting, symptoms, duration, or any questions for the physician..."
                    className={`w-full px-4 py-3 rounded-2xl bg-white/5 border text-white text-sm focus:outline-none placeholder-slate-500 transition-all ${
                      reasonError ? 'border-rose-500' : 'border-white/10 focus:border-blue-500/50'
                    }`}
                  />
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className={reasonError ? 'text-rose-400 font-medium' : 'text-slate-400'}>
                      {reasonError || 'Minimum 5 characters required'}
                    </span>
                    <span className="text-slate-500">{visitReason.length} / 500 characters</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 text-xs text-blue-300 flex items-start gap-2.5">
                  <ShieldCheck size={16} className="shrink-0 text-blue-400 mt-0.5" />
                  <span>
                    Your health information is confidential and protected under HIPAA compliance. Only your assigned
                    clinical care team has access to your consultation notes.
                  </span>
                </div>
              </div>
            )}

            {/* ── STEP 6: Review & Final Confirmation ──────────────────── */}
            {wizardStep === 6 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300 font-medium">
                  Please review your consultation details before confirming:
                </p>

                <div className="glass p-5 rounded-2xl border border-white/10 space-y-3.5">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div>
                      <h4 className="font-bold text-white text-base">
                        {cleanDoctorName(selectedDoctor?.full_name || selectedDoctor?.name || 'Physician')}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {selectedDoctor?.specialty || 'General'} • {selectedDoctor?.department || 'Clinic'}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        visitType === 'telehealth'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {visitType === 'telehealth' ? 'Telehealth Consult' : 'In-Person Visit'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Date & Time:</span>
                      <span className="font-semibold text-slate-200">
                        {bookingDate} at {selectedSlot?.label || selectedSlot?.time_display || selectedSlot?.start_time}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Clinic Timezone:</span>
                      <span className="font-semibold text-slate-200">
                        {availability?.clinic_timezone || 'America/New_York (EDT)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Location:</span>
                      <span className="font-semibold text-slate-200">
                        {visitType === 'telehealth'
                          ? 'Virtual Care Room'
                          : selectedDoctor?.office_location || 'Main Clinic Pavilion'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Consultation Duration:</span>
                      <span className="font-semibold text-slate-200">
                        {selectedSlot?.duration_minutes || 30} minutes
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <span className="text-xs text-slate-400 block mb-1">Reason for Visit:</span>
                    <p className="text-xs text-slate-200 bg-white/5 p-2.5 rounded-xl border border-white/5">
                      {visitReason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 7: Booking Confirmed ────────────────────────────── */}
            {wizardStep === 7 && confirmedBooking && (
              <div className="text-center py-4 space-y-5 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle size={36} />
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Booking Confirmed
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">Your Appointment is Scheduled!</h3>
                  <div className="mt-3 inline-block px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-xs text-slate-400 block">Confirmation Reference</span>
                    <span className="font-mono text-lg font-bold text-blue-400">
                      {confirmedBooking.reference}
                    </span>
                  </div>
                </div>

                <div className="glass p-4 rounded-2xl max-w-md mx-auto text-left text-xs space-y-2 border border-white/10">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Physician:</span>
                    <span className="font-semibold text-white">{confirmedBooking.doctorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date & Time:</span>
                    <span className="font-semibold text-white">
                      {confirmedBooking.date} at {confirmedBooking.time}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mode:</span>
                    <span className="font-semibold text-white">{confirmedBooking.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Location:</span>
                    <span className="font-semibold text-white">{confirmedBooking.location}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => downloadCalendarInvite(confirmedBooking)}
                    className="btn-secondary text-xs inline-flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer"
                  >
                    <Download size={14} /> Download .ics Calendar File
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseWizard}
                    className="btn-primary text-xs w-full sm:w-auto justify-center cursor-pointer"
                  >
                    Done / View in Appointments
                  </button>
                </div>
              </div>
            )}

            {/* ── Wizard Controls (Back / Continue / Cancel / Confirm) ─── */}
            {wizardStep < 7 && (
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep((prev) => prev - 1)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/5 border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCloseWizard}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                )}

                {wizardStep < 6 ? (
                  <button
                    type="button"
                    disabled={
                      (wizardStep === 2 && !selectedDoctor) ||
                      (wizardStep === 4 && !selectedSlot) ||
                      (wizardStep === 5 && visitReason.trim().length < 5)
                    }
                    onClick={() => {
                      if (wizardStep === 5 && visitReason.trim().length < 5) {
                        setReasonError('Please provide at least 5 characters.')
                        return
                      }
                      setWizardStep((prev) => prev + 1)
                    }}
                    className="btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Continue <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmittingBooking}
                    onClick={handleConfirmBooking}
                    className="btn-primary text-xs inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/20 cursor-pointer"
                  >
                    {isSubmittingBooking ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Reserving Slot...
                      </>
                    ) : (
                      <>
                        <Check size={16} /> Confirm & Reserve Appointment
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL 2: APPOINTMENT DETAILS ─────────────────────────────────── */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass w-full max-w-lg rounded-2xl p-6 relative border border-white/15 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <FileText size={18} className="text-blue-400" />
                <h3 className="font-bold text-white text-base">Appointment Details</h3>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-slate-400">Reference:</span>
                <span className="font-mono font-bold text-blue-300">
                  {selectedAppointment.booking_reference || 'REF-MC'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-slate-400 block mb-1">Physician:</span>
                  <span className="font-semibold text-white block">{selectedAppointment.doctor_name || 'Assigned Physician'}</span>
                  <span className="text-[10px] text-slate-400">{selectedAppointment.doctor_specialty || 'General'}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-slate-400 block mb-1">Status:</span>
                  <span className="font-semibold text-white uppercase block">
                    {selectedAppointment.status || 'Scheduled'}
                  </span>
                  <span className="text-[10px] text-slate-400">{selectedAppointment.appointment_type || 'In-Person'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Scheduled Date:</span>
                  <span className="font-semibold text-white">
                    {formatDateDisplay(selectedAppointment.scheduled_at)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Scheduled Time:</span>
                  <span className="font-semibold text-white">
                    {formatTimeDisplay(selectedAppointment.scheduled_at)} (
                    {selectedAppointment.clinic_timezone || 'America/New_York'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration:</span>
                  <span className="font-semibold text-white">
                    {selectedAppointment.duration_minutes || 30} minutes
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Location:</span>
                  <span className="font-semibold text-white">
                    {selectedAppointment.appointment_type === 'telehealth'
                      ? 'Virtual Care Room'
                      : selectedAppointment.room || selectedAppointment.doctor_location || 'Clinic'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-slate-400 block mb-1">Medical Reason:</span>
                <p className="text-slate-200">{selectedAppointment.reason || 'Routine consultation'}</p>
              </div>

              {selectedAppointment.cancellation_reason && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <span className="font-semibold block mb-1">Cancellation Reason:</span>
                  <p>{selectedAppointment.cancellation_reason}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() =>
                  downloadCalendarInvite({
                    reference: selectedAppointment.booking_reference || 'REF-MC',
                    doctorName: selectedAppointment.doctor_name || 'Physician',
                    specialty: selectedAppointment.doctor_specialty || 'General Practice',
                    scheduledAt: selectedAppointment.scheduled_at,
                    durationMinutes: selectedAppointment.duration_minutes || 30,
                    location:
                      selectedAppointment.appointment_type === 'telehealth'
                        ? 'Virtual Care Room'
                        : selectedAppointment.room || selectedAppointment.doctor_location || 'Clinic',
                    reason: selectedAppointment.reason || 'Medical consultation',
                  })
                }
                className="btn-secondary text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={14} /> Download Invite (.ics)
              </button>
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="btn-primary text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: RESCHEDULE APPOINTMENT ──────────────────────────────── */}
      {reschedulingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass w-full max-w-lg rounded-2xl p-6 relative border border-white/15 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <RefreshCw size={18} className="text-blue-400" />
                <h3 className="font-bold text-white text-base">Reschedule Appointment</h3>
              </div>
              <button
                onClick={() => setReschedulingAppt(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select a new date and open slot for your consultation with{' '}
              <span className="font-bold text-white">{cleanDoctorName(reschedulingAppt.doctor_name || 'your physician')}</span>:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  New Date
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={safeDateOnly(new Date().toISOString())}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Available Slots
                </label>

                {isLoadingRescheduleSlots ? (
                  <div className="p-6 text-center text-slate-400 border border-white/5 rounded-xl glass animate-pulse text-xs">
                    <Clock size={20} className="mx-auto mb-1.5 text-blue-400 animate-spin" />
                    Checking open shifts...
                  </div>
                ) : rescheduleAvailability?.slots && rescheduleAvailability.slots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {rescheduleAvailability.slots.map((slot) => {
                      const isSelected = rescheduleSlot?.start_time === slot.start_time
                      return (
                        <button
                          key={slot.start_time}
                          type="button"
                          disabled={!slot.is_available}
                          onClick={() => setRescheduleSlot(slot)}
                          className={`p-2 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                            !slot.is_available
                              ? 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed line-through'
                              : isSelected
                              ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/25'
                              : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          {slot.label || slot.time_display || slot.start_time}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-400 border border-dashed border-white/10 rounded-xl text-xs space-y-2">
                    <p>{rescheduleAvailability?.message || 'No available slots for this date. Try another date.'}</p>
                    {rescheduleAvailability?.suggested_dates && rescheduleAvailability.suggested_dates.length > 0 && (
                      <div className="pt-2 border-t border-white/10">
                        <p className="text-[11px] text-slate-300 font-semibold mb-1.5">Next available dates:</p>
                        <div className="flex gap-1.5 flex-wrap justify-center">
                          {rescheduleAvailability.suggested_dates.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setRescheduleDate(d)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 cursor-pointer"
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setReschedulingAppt(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rescheduleSlot || isSubmittingReschedule}
                onClick={handleConfirmReschedule}
                className="btn-primary text-xs disabled:opacity-40 cursor-pointer"
              >
                {isSubmittingReschedule ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: CANCEL APPOINTMENT CONFIRMATION ──────────────────────── */}
      {cancellingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass w-full max-w-md rounded-2xl p-6 relative border border-rose-500/20 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Cancel Appointment</h3>
                <p className="text-xs text-slate-400">Reference: {cancellingAppt.booking_reference}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to cancel your consultation with{' '}
              <span className="font-bold text-white">{cleanDoctorName(cancellingAppt.doctor_name || 'your physician')}</span> on{' '}
              <span className="font-bold text-white">{formatDateDisplay(cancellingAppt.scheduled_at)}</span>?
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Reason for Cancellation (Optional)
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Let the clinic know why you need to cancel or if you plan to reschedule..."
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-rose-500/50 placeholder-slate-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setCancellingAppt(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all disabled:opacity-40 cursor-pointer"
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
