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
  Star,
  Award,
  HeartPulse,
  Sparkles,
  Brain,
  Activity,
  Baby,
  Bone,
  Smile,
  Wind,
  Apple,
  Eye,
  Ear,
  Flame,
  ArrowUpDown,
  SlidersHorizontal,
  Scale,
  MessageSquare,
  Share2,
  Printer,
  Copy,
  CheckCheck,
  ExternalLink,
  Info,
  PhoneCall,
  Mail,
  DollarSign,
  Layers,
  Phone,
  Compass,
  Edit2,
  Save,
  Trash2,
  PlusCircle,
  Building2,
} from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/lib/toast'
import { useAuth } from '@/lib/auth'
import { AppointmentDashboardStatsCards, DashboardStats } from '@/components/appointments/AppointmentDashboardStatsCards'
import { SpecialtyModal } from '@/components/appointments/SpecialtyModal'
import { DoctorModal } from '@/components/appointments/DoctorModal'
import { ExternalAppointmentModal, ExternalAppointmentItem } from '@/components/appointments/ExternalAppointmentModal'
import { HospitalModal, HospitalItem } from '@/components/appointments/HospitalModal'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AppointmentItem {
  id: string
  doctor_id: string
  doctor_name: string
  doctor_specialty: string
  doctor_department: string
  doctor_location: string
  doctor_phone: string
  doctor_qualifications?: string
  doctor_avatar_url?: string | null
  scheduled_at: string
  duration_minutes: number
  appointment_type: 'in_person' | 'telehealth' | 'follow_up' | 'emergency'
  room: string
  reason: string
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  booking_reference: string
  cancellation_reason?: string | null
  rescheduled_from_id?: string | null
  clinic_timezone: string
  is_upcoming: boolean
  consultation_fee?: number
  patient_name?: string
  patient_phone?: string
  patient_email?: string
  patient_address?: string
  patient_dob?: string
  existing_conditions?: string
  current_medications?: string
  allergies?: string
  referral_source?: string
  referring_doctor_name?: string
  referring_doctor_phone?: string
  referring_doctor_email?: string
  notes?: string
}

export interface DepartmentItem {
  id?: string
  name: string
  code: string
  description: string
  doctor_count: number
  icon: string
  location?: string
  phone?: string
  email?: string
  head_of_department?: string
}

export interface DoctorProfileItem {
  id: string
  name: string
  full_name?: string
  specialty: string
  department: string
  department_id?: string
  office_location: string
  phone?: string
  email?: string
  is_accepting_patients: boolean
  bio: string
  qualifications: string
  experience_years: number
  consultation_fee: number
  languages: string
  hospital_affiliation: string
  avatar_url?: string | null
  rating: number
  review_count: number
  working_days: string[]
  earliest_available_date?: string | null
  is_verified?: boolean
  license_number?: string
}

export interface DoctorReviewItem {
  id: string
  doctor_id: string
  patient_id: string
  appointment_id?: string
  rating: number
  review_text: string
  patient_display_name: string
  is_verified_appointment: boolean
  is_approved: boolean
  created_at: string
}

export interface DoctorReviewsResponse {
  doctor_id: string
  average_rating: number
  total_reviews: number
  rating_distribution: Record<string, number>
  reviews: DoctorReviewItem[]
}

export interface TimeSlot {
  start_time: string
  end_time: string
  is_available: boolean
  duration_minutes: number
  label: string
  time_display?: string
  iso_datetime: string
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

export interface HospitalContactData {
  hospital_name: string
  main_phone: string
  general_email: string
  emergency_hotline: string
  address: string
  working_hours: string
  website: string
  emergency_triage_guidance: string
}

// ── Icons Mapper for 28 Departments ──────────────────────────────────────────

function getDepartmentIcon(iconName?: string) {
  const iconMap: Record<string, any> = {
    HeartPulse,
    Sparkles,
    Brain,
    Activity,
    Stethoscope,
    Baby,
    Bone,
    Smile,
    Wind,
    Apple,
    Eye,
    Ear,
    Flame,
    Award,
    ShieldPlus: ShieldCheck,
  }
  const Component = iconMap[iconName || 'Stethoscope'] || Stethoscope
  return <Component className="w-6 h-6" />
}

export function cleanDoctorName(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') return 'Dr. Physician'
  let name = rawName.trim()
  while (/^dr\.?\s+/i.test(name)) {
    name = name.replace(/^dr\.?\s+/i, '').trim()
  }
  return `Dr. ${name}`
}

function getDoctorInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'MD'
  const cleaned = cleanDoctorName(name).replace(/^dr\.?\s+/i, '').trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'MD'
  return parts.map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function safeDateOnly(isoString?: string | null): string {
  if (!isoString || typeof isoString !== 'string') {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }
  return isoString.includes('T') ? isoString.split('T')[0] : isoString.slice(0, 10)
}

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
      'PRODID:-//MediCare AI//Hospital Appointment Scheduling//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${appt.reference || 'REF-MC'}@medicare.ai`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(validStart)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:MediCare Medical Consult: ${appt.doctorName} (${appt.specialty})`,
      `DESCRIPTION:Appointment Reference: ${appt.reference}\\nPhysician: ${appt.doctorName}\\nReason: ${appt.reason}`,
      `LOCATION:${appt.location || 'MediCare Central Hospital'}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `medicare-${appt.reference || 'appointment'}.ics`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.warn('Failed to generate calendar invite:', err)
  }
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function PatientAppointments() {
  const { success, error: toastError } = useToast()
  const { user } = useAuth()

  // Primary navigation tabs
  const [activeView, setActiveView] = useState<'appointments' | 'departments' | 'doctors' | 'track' | 'contacts'>('appointments')

  // Appointments list & filtering
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [isLoadingAppts, setIsLoadingAppts] = useState(true)
  const [apptSubTab, setApptSubTab] = useState<'upcoming' | 'past' | 'cancelled' | 'all'>('upcoming')
  const [apptSearch, setApptSearch] = useState('')

  // 28 Departments Catalog
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [deptSearch, setDeptSearch] = useState('')
  const [deptFilterGroup, setDeptFilterGroup] = useState<string>('all')

  // Doctor Directory & Profiles
  const [doctors, setDoctors] = useState<DoctorProfileItem[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const [docSpecialtyFilter, setDocSpecialtyFilter] = useState('all')
  const [docSortBy, setDocSortBy] = useState<'rating' | 'experience' | 'fee' | 'earliest'>('rating')
  const [selectedDoctorProfile, setSelectedDoctorProfile] = useState<DoctorProfileItem | null>(null)

  // Doctor Comparison State (up to 3 doctors)
  const [comparedDoctorIds, setComparedDoctorIds] = useState<string[]>([])
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)

  // Doctor Reviews State
  const [activeReviewDoctor, setActiveReviewDoctor] = useState<DoctorProfileItem | null>(null)
  const [doctorReviewsData, setDoctorReviewsData] = useState<DoctorReviewsResponse | null>(null)
  const [isLoadingReviews, setIsLoadingReviews] = useState(false)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [newReviewRating, setNewReviewRating] = useState<number>(5)
  const [newReviewText, setNewReviewText] = useState('')
  const [newReviewApptId, setNewReviewApptId] = useState<string>('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  // Tracking Modal / Section State
  const [trackRefNumber, setTrackRefNumber] = useState('')
  const [trackIdentityVerify, setTrackIdentityVerify] = useState('')
  const [trackingResult, setTrackingResult] = useState<AppointmentItem | null>(null)
  const [isTrackingLoading, setIsTrackingLoading] = useState(false)
  const [trackMessage, setTrackMessage] = useState<string | null>(null)

  // Hospital Contact Information
  const [hospitalInfo, setHospitalInfo] = useState<HospitalContactData | null>(null)
  const [hospitals, setHospitals] = useState<HospitalItem[]>([])
  const [isAddHospitalOpen, setIsAddHospitalOpen] = useState(false)
  const [isLoadingHospitals, setIsLoadingHospitals] = useState(false)

  // Top Dashboard Live Metrics
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)

  // Specialty & Doctor Admin Actions
  const [isAddSpecialtyOpen, setIsAddSpecialtyOpen] = useState(false)
  const [specialtyToEdit, setSpecialtyToEdit] = useState<DepartmentItem | null>(null)
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false)

  // Patient External Appointment Tracking & Logging
  const [trackMode, setTrackMode] = useState<'reference' | 'manual'>('reference')
  const [isManualExternalOpen, setIsManualExternalOpen] = useState(false)
  const [externalApptToEdit, setExternalApptToEdit] = useState<ExternalAppointmentItem | null>(null)
  const [externalAppointments, setExternalAppointments] = useState<ExternalAppointmentItem[]>([])
  const [isLoadingExternalAppts, setIsLoadingExternalAppts] = useState(false)
  const [externalTrackingResult, setExternalTrackingResult] = useState<ExternalAppointmentItem | null>(null)

  // Modals for Actions: Details, Reschedule, Cancel, Edit, Print Receipt
  const [selectedApptDetails, setSelectedApptDetails] = useState<AppointmentItem | null>(null)
  const [reschedulingAppt, setReschedulingAppt] = useState<AppointmentItem | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([])
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<TimeSlot | null>(null)
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false)
  const [cancellingAppt, setCancellingAppt] = useState<AppointmentItem | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [receiptAppt, setReceiptAppt] = useState<AppointmentItem | null>(null)
  const [copiedRef, setCopiedRef] = useState(false)

  // Edit Appointment Modal State
  const [editingAppt, setEditingAppt] = useState<AppointmentItem | null>(null)
  const [editReason, setEditReason] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editConditions, setEditConditions] = useState('')
  const [editMedications, setEditMedications] = useState('')
  const [editAllergies, setEditAllergies] = useState('')
  const [isUpdatingAppt, setIsUpdatingAppt] = useState(false)

  // ── 6-Step Booking Wizard State ───────────────────────────────────────────
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [modalDeptSearch, setModalDeptSearch] = useState('')
  const [wizardStep, setWizardStep] = useState<number>(1) // 1: Dept, 2: Doctor, 3: Type, 4: Slot, 5: Patient Info, 6: Review, 7: Confirmed

  // Form Fields
  const [bookingDepartment, setBookingDepartment] = useState<DepartmentItem | null>(null)
  const [bookingDoctor, setBookingDoctor] = useState<DoctorProfileItem | null>(null)
  const [bookingType, setBookingType] = useState<'in_person' | 'telehealth' | 'follow_up' | 'emergency'>('in_person')
  const [bookingDate, setBookingDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [bookingSlots, setBookingSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)

  // 18+ Patient demographic and referral fields
  const [patientFullName, setPatientFullName] = useState('')
  const [patientMrn, setPatientMrn] = useState('')
  const [patientDob, setPatientDob] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [patientEmail, setPatientEmail] = useState('')
  const [patientAddress, setPatientAddress] = useState('')
  const [consultReason, setConsultReason] = useState('')
  const [existingConditions, setExistingConditions] = useState('')
  const [currentMedications, setCurrentMedications] = useState('')
  const [allergies, setAllergies] = useState('')
  const [referralSource, setReferralSource] = useState<'self_referral' | 'doctor' | 'hospital' | 'other'>('self_referral')
  const [referringDoctorName, setReferringDoctorName] = useState('')
  const [referringDoctorPhone, setReferringDoctorPhone] = useState('')
  const [referringDoctorEmail, setReferringDoctorEmail] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [clinicalConsent, setClinicalConsent] = useState(false)
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
  const [confirmedBookingData, setConfirmedBookingData] = useState<AppointmentItem | null>(null)

  // ── Initial Data Fetching ──────────────────────────────────────────────────

  const loadAppointments = useCallback(async () => {
    setIsLoadingAppts(true)
    try {
      const res = await api.get('/api/v1/appointments')
      setAppointments(res.data)
    } catch (err: any) {
      console.warn('Failed to load appointments:', err)
    } finally {
      setIsLoadingAppts(false)
    }
  }, [])

  const loadDepartments = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/appointments/specialties')
      setDepartments(res.data)
    } catch (err) {
      console.warn('Failed to fetch departments:', err)
    }
  }, [])

  const loadDoctors = useCallback(async () => {
    setIsLoadingDocs(true)
    try {
      const res = await api.get('/api/v1/appointments/doctors', {
        params: {
          specialty: docSpecialtyFilter !== 'all' ? docSpecialtyFilter : undefined,
          sort_by: docSortBy,
          search: docSearch || undefined,
        },
      })
      setDoctors(res.data)
    } catch (err) {
      console.warn('Failed to load doctors:', err)
    } finally {
      setIsLoadingDocs(false)
    }
  }, [docSpecialtyFilter, docSortBy, docSearch])

  const loadHospitalInfo = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/appointments/hospital-info')
      setHospitalInfo(res.data)
    } catch (err) {
      console.warn('Failed to load hospital contacts:', err)
    }
  }, [])

  const loadDashboardStats = useCallback(async () => {
    setIsLoadingStats(true)
    try {
      const res = await api.get('/api/v1/appointments/dashboard-stats')
      setDashboardStats(res.data)
    } catch (err) {
      console.warn('Failed to load dashboard stats:', err)
    } finally {
      setIsLoadingStats(false)
    }
  }, [])

  const loadExternalAppointments = useCallback(async () => {
    setIsLoadingExternalAppts(true)
    try {
      const res = await api.get('/api/v1/appointments/external')
      setExternalAppointments(res.data)
    } catch (err) {
      console.warn('Failed to load external appointments:', err)
    } finally {
      setIsLoadingExternalAppts(false)
    }
  }, [])

  const loadHospitals = useCallback(async () => {
    setIsLoadingHospitals(true)
    try {
      const res = await api.get('/api/v1/appointments/hospitals')
      setHospitals(res.data)
    } catch (err) {
      console.warn('Failed to load hospitals:', err)
    } finally {
      setIsLoadingHospitals(false)
    }
  }, [])

  useEffect(() => {
    loadAppointments()
    loadDepartments()
    loadDoctors()
    loadHospitalInfo()
    loadDashboardStats()
    loadExternalAppointments()
    loadHospitals()
  }, [
    loadAppointments,
    loadDepartments,
    loadDoctors,
    loadHospitalInfo,
    loadDashboardStats,
    loadExternalAppointments,
    loadHospitals,
  ])

  // Fetch slots whenever booking doctor or booking date changes
  useEffect(() => {
    if (!bookingDoctor || !bookingDate || wizardStep !== 4) return
    let isCancelled = false
    setIsLoadingSlots(true)
    setSelectedSlot(null)

    api
      .get('/api/v1/appointments/availability', {
        params: {
          doctor_id: bookingDoctor.id,
          date: bookingDate,
          appointment_type: bookingType === 'telehealth' ? 'telehealth' : 'in_person',
        },
      })
      .then((res) => {
        if (!isCancelled) {
          setBookingSlots(res.data.slots || [])
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setBookingSlots([])
          console.warn('Slot availability error:', err)
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingSlots(false)
      })

    return () => {
      isCancelled = true
    }
  }, [bookingDoctor, bookingDate, wizardStep, bookingType])

  // Fetch reschedule slots
  useEffect(() => {
    if (!reschedulingAppt || !rescheduleDate) return
    api
      .get('/api/v1/appointments/availability', {
        params: {
          doctor_id: reschedulingAppt.doctor_id,
          date: rescheduleDate,
        },
      })
      .then((res) => setRescheduleSlots(res.data.slots || []))
      .catch(() => setRescheduleSlots([]))
  }, [reschedulingAppt, rescheduleDate])

  // ── Handlers & Actions ─────────────────────────────────────────────────────

  const handleSelectDoctorForBooking = (doc: DoctorProfileItem) => {
    setBookingDoctor(doc)
    // Find matching department by doctor specialty or department name
    const matchedDept = departments.find(
      (d) =>
        d.name.toLowerCase() === (doc.specialty || '').toLowerCase() ||
        d.name.toLowerCase() === (doc.department || '').toLowerCase()
    ) || {
      id: doc.department_id || 'dept-auto',
      code: (doc.specialty || doc.department || 'MED').substring(0, 4).toUpperCase(),
      name: doc.specialty || doc.department || 'Cardiology',
      description: `Comprehensive specialized care in ${doc.specialty || doc.department || 'Cardiology'}.`,
      doctor_count: 1,
      icon: 'heart-pulse',
      is_active: true,
    }
    setBookingDepartment(matchedDept)
    setSelectedSlot(null)
    setConfirmedBookingData(null)
    // Advance straight to Step 3 (Appointment Type) so patient never has to re-select doctor
    setWizardStep(3)
    setIsBookingOpen(true)
  }

  const handleSelectDepartmentForBooking = (dept: DepartmentItem) => {
    setBookingDepartment(dept)
    setBookingDoctor(null)
    setDocSpecialtyFilter(dept.name)
    setSelectedSlot(null)
    setConfirmedBookingData(null)
    // Advance directly to Step 2 so patient chooses doctor within that department
    setWizardStep(2)
    setIsBookingOpen(true)
  }

  const handleOpenBookingWizard = (dept?: DepartmentItem, doc?: DoctorProfileItem) => {
    if (doc) {
      handleSelectDoctorForBooking(doc)
      return
    }
    if (dept) {
      handleSelectDepartmentForBooking(dept)
      return
    }
    setBookingDepartment(null)
    setBookingDoctor(null)
    setSelectedSlot(null)
    setConfirmedBookingData(null)
    setWizardStep(1)
    setIsBookingOpen(true)
  }

  const handleOpenEditModal = (appt: AppointmentItem) => {
    setEditingAppt(appt)
    setEditReason(appt.reason || '')
    setEditNotes(appt.notes || '')
    setEditPhone(appt.patient_phone || '')
    setEditEmail(appt.patient_email || '')
    setEditAddress(appt.patient_address || '')
    setEditConditions(appt.existing_conditions || '')
    setEditMedications(appt.current_medications || '')
    setEditAllergies(appt.allergies || '')
  }

  const handleSaveEditedAppointment = async () => {
    if (!editingAppt) return
    if (!editReason.trim() || editReason.trim().length < 5) {
      toastError('Please provide a clinical reason of at least 5 characters.')
      return
    }
    setIsUpdatingAppt(true)
    try {
      await api.put(`/api/v1/appointments/${editingAppt.id}`, {
        reason: editReason.trim(),
        notes: editNotes.trim() || undefined,
        patient_phone: editPhone.trim() || undefined,
        patient_email: editEmail.trim() || undefined,
        patient_address: editAddress.trim() || undefined,
        existing_conditions: editConditions.trim() || undefined,
        current_medications: editMedications.trim() || undefined,
        allergies: editAllergies.trim() || undefined,
      })
      success('Appointment information successfully updated!')
      setEditingAppt(null)
      loadAppointments()
    } catch (err: any) {
      toastError(err.response?.data?.detail || 'Failed to update appointment.')
    } finally {
      setIsUpdatingAppt(false)
    }
  }

  const handleOpenReviewsModal = async (doc: DoctorProfileItem) => {
    setActiveReviewDoctor(doc)
    setIsReviewModalOpen(true)
    setIsLoadingReviews(true)
    try {
      const res = await api.get(`/api/v1/appointments/doctors/${doc.id}/reviews`)
      setDoctorReviewsData(res.data)
    } catch (err) {
      console.warn('Failed to load reviews:', err)
    } finally {
      setIsLoadingReviews(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!activeReviewDoctor) return
    if (!newReviewText.trim() || newReviewText.trim().length < 5) {
      toastError('Please provide a constructive review of at least 5 characters.')
      return
    }
    setIsSubmittingReview(true)
    try {
      await api.post(`/api/v1/appointments/doctors/${activeReviewDoctor.id}/reviews`, {
        rating: newReviewRating,
        review_text: newReviewText.trim(),
        appointment_id: newReviewApptId || undefined,
      })
      success('Thank you! Your patient review has been recorded.')
      setNewReviewText('')
      setNewReviewRating(5)
      setNewReviewApptId('')
      // Reload reviews and doctor directory
      const refreshed = await api.get(`/api/v1/appointments/doctors/${activeReviewDoctor.id}/reviews`)
      setDoctorReviewsData(refreshed.data)
      loadDoctors()
    } catch (err: any) {
      toastError(err.response?.data?.detail || 'Failed to submit review. Duplicate review for the same appointment is not allowed.')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to remove your feedback?')) return
    try {
      await api.delete(`/api/v1/appointments/reviews/${reviewId}`)
      success('Review removed.')
      if (activeReviewDoctor) {
        const refreshed = await api.get(`/api/v1/appointments/doctors/${activeReviewDoctor.id}/reviews`)
        setDoctorReviewsData(refreshed.data)
        loadDoctors()
      }
    } catch (err) {
      toastError('Failed to delete review.')
    }
  }

  const toggleCompareDoctor = (docId: string) => {
    if (comparedDoctorIds.includes(docId)) {
      setComparedDoctorIds(comparedDoctorIds.filter((id) => id !== docId))
    } else {
      if (comparedDoctorIds.length >= 3) {
        toastError('You can compare a maximum of 3 physicians side-by-side.')
        return
      }
      setComparedDoctorIds([...comparedDoctorIds, docId])
    }
  }

  const handleTrackAppointment = async () => {
    if (!trackRefNumber.trim()) {
      toastError('Please enter an appointment reference number (e.g. MED-2026-000001).')
      return
    }
    setIsTrackingLoading(true)
    setTrackingResult(null)
    setTrackMessage(null)
    try {
      const res = await api.get('/api/v1/appointments/track', {
        params: {
          reference_number: trackRefNumber.trim().toUpperCase(),
          patient_verify: trackIdentityVerify.trim() || undefined,
        },
      })
      if (res.data.found && res.data.appointment) {
        setTrackingResult(res.data.appointment)
        setExternalTrackingResult(null)
        setTrackMessage('Internal hospital appointment verified.')
      } else if (res.data.found && res.data.external_appointment) {
        setExternalTrackingResult(res.data.external_appointment)
        setTrackingResult(null)
        setTrackMessage(`External appointment verified at ${res.data.external_appointment.hospital_name} (Patient-entered record).`)
      } else {
        setTrackingResult(null)
        setExternalTrackingResult(null)
        setTrackMessage(res.data.message || 'Appointment record not found.')
      }
    } catch (err: any) {
      setTrackMessage(err.response?.data?.detail || 'Unable to track appointment. Please check reference code.')
    } finally {
      setIsTrackingLoading(false)
    }
  }

  const handleConfirmBooking = async () => {
    if (!bookingDoctor || !selectedSlot) {
      toastError('Please ensure a doctor and time slot are selected.')
      return
    }
    if (!consultReason.trim() || consultReason.trim().length < 5) {
      toastError('Please provide a clinical reason of at least 5 characters for your consultation.')
      return
    }
    if (!clinicalConsent) {
      toastError('Please acknowledge the clinical consent and telehealth terms to proceed.')
      return
    }

    setIsSubmittingBooking(true)
    try {
      const payload = {
        doctor_id: bookingDoctor.id,
        scheduled_at: selectedSlot.iso_datetime,
        duration_minutes: selectedSlot.duration_minutes || 30,
        appointment_type: bookingType,
        reason: consultReason.trim(),
        department_name: bookingDepartment?.name || bookingDoctor.department,
        department_id: bookingDepartment?.id,
        patient_phone: patientPhone || undefined,
        patient_email: patientEmail || undefined,
        patient_address: patientAddress || undefined,
        patient_dob: patientDob || undefined,
        existing_conditions: existingConditions || undefined,
        current_medications: currentMedications || undefined,
        allergies: allergies || undefined,
        referral_source: referralSource,
        referring_doctor_name: referralSource === 'doctor' ? referringDoctorName : undefined,
        referring_doctor_phone: referralSource === 'doctor' ? referringDoctorPhone : undefined,
        referring_doctor_email: referralSource === 'doctor' ? referringDoctorEmail : undefined,
        notes: additionalNotes || undefined,
      }

      const res = await api.post('/api/v1/appointments', payload)
      setConfirmedBookingData(res.data)
      setWizardStep(7) // Go to confirmation screen
      success(`Appointment successfully booked! Ref: ${res.data.booking_reference}`)
      loadAppointments()
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Booking failed. This time slot may have just been claimed.'
      toastError(msg)
    } finally {
      setIsSubmittingBooking(false)
    }
  }

  const handleExecuteReschedule = async () => {
    if (!reschedulingAppt || !selectedRescheduleSlot) {
      toastError('Please pick an available slot to reschedule.')
      return
    }
    setIsSubmittingReschedule(true)
    try {
      await api.post(`/api/v1/appointments/${reschedulingAppt.id}/reschedule`, {
        new_scheduled_at: selectedRescheduleSlot.iso_datetime,
        reason: 'Patient self-service schedule change',
      })
      success('Appointment rescheduled successfully!')
      setReschedulingAppt(null)
      loadAppointments()
    } catch (err: any) {
      toastError(err.response?.data?.detail || 'Failed to reschedule appointment.')
    } finally {
      setIsSubmittingReschedule(false)
    }
  }

  const handleExecuteCancellation = async () => {
    if (!cancellingAppt) return
    setIsCancelling(true)
    try {
      await api.post(`/api/v1/appointments/${cancellingAppt.id}/cancel`, {
        cancellation_reason: cancellationReason.trim() || 'Patient requested cancellation',
      })
      success('Appointment has been cancelled.')
      setCancellingAppt(null)
      setCancellationReason('')
      loadAppointments()
    } catch (err: any) {
      toastError(err.response?.data?.detail || 'Failed to cancel appointment.')
    } finally {
      setIsCancelling(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedRef(true)
    setTimeout(() => setCopiedRef(false), 2000)
    success('Reference number copied to clipboard!')
  }

  // ── Filtered Appointments ──────────────────────────────────────────────────

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      if (apptSubTab === 'upcoming' && !appt.is_upcoming) return false
      if (apptSubTab === 'past' && (appt.is_upcoming || appt.status === 'cancelled')) return false
      if (apptSubTab === 'cancelled' && appt.status !== 'cancelled') return false

      if (apptSearch.trim()) {
        const q = apptSearch.toLowerCase()
        const matchesDoc = appt.doctor_name.toLowerCase().includes(q)
        const matchesRef = (appt.booking_reference || '').toLowerCase().includes(q)
        const matchesSpec = (appt.doctor_specialty || '').toLowerCase().includes(q)
        const matchesReason = (appt.reason || '').toLowerCase().includes(q)
        return matchesDoc || matchesRef || matchesSpec || matchesReason
      }
      return true
    })
  }, [appointments, apptSubTab, apptSearch])

  // Filtered Departments
  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      if (deptSearch.trim()) {
        const q = deptSearch.toLowerCase()
        return (
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [departments, deptSearch])

  // Compared Doctors Objects
  const comparedDoctorsList = useMemo(() => {
    return doctors.filter((d) => comparedDoctorIds.includes(d.id))
  }, [doctors, comparedDoctorIds])

  // Completed Appointments for Reviews
  const completedAppointmentsList = useMemo(() => {
    return appointments.filter(
      (a) => a.status === 'completed' || a.status === 'confirmed'
    )
  }, [appointments])

  return (
    <div className="min-h-screen bg-[#070e1b] text-slate-100 p-4 md:p-8 font-sans">
      {/* ── Top Header & Emergency Alert Banner ──────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-8">
        {/* Emergency Notice Pill */}
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl px-4 py-2.5 mb-6 flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm text-rose-200 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
            <span>
              <strong>Emergency Care Hotline:</strong> Acute chest pain, shortness of breath, or trauma? Call{' '}
              <a href="tel:911" className="underline font-bold text-rose-300 hover:text-white">
                911
              </a>{' '}
              or our 24/7 Level 1 Trauma Hotline:{' '}
              <a href="tel:5550199911" className="underline font-bold text-rose-300 hover:text-white">
                (555) 019-9911
              </a>
            </span>
          </div>
          <button
            onClick={() => setActiveView('contacts')}
            className="text-xs bg-rose-900/60 hover:bg-rose-800 text-rose-100 px-3 py-1 rounded-lg border border-rose-500/30 transition-all font-medium"
          >
            Hospital Triage Info &rarr;
          </button>
        </div>

        {/* Primary Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/10">
                <CalendarCheck className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  Hospital Appointment Management
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    28 Specialties
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Comprehensive hospital scheduling across all 28 departments, verified doctor profiles, patient reviews, and instant tracking.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveView('track')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-blue-500/50 text-slate-200 hover:text-white transition-all text-sm font-medium shadow-md"
            >
              <Compass className="w-4 h-4 text-cyan-400" />
              Track by Reference
            </button>
            <button
              onClick={() => handleOpenBookingWizard()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Book an Appointment
            </button>
          </div>
        </div>

        {/* ── Top Level Real-Time Database Metrics ─────────────────────── */}
        <div className="mt-6">
          <AppointmentDashboardStatsCards stats={dashboardStats} isLoading={isLoadingStats} />
        </div>

        {/* Demonstration Data Banner */}
        <div className="mt-2 px-4 py-2 bg-blue-950/20 border border-blue-800/30 rounded-lg flex items-center gap-2 text-xs text-blue-300/80">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            <strong>Clinical Demonstration Environment:</strong> Doctor credentials, schedules, and reviews represent standard verification templates for institutional evaluation.
          </span>
        </div>

        {/* ── Main Navigation Tabs ────────────────────────────────────────── */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 mt-6 border-b border-slate-800/80 pb-3">
          <button
            onClick={() => setActiveView('appointments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              activeView === 'appointments'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            My Appointments
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-slate-950/60 text-slate-300">
              {appointments.filter((a) => a.is_upcoming).length}
            </span>
          </button>

          <button
            onClick={() => setActiveView('departments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              activeView === 'departments'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Building className="w-4 h-4" />
            28 Medical Specialties
          </button>

          <button
            onClick={() => setActiveView('doctors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              activeView === 'doctors'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            Doctor Directory
            {comparedDoctorIds.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                {comparedDoctorIds.length} compared
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView('track')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              activeView === 'track'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Compass className="w-4 h-4" />
            Track Appointment
          </button>

          <button
            onClick={() => setActiveView('contacts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              activeView === 'contacts'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Phone className="w-4 h-4" />
            Hospital & Emergency Contacts
          </button>
        </div>
      </div>

      {/* ── View 1: My Appointments ──────────────────────────────────────── */}
      {activeView === 'appointments' && (
        <div className="max-w-7xl mx-auto">
          {/* Subtabs and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
              {(['upcoming', 'past', 'cancelled', 'all'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setApptSubTab(tab)}
                  className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    apptSubTab === tab
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search reference, doctor, reason..."
                value={apptSearch}
                onChange={(e) => setApptSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Appointments Grid */}
          {isLoadingAppts ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="text-sm">Loading verified clinical appointments...</p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="py-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80 p-8">
              <CalendarX className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-300 mb-1">No appointments found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                You have no appointments matching this view. Select a medical department or physician to book a consultation.
              </p>
              <button
                onClick={() => handleOpenBookingWizard()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all"
              >
                Book Your First Consultation
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg backdrop-blur-md flex flex-col justify-between transition-all hover:shadow-blue-900/10"
                >
                  <div>
                    {/* Reference & Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        {appt.booking_reference}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize border ${
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
                    </div>

                    {/* Doctor Info */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-white text-sm shadow-md">
                        {getDoctorInitials(appt.doctor_name)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight">
                          {cleanDoctorName(appt.doctor_name)}
                        </h4>
                        <p className="text-xs text-blue-400 font-medium">
                          {appt.doctor_specialty || appt.doctor_department || 'Specialist'}
                        </p>
                      </div>
                    </div>

                    {/* Schedule Time & Location */}
                    <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs text-slate-300 mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>
                          {new Date(appt.scheduled_at).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}{' '}
                          at{' '}
                          {new Date(appt.scheduled_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {appt.appointment_type === 'telehealth' ? (
                          <>
                            <Video className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="text-cyan-300 font-medium">Virtual Video Consultation Suite</span>
                          </>
                        ) : (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">{appt.room || appt.doctor_location || 'Clinic Suite 2B'}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Reason */}
                    <p className="text-xs text-slate-400 line-clamp-2 mb-4 italic">
                      "{appt.reason}"
                    </p>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => setSelectedApptDetails(appt)}
                      className="flex-1 text-center py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => setReceiptAppt(appt)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                      title="Download / Print Confirmation"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {appt.is_upcoming && (
                      <>
                        <button
                          onClick={() => handleOpenEditModal(appt)}
                          className="text-xs px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all font-medium flex items-center gap-1"
                          title="Edit Information"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setReschedulingAppt(appt)
                            setRescheduleDate(safeDateOnly(appt.scheduled_at))
                          }}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 transition-all font-medium"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => setCancellingAppt(appt)}
                          className="text-xs px-2 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 border border-rose-500/20 transition-all"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── View 2: Medical Specialties / Departments ────────────────── */}
      {activeView === 'departments' && (
        <div className="max-w-7xl mx-auto">
          {/* Consistent Action Area (Matching Proposed Layout) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 mb-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg md:text-xl font-bold text-white">Medical Specialties</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {departments.length} available
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search specialties"
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => {
                  setSpecialtyToEdit(null)
                  setIsAddSpecialtyOpen(true)
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add New
              </button>
            </div>
          </div>

          {/* Department Cards Grid (all 28) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredDepartments.map((dept, idx) => (
              <div
                key={dept.name + idx}
                className="bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 shadow-lg backdrop-blur-md flex flex-col justify-between transition-all hover:-translate-y-0.5 group"
              >
                <div>
                  {/* Icon & Code */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center shadow-md">
                      {getDepartmentIcon(dept.icon)}
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                      {dept.code}
                    </span>
                  </div>

                  {/* Name & Doctors Available */}
                  <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors leading-snug mb-1">
                    {dept.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mb-3">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{dept.doctor_count} attending physician{dept.doctor_count > 1 ? 's' : ''}</span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 mb-4">
                    {dept.description}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setDocSpecialtyFilter(dept.name)
                      setActiveView('doctors')
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all text-center"
                  >
                    View Doctors
                  </button>
                  <button
                    onClick={() => {
                      setSpecialtyToEdit(dept)
                      setIsAddSpecialtyOpen(true)
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-xs"
                    title="Edit Specialty"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleSelectDepartmentForBooking(dept)}
                    className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all flex items-center gap-1"
                  >
                    Book <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── View 3: Doctor Directory & Profiles ─────────────────────────── */}
      {activeView === 'doctors' && (
        <div className="max-w-7xl mx-auto">
          {/* Consistent Action Area (Matching Proposed Layout) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 mb-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg md:text-xl font-bold text-white">Doctor Directory</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Directory
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search doctors"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => setIsAddDoctorOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Doctor
              </button>
            </div>
          </div>

          {/* Compare Floating Tray if 2+ selected */}
          {comparedDoctorIds.length > 0 && (
            <div className="sticky top-4 z-30 mb-6 bg-blue-950/90 border border-blue-500/50 rounded-2xl p-4 shadow-2xl backdrop-blur-lg flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Scale className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Physician Comparison Tray ({comparedDoctorIds.length}/3 selected)
                  </h4>
                  <p className="text-xs text-blue-200">
                    Compare credentials, clinical experience, consultation fees, and patient ratings side-by-side.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setComparedDoctorIds([])}
                  className="px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                >
                  Clear Selection
                </button>
                <button
                  onClick={() => setIsCompareModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  Compare Now &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Directory Filters & Sorting */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              {/* Specialty dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-semibold">Specialty:</label>
                <select
                  value={docSpecialtyFilter}
                  onChange={(e) => setDocSpecialtyFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Departments (28)</option>
                  {departments.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort by dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-semibold">Sort By:</label>
                <select
                  value={docSortBy}
                  onChange={(e: any) => setDocSortBy(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="rating">Highest Rated</option>
                  <option value="experience">Most Experienced</option>
                  <option value="fee">Lowest Consultation Fee</option>
                  <option value="earliest">Earliest Availability</option>
                </select>
              </div>
            </div>

            {/* Doctor Search */}
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search physician name or bio..."
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Doctor Cards */}
          {isLoadingDocs ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="text-sm">Retrieving verified physician directory...</p>
            </div>
          ) : doctors.length === 0 ? (
            <div className="py-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800 p-8">
              <p className="text-sm text-slate-400">No doctors found matching the selected filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {doctors.map((doc) => {
                const isCompared = comparedDoctorIds.includes(doc.id)
                return (
                  <div
                    key={doc.id}
                    className={`bg-slate-900/80 border rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all hover:border-blue-500/50 ${
                      isCompared ? 'border-cyan-500/80 ring-1 ring-cyan-500/30' : 'border-slate-800'
                    }`}
                  >
                    <div>
                      {/* Doctor Top Row: Photo/Avatar + Rating + Compare Checkbox */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-600 flex items-center justify-center font-bold text-white text-base shadow-md">
                              {getDoctorInitials(doc.name)}
                            </div>
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-base font-bold text-white leading-tight">
                                {cleanDoctorName(doc.name)}
                              </h3>
                              {doc.is_verified && (
                                <span title="Verified Clinical Credentials">
                                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-blue-400 font-medium">{doc.specialty}</p>
                            <p className="text-[11px] text-slate-400">{doc.qualifications}</p>
                          </div>
                        </div>

                        {/* Compare toggle button */}
                        <button
                          onClick={() => toggleCompareDoctor(doc.id)}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all ${
                            isCompared
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                          }`}
                          title="Select to compare side-by-side"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          {isCompared ? 'Comparing' : 'Compare'}
                        </button>
                      </div>

                      {/* Badges: Experience, Rating, Fee */}
                      <div className="grid grid-cols-3 gap-2 py-3 px-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center text-xs mb-4">
                        <div>
                          <div className="flex items-center justify-center gap-1 text-amber-400 font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            <span>{doc.rating}</span>
                          </div>
                          <button
                            onClick={() => handleOpenReviewsModal(doc)}
                            className="text-[11px] text-slate-400 hover:text-blue-300 underline"
                          >
                            {doc.review_count} reviews
                          </button>
                        </div>
                        <div className="border-x border-slate-800">
                          <span className="font-bold text-slate-200">{doc.experience_years}+ Yrs</span>
                          <span className="block text-[11px] text-slate-500">Experience</span>
                        </div>
                        <div>
                          <span className="font-bold text-emerald-400">${doc.consultation_fee}</span>
                          <span className="block text-[11px] text-slate-500">Consult Fee</span>
                        </div>
                      </div>

                      {/* Affiliation & Languages */}
                      <div className="space-y-1.5 text-xs text-slate-400 mb-4">
                        <div className="flex items-center gap-2">
                          <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{doc.hospital_affiliation}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Languages: {doc.languages}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>
                            Next Available:{' '}
                            <strong className="text-slate-200">
                              {doc.earliest_available_date || 'Schedule Open'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Bio snippet */}
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-4">
                        {doc.bio}
                      </p>

                      {/* Contact links */}
                      <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/60 mb-4">
                        {doc.phone && (
                          <a
                            href={`tel:${doc.phone.replace(/[^0-9]/g, '')}`}
                            className="flex items-center gap-1.5 hover:text-blue-400 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            {doc.phone}
                          </a>
                        )}
                        {doc.email && (
                          <a
                            href={`mailto:${doc.email}`}
                            className="flex items-center gap-1.5 hover:text-blue-400 transition-colors truncate"
                          >
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            {doc.email}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDoctorProfile(doc)}
                        className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1"
                        title="View Full Physician Profile"
                      >
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenReviewsModal(doc)}
                        className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-1"
                        title="Read Patient Feedback"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        Reviews
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectDoctorForBooking(doc)}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all text-center flex items-center justify-center gap-1"
                        title="Book Appointment with this Doctor"
                      >
                        Book Appointment
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── View 4: Appointment Tracking & External Logging ─────────────── */}
      {activeView === 'track' && (
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Consistent Action Area (Matching Proposed Layout in Image 4) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg md:text-xl font-bold text-white">Track Appointment</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Tracking
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setTrackMode('reference')}
                className={`p-6 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2.5 group cursor-pointer ${
                  trackMode === 'reference'
                    ? 'bg-blue-600/10 border-blue-500/60 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform flex items-center justify-center">
                  <Search className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-white">Track by Reference</span>
                <span className="text-xs text-slate-400">Lookup internal or external appointment by reference code</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExternalApptToEdit(null)
                  setIsManualExternalOpen(true)
                }}
                className={`p-6 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2.5 group cursor-pointer ${
                  trackMode === 'manual'
                    ? 'bg-emerald-600/10 border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform flex items-center justify-center">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-white">Manual Entry</span>
                <span className="text-xs text-slate-400">Log patient-entered external appointment from Mayo, Cleveland Clinic, etc.</span>
              </button>
            </div>
          </div>

          {/* Reference Lookup Form Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-cyan-500/10">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Enter Appointment Reference
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-0.5">
                Verify internal clinic reference (e.g. MED-2026-XXXXXX) or external reference code.
              </p>
            </div>

            {/* Tracking Form */}
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Appointment Reference Number *
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="MED-2026-XXXXXX or EXT-2026-XXXXXX"
                    value={trackRefNumber}
                    onChange={(e) => setTrackRefNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Patient Phone, Email, or DOB (Identity Verification)
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Enter phone or email used during booking"
                    value={trackIdentityVerify}
                    onChange={(e) => setTrackIdentityVerify(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <button
                onClick={handleTrackAppointment}
                disabled={isTrackingLoading}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-cyan-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isTrackingLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Verifying Record...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Verify & Track Appointment
                  </>
                )}
              </button>
            </div>

            {/* Tracking Feedback Message */}
            {trackMessage && !trackingResult && !externalTrackingResult && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center text-xs text-slate-400">
                {trackMessage}
              </div>
            )}

            {/* Internal Tracking Result Card */}
            {trackingResult && (
              <div className="mt-6 p-6 rounded-2xl bg-slate-950/90 border border-cyan-500/30 shadow-xl space-y-4">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-xs text-slate-500">Internal Booking Reference</span>
                    <h3 className="font-mono text-base font-bold text-cyan-400">
                      {trackingResult.booking_reference}
                    </h3>
                  </div>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full uppercase border ${
                      trackingResult.status === 'confirmed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : trackingResult.status === 'scheduled'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {trackingResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Attending Physician:</span>
                    <strong className="text-white text-sm">
                      {cleanDoctorName(trackingResult.doctor_name)}
                    </strong>
                    <p className="text-blue-400 font-medium">
                      {trackingResult.doctor_specialty || trackingResult.doctor_department}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 block mb-0.5">Scheduled Date & Time:</span>
                    <strong className="text-white text-sm">
                      {new Date(trackingResult.scheduled_at).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </strong>
                    <p className="text-slate-400">
                      {new Date(trackingResult.scheduled_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      ({trackingResult.duration_minutes} mins)
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 block mb-0.5">Location / Suite:</span>
                    <strong className="text-white">
                      {trackingResult.appointment_type === 'telehealth'
                        ? 'Virtual Telehealth Suite'
                        : trackingResult.room || trackingResult.doctor_location}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500 block mb-0.5">Patient Name:</span>
                    <strong className="text-white">
                      {trackingResult.patient_name || 'Verified Patient'}
                    </strong>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-400 italic">
                    Reason: "{trackingResult.reason}"
                  </p>
                  <button
                    onClick={() => setReceiptAppt(trackingResult)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shrink-0 cursor-pointer"
                  >
                    Print Confirmation
                  </button>
                </div>
              </div>
            )}

            {/* External Tracking Result Card */}
            {externalTrackingResult && (
              <div className="mt-6 p-6 rounded-2xl bg-amber-950/20 border border-amber-500/40 shadow-xl space-y-4">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">External Appointment Reference</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Patient-entered / External appointment
                      </span>
                    </div>
                    <h3 className="font-mono text-base font-bold text-amber-400 mt-0.5">
                      {externalTrackingResult.appointment_reference}
                    </h3>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full uppercase border bg-amber-500/10 text-amber-300 border-amber-500/30">
                    {externalTrackingResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500 block mb-0.5">External Hospital / Clinic:</span>
                    <strong className="text-white text-sm">{externalTrackingResult.hospital_name}</strong>
                    <p className="text-amber-300 font-medium">{externalTrackingResult.doctor_name}</p>
                  </div>

                  <div>
                    <span className="text-slate-500 block mb-0.5">Scheduled Date & Time:</span>
                    <strong className="text-white text-sm">
                      {new Date(externalTrackingResult.scheduled_at).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </strong>
                    <p className="text-slate-400">
                      {new Date(externalTrackingResult.scheduled_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      ({externalTrackingResult.duration_minutes} mins)
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 block mb-0.5">Department:</span>
                    <strong className="text-white">{externalTrackingResult.department}</strong>
                  </div>

                  <div>
                    <span className="text-slate-500 block mb-0.5">Clinic Contact Phone:</span>
                    <strong className="text-white">{externalTrackingResult.contact_phone || 'None recorded'}</strong>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 text-xs text-slate-300">
                  <p className="italic text-slate-400">Reason: "{externalTrackingResult.reason}"</p>
                  {externalTrackingResult.notes && (
                    <p className="text-[11px] text-slate-500 mt-1">Notes: {externalTrackingResult.notes}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Patient-Entered External Appointments List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">My External Hospital Appointments</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {externalAppointments.length} recorded
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Consultations logged by you with outside medical networks (Mayo Clinic, Cleveland Clinic, regional providers).
                </p>
              </div>
              <button
                onClick={() => {
                  setExternalApptToEdit(null)
                  setIsManualExternalOpen(true)
                }}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> + Manual Entry
              </button>
            </div>

            {isLoadingExternalAppts ? (
              <div className="py-12 flex justify-center text-slate-500 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading external records...
              </div>
            ) : externalAppointments.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800/80">
                <p className="text-slate-400 mb-2 font-medium">No external appointments recorded yet.</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto mb-4">
                  Keep all your healthcare records organized by manually logging consultations scheduled outside MediCare Central.
                </p>
                <button
                  onClick={() => setIsManualExternalOpen(true)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
                >
                  Log External Appointment
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {externalAppointments.map((ext) => (
                  <div
                    key={ext.id}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white text-sm">{ext.hospital_name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          Patient-entered / External appointment
                        </span>
                        <span className="font-mono text-xs text-slate-400">Ref: {ext.appointment_reference}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                        <span className="font-semibold text-blue-400">{ext.doctor_name}</span>
                        <span className="text-slate-400">&bull; {ext.department}</span>
                        <span className="text-slate-400">
                          &bull;{' '}
                          {new Date(ext.scheduled_at).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}{' '}
                          at{' '}
                          {new Date(ext.scheduled_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 italic">"{ext.reason}"</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setTrackRefNumber(ext.appointment_reference)
                          setExternalTrackingResult(ext)
                          setTrackMode('reference')
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium cursor-pointer"
                      >
                        Track
                      </button>
                      <button
                        onClick={() => {
                          setExternalApptToEdit(ext)
                          setIsManualExternalOpen(true)
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                        title="Edit Record"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Delete external appointment at ${ext.hospital_name}?`)) {
                            try {
                              await api.delete(`/api/v1/appointments/external/${ext.id}`)
                              success('External appointment removed.')
                              loadExternalAppointments()
                              loadDashboardStats()
                            } catch {
                              toastError('Failed to delete external appointment.')
                            }
                          }
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 border border-rose-500/20 cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── View 5: Hospital & Emergency Contacts ───────────────────────── */}
      {activeView === 'contacts' && (
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Consistent Action Area (Matching Proposed Layout in Image 4) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg md:text-xl font-bold text-white">Hospital & Emergency Contacts</h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Directory
                </span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {hospitals.length} Facilities Available
              </span>
            </div>

            <button
              onClick={() => setIsAddHospitalOpen(true)}
              className="w-full py-3 bg-slate-950/60 hover:bg-emerald-600/10 border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 text-emerald-400 hover:text-emerald-300 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Hospital / Contact
            </button>
          </div>

          {/* Regional Network Hospitals & Partner Facilities Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  Regional Healthcare Facilities & Trauma Centers ({hospitals.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Verified hospital networks, Level 1 trauma centers, and tertiary referral clinics.
                </p>
              </div>
              <button
                onClick={loadHospitals}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHospitals ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {hospitals.map((hosp) => (
                <div
                  key={hosp.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-5 shadow-lg backdrop-blur-md flex flex-col justify-between transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {hosp.hospital_type}
                          </span>
                          {hosp.is_verified && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> Verified Network
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-white">{hosp.name}</h4>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span>{hosp.address}, {hosp.city}, {hosp.state} {hosp.zip_code}</span>
                    </div>

                    {/* Emergency Hotline Box */}
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-rose-300 font-bold uppercase block">
                          24/7 Emergency & Trauma Hotline
                        </span>
                        <a
                          href={`tel:${hosp.emergency_phone.replace(/[^0-9]/g, '')}`}
                          className="text-sm font-extrabold text-white hover:text-rose-200 transition-colors flex items-center gap-1.5 mt-0.5"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                          {hosp.emergency_phone}
                        </a>
                      </div>
                      <a
                        href={`tel:${hosp.emergency_phone.replace(/[^0-9]/g, '')}`}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shrink-0"
                      >
                        Call Now
                      </a>
                    </div>

                    {/* General Switchboard */}
                    <div className="flex items-center justify-between text-xs py-1 px-1 border-t border-slate-800/80">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500" /> Switchboard:
                      </span>
                      <a
                        href={`tel:${hosp.phone.replace(/[^0-9]/g, '')}`}
                        className="font-semibold text-slate-200 hover:text-blue-400 transition-colors"
                      >
                        {hosp.phone}
                      </a>
                    </div>

                    {/* Departments available */}
                    {hosp.departments_available && (
                      <div className="pt-1">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-1.5">
                          Key Clinical Units:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {hosp.departments_available.split(',').map((unit, uIdx) => (
                            <span
                              key={uIdx}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 border border-slate-800"
                            >
                              {unit.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                    <span>Hours: {hosp.operating_hours}</span>
                    <span className="text-emerald-400 font-medium">Accepting Patients</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main MediCare Central Academic Pavilion & Triage Guidance Card */}
          <div className="bg-gradient-to-br from-slate-900/90 to-blue-950/40 border border-blue-500/20 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
              <div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-block mb-2">
                  Academic Medical Center & Level 1 Trauma
                </span>
                <h2 className="text-2xl font-extrabold text-white">
                  {hospitalInfo?.hospital_name || 'MediCare Central Hospital & Academic Medical Center'}
                </h2>
                <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-xl">
                  {hospitalInfo?.address || '500 Healthcare Blvd, North Pavilion, Suite 100, New York, NY 10001'}
                </p>
              </div>

              {/* Emergency Hotline Box */}
              <div className="bg-rose-950/60 border border-rose-500/40 rounded-2xl p-4 text-center shrink-0 shadow-lg">
                <span className="text-xs text-rose-300 font-bold block mb-1">24/7 Level 1 Trauma Center</span>
                <a
                  href="tel:5550199911"
                  className="text-lg md:text-xl font-extrabold text-white hover:text-rose-200 transition-colors flex items-center justify-center gap-2"
                >
                  <PhoneCall className="w-5 h-5 text-rose-400 animate-pulse" />
                  {hospitalInfo?.emergency_hotline || '911 / (555) 019-9911'}
                </a>
              </div>
            </div>

            {/* Quick Contacts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 text-xs text-slate-300">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-500 block mb-1">General Switchboard</span>
                <a
                  href={`tel:${hospitalInfo?.main_phone?.replace(/[^0-9]/g, '') || '5550192000'}`}
                  className="text-sm font-bold text-white hover:text-blue-400 transition-colors flex items-center gap-2"
                >
                  <Phone className="w-4 h-4 text-blue-400" />
                  {hospitalInfo?.main_phone || '(555) 019-2000'}
                </a>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-500 block mb-1">General Email</span>
                <a
                  href={`mailto:${hospitalInfo?.general_email || 'contact@medicare.ai'}`}
                  className="text-sm font-bold text-white hover:text-blue-400 transition-colors flex items-center gap-2 truncate"
                >
                  <Mail className="w-4 h-4 text-blue-400" />
                  {hospitalInfo?.general_email || 'contact@medicare.ai'}
                </a>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 sm:col-span-2">
                <span className="text-slate-500 block mb-1">Working & Clinical Hours</span>
                <p className="text-slate-200 font-medium">
                  {hospitalInfo?.working_hours || 'Emergency: 24/7/365 | Outpatient: Mon-Fri 8:00 AM - 6:00 PM'}
                </p>
              </div>
            </div>

            {/* Triage Guidance */}
            <div className="mt-6 p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Clinical Triage Guidance:</strong>{' '}
                {hospitalInfo?.emergency_triage_guidance ||
                  'If you are experiencing acute chest pain, sudden numbness, difficulty speaking, severe shortness of breath, or uncontrolled bleeding, please call 911 immediately.'}
              </div>
            </div>
          </div>

          {/* All 28 Department Extensions Directory */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-400" />
              Department Extension & Direct Line Directory (All 28)
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Contact any hospital clinical department directly during operating hours for referrals, lab reviews, or follow-ups.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[11px] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Department / Specialty</th>
                    <th className="py-3 px-4">Chief Clinician</th>
                    <th className="py-3 px-4">Pavilion Location</th>
                    <th className="py-3 px-4">Direct Contact</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {departments.map((d) => (
                    <tr key={d.name} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span className="font-mono text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                            {d.code}
                          </span>
                          {d.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{d.head_of_department || 'Dr. Department Chair'}</td>
                      <td className="py-3 px-4 text-slate-400">{d.location || 'North Pavilion'}</td>
                      <td className="py-3 px-4">
                        <a
                          href={`tel:${(d.phone || '').replace(/[^0-9]/g, '')}`}
                          className="text-blue-400 hover:text-white transition-colors"
                        >
                          {d.phone || '(555) 019-2800'}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleSelectDepartmentForBooking(d)}
                          className="px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs font-semibold transition-all"
                        >
                          Book &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 6-Step Appointment Booking Wizard Modal ──────────────────────── */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header & Progress */}
            <div className="p-6 bg-slate-900/90 border-b border-slate-800">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Book a Clinical Appointment</h3>
                    <p className="text-xs text-slate-400">
                      Step {wizardStep} of 6 •{' '}
                      {wizardStep === 1
                        ? 'Select Medical Specialty'
                        : wizardStep === 2
                        ? 'Choose Attending Physician'
                        : wizardStep === 3
                        ? 'Select Appointment Type'
                        : wizardStep === 4
                        ? 'Choose Date & Time Slot'
                        : wizardStep === 5
                        ? 'Patient Consultation Information'
                        : wizardStep === 6
                        ? 'Review & Confirm Booking'
                        : 'Booking Confirmed!'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsBookingOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Steps Indicator */}
              {wizardStep <= 6 && (
                <div className="grid grid-cols-6 gap-2 pt-2">
                  {[
                    { s: 1, label: 'Department' },
                    { s: 2, label: 'Doctor' },
                    { s: 3, label: 'Type' },
                    { s: 4, label: 'Slot' },
                    { s: 5, label: 'Patient Info' },
                    { s: 6, label: 'Review' },
                  ].map((step) => (
                    <div key={step.s} className="text-center">
                      <div
                        className={`h-1.5 rounded-full mb-1 transition-all ${
                          wizardStep >= step.s ? 'bg-blue-500' : 'bg-slate-800'
                        }`}
                      />
                      <span
                        className={`text-[10px] font-medium hidden sm:block ${
                          wizardStep === step.s ? 'text-blue-400 font-bold' : 'text-slate-500'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Selected Physician Banner across Steps 3 to 6 */}
              {bookingDoctor && wizardStep >= 3 && wizardStep <= 6 && (
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg animate-in fade-in duration-200">
                  <div className="flex items-center gap-3.5">
                    <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-extrabold text-white text-base shadow-md shrink-0">
                      {getDoctorInitials(bookingDoctor.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-white text-sm">
                          {cleanDoctorName(bookingDoctor.name)}
                        </h4>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                          {bookingDoctor.specialty}
                        </span>
                        <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          ${bookingDoctor.consultation_fee}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {bookingDoctor.qualifications} • {bookingDoctor.experience_years} yrs exp • {bookingDoctor.hospital_affiliation}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-amber-400 font-semibold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          {bookingDoctor.rating} ({bookingDoctor.review_count} reviews)
                        </span>
                        {bookingDoctor.languages && (
                          <span>Languages: {bookingDoctor.languages}</span>
                        )}
                        <span>Schedule: {bookingDoctor.working_days?.join(', ') || 'Mon-Fri'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold hover:underline shrink-0 flex items-center gap-1"
                  >
                    Change Physician &rarr;
                  </button>
                </div>
              )}

              {/* STEP 1: Select Department */}
              {wizardStep === 1 && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Select Medical Specialty or Department:
                      </h4>
                      <p className="text-xs text-slate-400">
                        Choose from 28 hospital clinical departments.
                      </p>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search specialties..."
                        value={modalDeptSearch}
                        onChange={(e) => setModalDeptSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {departments
                      .filter(
                        (d) =>
                          !modalDeptSearch.trim() ||
                          d.name.toLowerCase().includes(modalDeptSearch.toLowerCase()) ||
                          (d.description || '').toLowerCase().includes(modalDeptSearch.toLowerCase())
                      )
                      .map((dept) => {
                        const isSelected = bookingDepartment?.name === dept.name
                        return (
                          <div
                            key={dept.name}
                            onClick={() => {
                              setBookingDepartment(dept)
                              setWizardStep(2)
                            }}
                            className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${
                              isSelected
                                ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg'
                                : 'bg-slate-900/60 border-slate-800 hover:border-blue-500/50 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 mb-1.5">
                              <div className="text-blue-400">{getDepartmentIcon(dept.icon)}</div>
                              <span className="font-bold text-xs">{dept.name}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2">
                              {dept.description}
                            </p>
                            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                              <span>{dept.doctor_count || 1} available</span>
                              <span className="text-blue-400 font-semibold flex items-center gap-0.5">
                                Select &rarr;
                              </span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* STEP 2: Select Doctor */}
              {wizardStep === 2 && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Select Physician in {bookingDepartment?.name || 'All Specialties'}:
                      </h4>
                      <p className="text-xs text-slate-400">
                        Choose your preferred clinician based on ratings, credentials, and availability.
                      </p>
                    </div>
                    {bookingDepartment && (
                      <button
                        type="button"
                        onClick={() => setBookingDepartment(null)}
                        className="text-xs text-blue-400 hover:underline"
                      >
                        Show all specialties
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {doctors
                      .filter(
                        (d) =>
                          !bookingDepartment ||
                          d.department === bookingDepartment.name ||
                          d.specialty === bookingDepartment.name
                      )
                      .map((doc) => {
                        const isSelected = bookingDoctor?.id === doc.id
                        return (
                          <div
                            key={doc.id}
                            onClick={() => {
                              setBookingDoctor(doc)
                              if (!bookingDepartment) {
                                const m = departments.find(
                                  (d) => d.name === doc.specialty || d.name === doc.department
                                )
                                if (m) setBookingDepartment(m)
                              }
                              setWizardStep(3)
                            }}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] ${
                              isSelected
                                ? 'bg-blue-600/20 border-blue-500 shadow-xl'
                                : 'bg-slate-900/60 border-slate-800 hover:border-blue-500/50'
                            }`}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm shrink-0">
                                {getDoctorInitials(doc.name)}
                              </div>
                              <div>
                                <h5 className="font-bold text-sm text-white">
                                  {cleanDoctorName(doc.name)}
                                </h5>
                                <p className="text-xs text-blue-400">{doc.specialty}</p>
                                <p className="text-[11px] text-slate-400">{doc.qualifications}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                              <span className="flex items-center gap-1 text-amber-400 font-bold">
                                <Star className="w-3.5 h-3.5 fill-amber-400" />
                                {doc.rating} ({doc.review_count})
                              </span>
                              <span>{doc.experience_years} yrs exp</span>
                              <span className="text-emerald-400 font-bold">${doc.consultation_fee}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-end text-xs text-blue-400 font-semibold">
                              <span>Select Physician &rarr;</span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* STEP 3: Select Consultation Type */}
              {wizardStep === 3 && (
                <div>
                  <h4 className="text-sm font-bold text-white mb-2">
                    Select Consultation Modality:
                  </h4>
                  <p className="text-xs text-slate-400 mb-6">
                    Choose between an in-person hospital exam, secure video consultation, or emergency guidance.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {[
                      {
                        type: 'in_person',
                        title: 'In-Person Consultation',
                        desc: 'Full clinical physical examination at MediCare Hospital Examination Suites.',
                        icon: Building,
                      },
                      {
                        type: 'telehealth',
                        title: 'Video Consultation / Telehealth',
                        desc: 'Encrypted HD telehealth video suite with electronic prescription generation.',
                        icon: Video,
                      },
                      {
                        type: 'follow_up',
                        title: 'Follow-Up Consultation',
                        desc: 'Review laboratory biomarkers, medication titration, and symptom progression.',
                        icon: CalendarCheck,
                      },
                      {
                        type: 'emergency',
                        title: 'Emergency Consultation',
                        desc: 'Urgent priority review for severe symptomatic flare-ups.',
                        icon: Flame,
                      },
                    ].map((item) => {
                      const isSelected = bookingType === item.type
                      const IconComp = item.icon
                      return (
                        <div
                          key={item.type}
                          onClick={() => setBookingType(item.type as any)}
                          className={`p-5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 shadow-xl'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div
                            className={`p-2.5 rounded-xl ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <IconComp className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="font-bold text-sm text-white mb-1">{item.title}</h5>
                            <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {bookingType === 'emergency' && (
                    <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-3">
                      <Flame className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>Emergency Guidance:</strong> If you are experiencing acute chest pain, shortness of breath, sudden numbness, or bleeding, call{' '}
                        <a href="tel:911" className="underline font-bold text-white">
                          911
                        </a>{' '}
                        or proceed directly to our ground-floor Level 1 Trauma Center immediately.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Select Date and Time Slot */}
              {wizardStep === 4 && (
                <div>
                  <h4 className="text-sm font-bold text-white mb-2">
                    Select Appointment Date & Time Slot:
                  </h4>
                  <p className="text-xs text-slate-400 mb-4">
                    Slots reflect real-time hospital schedules. Double-booking is automatically prevented.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Date Picker */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Choose Consultation Date:
                      </label>
                      <input
                        type="date"
                        value={bookingDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />

                      {bookingDoctor && (
                        <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400">
                          <strong className="text-white block mb-1">Doctor Shifts:</strong>
                          <span>Working Days: {bookingDoctor.working_days?.join(', ') || 'Mon-Fri'}</span>
                          <span className="block mt-1">Location: {bookingDoctor.office_location}</span>
                        </div>
                      )}
                    </div>

                    {/* Slots Grid */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Available Clinical Slots for {bookingDate}:
                      </label>

                      {isLoadingSlots ? (
                        <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center">
                          <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                          <span className="text-xs">Checking real-time doctor availability...</span>
                        </div>
                      ) : bookingSlots.length === 0 ? (
                        <div className="py-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 p-4">
                          <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                          <p className="text-xs text-slate-400">
                            No open slots available on this date. Please select another weekday or view suggested dates.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {bookingSlots.map((slot) => {
                            const isSelected = selectedSlot?.start_time === slot.start_time
                            return (
                              <button
                                key={slot.start_time}
                                disabled={!slot.is_available}
                                onClick={() => setSelectedSlot(slot)}
                                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all text-center ${
                                  !slot.is_available
                                    ? 'bg-slate-950 text-slate-600 border border-slate-800/60 cursor-not-allowed line-through'
                                    : isSelected
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400'
                                    : 'bg-slate-900 border border-slate-700/80 text-slate-200 hover:border-blue-500'
                                }`}
                              >
                                {slot.time_display || slot.start_time}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Patient Consultation Information (18+ Fields) */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">
                      Patient Consultation Information
                    </h4>
                    <p className="text-xs text-slate-400 mb-4">
                      Please verify patient demographics, clinical symptoms, and referral sources.
                    </p>
                  </div>

                  {/* Reference Number Preview */}
                  <div className="p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl flex items-center justify-between text-xs text-blue-200">
                    <span>
                      Generated Reference Code Preview:{' '}
                      <strong className="font-mono text-cyan-300">MED-2026-AUTOGEN</strong>
                    </span>
                    <span className="text-[11px] text-slate-400">Unique DB Key</span>
                  </div>

                  {/* Core Demographics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Patient Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Alice Johnson"
                        value={patientFullName}
                        onChange={(e) => setPatientFullName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Date of Birth *
                      </label>
                      <input
                        type="date"
                        value={patientDob}
                        onChange={(e) => setPatientDob(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Patient MRN / ID (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="MRN-00000012"
                        value={patientMrn}
                        onChange={(e) => setPatientMrn(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Contact Phone Number *
                      </label>
                      <input
                        type="tel"
                        placeholder="(555) 019-1234"
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        placeholder="patient@example.com"
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Residential Address (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Street address, city, state, zip"
                      value={patientAddress}
                      onChange={(e) => setPatientAddress(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Reason for Consultation */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Primary Reason for Consultation * (min 5 characters)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Describe symptoms, concerns, or consultation goals..."
                      value={consultReason}
                      onChange={(e) => setConsultReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Clinical Background (Optional) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                        Existing Conditions
                        <span className="text-[10px] text-slate-500 font-normal">Optional</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Hypertension, Diabetes"
                        value={existingConditions}
                        onChange={(e) => setExistingConditions(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                        Current Medications
                        <span className="text-[10px] text-slate-500 font-normal">Optional</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Lisinopril 10mg"
                        value={currentMedications}
                        onChange={(e) => setCurrentMedications(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                        Known Allergies
                        <span className="text-[10px] text-slate-500 font-normal">Optional</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Penicillin, Sulfa"
                        value={allergies}
                        onChange={(e) => setAllergies(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Referral Source */}
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Referred By
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {(['self_referral', 'doctor', 'hospital', 'other'] as const).map((source) => (
                        <button
                          key={source}
                          type="button"
                          onClick={() => setReferralSource(source)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                            referralSource === source
                              ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {source.replace('_', ' ')}
                        </button>
                      ))}
                    </div>

                    {referralSource === 'doctor' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Referring Doctor Name
                          </label>
                          <input
                            type="text"
                            placeholder="Dr. Full Name"
                            value={referringDoctorName}
                            onChange={(e) => setReferringDoctorName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Doctor Phone
                          </label>
                          <input
                            type="tel"
                            placeholder="(555) 000-0000"
                            value={referringDoctorPhone}
                            onChange={(e) => setReferringDoctorPhone(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Doctor Email
                          </label>
                          <input
                            type="email"
                            placeholder="doc@clinic.com"
                            value={referringDoctorEmail}
                            onChange={(e) => setReferringDoctorEmail(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 6: Review and Confirm Booking */}
              {wizardStep === 6 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white mb-2">
                    Review and Confirm Appointment Details:
                  </h4>

                  <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 text-xs">
                    {/* Doctor & Dept */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <span className="text-slate-500 block">Attending Physician & Specialty:</span>
                        <strong className="text-white text-sm">
                          {cleanDoctorName(bookingDoctor?.name)}
                        </strong>
                        <p className="text-blue-400">
                          {bookingDepartment?.name || bookingDoctor?.specialty}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block">Consultation Fee:</span>
                        <strong className="text-emerald-400 text-sm">
                          ${bookingDoctor?.consultation_fee || 120}.00
                        </strong>
                      </div>
                    </div>

                    {/* Date, Time, Type */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-slate-500 block mb-0.5">Date:</span>
                        <strong className="text-slate-200">{bookingDate}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">Time:</span>
                        <strong className="text-slate-200">
                          {selectedSlot?.time_display || selectedSlot?.start_time} (30 mins)
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">Consultation Type:</span>
                        <strong className="text-slate-200 capitalize">
                          {bookingType.replace('_', ' ')}
                        </strong>
                      </div>
                    </div>

                    {/* Patient & Contact Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-500 block mb-0.5">Patient:</span>
                        <strong className="text-slate-200">{patientFullName || 'Self'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">Phone:</span>
                        <strong className="text-slate-200">{patientPhone || 'On File'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">Email:</span>
                        <strong className="text-slate-200 truncate block">{patientEmail || 'On File'}</strong>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-slate-500 block mb-0.5">Reason for Consultation:</span>
                      <p className="text-slate-300 italic">"{consultReason}"</p>
                    </div>
                  </div>

                  {/* Consent checkbox */}
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clinicalConsent}
                      onChange={(e) => setClinicalConsent(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      I confirm that the provided medical consultation details are accurate and I consent to MediCare AI's clinical appointment terms and electronic health notifications.
                    </span>
                  </label>
                </div>
              )}

              {/* STEP 7: Booking Confirmed Screen */}
              {wizardStep === 7 && confirmedBookingData && (
                <div className="text-center py-6 space-y-6">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                    <CheckCheck className="w-8 h-8" />
                  </div>

                  <div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block mb-1">
                      Confirmed & Saved to Database
                    </span>
                    <h3 className="text-2xl font-extrabold text-white">
                      Appointment Confirmed!
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                      Your clinical consultation has been secured. Your unique reference number is required for tracking and check-in.
                    </p>
                  </div>

                  {/* Reference Number Banner with Copy */}
                  <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-950 border border-blue-500/40 flex items-center justify-between gap-3 shadow-lg">
                    <div className="text-left">
                      <span className="text-[11px] text-slate-500 uppercase font-semibold block">
                        Unique Appointment Reference:
                      </span>
                      <strong className="font-mono text-lg text-cyan-300">
                        {confirmedBookingData.booking_reference}
                      </strong>
                    </div>

                    <button
                      onClick={() => copyToClipboard(confirmedBookingData.booking_reference)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      {copiedRef ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      {copiedRef ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Summary Card */}
                  <div className="max-w-md mx-auto p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-left text-xs space-y-2 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Patient Full Name:</span>
                      <strong className="text-white">{confirmedBookingData.patient_name || patientFullName || 'Verified Patient'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Attending Doctor:</span>
                      <strong className="text-white">{cleanDoctorName(confirmedBookingData.doctor_name)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Department:</span>
                      <span>{confirmedBookingData.doctor_specialty || confirmedBookingData.doctor_department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Consultation Modality:</span>
                      <span className="capitalize">{confirmedBookingData.appointment_type === 'telehealth' ? 'Encrypted Video Suite' : 'In-Person Examination'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Scheduled Date & Time:</span>
                      <strong className="text-white">
                        {new Date(confirmedBookingData.scheduled_at).toLocaleDateString()} at{' '}
                        {new Date(confirmedBookingData.scheduled_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hospital Facility:</span>
                      <span>742 Evergreen Terrace, Medical District</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Main Hospital Desk:</span>
                      <a href="tel:5550192000" className="text-blue-400 hover:underline">+1 (555) 019-2000</a>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px]">
                      <span className="text-rose-400">24/7 Trauma Emergency:</span>
                      <span className="text-rose-300 font-bold">911 / (555) 019-9911</span>
                    </div>
                  </div>

                  {/* Confirmation Actions */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadCalendarInvite({
                          reference: confirmedBookingData.booking_reference,
                          doctorName: confirmedBookingData.doctor_name,
                          specialty: confirmedBookingData.doctor_specialty,
                          scheduledAt: confirmedBookingData.scheduled_at,
                          durationMinutes: confirmedBookingData.duration_minutes,
                          location: confirmedBookingData.room || 'MediCare Hospital',
                          reason: confirmedBookingData.reason,
                        })
                      }
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all"
                    >
                      <Calendar className="w-4 h-4 text-blue-400" />
                      Add to Calendar (.ics)
                    </button>

                    <button
                      type="button"
                      onClick={() => setReceiptAppt(confirmedBookingData)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all"
                    >
                      <Printer className="w-4 h-4 text-cyan-400" />
                      Print / Download PDF Confirmation
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsBookingOpen(false)
                        setActiveView('appointments')
                      }}
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg transition-all"
                    >
                      View in My Appointments
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            {wizardStep <= 6 && (
              <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (wizardStep === 1) setIsBookingOpen(false)
                    else setWizardStep(wizardStep - 1)
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  {wizardStep === 1 ? 'Cancel' : 'Back'}
                </button>

                {wizardStep < 6 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 1 && !bookingDepartment) {
                        toastError('Please select a department to proceed.')
                        return
                      }
                      if (wizardStep === 2 && !bookingDoctor) {
                        toastError('Please select an attending physician.')
                        return
                      }
                      if (wizardStep === 4 && !selectedSlot) {
                        toastError('Please select a consultation time slot.')
                        return
                      }
                      if (wizardStep === 5) {
                        if (!patientFullName.trim()) {
                          toastError('Please enter the patient legal full name.')
                          return
                        }
                        if (!patientPhone.trim()) {
                          toastError('Please enter a valid contact telephone number.')
                          return
                        }
                        if (!consultReason.trim() || consultReason.trim().length < 5) {
                          toastError('Please enter a clinical reason (min 5 chars).')
                          return
                        }
                      }
                      setWizardStep(wizardStep + 1)
                    }}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmBooking}
                    disabled={isSubmittingBooking}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
                  >
                    {isSubmittingBooking ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Confirming Booking...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Confirm & Book Appointment
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Doctor Reviews Modal ─────────────────────────────────────────── */}
      {isReviewModalOpen && activeReviewDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm">
                  {getDoctorInitials(activeReviewDoctor.name)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Patient Reviews for {cleanDoctorName(activeReviewDoctor.name)}
                  </h3>
                  <p className="text-xs text-blue-400 font-medium">{activeReviewDoctor.specialty}</p>
                </div>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
              {/* Star Distribution Summary Card */}
              {doctorReviewsData && (
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                  <div className="text-center sm:border-r sm:border-slate-800 sm:pr-6">
                    <span className="text-4xl font-extrabold text-white">
                      {doctorReviewsData.average_rating}
                    </span>
                    <div className="flex items-center justify-center gap-1 my-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= Math.round(doctorReviewsData.average_rating)
                              ? 'fill-amber-400'
                              : 'text-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-500">
                      Based on {doctorReviewsData.total_reviews} verified reviews
                    </span>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5 text-xs text-slate-400">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = doctorReviewsData.rating_distribution[String(stars)] || 0
                      const pct =
                        doctorReviewsData.total_reviews > 0
                          ? Math.round((count / doctorReviewsData.total_reviews) * 100)
                          : 0
                      return (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="w-12 text-slate-400 shrink-0">{stars} Stars</span>
                          <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-right text-slate-500">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Submit Feedback Form */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Submit Verified Patient Review
                </h4>

                {/* Appointment select if completed */}
                {completedAppointmentsList.length > 0 && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Link to Completed Appointment (Optional):
                    </label>
                    <select
                      value={newReviewApptId}
                      onChange={(e) => setNewReviewApptId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white"
                    >
                      <option value="">Verified Patient Review (General)</option>
                      {completedAppointmentsList.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.booking_reference} — {new Date(a.scheduled_at).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Star rating selector */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Star Rating:</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewReviewRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= newReviewRating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-700 hover:text-amber-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs text-amber-400 font-bold ml-2">
                      {newReviewRating} / 5 Stars
                    </span>
                  </div>
                </div>

                {/* Review text */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Your Patient Feedback * (min 5 chars):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe physician communication, bedside manner, explanation of treatment..."
                    value={newReviewText}
                    onChange={(e) => setNewReviewText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSubmitReview}
                    disabled={isSubmittingReview}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    {isSubmittingReview ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Submit Review
                  </button>
                </div>
              </div>

              {/* Reviews List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Recent Patient Feedback ({doctorReviewsData?.reviews.length || 0})
                </h4>

                {isLoadingReviews ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading feedback...
                  </div>
                ) : !doctorReviewsData || doctorReviewsData.reviews.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                    No patient reviews have been submitted for this physician yet. Be the first to share your experience!
                  </div>
                ) : (
                  doctorReviewsData.reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-200">{rev.patient_display_name}</strong>
                          {rev.is_verified_appointment && (
                            <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Verified Appointment
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= rev.rating ? 'fill-amber-400' : 'text-slate-800'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <p className="text-slate-300 leading-relaxed italic">
                        "{rev.review_text}"
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                        <span>
                          {new Date(rev.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <button
                          onClick={() => handleDeleteReview(rev.id)}
                          className="text-rose-400 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Doctor Comparison Modal (Side-by-Side) ────────────────────────── */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Scale className="w-5 h-5 text-cyan-400" />
                  Physician Side-by-Side Comparison
                </h3>
                <p className="text-xs text-slate-400">
                  Compare credentials, patient reviews, fees, and next available dates.
                </p>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-x-auto">
              {comparedDoctorsList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  No doctors currently selected for comparison. Please check 2-3 physicians from the directory.
                </p>
              ) : (
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${comparedDoctorsList.length}, minmax(240px, 1fr))`,
                  }}
                >
                  {comparedDoctorsList.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs"
                    >
                      {/* Doctor Header */}
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-lg mx-auto mb-2 shadow-lg">
                          {getDoctorInitials(doc.name)}
                        </div>
                        <h4 className="font-bold text-white text-sm">{cleanDoctorName(doc.name)}</h4>
                        <p className="text-blue-400 font-medium">{doc.specialty}</p>
                      </div>

                      {/* Criteria */}
                      <div className="space-y-3 pt-3 border-t border-slate-800">
                        <div>
                          <span className="text-slate-500 block text-[11px]">Qualifications:</span>
                          <strong className="text-slate-200">{doc.qualifications}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Experience:</span>
                          <strong className="text-slate-200">{doc.experience_years} Years</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Consultation Fee:</span>
                          <strong className="text-emerald-400 text-sm">${doc.consultation_fee}.00</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Patient Rating:</span>
                          <div className="flex items-center gap-1 text-amber-400 font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            <span>{doc.rating} / 5.0</span>
                            <span className="text-slate-500 text-[11px]">({doc.review_count} reviews)</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Languages:</span>
                          <span className="text-slate-300">{doc.languages}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Next Slot:</span>
                          <span className="text-cyan-300 font-semibold">
                            {doc.earliest_available_date || 'Open Booking'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setIsCompareModalOpen(false)
                          handleSelectDoctorForBooking(doc)
                        }}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition-all"
                      >
                        Book Consultation
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Appointment Details Modal ────────────────────────────────────── */}
      {selectedApptDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded">
                  {selectedApptDetails.booking_reference}
                </span>
                <h3 className="text-base font-bold text-white mt-1">Clinical Appointment Details</h3>
              </div>
              <button
                onClick={() => setSelectedApptDetails(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 block">Physician:</span>
                  <strong className="text-white text-sm">
                    {cleanDoctorName(selectedApptDetails.doctor_name)}
                  </strong>
                  <p className="text-blue-400">{selectedApptDetails.doctor_specialty}</p>
                </div>
                <div>
                  <span className="text-slate-500 block">Date & Time:</span>
                  <strong className="text-white">
                    {new Date(selectedApptDetails.scheduled_at).toLocaleDateString()} at{' '}
                    {new Date(selectedApptDetails.scheduled_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1.5">
                <div>
                  <span className="text-slate-500">Reason for Consultation:</span>
                  <p className="text-slate-200 italic">"{selectedApptDetails.reason}"</p>
                </div>
                {selectedApptDetails.existing_conditions && (
                  <div>
                    <span className="text-slate-500">Existing Conditions:</span>
                    <p className="text-slate-200">{selectedApptDetails.existing_conditions}</p>
                  </div>
                )}
                {selectedApptDetails.current_medications && (
                  <div>
                    <span className="text-slate-500">Current Medications:</span>
                    <p className="text-slate-200">{selectedApptDetails.current_medications}</p>
                  </div>
                )}
                {selectedApptDetails.allergies && (
                  <div>
                    <span className="text-slate-500">Allergies:</span>
                    <p className="text-rose-300">{selectedApptDetails.allergies}</p>
                  </div>
                )}
                {selectedApptDetails.referral_source && (
                  <div>
                    <span className="text-slate-500">Referral Source:</span>
                    <p className="text-slate-200 capitalize">
                      {selectedApptDetails.referral_source.replace('_', ' ')}
                      {selectedApptDetails.referring_doctor_name && (
                        <span> — Ref Doc: {selectedApptDetails.referring_doctor_name}</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReceiptAppt(selectedApptDetails)
                    setSelectedApptDetails(null)
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / PDF Slip
                </button>
                {selectedApptDetails.is_upcoming && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenEditModal(selectedApptDetails)
                        setSelectedApptDetails(null)
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-xl flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3 text-blue-400" />
                      Edit Details
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReschedulingAppt(selectedApptDetails)
                        setRescheduleDate(safeDateOnly(selectedApptDetails.scheduled_at))
                        setSelectedApptDetails(null)
                      }}
                      className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-xs font-medium rounded-xl"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCancellingAppt(selectedApptDetails)
                        setSelectedApptDetails(null)
                      }}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 border border-rose-500/20 text-xs font-medium rounded-xl"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedApptDetails(null)}
                className="px-4 py-1.5 bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Printable Confirmation Receipt Modal ─────────────────────────── */}
      {receiptAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white">
          <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 md:p-8 space-y-6 my-8 print:border-none print:shadow-none print:bg-white print:text-black">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 print:border-black">
              <div>
                <h3 className="text-lg font-bold text-white print:text-black flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-500" />
                  MediCare AI Hospital System
                </h3>
                <p className="text-xs text-slate-400 print:text-gray-600">
                  Official Outpatient Appointment Confirmation
                </p>
              </div>
              <button
                onClick={() => setReceiptAppt(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white print:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reference & QR simulation */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between print:bg-gray-100 print:border-gray-300">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Appointment Reference
                </span>
                <strong className="font-mono text-base text-cyan-400 print:text-black">
                  {receiptAppt.booking_reference}
                </strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Status</span>
                <span className="text-xs font-bold text-emerald-400 uppercase print:text-green-700">
                  {receiptAppt.status}
                </span>
              </div>
            </div>

            {/* Receipt Summary Items */}
            <div className="space-y-3 text-xs text-slate-300 print:text-black">
              <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-gray-200">
                <span className="text-slate-400 print:text-gray-600">Patient:</span>
                <strong className="text-white print:text-black">
                  {receiptAppt.patient_name || 'Verified Patient'}
                </strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-gray-200">
                <span className="text-slate-400 print:text-gray-600">Physician:</span>
                <strong className="text-white print:text-black">
                  {cleanDoctorName(receiptAppt.doctor_name)}
                </strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-gray-200">
                <span className="text-slate-400 print:text-gray-600">Specialty / Dept:</span>
                <span>{receiptAppt.doctor_specialty || receiptAppt.doctor_department}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-gray-200">
                <span className="text-slate-400 print:text-gray-600">Date & Time:</span>
                <strong className="text-white print:text-black">
                  {new Date(receiptAppt.scheduled_at).toLocaleDateString()} at{' '}
                  {new Date(receiptAppt.scheduled_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-gray-200">
                <span className="text-slate-400 print:text-gray-600">Location:</span>
                <span>
                  {receiptAppt.appointment_type === 'telehealth'
                    ? 'Virtual Video Consultation Suite'
                    : receiptAppt.room || receiptAppt.doctor_location || 'North Pavilion Room 302'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-gray-200">
                <span className="text-slate-400 print:text-gray-600">Consultation Fee:</span>
                <strong className="text-emerald-400 print:text-black">
                  ${receiptAppt.consultation_fee || 120}.00 (Pre-Authorized)
                </strong>
              </div>
            </div>

            {/* Print & Close Toolbar */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
              <button
                onClick={() => setReceiptAppt(null)}
                className="py-2.5 px-4 bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reschedule Modal ─────────────────────────────────────────────── */}
      {reschedulingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                Reschedule Consultation
              </h3>
              <button
                onClick={() => setReschedulingAppt(null)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Pick New Date:</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Open Slot:</label>
                {rescheduleSlots.length === 0 ? (
                  <p className="text-slate-500 py-3 text-center">No available slots on this date.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                    {rescheduleSlots.map((s) => (
                      <button
                        key={s.start_time}
                        disabled={!s.is_available}
                        onClick={() => setSelectedRescheduleSlot(s)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold ${
                          !s.is_available
                            ? 'bg-slate-950 text-slate-600 line-through'
                            : selectedRescheduleSlot?.start_time === s.start_time
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-900 border border-slate-700 text-slate-300'
                        }`}
                      >
                        {s.time_display || s.start_time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setReschedulingAppt(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReschedule}
                disabled={isSubmittingReschedule || !selectedRescheduleSlot}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl"
              >
                {isSubmittingReschedule ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Dialog Modal ──────────────────────────────────────────── */}
      {cancellingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-[#0b1527] border border-rose-500/30 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Cancel Appointment?</h3>
            </div>

            <p className="text-xs text-slate-400">
              Are you sure you want to cancel your consultation with{' '}
              <strong className="text-white">{cleanDoctorName(cancellingAppt.doctor_name)}</strong> on{' '}
              <strong className="text-white">
                {new Date(cancellingAppt.scheduled_at).toLocaleDateString()}
              </strong>
              ? This slot will immediately be made available to other patients.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reason for Cancellation (Optional):
              </label>
              <textarea
                rows={2}
                placeholder="Work schedule conflict, feeling better, travelling..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCancellingAppt(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Keep Appointment
              </button>
              <button
                onClick={handleExecuteCancellation}
                disabled={isCancelling}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Doctor Profile Details Modal ──────────────────────────────────── */}
      {selectedDoctorProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-extrabold text-white text-lg shadow-lg">
                  {getDoctorInitials(selectedDoctorProfile.name)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {cleanDoctorName(selectedDoctorProfile.name)}
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {selectedDoctorProfile.specialty}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedDoctorProfile.qualifications} • {selectedDoctorProfile.experience_years} Years Clinical Practice
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoctorProfile(null)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto text-xs text-slate-300">
              {/* Demonstration Note */}
              <div className="p-3 bg-blue-950/30 border border-blue-500/30 rounded-xl text-blue-300/80 text-[11px] flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  <strong>Clinical Demonstration Profile:</strong> Credentials, schedules, and reviews represent standard verification templates for institutional evaluation.
                </span>
              </div>

              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-center">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Patient Rating</span>
                  <div className="flex items-center justify-center gap-1 text-amber-400 font-extrabold text-base mt-0.5">
                    <Star className="w-4 h-4 fill-amber-400" />
                    <span>{selectedDoctorProfile.rating}</span>
                  </div>
                  <span className="text-slate-500 text-[10px]">({selectedDoctorProfile.review_count} reviews)</span>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-center">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Experience</span>
                  <span className="text-base font-extrabold text-white mt-0.5 block">{selectedDoctorProfile.experience_years} yrs</span>
                  <span className="text-slate-500 text-[10px]">Clinical Practice</span>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-center">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Consultation Fee</span>
                  <span className="text-base font-extrabold text-emerald-400 mt-0.5 block">${selectedDoctorProfile.consultation_fee}</span>
                  <span className="text-slate-500 text-[10px]">Standard Outpatient</span>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-center">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Availability</span>
                  <span className="text-xs font-bold text-cyan-300 mt-1 block">Active Clinic</span>
                  <span className="text-slate-500 text-[10px]">Next: Tomorrow</span>
                </div>
              </div>

              {/* Professional Biography */}
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-400" /> Professional Biography
                </h4>
                <p className="text-slate-300 leading-relaxed bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/80">
                  {selectedDoctorProfile.bio ||
                    `${cleanDoctorName(selectedDoctorProfile.name)} is an attending specialist with over ${selectedDoctorProfile.experience_years} years of institutional clinical experience specializing in ${selectedDoctorProfile.specialty}. Actively affiliated with ${selectedDoctorProfile.hospital_affiliation}.`}
                </p>
              </div>

              {/* Clinical Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-900/50 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-white block">Clinical Affiliations & Location</span>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hospital:</span>
                    <strong className="text-slate-200">{selectedDoctorProfile.hospital_affiliation}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Clinic Suite:</span>
                    <span>{selectedDoctorProfile.office_location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Working Days:</span>
                    <span>{selectedDoctorProfile.working_days?.join(', ') || 'Monday – Friday'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Languages:</span>
                    <span>{selectedDoctorProfile.languages}</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-900/50 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-white block">Direct Clinical Contact</span>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <a href={`tel:${(selectedDoctorProfile.phone || '').replace(/[^0-9]/g, '')}`} className="text-blue-400 hover:underline">
                      {selectedDoctorProfile.phone || '(555) 019-2800'}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <a href={`mailto:${selectedDoctorProfile.email}`} className="text-blue-400 hover:underline truncate">
                      {selectedDoctorProfile.email || 'doctor@medicare.health'}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Outpatient Pavilion, Wing B</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const doc = selectedDoctorProfile
                  setSelectedDoctorProfile(null)
                  handleOpenReviewsModal(doc)
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
              >
                <Star className="w-3.5 h-3.5 text-amber-400" />
                Read Reviews ({selectedDoctorProfile.review_count})
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDoctorProfile(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-medium"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const doc = selectedDoctorProfile
                    setSelectedDoctorProfile(null)
                    handleSelectDoctorForBooking(doc)
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition-all"
                >
                  Book Appointment with {cleanDoctorName(selectedDoctorProfile.name)}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Appointment Information Modal ───────────────────────────── */}
      {editingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 md:p-8 space-y-4 my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Appointment Information</h3>
                  <span className="text-xs font-mono text-cyan-400 font-semibold">
                    Ref: {editingAppt.booking_reference}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAppt(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSaveEditedAppointment()
              }}
              className="space-y-3.5 text-xs text-slate-300 max-h-[60vh] overflow-y-auto pr-1"
            >
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Reason for Consultation * (min 5 chars)
                </label>
                <textarea
                  rows={2}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  required
                  placeholder="Describe primary symptom or consultation objective..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Additional Clinical Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Any extra instructions for your attending physician..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Contact Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="(555) 000-0000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Contact Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="patient@example.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Residential Address (Optional)
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Street Address, City, State ZIP"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Existing Conditions (Optional)
                  </label>
                  <input
                    type="text"
                    value={editConditions}
                    onChange={(e) => setEditConditions(e.target.value)}
                    placeholder="Hypertension, Type 2 Diabetes..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Current Medications (Optional)
                  </label>
                  <input
                    type="text"
                    value={editMedications}
                    onChange={(e) => setEditMedications(e.target.value)}
                    placeholder="Lisinopril 10mg, Metformin 500mg..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Known Drug / Food Allergies (Optional)
                </label>
                <input
                  type="text"
                  value={editAllergies}
                  onChange={(e) => setEditAllergies(e.target.value)}
                  placeholder="Penicillin, Sulfa drugs, Peanuts, Latex..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAppt(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingAppt}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUpdatingAppt ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {isUpdatingAppt ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Admin & Staff: Add/Edit Specialty Modal ────────────────────── */}
      <SpecialtyModal
        isOpen={isAddSpecialtyOpen}
        onClose={() => {
          setIsAddSpecialtyOpen(false)
          setSpecialtyToEdit(null)
        }}
        onSuccess={(newSpec) => {
          loadDepartments()
          loadDashboardStats()
          success(specialtyToEdit ? `Specialty "${newSpec.name}" updated successfully!` : `Specialty "${newSpec.name}" added successfully!`)
          setSpecialtyToEdit(null)
        }}
        specialtyToEdit={specialtyToEdit}
      />

      {/* ── Admin & Staff: Register Attending Doctor Modal ──────────────── */}
      <DoctorModal
        isOpen={isAddDoctorOpen}
        onClose={() => setIsAddDoctorOpen(false)}
        onSuccess={(newDoc) => {
          loadDoctors()
          loadDashboardStats()
          success(`Dr. ${newDoc.name} registered successfully!`)
        }}
        departments={departments}
      />

      {/* ── Patient: Manual External Appointment Entry Modal ─────────────── */}
      <ExternalAppointmentModal
        isOpen={isManualExternalOpen}
        onClose={() => {
          setIsManualExternalOpen(false)
          setExternalApptToEdit(null)
        }}
        onSuccess={(newExt) => {
          loadExternalAppointments()
          loadDashboardStats()
          success(externalApptToEdit ? `Appointment ${newExt.appointment_reference} updated!` : `External appointment ${newExt.appointment_reference} logged!`)
          setExternalApptToEdit(null)
        }}
        apptToEdit={externalApptToEdit}
      />

      {/* ── Admin & Staff: Add Hospital Facility Modal ───────────────────── */}
      <HospitalModal
        isOpen={isAddHospitalOpen}
        onClose={() => setIsAddHospitalOpen(false)}
        onSuccess={(newHosp) => {
          loadHospitals()
          loadDashboardStats()
          success(`Hospital facility "${newHosp.name}" registered successfully!`)
        }}
      />
    </div>
  )
}
